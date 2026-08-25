import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { extractRegionReport, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/regionExtraction";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";

/**
 * Registriert + analysiert einen Regionen-Marktreport (z.B. Wüest Partner
 * "Standortinformation"), der bereits per Signed URL DIREKT zu Supabase Storage
 * hochgeladen wurde (siehe `signed-upload-url/route.ts` + supabaseBrowser.ts) —
 * bekommt hier nur `{storagePath, originalFilename}` als kleines JSON, NICHT die
 * Datei selbst. Vorherige Version nahm die Datei direkt als FormData entgegen; das
 * scheiterte live an Vercels hartem 4.5-MB-Payload-Limit für Serverless-Functions —
 * ein 90-seitiger, mehrere MB grosser Report überschritt das leicht und liess den
 * Request sofort (nicht erst nach der Analyse) mit einem generischen
 * "Netzwerkfehler" fehlschlagen, bevor dieser Route-Handler überhaupt lief
 * (Live-Test-Rückmeldung).
 *
 * Proaktive Dubletten-Prüfung bei identischem `content_hash` INNERHALB derselben
 * Region: liefert die bereits vorhandene Extraktion zurück, OHNE einen zweiten
 * (teuren, bei 90 Seiten nicht ganz kurzen) Claude-Aufruf auszulösen — das bereits
 * hochgeladene (jetzt überflüssige) Storage-Objekt wird dabei wieder gelöscht, damit
 * kein verwaistes Duplikat liegen bleibt.
 *
 * `maxDuration` konservativ auf 60s belassen (Standard-Obergrenze im kostenlosen
 * Vercel-Plan) — die eigentliche Claude-Analyse eines sehr umfangreichen Reports
 * könnte das dennoch überschreiten; das ist ein separates, noch offenes Risiko
 * (siehe DECISIONS.md), unabhängig vom hier behobenen Payload-Limit-Problem.
 */
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: regionId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const storagePath = typeof b.storagePath === "string" ? b.storagePath : "";
  const originalFilename = typeof b.originalFilename === "string" && b.originalFilename.trim() ? b.originalFilename.trim() : "report.pdf";
  if (!storagePath || !storagePath.startsWith(`${regionId}/`)) return NextResponse.json({ error: "storagePath fehlt oder ungültig" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: region, error: regionError } = await supabase.from("regions").select("id").eq("id", regionId).maybeSingle();
  if (regionError) {
    console.error(`[api/regions/${regionId}/documents] Lesen der Region fehlgeschlagen`, regionError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!region) return NextResponse.json({ error: "region not found" }, { status: 404 });

  const { data: fileBlob, error: downloadError } = await supabase.storage.from("region-documents").download(storagePath);
  if (downloadError || !fileBlob) {
    console.error(`[api/regions/${regionId}/documents] Herunterladen der hochgeladenen Datei fehlgeschlagen`, downloadError);
    return NextResponse.json({ error: "hochgeladene Datei nicht gefunden — Upload evtl. fehlgeschlagen" }, { status: 400 });
  }
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  if (bytes.length > MAX_DOCUMENT_SIZE_BYTES) {
    await supabase.storage.from("region-documents").remove([storagePath]);
    return NextResponse.json({ error: `Datei zu gross (max. ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB)` }, { status: 400 });
  }
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
    // Bereits erfasster Report — die soeben hochgeladene Datei ist ein überflüssiges
    // Duplikat im Storage, wieder entfernen statt verwaist liegen zu lassen.
    await supabase.storage.from("region-documents").remove([storagePath]);
    return NextResponse.json({
      saved: true,
      id: existingDoc.id,
      status: existingDoc.analysis_status,
      extraction: existingDoc.extraction,
      duplicate: true,
    });
  }

  const { data: docRow, error: insertError } = await supabase
    .from("region_documents")
    .insert({ region_id: regionId, storage_path: storagePath, original_filename: originalFilename, content_hash: contentHash })
    .select("id")
    .single();
  if (insertError) {
    console.error(`[api/regions/${regionId}/documents] Anlegen der Dokument-Zeile fehlgeschlagen`, insertError);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  try {
    const extraction = await extractRegionReport(Buffer.from(bytes).toString("base64"), originalFilename);
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
