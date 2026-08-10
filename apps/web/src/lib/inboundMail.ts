/**
 * Reine Extraktionslogik für eingehende Suchabo-Mails (Homegate, ImmoScout24, newhome),
 * unabhängig vom Zustelldienst (aktuell: Postmark Inbound Webhook, siehe
 * `app/api/inbound/portal-alerts/route.ts`). Bewusst als reine Funktion gehalten, damit
 * sie ohne echten Webhook-Aufruf testbar ist.
 */

export const PORTAL_LINK_DOMAINS = ["homegate.ch", "immoscout24.ch", "newhome.ch"] as const;

/**
 * E-Mail-Marketing-Dienste, über die Portale ihre "Zum Inserat"-Buttons statt eines
 * direkten Portal-Links verschicken können (bestätigt 2026-08-08 bei Homegate/SendGrid
 * — siehe docs/OPEN_DECISIONS.md, Punkt A). Nie blind vertrauen: `processListingLinks.ts`
 * verwendet erst die tatsächliche Ziel-URL nach der Weiterleitung.
 */
const TRACKING_LINK_DOMAINS = ["sendgrid.net"] as const;

/** Nur Tracking-Links mit einem dieser Wörter im sichtbaren Link-Text werden übernommen. */
const ACTION_LINK_TEXT_PATTERN = /kontaktieren|inserat|ansehen|details|anzeigen|treffer|objekt/i;
/** ...ausser der Link-Text deutet klar auf etwas anderes hin als das Inserat selbst. */
const EXCLUDED_LINK_TEXT_PATTERN = /abmelden|abbestellen|unsubscribe|einstellungen|impressum|datenschutz|\bagb\b|hilfe/i;

const URL_PATTERN = /https?:\/\/[^\s"'<>)]+/g;
const ANCHOR_PATTERN = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domains: readonly string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function isPortalUrl(url: string): boolean {
  const host = hostOf(url);
  return host !== null && matchesDomain(host, PORTAL_LINK_DOMAINS);
}

function isTrackingUrl(url: string): boolean {
  const host = hostOf(url);
  return host !== null && matchesDomain(host, TRACKING_LINK_DOMAINS);
}

/** Offensichtliche Bild-/Vorschau-Assets (Logo, Foto-Thumbnails) statt einer Inserat-Seite. */
function isLikelyImageAsset(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    if (/^media\d*\./i.test(hostname)) return true;
    if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Findet Klick-Tracking-Links (z.B. SendGrid) im HTML-Teil, aber nur wenn der
 * sichtbare Link-Text eindeutig auf eine Inserat-Aktion hindeutet ("Anbieter
 * kontaktieren" o.ä.) — nie z.B. Abmelde- oder Impressum-Links, die über denselben
 * Tracking-Dienst laufen können. Bewusst konservativ: lieber ein Treffer verpasst als
 * versehentlich einen falschen Link (z.B. Abmelden) verarbeitet.
 */
function extractActionTrackingLinks(html: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  ANCHOR_PATTERN.lastIndex = 0;
  while ((match = ANCHOR_PATTERN.exec(html)) !== null) {
    const url = match[1].replace(/[.,;]+$/, "");
    const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (isTrackingUrl(url) && ACTION_LINK_TEXT_PATTERN.test(text) && !EXCLUDED_LINK_TEXT_PATTERN.test(text)) {
      links.push(url);
    }
  }
  return links;
}

/**
 * Findet alle Links zu den drei Portalen in einer Suchabo-Mail (HTML- und/oder
 * Text-Teil), dedupliziert sie. Andere Links in der Mail (Abmelden, Impressum etc.)
 * werden bewusst ausgefiltert — wir wollen nur Inserat-Links weiterverarbeiten.
 * Bild-/Vorschau-Assets (Logo, Foto-Thumbnails) werden nachrangig behandelt, da sie
 * beim Abruf nichts Extrahierbares liefern (siehe processListingLinks.ts).
 * Eindeutig als Inserat-Aktion erkannte Tracking-Links (z.B. "Anbieter kontaktieren")
 * werden zuerst aufgeführt, weil sie am ehesten zur echten Inserat-Seite führen.
 */
export function extractPortalListingLinks(mail: { htmlBody?: string; textBody?: string }): string[] {
  const raw = `${mail.htmlBody ?? ""}\n${mail.textBody ?? ""}`;
  const found = raw.match(URL_PATTERN) ?? [];
  const cleaned = found.map((url) => url.replace(/[.,;]+$/, ""));

  const portalLinks = cleaned.filter(isPortalUrl);
  const directPageLinks = portalLinks.filter((url) => !isLikelyImageAsset(url));
  const imageAssetLinks = portalLinks.filter(isLikelyImageAsset);
  const actionTrackingLinks = mail.htmlBody ? extractActionTrackingLinks(mail.htmlBody) : [];

  return Array.from(new Set([...actionTrackingLinks, ...directPageLinks, ...imageAssetLinks]));
}

/** Grobe Form des Postmark-Inbound-Webhook-Payloads (nur die hier genutzten Felder). */
export interface PostmarkInboundPayload {
  From?: string;
  Subject?: string;
  Date?: string;
  HtmlBody?: string;
  TextBody?: string;
}

export interface ParsedPortalAlert {
  from: string;
  subject: string;
  date: string;
  listingLinks: string[];
}

export function parsePostmarkInboundPayload(payload: PostmarkInboundPayload): ParsedPortalAlert {
  return {
    from: payload.From ?? "unbekannt",
    subject: payload.Subject ?? "(kein Betreff)",
    date: payload.Date ?? new Date().toISOString(),
    listingLinks: extractPortalListingLinks({ htmlBody: payload.HtmlBody, textBody: payload.TextBody }),
  };
}
