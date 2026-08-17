import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { applyFieldUpdate, isAllowedUpdateField } from "@/lib/bestandsrenditeVertiefung";

/**
 * Übernimmt einen einzelnen, vom Nutzer bestätigten Feldwert-Übernahmevorschlag aus
 * der Due-Diligence-Synthese in `listings.bestandsrendite` (docs/OPEN_DECISIONS.md,
 * Punkt O: "Keine Werte stillschweigend überschreiben ... → übernehmen?"). Nie
 * automatisch aufgerufen — nur durch einen expliziten Klick in der UI.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: listingId } = await params;

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

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: listing, error: fetchError } = await supabase.from("listings").select("bestandsrendite").eq("id", listingId).maybeSingle();
  if (fetchError) {
    console.error(`[api/listings/${listingId}/due-diligence/apply-proposal] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  const updatedFacts = applyFieldUpdate((listing.bestandsrendite as Record<string, unknown>) ?? {}, field, newValue);

  const { error: updateError } = await supabase
    .from("listings")
    .update({ bestandsrendite: updatedFacts, bestandsrendite_updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (updateError) {
    console.error(`[api/listings/${listingId}/due-diligence/apply-proposal] Speichern fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: "write failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
