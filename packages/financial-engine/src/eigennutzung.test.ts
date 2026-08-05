import { describe, it, expect } from "vitest";
import { splitEigennutzung } from "./eigennutzung";

describe("Eigennutzung (Abschnitt 10)", () => {
  it("trennt Miet- und Eigennutzungsfläche und berechnet den kalkulatorischen Wohnnutzen", () => {
    const result = splitEigennutzung({
      totalNraM2: 1000,
      ownerUseNraM2: 100,
      ownerMarketRentChfPerM2Month: 25,
    });
    expect(result.rentalNraM2).toBe(900);
    expect(result.imputedOwnerRentChfPerYear).toBe(100 * 25 * 12);
    expect(result.ownerCapitalSharePercent).toBe(10);
  });

  it("rentalNraM2 wird nie negativ (max(total - owner, 0))", () => {
    const result = splitEigennutzung({
      totalNraM2: 500,
      ownerUseNraM2: 600,
      ownerMarketRentChfPerM2Month: 20,
    });
    expect(result.rentalNraM2).toBe(0);
  });

  it("ohne Eigennutzung bleibt die gesamte Fläche vermietbar", () => {
    const result = splitEigennutzung({ totalNraM2: 800, ownerUseNraM2: 0, ownerMarketRentChfPerM2Month: 25 });
    expect(result.rentalNraM2).toBe(800);
    expect(result.imputedOwnerRentChfPerYear).toBe(0);
    expect(result.ownerCapitalSharePercent).toBe(0);
  });

  it("vermeidet Division durch 0 bei totalNraM2 = 0", () => {
    const result = splitEigennutzung({ totalNraM2: 0, ownerUseNraM2: 0, ownerMarketRentChfPerM2Month: 25 });
    expect(result.ownerCapitalSharePercent).toBe(0);
  });
});
