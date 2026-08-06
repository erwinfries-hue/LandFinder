import { describe, it, expect } from "vitest";
import { extractWithHeuristic } from "./listingExtraction";

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
