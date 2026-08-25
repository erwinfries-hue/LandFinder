import { describe, it, expect } from "vitest";
import { estimateQuantilePosition, findClosestQuantileRow } from "./regionMarketData";
import type { RegionQuantileRow } from "./regionExtraction";

const row: RegionQuantileRow = { zimmerzahl: 4, q10: 187, q30: 212, q50: 239, q70: 266, q90: 301 };

describe("estimateQuantilePosition", () => {
  it("interpoliert linear innerhalb eines Quantil-Intervalls", () => {
    // Genau die Mitte zwischen q30 (212) und q50 (239) -> Mitte zwischen 30% und 50% = 40%
    const midpoint = (212 + 239) / 2;
    const result = estimateQuantilePosition(midpoint, row);
    expect(result.kind).toBe("interpolated");
    if (result.kind === "interpolated") expect(result.percent).toBeCloseTo(40, 5);
  });

  it("liefert exakt den Quantil-Prozentsatz an einem Stützpunkt", () => {
    const result = estimateQuantilePosition(239, row); // = q50
    expect(result.kind).toBe("interpolated");
    if (result.kind === "interpolated") expect(result.percent).toBeCloseTo(50, 5);
  });

  it("kennzeichnet Werte unter dem 10%-Quantil statt zu extrapolieren", () => {
    expect(estimateQuantilePosition(100, row)).toEqual({ kind: "below", boundaryPercent: 10 });
  });

  it("kennzeichnet Werte über dem 90%-Quantil statt zu extrapolieren", () => {
    expect(estimateQuantilePosition(400, row)).toEqual({ kind: "above", boundaryPercent: 90 });
  });

  it("behandelt den q10-Randwert selbst als 'below' (nicht interpoliert)", () => {
    expect(estimateQuantilePosition(187, row)).toEqual({ kind: "below", boundaryPercent: 10 });
  });

  it("behandelt den q90-Randwert selbst als 'above' (nicht interpoliert)", () => {
    expect(estimateQuantilePosition(301, row)).toEqual({ kind: "above", boundaryPercent: 90 });
  });
});

describe("findClosestQuantileRow", () => {
  const rows: RegionQuantileRow[] = [
    { zimmerzahl: 1, q10: 850, q30: 950, q50: 1090, q70: 1210, q90: 1370 },
    { zimmerzahl: 3, q10: 1350, q30: 1520, q50: 1720, q70: 1920, q90: 2170 },
    { zimmerzahl: 4, q10: 1640, q30: 1860, q50: 2090, q70: 2330, q90: 2630 },
  ];

  it("findet die exakte Zimmerzahl", () => {
    expect(findClosestQuantileRow(rows, 4)?.zimmerzahl).toBe(4);
  });

  it("findet die nächstgelegene Zimmerzahl, wenn keine exakte Übereinstimmung existiert", () => {
    expect(findClosestQuantileRow(rows, 3.5)?.zimmerzahl).toBe(3); // 3 und 4 gleich nah -> erste gefundene (3) gewinnt
  });

  it("liefert undefined bei leerer Liste", () => {
    expect(findClosestQuantileRow([], 4)).toBeUndefined();
  });
});
