import { describe, it, expect } from "vitest";
import { computeBestandsrenditeAnalysis, type BestandsrenditeFacts } from "./bestandsrendite";
import {
  applyScenarioOverrides,
  buildDefaultScenarios,
  computeScenarios,
  computeInterestRateStressTest,
  isReturnMateriallyRateDependent,
} from "./scenarioEngine";

const property = { kaufpreisChf: 870_000, wohnflaecheM2: 75 };

const facts: BestandsrenditeFacts = {
  zimmerzahl: 3.5,
  baujahr: 1998,
  parkplatzKaufpreisChf: 0,
  parkplatzImKaufpreisEnthalten: false,
  garagenplatzKaufpreisChf: 0,
  garagenplatzImKaufpreisEnthalten: false,
  hobbyraumKaufpreisChf: 0,
  hobbyraumImKaufpreisEnthalten: false,
  stweg: {},
  nebenkosten: {},
  renovation: { initialRenovationCostChf: 0, positionen: [] },
  reparatur: { jaehrlichUnmoebliertChf: 0, jaehrlichMoebliertChf: 0 },
  moeblierung: { initialCostChf: 10_000, mietPremiumChfPerMonth: 300 },
  miete: {
    wohnungsMieteChfPerMonth: 1_450,
    parkplatzMieteChfPerMonth: 0,
    garagenplatzMieteChfPerMonth: 0,
    hobbyraumMieteChfPerMonth: 0,
    sonstigeEinnahmenChfPerYear: 0,
    vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT",
    leerstandPercent: 5,
  },
  betriebskosten: {
    stwegAkontobeitragChfPerYear: 4_800,
    stwegAkontobeitragUeberwaelzbarChfPerYear: 0,
    eigentuemerkostenChfPerYear: 1_000,
    vermietungskostenChfPerYear: 200,
    reinigungServiceUnmoebliertChfPerYear: 0,
    reinigungServiceMoebliertChfPerYear: 0,
    nebenkostenMoebliertChfPerYear: 0,
  },
  reserven: { reparaturChfPerYear: 1_500 },
  hypothek: {
    ersteHypothek: { belehnungPercent: 65, amortisation: { modus: "PROZENT_PRO_JAHR", prozentProJahr: 1 } },
    zweiteHypothek: { belehnungPercent: 10, amortisation: { modus: "DAUER_JAHRE", dauerJahre: 15 } },
    interestRatePercent: 2,
  },
  mehrjahresmodell: {},
};

describe("applyScenarioOverrides", () => {
  it("überschreibt genau die gesetzten Felder, alles andere bleibt unverändert", () => {
    const result = applyScenarioOverrides(property, facts, { wohnungsMieteChfPerMonth: 1_500, interestRatePercent: 3 });
    expect(result.facts.miete.wohnungsMieteChfPerMonth).toBe(1_500);
    expect(result.facts.hypothek.interestRatePercent).toBe(3);
    // Unverändert:
    expect(result.facts.moeblierung.mietPremiumChfPerMonth).toBe(300);
    expect(result.property.kaufpreisChf).toBe(870_000);
    // Original bleibt unmutiert.
    expect(facts.miete.wohnungsMieteChfPerMonth).toBe(1_450);
  });

  it("mappt vacancyPercent auf leerstandPercent bei Langfristvermietung, auf (100 - auslastungPercent) bei Short-Stay", () => {
    const langfrist = applyScenarioOverrides(property, facts, { vacancyPercent: 10 });
    expect(langfrist.facts.miete.leerstandPercent).toBe(10);
    expect(langfrist.facts.miete.auslastungPercent).toBeUndefined();

    const shortStayFacts: BestandsrenditeFacts = { ...facts, miete: { ...facts.miete, vermietungsmodell: "SHORT_STAY", auslastungPercent: 80 } };
    const shortStay = applyScenarioOverrides(property, shortStayFacts, { vacancyPercent: 15 });
    expect(shortStay.facts.miete.auslastungPercent).toBe(85);
  });

  it("überschreibt den Kaufpreis nur, wenn purchasePriceChf gesetzt ist", () => {
    expect(applyScenarioOverrides(property, facts, {}).property.kaufpreisChf).toBe(870_000);
    expect(applyScenarioOverrides(property, facts, { purchasePriceChf: 800_000 }).property.kaufpreisChf).toBe(800_000);
  });
});

describe("buildDefaultScenarios / computeScenarios", () => {
  it("liefert Conservative < Base < Upside für Bruttorendite (Kaufpreis) — Miete/Vacancy/Zins wirken alle in dieselbe Richtung", () => {
    const scenarios = buildDefaultScenarios(facts);
    expect(scenarios.map((s) => s.key)).toEqual(["CONSERVATIVE", "BASE", "UPSIDE"]);

    const results = computeScenarios(property, facts, scenarios);
    const [conservative, base, upside] = results;

    // Base entspricht exakt der unveränderten Direktberechnung (No-Op-Overrides).
    const direktBase = computeBestandsrenditeAnalysis(property, facts);
    expect(base.analysis.investmentCase.nettoRenditeVorFinanzierungPercent).toBeCloseTo(direktBase.investmentCase.nettoRenditeVorFinanzierungPercent, 6);

    expect(conservative.analysis.investmentCase.nettoRenditeVorFinanzierungPercent).toBeLessThan(base.analysis.investmentCase.nettoRenditeVorFinanzierungPercent);
    expect(upside.analysis.investmentCase.nettoRenditeVorFinanzierungPercent).toBeGreaterThan(base.analysis.investmentCase.nettoRenditeVorFinanzierungPercent);

    expect(conservative.analysis.investmentCase.wasserfall.nachhaltigerCashflowChf).toBeLessThan(base.analysis.investmentCase.wasserfall.nachhaltigerCashflowChf);
    expect(upside.analysis.investmentCase.wasserfall.nachhaltigerCashflowChf).toBeGreaterThan(base.analysis.investmentCase.wasserfall.nachhaltigerCashflowChf);
  });

  it("erlaubt manuelles Überschreiben einzelner Szenario-Parameter nach dem Bauen der Default-Szenarien", () => {
    const scenarios = buildDefaultScenarios(facts);
    const manuellAngepasst = scenarios.map((s) => (s.key === "UPSIDE" ? { ...s, overrides: { ...s.overrides, purchasePriceChf: 750_000 } } : s));
    const results = computeScenarios(property, facts, manuellAngepasst);
    const upside = results.find((r) => r.key === "UPSIDE")!;
    expect(upside.analysis.schnellcheck.kaufpreisChf).toBe(750_000);
  });
});

