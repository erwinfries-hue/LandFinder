import { describe, it, expect } from "vitest";
import {
  computeMarketValueRange,
  computeCashOnCashBreakdown,
  computePriceZones,
  classifyPriceZone,
  priceZoneTone,
  computeValueCreation,
  hasAnyOpeningBidFaktor,
  computeOpeningBidSuggestion,
  type PriceZone,
} from "./priceStrategy";
import type { RegionExtractionResult, RegionQuantileRow } from "./regionExtraction";

const row3Zimmer: RegionQuantileRow = { zimmerzahl: 3, q10: 6000, q30: 6800, q50: 7500, q70: 8200, q90: 9000 };
const row4Zimmer: RegionQuantileRow = { zimmerzahl: 4, q10: 5500, q30: 6200, q50: 6900, q70: 7600, q90: 8400 };

function buildRegionData(overrides: Partial<RegionExtractionResult> = {}): RegionExtractionResult {
  return {
    gemeinde: "Wohlen",
    canton: "AG",
    kennzahlen: {},
    preise: { mietwohnungen: [], eigentumswohnungen: [row3Zimmer, row4Zimmer], einfamilienhaeuser: [] },
    ...overrides,
  };
}

describe("computeMarketValueRange", () => {
  it("berechnet Low/Base/High aus q30/q50/q70 × Wohnfläche bei exakter Zimmerzahl-Übereinstimmung", () => {
    const regionData = buildRegionData({ reportDatum: new Date().toISOString().slice(0, 10) });
    const result = computeMarketValueRange(regionData, 3, 70);
    expect(result).toBeDefined();
    expect(result!.lowChf).toBeCloseTo(6800 * 70, 5);
    expect(result!.baseChf).toBeCloseTo(7500 * 70, 5);
    expect(result!.highChf).toBeCloseTo(8200 * 70, 5);
    expect(result!.confidence).toBe("HIGH");
  });

  it("stuft auf MEDIUM herab, wenn keine exakte Zimmerzahl-Zeile existiert (nächstgelegene verwendet)", () => {
    const regionData = buildRegionData({ reportDatum: new Date().toISOString().slice(0, 10) });
    const result = computeMarketValueRange(regionData, 3.5, 70);
    expect(result).toBeDefined();
    expect(result!.confidence).toBe("MEDIUM");
  });

  it("stuft auf MEDIUM herab, wenn der Report älter als 2 Jahre ist (trotz exakter Zimmerzahl)", () => {
    const alteDatum = new Date();
    alteDatum.setFullYear(alteDatum.getFullYear() - 3);
    const regionData = buildRegionData({ reportDatum: alteDatum.toISOString().slice(0, 10) });
    const result = computeMarketValueRange(regionData, 3, 70);
    expect(result).toBeDefined();
    expect(result!.confidence).toBe("MEDIUM");
  });

  it("stuft auf LOW herab, wenn Zimmerzahl nicht exakt UND Report älter als 2 Jahre ist", () => {
    const alteDatum = new Date();
    alteDatum.setFullYear(alteDatum.getFullYear() - 3);
    const regionData = buildRegionData({ reportDatum: alteDatum.toISOString().slice(0, 10) });
    const result = computeMarketValueRange(regionData, 3.5, 70);
    expect(result).toBeDefined();
    expect(result!.confidence).toBe("LOW");
  });

  it("liefert undefined ohne erfasste Zimmerzahl", () => {
    const regionData = buildRegionData();
    expect(computeMarketValueRange(regionData, undefined, 70)).toBeUndefined();
  });

  it("liefert undefined bei Wohnfläche 0", () => {
    const regionData = buildRegionData();
    expect(computeMarketValueRange(regionData, 3, 0)).toBeUndefined();
  });

  it("liefert undefined, wenn der Regionsreport keine Eigentumswohnungs-Preiszeilen enthält", () => {
    const regionData = buildRegionData({ preise: { mietwohnungen: [], eigentumswohnungen: [], einfamilienhaeuser: [] } });
    expect(computeMarketValueRange(regionData, 3, 70)).toBeUndefined();
  });
});

