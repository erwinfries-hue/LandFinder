import { describe, it, expect } from "vitest";
import { scoreBaupotenzial } from "./baupotenzial";

describe("scoreBaupotenzial (Abschnitt 15, max. 25 Punkte)", () => {
  it("rechnet alle fünf Teilkategorien korrekt (Default-Parameter)", () => {
    const result = scoreBaupotenzial({
      zoneVerification: "A",
      overallVerification: "B",
      achievedNraM2: 900,
      targetMinNraM2: 800,
      targetMaxNraM2: 1000,
      formTopografieFactor: 0.85, // Band 0.7-1.0 -> Mitte
      erschliessungOk: true,
      zufahrtOk: true,
    });

    expect(result.zone).toBe(6); // Stufe A = volle Punktzahl
    expect(result.projektgroesse).toBe(8); // innerhalb Zielbereich
    expect(result.formTopografie).toBeCloseTo(2, 6);
    expect(result.erschliessungZufahrt).toBe(4);
    expect(result.verifikation).toBeCloseTo(3 * 0.65, 6); // Stufe B
    expect(result.total).toBeCloseTo(6 + 8 + 2 + 4 + 3 * 0.65, 6);
  });

  it("reduziert Projektgrösse-Punkte ausserhalb des Zielbereichs über die Toleranzbreite", () => {
    const result = scoreBaupotenzial({
      zoneVerification: "C",
      overallVerification: "C",
      achievedNraM2: 650, // 150 unter min (800), Toleranz 300 -> Mitte der Abfallzone
      targetMinNraM2: 800,
      targetMaxNraM2: 1000,
      formTopografieFactor: 1.0,
      erschliessungOk: false,
      zufahrtOk: true,
    });
    expect(result.projektgroesse).toBeCloseTo(4, 6);
    expect(result.erschliessungZufahrt).toBeCloseTo(4 * 0.5, 6);
  });

  it("vergibt die volle Projektgrösse-Punktzahl ohne definierten Zielbereich", () => {
    const result = scoreBaupotenzial({
      zoneVerification: "A",
      overallVerification: "A",
      achievedNraM2: 1234,
      formTopografieFactor: 1.0,
      erschliessungOk: true,
      zufahrtOk: true,
    });
    expect(result.projektgroesse).toBe(8);
  });
});
