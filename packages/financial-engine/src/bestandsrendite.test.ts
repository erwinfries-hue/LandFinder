import { describe, it, expect } from "vitest";
import {
  calculateNebenkosten,
  calculateSchnellcheck,
  calculateAllInInvestition,
  calculateJahresertrag,
  calculateBetriebskosten,
  resolveReserveChf,
  resolveAmortisationChfPerYear,
  calculateCashflowWasserfall,
  calculateInvestmentCase,
  breakEvenMieteChfPerMonth,
  breakEvenZinsPercent,
  breakEvenAuslastungPercent,
  type InvestmentCaseInput,
} from "./bestandsrendite";

describe("calculateNebenkosten", () => {
  it("summiert Handänderungssteuer, Notariat/Grundbuch und Maklerprovision als Prozentsätze des Kaufpreises", () => {
    const result = calculateNebenkosten({
      kaufpreisChf: 1_000_000,
      handaenderungssteuerPercent: 2,
      notariatGrundbuchPercent: 0.5,
      maklerprovisionPercent: 3,
    });
    expect(result).toEqual({ handaenderungssteuerChf: 20_000, notariatGrundbuchChf: 5_000, maklerprovisionChf: 30_000, totalNebenkostenChf: 55_000 });
  });
});

describe("calculateSchnellcheck (Ebene A)", () => {
  it("rechnet Kaufpreis, Preis/m², Bruttorendite, Eigenkapitalbedarf (inkl. Nebenkosten) und groben Cashflow", () => {
    const result = calculateSchnellcheck({
      wohnungskaufpreisChf: 850_000,
      parkplatzkaufpreisChf: 50_000,
      wohnflaecheM2: 75,
      wohnungsMieteChfPerMonth: 1_450,
      parkplatzMieteChfPerMonth: 150,
      moeblierungsPremiumChfPerMonth: 0,
      sonstigeEinnahmenChfPerYear: 0,
      kaufnebenkostenPercent: 2.5,
      laufendeKostenChfPerYear: 4_000,
      loanToValuePercent: 70,
      interestRatePercent: 2,
    });

    expect(result.kaufpreisChf).toBe(900_000);
    expect(result.preisProM2Chf).toBeCloseTo(900_000 / 75, 5);
    expect(result.jahresnettomieteChf).toBe((1_450 + 150) * 12);
    expect(result.bruttoRenditePercent).toBeCloseTo(((1_450 + 150) * 12 / 900_000) * 100, 5);
    expect(result.eigenkapitalbedarfChf).toBeCloseTo(900_000 * 0.3 + 900_000 * 0.025, 5);
    expect(result.belehnungPercent).toBe(70);
    const hypothekChf = 900_000 * 0.7;
    expect(result.groberCashflowChf).toBeCloseTo((1_450 + 150) * 12 - 4_000 - hypothekChf * 0.02, 5);
  });

  it("bezieht moeblierungsPremiumChfPerMonth in die Jahresnettomiete/Bruttorendite ein, wenn gesetzt — Aufrufer entscheidet anhand des Vermietungsmodells, ob 0 oder der erfasste Aufschlag übergeben wird", () => {
    const result = calculateSchnellcheck({
      wohnungskaufpreisChf: 850_000,
      parkplatzkaufpreisChf: 50_000,
      wohnflaecheM2: 75,
      wohnungsMieteChfPerMonth: 1_450,
      parkplatzMieteChfPerMonth: 150,
      moeblierungsPremiumChfPerMonth: 300,
      sonstigeEinnahmenChfPerYear: 0,
      kaufnebenkostenPercent: 2.5,
      laufendeKostenChfPerYear: 4_000,
      loanToValuePercent: 70,
      interestRatePercent: 2,
    });
    expect(result.jahresnettomieteChf).toBe((1_450 + 150 + 300) * 12);
  });

  it("bezieht sonstigeEinnahmenChfPerYear in die Jahresnettomiete/Bruttorendite ein — sonst zeigen Ebene A und Ebene B/C unterschiedliche Zahlen für dasselbe Objekt (Regressionstest)", () => {
    const result = calculateSchnellcheck({
      wohnungskaufpreisChf: 850_000,
      parkplatzkaufpreisChf: 50_000,
      wohnflaecheM2: 75,
      wohnungsMieteChfPerMonth: 1_450,
      parkplatzMieteChfPerMonth: 150,
      moeblierungsPremiumChfPerMonth: 0,
      sonstigeEinnahmenChfPerYear: 2_400,
      kaufnebenkostenPercent: 2.5,
      laufendeKostenChfPerYear: 4_000,
      loanToValuePercent: 70,
      interestRatePercent: 2,
    });
    expect(result.jahresnettomieteChf).toBe((1_450 + 150) * 12 + 2_400);
  });
});

