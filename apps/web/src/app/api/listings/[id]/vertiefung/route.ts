import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { parseListingVertiefungFacts } from "@/lib/listingVertiefung";

/**
 * Speichert die manuell erfassten Vertiefungsdaten zu einem echten Inserat
 * ("Objekt vertiefen", `listings.vertiefung`, Migration 0007) — das Gegenstück zur
 * automatischen Stufe-2-Extraktion. Erst danach lässt sich für dieses Inserat ein
 * echter Score/Empfehlung berechnen (siehe apps/web/src/lib/objektAnalysis.ts →
 * `computeListingAnalysis`).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parseListingVertiefungFacts(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("asking_price_chf, parcel_area_m2, canton, object_type")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    console.error(`[api/listings/${id}/vertiefung] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  if (listing.asking_price_chf == null || listing.parcel_area_m2 == null || !listing.canton || !listing.object_type) {
    return NextResponse.json(
      { error: "Preis, Fläche, Kanton und Objektart müssen am Inserat bereits vorhanden sein, bevor es vertieft werden kann." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ vertiefung: parsed.facts, vertiefung_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    console.error(`[api/listings/${id}/vertiefung] Speichern fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: "write failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true }, { status: 200 });
}
