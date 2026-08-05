import type { ErtragInput } from "./ertragFinanzierung";
import { calculateErtrag } from "./ertragFinanzierung";

export interface WertInput {
  noiChf: number;
  exitCapRatePercent: number;
  totalDevelopmentCostChf: number;
  totalCostExcludingLandChf: number;
  targetProfitMarginPercent: number;
  askingLandPriceChf: number;
}

export interface WertResult {
  completedValueChf: number;
  developmentProfitChf: number;
  developmentMarginPercent: number;
  targetProfitAmountChf: number;
  /** Maximal sinnvoller Grundstückspreis (Abschnitt 13). */
  residualLandValueChf: number;
  landValueGapChf: number;
  landValueGapPercent: number;
}

export function calculateWert(input: WertInput): WertResult {
  const completedValueChf = input.noiChf / (input.exitCapRatePercent / 100);
  const developmentProfitChf = completedValueChf - input.totalDevelopmentCostChf;
  const developmentMarginPercent =
    input.totalDevelopmentCostChf !== 0 ? (developmentProfitChf / input.totalDevelopmentCostChf) * 100 : 0;
  const targetProfitAmountChf = completedValueChf * (input.targetProfitMarginPercent / 100);
  const residualLandValueChf = completedValueChf - input.totalCostExcludingLandChf - targetProfitAmountChf;
  const landValueGapChf = residualLandValueChf - input.askingLandPriceChf;
  const landValueGapPercent =
    input.askingLandPriceChf !== 0 ? (landValueGapChf / input.askingLandPriceChf) * 100 : 0;

  return {
    completedValueChf,
    developmentProfitChf,
    developmentMarginPercent,
    targetProfitAmountChf,
    residualLandValueChf,
    landValueGapChf,
    landValueGapPercent,
  };
}

/**
 * Break-even-Miete: die Nettomiete CHF/m²/Monat, bei der der Residualwert exakt dem
 * Angebotspreis entspricht (alle anderen Annahmen unverändert).
 *
 * Herleitung: NOI ist linear in `rent` (NOI = A + B·rent, weil Ertrag, EGI und
 * Betriebskosten linear von der Miete abhängen). Aus `completed_value = NOI / exitCap`
 * und `residual_land_value = completed_value·(1 − targetMargin) − totalCostExcludingLand`
 * lässt sich die benötigte Miete direkt auflösen, ohne numerisch iterieren zu müssen.
 */
export function breakEvenRentChfPerM2Month(
  ertragParamsWithoutRent: Omit<ErtragInput, "rentChfPerM2Month">,
  exitCapRatePercent: number,
  targetProfitMarginPercent: number,
  totalCostExcludingLandChf: number,
  askingLandPriceChf: number,
): number {
  const at0 = calculateErtrag({ ...ertragParamsWithoutRent, rentChfPerM2Month: 0 }).noiChf;
  const at1 = calculateErtrag({ ...ertragParamsWithoutRent, rentChfPerM2Month: 1 }).noiChf;
  const slopeB = at1 - at0;
  const interceptA = at0;

  if (slopeB === 0) {
    throw new Error("Break-even-Miete nicht lösbar: NOI reagiert nicht auf die Miete (rentalNraM2 = 0?)");
  }

  const completedValueNeeded = (askingLandPriceChf + totalCostExcludingLandChf) / (1 - targetProfitMarginPercent / 100);
  const noiNeeded = completedValueNeeded * (exitCapRatePercent / 100);
  return (noiNeeded - interceptA) / slopeB;
}

export interface BreakEvenBuildingCostInput {
  /** Alle Kostenpositionen aus Abschnitt 11 ausser den Gebäudekosten und den davon abhängigen Prozentsätzen. */
  fixedCostsExcludingBuildingChf: number;
  professionalFeesPercent: number;
  permitsAndFeesPercent: number;
  contingencyPercent: number;
  constructionFinancingPercent: number;
  initialLeasingCostPercent: number;
  completedValueChf: number;
  targetProfitMarginPercent: number;
  askingLandPriceChf: number;
}

/**
 * Break-even-Baukosten: die Gebäudekosten (CHF, unabhängig von GFA/NRA-Basis), bei
 * denen der Residualwert exakt dem Angebotspreis entspricht. Die prozentualen
 * Nebenkosten (Honorare, Bewilligungen, Reserve, Baufinanzierung, Erstvermietung)
 * skalieren annahmegemäss proportional zu den Gebäudekosten (siehe `projektkosten.ts`),
 * wodurch `totalCostExcludingLand` linear in den Gebäudekosten ist.
 */
export function breakEvenBuildingCostChf(input: BreakEvenBuildingCostInput): number {
  const sumPercentFractions =
    (input.professionalFeesPercent +
      input.permitsAndFeesPercent +
      input.contingencyPercent +
      input.constructionFinancingPercent +
      input.initialLeasingCostPercent) /
    100;

  const totalCostExcludingLandNeeded =
    input.completedValueChf * (1 - input.targetProfitMarginPercent / 100) - input.askingLandPriceChf;

  return (totalCostExcludingLandNeeded - input.fixedCostsExcludingBuildingChf) / (1 + sumPercentFractions);
}
