import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { applyFieldUpdate, isAllowedUpdateField } from "@/lib/bestandsrendite";

/**
 * Übernimmt einen einzelnen, vom Nutzer bestätigten Feldwert-Übernahmevorschlag aus
 * der Due-Diligence-Synthese in `properties.bestandsrendite` ("Keine Werte
 * stillschweigend überschreiben ... → übernehmen?"). Nie automatisch aufgerufen — nur
 * durch einen expliziten Klick in der UI.
 *
 * Read-modify-write mit optimistischer Nebenläufigkeitskontrolle: liest die aktuellen
 * Fakten INKLUSIVE `bestandsrendite_updated_at`, schreibt die aktualisierten Fakten nur
 * zurück, wenn sich `bestandsrendite_updated_at` seit dem Lesen nicht geändert hat (via
 * `.eq(...)` in der WHERE-Klausel). Ohne das: klickt der Nutzer zwei "Übernehmen"-Buttons
 * kurz hintereinander (z.B. zwei Widerspruchs-Optionen oder zwei verschiedene Vorschläge),
 * lesen beide Requests denselben alten Stand, und der zuletzt abgeschlossene Schreibvorgang
 * überschreibt den anderen vollständig — der zuerst übernommene Wert geht dabei
 * kommentarlos verloren ("Felder werden gelöscht", per Live-Test beobachtet). Bei einem
 * erkannten Konflikt wird NICHT überschrieben, sondern 409 zurückgegeben — der Client
 * serialisiert zusätzlich alle Übernehmen-Klicks (siehe DueDiligencePanel.tsx), das hier
 * ist die zweite Verteidigungslinie (z.B. bei zwei offenen Tabs).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const field = b.field;
  const newValue = b.newValue;

  if (typeof field !== "string" || !isAllowedUpdateField(field)) return NextResponse.json({ error: "field fehlt oder nicht erlaubt" }, { status: 400 });
  if (typeof newValue !== "string" && typeof newValue !== "number") return NextResponse.json({ error: "newValue fehlt oder ungültig" }, { status: 400 });

  // ALLE aktuell erlaubten Update-Felder (ALLOWED_UPDATE_FIELDS) sind numerische
  // Bestandsrendite-Facts-Felder — die Due-Diligence-Synthese darf `newValue` aber
  // technisch auch als String liefern (Claude-Tool-Schema erlaubt string|number, siehe
  // dueDiligenceSynthesis.ts). Ohne diese Prüfung könnte ein nicht-numerischer String
  // unverändert in ein Zahlenfeld geschrieben werden — jede Berechnung, die dieses Feld
  // danach verwendet, würde stillschweigend zu NaN, ohne dass irgendwo eine Fehlermeldung
  // erscheint (Review-Fund).
  const numericValue = typeof newValue === "number" ? newValue : Number(newValue);
  if (!Number.isFinite(numericValue)) return NextResponse.json({ error: "newValue ist keine gültige Zahl" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: property, error: fetchError } = await supabase
    .from("properties")
    .select("bestandsrendite, bestandsrendite_updated_at")
    .eq("id", propertyId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${propertyId}/due-diligence/apply-proposal] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const updatedFacts = applyFieldUpdate((property.bestandsrendite as Record<string, unknown>) ?? {}, field, numericValue);

  let updateQuery = supabase
    .from("properties")
    .update({ bestandsrendite: updatedFacts, bestandsrendite_updated_at: new Date().toISOString() })
    .eq("id", propertyId);
  updateQuery = property.bestandsrendite_updated_at ? updateQuery.eq("bestandsrendite_updated_at", property.bestandsrendite_updated_at) : updateQuery.is("bestandsrendite_updated_at", null);

  const { data: updatedRows, error: updateError } = await updateQuery.select("id");
  if (updateError) {
    console.error(`[api/properties/${propertyId}/due-diligence/apply-proposal] Speichern fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: `write failed: ${updateError.message} (${updateError.code})` }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    // Zwischenzeitlich hat ein anderer Request bereits geschrieben (Konflikt) — nicht
    // überschreiben, Client kann mit dem aktuellen Stand neu versuchen.
    return NextResponse.json({ saved: false, error: "Ein anderer Übernahme-Vorgang lief gleichzeitig — bitte nochmals versuchen." }, { status: 409 });
  }

  return NextResponse.json({ saved: true });
}
