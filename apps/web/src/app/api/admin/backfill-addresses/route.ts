import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { extractFromEmailContent } from "@/lib/listingExtraction";
import { deriveCantonFromAddress } from "@/lib/plzKanton";

export const maxDuration = 30;

/**
 * Wartungs-Route, bewusst als Dauerfeature angelegt (nicht wie /api/debug-supabase-url
 * temporär) — mehrfach und gefahrlos wiederholt aufrufbar: verarbeitet bei jedem
 * Aufruf nur, was zu diesem Zeitpunkt tatsächlich noch fehlt (`address_text IS NULL`),
 * bereits erfolgreich nachgetragene Zeilen werden beim nächsten Lauf automatisch
 * übersprungen. Sinnvoll erneut auszuführen, wann immer sich an der
 * Mailinhalt-Extraktion (`extractFromEmailContent()`) etwas ändert, das zuvor
 * gespeicherte Zeilen betreffen könnte — nicht nur für den unten beschriebenen Anlass.
 *
 * Ursprünglicher Anlass (2026-08-16, docs/OPEN_DECISIONS.md): `extractFromEmailContent()`
 * fand bei einer Adresse ohne Strassenangabe (nur PLZ + Ort, z.B. "8545 Rickenbach
 * Sulz") bisher gar nichts. Der Code-Fix wirkt nur auf künftig neu verarbeitete Mails —
 * diese Route trägt es für bereits gespeicherte `listings`-Zeilen ohne `address_text`
 * (Methode EMAIL_HEURISTIC) nach, indem die zugehörige Original-Mail aus
 * `inbound_alerts` erneut mit der jeweils aktuellen Extraktionsfunktion durchlaufen
 * wird. Ändert ausschliesslich `address_text` und — falls noch nicht gesetzt —
 * `canton`; alle anderen Felder bleiben unangetastet.
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

export async function GET(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, canonical_url, canton, extraction")
    .is("address_text", null);
  if (listingsError) {
    console.error("[admin/backfill-addresses] Lesen von listings fehlgeschlagen", listingsError);
    return NextResponse.json({ error: "read listings failed" }, { status: 500 });
  }

  const candidates = (listings ?? []).filter(
    (l) => (l.extraction as { method?: string } | null)?.method === "EMAIL_HEURISTIC",
  );
  if (candidates.length === 0) {
    return NextResponse.json({ checked: 0, updated: 0, stillUnresolved: 0 });
  }

  const { data: alerts, error: alertsError } = await supabase
    .from("inbound_alerts")
    .select("subject, raw_payload, listing_links");
  if (alertsError) {
    console.error("[admin/backfill-addresses] Lesen von inbound_alerts fehlgeschlagen", alertsError);
    return NextResponse.json({ error: "read inbound_alerts failed" }, { status: 500 });
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
      if (!result.fields.addressText) {
        unresolved.push({
          id: listing.id,
          canonicalUrl: listing.canonical_url,
          reason: "Mail gefunden, aber keine Adresse im Text erkannt",
          subject: mail.subject,
          bodySnippet: (mail.rawPayload.HtmlBody ?? mail.rawPayload.TextBody ?? "").slice(0, 600),
        });
        return;
      }

      const canton = listing.canton ?? deriveCantonFromAddress(result.fields.addressText) ?? null;
      const extraction = (listing.extraction as Record<string, unknown>) ?? {};
      const fields = (extraction.fields as Record<string, unknown>) ?? {};

      const { error: updateError } = await supabase
        .from("listings")
        .update({
          address_text: result.fields.addressText,
          canton,
          extraction: { ...extraction, fields: { ...fields, addressText: result.fields.addressText, canton: canton ?? fields.canton } },
        })
        .eq("id", listing.id);
      if (updateError) {
        console.error("[admin/backfill-addresses] Update fehlgeschlagen", listing.id, updateError);
        unresolved.push({ id: listing.id, canonicalUrl: listing.canonical_url, reason: `Update fehlgeschlagen: ${updateError.message}` });
        return;
      }
      updated++;
    }),
  );

  return NextResponse.json({ checked: candidates.length, updated, stillUnresolved: unresolved.length, unresolved });
}
