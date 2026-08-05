import { describe, it, expect } from "vitest";
import { calculateConfidence, type ConfidenceInput } from "./datenvertrauen";
import type { DataPoint } from "@landfinder/domain";

function dp(confidence: number): DataPoint<number> {
  return { value: 1, source: "OFFICIAL_AUTOMATED", fetchedAt: "2026-01-01", confidence, verified: true };
}

describe("calculateConfidence (Abschnitt 16, Gesamt 100)", () => {
  it("rechnet den gewichteten Durchschnitt pro Kategorie", () => {
    const input: ConfidenceInput = {
      adresseParzelle: [dp(80), dp(60)], // Ø 70, Gewicht 15
      zoneBauparameter: [dp(90)], // Gewicht 25
      risikenOereb: [],
      mietdaten: [dp(50), dp(50)], // Gewicht 15
      baukosten: [dp(40)], // Gewicht 15
      inseratsvollstaendigkeit: [dp(100)], // Gewicht 10
      finanzierung: [dp(20)], // Gewicht 5
    };
    const result = calculateConfidence(input);

    expect(result.adresseParzelle).toBeCloseTo(15 * 0.7, 6);
    expect(result.zoneBauparameter).toBeCloseTo(25 * 0.9, 6);
    expect(result.risikenOereb).toBe(0); // keine Datenpunkte -> kein Vertrauen
    expect(result.mietdaten).toBeCloseTo(15 * 0.5, 6);
    expect(result.baukosten).toBeCloseTo(15 * 0.4, 6);
    expect(result.inseratsvollstaendigkeit).toBe(10);
    expect(result.finanzierung).toBeCloseTo(5 * 0.2, 6);

    const expectedTotal =
      result.adresseParzelle +
      result.zoneBauparameter +
      result.risikenOereb +
      result.mietdaten +
      result.baukosten +
      result.inseratsvollstaendigkeit +
      result.finanzierung;
    expect(result.total).toBeCloseTo(expectedTotal, 6);
  });

  it("ohne jegliche Datenpunkte ist das Gesamtvertrauen 0", () => {
    const empty: ConfidenceInput = {
      adresseParzelle: [],
      zoneBauparameter: [],
      risikenOereb: [],
      mietdaten: [],
      baukosten: [],
      inseratsvollstaendigkeit: [],
      finanzierung: [],
    };
    expect(calculateConfidence(empty).total).toBe(0);
  });

  it("mit voller Konfidenz überall ist das Gesamtvertrauen 100", () => {
    const full: ConfidenceInput = {
      adresseParzelle: [dp(100)],
      zoneBauparameter: [dp(100)],
      risikenOereb: [dp(100)],
      mietdaten: [dp(100)],
      baukosten: [dp(100)],
      inseratsvollstaendigkeit: [dp(100)],
      finanzierung: [dp(100)],
    };
    expect(calculateConfidence(full).total).toBeCloseTo(100, 6);
  });
});
