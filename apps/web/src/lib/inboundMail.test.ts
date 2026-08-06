import { describe, it, expect } from "vitest";
import { extractPortalListingLinks, parsePostmarkInboundPayload } from "./inboundMail";

describe("extractPortalListingLinks", () => {
  it("findet Links zu den drei Portalen und dedupliziert sie", () => {
    const html = `
      <a href="https://www.homegate.ch/kaufen/12345">Inserat</a>
      <a href="https://www.homegate.ch/kaufen/12345">Nochmal derselbe Link</a>
      <a href="https://www.immoscout24.ch/de/d/kaufen/6789">Inserat</a>
    `;
    const text = "Neues Inserat: https://www.newhome.ch/de/immobilien/detail/42";
    expect(extractPortalListingLinks({ htmlBody: html, textBody: text })).toEqual([
      "https://www.homegate.ch/kaufen/12345",
      "https://www.immoscout24.ch/de/d/kaufen/6789",
      "https://www.newhome.ch/de/immobilien/detail/42",
    ]);
  });

  it("ignoriert Links zu anderen Domains (Logo, Abmelden, Impressum etc.)", () => {
    const html = `
      <a href="https://www.homegate.ch/kaufen/12345">Inserat</a>
      <a href="https://unsubscribe.example.com/xyz">Abmelden</a>
      <img src="https://cdn.example.com/logo.png" />
    `;
    expect(extractPortalListingLinks({ htmlBody: html })).toEqual(["https://www.homegate.ch/kaufen/12345"]);
  });

  it("gibt eine leere Liste zurück, wenn keine Portal-Links enthalten sind", () => {
    expect(extractPortalListingLinks({ htmlBody: "<p>Kein Link hier.</p>" })).toEqual([]);
  });

  it("kappt Satzzeichen am Ende eines Links im Fliesstext", () => {
    const text = "Schau mal hier: https://www.homegate.ch/kaufen/999, das sieht gut aus.";
    expect(extractPortalListingLinks({ textBody: text })).toEqual(["https://www.homegate.ch/kaufen/999"]);
  });
});

describe("parsePostmarkInboundPayload", () => {
  it("extrahiert Absender, Betreff, Datum und Inserat-Links aus dem Postmark-Payload", () => {
    const parsed = parsePostmarkInboundPayload({
      From: "alerts@homegate.ch",
      Subject: "Neue Treffer für dein Suchabo",
      Date: "2026-08-06T08:00:00Z",
      HtmlBody: '<a href="https://www.homegate.ch/kaufen/12345">Inserat</a>',
    });
    expect(parsed).toEqual({
      from: "alerts@homegate.ch",
      subject: "Neue Treffer für dein Suchabo",
      date: "2026-08-06T08:00:00Z",
      listingLinks: ["https://www.homegate.ch/kaufen/12345"],
    });
  });

  it("verwendet Fallback-Werte, wenn Felder im Payload fehlen", () => {
    const parsed = parsePostmarkInboundPayload({});
    expect(parsed.from).toBe("unbekannt");
    expect(parsed.subject).toBe("(kein Betreff)");
    expect(parsed.listingLinks).toEqual([]);
  });
});
