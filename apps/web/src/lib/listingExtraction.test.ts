import { describe, it, expect } from "vitest";
import { extractWithHeuristic, extractFromEmailContent } from "./listingExtraction";

describe("extractWithHeuristic", () => {
  it("liest Titel, Preis, Fläche und Kanton aus einfachem HTML", () => {
    const html = `
      <html><head><title>Bauland Chamerstrasse, Cham ZG</title></head>
      <body><p>Attraktives Bauland in Cham ZG. Preis CHF 3'450'000. Fläche 1'860 m².</p></body></html>
    `;
    const result = extractWithHeuristic(html);
    expect(result.method).toBe("MOCK_HEURISTIC");
    expect(result.fields.title).toBe("Bauland Chamerstrasse, Cham ZG");
    expect(result.fields.askingPriceChf).toBe(3_450_000);
    expect(result.fields.parcelAreaM2).toBe(1860);
    expect(result.fields.canton).toBe("ZG");
    expect(result.fields.objectType).toBe("BAULAND");
  });

  it("erkennt Abbruchobjekte am Text", () => {
    const html = "<title>Grundstück mit Abbruchobjekt</title><p>Rückbau erforderlich.</p>";
    expect(extractWithHeuristic(html).fields.objectType).toBe("ABBRUCHOBJEKT");
  });

  it("erfindet keine Werte, wenn die Muster fehlen", () => {
    const result = extractWithHeuristic("<title>Ohne Details</title><p>Kein Preis hier.</p>");
    expect(result.fields.askingPriceChf).toBeUndefined();
    expect(result.fields.parcelAreaM2).toBeUndefined();
    expect(result.fields.canton).toBeUndefined();
    expect(result.fields.objectType).toBeUndefined();
  });

  it("entfernt script/style-Inhalte vor der Textanalyse", () => {
    const html = "<title>Test</title><style>.x{color:red}</style><script>var chf='CHF 9999999';</script><p>CHF 1'200'000</p>";
    expect(extractWithHeuristic(html).fields.askingPriceChf).toBe(1_200_000);
  });
});

describe("extractFromEmailContent", () => {
  // Reale Homegate-Suchabo-Mail (2026-08-08): der "Zum Inserat"-Link läuft über einen
  // SendGrid-Tracking-Redirect statt über homegate.ch, Stufe 2 findet daher nur
  // Logo-/Vorschaubilder statt der Inserat-Seite — Preis und Adresse stehen aber schon
  // im Mailtext selbst.
  const subject =
    "1 neuer Treffer für 'Bauland zum Kaufen in Kanton Zug, Kanton Schwyz, Kanton Luzern, Kanton Aargau, Kanton Zürich, Kanton Obwalden, Kanton Nidwalden, Kanton Basel-Landschaft, Kanton Basel-Stadt'";
  const htmlBody = `
    <h1>${subject}</h1>
    <p>Hier ist ein neuer Treffer, der deinen Suchkriterien entspricht.</p>
    <img src="https://media2.homegate.ch/.../image.jpg" />
    <p>CHF 2’970’000.–</p>
    <p>Friedhofweg 2<br/>4414 Füllinsdorf</p>
    <a href="https://u8489473.ct.sendgrid.net/uni/ls/click?upn=...">Anbieter kontaktieren ›</a>
  `;

  it("liest Preis und Adresse direkt aus dem Mailinhalt, ohne externen Seitenabruf", () => {
    const result = extractFromEmailContent({ subject, htmlBody });
    expect(result.method).toBe("EMAIL_HEURISTIC");
    expect(result.fields.askingPriceChf).toBe(2_970_000);
    expect(result.fields.addressText).toBe("Friedhofweg 2, 4414 Füllinsdorf");
    expect(result.fields.objectType).toBe("BAULAND");
    expect(result.fields.title).toBe(subject);
  });

  it("errät den Kanton nicht aus dem Betreff (Suchkriterien, nicht die Lage des Treffers)", () => {
    const result = extractFromEmailContent({ subject, htmlBody });
    expect(result.fields.canton).toBeUndefined();
  });

  it("erfindet keine Adresse/keinen Preis, wenn die Mail keine Objektdaten enthält", () => {
    const result = extractFromEmailContent({
      subject: "Erinnerung: Bitte Anmeldung zum kostenlosen Newsletter bestätigen",
      htmlBody: "<p>Bitte bestätige deine Anmeldung, um weiter Suchabo-Mails zu erhalten.</p>",
    });
    expect(result.fields.askingPriceChf).toBeUndefined();
    expect(result.fields.addressText).toBeUndefined();
  });

  it("fällt auf textBody zurück, wenn kein htmlBody vorhanden ist", () => {
    const result = extractFromEmailContent({
      subject: "1 neuer Treffer",
      textBody: "CHF 500'000.- Musterstrasse 1 8000 Zürich",
    });
    expect(result.fields.askingPriceChf).toBe(500_000);
    expect(result.fields.addressText).toBe("Musterstrasse 1, 8000 Zürich");
  });
});
