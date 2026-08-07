import { formatChf } from "./demo-data";

/**
 * Ausgehender Alert-Mailversand über Resend (docs/OPEN_DECISIONS.md, Punkt C) —
 * dieselbe "code-ready, aber inaktiv bis der Key gesetzt ist"-Struktur wie bei
 * ANTHROPIC_API_KEY: ohne RESEND_API_KEY/RESEND_FROM_ADDRESS passiert nichts,
 * kein Absturz. Bewusst per einfachem `fetch` gegen die Resend-HTTP-API statt
 * einer zusätzlichen SDK-Abhängigkeit — der Aufruf ist eine einzelne, simple
 * REST-Anfrage.
 */

export interface ListingAlertEmailInput {
  to: string[];
  listingTitle: string;
  canonicalUrl: string;
  addressText?: string | null;
  canton?: string | null;
  askingPriceChf?: number | null;
}

export interface SendAlertEmailResult {
  sent: boolean;
  reason?: string;
}

function buildEmailBody(input: ListingAlertEmailInput): { subject: string; html: string } {
  const subject = `LandFinder: neuer Treffer — ${input.listingTitle}`;
  const details = [
    input.addressText ? `Adresse: ${input.addressText}` : null,
    input.canton ? `Kanton: ${input.canton}` : null,
    input.askingPriceChf != null ? `Preis: CHF ${formatChf(input.askingPriceChf)}` : null,
  ].filter((line): line is string => Boolean(line));

  const html = `
    <p>Ein neues Inserat hat die automatische Vorprüfung gegen dein Suchprofil bestanden:</p>
    <p><strong>${input.listingTitle}</strong></p>
    ${details.length > 0 ? `<ul>${details.map((line) => `<li>${line}</li>`).join("")}</ul>` : ""}
    <p><a href="${input.canonicalUrl}">Original-Inserat öffnen</a></p>
    <p style="color:#777;font-size:.85em">
      Automatische Vorprüfung (Kanton, Objektart, Preis-/Flächen-Spanne) — kein voller Score/keine Empfehlung,
      dafür fehlen Zonendaten. Details in LandFinder unter "Quellen".
    </p>
  `.trim();

  return { subject, html };
}

export async function sendListingAlertEmail(input: ListingAlertEmailInput): Promise<SendAlertEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!apiKey || !fromAddress) {
    return { sent: false, reason: "RESEND_API_KEY oder RESEND_FROM_ADDRESS nicht gesetzt" };
  }
  if (input.to.length === 0) {
    return { sent: false, reason: "keine Empfänger im Suchprofil hinterlegt" };
  }

  const { subject, html } = buildEmailBody(input);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, to: input.to, subject, html }),
  });

  if (!res.ok) {
    return { sent: false, reason: `Resend antwortete mit HTTP ${res.status}` };
  }
  return { sent: true };
}
