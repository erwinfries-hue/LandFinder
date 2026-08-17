import { describe, it, expect } from "vitest";
import {
  calculateFurnitureRoi,
  calculateRenovationRoi,
  moeblierungGeglaetteReserveChfPerJahr,
  moeblierungErsatzCashflowChf,
  summarizeRenovationPositionen,
} from "./bestandsrenditeValueAdd";

describe("calculateFurnitureRoi", () => {
  it("Beispiel aus der Rückmeldung: CHF 300/Monat Premium auf CHF 10'000 Investition = 36% ROI", () => {
    const result = calculateFurnitureRoi({ moeblierungInitialChf: 10_000, mietPremiumChfPerMonth: 300 });
    expect(result.zusaetzlicherJahresertragChf).toBe(3_600);
    expect(result.roiPercent).toBeCloseTo(36, 5);
    expect(result.paybackYears).toBeCloseTo(10_000 / 3_600, 5);
  });

  it("liefert payback undefined, wenn kein Mehrertrag entsteht", () => {
    const result = calculateFurnitureRoi({ moeblierungInitialChf: 10_000, mietPremiumChfPerMonth: 0 });
    expect(result.paybackYears).toBeUndefined();
    expect(result.roiPercent).toBe(0);
  });
});

describe("calculateRenovationRoi", () => {
  it("Beispiel aus der Rückmeldung: CHF 150/Monat Mehrertrag auf CHF 25'000 Renovation ≈ 7.2% ROI, ≈13.9 Jahre Payback", () => {
    const result = calculateRenovationRoi({ renovationCostChf: 25_000, mieteVorherChfPerMonth: 1_350, mieteNachherChfPerMonth: 1_500 });
    expect(result.zusaetzlicherJahresertragChf).toBe(1_800);
    expect(result.roiPercent).toBeCloseTo(7.2, 5);
    expect(result.paybackYears).toBeCloseTo(13.888, 2);
  });

  it("negativer oder gleicher Mietwert ergibt 0 ROI und undefined Payback", () => {
    const result = calculateRenovationRoi({ renovationCostChf: 10_000, mieteVorherChfPerMonth: 1_000, mieteNachherChfPerMonth: 1_000 });
    expect(result.roiPercent).toBe(0);
    expect(result.paybackYears).toBeUndefined();
  });
});

describe("moeblierungGeglaetteReserveChfPerJahr", () => {
  it("Initialkosten × Ersatzquote / Nutzungsdauer", () => {
    expect(moeblierungGeglaetteReserveChfPerJahr({ initialCostChf: 10_000, nutzungsdauerJahre: 7, ersatzquotePercent: 70, kostensteigerungPercentPerYear: 1.5 })).toBeCloseTo(1_000, 5);
  });
});

describe("moeblierungErsatzCashflowChf", () => {
  const input = { initialCostChf: 10_000, nutzungsdauerJahre: 7, ersatzquotePercent: 70, kostensteigerungPercentPerYear: 1.5 };

  it("liefert 0 in Jahren ohne fälligen Ersatz", () => {
    expect(moeblierungErsatzCashflowChf(input, 1)).toBe(0);
    expect(moeblierungErsatzCashflowChf(input, 6)).toBe(0);
  });

  it("liefert den inflationierten Ersatzbetrag im Ersatzjahr (Vielfaches der Nutzungsdauer)", () => {
    const cashflowJahr7 = moeblierungErsatzCashflowChf(input, 7);
    expect(cashflowJahr7).toBeCloseTo(10_000 * 0.7 * Math.pow(1.015, 7), 2);
    const cashflowJahr14 = moeblierungErsatzCashflowChf(input, 14);
    expect(cashflowJahr14).toBeGreaterThan(cashflowJahr7); // spätere Ersatzinvestition ist teurer (Kostensteigerung)
  });
});

describe("summarizeRenovationPositionen", () => {
  it("summiert Positionen total und je Kategorie", () => {
    const result = summarizeRenovationPositionen([
      { betragChf: 5_000, kategorie: "WERTERHALTEND", jahr: 2026, steuerlicheAbzugsfaehigkeit: "JA" },
      { betragChf: 15_000, kategorie: "WERTVERMEHREND", jahr: 2026, steuerlicheAbzugsfaehigkeit: "NEIN" },
      { betragChf: 8_000, kategorie: "ENERGETISCH", jahr: 2026, steuerlicheAbzugsfaehigkeit: "UNKLAR" },
      { betragChf: 2_000, kategorie: "WERTERHALTEND", jahr: 2027, steuerlicheAbzugsfaehigkeit: "JA" },
    ]);
    expect(result.totalChf).toBe(30_000);
    expect(result.totalByKategorie).toEqual({ WERTERHALTEND: 7_000, WERTVERMEHREND: 15_000, ENERGETISCH: 8_000 });
  });

  it("liefert 0-Summen für eine leere Liste", () => {
    const result = summarizeRenovationPositionen([]);
    expect(result.totalChf).toBe(0);
    expect(result.totalByKategorie).toEqual({ WERTERHALTEND: 0, WERTVERMEHREND: 0, ENERGETISCH: 0 });
  });
});
