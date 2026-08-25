import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";
import {
  synthesizeDueDiligenceBatch,
  selectSynthesisPromptDocuments,
  splitDocumentsIntoBatches,
  type PartialSynthesisResult,
  type SynthesisKnownFact,
  type SynthesisKnownField,
} from "@/lib/dueDiligenceSynthesis";
import { BESTANDSRENDITE_KNOWN_FIELD_LABELS } from "@/lib/bestandsrenditeKnownFields";
import { loadSynthesisDocuments } from "./documents";

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

/**
 * Verarbeitet GENAU EINEN Batch der Stufe-2-Synthese pro Aufruf (`batchIndex`, 0-basiert)
 * statt — wie früher — alle Dokumente in einem einzigen, potenziell Vercels
 * 60-Sekunden-Limit überschreitenden Request (siehe docs/DECISIONS.md). Der Client
 * (`DueDiligencePanel.tsx`) ruft diese Route wiederholt auf (batchIndex 0, 1, …), bis
 * `totalBatches` erreicht ist, sammelt die `batchResult`s und schickt sie danach EINMAL
 * an `.../due-diligence/finalize`, wo sie zusammengeführt und persistiert werden.
 * Persistiert hier bewusst NICHTS in `property_due_diligence.result` — nur ein
 * Zwischenergebnis, kein Schema-Update nötig.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  const body = (await request.json().catch(() => ({}))) as { batchIndex?: number };
  const batchIndex = typeof body.batchIndex === "number" && body.batchIndex >= 0 ? body.batchIndex : 0;

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

  const documentsResult = await loadSynthesisDocuments(supabase, propertyId);
  if ("error" in documentsResult) return NextResponse.json({ error: documentsResult.error }, { status: 500 });

  if (batchIndex === 0) {
    await supabase.from("property_due_diligence").upsert({ property_id: propertyId, status: "ANALYZING" });
  }

  const batches = splitDocumentsIntoBatches(selectSynthesisPromptDocuments(documentsResult.documents));
  if (batches.length === 0) {
    // Kein Dokument (nach Filterung) für die Synthese verfügbar — als einzelner leerer
    // Batch behandeln, damit der Client-Loop/die Finalize-Route ohne Sonderfall
    // denselben Codepfad wie bei ≥1 echtem Batch durchlaufen (analog zum früheren
    // documents.length===0-Fall in synthesizeDueDiligence).
    const emptyBatchResult: PartialSynthesisResult = { overallSummary: "", categories: [], sellerQuestions: [], fieldUpdateProposals: [], contradictions: [] };
    return NextResponse.json({ saved: true, batchResult: emptyBatchResult, batchIndex: 0, totalBatches: 1 });
  }

  const focusDocuments = batches[batchIndex];
  if (!focusDocuments) {
    return NextResponse.json({ saved: false, error: "ungültiger batchIndex" }, { status: 400 });
  }
  const otherDocuments = batches.filter((_, i) => i !== batchIndex).flat();

  try {
    const batchResult = await synthesizeDueDiligenceBatch(
      focusDocuments,
      otherDocuments,
      buildKnownFacts(property),
      buildKnownFields(property.bestandsrendite as Record<string, unknown> | null),
    );
    return NextResponse.json({ saved: true, batchResult, batchIndex, totalBatches: batches.length });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Synthese fehlgeschlagen";
    console.error(`[api/properties/${propertyId}/due-diligence] Batch-Synthese fehlgeschlagen (batchIndex=${batchIndex})`, err);
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
