import { describe, it, expect } from "vitest";
import { computeMarketValueRange, computeCashOnCashBreakdown } from "./priceStrategy";
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