describe("calculateAllInInvestition", () => {
  it("summiert Kaufpreis, Nebenkosten, Renovation, Möblierung und Sonstiges", () => {
    const nebenkosten = calculateNebenkosten({ kaufpreisChf: 800_000, handaenderungssteuerPercent: 2, notariatGrundbuchPercent: 0.5, maklerprovisionPercent: 0 });
    const total = calculateAllInInvestition({ kaufpreisChf: 800_000, nebenkosten, renovationInitialChf: 30_000, moeblierungInitialChf: 10_000, sonstigeInitialkostenChf: 2_000 });
    expect(total).toBe(800_000 + 20_000 + 30_000 + 10_000 + 2_000);
  });
});

describe("calculateJahresertrag", () => {
  it("Langfristvermietung: Leerstandsquote reduziert den potenziellen Ertrag", () => {
    const result = calculateJahresertrag({
      wohnungsMieteChfPerMonth: 1_450,
      parkplatzMieteChfPerMonth: 150,
      moeblierungsPremiumChfPerMonth: 0,
      sonstigeEinnahmenChfPerYear: 0,
      vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT",
      leerstandPercent: 2,
    });
    expect(result.potenziellerJahresertragChf).toBe(1_600 * 12);
    expect(result.effektiverJahresertragChf).toBeCloseTo(1_600 * 12 * 0.98, 5);
  });

  it("Short Stay: Auslastungsquote statt Leerstand, inkl. Möblierungspremium", () => {
    const result = calculateJahresertrag({
      wohnungsMieteChfPerMonth: 1_450,
      parkplatzMieteChfPerMonth: 0,
      moeblierungsPremiumChfPerMonth: 300,
      sonstigeEinnahmenChfPerYear: 0,
      vermietungsmodell: "SHORT_STAY",
      auslastungPercent: 80,
    });
    expect(result.potenziellerJahresertragChf).toBe(1_750 * 12);
    expect(result.effektiverJahresertragChf).toBeCloseTo(1_750 * 12 * 0.8, 5);
  });
});

describe("calculateBetriebskosten", () => {
  it("summiert alle vier Kostenkategorien", () => {
    expect(calculateBetriebskosten({ stwegAkontobeitragChfPerYear: 4_800, eigentuemerkostenChfPerYear: 300, vermietungskostenChfPerYear: 200, reinigungServiceChfPerYear: 0, reparaturChfPerYear: 0, nebenkostenMoebliertChfPerYear: 0 })).toBe(5_300);
  });

  it("summiert auch jährliche Reparaturkosten und möblierte Nebenkosten (WLAN/Kabel/Streaming/Abfall)", () => {
    expect(
      calculateBetriebskosten({
        stwegAkontobeitragChfPerYear: 4_800,
        eigentuemerkostenChfPerYear: 300,
        vermietungskostenChfPerYear: 200,
        reinigungServiceChfPerYear: 400,
        reparaturChfPerYear: 400,
        nebenkostenMoebliertChfPerYear: 1_500,
      }),
    ).toBe(7_600);
  });
});

describe("resolveReserveChf", () => {
  it("verwendet den direkten CHF-Betrag, wenn gesetzt", () => {
    expect(resolveReserveChf({ chfPerYear: 1_200, percentOfKaufpreis: 0.3, kaufpreisChf: 900_000 })).toBe(1_200);
  });

  it("berechnet aus Prozentsatz vom Kaufpreis, wenn kein CHF-Betrag gesetzt ist", () => {
    expect(resolveReserveChf({ percentOfKaufpreis: 0.3, kaufpreisChf: 900_000 })).toBeCloseTo(2_700, 5);
  });
});

