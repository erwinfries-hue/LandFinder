import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchListingPage } from "./fetchListingPage";
import { extractListingFields, extractFromEmailContent, type AlertMailContent, type ExtractedListingFields, type ExtractionResult } from "./listingExtraction";
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
  for (const url of links.slice(0, MAX_LINKS_PER_RUN)) {
    const source = sourceFromUrl(url);
    const fetchResult = await fetchListingPage(url);

    const pageExtraction: ExtractionResult | undefined = fetchResult.status === "OK" ? await extractListingFields(fetchResult.html) : undefined;

    // Fallback auf den Mailinhalt selbst, wenn der Seitenabruf nichts Brauchbares
    // ergab (z.B. weil der "Link" tatsächlich ein Logo-/Vorschaubild war statt der
    // echten Inserat-Seite — siehe listingExtraction.ts, extractFromEmailContent).
    const emailExtraction =
      mailContext && (!pageExtraction || !hasUsefulFields(pageExtraction.fields)) ? extractFromEmailContent(mailContext) : undefined;
    const usableEmailExtraction = emailExtraction && hasUsefulEmailFields(emailExtraction.fields) ? emailExtraction : undefined;

    const extraction = usableEmailExtraction ?? pageExtraction;

    if (!extraction) {
      // Weder Seitenabruf noch Mailinhalt ergaben etwas — Fehlerfall unverändert festhalten.
      const ingestionStatus = fetchResult.status === "BLOCKED" ? "BLOCKED" : fetchResult.status === "TIMEOUT" ? "TIMEOUT" : "NOT_AVAILABLE";
      const { error } = await supabase.from("listings").upsert(
        {
          canonical_url: url,
          source,
          ingestion_status: ingestionStatus,
          last_fetch_http_status: fetchResult.httpStatus ?? null,
          last_fetch_at: new Date().toISOString(),
        },
        { onConflict: "canonical_url" },
      );
      if (error) console.error("[processListingLinks] Upsert (Fehlerfall) fehlgeschlagen", url, error);
      continue;
    }

    const ingestionStatus = extraction.method === "ANTHROPIC" ? "PARTIAL" : "MANUAL_INPUT_REQUIRED";
    const { error } = await supabase.from("listings").upsert(
      {
        canonical_url: url,
        source,
        title: extraction.fields.title,
        description: extraction.fields.description,
        object_type: extraction.fields.objectType,
        address_text: extraction.fields.addressText,
        canton: extraction.fields.canton,
        asking_price_chf: extraction.fields.askingPriceChf,
        parcel_area_m2: extraction.fields.parcelAreaM2,
        known_zone: extraction.fields.knownZone,
        extraction,
        ingestion_status: ingestionStatus,
        last_fetch_http_status: fetchResult.httpStatus ?? null,
        last_fetch_at: new Date().toISOString(),
      },
      { onConflict: "canonical_url" },
    );
    if (error) {
      console.error("[processListingLinks] Upsert fehlgeschlagen", url, error);
      continue;
    }

    await maybeSendListingAlert(supabase, {
      canonical_url: url,
      title: extraction.fields.title,
      address_text: extraction.fields.addressText,
      canton: extraction.fields.canton ?? null,
      object_type: extraction.fields.objectType ?? null,
      asking_price_chf: extraction.fields.askingPriceChf ?? null,
      parcel_area_m2: extraction.fields.parcelAreaM2 ?? null,
    });
  }
}
