import type { VerificationLevel } from "@landfinder/domain";
import { SCORE_WEIGHTS, SCORE_BANDS, defaultsOf, type ScoreWeightValues, type ScoreBandValues } from "./parameters";
import { linearBandScore, withinRangeScore, discreteLevelScore } from "./scoreHelpers";

export interface BaupotenzialScoreInput {
  zoneVerification: VerificationLevel;
  overallVerification: VerificationLevel;
  achievedNraM2: number;
  targetMinNraM2?: number;
  targetMaxNraM2?: number;
  /** Produkt aus Geometrie- und Topografiefaktor (`financial-engine`s `BaupotenzialFactors`). */
  formTopografieFactor: number;
  erschliessungOk: boolean;
  zufahrtOk: boolean;
}

export interface BaupotenzialScoreResult {
  total: number;
  zone: number;
  projektgroesse: number;
  formTopografie: number;
  erschliessungZufahrt: number;
  verifikation: number;
}

const ZONE_LEVEL_FACTOR: Record<VerificationLevel, number> = { A: 1, B: 0.65, C: 0.25 };
const VERIFICATION_LEVEL_FACTOR: Record<VerificationLevel, number> = { A: 1, B: 0.65, C: 0.15 };

/** Baupotenzial-Score, max. 25 Punkte (Abschnitt 15). */
export function scoreBaupotenzial(
  input: BaupotenzialScoreInput,
  weights: ScoreWeightValues = defaultsOf(SCORE_WEIGHTS),
  bands: ScoreBandValues = defaultsOf(SCORE_BANDS),
): BaupotenzialScoreResult {
  const zone = weights.zone * discreteLevelScore(input.zoneVerification, ZONE_LEVEL_FACTOR);

  const projektgroesse =
    input.targetMinNraM2 !== undefined && input.targetMaxNraM2 !== undefined
      ? withinRangeScore(
          input.achievedNraM2,
          input.targetMinNraM2,
          input.targetMaxNraM2,
          bands.projektgroesseToleranceBelow,
          bands.projektgroesseToleranceAbove,
          weights.projektgroesse,
        )
      : weights.projektgroesse;

  const formTopografie = linearBandScore(
    input.formTopografieFactor,
    bands.formTopografieFloor,
    bands.formTopografieCeiling,
    weights.formTopografie,
  );

  const erschliessungZufahrt = weights.erschliessungZufahrt * ((Number(input.erschliessungOk) + Number(input.zufahrtOk)) / 2);

  const verifikation = weights.verifikation * discreteLevelScore(input.overallVerification, VERIFICATION_LEVEL_FACTOR);

  return {
    total: zone + projektgroesse + formTopografie + erschliessungZufahrt + verifikation,
    zone,
    projektgroesse,
    formTopografie,
    erschliessungZufahrt,
    verifikation,
  };
}
