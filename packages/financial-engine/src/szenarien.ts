import type { ScenarioResult } from "@landfinder/domain";
import { splitEigennutzung } from "./eigennutzung";
import { buildingCostChf, calculateProjektkosten, type BuildingCostBasis } from "./projektkosten";
import { calculateErtrag, calculateFinanzierung } from "./ertragFinanzierung";
import { calculateWert } from "./residualwert";
import { STRESS_CASE_PARAMETERS, defaultsOf, type StressCaseParameterKey } from "./parameters";

/**
 * Alle Eingaben für eine vollständige Base- oder Stress-Rechnung, in einem Objekt.
 * Bewusst flach und vollständig explizit — nichts hier ist ein eingebauter Default;
 * jeder Wert kommt aus dem Suchprofil, dem Inserat oder der Baupotenzial-Schätzung.
 */
export interface ScenarioInputs {
  totalNraM2: number;
  ownerUseNraM2: number;
  ownerMarketRentChfPerM2Month: number;

  rentChfPerM2Month: number;
  parkingIncomeChfPerYear: number;
  otherIncomeChfPerYear: number;
  vacancyRatePercent: number;
  collectionLossRatePercent: number;
  operatingExpenseRatioPercent: number;
  fixedNonRecoverableCostsChfPerYear: number;
  annualCapexReserveChfPerYear: number;

  landCostChf: number;
  purchaseCostsChf: number;
  demolitionChf: number;
  remediationChf: number;
  sitePreparationChf: number;
  buildingCostBasis: BuildingCostBasis;
  buildingCostPerM2Chf: number;
  gfaM2: number;
  parkingCostChf: number;
  utilityConnectionsChf: number;
  externalWorksChf: number;
  professionalFeesPercent: number;
  permitsAndFeesPercent: number;
  contingencyPercent: number;
  constructionFinancingPercent: number;
  initialLeasingCostPercent: number;

  loanToCostPercent: number;
  interestRatePercent: number;
  amortizationChfPerYear: number;

  exitCapRatePercent: number;
  targetProfitMarginPercent: number;
  askingLandPriceChf: number;
}

export function runScenario(inputs: ScenarioInputs): ScenarioResult {
  const { rentalNraM2 } = splitEigennutzung({
    totalNraM2: inputs.totalNraM2,
    ownerUseNraM2: inputs.ownerUseNraM2,
    ownerMarketRentChfPerM2Month: inputs.ownerMarketRentChfPerM2Month,
  });

  const buildingCost = buildingCostChf({
    basis: inputs.buildingCostBasis,
    costPerM2Chf: inputs.buildingCostPerM2Chf,
    gfaM2: inputs.gfaM2,
    nraM2: inputs.totalNraM2,
  });

  const projektkosten = calculateProjektkosten({
    landCostChf: inputs.landCostChf,
    purchaseCostsChf: inputs.purchaseCostsChf,
    demolitionChf: inputs.demolitionChf,
    remediationChf: inputs.remediationChf,
    sitePreparationChf: inputs.sitePreparationChf,
    buildingCostChf: buildingCost,
    parkingCostChf: inputs.parkingCostChf,
    utilityConnectionsChf: inputs.utilityConnectionsChf,
    externalWorksChf: inputs.externalWorksChf,
    professionalFeesPercent: inputs.professionalFeesPercent,
    permitsAndFeesPercent: inputs.permitsAndFeesPercent,
    contingencyPercent: inputs.contingencyPercent,
    constructionFinancingPercent: inputs.constructionFinancingPercent,
    initialLeasingCostPercent: inputs.initialLeasingCostPercent,
  });

  const ertrag = calculateErtrag({
    rentalNraM2,
    rentChfPerM2Month: inputs.rentChfPerM2Month,
    parkingIncomeChfPerYear: inputs.parkingIncomeChfPerYear,
    otherIncomeChfPerYear: inputs.otherIncomeChfPerYear,
    vacancyRatePercent: inputs.vacancyRatePercent,
    collectionLossRatePercent: inputs.collectionLossRatePercent,
    operatingExpenseRatioPercent: inputs.operatingExpenseRatioPercent,
    fixedNonRecoverableCostsChfPerYear: inputs.fixedNonRecoverableCostsChfPerYear,
    annualCapexReserveChfPerYear: inputs.annualCapexReserveChfPerYear,
  });

  const finanzierung = calculateFinanzierung({
    totalDevelopmentCostChf: projektkosten.totalDevelopmentCostChf,
    loanToCostPercent: inputs.loanToCostPercent,
    interestRatePercent: inputs.interestRatePercent,
    amortizationChfPerYear: inputs.amortizationChfPerYear,
    noiChf: ertrag.noiChf,
  });

  const wert = calculateWert({
    noiChf: ertrag.noiChf,
    exitCapRatePercent: inputs.exitCapRatePercent,
    totalDevelopmentCostChf: projektkosten.totalDevelopmentCostChf,
    totalCostExcludingLandChf: projektkosten.totalCostExcludingLandChf,
    targetProfitMarginPercent: inputs.targetProfitMarginPercent,
    askingLandPriceChf: inputs.askingLandPriceChf,
  });

  return {
    noiChf: ertrag.noiChf,
    cashFlowBeforeTaxChf: finanzierung.cashFlowBeforeTaxChf,
    dscr: finanzierung.dscr,
    cashOnCashPercent: finanzierung.cashOnCashPercent,
    residualLandValueChf: wert.residualLandValueChf,
  };
}

/**
 * Leitet aus einem Base-Case-Input den Stress-Case-Input ab (Abschnitt 14).
 *
 * Die Verzögerung (`delayMonths`) hat im Masterdokument keine eigene Formel — sie
 * wird hier als zusätzliche Bauzinsbelastung modelliert: `delayMonths / 12 ·
 * interestRatePercent` wird auf `constructionFinancingPercent` aufgeschlagen. Das ist
 * eine explizite, hier benannte Modellannahme, kein verstecktes Detail — bei Bedarf
 * einfach durch eine eigene Berechnung ersetzen.
 */
export function applyStressCase(
  base: ScenarioInputs,
  stress: Record<StressCaseParameterKey, number> = defaultsOf(STRESS_CASE_PARAMETERS),
): ScenarioInputs {
  const delayFinancingSurchargePercent = (stress.delayMonths / 12) * base.interestRatePercent;

  return {
    ...base,
    rentChfPerM2Month: base.rentChfPerM2Month * (1 + stress.rentDeltaPct / 100),
    buildingCostPerM2Chf: base.buildingCostPerM2Chf * (1 + stress.constructionCostDeltaPct / 100),
    interestRatePercent: base.interestRatePercent + stress.interestRateDeltaPp,
    totalNraM2: base.totalNraM2 * (1 + stress.nraDeltaPct / 100),
    gfaM2: base.gfaM2 * (1 + stress.nraDeltaPct / 100),
    contingencyPercent: base.contingencyPercent + stress.extraContingencyPct,
    constructionFinancingPercent: base.constructionFinancingPercent + delayFinancingSurchargePercent,
  };
}

export function runBaseAndStress(
  base: ScenarioInputs,
  stressOverrides?: Partial<Record<StressCaseParameterKey, number>>,
): { base: ScenarioResult; stress: ScenarioResult } {
  const stressParams = { ...defaultsOf(STRESS_CASE_PARAMETERS), ...stressOverrides };
  const stressInputs = applyStressCase(base, stressParams);
  return {
    base: runScenario(base),
    stress: runScenario(stressInputs),
  };
}
