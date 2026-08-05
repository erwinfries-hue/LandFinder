/** Die acht Vergleichskennzahlen aus Abschnitt 20. */
export interface ComparisonMetrics {
  scoreTotal: number;
  dataConfidenceTotal: number;
  pricePerM2LandChf: number;
  pricePerM2NraChf: number;
  totalCostPerM2NraChf: number;
  yieldOnCostPercent: number;
  /** Entspricht `landValueGapPercent` aus `financial-engine`s `calculateWert`. */
  residualValueDifferencePercent: number;
  equityRequiredChf: number;
}

/**
 * Für jede Kennzahl gilt entweder "höher ist besser" oder "tiefer ist besser" — das
 * Masterdokument listet die Kennzahlen, ohne diese Richtung zu benennen; sie ist hier
 * explizit als Modellannahme festgehalten (wird für Perzentile/Vor-/Nachteil-Berechnung
 * gebraucht).
 */
export const METRIC_DIRECTION: Record<keyof ComparisonMetrics, "higher_is_better" | "lower_is_better"> = {
  scoreTotal: "higher_is_better",
  dataConfidenceTotal: "higher_is_better",
  pricePerM2LandChf: "lower_is_better",
  pricePerM2NraChf: "lower_is_better",
  totalCostPerM2NraChf: "lower_is_better",
  yieldOnCostPercent: "higher_is_better",
  residualValueDifferencePercent: "higher_is_better",
  equityRequiredChf: "lower_is_better",
};

export interface ComputeMetricsInput {
  scoreTotal: number;
  dataConfidenceTotal: number;
  askingPriceChf: number;
  parcelAreaM2: number;
  achievedNraM2: number;
  totalDevelopmentCostChf: number;
  noiChf: number;
  residualLandValueChf: number;
  equityRequiredChf: number;
}

/** Leitet die acht Vergleichskennzahlen aus den Rohgrössen von `financial-engine`/`scoring-engine` ab. */
export function computeComparisonMetrics(input: ComputeMetricsInput): ComparisonMetrics {
  return {
    scoreTotal: input.scoreTotal,
    dataConfidenceTotal: input.dataConfidenceTotal,
    pricePerM2LandChf: input.parcelAreaM2 > 0 ? input.askingPriceChf / input.parcelAreaM2 : 0,
    pricePerM2NraChf: input.achievedNraM2 > 0 ? input.askingPriceChf / input.achievedNraM2 : 0,
    totalCostPerM2NraChf: input.achievedNraM2 > 0 ? input.totalDevelopmentCostChf / input.achievedNraM2 : 0,
    yieldOnCostPercent: input.totalDevelopmentCostChf > 0 ? (input.noiChf / input.totalDevelopmentCostChf) * 100 : 0,
    residualValueDifferencePercent:
      input.askingPriceChf > 0 ? ((input.residualLandValueChf - input.askingPriceChf) / input.askingPriceChf) * 100 : 0,
    equityRequiredChf: input.equityRequiredChf,
  };
}
