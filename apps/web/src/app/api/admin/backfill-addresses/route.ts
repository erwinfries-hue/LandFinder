import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { extractFromEmailContent, isMultiMatchSubject } from "@/lib/listingExtraction";
import { deriveCantonFromAddress } from "@/lib/plzKanton";
import { isSearchResultsUrl } from "@/lib/inboundMail";

export const maxDuration = 30;

/**
 * Wartungs-Route, bewusst als Dauerfeature angelegt (nicht wie /api/debug-supabase-url
 * temporär) — mehrfach und gefahrlos wiederholt aufrufbar: verarbeitet bei jedem
 * Aufruf nur, was zu diesem Zeitpunkt tatsächlich noch fehlt, bereits erfolgreich
 * nachgetragene Zeilen werden beim nächsten Lauf automatisch übersprungen. Sinnvoll
 * erneut auszuführen, wann immer sich an der Mailinhalt-Extraktion
 * (`extractFromEmailContent()`) etwas ändert, das zuvor gespeicherte Zeilen betreffen
 * könnte — nicht nur für den unten beschriebenen Anlass.
 *
 * Ursprünglicher Anlass (2026-08-16, docs/OPEN_DECISIONS.md): `extractFromEmailContent()`
 * fand bei einer Adresse ohne Strassenangabe (nur PLZ + Ort, z.B. "8545 Rickenbach
 * Sulz") bisher gar nichts. Der Code-Fix wirkt nur auf künftig neu verarbeitete Mails —
 * diese Route trägt es für bereits gespeicherte `listings`-Zeilen nach, indem die
 * zugehörige Original-Mail aus `inbound_alerts` erneut mit der jeweils aktuellen
 * Extraktionsfunktion durchlaufen wird.
 *
 * Bewusst NICHT auf Zeilen mit Methode EMAIL_HEURISTIC eingeschränkt (Fix 2026-08-16):
 * bei blockiertem Seitenabruf (`ingestion_status` BLOCKED/TIMEOUT/NOT_AVAILABLE)
 * speichert `processListingLinks.ts` gar kein `extraction`-Feld — solche Zeilen wurden
 * hier bisher übersprungen, obwohl der Mailinhalt-Fallback nachträglich trotzdem etwas
 * finden kann.
 *
 * Erweitert auf Fläche und Zone (2026-08-16, Anlass: eine echte Inseratsbeschreibung
 * enthielt "1'706 m²" und "Kernzone: Überkommunal", aber `parcel_area_m2`/`known_zone`
 * blieben leer — `known_zone` wurde bis dahin von keiner Extraktionsmethode überhaupt
 * befüllt, siehe `matchKnownZone()` in `listingExtraction.ts`). Ändert pro Zeile nur die
 * Felder, die dort noch NULL sind UND die die erneute Extraktion tatsächlich findet —
 * nie ein bereits gesetztes Feld überschreiben.
 */

/**
 * Domain + Pfad ohne Query-String als Zuordnungsschlüssel statt exaktem URL-Vergleich
 * (Bug gefunden 2026-08-16, echte Diagnosedaten): `listings.canonical_url` und der in
 * `inbound_alerts.listing_links` gespeicherte Link zeigen zwar auf dasselbe Inserat,
 * unterscheiden sich aber in den Tracking-Query-Parametern (z.B. `utm_campaign=(...)`)
 * — je nachdem, ob/wie der Link zwischenzeitlich kodiert oder aufgelöst wurde. Der
 * Pfad allein identifiziert ein Inserat auf einem Portal eindeutig. Hostname zusätzlich
 * ohne "www."-Präfix und klein geschrieben sowie Pfad ohne abschliessenden Slash
 * normalisiert, da derselbe Link mit/ohne "www." oder mit/ohne Slash am Ende zwischen
 * Mail-Extraktion und tatsächlichem Seitenabruf (`fetchResult.finalUrl`) auftreten kann.
 */
