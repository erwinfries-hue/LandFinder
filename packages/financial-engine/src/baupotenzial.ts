import { BAUPOTENZIAL_PARAMETERS, defaultsOf } from "./parameters";

export type BaupotenzialFactors = Record<keyof typeof BAUPOTENZIAL_PARAMETERS, number>;

export const DEFAULT_BAUPOTENZIAL_FACTORS: BaupotenzialFactors = defaultsOf(BAUPOTENZIAL_PARAMETERS);

/** Ausnützungsziffer-/Geschossflächenziffer-Methode. */
export function theoreticalGfaM2(parcelAreaM2: number, densityRatio: number): number {
  return parcelAreaM2 * densityRatio;
}

/** Baumassenziffer-Methode. */
export function allowedVolumeM3(parcelAreaM2: number, volumeRatio: number): number {
  return parcelAreaM2 * volumeRatio;
}

export function estimatedGfaFromVolumeM2(allowedVolume: number, averageFloorHeightM: number): number {
  if (averageFloorHeightM <= 0) throw new Error("averageFloorHeightM muss > 0 sein");
  return allowedVolume / averageFloorHeightM;
}

/** Überbauungsziffer × Geschosse. */
export function footprintM2(parcelAreaM2: number, siteCoverageRatio: number): number {
  return parcelAreaM2 * siteCoverageRatio;
}

export function estimatedGfaFromCoverageM2(footprint: number, effectiveFloors: number): number {
  return footprint * effectiveFloors;
}

export function estimatedNraM2(estimatedGfa: number, netEfficiencyRatio: number): number {
  return estimatedGfa * netEfficiencyRatio;
}

/**
 * Wendet die vier Korrekturfaktoren aus `BAUPOTENZIAL_PARAMETERS` auf die geschätzte
 * NRA an. Alle Faktoren sind sichtbar und editierbar (Abschnitt 9) — Default 1.0 bzw.
 * 0.95 bedeutet "keine bzw. geringe Korrektur", niemals stillschweigend 0.
 */
export function adjustedNraM2(
  estimatedNra: number,
  factors: Pick<BaupotenzialFactors, "geometryFactor" | "setbackFactor" | "topographyFactor" | "accessFactor">,
): number {
  return estimatedNra * factors.geometryFactor * factors.setbackFactor * factors.topographyFactor * factors.accessFactor;
}

export type BaupotenzialMethod = "DENSITY_RATIO" | "VOLUME_RATIO" | "COVERAGE_RATIO";

export interface BaupotenzialInput {
  method: BaupotenzialMethod;
  parcelAreaM2: number;
  /** Für DENSITY_RATIO: Ausnützungsziffer. */
  densityRatio?: number;
  /** Für VOLUME_RATIO: Baumassenziffer (m³/m²). */
  volumeRatio?: number;
  /** Für COVERAGE_RATIO: Überbauungsziffer und Geschosszahl. */
  siteCoverageRatio?: number;
  effectiveFloors?: number;
  factors: BaupotenzialFactors;
}

export interface BaupotenzialResult {
  method: BaupotenzialMethod;
  estimatedGfaM2: number;
  estimatedNraM2: number;
  adjustedNraM2: number;
}

/** Führt die gewählte Methode komplett aus, bis zur korrigierten NRA. */
export function estimateBaupotenzial(input: BaupotenzialInput): BaupotenzialResult {
  let estimatedGfa: number;

  switch (input.method) {
    case "DENSITY_RATIO": {
      if (input.densityRatio === undefined) throw new Error("densityRatio erforderlich für Methode DENSITY_RATIO");
      estimatedGfa = theoreticalGfaM2(input.parcelAreaM2, input.densityRatio);
      break;
    }
    case "VOLUME_RATIO": {
      if (input.volumeRatio === undefined) throw new Error("volumeRatio erforderlich für Methode VOLUME_RATIO");
      const volume = allowedVolumeM3(input.parcelAreaM2, input.volumeRatio);
      estimatedGfa = estimatedGfaFromVolumeM2(volume, input.factors.averageFloorHeightM);
      break;
    }
    case "COVERAGE_RATIO": {
      if (input.siteCoverageRatio === undefined || input.effectiveFloors === undefined) {
        throw new Error("siteCoverageRatio und effectiveFloors erforderlich für Methode COVERAGE_RATIO");
      }
      const footprint = footprintM2(input.parcelAreaM2, input.siteCoverageRatio);
      estimatedGfa = estimatedGfaFromCoverageM2(footprint, input.effectiveFloors);
      break;
    }
  }

  const nra = estimatedNraM2(estimatedGfa, input.factors.netEfficiencyRatio);
  const adjusted = adjustedNraM2(nra, input.factors);

  return {
    method: input.method,
    estimatedGfaM2: estimatedGfa,
    estimatedNraM2: nra,
    adjustedNraM2: adjusted,
  };
}
