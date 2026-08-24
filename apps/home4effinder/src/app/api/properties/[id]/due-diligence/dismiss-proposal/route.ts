import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

/**
 * Markiert einen Feldwert-Übernahmevorschlag als abgelehnt (statt ihn nur zu ignorieren) —
 * ohne das würde derselbe Vorschlag nach der nächsten "Due-Diligence aktualisieren"-Synthese
 * (die fieldUpdateProposals komplett neu aus den Dokumenten generiert) unverändert wieder
 * auftauchen, obwohl der Nutzer ihn bereits bewusst verworfen hat.
 *
 * Read-modify-write mit optimistischer Nebenläufigkeitskontrolle, analog zu
 * apply-proposal/route.ts (Review-Fund: hier fehlte dieselbe Absicherung, die dort schon
 * gegen "zwei Übernehmen-Klicks kurz hintereinander" eingebaut ist — ohne sie könnte eine
 * Ablehnung bei zwei nahezu gleichzeitigen Schreibvorgängen kommentarlos verloren gehen).
 * `property_due_diligence` hat keinen eigenen `updated_at` für dieses Feld — bedingt daher
 * direkt auf dem gelesenen `dismissed_field_proposals`-Wert selbst statt auf einem
 * Zeitstempel.
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

  if (typeof field !== "string" || !field) return NextResponse.json({ error: "field fehlt" }, { status: 400 });
  if (typeof newValue !== "string" && typeof newValue !== "number") return NextResponse.json({ error: "newValue fehlt oder ungültig" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: row, error: fetchError } = await supabase
    .from("property_due_diligence")
    .select("dismissed_field_proposals")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${propertyId}/due-diligence/dismiss-proposal] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "keine Due-Diligence-Synthese vorhanden" }, { status: 404 });

  const existing = Array.isArray(row.dismissed_field_proposals) ? (row.dismissed_field_proposals as { field: string; value: string | number }[]) : [];
  const alreadyDismissed = existing.some((d) => d.field === field && d.value === newValue);
  const updated = alreadyDismissed ? existing : [...existing, { field, value: newValue }];

  const { data: updatedRows, error: updateError } = await supabase
    .from("property_due_diligence")
    .update({ dismissed_field_proposals: updated })
    .eq("property_id", propertyId)
    .eq("dismissed_field_proposals", existing)
    .select("property_id");
  if (updateError) {
    console.error(`[api/properties/${propertyId}/due-diligence/dismiss-proposal] Speichern fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: `write failed: ${updateError.message} (${updateError.code})` }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    // Zwischenzeitlich hat ein anderer Request bereits geschrieben (Konflikt) — nicht
    // überschreiben, Client kann mit dem aktuellen Stand neu versuchen.
    return NextResponse.json({ saved: false, error: "Eine andere Änderung lief gleichzeitig — bitte nochmals versuchen." }, { status: 409 });
  }

  return NextResponse.json({ saved: true });
}
