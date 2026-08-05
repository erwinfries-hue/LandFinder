import { describe, it, expect } from "vitest";
import {
  theoreticalGfaM2,
  allowedVolumeM3,
  estimatedGfaFromVolumeM2,
  footprintM2,
  estimatedGfaFromCoverageM2,
  estimatedNraM2,
  adjustedNraM2,
  estimateBaupotenzial,
  DEFAULT_BAUPOTENZIAL_FACTORS,
} from "./baupotenzial";

describe("Baupotenzial-Formeln (Abschnitt 9)", () => {
  it("theoreticalGfaM2 = parcel_area * density_ratio", () => {
    expect(theoreticalGfaM2(1000, 0.6)).toBe(600);
  });

  it("allowedVolumeM3 = parcel_area * volume_ratio", () => {
    expect(allowedVolumeM3(1000, 2.5)).toBe(2500);
  });

  it("estimatedGfaFromVolumeM2 = volume / floor_height", () => {
    expect(estimatedGfaFromVolumeM2(2500, 3)).toBeCloseTo(833.333, 2);
  });

  it("estimatedGfaFromVolumeM2 wirft bei Geschosshöhe 0", () => {
    expect(() => estimatedGfaFromVolumeM2(2500, 0)).toThrow();
  });

  it("footprintM2 = parcel_area * site_coverage_ratio", () => {
    expect(footprintM2(1000, 0.3)).toBe(300);
  });

  it("estimatedGfaFromCoverageM2 = footprint * effective_floors", () => {
    expect(estimatedGfaFromCoverageM2(300, 3)).toBe(900);
  });

  it("estimatedNraM2 = gfa * net_efficiency_ratio", () => {
    expect(estimatedNraM2(900, 0.82)).toBe(738);
  });

  it("adjustedNraM2 wendet alle vier Korrekturfaktoren multiplikativ an", () => {
    const result = adjustedNraM2(738, {
      geometryFactor: 0.95,
      setbackFactor: 0.95,
      topographyFactor: 1,
      accessFactor: 1,
    });
    expect(result).toBeCloseTo(738 * 0.9025, 4);
  });

  it("adjustedNraM2 mit Faktoren = 1 verändert die Fläche nicht", () => {
    expect(adjustedNraM2(500, { geometryFactor: 1, setbackFactor: 1, topographyFactor: 1, accessFactor: 1 })).toBe(500);
  });

  describe("estimateBaupotenzial — DENSITY_RATIO-Methode", () => {
    it("rechnet die vollständige Kette (Parzelle Cham-Demo: 1'860 m², Ausnützung 0.6)", () => {
      const result = estimateBaupotenzial({
        method: "DENSITY_RATIO",
        parcelAreaM2: 1860,
        densityRatio: 0.6,
        factors: DEFAULT_BAUPOTENZIAL_FACTORS,
      });
      expect(result.estimatedGfaM2).toBe(1116);
      expect(result.estimatedNraM2).toBeCloseTo(1116 * 0.82, 4);
      expect(result.adjustedNraM2).toBeCloseTo(1116 * 0.82 * 0.9025, 4);
    });

    it("wirft ohne densityRatio", () => {
      expect(() =>
        estimateBaupotenzial({ method: "DENSITY_RATIO", parcelAreaM2: 1000, factors: DEFAULT_BAUPOTENZIAL_FACTORS }),
      ).toThrow();
    });
  });

  describe("estimateBaupotenzial — VOLUME_RATIO-Methode", () => {
    it("rechnet über Baumassenziffer und Geschosshöhe", () => {
      const result = estimateBaupotenzial({
        method: "VOLUME_RATIO",
        parcelAreaM2: 1000,
        volumeRatio: 2.5,
        factors: DEFAULT_BAUPOTENZIAL_FACTORS,
      });
      expect(result.estimatedGfaM2).toBeCloseTo(2500 / 3, 4);
    });

    it("wirft ohne volumeRatio", () => {
      expect(() =>
        estimateBaupotenzial({ method: "VOLUME_RATIO", parcelAreaM2: 1000, factors: DEFAULT_BAUPOTENZIAL_FACTORS }),
      ).toThrow();
    });
  });

  describe("estimateBaupotenzial — COVERAGE_RATIO-Methode", () => {
    it("rechnet über Überbauungsziffer × Geschosse", () => {
      const result = estimateBaupotenzial({
        method: "COVERAGE_RATIO",
        parcelAreaM2: 1000,
        siteCoverageRatio: 0.3,
        effectiveFloors: 3,
        factors: DEFAULT_BAUPOTENZIAL_FACTORS,
      });
      expect(result.estimatedGfaM2).toBe(900);
    });

    it("wirft ohne siteCoverageRatio/effectiveFloors", () => {
      expect(() =>
        estimateBaupotenzial({ method: "COVERAGE_RATIO", parcelAreaM2: 1000, factors: DEFAULT_BAUPOTENZIAL_FACTORS }),
      ).toThrow();
    });
  });
});