function pathKey(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${hostname}${pathname}`;
  } catch {
    return undefined;
  }
}

/**
 * Numerische Inserat-ID aus dem Pfad (z.B. "4003380223" aus "/kaufen/4003380223") —
 * Diagnose-Hilfsmittel für den Fall, dass Domain+Pfad NICHT reicht: `canonical_url`
 * kann die per Redirect aufgelöste Ziel-URL sein (`fetchListingPage.ts`, `finalUrl`),
 * während `listing_links` noch den ursprünglichen Tracking-Link (z.B. SendGrid) aus der
 * Mail enthält — dessen Pfad hat dann gar nichts mit dem echten Portal-Pfad zu tun. Die
 * Inserat-ID taucht aber oft trotzdem irgendwo im Tracking-Link auf (Query-Parameter),
 * deshalb hier als Fallback-Suche über den rohen Link-Text statt über `pathKey()`.
 */
function listingIdFromUrl(url: string): string | undefined {
  try {
    return new URL(url).pathname.match(/\d{5,}/)?.[0];
  } catch {
    return undefined;
  }
}

/**
 * Als eigenständige Funktion exportiert (statt nur inline im GET-Handler unten), damit
 * sowohl die Session-geschützte manuelle Route als auch der tägliche Cron-Job
 * (`api/cron/maintenance/route.ts`) dieselbe Logik nutzen, ohne sich per HTTP
 * gegenseitig aufzurufen. Verhalten unverändert gegenüber dem bisherigen Inline-Code.
 */
export async function runBackfillAddresses(supabase: SupabaseClient) {
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, canonical_url, canton, address_text, parcel_area_m2, known_zone, extraction")
    .or("address_text.is.null,parcel_area_m2.is.null,known_zone.is.null");
  if (listingsError) {
    console.error("[backfill-addresses] Lesen von listings fehlgeschlagen", listingsError);
    return { error: "read listings failed" as const };
  }

  // Bewusst NICHT mehr auf extraction.method === "EMAIL_HEURISTIC" eingeschränkt: bei
  // blockiertem/fehlgeschlagenem Seitenabruf (ingestion_status BLOCKED/TIMEOUT/
  // NOT_AVAILABLE) speichert processListingLinks.ts gar kein `extraction`-Feld
  // (siehe dort, Fehlerfall-Zweig) — solche Zeilen wurden bisher hier übersprungen,
  // obwohl der Mailinhalt-Fallback (extractFromEmailContent) durchaus etwas finden
  // kann, das beim ursprünglichen Verarbeitungslauf noch nicht erkannt wurde.
  const candidates = listings ?? [];
  if (candidates.length === 0) {
    return { checked: 0, updated: 0, stillUnresolved: 0 };
  }

  const { data: alerts, error: alertsError } = await supabase
    .from("inbound_alerts")
    .select("subject, raw_payload, listing_links");
  if (alertsError) {
    console.error("[backfill-addresses] Lesen von inbound_alerts fehlgeschlagen", alertsError);
    return { error: "read inbound_alerts failed" as const };
  }

  type Mail = { subject: string; rawPayload: { HtmlBody?: string; TextBody?: string } };
  const linkToMail = new Map<string, Mail>();
  const allLinks: { link: string; mail: Mail }[] = [];
  for (const alert of alerts ?? []) {
    const mail = { subject: alert.subject, rawPayload: alert.raw_payload as { HtmlBody?: string; TextBody?: string } };
    for (const link of (alert.listing_links as string[] | null) ?? []) {
      const key = pathKey(link);
      if (key && !linkToMail.has(key)) linkToMail.set(key, mail);
      allLinks.push({ link, mail });
    }
  }

  let updated = 0;
  const unresolved: { id: string; canonicalUrl: string; reason: string; subject?: string; bodySnippet?: string }[] = [];

  await Promise.all(
    candidates.map(async (listing) => {
      // Kein Extraktionsfall, sondern eine falsch als Inserat behandelte
      // Trefferlisten-/Such-URL (Bug in extractPortalListingLinks, seit 2026-08-16
      // behoben — betrifft nur bereits vorher gespeicherte Zeilen). Lässt sich nicht
      // nachträglich mit einer Adresse befüllen, da es kein einzelnes Inserat ist.
      if (isSearchResultsUrl(listing.canonical_url)) {
        unresolved.push({
          id: listing.id,
          canonicalUrl: listing.canonical_url,
          reason: "kein einzelnes Inserat, sondern eine Trefferlisten-/Such-URL — sollte gelöscht statt ergänzt werden",
        });
        return;
      }

      const key = pathKey(listing.canonical_url);
      let mail = key ? linkToMail.get(key) : undefined;

      // Fallback: `canonical_url` kann per Redirect aufgelöst worden sein (siehe
      // listingIdFromUrl()), sodass Domain+Pfad nicht mehr mit dem rohen Mail-Link
      // übereinstimmt. Dann über die Inserat-ID im Pfad suchen statt aufzugeben.
      if (!mail) {
        const listingId = listingIdFromUrl(listing.canonical_url);
        const idMatches = listingId ? allLinks.filter((l) => l.link.includes(listingId)) : [];
        if (idMatches.length > 0) {
          mail = idMatches[0].mail;
        } else if (listingId) {
          unresolved.push({
            id: listing.id,
            canonicalUrl: listing.canonical_url,
            reason: "keine passende Mail gefunden (auch Inserat-ID nicht in listing_links)",
          });
          return;
        }
      }

      if (!mail) {
        unresolved.push({ id: listing.id, canonicalUrl: listing.canonical_url, reason: "keine passende Mail gefunden (Domain+Pfad nicht in listing_links)" });
        return;
      }
      const result = extractFromEmailContent({ subject: mail.subject, htmlBody: mail.rawPayload.HtmlBody, textBody: mail.rawPayload.TextBody });

      // Nur Felder anfassen, die bei dieser Zeile noch fehlen UND die die Extraktion
      // tatsächlich liefert — nie ein bereits gesetztes Feld überschreiben.
      const updates: { address_text?: string; parcel_area_m2?: number; known_zone?: string; canton?: string } = {};
      if (listing.address_text == null && result.fields.addressText) updates.address_text = result.fields.addressText;
      if (listing.parcel_area_m2 == null && result.fields.parcelAreaM2 != null) updates.parcel_area_m2 = result.fields.parcelAreaM2;
      if (listing.known_zone == null && result.fields.knownZone) updates.known_zone = result.fields.knownZone;

      const addressForCanton = updates.address_text ?? listing.address_text ?? undefined;
      if (listing.canton == null && addressForCanton) {
        const canton = deriveCantonFromAddress(addressForCanton);
        if (canton) updates.canton = canton;
      }

      if (Object.keys(updates).length === 0) {
        const stillMissing = [
          listing.address_text == null ? "Adresse" : null,
          listing.parcel_area_m2 == null ? "Fläche" : null,
          listing.known_zone == null ? "Zone" : null,
        ].filter((s): s is string => s !== null);
        unresolved.push({
          id: listing.id,
          canonicalUrl: listing.canonical_url,
          reason: isMultiMatchSubject(mail.subject)
            ? `Mail bündelt mehrere Treffer — ${stillMissing.join("/")} lässt/lassen sich keinem einzelnen Inserat sicher zuordnen (bewusst, siehe extractFromEmailContent)`
            : `Mail gefunden, aber ${stillMissing.join("/")} nicht im Text erkannt`,
          subject: mail.subject,
          bodySnippet: (mail.rawPayload.HtmlBody ?? mail.rawPayload.TextBody ?? "").slice(0, 600),
        });
        return;
      }

      const extraction = (listing.extraction as Record<string, unknown>) ?? {};
      const fields = (extraction.fields as Record<string, unknown>) ?? {};
      const fieldsOverlay = { ...fields };
      if (updates.address_text !== undefined) fieldsOverlay.addressText = updates.address_text;
      if (updates.canton !== undefined) fieldsOverlay.canton = updates.canton;
      if (updates.parcel_area_m2 !== undefined) fieldsOverlay.parcelAreaM2 = updates.parcel_area_m2;
      if (updates.known_zone !== undefined) fieldsOverlay.knownZone = updates.known_zone;

      const { error: updateError } = await supabase
        .from("listings")
        .update({ ...updates, extraction: { ...extraction, fields: fieldsOverlay } })
        .eq("id", listing.id);
      if (updateError) {
        console.error("[backfill-addresses] Update fehlgeschlagen", listing.id, updateError);
        unresolved.push({ id: listing.id, canonicalUrl: listing.canonical_url, reason: `Update fehlgeschlagen: ${updateError.message}` });
        return;
      }
      updated++;
    }),
  );

  return { checked: candidates.length, updated, stillUnresolved: unresolved.length, unresolved };
}

export async function GET(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const result = await runBackfillAddresses(supabase);
  if ("error" in result) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
