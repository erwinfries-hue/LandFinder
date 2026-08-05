import { describe, it, expect } from "vitest";
import { calculateScore, type ScoreInput } from "./score";
import { SCORE_WEIGHTS, defaultsOf } from "./parameters";

const input: ScoreInput = {
  wirtschaftlichkeit: {
    yieldOnCostPercent: 4.0,
    residualwertdifferenzPercent: 5,
    developmentMarginPercent: 17.5,
    dscrBase: 1.25,
    totalDevelopmentCostChf: 900_000,
    maxTotalProjectVolumeChf: 1_000_000,
  },
  baupotenzial: {
    zoneVerification: "A",
    overallVerification: "B",
    achievedNraM2: 900,
    targetMinNraM2: 800,
    targetMaxNraM2: 1000,
    formTopografieFactor: 0.85,
    erschliessungOk: true,
    zufahrtOk: true,
  },
  markt: {
    vacancyRatePercent: 1.15,
    populationGrowth3yPercent: 4,
    rentLevelRatio: 1.0,
    constructionActivityRatePercent: 1.75,
  },
  lage: {
    oevGueteklasse: "B",
    reachableResidents30min: 275_000,
    zielmieterFitRatio: 0.6,
  },
  risiko: {
    altlasten: true,
    naturgefahren: false,
    gewaesser: false,
    laerm: true,
    planungszone: false,
    zufahrt: false,
    erschliessung: false,
    baukostenrisiken: false,
  },
};

describe("calculateScore (Abschnitt 15, Gesamt 100)", () => {
  it("summiert alle fünf Kategorien korrekt und weist den Risikoabzug getrennt aus", () => {
    const result = calculateScore(input);

    expect(result.wirtschaftlichkeit).toBeCloseTo(20, 6);
    expect(result.baupotenzial).toBeCloseTo(6 + 8 + 2 + 4 + 3 * 0.65, 6);
    expect(result.markt).toBeCloseTo(7.5, 6);
    expect(result.lage).toBeCloseTo(4 * 0.7 + 1.5 + 1.8, 6);
    expect(result.risikoAbzug).toBeCloseTo(4.5, 6); // altlasten (3) + laerm (1.5)

    const expectedTotal = result.wirtschaftlichkeit + result.baupotenzial + result.markt + result.lage + (10 - result.risikoAbzug);
    expect(result.total).toBeCloseTo(expectedTotal, 6);
  });

  it("total liegt nie über 100 (Summe der Kategorie-Maxima)", () => {
    const maxInput: ScoreInput = {
      ...input,
      wirtschaftlichkeit: { ...input.wirtschaftlichkeit, yieldOnCostPercent: 100, residualwertdifferenzPercent: 100, developmentMarginPercent: 100, dscrBase: 100 },
      risiko: { altlasten: false, naturgefahren: false, gewaesser: false, laerm: false, planungszone: false, zufahrt: false, erschliessung: false, baukostenrisiken: false },
    };
    const result = calculateScore(maxInput);
    expect(result.total).toBeLessThanOrEqual(100.0001);
  });

  it("akzeptiert überschriebene Gewichte statt der Defaults", () => {
    const result = calculateScore(input, { weights: { ...defaultsOf(SCORE_WEIGHTS), risikoMax: 20 } });
    // Mit höherem risikoMax und gleichem Abzug (4.5) liegt der erreichte Risiko-Score
    // näher an der neuen Obergrenze -> mehr Punkte in dieser Kategorie, höheres Total.
    expect(result.total).toBeGreaterThan(calculateScore(input).total);
  });
});
