import { describe, it, expect } from "vitest";
import {
  calculateNebenkosten,
  calculateRenovation,
  calculateMoeblierung,
  calculateGesamtinvestition,
  estimateAnnualPotentialRentChf,
  calculateRendite,
  runBestandsrenditeScenario,
} from "./bestandsrendite";

describe("calculateNebenkosten", () => {
  it("summiert Handänderungssteuer, Notariat/Grundbuch und Maklerprovision als Prozentsätze des Kaufpreises", () => {
    const result = calculateNebenkosten({
      kaufpreisChf: 1_000_000,
      handaenderungssteuerPercent: 2,
      notariatGrundbuchPercent: 0.5,
      maklerprovisionPercent: 3,
    });
    expect(result).toEqual({
      handaenderungssteuerChf: 20_000,
      notariatGrundbuchChf: 5_000,
      maklerprovisionChf: 30_000,
      totalNebenkostenChf: 55_000,
    });
  });

  it("liefert 0, wenn alle Prozentsätze 0 sind", () => {
    const result = calculateNebenkosten({ kaufpreisChf: 500_000, handaenderungssteuerPercent: 0, notariatGrundbuchPercent: 0, maklerprovisionPercent: 0 });
    expect(result.totalNebenkostenChf).toBe(0);
  });
});

describe("calculateRenovation", () => {
  it("übernimmt die Initial-Renovationskosten unverändert (direkt eingegeben, nicht aus Fläche×Satz berechnet)", () => {
    const result = calculateRenovation({ initialRenovationCostChf: 45_000, kaufpreisChf: 900_000, jaehrlicherRenovationssatzPercent: 1 });
    expect(result.initialRenovationCostChf).toBe(45_000);
  });

  it("berechnet die laufende Renovationsrückstellung als % des Kaufpreises, nicht der Initialkosten", () => {
    const result = calculateRenovation({ initialRenovationCostChf: 45_000, kaufpreisChf: 900_000, jaehrlicherRenovationssatzPercent: 1 });
    expect(result.jaehrlicheRenovationsrueckstellungChf).toBe(9_000); // 1% von 900'000, nicht von 45'000
  });

  it("liefert 0 Initialkosten für ein bereits saniertes Objekt, laufende Rückstellung bleibt trotzdem möglich", () => {
    const result = calculateRenovation({ initialRenovationCostChf: 0, kaufpreisChf: 900_000, jaehrlicherRenovationssatzPercent: 1 });
    expect(result.initialRenovationCostChf).toBe(0);
    expect(result.jaehrlicheRenovationsrueckstellungChf).toBe(9_000);
  });
});

describe("calculateMoeblierung", () => {
  it("berechnet die jährlichen Ersatzkosten als % der Möblierungs-Initialkosten", () => {
    const result = calculateMoeblierung({ initialCostChf: 25_000, jaehrlicherErsatzsatzPercent: 14 });
    expect(result.initialCostChf).toBe(25_000);
    expect(result.jaehrlicheErsatzkostenChf).toBeCloseTo(3_500, 5);
  });

  it("liefert 0/0 für eine unmöblierte Vermietung (initialCostChf = 0) — kein separater Vermietungsart-Zweig nötig", () => {
    const result = calculateMoeblierung({ initialCostChf: 0, jaehrlicherErsatzsatzPercent: 14 });
    expect(result).toEqual({ initialCostChf: 0, jaehrlicheErsatzkostenChf: 0 });
  });
});

describe("calculateGesamtinvestition", () => {
  it("summiert Kaufpreis, Nebenkosten, Initial-Renovation und Initial-Möblierung", () => {
    const nebenkosten = calculateNebenkosten({ kaufpreisChf: 800_000, handaenderungssteuerPercent: 2, notariatGrundbuchPercent: 0.5, maklerprovisionPercent: 0 });
    const renovation = calculateRenovation({ initialRenovationCostChf: 40_000, kaufpreisChf: 800_000, jaehrlicherRenovationssatzPercent: 1 });
    const moeblierung = calculateMoeblierung({ initialCostChf: 20_000, jaehrlicherErsatzsatzPercent: 14 });
    expect(calculateGesamtinvestition({ kaufpreisChf: 800_000, nebenkosten, renovation, moeblierung })).toBe(800_000 + 20_000 + 40_000 + 20_000);
  });
});

describe("estimateAnnualPotentialRentChf", () => {
  it("Wohnfläche × CHF/m²/Monat × 12 — dieselbe Formel für möbliert wie unmöbliert (Modellentscheid: unmöbliert ist die Basis)", () => {
    expect(estimateAnnualPotentialRentChf({ wohnflaecheM2: 80, netRentChfPerM2Month: 25 })).toBe(24_000);
    // Eine höhere Business-Apartment-Miete ist einfach ein höherer eingegebener CHF/m²/Monat-Wert, keine eigene Formel.
    expect(estimateAnnualPotentialRentChf({ wohnflaecheM2: 80, netRentChfPerM2Month: 45 })).toBe(43_200);
  });
});

