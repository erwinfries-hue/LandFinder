import { describe, it, expect } from "vitest";
import { scoreWirtschaftlichkeit } from "./wirtschaftlichkeit";

describe("scoreWirtschaftlichkeit (Abschnitt 15, max. 40 Punkte)", () => {
  it("liegt bei Werten in der Bandmitte bei der Hälfte jeder Teilpunktzahl (Default-Parameter)", () => {
    const result = scoreWirtschaftlichkeit({
      yieldOnCostPercent: 4.0, // Band 2.5-5.5 -> Mitte
      residualwertdifferenzPercent: 5, // Band -10..20 -> Mitte
      developmentMarginPercent: 17.5, // Band 10..25 -> Mitte
      dscrBase: 1.25, // Band 1.0..1.5 -> Mitte
      totalDevelopmentCostChf: 900_000,
      maxTotalProjectVolumeChf: 1_000_000, // Ratio 0.9, Band 1.0..0.8 -> Mitte
    });

    expect(result.yieldOnCost).toBeCloseTo(6, 6);
    expect(result.residualwertdifferenz).toBeCloseTo(6, 6);
    expect(result.entwicklungsmarge).toBeCloseTo(3, 6);
    expect(result.dscrCashflow).toBeCloseTo(2.5, 6);
    expect(result.budgetfit).toBeCloseTo(2.5, 6);
    expect(result.total).toBeCloseTo(20, 6);
  });

  it("vergibt die volle Punktzahl, wenn alle Werte über der jeweiligen Ceiling liegen", () => {
    const result = scoreWirtschaftlichkeit({
      yieldOnCostPercent: 10,
      residualwertdifferenzPercent: 50,
      developmentMarginPercent: 40,
      dscrBase: 2.0,
      totalDevelopmentCostChf: 500_000,
      maxTotalProjectVolumeChf: 1_000_000,
    });
    expect(result.total).toBeCloseTo(40, 6);
  });

  it("behandelt maxTotalProjectVolumeChf = 0 ohne Division durch 0 (Budgetfit-Ratio = 1)", () => {
    const result = scoreWirtschaftlichkeit({
      yieldOnCostPercent: 10,
      residualwertdifferenzPercent: 50,
      developmentMarginPercent: 40,
      dscrBase: 2.0,
      totalDevelopmentCostChf: 500_000,
      maxTotalProjectVolumeChf: 0,
    });
    expect(result.budgetfit).toBe(0);
  });
});
