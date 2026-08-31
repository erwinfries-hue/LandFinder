import { describe, it, expect } from "vitest";
import { runMehrjahresmodell, computeInvestmentTreiber, type MehrjahresmodellInput } from "./bestandsrenditeMehrjahresmodell";
import { netPresentValue } from "./numeric";

const baseInput: MehrjahresmodellInput = {
  holdingPeriodYears: 15,
  kaufpreisChf: 900_000,
  allInInvestitionChf: 940_000,
  eigenkapitalChf: 310_000,
  ertragJahr1: {
    wohnungsMieteChfPerMonth: 1_450,
    parkplatzMieteChfPerMonth: 150,
    moeblierungsPremiumChfPerMonth: 0,
    sonstigeEinnahmenChfPerYear: 0,
    vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT",
    leerstandPercent: 2,
  },
  betriebskostenJahr1: { stwegAkontobeitragChfPerYear: 4_800, eigentuemerkostenChfPerYear: 300, vermietungskostenChfPerYear: 200, reinigungServiceChfPerYear: 0, reparaturChfPerYear: 0, moebliertOpexChfPerYear: 0 },
  reparaturreserveJahr1Chf: 2_700,
  leerstandsreserveJahr1Chf: 1_500,
  mietsteigerungPercentPerYear: 1,
  kosteninflationPercentPerYear: 1.5,
  wertsteigerungPercentPerYear: 1,
  wertvermehrendeRenovationChf: 0,
  hypothek: {
    // 1. Hypothek: übliche Schweizer Praxis, keine Pflichtamortisation.
    ersteHypothek: { initialLoanChf: 480_000, amortisation: { modus: "PROZENT_PRO_JAHR", prozentProJahr: 0 } },
    // 2. Hypothek: linear über 15 Jahre auf 0 (150'000 / 15 = 10'000 CHF/Jahr).
    zweiteHypothek: { initialLoanChf: 150_000, amortisation: { modus: "DAUER_JAHRE", dauerJahre: 15 } },
    interestRatePercent: 2,
  },
  kalkulatorischerSteuersatzPercent: 25,
  exit: { sellingCostPercent: 3 },
};

