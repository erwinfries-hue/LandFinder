import { describe, it, expect } from "vitest";
import { computeLageScore, computeMarktpreisScore, computeMarkttrendScore, computeMarketScore, computeStrategicFitScore } from "./sipisScore";
import type { RegionExtractionResult, RegionQuantileRow } from "./regionExtraction";
import type { UbsWohnattraktivitaetEintrag } from "./ubsWohnattraktivitaet";

const row3Zimmer: RegionQuantileRow = { zimmerzahl: 3, q10: 6000, q30: 6800, q50: 7500, q70: 8200, q90: 9000 };

function buildRegionData(overrides: Partial<RegionExtractionResult> = {}): RegionExtractionResult {
  return {
    gemeinde: "Wohlen",
    canton: "AG",
    kennzahlen: {},
    preise: { mietwohnungen: [], eigentumswohnungen: [row3Zimmer], einfamilienhaeuser: [] },
    ...overrides,
  };
}

describe("computeLageScore", () => {
  it("liefert undefined ohne UBS-Eintrag", () => {
    expect(computeLageScore(undefined)).toBeUndefined();
  });

  it("staffelt TOP3-Ränge (1 > 2 > 3)", () => {
    const rang1: UbsWohnattraktivitaetEintrag = { gemeinde: "X", aliases: ["x"], canton: "AG", kategorie: "TOP3", rangInRegion: 1 };
    const rang3: UbsWohnattraktivitaetEintrag = { gemeinde: "Y", aliases: ["y"], canton: "AG", kategorie: "TOP3", rangInRegion: 3 };
    expect(computeLageScore(rang1)).toBeGreaterThan(computeLageScore(rang3)!);
  });

  it("liefert für jede Kategorie einen Wert zwischen 0 und 100", () => {
    const kategorien: UbsWohnattraktivitaetEintrag["kategorie"][] = ["TOP3", "AGGLOMERATION", "RAND_LAND", "STEUERGUENSTIG", "BEZAHLBARES_KLEINZENTRUM"];
    for (const kategorie of kategorien) {
      const score = computeLageScore({ gemeinde: "X", aliases: ["x"], canton: "AG", kategorie });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("computeMarktpreisScore", () => {
  it("liefert undefined ohne Kaufpreis/Regionsdaten/Zimmerzahl", () => {
    expect(computeMarktpreisScore(undefined, buildRegionData(), 3)).toBeUndefined();
    expect(computeMarktpreisScore(7000, undefined, 3)).toBeUndefined();
    expect(computeMarktpreisScore(7000, buildRegionData(), undefined)).toBeUndefined();
  });

  it("gibt einen hohen Score für einen Kaufpreis deutlich unter dem Median", () => {
    const score = computeMarktpreisScore(6000, buildRegionData(), 3); // unter q10
    expect(score).toBe(95);
  });

  it("gibt einen tiefen Score für einen Kaufpreis deutlich über dem Median", () => {
    const score = computeMarktpreisScore(9500, buildRegionData(), 3); // über q90
    expect(score).toBe(15);
  });

  it("gibt ca. 50 für einen Kaufpreis genau am Median (q50)", () => {
    const score = computeMarktpreisScore(7500, buildRegionData(), 3);
    expect(score).toBe(50);
  });
});

describe("computeMarkttrendScore", () => {
  it("liefert undefined ohne Trenddaten", () => {
    expect(computeMarkttrendScore(undefined)).toBeUndefined();
  });

  it("liefert 50 bei 0% Trend, 100 bei +10%, 0 bei -10%", () => {
    expect(computeMarkttrendScore(0)).toBe(50);
    expect(computeMarkttrendScore(10)).toBe(100);
    expect(computeMarkttrendScore(-10)).toBe(0);
  });

  it("deckelt auf [0, 100] bei extremen Werten", () => {
    expect(computeMarkttrendScore(50)).toBe(100);
    expect(computeMarkttrendScore(-50)).toBe(0);
  });
});

describe("computeMarketScore", () => {
  it("liefert undefined, wenn keine einzige Komponente verfügbar ist", () => {
    expect(computeMarketScore({ ubsEintrag: undefined, kaufpreisChfPerM2: undefined, regionData: undefined, zimmerzahl: undefined })).toBeUndefined();
  });

  it("mittelt nur die tatsächlich verfügbaren Komponenten", () => {
    const result = computeMarketScore({
      ubsEintrag: { gemeinde: "X", aliases: ["x"], canton: "AG", kategorie: "AGGLOMERATION" },
      kaufpreisChfPerM2: undefined,
      regionData: undefined,
      zimmerzahl: undefined,
    });
    expect(result).toBeDefined();
    expect(result!.lageScore).toBe(70);
    expect(result!.marktpreisScore).toBeUndefined();
    expect(result!.markttrendScore).toBeUndefined();
    expect(result!.totalScore).toBe(70); // nur eine Komponente verfügbar
  });

  it("mittelt mehrere verfügbare Komponenten korrekt", () => {
    const result = computeMarketScore({
      ubsEintrag: { gemeinde: "X", aliases: ["x"], canton: "AG", kategorie: "AGGLOMERATION" }, // 70
      kaufpreisChfPerM2: 7500, // = 50 (Median)
      regionData: buildRegionData(),
      zimmerzahl: 3,
    });
    expect(result!.totalScore).toBe(Math.round((70 + 50) / 2));
  });
});

describe("computeStrategicFitScore", () => {
  it("liefert undefined ohne Preiszone und ohne Value-Add", () => {
    expect(computeStrategicFitScore({ priceZone: undefined, totalValueCreationChf: undefined, kaufpreisChf: 800_000 })).toBeUndefined();
  });

  it("bildet die 7 Preiszonen absteigend auf 100..0 ab", () => {
    const exceptional = computeStrategicFitScore({ priceZone: "EXCEPTIONAL_STRONG_BUY", totalValueCreationChf: undefined, kaufpreisChf: 800_000 });
    const reject = computeStrategicFitScore({ priceZone: "REJECT", totalValueCreationChf: undefined, kaufpreisChf: 800_000 });
    expect(exceptional!.totalScore).toBe(100);
    expect(reject!.totalScore).toBe(0);
  });

  it("skaliert Value-Add-Score anhand des Verhältnisses zum Kaufpreis, gedeckelt auf 100", () => {
    // 5% Value-Add-zu-Kaufpreis-Verhältnis -> 100 Punkte.
    const result = computeStrategicFitScore({ priceZone: undefined, totalValueCreationChf: 40_000, kaufpreisChf: 800_000 });
    expect(result!.valueAddScore).toBe(100);

    const kleinerResult = computeStrategicFitScore({ priceZone: undefined, totalValueCreationChf: 8_000, kaufpreisChf: 800_000 });
    expect(kleinerResult!.valueAddScore).toBe(20);
  });

  it("mittelt Preiszonen- und Value-Add-Score, wenn beide verfügbar sind", () => {
    const result = computeStrategicFitScore({ priceZone: "ATTRACTIVE", totalValueCreationChf: 40_000, kaufpreisChf: 800_000 });
    expect(result!.totalScore).toBe(Math.round((70 + 100) / 2));
  });
});
