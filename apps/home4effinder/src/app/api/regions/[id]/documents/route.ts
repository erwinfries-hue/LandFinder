import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { extractRegionReport, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/regionExtraction";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";

/**
 * Upload + Stufe-1-Analyse eines Regionen-Marktreports (z.B. Wüest Partner
 * "Standortinformation") — spiegelt `api/properties/[id]/documents/route.ts`, mit einer
 * zusätzlichen proaktiven Dubletten-Prüfung: bei identischem `content_hash` INNERHALB
 * derselben Region liefert dieser Endpunkt die bereits vorhandene Extraktion zurück,
 * OHNE einen zweiten (teuren, bei 90 Seiten nicht ganz kurzen) Claude-Aufruf auszulösen
 * — anders als bei Objektdokumenten, wo Dubletten nur nachträglich per Button erkannt
 * werden, wiederholt sich ein Regionsreport-Upload real (mehrere Objekte in derselben
 * Gemeinde, derselbe Report erneut hochgeladen).
 *
 * Nur PDF (kein Klartext-Einfügen wie bei Objektdokumenten) — Regionsreports sind
 * immer als PDF-Export vom Datenanbieter verfügbar.
 *
 * `maxDuration` bewusst höher als bei Objektdokumenten (60s) — ein 90-seitiger Report
 * kann bei der Extraktion länger brauchen als ein typisches 5-20-seitiges
 * STWEG-Protokoll. Falls das in der Praxis nicht reicht, siehe DECISIONS.md.
 */
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: regionId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file fehlt" }, { status: 400 });
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json({ error: `Datei zu gross (max. ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB)` }, { status: 400 });
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return NextResponse.json({ error: "Nur PDF-Dateien werden unterstützt" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: region, error: regionError } = await supabase.from("regions").select("id").eq("id", regionId).maybeSingle();
  if (regionError) {
    console.error(`[api/regions/${regionId}/documents] Lesen der Region fehlgeschlagen`, regionError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!region) return NextResponse.json({ error: "region not found" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  const { data: existingDoc, error: existingError } = await supabase
    .from("region_documents")
    .select("id, analysis_status, analysis_error, extraction")
    .eq("region_id", regionId)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (existingError) {
    console.error(`[api/regions/${regionId}/documents] Dublettenprüfung fehlgeschlagen`, existingError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (existingDoc) {
    return NextResponse.json({
      saved: true,
      id: existingDoc.id,
      status: existingDoc.analysis_status,
      extraction: existingDoc.extraction,
      duplicate: true,
    });
  }

  const storagePath = `${regionId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("region-documents").upload(storagePath, bytes, { contentType: "application/pdf" });
  if (uploadError) {
    console.error(`[api/regions/${regionId}/documents] Upload in Storage fehlgeschlagen`, uploadError);
    return NextResponse.json({ error: "storage upload failed" }, { status: 500 });
  }

  const { data: docRow, error: insertError } = await supabase
    .from("region_documents")
    .insert({ region_id: regionId, storage_path: storagePath, original_filename: file.name, content_hash: contentHash })
    .select("id")
    .single();
  if (insertError) {
    console.error(`[api/regions/${regionId}/documents] Anlegen der Dokument-Zeile fehlgeschlagen`, insertError);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  try {
    const extraction = await extractRegionReport(Buffer.from(bytes).toString("base64"), file.name);
    await supabase
      .from("region_documents")
      .update({ analysis_status: "DONE", extraction, analyzed_at: new Date().toISOString(), report_date: extraction.reportDatum ?? null })
      .eq("id", docRow.id);
    return NextResponse.json({ saved: true, id: docRow.id, status: "DONE", extraction }, { status: 201 });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Analyse fehlgeschlagen";
    console.error(`[api/regions/${regionId}/documents] Analyse fehlgeschlagen`, err);
    await supabase.from("region_documents").update({ analysis_status: "FAILED", analysis_error: message }).eq("id", docRow.id);
    return NextResponse.json({ saved: true, id: docRow.id, status: "FAILED", error: message }, { status: 201 });
  }
}
