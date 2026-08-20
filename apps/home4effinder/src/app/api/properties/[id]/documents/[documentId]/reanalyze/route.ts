import { NextResponse } from "next/server";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { extractDocumentFields, AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";

/**
 * Stösst die Stufe-1-Analyse für ein bereits hochgeladenes Dokument erneut an — ohne
 * erneuten Upload, die Datei liegt schon im Storage-Bucket. Für den Fall, dass die
 * Analyse beim ersten Mal fehlgeschlagen ist (z.B. transienter Netzwerk-/API-Fehler,
 * siehe docs/DECISIONS.md) und der Nutzer nicht die ganze Datei erneut hochladen und
 * dabei versehentlich duplizieren soll.
 */
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId, documentId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ analyzed: false, configured: false }, { status: 200 });

  const { data: doc, error: fetchError } = await supabase
    .from("property_documents")
    .select("id, property_id, storage_path, document_type, original_filename")
    .eq("id", documentId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${propertyId}/documents/${documentId}/reanalyze] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!doc || doc.property_id !== propertyId) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const { data: blob, error: downloadError } = await supabase.storage.from("property-documents").download(doc.storage_path);
  if (downloadError || !blob) {
    console.error(`[api/properties/${propertyId}/documents/${documentId}/reanalyze] Download aus Storage fehlgeschlagen`, downloadError);
    return NextResponse.json({ error: "storage download failed" }, { status: 500 });
  }

  await supabase.from("property_documents").update({ analysis_status: "PENDING", analysis_error: null }).eq("id", documentId);

  const pdfBase64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  try {
    const extraction = await extractDocumentFields(pdfBase64, doc.document_type as DueDiligenceDocumentType, doc.original_filename);
    await supabase.from("property_documents").update({ analysis_status: "DONE", extraction, analysis_error: null, analyzed_at: new Date().toISOString() }).eq("id", documentId);
    return NextResponse.json({ analyzed: true, status: "DONE", extraction });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Analyse fehlgeschlagen";
    console.error(`[api/properties/${propertyId}/documents/${documentId}/reanalyze] Analyse fehlgeschlagen`, err);
    await supabase.from("property_documents").update({ analysis_status: "FAILED", analysis_error: message }).eq("id", documentId);
    return NextResponse.json({ analyzed: false, status: "FAILED", error: message }, { status: 502 });
  }
}
