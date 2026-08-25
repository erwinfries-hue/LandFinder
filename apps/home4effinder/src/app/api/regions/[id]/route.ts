import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/**
 * Löscht eine Region komplett — inkl. aller hochgeladenen Reports (DB-Zeilen UND
 * Dateien im Storage-Bucket), mirrort `api/properties/[id]/route.ts::DELETE`. Nötig,
 * weil beim Testen leicht eine Fehlversuchs- oder Doppel-Region entsteht (z.B. Region
 * angelegt, Upload danach fehlgeschlagen) — ohne diese Route liesse sich das nur
 * direkt in der Datenbank bereinigen.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: regionId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ deleted: false, configured: false }, { status: 200 });

  const { data: region, error: fetchError } = await supabase.from("regions").select("id").eq("id", regionId).maybeSingle();
  if (fetchError) {
    console.error(`[api/regions/${regionId}] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!region) return NextResponse.json({ error: "region not found" }, { status: 404 });

  const { data: documents, error: documentsError } = await supabase.from("region_documents").select("storage_path").eq("region_id", regionId);
  if (documentsError) {
    console.error(`[api/regions/${regionId}] Lesen der Reports fehlgeschlagen`, documentsError);
    return NextResponse.json({ error: "read documents failed" }, { status: 500 });
  }

  const storagePaths = (documents ?? []).map((d) => d.storage_path);
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("region-documents").remove(storagePaths);
    // Nicht abbrechen — verwaiste Dateien im Storage sind unschön, aber weniger
    // schlimm als eine Region, die sich gar nicht löschen lässt.
    if (storageError) console.error(`[api/regions/${regionId}] Löschen der Reports aus Storage fehlgeschlagen`, storageError);
  }

  const { error: deleteError } = await supabase.from("regions").delete().eq("id", regionId);
  if (deleteError) {
    console.error(`[api/regions/${regionId}] Löschen fehlgeschlagen`, deleteError);
    return NextResponse.json({ deleted: false, error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
