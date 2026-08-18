import { describe, it, expect } from "vitest";
import { computeBestandsrenditeAnalysis, parseBestandsrenditeFacts, applyFieldUpdate, isAllowedUpdateField, type BestandsrenditeFacts } from "./bestandsrendite";

const minimalValidInput = {
  miete: { wohnungsMieteChfPerMonth: 1450, vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT" },
  hypothek: { loanToValuePercent: 70, interestRatePercent: 2, amortisationChfPerYear: 5000 },
};

describe("parseBestandsrenditeFacts", () => {
  it("lehnt ein Nicht-Objekt ab", () => {
    expect(parseBestandsrenditeFacts(null)).toEqual({ error: "Kein Objekt" });
    expect(parseBestandsrenditeFacts("x")).toEqual({ error: "Kein Objekt" });
  });

  it("verlangt miete.wohnungsMieteChfPerMonth", () => {
    const result = parseBestandsrenditeFacts({ ...minimalValidInput, miete: { vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT" } });
    expect(result).toEqual({ error: "miete.wohnungsMieteChfPerMonth fehlt" });
  });

  it("verlangt ein gültiges vermietungsmodell", () => {
    const result = parseBestandsrenditeFacts({ ...minimalValidInput, miete: { wohnungsMieteChfPerMonth: 1450, vermietungsmodell: "IRGENDWAS" } });
    expect("error" in result).toBe(true);
  });

  it("verlangt die drei Hypothek-Felder", () => {
    const result = parseBestandsrenditeFacts({ ...minimalValidInput, hypothek: { loanToValuePercent: 70 } });
    expect("error" in result).toBe(true);
  });

  it("parst ein minimales gültiges Objekt mit sinnvollen Defaults für alles Fehlende", () => {
    const result = parseBestandsrenditeFacts(minimalValidInput);
    expect("facts" in result).toBe(true);
    if ("facts" in result) {
      expect(result.facts.miete.wohnungsMieteChfPerMonth).toBe(1450);
      expect(result.facts.moeblierung.initialCostChf).toBe(0);
      expect(result.facts.renovation.positionen).toEqual([]);
      expect(result.facts.parkplatzKaufpreisChf).toBe(0);
      // Optionale Überschreibungen (z.B. Steuersatz) bleiben unset, damit die
      // Platzhalter-Defaults aus BESTANDSRENDITE_PARAMETERS greifen.
      expect(result.facts.kalkulatorischerSteuersatzPercent).toBeUndefined();
    }
  });

  it("übernimmt gesetzte optionale Felder statt sie zu verwerfen", () => {
    const result = parseBestandsrenditeFacts({
      ...minimalValidInput,
      kalkulatorischerSteuersatzPercent: 30,
      nebenkosten: { handaenderungssteuerPercent: 1.5 },
      moeblierung: { initialCostChf: 12_000, mietPremiumChfPerMonth: 300 },
      renovation: { initialRenovationCostChf: 25_000, mieteVorRenovationChfPerMonth: 1_200, mieteNachRenovationChfPerMonth: 1_450 },
    });
    expect("facts" in result).toBe(true);
    if ("facts" in result) {
      expect(result.facts.kalkulatorischerSteuersatzPercent).toBe(30);
      expect(result.facts.nebenkosten.handaenderungssteuerPercent).toBe(1.5);
      expect(result.facts.moeblierung.initialCostChf).toBe(12_000);
      expect(result.facts.renovation.mieteVorRenovationChfPerMonth).toBe(1_200);
      expect(result.facts.renovation.mieteNachRenovationChfPerMonth).toBe(1_450);
    }
  });
});

const fullFacts: BestandsrenditeFacts = {
  zimmerzahl: 3.5,
  baujahr: 1998,
  parkplatzKaufpreisChf: 30_000,
  stweg: { erneuerungsfondsSaldoChf: 180_000 },
  nebenkosten: {},
  renovation: { initialRenovationCostChf: 25_000, positionen: [{ betragChf: 25_000, kategorie: "WERTERHALTEND", jahr: 2026, steuerlicheAbzugsfaehigkeit: "UNKLAR" }] },
  moeblierung: { initialCostChf: 10_000, mietPremiumChfPerMonth: 300 },
  miete: { wohnungsMieteChfPerMonth: 1_450, parkplatzMieteChfPerMonth: 150, sonstigeEinnahmenChfPerYear: 0, vermietungsmodell: "MITTELFRISTIG_MOEBLIERT" },
  betriebskosten: { stwegAkontobeitragChfPerYear: 4_800, eigentuemerkostenChfPerYear: 300, vermietungskostenChfPerYear: 200, reinigungServiceChfPerYear: 0 },
  reserven: {},
  hypothek: { loanToValuePercent: 70, interestRatePercent: 2, amortisationChfPerYear: 5_000 },
  mehrjahresmodell: {},
};

describe("computeBestandsrenditeAnalysis", () => {
  it("rechnet ein vollständiges Beispiel Ende-zu-Ende durch, ohne zu werfen, mit plausiblen Kennzahlen", () => {
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);

    expect(result.schnellcheck.kaufpreisChf).toBe(900_000); // Wohnung + Parkplatz
    expect(result.allInInvestitionChf).toBeGreaterThan(900_000); // + Nebenkosten + Renovation + Möblierung
    expect(result.investmentCase.bruttoRenditeKaufpreisPercent).toBeGreaterThan(result.investmentCase.bruttoRenditeAllInPercent);
    expect(result.mehrjahresmodell.years).toHaveLength(15); // Default-Haltedauer
    expect(result.furnitureRoi).toBeDefined();
    expect(result.furnitureRoi!.roiPercent).toBeCloseTo(36, 5); // 300*12/10000
    expect(result.investmentTreiber.treiber).toHaveLength(5);
  });

  it("dokumentiert jede verwendete Platzhalter-Annahme in assumptionNotes", () => {
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    expect(result.assumptionNotes.length).toBeGreaterThan(0);
    expect(result.assumptionNotes.some((n) => n.includes("Leerstandsquote"))).toBe(true);
  });

  it("übernimmt explizit gesetzte Werte statt der Platzhalter (keine Notiz dafür)", () => {
    const customFacts: BestandsrenditeFacts = {
      ...fullFacts,
      kalkulatorischerSteuersatzPercent: 30,
      miete: { ...fullFacts.miete, leerstandPercent: 4 },
    };
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, customFacts);
    expect(result.assumptionNotes.some((n) => n.includes("Kalkulatorischer Steuersatz"))).toBe(false);
    expect(result.assumptionNotes.some((n) => n.includes("Leerstandsquote"))).toBe(false);
  });

  it("ohne Möblierung/Renovation bleibt die All-in-Investition beim Kaufpreis + Nebenkosten", () => {
    const noExtras: BestandsrenditeFacts = {
      ...fullFacts,
      renovation: { initialRenovationCostChf: 0, positionen: [] },
      moeblierung: { initialCostChf: 0, mietPremiumChfPerMonth: 0 },
    };
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, noExtras);
    expect(result.furnitureRoi).toBeUndefined();
    expect(result.allInInvestitionChf).toBeLessThan(computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts).allInInvestitionChf);
  });

  it("ohne Miete vor/nach Renovation bleibt renovationRoi undefined, obwohl Renovationskosten gesetzt sind", () => {
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    expect(result.renovationRoi).toBeUndefined();
  });

  it("berechnet renovationRoi aus Miete vor/nach Renovation, sobald beide gesetzt sind", () => {
    const withRenovationRent: BestandsrenditeFacts = {
      ...fullFacts,
      renovation: { ...fullFacts.renovation, mieteVorRenovationChfPerMonth: 1_200, mieteNachRenovationChfPerMonth: 1_450 },
    };
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, withRenovationRent);
    expect(result.renovationRoi).toBeDefined();
    expect(result.renovationRoi!.zusaetzlicherJahresertragChf).toBeCloseTo((1_450 - 1_200) * 12, 5);
    expect(result.renovationRoi!.roiPercent).toBeCloseTo(((1_450 - 1_200) * 12 * 100) / 25_000, 5);
  });

  it("wertvermehrende Renovationspositionen erhöhen den Immobilienwert im Mehrjahresmodell (Jahr 1), werterhaltende nicht", () => {
    const werterhaltend = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const wertvermehrend: BestandsrenditeFacts = {
      ...fullFacts,
      renovation: { initialRenovationCostChf: 25_000, positionen: [{ betragChf: 25_000, kategorie: "WERTVERMEHREND", jahr: 2026, steuerlicheAbzugsfaehigkeit: "UNKLAR" }] },
    };
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, wertvermehrend);
    expect(result.mehrjahresmodell.years[0].immobilienwertChf).toBeGreaterThan(werterhaltend.mehrjahresmodell.years[0].immobilienwertChf);
  });
});

