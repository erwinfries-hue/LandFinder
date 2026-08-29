import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { extractRegionReport } from "@/lib/regionExtraction";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";

/**
 * Stösst die Analyse für einen bereits hochgeladenen Regionsreport erneut an — ohne
 * erneuten Upload, die Datei liegt schon im Storage-Bucket. Mirrort
 * api/properties/[id]/documents/[documentId]/reanalyze/route.ts. Nötig u.a. wenn sich
 * das Extraktionsschema geändert hat (z.B. neu ergänzte Felder wie `kantonKennzahlen`)
 * — der bestehende Content-Hash-Dublettenschutz beim Upload würde einen erneuten
 * Upload derselben Datei sonst nur die ALTE, gecachte Extraktion zurückgeben lassen,
 * ohne neu zu analysieren.
 */
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: regionId, documentId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ analyzed: false, configured: false }, { status: 200 });

  const { data: doc, error: fetchError } = await supabase
    .from("region_documents")
    .select("id, region_id, storage_path, original_filename")
    .eq("id", documentId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[api/regions/${regionId}/documents/${documentId}/reanalyze] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!doc || doc.region_id !== regionId) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const { data: blob, error: downloadError } = await supabase.storage.from("region-documents").download(doc.storage_path);
  if (downloadError || !blob) {
    console.error(`[api/regions/${regionId}/documents/${documentId}/reanalyze] Download aus Storage fehlgeschlagen`, downloadError);
    return NextResponse.json({ error: "storage download failed" }, { status: 500 });
  }

  await supabase.from("region_documents").update({ analysis_status: "PENDING", analysis_error: null }).eq("id", documentId);

  try {
    const extraction = await extractRegionReport(Buffer.from(await blob.arrayBuffer()).toString("base64"), doc.original_filename);
    await supabase
      .from("region_documents")
      .update({ analysis_status: "DONE", extraction, analysis_error: null, analyzed_at: new Date().toISOString(), report_date: extraction.reportDatum ?? null })
      .eq("id", documentId);
    return NextResponse.json({ analyzed: true, status: "DONE", extraction });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Analyse fehlgeschlagen";
    console.error(`[api/regions/${regionId}/documents/${documentId}/reanalyze] Analyse fehlgeschlagen`, err);
    await supabase.from("region_documents").update({ analysis_status: "FAILED", analysis_error: message }).eq("id", documentId);
    return NextResponse.json({ analyzed: false, status: "FAILED", error: message }, { status: 502 });
  }
}
