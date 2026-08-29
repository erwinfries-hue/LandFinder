import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/**
 * Mint eine Signed Upload URL für Supabase Storage (Bucket `quellen-dokumente`,
 * Migration 0009) — der Client lädt die Datei damit DIREKT zu Supabase hoch, nicht
 * über eine Vercel-Serverless-Function (4.5-MB-Payload-Limit), analog zu
 * api/regions/[id]/documents/signed-upload-url/route.ts. Anders als dort kein
 * regionId-Präfix nötig — ein Quellenverzeichnis-Eintrag hängt an keiner Elternentität.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 200 });

  const storagePath = `${crypto.randomUUID()}.pdf`;
  const { data, error } = await supabase.storage.from("quellen-dokumente").createSignedUploadUrl(storagePath);
  if (error) {
    console.error("[api/quellen/signed-upload-url] Erstellen der Signed URL fehlgeschlagen", error);
    return NextResponse.json({ error: "signed url failed" }, { status: 500 });
  }

  return NextResponse.json({ storagePath: data.path, signedUrl: data.signedUrl, token: data.token });
}
