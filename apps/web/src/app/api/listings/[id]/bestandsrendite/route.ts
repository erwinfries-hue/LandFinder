import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { parseBestandsrenditeFacts } from "@/lib/bestandsrenditeVertiefung";

/**
 * Speichert die manuell erfassten Bestandsrendite-Fakten (`listings.bestandsrendite`,
 * Migration 0009) — das Pendant zu `.../vertiefung/route.ts` für BESTANDSWOHNUNG statt
 * Bauland/Abbruchobjekt. Erst danach lässt sich `computeBestandsrenditeAnalysis`
 * sinnvoll berechnen (siehe bestandsrenditeVertiefung.ts).
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

  const parsed = parseBestandsrenditeFacts(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: listing, error: fetchError } = await supabase.from("listings").select("asking_price_chf, wohnflaeche_m2, object_type").eq("id", id).maybeSingle();
  if (fetchError) {
    console.error(`[api/listings/${id}/bestandsrendite] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!listing) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  if (listing.object_type !== "BESTANDSWOHNUNG") return NextResponse.json({ error: "Nur für Objektart BESTANDSWOHNUNG verfügbar." }, { status: 400 });
  if (listing.asking_price_chf == null || listing.wohnflaeche_m2 == null) {
    return NextResponse.json({ error: "Kaufpreis und Wohnfläche müssen am Objekt bereits vorhanden sein." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({ bestandsrendite: parsed.facts, bestandsrendite_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    console.error(`[api/listings/${id}/bestandsrendite] Speichern fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: "write failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true }, { status: 200 });
}
