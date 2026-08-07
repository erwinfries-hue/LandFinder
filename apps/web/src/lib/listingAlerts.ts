import type { SupabaseClient } from "@supabase/supabase-js";
import { prescreenListing, type PrescreenableListing } from "./listingPrescreen";
import { getPersistedSearchProfile } from "./searchProfile";
import { sendListingAlertEmail } from "./sendAlertEmail";

/**
 * Löst nach einer erfolgreichen Stufe-2-Extraktion (siehe processListingLinks.ts) eine
 * Alert-Mail aus, wenn das Inserat die automatische Vorprüfung (listingPrescreen.ts)
 * gegen das aktuelle Suchprofil besteht. Bewusst NICHT score-basiert (es gibt für echte
 * Inserate keinen vollen Score, siehe docs/OPEN_DECISIONS.md, Punkt F) — der Auslöser
 * ist "passt zum Suchprofil", nicht "hoher Score".
 *
 * Ohne RESEND_API_KEY/RESEND_FROM_ADDRESS ein reines No-op (kein Supabase-Zugriff,
 * kein Fehler) — dieselbe Struktur wie die Anthropic-Extraktion.
 */

export interface AlertableListing extends PrescreenableListing {
  canonical_url: string;
  title?: string | null;
  address_text?: string | null;
}

export async function maybeSendListingAlert(supabase: SupabaseClient, listing: AlertableListing): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_ADDRESS) return;

  const profile = await getPersistedSearchProfile();
  if (profile.alerts.recipients.length === 0) return;

  const prescreen = prescreenListing(listing, profile);
  if (prescreen.status !== "PASSED") return;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .gte("alert_sent_at", startOfDay.toISOString());
  if (countError) {
    console.error("[listingAlerts] Tageslimit-Abfrage fehlgeschlagen", countError);
    return;
  }
  if ((count ?? 0) >= profile.alerts.maxImmediateEmailsPerDay) return;

  // Atomarer "Claim": nur senden, wenn wir alert_sent_at selbst von null auf jetzt setzen
  // konnten — verhindert Doppel-Mails bei wiederholter Verarbeitung derselben URL.
  const { data: claimed, error: claimError } = await supabase
    .from("listings")
    .update({ alert_sent_at: new Date().toISOString() })
    .eq("canonical_url", listing.canonical_url)
    .is("alert_sent_at", null)
    .select("id");
  if (claimError) {
    console.error("[listingAlerts] Claim fehlgeschlagen", claimError);
    return;
  }
  if (!claimed || claimed.length === 0) return;

  const result = await sendListingAlertEmail({
    to: profile.alerts.recipients,
    listingTitle: listing.title || listing.address_text || "Inserat",
    canonicalUrl: listing.canonical_url,
    addressText: listing.address_text,
    canton: listing.canton,
    askingPriceChf: listing.asking_price_chf,
  });
  if (!result.sent) {
    console.warn("[listingAlerts] Alert-Mail nicht gesendet", listing.canonical_url, result.reason);
  }
}
