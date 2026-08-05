import { describe, it, expect } from "vitest";
import { runScenario, applyStressCase, runBaseAndStress, type ScenarioInputs } from "./szenarien";
import { STRESS_CASE_PARAMETERS, defaultsOf } from "./parameters";

const baseInputs: ScenarioInputs = {
  totalNraM2: 1000,
  ownerUseNraM2: 0,
  ownerMarketRentChfPerM2Month: 25,

  rentChfPerM2Month: 25,
  parkingIncomeChfPerYear: 0,
  otherIncomeChfPerYear: 0,
  vacancyRatePercent: 5,
  collectionLossRatePercent: 1,
  operatingExpenseRatioPercent: 20,
  fixedNonRecoverableCostsChfPerYear: 10_000,
  annualCapexReserveChfPerYear: 8_000,

  landCostChf: 2_500_000,
  purchaseCostsChf: 40_000,
  demolitionChf: 0,
  remediationChf: 0,
  sitePreparationChf: 20_000,
  buildingCostBasis: "NRA",
  buildingCostPerM2Chf: 4_000,
  gfaM2: 1_200,
  parkingCostChf: 60_000,
  utilityConnectionsChf: 50_000,
  externalWorksChf: 40_000,
  professionalFeesPercent: 10,
  permitsAndFeesPercent: 2,
  contingencyPercent: 5,
  constructionFinancingPercent: 3,
  initialLeasingCostPercent: 1,

  loanToCostPercent: 70,
  interestRatePercent: 4,
  amortizationChfPerYear: 15_000,

  exitCapRatePercent: 4,
  targetProfitMarginPercent: 15,
  askingLandPriceChf: 2_500_000,
};

describe("runScenario (Abschnitt 9-13, Orchestrierung)", () => {
  it("liefert ein in sich konsistentes ScenarioResult", () => {
    const result = runScenario(baseInputs);
    expect(result.noiChf).toBeGreaterThan(0);
    expect(Number.isFinite(result.dscr)).toBe(true);
    expect(Number.isFinite(result.cashOnCashPercent)).toBe(true);
    expect(Number.isFinite(result.residualLandValueChf)).toBe(true);
  });
});

describe("applyStressCase (Abschnitt 14)", () => {
  it("wendet alle Default-Stress-Parameter korrekt auf den Base-Case an", () => {
    const stress = applyStressCase(baseInputs);
    const defaults = defaultsOf(STRESS_CASE_PARAMETERS);

    expect(stress.rentChfPerM2Month).toBeCloseTo(25 * (1 + defaults.rentDeltaPct / 100), 6);
    expect(stress.buildingCostPerM2Chf).toBeCloseTo(4000 * (1 + defaults.constructionCostDeltaPct / 100), 6);
    expect(stress.interestRatePercent).toBeCloseTo(4 + defaults.interestRateDeltaPp, 6);
    expect(stress.totalNraM2).toBeCloseTo(1000 * (1 + defaults.nraDeltaPct / 100), 6);
    expect(stress.gfaM2).toBeCloseTo(1200 * (1 + defaults.nraDeltaPct / 100), 6);
    expect(stress.contingencyPercent).toBeCloseTo(5 + defaults.extraContingencyPct, 6);

    const expectedFinancingSurcharge = (defaults.delayMonths / 12) * baseInputs.interestRatePercent;
    expect(stress.constructionFinancingPercent).toBeCloseTo(3 + expectedFinancingSurcharge, 6);
  });

  it("lässt alle nicht vom Stress-Case betroffenen Felder unverändert", () => {
    const stress = applyStressCase(baseInputs);
    expect(stress.landCostChf).toBe(baseInputs.landCostChf);
    expect(stress.loanToCostPercent).toBe(baseInputs.loanToCostPercent);
    expect(stress.exitCapRatePercent).toBe(baseInputs.exitCapRatePercent);
  });

  it("akzeptiert überschriebene Stress-Parameter statt der Defaults", () => {
    const stress = applyStressCase(baseInputs, { ...defaultsOf(STRESS_CASE_PARAMETERS), rentDeltaPct: -15 });
    expect(stress.rentChfPerM2Month).toBeCloseTo(25 * 0.85, 6);
  });
});

describe("runBaseAndStress", () => {
  it("liefert für Base und Stress dieselben Resultate wie einzelne runScenario-Aufrufe", () => {
    const { base, stress } = runBaseAndStress(baseInputs);
    expect(base).toEqual(runScenario(baseInputs));
    expect(stress).toEqual(runScenario(applyStressCase(baseInputs)));
  });

  it("der Stress-Case ist für ein gesundes Base-Case-Projekt tendenziell schwächer (tieferer DSCR)", () => {
    const { base, stress } = runBaseAndStress(baseInputs);
    expect(stress.dscr).toBeLessThan(base.dscr);
  });
});
