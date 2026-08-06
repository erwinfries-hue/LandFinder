/**
 * Reine Extraktionslogik für eingehende Suchabo-Mails (Homegate, ImmoScout24, newhome),
 * unabhängig vom Zustelldienst (aktuell: Postmark Inbound Webhook, siehe
 * `app/api/inbound/portal-alerts/route.ts`). Bewusst als reine Funktion gehalten, damit
 * sie ohne echten Webhook-Aufruf testbar ist.
 */

export const PORTAL_LINK_DOMAINS = ["homegate.ch", "immoscout24.ch", "newhome.ch"] as const;

const URL_PATTERN = /https?:\/\/[^\s"'<>)]+/g;

function isPortalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return PORTAL_LINK_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Findet alle Links zu den drei Portalen in einer Suchabo-Mail (HTML- und/oder
 * Text-Teil), dedupliziert sie. Andere Links in der Mail (Logo, Abmelden, Impressum
 * etc.) werden bewusst ausgefiltert — wir wollen nur Inserat-Links weiterverarbeiten.
 */
export function extractPortalListingLinks(mail: { htmlBody?: string; textBody?: string }): string[] {
  const raw = `${mail.htmlBody ?? ""}\n${mail.textBody ?? ""}`;
  const found = raw.match(URL_PATTERN) ?? [];
  const cleaned = found.map((url) => url.replace(/[.,;]+$/, ""));
  return Array.from(new Set(cleaned.filter(isPortalUrl)));
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
