import { describe, it, expect } from "vitest";
import { calculateErtrag, calculateFinanzierung } from "./ertragFinanzierung";

describe("Ertrag (Abschnitt 12)", () => {
  it("rechnet vom Ertrag bis zum NOI (runde Testzahlen)", () => {
    const result = calculateErtrag({
      rentalNraM2: 1000,
      rentChfPerM2Month: 25,
      parkingIncomeChfPerYear: 0,
      otherIncomeChfPerYear: 0,
      vacancyRatePercent: 10,
      collectionLossRatePercent: 0,
      operatingExpenseRatioPercent: 20,
      fixedNonRecoverableCostsChfPerYear: 0,
      annualCapexReserveChfPerYear: 0,
    });

    expect(result.annualPotentialRentChf).toBe(300_000);
    expect(result.effectiveGrossIncomeChf).toBe(270_000);
    expect(result.operatingCostsChf).toBe(54_000);
    expect(result.noiChf).toBe(216_000);
  });

  it("berücksichtigt Parkplatz- und Nebenertrag sowie fixe Kosten", () => {
    const result = calculateErtrag({
      rentalNraM2: 500,
      rentChfPerM2Month: 20,
      parkingIncomeChfPerYear: 12_000,
      otherIncomeChfPerYear: 3_000,
      vacancyRatePercent: 5,
      collectionLossRatePercent: 1,
      operatingExpenseRatioPercent: 15,
      fixedNonRecoverableCostsChfPerYear: 5_000,
      annualCapexReserveChfPerYear: 4_000,
    });
    const expectedPotentialRent = 500 * 20 * 12 + 12_000 + 3_000;
    expect(result.annualPotentialRentChf).toBe(expectedPotentialRent);
    const expectedEgi = expectedPotentialRent * (1 - 0.05 - 0.01);
    expect(result.effectiveGrossIncomeChf).toBeCloseTo(expectedEgi, 6);
    expect(result.noiChf).toBeCloseTo(result.effectiveGrossIncomeChf - result.operatingCostsChf, 6);
  });
});

describe("Finanzierung (Abschnitt 12)", () => {
  it("rechnet von NOI bis DSCR und Cash-on-Cash (runde Testzahlen)", () => {
    const result = calculateFinanzierung({
      totalDevelopmentCostChf: 3_000_000,
      loanToCostPercent: 60,
      interestRatePercent: 4,
      amortizationChfPerYear: 0,
      noiChf: 216_000,
    });

    expect(result.loanAmountChf).toBe(1_800_000);
    expect(result.equityRequiredChf).toBe(1_200_000);
    expect(result.annualInterestChf).toBe(72_000);
    expect(result.annualDebtServiceChf).toBe(72_000);
    expect(result.cashFlowBeforeTaxChf).toBe(144_000);
    expect(result.dscr).toBeCloseTo(3.0, 6);
    expect(result.cashOnCashPercent).toBeCloseTo(12, 6);
  });

  it("dscr ist immer noiChf / annualDebtServiceChf", () => {
    const noiChf = 310_000;
    const result = calculateFinanzierung({
      totalDevelopmentCostChf: 8_240_000,
      loanToCostPercent: 74,
      interestRatePercent: 2.1,
      amortizationChfPerYear: 15_000,
      noiChf,
    });
    expect(result.dscr).toBeCloseTo(noiChf / result.annualDebtServiceChf, 6);
  });

  it("vermeidet Division durch 0 bei equityRequiredChf = 0 (LTC 100%)", () => {
    const result = calculateFinanzierung({
      totalDevelopmentCostChf: 1_000_000,
      loanToCostPercent: 100,
      interestRatePercent: 3,
      amortizationChfPerYear: 0,
      noiChf: 50_000,
    });
    expect(result.equityRequiredChf).toBe(0);
    expect(result.cashOnCashPercent).toBe(0);
  });
});
