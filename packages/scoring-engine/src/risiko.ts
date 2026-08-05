import { SCORE_WEIGHTS, RISK_DEDUCTIONS, defaultsOf, type ScoreWeightValues, type RiskDeductionValues } from "./parameters";

export interface RisikoFlags {
  altlasten: boolean;
  naturgefahren: boolean;
  gewaesser: boolean;
  laerm: boolean;
  planungszone: boolean;
  zufahrt: boolean;
  erschliessung: boolean;
  baukostenrisiken: boolean;
}

export interface RisikoScoreResult {
  /** Erreichte Punktzahl der Risikokategorie (max. `weights.risikoMax`, Abschnitt 15). */
  total: number;
  /** Summe der Abzüge vor Begrenzung auf `risikoMax` — für die Anzeige ("−3.5 Punkte wegen ..."). */
  deductionPoints: number;
  triggeredFactors: (keyof RisikoFlags)[];
}

/** Risiko-Score: startet bei `risikoMax` (kein Risiko) und wird pro zutreffendem Faktor reduziert. */
export function scoreRisiko(
  flags: RisikoFlags,
  weights: ScoreWeightValues = defaultsOf(SCORE_WEIGHTS),
  deductions: RiskDeductionValues = defaultsOf(RISK_DEDUCTIONS),
): RisikoScoreResult {
  const triggeredFactors = (Object.keys(flags) as (keyof RisikoFlags)[]).filter((key) => flags[key]);
  const deductionPoints = triggeredFactors.reduce((sum, key) => sum + deductions[key], 0);
  const total = Math.max(weights.risikoMax - deductionPoints, 0);

  return { total, deductionPoints, triggeredFactors };
}
