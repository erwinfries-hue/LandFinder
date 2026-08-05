export interface ErtragInput {
  rentalNraM2: number;
  rentChfPerM2Month: number;
  parkingIncomeChfPerYear: number;
  otherIncomeChfPerYear: number;
  vacancyRatePercent: number;
  collectionLossRatePercent: number;
  operatingExpenseRatioPercent: number;
  fixedNonRecoverableCostsChfPerYear: number;
  annualCapexReserveChfPerYear: number;
}

export interface ErtragResult {
  annualPotentialRentChf: number;
  effectiveGrossIncomeChf: number;
  operatingCostsChf: number;
  noiChf: number;
}

export function calculateErtrag(input: ErtragInput): ErtragResult {
  const annualPotentialRentChf =
    input.rentalNraM2 * input.rentChfPerM2Month * 12 + input.parkingIncomeChfPerYear + input.otherIncomeChfPerYear;

  const effectiveGrossIncomeChf =
    annualPotentialRentChf * (1 - input.vacancyRatePercent / 100 - input.collectionLossRatePercent / 100);

  const operatingCostsChf =
    effectiveGrossIncomeChf * (input.operatingExpenseRatioPercent / 100) +
    input.fixedNonRecoverableCostsChfPerYear +
    input.annualCapexReserveChfPerYear;

  const noiChf = effectiveGrossIncomeChf - operatingCostsChf;

  return { annualPotentialRentChf, effectiveGrossIncomeChf, operatingCostsChf, noiChf };
}

export interface FinanzierungInput {
  totalDevelopmentCostChf: number;
  loanToCostPercent: number;
  interestRatePercent: number;
  amortizationChfPerYear: number;
  noiChf: number;
}

export interface FinanzierungResult {
  loanAmountChf: number;
  equityRequiredChf: number;
  annualInterestChf: number;
  annualDebtServiceChf: number;
  cashFlowBeforeTaxChf: number;
  dscr: number;
  cashOnCashPercent: number;
}

export function calculateFinanzierung(input: FinanzierungInput): FinanzierungResult {
  const loanAmountChf = input.totalDevelopmentCostChf * (input.loanToCostPercent / 100);
  const equityRequiredChf = input.totalDevelopmentCostChf - loanAmountChf;
  const annualInterestChf = loanAmountChf * (input.interestRatePercent / 100);
  const annualDebtServiceChf = annualInterestChf + input.amortizationChfPerYear;
  const cashFlowBeforeTaxChf = input.noiChf - annualDebtServiceChf;
  const dscr = annualDebtServiceChf !== 0 ? input.noiChf / annualDebtServiceChf : Infinity;
  const cashOnCashPercent = equityRequiredChf !== 0 ? (cashFlowBeforeTaxChf / equityRequiredChf) * 100 : 0;

  return { loanAmountChf, equityRequiredChf, annualInterestChf, annualDebtServiceChf, cashFlowBeforeTaxChf, dscr, cashOnCashPercent };
}
