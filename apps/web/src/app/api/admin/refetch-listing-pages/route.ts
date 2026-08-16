import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { fetchListingPage } from "@/lib/fetchListingPage";
import { extractListingFields } from "@/lib/listingExtraction";
import { isPortalUrl, isSearchResultsUrl } from "@/lib/inboundMail";
import { deriveCantonFromAddress } from "@/lib/plzKanton";

export const maxDuration = 30;

/**
 * Wartungs-Route, dauerhaft und gefahrlos wiederholt aufrufbar (wie backfill-addresses) —
 * aber anders als diese: ruft die echte Inserat-Seite ERNEUT ab, statt nur den bereits
 * gespeicherten Mailinhalt erneut zu durchsuchen. Sinn: diese Sandbox hat keinen
 * Internetzugang zu den Portalen (Netzwerk-Policy blockiert z.B. homegate.ch), Vercel
 * (wo diese Route tatsächlich läuft) hingegen schon — ein Seitenabruf, der beim
 * ursprünglichen Verarbeitungslauf blockiert war oder nichts Brauchbares fand, kann
 * jetzt trotzdem gelingen (z.B. wenn die Blockade nur vorübergehend war).
 *
 * Anlass (2026-08-16): ein Inserat zeigte auf der echten Portal-Seite Angaben (Wohnzone
 * W1, ein bestehendes Gebäude Baujahr 1837), die nirgends in unseren Daten auftauchten
 * — die ursprüngliche Verarbeitung hatte dafür nur den (knapperen) Mailinhalt zur
 * Verfügung, nicht die volle Seite. Kein neuartiges Scraping: dieselbe, bereits
 * freigegebene Operation (Einzelseiten-Abruf der einen bekannten Inserat-URL, siehe
 * docs/OPEN_DECISIONS.md Punkt A) — nur ein wiederholter Versuch statt eines einmaligen.
 *
 * Ändert nur Felder, die bei einer Zeile noch NULL sind — nie ein bereits gesetztes
 * Feld überschreiben. Bewusst auf wenige Zeilen pro Aufruf begrenzt (echte, potenziell
 * langsame externe Seitenabrufe, nicht nur Regex über bereits vorhandenen Text) —
 * mehrfacher Aufruf verarbeitet nach und nach weitere Zeilen.
 */
const MAX_REFETCH_PER_RUN = 8;

export async function GET(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, canonical_url, address_text, canton, parcel_area_m2, known_zone, existing_building, extraction")
    .or("parcel_area_m2.is.null,known_zone.is.null,existing_building.is.null")
    .order("last_seen_at", { ascending: false })
    .limit(200);
  if (listingsError) {
    console.error("[admin/refetch-listing-pages] Lesen von listings fehlgeschlagen", listingsError);
    return NextResponse.json({ error: "read listings failed" }, { status: 500 });
  }

  // Nur echte Portal-Links (keine Trefferlisten-Zeilen, siehe isSearchResultsUrl) und
  // nur Zeilen, die noch nie eine erfolgreiche ANTHROPIC-Extraktion hatten — die wäre
  // bereits die bestmögliche Methode, ein erneuter Abruf brächte nichts Neues.
  const candidates = (listings ?? [])
    .filter((l) => isPortalUrl(l.canonical_url) && !isSearchResultsUrl(l.canonical_url))
    .filter((l) => (l.extraction as { method?: string } | null)?.method !== "ANTHROPIC")
    .slice(0, MAX_REFETCH_PER_RUN);

  if (candidates.length === 0) {
    return NextResponse.json({ checked: 0, refetched: 0, updated: 0, results: [] });
  }

  const results: { id: string; canonicalUrl: string; status: string; httpStatus?: number | null; fieldsFound?: string[] }[] = [];
  let updated = 0;

  await Promise.all(
    candidates.map(async (listing) => {
      const fetchResult = await fetchListingPage(listing.canonical_url);

      if (fetchResult.status !== "OK") {
        await supabase
          .from("listings")
          .update({ last_fetch_http_status: fetchResult.httpStatus ?? null, last_fetch_at: new Date().toISOString() })
          .eq("id", listing.id);
        results.push({ id: listing.id, canonicalUrl: listing.canonical_url, status: fetchResult.status, httpStatus: fetchResult.httpStatus ?? null });
        return;
      }

      const extraction = await extractListingFields(fetchResult.html);

      // Nur Felder anfassen, die bei dieser Zeile noch fehlen UND die die Extraktion
      // tatsächlich liefert — nie ein bereits gesetztes Feld überschreiben.
      const updates: { address_text?: string; parcel_area_m2?: number; known_zone?: string; canton?: string; existing_building?: boolean } = {};
      if (listing.address_text == null && extraction.fields.addressText) updates.address_text = extraction.fields.addressText;
      if (listing.parcel_area_m2 == null && extraction.fields.parcelAreaM2 != null) updates.parcel_area_m2 = extraction.fields.parcelAreaM2;
      if (listing.known_zone == null && extraction.fields.knownZone) updates.known_zone = extraction.fields.knownZone;
      if (listing.existing_building == null && extraction.fields.existingBuilding === true) updates.existing_building = true;

      const addressForCanton = updates.address_text ?? listing.address_text ?? undefined;
      if (listing.canton == null && addressForCanton) {
        const canton = deriveCantonFromAddress(addressForCanton);
        if (canton) updates.canton = canton;
      }

      const prevExtraction = (listing.extraction as Record<string, unknown>) ?? {};
      const prevFields = (prevExtraction.fields as Record<string, unknown>) ?? {};
      const buildYearAlreadyKnown = typeof prevFields.buildYear === "number";
      const buildYear = !buildYearAlreadyKnown ? extraction.fields.buildYear : undefined;

      const fieldsOverlay = { ...prevFields };
      if (updates.address_text !== undefined) fieldsOverlay.addressText = updates.address_text;
      if (updates.canton !== undefined) fieldsOverlay.canton = updates.canton;
      if (updates.parcel_area_m2 !== undefined) fieldsOverlay.parcelAreaM2 = updates.parcel_area_m2;
      if (updates.known_zone !== undefined) fieldsOverlay.knownZone = updates.known_zone;
      if (updates.existing_building !== undefined) fieldsOverlay.existingBuilding = updates.existing_building;
      if (buildYear !== undefined) fieldsOverlay.buildYear = buildYear;

      const fieldsFound = [...Object.keys(updates), ...(buildYear !== undefined ? ["buildYear"] : [])];

      const { error: updateError } = await supabase
        .from("listings")
        .update({
          ...updates,
          extraction: { ...prevExtraction, fields: fieldsOverlay },
          last_fetch_http_status: fetchResult.httpStatus ?? null,
          last_fetch_at: new Date().toISOString(),
        })
        .eq("id", listing.id);
      if (updateError) {
        console.error("[admin/refetch-listing-pages] Update fehlgeschlagen", listing.id, updateError);
        results.push({ id: listing.id, canonicalUrl: listing.canonical_url, status: "UPDATE_ERROR" });
        return;
      }

      if (fieldsFound.length > 0) updated++;
      results.push({ id: listing.id, canonicalUrl: listing.canonical_url, status: "OK", fieldsFound });
    }),
  );

  return NextResponse.json({ checked: candidates.length, refetched: candidates.length, updated, results });
}
