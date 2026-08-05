export interface EigennutzungInput {
  totalNraM2: number;
  ownerUseNraM2: number;
  ownerMarketRentChfPerM2Month: number;
}

export interface EigennutzungResult {
  rentalNraM2: number;
  /** Kalkulatorischer Wohnnutzen — kein tatsächlicher Cashflow, nie damit vermischen. */
  imputedOwnerRentChfPerYear: number;
  ownerCapitalSharePercent: number;
}

/**
 * Trennt Eigennutzungs- von Mietfläche (Abschnitt 10). Gibt Cashflow und
 * kalkulatorischen Wohnnutzen getrennt aus — beide dürfen im Reporting nie
 * zusammengezählt werden.
 */
export function splitEigennutzung(input: EigennutzungInput): EigennutzungResult {
  const rentalNraM2 = Math.max(input.totalNraM2 - input.ownerUseNraM2, 0);
  const imputedOwnerRentChfPerYear = input.ownerUseNraM2 * input.ownerMarketRentChfPerM2Month * 12;
  const ownerCapitalSharePercent = input.totalNraM2 > 0 ? (input.ownerUseNraM2 / input.totalNraM2) * 100 : 0;

  return { rentalNraM2, imputedOwnerRentChfPerYear, ownerCapitalSharePercent };
}
