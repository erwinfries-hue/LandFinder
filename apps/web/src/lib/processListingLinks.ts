import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchListingPage } from "./fetchListingPage";
import { extractListingFields, extractFromEmailContent, type AlertMailContent, type ExtractedListingFields, type ExtractionResult } from "./listingExtraction";
import { isPortalUrl } from "./inboundMail";
import { maybeSendListingAlert } from "./listingAlerts";

/**
 * Verarbeitet die aus einer Suchabo-Mail gefundenen Inserat-Links zu strukturierten
 * `listings`-Einträgen (Stufe 2). Absichtlich auf wenige Links pro Aufruf begrenzt:
 * Vercel-Hobby-Functions haben ein hartes 10-Sekunden-Zeitbudget, und pro Link fallen
 * ein externer Seitenabruf (bis 8s Timeout) plus ggf. ein LLM-Aufruf an. Weitere Links
 * bleiben unverarbeitet in `inbound_alerts.listing_links` sichtbar, statt die Funktion
 * zu riskieren abzubrechen.
 */
const MAX_LINKS_PER_RUN = 2;

function sourceFromUrl(url: string): string {
  if (url.includes("homegate.ch")) return "HOMEGATE";
  if (url.includes("immoscout24.ch")) return "IMMOSCOUT24";
  if (url.includes("newhome.ch")) return "NEWHOME";
  return "EMAIL_IMPORT";
}

function hasUsefulFields(fields: ExtractedListingFields): boolean {
  return Boolean(fields.title || fields.askingPriceChf || fields.addressText);
}

/**
 * Strengerer Check speziell für `extractFromEmailContent`-Ergebnisse: dort kommt
 * `title` immer aus dem Mail-Betreff, auch bei generischen Erinnerungs-/Newsletter-
 * Mails ohne echte Objektdaten — für sich allein also kein Hinweis auf einen echten
 * Treffer, deshalb hier bewusst ausgeklammert.
 */
function hasUsefulEmailFields(fields: ExtractedListingFields): boolean {
  return Boolean(fields.askingPriceChf || fields.addressText);
}

export async function processListingLinks(supabase: SupabaseClient, links: string[], mailContext?: AlertMailContent): Promise<void> {
  // Wird `true`, sobald der Mailinhalt-Fallback einmal brauchbare Felder geliefert hat.
  // Verhindert, dass mehrere Links derselben Mail (z.B. Logo- + Tracking-Link zum
  // selben Treffer) alle denselben Mailinhalt als jeweils eigene Zeile speichern —
  // Bug gefunden 2026-08-11 anhand echter Produktionsdaten (doppelte Zeilen mit
  // identischem Inhalt unter unterschiedlichen canonical_url).
  let emailFallbackConsumed = false;

  for (const url of links.slice(0, MAX_LINKS_PER_RUN)) {
    const fetchResult = await fetchListingPage(url);

    // Falls `url` ein Klick-Tracking-Link war (z.B. SendGrid, siehe inboundMail.ts)
    // und `fetch()` automatisch auf eine bekannte Portal-Domain weitergeleitet hat,
    // verwenden wir diese echte Ziel-URL als canonical_url — stabiler für die
    // Deduplizierung als der Tracking-Link, und `source` wird korrekt erkannt.
    const resolvedUrl = fetchResult.finalUrl && isPortalUrl(fetchResult.finalUrl) ? fetchResult.finalUrl : url;
    const source = sourceFromUrl(resolvedUrl);

    // Den Seiteninhalt nur dann als Inserat-Seite behandeln, wenn Original- oder
    // aufgelöste Ziel-URL wirklich zu einem der drei bekannten Portale gehört — sonst
    // könnten wir Text einer völlig fremden Seite (falsche Weiterleitung) als
    // Inserat-Daten interpretieren.
    const landedOnKnownPortal = isPortalUrl(url) || (fetchResult.finalUrl != null && isPortalUrl(fetchResult.finalUrl));
    const pageExtraction: ExtractionResult | undefined =
      fetchResult.status === "OK" && landedOnKnownPortal ? await extractListingFields(fetchResult.html) : undefined;

    // Fallback auf den Mailinhalt selbst, wenn der Seitenabruf nichts Brauchbares
    // ergab (z.B. weil der Link auf ein Logo-/Vorschaubild zeigte oder blockiert
    // wurde — siehe listingExtraction.ts, extractFromEmailContent).
    const emailExtraction =
      mailContext && !emailFallbackConsumed && (!pageExtraction || !hasUsefulFields(pageExtraction.fields))
        ? extractFromEmailContent(mailContext)
        : undefined;
    const usableEmailExtraction = emailExtraction && hasUsefulEmailFields(emailExtraction.fields) ? emailExtraction : undefined;
    if (usableEmailExtraction) emailFallbackConsumed = true;

    const extraction = usableEmailExtraction ?? pageExtraction;

    if (!extraction) {
      // Weder Seitenabruf noch Mailinhalt ergaben etwas — Fehlerfall unverändert festhalten.
      const ingestionStatus = fetchResult.status === "BLOCKED" ? "BLOCKED" : fetchResult.status === "TIMEOUT" ? "TIMEOUT" : "NOT_AVAILABLE";
      const { error } = await supabase.from("listings").upsert(
        {
          canonical_url: resolvedUrl,
          source,
          ingestion_status: ingestionStatus,
          last_fetch_http_status: fetchResult.httpStatus ?? null,
          last_fetch_at: new Date().toISOString(),
        },
        { onConflict: "canonical_url" },
      );
      if (error) console.error("[processListingLinks] Upsert (Fehlerfall) fehlgeschlagen", resolvedUrl, error);
      continue;
    }

    const ingestionStatus = extraction.method === "ANTHROPIC" ? "PARTIAL" : "MANUAL_INPUT_REQUIRED";
    const { error } = await supabase.from("listings").upsert(
      {
        canonical_url: resolvedUrl,
        source,
        title: extraction.fields.title,
        description: extraction.fields.description,
        object_type: extraction.fields.objectType,
        address_text: extraction.fields.addressText,
        canton: extraction.fields.canton,
        asking_price_chf: extraction.fields.askingPriceChf,
        parcel_area_m2: extraction.fields.parcelAreaM2,
        known_zone: extraction.fields.knownZone,
        existing_building: extraction.fields.existingBuilding ?? null,
        extraction,
        ingestion_status: ingestionStatus,
        last_fetch_http_status: fetchResult.httpStatus ?? null,
        last_fetch_at: new Date().toISOString(),
      },
      { onConflict: "canonical_url" },
    );
    if (error) {
      console.error("[processListingLinks] Upsert fehlgeschlagen", resolvedUrl, error);
      continue;
    }

    await maybeSendListingAlert(supabase, {
      canonical_url: resolvedUrl,
      title: extraction.fields.title,
      address_text: extraction.fields.addressText,
      canton: extraction.fields.canton ?? null,
      object_type: extraction.fields.objectType ?? null,
      asking_price_chf: extraction.fields.askingPriceChf ?? null,
      parcel_area_m2: extraction.fields.parcelAreaM2 ?? null,
    });
  }
}