describe("resolveAmortisationChfPerYear", () => {
  it("berechnet aus einem Prozentsatz vom ursprünglichen Tranchenbetrag pro Jahr", () => {
    expect(resolveAmortisationChfPerYear(200_000, { modus: "PROZENT_PRO_JAHR", prozentProJahr: 1 })).toBeCloseTo(2_000, 5);
  });

  it("berechnet aus einer Zieldauer in Jahren (linear)", () => {
    expect(resolveAmortisationChfPerYear(150_000, { modus: "DAUER_JAHRE", dauerJahre: 15 })).toBeCloseTo(10_000, 5);
  });

  it("liefert 0 bei fehlendem Prozentsatz im Modus PROZENT_PRO_JAHR, statt zu werfen", () => {
    expect(resolveAmortisationChfPerYear(200_000, { modus: "PROZENT_PRO_JAHR" })).toBe(0);
  });

  it("liefert 0 bei fehlender oder nicht-positiver Dauer im Modus DAUER_JAHRE, statt durch 0 zu teilen", () => {
    expect(resolveAmortisationChfPerYear(150_000, { modus: "DAUER_JAHRE" })).toBe(0);
    expect(resolveAmortisationChfPerYear(150_000, { modus: "DAUER_JAHRE", dauerJahre: 0 })).toBe(0);
  });
});

describe("calculateCashflowWasserfall", () => {
  it("rechnet die fünf Stufen in der vorgegebenen Reihenfolge: NOI -> nach Zins -> nach Amortisation -> nach Steuer -> nachhaltiger Cashflow", () => {
    const result = calculateCashflowWasserfall({
      effektiverJahresertragChf: 20_000,
      betriebskostenChfPerYear: 5_000,
      zinsChf: 4_000,
      amortisationChf: 3_000,
      kalkulatorischerSteuersatzPercent: 25,
      reparaturreserveChf: 1_000,
      leerstandsreserveChf: 500,
    });

    expect(result.noiChf).toBe(15_000);
    expect(result.cashflowNachZinsChf).toBe(11_000);
    expect(result.cashflowNachAmortisationChf).toBe(8_000);
    expect(result.steuerChf).toBe(11_000 * 0.25); // Steuerbasis = NOI - Zins, NICHT NOI - Zins - Amortisation
    expect(result.cashflowNachSteuerChf).toBeCloseTo(8_000 - 2_750, 5);
    expect(result.nachhaltigerCashflowChf).toBeCloseTo(8_000 - 2_750 - 1_000 - 500, 5);
  });

  it("klemmt die Steuerbasis bei 0, wenn der Cashflow nach Zins bereits negativ ist (keine negative Steuer)", () => {
    const result = calculateCashflowWasserfall({
      effektiverJahresertragChf: 5_000,
      betriebskostenChfPerYear: 2_000,
      zinsChf: 6_000,
      amortisationChf: 1_000,
      kalkulatorischerSteuersatzPercent: 25,
      reparaturreserveChf: 0,
      leerstandsreserveChf: 0,
    });
    expect(result.cashflowNachZinsChf).toBe(-3_000);
    expect(result.steuerChf).toBe(0);
  });
});

const baseInvestmentCaseInput: InvestmentCaseInput = {
  kaufpreisChf: 900_000,
  allInInvestitionChf: 940_000,
  ertrag: {
    wohnungsMieteChfPerMonth: 1_450,
    parkplatzMieteChfPerMonth: 150,
    moeblierungsPremiumChfPerMonth: 0,
    sonstigeEinnahmenChfPerYear: 0,
    vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT",
    leerstandPercent: 2,
  },
  betriebskosten: { stwegAkontobeitragChfPerYear: 4_800, eigentuemerkostenChfPerYear: 300, vermietungskostenChfPerYear: 200, reinigungServiceChfPerYear: 0, reparaturChfPerYear: 0, nebenkostenMoebliertChfPerYear: 0 },
  hypothekChf: 630_000,
  interestRatePercent: 2,
  amortisationChfPerYear: 5_000,
  kalkulatorischerSteuersatzPercent: 25,
  reparaturreserveChf: 2_700,
  leerstandsreserveChf: 1_500,
  eigenkapitalChf: 310_000,
};

