import type { DueDiligenceDocumentType } from "@landfinder/domain";
import type { SynthesisDocumentInput } from "@/lib/dueDiligenceSynthesis";
import type { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Lädt & mappt die für die Synthese relevanten Dokumente eines Objekts — identisch
 * zwischen der batchweisen Synthese-Route (`route.ts`) und der Merge-Route
 * (`finalize/route.ts`) gebraucht, deshalb hier zentral statt zweimal dupliziert.
 */
export async function loadSynthesisDocuments(
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  propertyId: string,
): Promise<{ documents: SynthesisDocumentInput[] } | { error: string }> {
  const { data: documentRows, error } = await supabase
    .from("property_documents")
    .select("id, original_filename, document_type, extraction")
    .eq("property_id", propertyId)
    .eq("analysis_status", "DONE")
    .eq("excluded_from_synthesis", false);
  if (error) {
    console.error(`[due-diligence] Lesen der Dokumente fehlgeschlagen (property ${propertyId})`, error);
    return { error: "read documents failed" };
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

  return { documents };
}
