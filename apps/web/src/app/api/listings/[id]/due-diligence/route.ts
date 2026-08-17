import { NextResponse } from "next/server";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";
import { synthesizeDueDiligence, type SynthesisDocumentInput, type SynthesisKnownFact, type SynthesisKnownField } from "@/lib/dueDiligenceSynthesis";

export const maxDuration = 60;

/** Feldpfade, die Claude für Feldwert-Übernahmevorschläge referenzieren darf — muss mit `BestandsrenditeFacts` (bestandsrenditeVertiefung.ts) übereinstimmen. */
function buildKnownFields(facts: Record<string, unknown> | null): SynthesisKnownField[] {
  const f = (facts ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const val = (obj: Record<string, unknown> | undefined, key: string): number | string | undefined => {
    const v = obj?.[key];
    return typeof v === "number" || typeof v === "string" ? v : undefined;
  };
  return [
    { field: "miete.wohnungsMieteChfPerMonth", label: "Nettomiete Wohnung (CHF/Monat)", currentValue: val(f.miete, "wohnungsMieteChfPerMonth") },
    { field: "miete.parkplatzMieteChfPerMonth", label: "Miete Parkplatz (CHF/Monat)", currentValue: val(f.miete, "parkplatzMieteChfPerMonth") },
    { field: "betriebskosten.stwegAkontobeitragChfPerYear", label: "STWEG-Akontobeitrag (CHF/Jahr)", currentValue: val(f.betriebskosten, "stwegAkontobeitragChfPerYear") },
    { field: "stweg.erneuerungsfondsSaldoChf", label: "Erneuerungsfonds-Saldo (CHF)", currentValue: val(f.stweg, "erneuerungsfondsSaldoChf") },
    { field: "stweg.erneuerungsfondsZielwertChf", label: "Erneuerungsfonds-Zielwert (CHF)", currentValue: val(f.stweg, "erneuerungsfondsZielwertChf") },
    { field: "stweg.wertquotePromille", label: "Wertquote (Promille)", currentValue: val(f.stweg, "wertquotePromille") },
  ];
}

function buildKnownFacts(listing: { address_text: string | null; canton: string | null; asking_price_chf: number | null; wohnflaeche_m2: number | null }): SynthesisKnownFact[] {
  const facts: SynthesisKnownFact[] = [];
  if (listing.address_text) facts.push({ label: "Adresse (laut Inserat/Erfassung)", value: listing.address_text });
  if (listing.canton) facts.push({ label: "Kanton", value: listing.canton });
  if (listing.asking_price_chf != null) facts.push({ label: "Kaufpreis (CHF, laut Inserat/Erfassung)", value: listing.asking_price_chf });
  if (listing.wohnflaeche_m2 != null) facts.push({ label: "Wohnfläche (m², laut Inserat/Erfassung)", value: listing.wohnflaeche_m2 });
  return facts;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: listingId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("address_text, canton, asking_price_chf, wohnflaeche_m2, bestandsrendite")
    .eq("id", listingId)
    .maybeSingle();
  if (listingError) {
    console.error(`[api/listings/${listingId}/due-diligence] Lesen des Objekts fehlgeschlagen`, listingError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  const { data: documentRows, error: documentsError } = await supabase
    .from("object_documents")
    .select("id, original_filename, document_type, extraction")
    .eq("listing_id", listingId)
    .eq("analysis_status", "DONE");
  if (documentsError) {
    console.error(`[api/listings/${listingId}/due-diligence] Lesen der Dokumente fehlgeschlagen`, documentsError);
    return NextResponse.json({ error: "read documents failed" }, { status: 500 });
  }

  const documents: SynthesisDocumentInput[] = (documentRows ?? []).map((row) => {
    const extraction = (row.extraction ?? {}) as { summary?: string; facts?: Record<string, unknown>; findings?: SynthesisDocumentInput["findings"] };
    return {
      id: row.id,
      filename: row.original_filename,
      documentType: row.document_type as DueDiligenceDocumentType,
      summary: extraction.summary ?? "",
      facts: extraction.facts ?? {},
      findings: extraction.findings ?? [],
    };
  });

  await supabase.from("object_due_diligence").upsert({ listing_id: listingId, status: "ANALYZING" });

  try {
    const result = await synthesizeDueDiligence(documents, buildKnownFacts(listing), buildKnownFields(listing.bestandsrendite as Record<string, unknown> | null));
    await supabase.from("object_due_diligence").upsert({ listing_id: listingId, status: "DONE", result, error_message: null, generated_at: new Date().toISOString() });
    return NextResponse.json({ saved: true, result });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Synthese fehlgeschlagen";
    console.error(`[api/listings/${listingId}/due-diligence] Synthese fehlgeschlagen`, err);
    await supabase.from("object_due_diligence").upsert({ listing_id: listingId, status: "FAILED", error_message: message });
    return NextResponse.json({ saved: false, error: message }, { status: 502 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: listingId } = await params;

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ dueDiligence: null }, { status: 200 });

  const { data, error } = await supabase.from("object_due_diligence").select("status, error_message, result, generated_at").eq("listing_id", listingId).maybeSingle();
  if (error) {
    console.error(`[api/listings/${listingId}/due-diligence] Lesen fehlgeschlagen`, error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  return NextResponse.json({ dueDiligence: data ?? null });
}