describe("calculateInvestmentCase (Ebene B)", () => {
  it("weist Bruttorendite auf Kaufpreis UND auf All-in getrennt aus — All-in ist niedriger bei zusätzlichen Initialkosten", () => {
    const result = calculateInvestmentCase(baseInvestmentCaseInput);
    expect(result.bruttoRenditeKaufpreisPercent).toBeGreaterThan(result.bruttoRenditeAllInPercent);
  });

  it("Cash-on-Cash = nachhaltiger Cashflow / eingesetztes Eigenkapital", () => {
    const result = calculateInvestmentCase(baseInvestmentCaseInput);
    expect(result.cashOnCashPercent).toBeCloseTo((result.wasserfall.nachhaltigerCashflowChf / baseInvestmentCaseInput.eigenkapitalChf) * 100, 5);
  });

  it("liefert 0 statt Division durch 0, wenn All-in-Investition oder Eigenkapital 0 sind", () => {
    const result = calculateInvestmentCase({ ...baseInvestmentCaseInput, allInInvestitionChf: 0, eigenkapitalChf: 0 });
    expect(result.bruttoRenditeAllInPercent).toBe(0);
    expect(result.nettoRenditeVorFinanzierungPercent).toBe(0);
    expect(result.cashOnCashPercent).toBe(0);
  });
});

describe("Break-even-Werte", () => {
  it("breakEvenMieteChfPerMonth: bei der gefundenen Miete ist der nachhaltige Cashflow ≈ 0", () => {
    const miete = breakEvenMieteChfPerMonth(baseInvestmentCaseInput);
    expect(miete).toBeDefined();
    const resultAtBreakEven = calculateInvestmentCase({ ...baseInvestmentCaseInput, ertrag: { ...baseInvestmentCaseInput.ertrag, wohnungsMieteChfPerMonth: miete! } });
    expect(resultAtBreakEven.wasserfall.nachhaltigerCashflowChf).toBeCloseTo(0, 0);
  });

  it("breakEvenZinsPercent: bei dem gefundenen Zinssatz ist der nachhaltige Cashflow ≈ 0", () => {
    const zins = breakEvenZinsPercent(baseInvestmentCaseInput);
    expect(zins).toBeDefined();
    const resultAtBreakEven = calculateInvestmentCase({ ...baseInvestmentCaseInput, interestRatePercent: zins! });
    expect(resultAtBreakEven.wasserfall.nachhaltigerCashflowChf).toBeCloseTo(0, 0);
  });

  it("breakEvenAuslastungPercent: undefined ausserhalb von SHORT_STAY", () => {
    expect(breakEvenAuslastungPercent(baseInvestmentCaseInput)).toBeUndefined();
  });

  it("breakEvenAuslastungPercent: bei SHORT_STAY liefert die gefundene Auslastung einen nachhaltigen Cashflow ≈ 0", () => {
    // Höhere Miete als im Basis-Fixture nötig, damit bei 100% Auslastung überhaupt ein
    // positiver Cashflow möglich ist — sonst liegt der Break-even ausserhalb [0, 100]
    // (kein Bug, nur ein für diesen Sub-Test unpassendes Fixture).
    const shortStayInput: InvestmentCaseInput = {
      ...baseInvestmentCaseInput,
      ertrag: { ...baseInvestmentCaseInput.ertrag, wohnungsMieteChfPerMonth: 2_900, vermietungsmodell: "SHORT_STAY", leerstandPercent: undefined, auslastungPercent: 80 },
    };
    const auslastung = breakEvenAuslastungPercent(shortStayInput);
    expect(auslastung).toBeDefined();
    const resultAtBreakEven = calculateInvestmentCase({ ...shortStayInput, ertrag: { ...shortStayInput.ertrag, auslastungPercent: auslastung! } });
    expect(resultAtBreakEven.wasserfall.nachhaltigerCashflowChf).toBeCloseTo(0, 0);
  });
});
