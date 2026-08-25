import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { mergeDueDiligenceBatches, type PartialSynthesisResult } from "@/lib/dueDiligenceSynthesis";
import { loadSynthesisDocuments } from "../documents";

// Reine Merge-/Berechnungslogik, kein Claude-Aufruf mehr — deutlich unter Vercels
// 60-Sekunden-Limit, auch bei vielen Batches.
export const maxDuration = 10;

/**
 * Letzter Schritt der batchweisen Stufe-2-Synthese (siehe `../route.ts`): führt die vom
 * Client gesammelten `batches` (ein `PartialSynthesisResult` pro zuvor einzeln
 * synthetisiertem Dokumenten-Batch) zusammen und persistiert das Ergebnis erst JETZT in
 * `property_due_diligence`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  const body = (await request.json().catch(() => ({}))) as { batches?: PartialSynthesisResult[] };
  if (!Array.isArray(body.batches) || body.batches.length === 0) {
    return NextResponse.json({ saved: false, error: "keine Batch-Ergebnisse übergeben" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const documentsResult = await loadSynthesisDocuments(supabase, propertyId);
  if ("error" in documentsResult) return NextResponse.json({ error: documentsResult.error }, { status: 500 });

  try {
    const result = mergeDueDiligenceBatches(body.batches, documentsResult.documents);
    await supabase.from("property_due_diligence").upsert({ property_id: propertyId, status: "DONE", result, error_message: null, generated_at: new Date().toISOString() });
    return NextResponse.json({ saved: true, result });
  } catch (err) {
    console.error(`[api/properties/${propertyId}/due-diligence/finalize] Zusammenführen fehlgeschlagen`, err);
    await supabase.from("property_due_diligence").upsert({ property_id: propertyId, status: "FAILED", error_message: "Zusammenführen fehlgeschlagen" });
    return NextResponse.json({ saved: false, error: "Zusammenführen fehlgeschlagen" }, { status: 500 });
  }
}
