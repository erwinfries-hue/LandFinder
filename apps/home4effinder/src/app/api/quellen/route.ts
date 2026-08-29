import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/regionExtraction";

/**
 * Legt einen neuen Quellenverzeichnis-Eintrag an — entweder mit einer bereits per
 * Signed URL hochgeladenen Datei (`storagePath`+`originalFilename`, siehe
 * signed-upload-url/route.ts) ODER mit einer externen URL (`externalUrl`), nie beide
 * (siehe Check-Constraint in Migration 0009). Bewusst OHNE KI-Extraktion — reine
 * Metadaten-Erfassung, siehe src/lib/quellen.ts.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });
  const category = typeof b.category === "string" && b.category.trim() ? b.category.trim() : "Sonstiges";
  const publisher = typeof b.publisher === "string" && b.publisher.trim() ? b.publisher.trim() : null;
  const publishedDate = typeof b.publishedDate === "string" && b.publishedDate.trim() ? b.publishedDate.trim() : null;
  const notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;
  const externalUrl = typeof b.externalUrl === "string" && b.externalUrl.trim() ? b.externalUrl.trim() : null;
  const storagePath = typeof b.storagePath === "string" && b.storagePath.trim() ? b.storagePath.trim() : null;
  const originalFilename = typeof b.originalFilename === "string" && b.originalFilename.trim() ? b.originalFilename.trim() : null;

  if (Boolean(externalUrl) === Boolean(storagePath)) {
    return NextResponse.json({ error: "Entweder eine hochgeladene Datei ODER eine externe URL angeben, nicht beides/keins" }, { status: 400 });
  }
  if (externalUrl) {
    try {
      new URL(externalUrl);
    } catch {
      return NextResponse.json({ error: "Ungültige URL" }, { status: 400 });
    }
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  let contentHash: string | null = null;
  if (storagePath) {
    const { data: fileBlob, error: downloadError } = await supabase.storage.from("quellen-dokumente").download(storagePath);
    if (downloadError || !fileBlob) {
      console.error("[api/quellen] Herunterladen der hochgeladenen Datei fehlgeschlagen", downloadError);
      return NextResponse.json({ error: "hochgeladene Datei nicht gefunden — Upload evtl. fehlgeschlagen" }, { status: 400 });
    }
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    if (bytes.length > MAX_DOCUMENT_SIZE_BYTES) {
      await supabase.storage.from("quellen-dokumente").remove([storagePath]);
      return NextResponse.json({ error: `Datei zu gross (max. ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB)` }, { status: 400 });
    }
    contentHash = createHash("sha256").update(bytes).digest("hex");

    const { data: existing, error: existingError } = await supabase.from("quellen").select("id").eq("content_hash", contentHash).maybeSingle();
    if (existingError) {
      console.error("[api/quellen] Dublettenprüfung fehlgeschlagen", existingError);
      return NextResponse.json({ error: "read failed" }, { status: 500 });
    }
    if (existing) {
      await supabase.storage.from("quellen-dokumente").remove([storagePath]);
      return NextResponse.json({ error: "Diese Datei ist bereits im Quellenverzeichnis erfasst" }, { status: 409 });
    }
  }

  const { data: row, error: insertError } = await supabase
    .from("quellen")
    .insert({
      title,
      category,
      publisher,
      published_date: publishedDate,
      notes,
      external_url: externalUrl,
      storage_path: storagePath,
      original_filename: originalFilename,
      content_hash: contentHash,
    })
    .select("id")
    .single();
  if (insertError) {
    console.error("[api/quellen] Anlegen fehlgeschlagen", insertError);
    if (storagePath) await supabase.storage.from("quellen-dokumente").remove([storagePath]);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: row.id }, { status: 201 });
}
