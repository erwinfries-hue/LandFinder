import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/** Löscht einen Quellenverzeichnis-Eintrag — entfernt bei einer hochgeladenen Datei auch das Storage-Objekt, spiegelt api/regions/[id]/documents/[documentId]/route.ts. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ deleted: false, configured: false }, { status: 200 });

  const { data: quelle, error: fetchError } = await supabase.from("quellen").select("id, storage_path").eq("id", id).maybeSingle();
  if (fetchError) {
    console.error(`[api/quellen/${id}] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!quelle) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (quelle.storage_path) {
    const { error: storageError } = await supabase.storage.from("quellen-dokumente").remove([quelle.storage_path]);
    if (storageError) {
      console.error(`[api/quellen/${id}] Löschen aus Storage fehlgeschlagen`, storageError);
    }
  }

  const { error: deleteError } = await supabase.from("quellen").delete().eq("id", id);
  if (deleteError) {
    console.error(`[api/quellen/${id}] Löschen der Zeile fehlgeschlagen`, deleteError);
    return NextResponse.json({ deleted: false, error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