describe("computeInterestRateStressTest", () => {
  it("liefert mindestens Basiszins, 2.5%, 3.5%, 5.0% aufsteigend sortiert, mit genau einer als Basiszins markierten Zeile", () => {
    const rows = computeInterestRateStressTest(property, facts);
    const zinssaetze = rows.map((r) => r.interestRatePercent);
    expect(zinssaetze).toEqual([...zinssaetze].sort((a, b) => a - b));
    expect(zinssaetze).toEqual(expect.arrayContaining([2, 2.5, 3.5, 5.0]));
    expect(rows.filter((r) => r.isBaseRate)).toHaveLength(1);
    expect(rows.find((r) => r.isBaseRate)!.interestRatePercent).toBe(2);
  });

  it("dedupliziert, wenn der Basiszins exakt einem Stress-Zinssatz entspricht", () => {
    const factsMit35 = { ...facts, hypothek: { ...facts.hypothek, interestRatePercent: 3.5 } };
    const rows = computeInterestRateStressTest(property, factsMit35);
    expect(rows.filter((r) => r.interestRatePercent === 3.5)).toHaveLength(1);
    expect(rows).toHaveLength(3); // 2.5 / 3.5 (=Basis) / 5.0
  });

  it("berechnet DSCR = NOI ÷ Schuldendienst, undefined ohne Schuldendienst", () => {
    const rows = computeInterestRateStressTest(property, facts);
    const baseRow = rows.find((r) => r.isBaseRate)!;
    const direkt = computeBestandsrenditeAnalysis(property, facts);
    const hypothekTotal = direkt.hypothek.ersteHypothekChf + direkt.hypothek.zweiteHypothekChf;
    const amortisation = direkt.hypothek.ersteAmortisationChfPerYear + direkt.hypothek.zweiteAmortisationChfPerYear;
    const erwarteterDscr = direkt.investmentCase.wasserfall.noiChf / (hypothekTotal * 0.02 + amortisation);
    expect(baseRow.dscr).toBeCloseTo(erwarteterDscr, 6);

    const factsOhneHypothek: BestandsrenditeFacts = {
      ...facts,
      hypothek: {
        ersteHypothek: { belehnungPercent: 0, amortisation: { modus: "PROZENT_PRO_JAHR", prozentProJahr: 0 } },
        zweiteHypothek: { belehnungPercent: 0, amortisation: { modus: "PROZENT_PRO_JAHR", prozentProJahr: 0 } },
        interestRatePercent: 2,
      },
    };
    const rowsOhneHypothek = computeInterestRateStressTest(property, factsOhneHypothek);
    expect(rowsOhneHypothek.every((r) => r.dscr === undefined)).toBe(true);
  });
});

describe("isReturnMateriallyRateDependent", () => {
  it("ist true, wenn der Cashflow beim Basiszins positiv, bei einem Stress-Zins aber negativ ist", () => {
    const rows = [
      { interestRatePercent: 1, isBaseRate: true, annualInterestChf: 0, nachhaltigerCashflowChf: 200, cashOnCashPercent: 1, dscr: 1.1 },
      { interestRatePercent: 5, isBaseRate: false, annualInterestChf: 0, nachhaltigerCashflowChf: -500, cashOnCashPercent: -3, dscr: 0.8 },
    ];
    expect(isReturnMateriallyRateDependent(rows)).toBe(true);
  });

  it("ist false, wenn der Basiszins-Cashflow bereits negativ ist (kein 'abhängig von tiefen Zinsen' — trägt sich generell nicht)", () => {
    const rows = [
      { interestRatePercent: 1, isBaseRate: true, annualInterestChf: 0, nachhaltigerCashflowChf: -100, cashOnCashPercent: -1, dscr: undefined },
      { interestRatePercent: 5, isBaseRate: false, annualInterestChf: 0, nachhaltigerCashflowChf: -500, cashOnCashPercent: -5, dscr: undefined },
    ];
    expect(isReturnMateriallyRateDependent(rows)).toBe(false);
  });

  it("ist false, wenn der Cashflow bei allen Stress-Zinssätzen positiv bleibt", () => {
    const rows = [
      { interestRatePercent: 1, isBaseRate: true, annualInterestChf: 0, nachhaltigerCashflowChf: 5_000, cashOnCashPercent: 5, dscr: 2 },
      { interestRatePercent: 5, isBaseRate: false, annualInterestChf: 0, nachhaltigerCashflowChf: 500, cashOnCashPercent: 1, dscr: 1.1 },
    ];
    expect(isReturnMateriallyRateDependent(rows)).toBe(false);
  });
});
