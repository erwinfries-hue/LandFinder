import { describe, it, expect } from "vitest";
import { computeChamAnalysis, CHAM_FACTS } from "./objektAnalysis";
import { DEFAULT_SEARCH_PROFILE } from "./searchProfile";

describe("computeChamAnalysis", () => {
  it("liefert mit den Standard-Annahmen ein plausibles, in sich konsistentes Ergebnis", () => {
    const result = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});

    expect(result.score.total).toBeGreaterThanOrEqual(0);
    expect(result.score.total).toBeLessThanOrEqual(100);
    expect(result.confidence.total).toBeGreaterThanOrEqual(0);
    expect(result.confidence.total).toBeLessThanOrEqual(100);
    expect([
      "SOFORT_PRUEFEN",
      "POTENZIAL_DRINGEND_VERIFIZIEREN",
      "WEITERVERFOLGEN",
      "BEOBACHTEN_VERHANDELN",
      "NICHT_WEITERVERFOLGEN",
      "UNGENUEGENDE_DATEN",
    ]).toContain(result.empfehlung);
    expect(result.yieldOnCostPercent).toBeGreaterThan(0);
    // Gesamtinvestition muss über dem reinen Landpreis liegen (Land + Bau + Nebenkosten).
    expect(result.base.totalDevelopmentCostChf).toBeGreaterThan(CHAM_FACTS.askingPriceChf);
    expect(result.hardGate.status).toBe("PASSED");
    expect(result.baupotenzial.adjustedNraM2).toBeGreaterThan(0);
  });

  it("gibt bei jedem Aufruf mit denselben Eingaben dasselbe Ergebnis zurück (keine versteckte Zufälligkeit)", () => {
    const a = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    const b = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    expect(a.score.total).toBe(b.score.total);
    expect(a.base.totalDevelopmentCostChf).toBe(b.base.totalDevelopmentCostChf);
  });

  it("reduziert das Baupotenzial, wenn ein Annahmen-Override den Geometriefaktor verkleinert", () => {
    const base = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    const overridden = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, { "baupotenzial.geometryFactor": 0.5 });

    expect(overridden.baupotenzial.adjustedNraM2).toBeLessThan(base.baupotenzial.adjustedNraM2);
  });

  it("übernimmt einen Stress-Case-Override direkt in den Stress-Zinssatz", () => {
    const result = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, { "stress.interestRateDeltaPp": 5 });
    expect(result.stress.interestRatePercent).toBeCloseTo(DEFAULT_SEARCH_PROFILE.finanzierung.interestRateBasePercent + 5, 5);
  });

  it("erhöht die Gesamtinvestition, wenn das Suchprofil höhere Baukosten pro m² annimmt", () => {
    const base = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    const expensiveProfile = {
      ...DEFAULT_SEARCH_PROFILE,
      baukosten: {
        ...DEFAULT_SEARCH_PROFILE.baukosten,
        buildingCostChfPerM2: DEFAULT_SEARCH_PROFILE.baukosten.buildingCostChfPerM2 * 2,
      },
    };
    const expensive = computeChamAnalysis(expensiveProfile, {});

    expect(expensive.base.totalDevelopmentCostChf).toBeGreaterThan(base.base.totalDevelopmentCostChf);
  });
});
