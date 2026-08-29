import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/**
 * Ein einziges, uniformes Link-Ziel für die UI unabhängig davon, ob der Eintrag eine
 * hochgeladene Datei oder eine externe URL ist — bei einer hochgeladenen Datei (privater
 * Bucket `quellen-dokumente`) wird kurzlebig eine Signed URL erzeugt und dorthin
 * weitergeleitet, bei einer externen URL direkt dorthin.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data: quelle, error } = await supabase.from("quellen").select("storage_path, external_url").eq("id", id).maybeSingle();
  if (error) {
    console.error(`[api/quellen/${id}/download] Lesen fehlgeschlagen`, error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!quelle) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (quelle.external_url) return NextResponse.redirect(quelle.external_url);

  if (!quelle.storage_path) return NextResponse.json({ error: "kein Link hinterlegt" }, { status: 500 });
  const { data: signed, error: signedError } = await supabase.storage.from("quellen-dokumente").createSignedUrl(quelle.storage_path, 60);
  if (signedError || !signed) {
    console.error(`[api/quellen/${id}/download] Signed URL fehlgeschlagen`, signedError);
    return NextResponse.json({ error: "signed url failed" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