describe("isAllowedUpdateField / applyFieldUpdate", () => {
  it("erlaubt nur die explizit gelisteten Feldpfade", () => {
    expect(isAllowedUpdateField("miete.wohnungsMieteChfPerMonth")).toBe(true);
    expect(isAllowedUpdateField("stweg.erneuerungsfondsSaldoChf")).toBe(true);
    expect(isAllowedUpdateField("erfundenes.feld")).toBe(false);
    expect(isAllowedUpdateField("miete.wohnungsMieteChfPerMonth.zuTief")).toBe(false);
  });

  it("setzt nur das eine Blattfeld, andere Felder in derselben Gruppe bleiben unverändert", () => {
    const facts = { miete: { wohnungsMieteChfPerMonth: 1200, parkplatzMieteChfPerMonth: 150 } };
    const updated = applyFieldUpdate(facts, "miete.wohnungsMieteChfPerMonth", 1220);
    expect(updated.miete).toEqual({ wohnungsMieteChfPerMonth: 1220, parkplatzMieteChfPerMonth: 150 });
  });

  it("erstellt eine fehlende Zwischengruppe, falls sie noch nicht existiert", () => {
    const facts = {};
    const updated = applyFieldUpdate(facts, "stweg.erneuerungsfondsSaldoChf", 180_000);
    expect(updated.stweg).toEqual({ erneuerungsfondsSaldoChf: 180_000 });
  });

  it("lässt andere Gruppen im Facts-Objekt unangetastet", () => {
    const facts = { miete: { wohnungsMieteChfPerMonth: 1200 }, renovation: { initialRenovationCostChf: 5_000 } };
    const updated = applyFieldUpdate(facts, "miete.wohnungsMieteChfPerMonth", 1300);
    expect(updated.renovation).toEqual({ initialRenovationCostChf: 5_000 });
  });
});
