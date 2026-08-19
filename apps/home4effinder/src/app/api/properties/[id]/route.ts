import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/**
 * Korrigiert die Objekt-Basisdaten (Adresse/Kanton/Kaufpreis/Wohnfläche) nachträglich —
 * ohne diese Route wäre selbst ein Tippfehler in der Adresse nur durch Löschen und
 * Neuanlegen korrigierbar, was alle bereits erfassten Bestandsrendite-Fakten,
 * Dokumente und die Due-Diligence-Synthese mit sich reissen würde.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const addressText = typeof b.addressText === "string" ? b.addressText.trim() : "";
  const canton = typeof b.canton === "string" ? b.canton.trim() : "";
  const askingPriceChf = typeof b.askingPriceChf === "number" ? b.askingPriceChf : undefined;
  const wohnflaecheM2 = typeof b.wohnflaecheM2 === "number" ? b.wohnflaecheM2 : undefined;
  const listingUrlRaw = typeof b.listingUrl === "string" ? b.listingUrl.trim() : "";
  const listingUrl = listingUrlRaw ? listingUrlRaw : null;
  const marketReferenceNotesRaw = typeof b.marketReferenceNotes === "string" ? b.marketReferenceNotes.trim() : "";
  const marketReferenceNotes = marketReferenceNotesRaw ? marketReferenceNotesRaw : null;

  if (!addressText) return NextResponse.json({ error: "addressText fehlt" }, { status: 400 });
  if (!canton) return NextResponse.json({ error: "canton fehlt" }, { status: 400 });
  if (askingPriceChf === undefined || askingPriceChf <= 0) return NextResponse.json({ error: "askingPriceChf fehlt oder ungültig" }, { status: 400 });
  if (wohnflaecheM2 === undefined || wohnflaecheM2 <= 0) return NextResponse.json({ error: "wohnflaecheM2 fehlt oder ungültig" }, { status: 400 });
  if (listingUrl !== null) {
    try {
      new URL(listingUrl);
    } catch {
      return NextResponse.json({ error: "listingUrl ist keine gültige URL" }, { status: 400 });
    }
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: property, error: fetchError } = await supabase.from("properties").select("id").eq("id", propertyId).maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${propertyId}] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const { error: updateError } = await supabase
    .from("properties")
    .update({
      title: addressText,
      address_text: addressText,
      canton,
      asking_price_chf: askingPriceChf,
      wohnflaeche_m2: wohnflaecheM2,
      listing_url: listingUrl,
      market_reference_notes: marketReferenceNotes,
    })
    .eq("id", propertyId);
  if (updateError) {
    console.error(`[api/properties/${propertyId}] Speichern fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: "write failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}

/**
 * Löscht ein Objekt vollständig — inkl. aller hochgeladenen Dokumente (DB-Zeilen UND
 * Dateien im Storage-Bucket) und der Due-Diligence-Synthese. `property_documents`/
 * `property_due_diligence` haben `on delete cascade` auf `properties`, das räumt die
 * DB-Zeilen automatisch auf — aber NICHT die zugehörigen Dateien im Storage-Bucket
 * (das ist ein separates System, keine Fremdschlüsselbeziehung), deshalb hier zuerst
 * explizit die Storage-Objekte entfernen, bevor die Zeile gelöscht wird.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ deleted: false, configured: false }, { status: 200 });

  const { data: property, error: fetchError } = await supabase.from("properties").select("id").eq("id", propertyId).maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${propertyId}] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const { data: documents, error: documentsError } = await supabase.from("property_documents").select("storage_path").eq("property_id", propertyId);
  if (documentsError) {
    console.error(`[api/properties/${propertyId}] Lesen der Dokumente fehlgeschlagen`, documentsError);
    return NextResponse.json({ error: "read documents failed" }, { status: 500 });
  }

  const storagePaths = (documents ?? []).map((d) => d.storage_path);
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("property-documents").remove(storagePaths);
    // Nicht abbrechen — verwaiste Dateien im Storage sind unschön, aber weniger
    // schlimm als ein Objekt, das sich gar nicht löschen lässt.
    if (storageError) console.error(`[api/properties/${propertyId}] Löschen der Dokumente aus Storage fehlgeschlagen`, storageError);
  }

  const { error: deleteError } = await supabase.from("properties").delete().eq("id", propertyId);
  if (deleteError) {
    console.error(`[api/properties/${propertyId}] Löschen fehlgeschlagen`, deleteError);
    return NextResponse.json({ deleted: false, error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
