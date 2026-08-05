import { describe, it, expect } from "vitest";
import { buildingCostChf, calculateProjektkosten } from "./projektkosten";

describe("Baukosten (Abschnitt 11)", () => {
  it("buildingCostChf auf GFA-Basis", () => {
    expect(buildingCostChf({ basis: "GFA", costPerM2Chf: 4000, gfaM2: 900 })).toBe(3_600_000);
  });

  it("buildingCostChf auf NRA-Basis", () => {
    expect(buildingCostChf({ basis: "NRA", costPerM2Chf: 4500, nraM2: 826 })).toBe(4500 * 826);
  });

  it("wirft ohne gfaM2 bei Basis GFA", () => {
    expect(() => buildingCostChf({ basis: "GFA", costPerM2Chf: 4000 })).toThrow();
  });

  it("wirft ohne nraM2 bei Basis NRA", () => {
    expect(() => buildingCostChf({ basis: "NRA", costPerM2Chf: 4000 })).toThrow();
  });
});

describe("Projektkosten (Abschnitt 11)", () => {
  it("summiert alle Positionen inkl. der auf Gebäudekosten basierenden Prozentsätze", () => {
    const result = calculateProjektkosten({
      landCostChf: 3_000_000,
      purchaseCostsChf: 50_000,
      demolitionChf: 0,
      remediationChf: 0,
      sitePreparationChf: 20_000,
      buildingCostChf: 3_600_000,
      parkingCostChf: 100_000,
      utilityConnectionsChf: 80_000,
      externalWorksChf: 70_000,
      professionalFeesPercent: 10,
      permitsAndFeesPercent: 2,
      contingencyPercent: 5,
      constructionFinancingPercent: 3,
      initialLeasingCostPercent: 1,
    });

    expect(result.professionalFeesChf).toBe(360_000);
    expect(result.permitsAndFeesChf).toBe(72_000);
    expect(result.contingencyChf).toBe(180_000);
    expect(result.constructionFinancingChf).toBe(108_000);
    expect(result.initialLeasingCostChf).toBe(36_000);
    expect(result.totalCostExcludingLandChf).toBe(4_676_000);
    expect(result.totalDevelopmentCostChf).toBe(7_676_000);
  });

  it("totalDevelopmentCostChf = landCostChf + totalCostExcludingLandChf (immer)", () => {
    const landCostChf = 1_234_000;
    const result = calculateProjektkosten({
      landCostChf,
      purchaseCostsChf: 10_000,
      demolitionChf: 5_000,
      remediationChf: 0,
      sitePreparationChf: 0,
      buildingCostChf: 2_000_000,
      parkingCostChf: 0,
      utilityConnectionsChf: 0,
      externalWorksChf: 0,
      professionalFeesPercent: 8,
      permitsAndFeesPercent: 1.5,
      contingencyPercent: 4,
      constructionFinancingPercent: 2,
      initialLeasingCostPercent: 0.5,
    });
    expect(result.totalDevelopmentCostChf).toBeCloseTo(landCostChf + result.totalCostExcludingLandChf, 6);
  });
});
