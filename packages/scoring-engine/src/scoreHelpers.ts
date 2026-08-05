function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/**
 * Lineare Bandbewertung zwischen zwei Schwellen: bei `floor` gibt es 0 Punkte, bei
 * `ceiling` die vollen `maxPoints`, dazwischen linear interpoliert. Funktioniert für
 * "höher ist besser" (ceiling > floor) genauso wie für "tiefer ist besser"
 * (ceiling < floor) — das Vorzeichen kürzt sich in der Formel automatisch heraus.
 */
export function linearBandScore(value: number, floor: number, ceiling: number, maxPoints: number): number {
  if (floor === ceiling) return value >= floor ? maxPoints : 0;
  return clamp01((value - floor) / (ceiling - floor)) * maxPoints;
}

/**
 * Volle Punktzahl innerhalb [min, max], ausserhalb linear abfallend über eine
 * Toleranzbreite (`toleranceBelow`/`toleranceAbove`) bis auf 0.
 */
export function withinRangeScore(
  value: number,
  min: number,
  max: number,
  toleranceBelow: number,
  toleranceAbove: number,
  maxPoints: number,
): number {
  if (value >= min && value <= max) return maxPoints;
  if (value < min) return linearBandScore(value, min - toleranceBelow, min, maxPoints);
  return linearBandScore(value, max + toleranceAbove, max, maxPoints);
}

/** Diskrete Punktzahl für eine Verifikations-/Güteklasse (A/B/C oder A/B/C/D). */
export function discreteLevelScore<L extends string>(level: L, points: Record<L, number>): number {
  return points[level] ?? 0;
}
