import type { OevGueteklasse } from "@landfinder/domain";
import { SCORE_WEIGHTS, SCORE_BANDS, defaultsOf, type ScoreWeightValues, type ScoreBandValues } from "./parameters";
import { linearBandScore, discreteLevelScore } from "./scoreHelpers";

export interface LageScoreInput {
  oevGueteklasse: OevGueteklasse;
  /** Innert 30 Min. erreichbare Einwohner (ÖV oder MIV, aus Wüest-Mobilitätsdaten). */
  reachableResidents30min: number;
  /**
   * Zielmieter-Fit als Anteil 0–1. Das Masterdokument gibt hierfür keine Formel vor —
   * dieser Wert kommt bewusst als externe/manuelle Einschätzung herein (z.B. Abgleich
   * Zimmerverteilung des Projekts mit der Haushaltsstruktur der Gemeinde), statt eine
   * Formel zu erfinden, die der Spezifikation nicht entspricht.
   */
  zielmieterFitRatio: number;
}

export interface LageScoreResult {
  total: number;
  oev: number;
  erreichbarkeit: number;
  zielmieterFit: number;
}

const OEV_LEVEL_FACTOR: Record<OevGueteklasse, number> = { A: 1, B: 0.7, C: 0.3, D: 0 };

/** Lage-Score, max. 10 Punkte (Abschnitt 15). */
export function scoreLage(
  input: LageScoreInput,
  weights: ScoreWeightValues = defaultsOf(SCORE_WEIGHTS),
  bands: ScoreBandValues = defaultsOf(SCORE_BANDS),
): LageScoreResult {
  const oev = weights.oev * discreteLevelScore(input.oevGueteklasse, OEV_LEVEL_FACTOR);
  const erreichbarkeit = linearBandScore(
    input.reachableResidents30min,
    bands.erreichbarkeitFloor,
    bands.erreichbarkeitCeiling,
    weights.erreichbarkeit,
  );
  const zielmieterFit = weights.zielmieterFit * Math.max(0, Math.min(1, input.zielmieterFitRatio));

  return { total: oev + erreichbarkeit + zielmieterFit, oev, erreichbarkeit, zielmieterFit };
}