describe("computePriceZones", () => {
  it("erzeugt 7 Zonen mit 5 gleich breiten CHF-Bändern zwischen Economic Target und Walk-Away Price", () => {
    const bands = computePriceZones(500_000, 600_000);
    expect(bands).toBeDefined();
    expect(bands).toHaveLength(7);
    expect(bands!.map((b) => b.zone)).toEqual([
      "EXCEPTIONAL_STRONG_BUY",
      "VERY_ATTRACTIVE",
      "ATTRACTIVE",
      "ACCEPTABLE",
      "SELECTIVE_NEGOTIATE",
      "TOO_EXPENSIVE",
      "REJECT",
    ]);
    expect(bands![0]).toEqual({ zone: "EXCEPTIONAL_STRONG_BUY", label: "Exceptional / Strong Buy", lowChf: undefined, highChf: 500_000 });
    expect(bands![1].lowChf).toBe(500_000);
    expect(bands![1].highChf).toBe(520_000);
    expect(bands![5].lowChf).toBe(580_000);
    expect(bands![5].highChf).toBe(600_000);
    expect(bands![6]).toEqual({ zone: "REJECT", label: "Reject", lowChf: 600_000, highChf: undefined });
  });

  it("liefert undefined, wenn Economic Target die Walk-Away-Grenze bereits erreicht/überschreitet", () => {
    expect(computePriceZones(600_000, 600_000)).toBeUndefined();
    expect(computePriceZones(650_000, 600_000)).toBeUndefined();
  });
});

describe("classifyPriceZone", () => {
  const bands = computePriceZones(500_000, 600_000)!;

  it("ordnet einen Preis unter dem Economic Target der Exceptional-Zone zu", () => {
    expect(classifyPriceZone(499_999, bands).zone).toBe("EXCEPTIONAL_STRONG_BUY");
    expect(classifyPriceZone(0, bands).zone).toBe("EXCEPTIONAL_STRONG_BUY");
  });

  it("behandelt Bandgrenzen inklusive Untergrenze, exklusive Obergrenze", () => {
    expect(classifyPriceZone(500_000, bands).zone).toBe("VERY_ATTRACTIVE");
    expect(classifyPriceZone(519_999, bands).zone).toBe("VERY_ATTRACTIVE");
    expect(classifyPriceZone(520_000, bands).zone).toBe("ATTRACTIVE");
  });

  it("ordnet einen Preis über der Walk-Away-Grenze der Reject-Zone zu", () => {
    expect(classifyPriceZone(600_000, bands).zone).toBe("REJECT");
    expect(classifyPriceZone(10_000_000, bands).zone).toBe("REJECT");
  });
});

describe("priceZoneTone", () => {
  it("ordnet die drei günstigen Zonen 'good' zu", () => {
    (["EXCEPTIONAL_STRONG_BUY", "VERY_ATTRACTIVE", "ATTRACTIVE"] as PriceZone[]).forEach((zone) => expect(priceZoneTone(zone)).toBe("good"));
  });

  it("ordnet die beiden mittleren Zonen 'warn' zu", () => {
    (["ACCEPTABLE", "SELECTIVE_NEGOTIATE"] as PriceZone[]).forEach((zone) => expect(priceZoneTone(zone)).toBe("warn"));
  });

  it("ordnet die beiden ungünstigen Zonen 'bad' zu", () => {
    (["TOO_EXPENSIVE", "REJECT"] as PriceZone[]).forEach((zone) => expect(priceZoneTone(zone)).toBe("bad"));
  });
});

describe("computeCashOnCashBreakdown", () => {
  it("berechnet beide Cash-on-Cash-Varianten korrekt", () => {
    const result = computeCashOnCashBreakdown({ cashflowNachZinsChf: 10_000, cashflowNachAmortisationChf: 6_000 }, 200_000);
    expect(result).toEqual({ preAmortizationPercent: 5, postAmortizationPercent: 3 });
  });

  it("liefert undefined bei Eigenkapital 0", () => {
    expect(computeCashOnCashBreakdown({ cashflowNachZinsChf: 10_000, cashflowNachAmortisationChf: 6_000 }, 0)).toBeUndefined();
  });

  it("liefert undefined bei negativem Eigenkapital", () => {
    expect(computeCashOnCashBreakdown({ cashflowNachZinsChf: 10_000, cashflowNachAmortisationChf: 6_000 }, -50_000)).toBeUndefined();
  });
});

