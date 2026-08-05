import { SCORE_WEIGHTS, SCORE_BANDS, defaultsOf, type ScoreWeightValues, type ScoreBandValues } from "./parameters";
import { linearBandScore } from "./scoreHelpers";

export interface WirtschaftlichkeitInput {
  yieldOnCostPercent: number;
  /** `landValueGapPercent` aus `financial-engine`s `calculateWert`. */
  residualwertdifferenzPercent: number;
  developmentMarginPercent: number;
  dscrBase: number;
  totalDevelopmentCostChf: number;
  maxTotalProjectVolumeChf: number;
}

export interface WirtschaftlichkeitResult {
  total: number;
  yieldOnCost: number;
  residualwertdifferenz: number;
  entwicklungsmarge: number;
  dscrCashflow: number;
  budgetfit: number;
}

/** Wirtschaftlichkeits-Score, max. 40 Punkte (Abschnitt 15). */
export function scoreWirtschaftlichkeit(
  input: WirtschaftlichkeitInput,
  weights: ScoreWeightValues = defaultsOf(SCORE_WEIGHTS),
  bands: ScoreBandValues = defaultsOf(SCORE_BANDS),
): WirtschaftlichkeitResult {
  const yieldOnCost = linearBandScore(input.yieldOnCostPercent, bands.yieldOnCostFloorPct, bands.yieldOnCostCeilingPct, weights.yieldOnCost);
  const residualwertdifferenz = linearBandScore(
    input.residualwertdifferenzPercent,
    bands.landValueGapFloorPct,
    bands.landValueGapCeilingPct,
    weights.residualwertdifferenz,
  );
  const entwicklungsmarge = linearBandScore(
    input.developmentMarginPercent,
    bands.developmentMarginFloorPct,
    bands.developmentMarginCeilingPct,
    weights.entwicklungsmarge,
  );
  const dscrCashflow = linearBandScore(input.dscrBase, bands.dscrFloor, bands.dscrCeiling, weights.dscrCashflow);

  const budgetRatio = input.maxTotalProjectVolumeChf > 0 ? input.totalDevelopmentCostChf / input.maxTotalProjectVolumeChf : 1;
  const budgetfit = linearBandScore(budgetRatio, bands.budgetfitFloorRatio, bands.budgetfitCeilingRatio, weights.budgetfit);

  return {
    total: yieldOnCost + residualwertdifferenz + entwicklungsmarge + dscrCashflow + budgetfit,
    yieldOnCost,
    residualwertdifferenz,
    entwicklungsmarge,
    dscrCashflow,
    budgetfit,
  };
}