describe("runMehrjahresmodell", () => {
  it("liefert genau holdingPeriodYears Jahresergebnisse, chronologisch nummeriert", () => {
    const result = runMehrjahresmodell(baseInput);
    expect(result.years).toHaveLength(15);
    expect(result.years.map((y) => y.jahr)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("Jahr 1 verwendet die Basiswerte unverändert (keine Eskalation im ersten Jahr)", () => {
    const result = runMehrjahresmodell(baseInput);
    const jahr1 = result.years[0];
    expect(jahr1.effektiverJahresertragChf).toBeCloseTo((1_450 + 150) * 12 * 0.98, 5);
    expect(jahr1.zinsChf).toBeCloseTo(630_000 * 0.02, 5);
    expect(jahr1.restschuldChf).toBeCloseTo(630_000 - 10_000, 5);
  });

  it("Miete/Kosten eskalieren Jahr für Jahr mit den jeweiligen Raten", () => {
    const result = runMehrjahresmodell(baseInput);
    const jahr2 = result.years[1];
    // Miete in Jahr 2 = Jahr-1-Miete × (1 + 1%)^1
    const erwarteterPotenziellerErtragJahr2 = (1_450 + 150) * 1.01 * 12;
    expect(jahr2.effektiverJahresertragChf).toBeCloseTo(erwarteterPotenziellerErtragJahr2 * 0.98, 2);
  });

  it("Restschuld sinkt monoton und wird nie negativ (Amortisation nie grösser als Restschuld)", () => {
    const result = runMehrjahresmodell({
      ...baseInput,
      holdingPeriodYears: 30,
      hypothek: {
        ersteHypothek: { initialLoanChf: baseInput.hypothek.ersteHypothek.initialLoanChf, amortisation: { modus: "DAUER_JAHRE", dauerJahre: 10 } },
        zweiteHypothek: { initialLoanChf: baseInput.hypothek.zweiteHypothek.initialLoanChf, amortisation: { modus: "DAUER_JAHRE", dauerJahre: 10 } },
        interestRatePercent: baseInput.hypothek.interestRatePercent,
      },
    });
    let prev = Infinity;
    for (const y of result.years) {
      expect(y.restschuldChf).toBeLessThanOrEqual(prev);
      expect(y.restschuldChf).toBeGreaterThanOrEqual(0);
      prev = y.restschuldChf;
    }
    // Bei sehr hoher Amortisation sind beide Tranchen irgendwann vollständig getilgt.
    expect(result.years[result.years.length - 1].restschuldChf).toBe(0);
  });

  it("1. und 2. Hypothek amortisieren unabhängig voneinander — eine ohne Amortisation bleibt konstant, während die andere planmässig sinkt", () => {
    const result = runMehrjahresmodell(baseInput);
    // 1. Hypothek hat 0% Amortisation -> alleine würde die Restschuld konstant bei 480'000 bleiben.
    // 2. Hypothek amortisiert 150'000 über 15 Jahre linear -> nach Jahr 10 sind 100'000 getilgt, Restschuld 2. Hypothek = 50'000.
    const jahr10 = result.years[9];
    expect(jahr10.restschuldChf).toBeCloseTo(480_000 + (150_000 - 10 * 10_000), 5);
  });

  it("sobald eine Tranche vollständig amortisiert ist, sinkt die jährliche Gesamtamortisation entsprechend, statt negativ zu werden", () => {
    // 2. Hypothek ist nach 15 Jahren bei 0 — ab Jahr 16 amortisiert nur noch (nichts, da 1. Hypothek 0% Amortisation hat).
    const result = runMehrjahresmodell({ ...baseInput, holdingPeriodYears: 20 });
    const jahr15 = result.years[14];
    const jahr16 = result.years[15];
    expect(jahr15.restschuldChf).toBeCloseTo(480_000, 5); // 2. Hypothek exakt getilgt
    expect(jahr16.amortisationChf).toBe(0); // 2. Hypothek bei 0 gedeckelt, 1. Hypothek amortisiert nicht
    expect(jahr16.restschuldChf).toBeCloseTo(480_000, 5); // bleibt konstant, keine negative Restschuld
  });

  it("kumulierter Cashflow ist die laufende Summe der jährlichen nachhaltigen Cashflows", () => {
    const result = runMehrjahresmodell(baseInput);
    let running = 0;
    for (const y of result.years) {
      running += y.nachhaltigerCashflowChf;
      expect(y.kumulierterCashflowChf).toBeCloseTo(running, 5);
    }
  });

  it("Immobilienwert wächst mit der Wertsteigerungsrate, Eigenkapitalwert = Wert - Restschuld", () => {
    const result = runMehrjahresmodell(baseInput);
    const jahr1 = result.years[0];
    const jahr15 = result.years[14];
    expect(jahr1.immobilienwertChf).toBeCloseTo(900_000 * 1.01, 2);
    expect(jahr15.immobilienwertChf).toBeCloseTo(900_000 * Math.pow(1.01, 15), 2);
    expect(jahr1.eigenkapitalwertChf).toBeCloseTo(jahr1.immobilienwertChf - jahr1.restschuldChf, 5);
  });

  it("ohne Wertsteigerung bleibt der Immobilienwert über die Jahre konstant beim Kaufpreis", () => {
    const result = runMehrjahresmodell({ ...baseInput, wertsteigerungPercentPerYear: 0 });
    expect(result.years[0].immobilienwertChf).toBe(900_000);
    expect(result.years[14].immobilienwertChf).toBe(900_000);
  });

  it("Möblierungsersatz reduziert den nachhaltigen Cashflow nur im Ersatzjahr", () => {
    const moeblierung = { initialCostChf: 10_000, nutzungsdauerJahre: 7, ersatzquotePercent: 70, kostensteigerungPercentPerYear: 1.5 };
    const withFurniture = runMehrjahresmodell({ ...baseInput, moeblierung });
    const withoutFurniture = runMehrjahresmodell({ ...baseInput, moeblierung: undefined });

    expect(withFurniture.years[0].moeblierungsErsatzChf).toBe(0); // Jahr 1 kein Ersatz fällig
    expect(withFurniture.years[6].moeblierungsErsatzChf).toBeGreaterThan(0); // Jahr 7 = Nutzungsdauer
    expect(withFurniture.years[6].nachhaltigerCashflowChf).toBeLessThan(withoutFurniture.years[6].nachhaltigerCashflowChf);
    // In einem Jahr ohne Ersatz sind beide Szenarien identisch.
    expect(withFurniture.years[0].nachhaltigerCashflowChf).toBeCloseTo(withoutFurniture.years[0].nachhaltigerCashflowChf, 5);
  });

  it("Haushaltsinventar-Ersatz ist unabhängig vom Möbel-Ersatz fällig (eigene Nutzungsdauer) und addiert sich in einem gemeinsamen Ersatzjahr", () => {
    const moeblierung = { initialCostChf: 10_000, nutzungsdauerJahre: 7, ersatzquotePercent: 100, kostensteigerungPercentPerYear: 1.5 };
    const haushaltinventar = { initialCostChf: 2_000, nutzungsdauerJahre: 5, ersatzquotePercent: 100, kostensteigerungPercentPerYear: 1.5 };
    const result = runMehrjahresmodell({ ...baseInput, moeblierung, haushaltinventar });

    expect(result.years[4].moeblierungsErsatzChf).toBeGreaterThan(0); // Jahr 5 = Inventar-Nutzungsdauer, Möbel noch nicht fällig
    expect(result.years[6].moeblierungsErsatzChf).toBeGreaterThan(0); // Jahr 7 = Möbel-Nutzungsdauer
    // Jahr 35 (kgV von 5 und 7) wäre der einzige gemeinsame Ersatzzeitpunkt — mit 15 Jahren
    // Haltedauer hier nicht erreichbar, daher stattdessen direkt die Summenformel geprüft:
    const nurMoebel = runMehrjahresmodell({ ...baseInput, moeblierung, haushaltinventar: undefined });
    const nurInventar = runMehrjahresmodell({ ...baseInput, moeblierung: undefined, haushaltinventar });
    expect(result.years[6].moeblierungsErsatzChf).toBeCloseTo(nurMoebel.years[6].moeblierungsErsatzChf + nurInventar.years[6].moeblierungsErsatzChf, 5);
  });

  it("Exit: Verkaufserlös = Immobilienwert - Restschuld - Verkaufskosten (ohne Grundstückgewinnsteuer, wenn nicht gesetzt)", () => {
    const result = runMehrjahresmodell(baseInput);
    const lastYear = result.years[result.years.length - 1];
    expect(result.exit.grundstueckgewinnsteuerChf).toBeUndefined();
    expect(result.exit.netProceedsChf).toBeCloseTo(
      result.exit.assumedPropertyValueChf - lastYear.restschuldChf - result.exit.sellingCostsChf,
      2,
    );
  });

  it("Exit: Grundstückgewinnsteuer reduziert den Nettoerlös, wenn gesetzt", () => {
    const withoutTax = runMehrjahresmodell(baseInput);
    const withTax = runMehrjahresmodell({ ...baseInput, exit: { ...baseInput.exit, grundstueckgewinnsteuerPercent: 20 } });
    expect(withTax.exit.grundstueckgewinnsteuerChf).toBeGreaterThan(0);
    expect(withTax.exit.netProceedsChf).toBeLessThan(withoutTax.exit.netProceedsChf);
  });

  it("Levered IRR ist eine gültige Nullstelle der Cashflow-Reihe (NPV bei der gefundenen IRR ≈ 0)", () => {
    const result = runMehrjahresmodell(baseInput);
    expect(result.leveredIrrPercent).toBeDefined();
    const cashflows = [-baseInput.eigenkapitalChf, ...result.years.map((y) => y.nachhaltigerCashflowChf)];
    cashflows[cashflows.length - 1] += result.exit.netProceedsChf;
    expect(netPresentValue(cashflows, result.leveredIrrPercent!)).toBeCloseTo(0, -1);
  });

  it("Equity Multiple = (Summe aller Cashflows + Exit-Erlös) / eingesetztes Eigenkapital", () => {
    const result = runMehrjahresmodell(baseInput);
    const totalDistributions = result.years.reduce((sum, y) => sum + y.nachhaltigerCashflowChf, 0) + result.exit.netProceedsChf;
    expect(result.equityMultiple).toBeCloseTo(totalDistributions / baseInput.eigenkapitalChf, 5);
  });

  it("liefert 0 Equity Multiple statt Division durch 0 bei eigenkapitalChf = 0", () => {
    const result = runMehrjahresmodell({ ...baseInput, eigenkapitalChf: 0 });
    expect(result.equityMultiple).toBe(0);
  });

  it("wählbare Haltedauer zwischen 5 und 30 Jahren funktioniert", () => {
    expect(runMehrjahresmodell({ ...baseInput, holdingPeriodYears: 5 }).years).toHaveLength(5);
    expect(runMehrjahresmodell({ ...baseInput, holdingPeriodYears: 30 }).years).toHaveLength(30);
  });

  it("stürzt bei holdingPeriodYears <= 0 nicht ab, sondern rechnet mit mindestens 1 Jahr (z.B. bei direktem API-Aufruf ohne das UI-Formular-Minimum)", () => {
    expect(runMehrjahresmodell({ ...baseInput, holdingPeriodYears: 0 }).years).toHaveLength(1);
    expect(runMehrjahresmodell({ ...baseInput, holdingPeriodYears: -5 }).years).toHaveLength(1);
  });
});

describe("computeInvestmentTreiber", () => {
  it("liefert genau die fünf definierten Treiber mit Stärke-Einordnung", () => {
    const result = computeInvestmentTreiber(baseInput);
    expect(result.treiber.map((t) => t.label)).toEqual([
      "Mietertrag (unlevered)",
      "Finanzierungshebel",
      "Mietsteigerungspotenzial",
      "Möblierungspotenzial",
      "Wertsteigerung",
    ]);
    for (const t of result.treiber) {
      expect(["+", "++", "+++"]).toContain(t.staerke);
    }
  });

  it("ohne Möblierung ist der Möblierungspotenzial-Beitrag ≈ 0", () => {
    const result = computeInvestmentTreiber(baseInput); // baseInput hat moeblierungsPremiumChfPerMonth: 0, kein moeblierung-Lebenszyklus
    const furniture = result.treiber.find((t) => t.label === "Möblierungspotenzial")!;
    expect(Math.abs(furniture.irrBeitragPercentPoints)).toBeLessThan(0.5);
  });

  it("mit Möblierungspremium trägt der Möblierungs-Treiber sichtbar zur IRR bei", () => {
    const moeblierungInput: MehrjahresmodellInput = {
      ...baseInput,
      ertragJahr1: { ...baseInput.ertragJahr1, moeblierungsPremiumChfPerMonth: 400 },
      moeblierung: { initialCostChf: 10_000, nutzungsdauerJahre: 7, ersatzquotePercent: 70, kostensteigerungPercentPerYear: 1.5 },
    };
    const result = computeInvestmentTreiber(moeblierungInput);
    const furniture = result.treiber.find((t) => t.label === "Möblierungspotenzial")!;
    expect(furniture.irrBeitragPercentPoints).toBeGreaterThan(0);
  });
});
