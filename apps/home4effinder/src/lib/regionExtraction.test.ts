import { describe, it, expect } from "vitest";
import { parseRegionExtractionResponse } from "./regionExtraction";

describe("parseRegionExtractionResponse", () => {
  it("parst ein vollständiges, gültiges Ergebnis", () => {
    const json = JSON.stringify({
      gemeinde: "Wohlen",
      canton: "ag",
      reportDatum: "2026-08-05",
      kennzahlen: { leerstandMehrfamilienhaeuserPercent: 1.8, bevoelkerungAnzahl: 17816 },
      preise: {
        mietwohnungen: [{ zimmerzahl: 4, q10: 187, q30: 212, q50: 239, q70: 266, q90: 301 }],
        eigentumswohnungen: [{ zimmerzahl: 4, q10: 5220, q30: 6160, q50: 6900, q70: 8140, q90: 9290 }],
        einfamilienhaeuser: [],
      },
      makrolagenbeschreibung: "Solide Lage.",
    });

    const result = parseRegionExtractionResponse(json);
    expect(result.gemeinde).toBe("Wohlen");
    expect(result.canton).toBe("AG"); // Kanton wird normalisiert auf Grossbuchstaben
    expect(result.reportDatum).toBe("2026-08-05");
    expect(result.kennzahlen.leerstandMehrfamilienhaeuserPercent).toBe(1.8);
    expect(result.preise.mietwohnungen).toHaveLength(1);
    expect(result.preise.einfamilienhaeuser).toEqual([]);
    expect(result.makrolagenbeschreibung).toBe("Solide Lage.");
  });

  it("wirft, wenn gemeinde fehlt", () => {
    const json = JSON.stringify({ canton: "AG", kennzahlen: {}, preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] } });
    expect(() => parseRegionExtractionResponse(json)).toThrow();
  });

  it("wirft bei ungültigem Kantonscode", () => {
    const json = JSON.stringify({ gemeinde: "Wohlen", canton: "XX", kennzahlen: {}, preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] } });
    expect(() => parseRegionExtractionResponse(json)).toThrow();
  });

  it("verwirft unvollständige Quantil-Zeilen statt sie mit fehlenden Werten zu übernehmen", () => {
    const json = JSON.stringify({
      gemeinde: "Wohlen",
      canton: "AG",
      kennzahlen: {},
      preise: {
        mietwohnungen: [{ zimmerzahl: 4, q10: 187, q30: 212, q50: 239, q70: 266 /* q90 fehlt */ }],
        eigentumswohnungen: [],
        einfamilienhaeuser: [],
      },
    });
    const result = parseRegionExtractionResponse(json);
    expect(result.preise.mietwohnungen).toEqual([]);
  });

  it("ignoriert unbekannte/nicht-numerische Kennzahlen-Felder statt zu werfen", () => {
    const json = JSON.stringify({
      gemeinde: "Wohlen",
      canton: "AG",
      kennzahlen: { bevoelkerungAnzahl: "viele", unbekanntesFeld: 42, mietwohnungsbestand: 4798 },
      preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] },
    });
    const result = parseRegionExtractionResponse(json);
    expect(result.kennzahlen.bevoelkerungAnzahl).toBeUndefined();
    expect(result.kennzahlen.mietwohnungsbestand).toBe(4798);
  });

  it("parst kantonKennzahlen zusätzlich zu den Gemeinde-Kennzahlen, wenn vorhanden", () => {
    const json = JSON.stringify({
      gemeinde: "Wohlen",
      canton: "AG",
      kennzahlen: { bevoelkerungAnzahl: 17816 },
      kantonKennzahlen: { bevoelkerungAnzahl: 720000, steuerbelastungSingle60kPercent: 10.2 },
      preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] },
    });
    const result = parseRegionExtractionResponse(json);
    expect(result.kennzahlen.bevoelkerungAnzahl).toBe(17816);
    expect(result.kantonKennzahlen).toEqual({ bevoelkerungAnzahl: 720000, steuerbelastungSingle60kPercent: 10.2 });
  });

  it("lässt kantonKennzahlen weg statt eines leeren Objekts, wenn kein einziges Feld erkannt wurde", () => {
    const json = JSON.stringify({
      gemeinde: "Wohlen",
      canton: "AG",
      kennzahlen: { bevoelkerungAnzahl: 17816 },
      kantonKennzahlen: {},
      preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] },
    });
    const result = parseRegionExtractionResponse(json);
    expect(result.kantonKennzahlen).toBeUndefined();
  });

  it("lässt kantonKennzahlen weg, wenn das Feld im Rohresultat ganz fehlt", () => {
    const json = JSON.stringify({
      gemeinde: "Wohlen",
      canton: "AG",
      kennzahlen: { bevoelkerungAnzahl: 17816 },
      preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] },
    });
    const result = parseRegionExtractionResponse(json);
    expect(result.kantonKennzahlen).toBeUndefined();
  });

  it("parst Standort-/Marktrating und Mobilitäts-Erreichbarkeitswerte", () => {
    const json = JSON.stringify({
      gemeinde: "Baden",
      canton: "AG",
      kennzahlen: {
        standortMarktratingMietwohnungenGesamt: 4.7,
        standortMarktratingEigentumswohnungenGesamt: 4.6,
        erreichbareEinwohnerOev30Min: 813161,
        erreichbareBeschaeftigteOev30Min: 782800,
        erreichbareEinwohnerMiv30Min: 1709479,
        erreichbareBeschaeftigteMiv30Min: 1267831,
      },
      preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] },
    });
    const result = parseRegionExtractionResponse(json);
    expect(result.kennzahlen.standortMarktratingMietwohnungenGesamt).toBe(4.7);
    expect(result.kennzahlen.standortMarktratingEigentumswohnungenGesamt).toBe(4.6);
    expect(result.kennzahlen.erreichbareEinwohnerOev30Min).toBe(813161);
    expect(result.kennzahlen.erreichbareBeschaeftigteOev30Min).toBe(782800);
    expect(result.kennzahlen.erreichbareEinwohnerMiv30Min).toBe(1709479);
    expect(result.kennzahlen.erreichbareBeschaeftigteMiv30Min).toBe(1267831);
  });

  it("ignoriert ein ungültig formatiertes reportDatum statt einen falschen Wert zu übernehmen", () => {
    const json = JSON.stringify({
      gemeinde: "Wohlen",
      canton: "AG",
      reportDatum: "5. August 2026",
      kennzahlen: {},
      preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] },
    });
    const result = parseRegionExtractionResponse(json);
    expect(result.reportDatum).toBeUndefined();
  });
});
