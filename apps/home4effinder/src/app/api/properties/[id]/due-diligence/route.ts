import { NextResponse } from "next/server";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";
import { synthesizeDueDiligence, type SynthesisDocumentInput, type SynthesisKnownFact, type SynthesisKnownField } from "@/lib/dueDiligenceSynthesis";
import { BESTANDSRENDITE_KNOWN_FIELD_LABELS } from "@/lib/bestandsrenditeKnownFields";

export const maxDuration = 60;

/** Feldpfade, die Claude für Feldwert-Übernahmevorschläge referenzieren darf — Labels aus der gemeinsamen Liste (muss mit `ALLOWED_UPDATE_FIELDS` in bestandsrendite.ts übereinstimmen), aktuelle Werte aus den bereits erfassten Facts dieses Objekts. */
function buildKnownFields(facts: Record<string, unknown> | null): SynthesisKnownField[] {
  const f = (facts ?? {}) as Record<string, unknown>;
  return BESTANDSRENDITE_KNOWN_FIELD_LABELS.map(({ field, label }) => {
    const [group, key] = field.includes(".") ? (field.split(".") as [string, string]) : [undefined, field];
    const source = group ? ((f[group] as Record<string, unknown> | undefined) ?? {}) : f;
    const v = source[key];
    const currentValue = typeof v === "number" || typeof v === "string" ? v : undefined;
    return { field, label, currentValue };
  });
}

function buildKnownFacts(property: { address_text: string; canton: string; asking_price_chf: number; wohnflaeche_m2: number }): SynthesisKnownFact[] {
  return [
    { label: "Adresse (laut Erfassung)", value: property.address_text },
    { label: "Kanton", value: property.canton },
    { label: "Kaufpreis (CHF, laut Erfassung)", value: property.asking_price_chf },
    { label: "Wohnfläche (m², laut Erfassung)", value: property.wohnflaeche_m2 },
  ];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("address_text, canton, asking_price_chf, wohnflaeche_m2, bestandsrendite")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) {
    console.error(`[api/properties/${propertyId}/due-diligence] Lesen des Objekts fehlgeschlagen`, propertyError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const { data: documentRows, error: documentsError } = await supabase
    .from("property_documents")
    .select("id, original_filename, document_type, extraction")
    .eq("property_id", propertyId)
    .eq("analysis_status", "DONE");
  if (documentsError) {
    console.error(`[api/properties/${propertyId}/due-diligence] Lesen der Dokumente fehlgeschlagen`, documentsError);
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

  await supabase.from("property_due_diligence").upsert({ property_id: propertyId, status: "ANALYZING" });

  try {
    const result = await synthesizeDueDiligence(documents, buildKnownFacts(property), buildKnownFields(property.bestandsrendite as Record<string, unknown> | null));
    await supabase.from("property_due_diligence").upsert({ property_id: propertyId, status: "DONE", result, error_message: null, generated_at: new Date().toISOString() });
    return NextResponse.json({ saved: true, result });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Synthese fehlgeschlagen";
    console.error(`[api/properties/${propertyId}/due-diligence] Synthese fehlgeschlagen`, err);
    await supabase.from("property_due_diligence").upsert({ property_id: propertyId, status: "FAILED", error_message: message });
    return NextResponse.json({ saved: false, error: message }, { status: 502 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: propertyId } = await params;

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ dueDiligence: null }, { status: 200 });

  const { data, error } = await supabase.from("property_due_diligence").select("status, error_message, result, generated_at").eq("property_id", propertyId).maybeSingle();
  if (error) {
    console.error(`[api/properties/${propertyId}/due-diligence] Lesen fehlgeschlagen`, error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  return NextResponse.json({ dueDiligence: data ?? null });
}
