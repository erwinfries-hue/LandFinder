import type { ScoreBreakdown } from "@landfinder/domain";
import { SCORE_WEIGHTS, SCORE_BANDS, RISK_DEDUCTIONS, defaultsOf, type ScoreWeightValues, type ScoreBandValues, type RiskDeductionValues } from "./parameters";
import { scoreWirtschaftlichkeit, type WirtschaftlichkeitInput } from "./wirtschaftlichkeit";
import { scoreBaupotenzial, type BaupotenzialScoreInput } from "./baupotenzial";
import { scoreMarkt, type MarktScoreInput } from "./markt";
import { scoreLage, type LageScoreInput } from "./lage";
import { scoreRisiko, type RisikoFlags } from "./risiko";

export interface ScoreInput {
  wirtschaftlichkeit: WirtschaftlichkeitInput;
  baupotenzial: BaupotenzialScoreInput;
  markt: MarktScoreInput;
  lage: LageScoreInput;
  risiko: RisikoFlags;
}

export interface ScoreParameterOverrides {
  weights?: ScoreWeightValues;
  bands?: ScoreBandValues;
  riskDeductions?: RiskDeductionValues;
}

/** Berechnet den vollständigen Attraktivitäts-Score, Gesamt 100 (Abschnitt 15). */
export function calculateScore(input: ScoreInput, overrides: ScoreParameterOverrides = {}): ScoreBreakdown {
  const weights = overrides.weights ?? defaultsOf(SCORE_WEIGHTS);
  const bands = overrides.bands ?? defaultsOf(SCORE_BANDS);
  const riskDeductions = overrides.riskDeductions ?? defaultsOf(RISK_DEDUCTIONS);

  const wirtschaftlichkeit = scoreWirtschaftlichkeit(input.wirtschaftlichkeit, weights, bands);
  const baupotenzial = scoreBaupotenzial(input.baupotenzial, weights, bands);
  const markt = scoreMarkt(input.markt, weights, bands);
  const lage = scoreLage(input.lage, weights, bands);
  const risiko = scoreRisiko(input.risiko, weights, riskDeductions);

  const appliedRiskDeduction = weights.risikoMax - risiko.total;

  return {
    total: wirtschaftlichkeit.total + baupotenzial.total + markt.total + lage.total + risiko.total,
    wirtschaftlichkeit: wirtschaftlichkeit.total,
    baupotenzial: baupotenzial.total,
    markt: markt.total,
    lage: lage.total,
    risikoAbzug: appliedRiskDeduction,
  };
}