describe("calculateRendite", () => {
  it("Brutto = Jahresmiete / Investition, Netto = NOI / Investition — beide immer gemeinsam ausgewiesen", () => {
    const result = calculateRendite(30_000, 22_000, 1_000_000);
    expect(result.bruttoRenditePercent).toBeCloseTo(3.0, 5);
    expect(result.nettoRenditePercent).toBeCloseTo(2.2, 5);
  });

  it("liefert 0/0 statt Division durch 0 bei einer Investition von 0", () => {
    expect(calculateRendite(10_000, 5_000, 0)).toEqual({ bruttoRenditePercent: 0, nettoRenditePercent: 0 });
  });
});

describe("runBestandsrenditeScenario", () => {
  const baseInput = {
    kaufpreisChf: 900_000,
    nebenkosten: { handaenderungssteuerPercent: 2, notariatGrundbuchPercent: 0.5, maklerprovisionPercent: 0 },
    renovation: { initialRenovationCostChf: 0, jaehrlicherRenovationssatzPercent: 1 },
    moeblierung: { initialCostChf: 0, jaehrlicherErsatzsatzPercent: 14 },
    vacancyRatePercent: 3,
    collectionLossRatePercent: 1,
    operatingExpenseRatioPercent: 15,
    fixedNonRecoverableCostsChfPerYear: 0,
    annualCapexReserveChfPerYear: 2_000,
    loanToCostPercent: 70,
    interestRatePercent: 2.5,
    amortizationChfPerYear: 5_000,
  };

  it("rechnet eine unmöblierte Langfristvermietung ohne Renovationsbedarf Ende-zu-Ende durch, mit Brutto- und Nettorendite", () => {
    const result = runBestandsrenditeScenario({ ...baseInput, miete: { wohnflaecheM2: 70, netRentChfPerM2Month: 22 } });

    expect(result.nebenkosten.totalNebenkostenChf).toBeCloseTo(900_000 * 0.025, 5);
    expect(result.renovation.initialRenovationCostChf).toBe(0);
    expect(result.moeblierung.initialCostChf).toBe(0);
    expect(result.totalInvestmentChf).toBeCloseTo(900_000 + 900_000 * 0.025, 5);
    expect(result.ertrag.annualPotentialRentChf).toBeCloseTo(70 * 22 * 12, 5);
    expect(result.finanzierung.equityRequiredChf).toBeCloseTo(result.totalInvestmentChf * 0.3, 5);
    expect(result.rendite.bruttoRenditePercent).toBeGreaterThan(0);
    expect(result.rendite.nettoRenditePercent).toBeLessThan(result.rendite.bruttoRenditePercent);
  });

  it("rechnet ein möbliertes Business-Apartment mit Renovationsbedarf Ende-zu-Ende durch — Initialkosten fliessen in die Investition, laufende Sätze in die Betriebskosten", () => {
    const withExtras = runBestandsrenditeScenario({
      ...baseInput,
      renovation: { initialRenovationCostChf: 45_000, jaehrlicherRenovationssatzPercent: 1 },
      moeblierung: { initialCostChf: 25_000, jaehrlicherErsatzsatzPercent: 14 },
      miete: { wohnflaecheM2: 70, netRentChfPerM2Month: 45 },
    });
    const withoutExtras = runBestandsrenditeScenario({
      ...baseInput,
      renovation: { initialRenovationCostChf: 0, jaehrlicherRenovationssatzPercent: 1 },
      moeblierung: { initialCostChf: 0, jaehrlicherErsatzsatzPercent: 14 },
      miete: { wohnflaecheM2: 70, netRentChfPerM2Month: 45 },
    });

    expect(withExtras.totalInvestmentChf).toBeCloseTo(withoutExtras.totalInvestmentChf + 45_000 + 25_000, 5);
    // Die laufende Renovationsrückstellung hängt nur vom Kaufpreis × Satz ab (hier in
    // beiden Szenarien identisch: 900'000 × 1% = 9'000) — nicht davon, ob eine
    // Initial-Renovation stattfand. Nur die Möblierungs-Ersatzkosten unterscheiden sich
    // hier (0 vs. 25'000 × 14% = 3'500), da nur initialCostChf variiert wurde.
    expect(withExtras.ertrag.noiChf).toBeLessThan(withoutExtras.ertrag.noiChf);
    expect(withExtras.ertrag.operatingCostsChf - withoutExtras.ertrag.operatingCostsChf).toBeCloseTo(3_500, 2);
  });

  it("höherer Fremdkapitalanteil senkt den Eigenkapitalbedarf, wie bei calculateFinanzierung erwartet", () => {
    const lowLtc = runBestandsrenditeScenario({ ...baseInput, loanToCostPercent: 50, miete: { wohnflaecheM2: 70, netRentChfPerM2Month: 22 } });
    const highLtc = runBestandsrenditeScenario({ ...baseInput, loanToCostPercent: 80, miete: { wohnflaecheM2: 70, netRentChfPerM2Month: 22 } });
    expect(highLtc.finanzierung.equityRequiredChf).toBeLessThan(lowLtc.finanzierung.equityRequiredChf);
  });
});
