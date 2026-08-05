import { describe, it, expect } from "vitest";
import { computeComparisonMetrics } from "./metrics";

describe("computeComparisonMetrics (Abschnitt 20)", () => {
  it("leitet alle acht Kennzahlen korrekt ab", () => {
    const result = computeComparisonMetrics({
      scoreTotal: 75,
      dataConfidenceTotal: 82,
      askingPriceChf: 2_000_000,
      parcelAreaM2: 1000,
      achievedNraM2: 800,
      totalDevelopmentCostChf: 5_000_000,
      noiChf: 250_000,
      residualLandValueChf: 2_200_000,
      equityRequiredChf: 1_500_000,
    });

    expect(result.scoreTotal).toBe(75);
    expect(result.dataConfidenceTotal).toBe(82);
    expect(result.pricePerM2LandChf).toBe(2000);
    expect(result.pricePerM2NraChf).toBe(2500);
    expect(result.totalCostPerM2NraChf).toBeCloseTo(6250, 6);
    expect(result.yieldOnCostPercent).toBe(5);
    expect(result.residualValueDifferencePercent).toBe(10);
    expect(result.equityRequiredChf).toBe(1_500_000);
  });

  it("vermeidet Division durch 0 bei fehlenden Flächen-/Kostenangaben", () => {
    const result = computeComparisonMetrics({
      scoreTotal: 50,
      dataConfidenceTotal: 50,
      askingPriceChf: 0,
      parcelAreaM2: 0,
      achievedNraM2: 0,
      totalDevelopmentCostChf: 0,
      noiChf: 100_000,
      residualLandValueChf: 0,
      equityRequiredChf: 0,
    });
    expect(result.pricePerM2LandChf).toBe(0);
    expect(result.pricePerM2NraChf).toBe(0);
    expect(result.totalCostPerM2NraChf).toBe(0);
    expect(result.yieldOnCostPercent).toBe(0);
    expect(result.residualValueDifferencePercent).toBe(0);
  });
});
