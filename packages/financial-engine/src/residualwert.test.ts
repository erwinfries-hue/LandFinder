import { describe, it, expect } from "vitest";
import { calculateWert, breakEvenRentChfPerM2Month, breakEvenBuildingCostChf } from "./residualwert";
import { calculateErtrag } from "./ertragFinanzierung";

describe("Wert und Residualwert (Abschnitt 13)", () => {
  it("rechnet von NOI bis zum Residualwert (runde Testzahlen)", () => {
    const result = calculateWert({
      noiChf: 216_000,
      exitCapRatePercent: 4,
      totalDevelopmentCostChf: 3_000_000,
      totalCostExcludingLandChf: 2_000_000,
      targetProfitMarginPercent: 20,
      askingLandPriceChf: 1_000_000,
    });

    expect(result.completedValueChf).toBe(5_400_000);
    expect(result.developmentProfitChf).toBe(2_400_000);
    expect(result.developmentMarginPercent).toBeCloseTo(80, 6);
    expect(result.targetProfitAmountChf).toBe(1_080_000);
    expect(result.residualLandValueChf).toBe(2_320_000);
    expect(result.landValueGapChf).toBe(1_320_000);
    expect(result.landValueGapPercent).toBeCloseTo(132, 6);
  });

  it("landValueGapChf ist positiv, wenn der Residualwert über dem Angebotspreis liegt", () => {
    const result = calculateWert({
      noiChf: 100_000,
      exitCapRatePercent: 5,
      totalDevelopmentCostChf: 1_500_000,
      totalCostExcludingLandChf: 1_000_000,
      targetProfitMarginPercent: 15,
      askingLandPriceChf: 400_000,
    });
    expect(result.landValueGapChf).toBeGreaterThan(0);
  });
});

describe("Break-even-Miete (Abschnitt 13)", () => {
  it("die berechnete Break-even-Miete führt exakt zu Residualwert = Angebotspreis", () => {
    const ertragParamsWithoutRent = {
      rentalNraM2: 1000,
      parkingIncomeChfPerYear: 20_000,
      otherIncomeChfPerYear: 0,
      vacancyRatePercent: 5,
      collectionLossRatePercent: 1,
      operatingExpenseRatioPercent: 20,
      fixedNonRecoverableCostsChfPerYear: 10_000,
      annualCapexReserveChfPerYear: 8_000,
    };
    const exitCapRatePercent = 4;
    const targetProfitMarginPercent = 15;
    const totalCostExcludingLandChf = 4_500_000;
    const askingLandPriceChf = 3_200_000;

    const breakEvenRent = breakEvenRentChfPerM2Month(
      ertragParamsWithoutRent,
      exitCapRatePercent,
      targetProfitMarginPercent,
      totalCostExcludingLandChf,
      askingLandPriceChf,
    );

    const { noiChf } = calculateErtrag({ ...ertragParamsWithoutRent, rentChfPerM2Month: breakEvenRent });
    const wert = calculateWert({
      noiChf,
      exitCapRatePercent,
      totalDevelopmentCostChf: totalCostExcludingLandChf + askingLandPriceChf,
      totalCostExcludingLandChf,
      targetProfitMarginPercent,
      askingLandPriceChf,
    });

    expect(wert.residualLandValueChf).toBeCloseTo(askingLandPriceChf, 4);
  });

  it("wirft, wenn die Miete keinen Einfluss auf den NOI hat (rentalNraM2 = 0)", () => {
    expect(() =>
      breakEvenRentChfPerM2Month(
        {
          rentalNraM2: 0,
          parkingIncomeChfPerYear: 0,
          otherIncomeChfPerYear: 0,
          vacancyRatePercent: 0,
          collectionLossRatePercent: 0,
          operatingExpenseRatioPercent: 0,
          fixedNonRecoverableCostsChfPerYear: 0,
          annualCapexReserveChfPerYear: 0,
        },
        4,
        15,
        1_000_000,
        800_000,
      ),
    ).toThrow();
  });
});

describe("Break-even-Baukosten (Abschnitt 13)", () => {
  it("die berechneten Break-even-Baukosten führen exakt zu Residualwert = Angebotspreis", () => {
    const completedValueChf = 6_000_000;
    const targetProfitMarginPercent = 15;
    const askingLandPriceChf = 2_500_000;
    const fixedCostsExcludingBuildingChf = 300_000;
    const professionalFeesPercent = 10;
    const permitsAndFeesPercent = 2;
    const contingencyPercent = 5;
    const constructionFinancingPercent = 3;
    const initialLeasingCostPercent = 1;

    const breakEvenBuildingCost = breakEvenBuildingCostChf({
      fixedCostsExcludingBuildingChf,
      professionalFeesPercent,
      permitsAndFeesPercent,
      contingencyPercent,
      constructionFinancingPercent,
      initialLeasingCostPercent,
      completedValueChf,
      targetProfitMarginPercent,
      askingLandPriceChf,
    });

    const sumPercentFractions =
      (professionalFeesPercent + permitsAndFeesPercent + contingencyPercent + constructionFinancingPercent + initialLeasingCostPercent) / 100;
    const totalCostExcludingLandChf = fixedCostsExcludingBuildingChf + breakEvenBuildingCost * (1 + sumPercentFractions);

    const wert = calculateWert({
      noiChf: completedValueChf * 0.04, // beliebiger exitCap, da completedValueChf hier direkt vorgegeben ist
      exitCapRatePercent: 4,
      totalDevelopmentCostChf: totalCostExcludingLandChf + askingLandPriceChf,
      totalCostExcludingLandChf,
      targetProfitMarginPercent,
      askingLandPriceChf,
    });

    expect(wert.completedValueChf).toBeCloseTo(completedValueChf, 4);
    expect(wert.residualLandValueChf).toBeCloseTo(askingLandPriceChf, 4);
  });
});
