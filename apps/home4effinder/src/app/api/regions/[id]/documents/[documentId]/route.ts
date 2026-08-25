import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/** Löscht einen einzelnen Regionsreport — entfernt die Datei aus dem privaten Storage-Bucket UND die zugehörige `region_documents`-Zeile, spiegelt das Muster von api/properties/[id]/documents/[documentId]/route.ts. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: regionId, documentId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ deleted: false, configured: false }, { status: 200 });

  const { data: doc, error: fetchError } = await supabase
    .from("region_documents")
    .select("id, region_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[api/regions/${regionId}/documents/${documentId}] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!doc || doc.region_id !== regionId) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const { error: storageError } = await supabase.storage.from("region-documents").remove([doc.storage_path]);
  if (storageError) {
    console.error(`[api/regions/${regionId}/documents/${documentId}] Löschen aus Storage fehlgeschlagen`, storageError);
  }

  const { error: deleteError } = await supabase.from("region_documents").delete().eq("id", documentId);
  if (deleteError) {
    console.error(`[api/regions/${regionId}/documents/${documentId}] Löschen der Zeile fehlgeschlagen`, deleteError);
    return NextResponse.json({ deleted: false, error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
