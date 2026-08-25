import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/**
 * Mint eine Signed Upload URL für Supabase Storage — der Client lädt die grosse
 * PDF-Datei damit DIREKT zu Supabase hoch, nicht über diese (oder eine andere)
 * Vercel-Serverless-Function. Grund: Vercel-Functions haben ein hartes
 * Payload-Limit von 4.5 MB, ein mehrseitiger Regionsreport überschreitet das leicht
 * (siehe supabaseBrowser.ts). Dieser Request/die Response hier sind winzig (nur die
 * URL/das Token), deshalb unproblematisch.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: regionId } = await params;

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 200 });

  const { data: region, error: regionError } = await supabase.from("regions").select("id").eq("id", regionId).maybeSingle();
  if (regionError) {
    console.error(`[api/regions/${regionId}/documents/signed-upload-url] Lesen der Region fehlgeschlagen`, regionError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!region) return NextResponse.json({ error: "region not found" }, { status: 404 });

  const storagePath = `${regionId}/${crypto.randomUUID()}.pdf`;
  const { data, error } = await supabase.storage.from("region-documents").createSignedUploadUrl(storagePath);
  if (error) {
    console.error(`[api/regions/${regionId}/documents/signed-upload-url] Erstellen der Signed URL fehlgeschlagen`, error);
    return NextResponse.json({ error: "signed url failed" }, { status: 500 });
  }

  return NextResponse.json({ storagePath: data.path, signedUrl: data.signedUrl, token: data.token });
}