describe("computeValueCreation", () => {
  it("berechnet den impliziten Wertzuwachs = NOI-Steigerung ÷ Zielrendite — Beispiel aus dem Auftrag (CHF 1'000 / 4.5% = CHF 22'222)", () => {
    const result = computeValueCreation(1_000, 4.5);
    expect(result).toBeDefined();
    expect(result!.annualNoiIncreaseChf).toBe(1_000);
    expect(result!.impliedValueIncreaseChf).toBeCloseTo(22_222.22, 1);
  });

  it("liefert undefined bei Zielrendite 0 oder negativ", () => {
    expect(computeValueCreation(1_000, 0)).toBeUndefined();
    expect(computeValueCreation(1_000, -1)).toBeUndefined();
  });

  it("funktioniert auch mit negativer NOI-Veränderung (Wertminderung)", () => {
    const result = computeValueCreation(-500, 4.5);
    expect(result!.impliedValueIncreaseChf).toBeCloseTo(-11_111.11, 1);
  });
});

describe("hasAnyOpeningBidFaktor", () => {
  it("ist false ohne Faktoren-Objekt oder mit komplett leerem Objekt", () => {
    expect(hasAnyOpeningBidFaktor(undefined)).toBe(false);
    expect(hasAnyOpeningBidFaktor({})).toBe(false);
  });

  it("ist true, sobald mindestens ein Faktor gesetzt ist", () => {
    expect(hasAnyOpeningBidFaktor({ tageAmMarkt: 45 })).toBe(true);
    expect(hasAnyOpeningBidFaktor({ vermietungsstatus: "UNVERMIETET" })).toBe(true);
  });
});

describe("computeOpeningBidSuggestion", () => {
  it("liefert den unveränderten Economic Target bei komplett leeren Faktoren (0% Diskont)", () => {
    const result = computeOpeningBidSuggestion(500_000, {});
    expect(result.totalDiskontPercent).toBe(0);
    expect(result.suggestedChf).toBe(500_000);
    expect(result.beitraege).toEqual([]);
  });

  it("kombiniert mehrere Faktoren additiv zu einem Gesamtdiskont", () => {
    const result = computeOpeningBidSuggestion(500_000, { tageAmMarkt: 200, verkaeufermotivation: "HOCH", konkurrenzsituation: "NIEDRIG" });
    // 200 Tage -> 3%, Verkäufermotivation HOCH -> 3%, Konkurrenz NIEDRIG -> 2% = 8%.
    expect(result.totalDiskontPercent).toBe(8);
    expect(result.suggestedChf).toBeCloseTo(500_000 * 0.92, 2);
    expect(result.beitraege).toHaveLength(3);
  });

  it("deckelt den Gesamtdiskont auf MAX_TOTAL_DISKONT_PERCENT (15%), auch bei vielen ungünstigen Faktoren", () => {
    const result = computeOpeningBidSuggestion(500_000, {
      tageAmMarkt: 200, // 3%
      preisreduktionenAnzahl: 10, // gedeckelt auf 4%
      verkaeufermotivation: "HOCH", // 3%
      konkurrenzsituation: "NIEDRIG", // 2%
      capexRisikoStufe: "HOCH", // 3%
      dokumentationsluecken: "VIELE", // 2%
      vermietungsstatus: "UNVERMIETET", // 1%
    }); // Summe der Einzelbeiträge = 18%, gedeckelt auf 15%.
    expect(result.totalDiskontPercent).toBe(15);
    expect(result.suggestedChf).toBeCloseTo(500_000 * 0.85, 2);
  });

  it("berücksichtigt nur tatsächlich gesetzte Faktoren, keine erfundenen Standardwerte", () => {
    const result = computeOpeningBidSuggestion(500_000, { tageAmMarkt: 200 });
    expect(result.beitraege).toHaveLength(1);
    expect(result.totalDiskontPercent).toBe(3);
  });

  it("deckelt die Tage-am-Markt-Schwellen korrekt (unter 30 Tagen kein Beitrag)", () => {
    expect(computeOpeningBidSuggestion(500_000, { tageAmMarkt: 10 }).totalDiskontPercent).toBe(0);
    expect(computeOpeningBidSuggestion(500_000, { tageAmMarkt: 30 }).totalDiskontPercent).toBe(1);
    expect(computeOpeningBidSuggestion(500_000, { tageAmMarkt: 90 }).totalDiskontPercent).toBe(2);
    expect(computeOpeningBidSuggestion(500_000, { tageAmMarkt: 180 }).totalDiskontPercent).toBe(3);
  });
});
