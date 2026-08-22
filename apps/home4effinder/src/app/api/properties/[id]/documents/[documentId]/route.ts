import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/**
 * Schaltet `excluded_from_synthesis` für ein einzelnes Dokument um — ausgeschlossene
 * Dokumente bleiben erhalten und in Stufe 1 analysiert, fliessen aber nicht mehr in die
 * Stufe-2-Synthese ein (siehe `due-diligence/route.ts`). Gedacht für Dokumente, die die
 * Synthese unnötig verlangsamen/zum Timeout bringen — temporär statt löschen, jederzeit
 * wieder einschliessbar.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId, documentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (typeof b.excludedFromSynthesis !== "boolean") return NextResponse.json({ error: "excludedFromSynthesis fehlt" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: doc, error: fetchError } = await supabase.from("property_documents").select("id, property_id").eq("id", documentId).maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${propertyId}/documents/${documentId}] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!doc || doc.property_id !== propertyId) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const { error: updateError } = await supabase.from("property_documents").update({ excluded_from_synthesis: b.excludedFromSynthesis }).eq("id", documentId);
  if (updateError) {
    console.error(`[api/properties/${propertyId}/documents/${documentId}] Aktualisieren fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}

/**
 * Löscht ein einzelnes Due-Diligence-Dokument — entfernt die Datei aus dem privaten
 * Storage-Bucket UND die zugehörige `property_documents`-Zeile. Ein bereits
 * gespeichertes `property_due_diligence`-Ergebnis, das dieses Dokument referenziert,
 * wird dabei bewusst NICHT automatisch neu berechnet — es bleibt bis zum nächsten
 * "Due-Diligence aktualisieren" als Snapshot stehen, konsistent damit, dass die
 * Synthese ohnehin nur auf explizites Anstossen läuft (siehe `due-diligence/route.ts`).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId, documentId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ deleted: false, configured: false }, { status: 200 });

  const { data: doc, error: fetchError } = await supabase
    .from("property_documents")
    .select("id, property_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${propertyId}/documents/${documentId}] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!doc || doc.property_id !== propertyId) return NextResponse.json({ error: "document not found" }, { status: 404 });

  const { error: storageError } = await supabase.storage.from("property-documents").remove([doc.storage_path]);
  if (storageError) {
    // Nicht abbrechen — eine verwaiste Datei im Storage ist unschön, aber weniger
    // schlimm als eine Datenbankzeile, die auf eine bereits gelöschte Datei zeigt.
    console.error(`[api/properties/${propertyId}/documents/${documentId}] Löschen aus Storage fehlgeschlagen`, storageError);
  }

  const { error: deleteError } = await supabase.from("property_documents").delete().eq("id", documentId);
  if (deleteError) {
    console.error(`[api/properties/${propertyId}/documents/${documentId}] Löschen der Zeile fehlgeschlagen`, deleteError);
    return NextResponse.json({ deleted: false, error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
