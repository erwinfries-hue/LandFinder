import { describe, it, expect } from "vitest";
import { computeBestandsrenditeAnalysis, computeVerhandlungskorridor, parseBestandsrenditeFacts, applyFieldUpdate, isAllowedUpdateField, type BestandsrenditeFacts } from "./bestandsrendite";

const minimalValidInput = {
  miete: { wohnungsMieteChfPerMonth: 1450, vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT" },
  hypothek: {
    ersteHypothek: { belehnungPercent: 65, amortisation: { modus: "PROZENT_PRO_JAHR", prozentProJahr: 0 } },
    zweiteHypothek: { belehnungPercent: 5, amortisation: { modus: "DAUER_JAHRE", dauerJahre: 15 } },
    interestRatePercent: 2,
  },
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

  it("verlangt erste/zweite Hypothek inkl. Amortisationsmodus", () => {
    const result = parseBestandsrenditeFacts({ ...minimalValidInput, hypothek: { interestRatePercent: 2 } });
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
      expect(result.facts.parkplatzImKaufpreisEnthalten).toBe(false);
      expect(result.facts.garagenplatzKaufpreisChf).toBe(0);
      expect(result.facts.garagenplatzImKaufpreisEnthalten).toBe(false);
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
  parkplatzImKaufpreisEnthalten: false,
  garagenplatzKaufpreisChf: 0,
  garagenplatzImKaufpreisEnthalten: false,
  hobbyraumKaufpreisChf: 0,
  hobbyraumImKaufpreisEnthalten: false,
  stweg: { erneuerungsfondsSaldoChf: 180_000 },
  nebenkosten: {},
  renovation: {
    initialRenovationCostChf: 25_000,
    positionen: [{ betragChf: 25_000, kategorie: "WERTERHALTEND", jahr: 2026, steuerlicheAbzugsfaehigkeit: "UNKLAR" }],
  },
  reparatur: { initialUnmoebliertChf: 0, initialMoebliertChf: 0 },
  moeblierung: { initialCostChf: 10_000, mietPremiumChfPerMonth: 300 },
  miete: {
    wohnungsMieteChfPerMonth: 1_450,
    parkplatzMieteChfPerMonth: 150,
    garagenplatzMieteChfPerMonth: 0,
    hobbyraumMieteChfPerMonth: 0,
    sonstigeEinnahmenChfPerYear: 0,
    vermietungsmodell: "MITTELFRISTIG_MOEBLIERT",
  },
  betriebskosten: {
    stwegAkontobeitragChfPerYear: 4_800,
    stwegAkontobeitragUeberwaelzbarChfPerYear: 0,
    eigentuemerkostenChfPerYear: 300,
    vermietungskostenChfPerYear: 200,
    reinigungServiceUnmoebliertChfPerYear: 0,
    reinigungServiceMoebliertChfPerYear: 0,
  },
  reserven: {},
  hypothek: {
    ersteHypothek: { belehnungPercent: 65, amortisation: { modus: "PROZENT_PRO_JAHR", prozentProJahr: 0 } },
    zweiteHypothek: { belehnungPercent: 5, amortisation: { modus: "DAUER_JAHRE", dauerJahre: 15 } },
    interestRatePercent: 2,
  },
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
    expect(result.moeblierungReserveChfPerJahr).toBeCloseTo(1_000, 5); // (10000*0.70)/7 (Default-Ersatzquote/-Nutzungsdauer)
    expect(result.investmentTreiber.treiber).toHaveLength(5);
    expect(result.stweg).toEqual(fullFacts.stweg); // unveränderte Datenhaltung, siehe StwegFacts
  });

  it("moeblierungsVergleich stellt Paket 1 (unmöbliert) und Paket 2 (möbliert) als vollständige, unabhängige Szenarien nebeneinander", () => {
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const { unmoebliert, moebliert } = result.moeblierungsVergleich;

    expect(unmoebliert.mieteChfPerMonth).toBe(1_450); // = miete.wohnungsMieteChfPerMonth, ohne Möblierungsaufschlag
    expect(moebliert.mieteChfPerMonth).toBe(1_750); // = 1450 + 300 Möblierungsaufschlag
    expect(unmoebliert.kostenInitialChf).toBe(0); // kein Möblierungskosten-Aufwand im unmöblierten Paket
    expect(moebliert.kostenInitialChf).toBe(10_000);
    expect(unmoebliert.reserveChfPerJahr).toBeUndefined();
    expect(moebliert.reserveChfPerJahr).toBeCloseTo(1_000, 5);
    // Beide Szenarien nutzen denselben Leerstand-Faktor (dasselbe Vermietungsmodell) — nur
    // der Möblierungsaufschlag unterscheidet den effektiven Jahresertrag zwischen ihnen.
    expect(moebliert.effektiverJahresertragChf).toBeGreaterThan(unmoebliert.effektiverJahresertragChf);
    expect(moebliert.bruttoRenditePercent).toBeGreaterThan(unmoebliert.bruttoRenditePercent);
  });

  it("Ebene A/B/C zeigen konsistent NUR das per Vermietungsmodell gewählte Szenario — Möblierungsaufschlag/-kosten fliessen nicht ein, wenn unmöbliert gewählt ist, obwohl beide erfasst sind (Regressionstest: vorher inkonsistent zwischen Ebenen)", () => {
    const moebliertGewaehlt = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const unmoebliertGewaehlt = computeBestandsrenditeAnalysis(
      { kaufpreisChf: 870_000, wohnflaecheM2: 75 },
      { ...fullFacts, miete: { ...fullFacts.miete, vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT" } },
    );

    // Dieselben erfassten Möblierungsdaten (300 Aufschlag, 10'000 Kosten) — nur das
    // Vermietungsmodell unterscheidet sich. Renovation ist bewusst NICHT paketgegatet
    // (ein einzelner, gemeinsamer Wert, siehe BestandsrenditeFacts) — fliesst also
    // unverändert in beide Szenarien ein, nur die Möblierungskosten fallen weg.
    expect(unmoebliertGewaehlt.schnellcheck.jahresnettomieteChf).toBe(moebliertGewaehlt.schnellcheck.jahresnettomieteChf - 300 * 12);
    expect(unmoebliertGewaehlt.allInInvestitionChf).toBe(moebliertGewaehlt.allInInvestitionChf - 10_000);
    expect(unmoebliertGewaehlt.investmentCase.wasserfall.noiChf).toBeLessThan(moebliertGewaehlt.investmentCase.wasserfall.noiChf);
    // moeblierungsVergleich zeigt trotzdem weiterhin BEIDE Szenarien im Detail — die
    // Gating-Regel betrifft nur die "Haupt"-Kennzahlen (Ebene A/B/C), nicht den Vergleich.
    expect(unmoebliertGewaehlt.moeblierungsVergleich.moebliert.mieteChfPerMonth).toBe(1_750);
  });

  it("noiBreakdown summiert sich exakt zum bereits bekannten NOI aus dem Cashflow-Wasserfall (Drill-down-Anzeige)", () => {
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const b = result.noiBreakdown;

    expect(b.noiChf).toBe(result.investmentCase.wasserfall.noiChf);
    expect(b.potenziellerJahresertragChf - b.leerstandAbzugChf).toBeCloseTo(b.effektiverJahresertragChf, 6);
    expect(b.betriebskostenTotalChf).toBeCloseTo(
      b.stwegAkontobeitragChfPerYear + b.eigentuemerkostenChfPerYear + b.vermietungskostenChfPerYear + b.reinigungServiceChfPerYear,
      6,
    );
    expect(b.effektiverJahresertragChf - b.betriebskostenTotalChf).toBeCloseTo(b.noiChf, 6);
  });

  it("STWEG-Akontobeitrag: nur der NICHT überwälzbare Anteil fliesst in Schnellcheck/NOI/Mehrjahresmodell ein — Regressionstest, siehe SIPIS/ChatGPT-Benchmark-Vergleich in DECISIONS.md (vorher zählte der gesamte Akontobeitrag als Eigentümerkosten)", () => {
    const ohneAufteilung = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const mitAufteilung = computeBestandsrenditeAnalysis(
      { kaufpreisChf: 870_000, wohnflaecheM2: 75 },
      { ...fullFacts, betriebskosten: { ...fullFacts.betriebskosten, stwegAkontobeitragUeberwaelzbarChfPerYear: 2_000 } },
    );

    // 4'800 (gesamt) − 2'000 (überwälzbar) = 2'800 nicht überwälzbar, statt der vollen 4'800.
    expect(mitAufteilung.noiBreakdown.stwegAkontobeitragChfPerYear).toBe(2_800);
    expect(mitAufteilung.noiBreakdown.stwegAkontobeitragUeberwaelzbarChfPerYear).toBe(2_000);
    expect(ohneAufteilung.noiBreakdown.stwegAkontobeitragChfPerYear).toBe(4_800);
    expect(ohneAufteilung.noiBreakdown.stwegAkontobeitragUeberwaelzbarChfPerYear).toBe(0);

    // Der überwälzbare Anteil entlastet konsistent NOI, Schnellcheck-Cashflow UND das Mehrjahresmodell —
    // nicht nur eine einzelne Anzeige.
    expect(mitAufteilung.investmentCase.wasserfall.noiChf).toBe(ohneAufteilung.investmentCase.wasserfall.noiChf + 2_000);
    expect(mitAufteilung.schnellcheck.groberCashflowChf).toBe(ohneAufteilung.schnellcheck.groberCashflowChf + 2_000);
    expect(mitAufteilung.mehrjahresmodell.years[0].noiChf).toBe(ohneAufteilung.mehrjahresmodell.years[0].noiChf + 2_000);
  });

  it("STWEG-Akontobeitrag: ein überwälzbarer Anteil über dem Gesamtbeitrag wird auf 0 gedeckelt, kein negativer Eigentümerkosten-Anteil", () => {
    const result = computeBestandsrenditeAnalysis(
      { kaufpreisChf: 870_000, wohnflaecheM2: 75 },
      { ...fullFacts, betriebskosten: { ...fullFacts.betriebskosten, stwegAkontobeitragUeberwaelzbarChfPerYear: 9_999 } },
    );
    expect(result.noiBreakdown.stwegAkontobeitragChfPerYear).toBe(0);
  });

  it("dokumentiert jede verwendete Platzhalter-Annahme in assumptionNotes", () => {
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    expect(result.assumptionNotes.length).toBeGreaterThan(0);
    expect(result.assumptionNotes.some((n) => n.includes("Leerstandsquote"))).toBe(true);
  });

  it("nutzt bei bekanntem Kanton ohne Handänderungssteuer (z.B. ZH) einen tieferen Default als ohne Kanton", () => {
    const ohneKanton = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const mitZh = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75, canton: "ZH" }, fullFacts);
    expect(mitZh.allInInvestitionChf).toBeLessThan(ohneKanton.allInInvestitionChf);
  });

  it("ein explizit erfasster Wert für die Handänderungssteuer hat immer Vorrang vor dem kantonalen Default", () => {
    const factsWithExplicitTax: BestandsrenditeFacts = { ...fullFacts, nebenkosten: { ...fullFacts.nebenkosten, handaenderungssteuerPercent: 3.3 } };
    const mitZh = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75, canton: "ZH" }, factsWithExplicitTax);
    const mitGe = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75, canton: "GE" }, factsWithExplicitTax);
    expect(mitZh.allInInvestitionChf).toEqual(mitGe.allInInvestitionChf);
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
    expect(result.moeblierungReserveChfPerJahr).toBeUndefined();
    expect(result.allInInvestitionChf).toBeLessThan(computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts).allInInvestitionChf);
  });

  it("parkplatzImKaufpreisEnthalten=true addiert den Parkplatz-Kaufpreis NICHT zusätzlich (verhindert Doppelzählung)", () => {
    const ohneFlag = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    expect(ohneFlag.schnellcheck.kaufpreisChf).toBe(900_000); // 870k Wohnung + 30k Parkplatz separat

    const mitFlag: BestandsrenditeFacts = { ...fullFacts, parkplatzImKaufpreisEnthalten: true };
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, mitFlag);
    expect(result.schnellcheck.kaufpreisChf).toBe(870_000); // Parkplatz bereits im Kaufpreis, kein Doppelzählen
    expect(result.allInInvestitionChf).toBeLessThan(ohneFlag.allInInvestitionChf);
  });

  it("Parkplatz und Garagenplatz können gleichzeitig erfasst sein und addieren sich beide zum Kaufpreis, unabhängig voneinander ausschliessbar", () => {
    const beide: BestandsrenditeFacts = { ...fullFacts, parkplatzKaufpreisChf: 20_000, garagenplatzKaufpreisChf: 35_000 };
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, beide);
    expect(result.schnellcheck.kaufpreisChf).toBe(925_000); // 870k + 20k Parkplatz + 35k Garage
    expect(result.parkierung).toEqual({ parkplatzZusatzChf: 20_000, garagenplatzZusatzChf: 35_000, hobbyraumZusatzChf: 0, totalZusatzChf: 55_000 });

    const nurGarageEnthalten: BestandsrenditeFacts = { ...beide, garagenplatzImKaufpreisEnthalten: true };
    const resultNurGarage = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, nurGarageEnthalten);
    expect(resultNurGarage.schnellcheck.kaufpreisChf).toBe(890_000); // nur der Parkplatz zählt zusätzlich, die Garage ist bereits im Kaufpreis
    expect(resultNurGarage.parkierung).toEqual({ parkplatzZusatzChf: 20_000, garagenplatzZusatzChf: 0, hobbyraumZusatzChf: 0, totalZusatzChf: 20_000 });
  });

  it("Hobbyraum verhält sich analog zu Parkplatz/Garage: addiert sich zusätzlich zum Kaufpreis, ausser wenn bereits enthalten", () => {
    const mitHobbyraum: BestandsrenditeFacts = { ...fullFacts, hobbyraumKaufpreisChf: 15_000 };
    const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, mitHobbyraum);
    expect(result.schnellcheck.kaufpreisChf).toBe(915_000); // 870k Wohnung + 30k Parkplatz + 15k Hobbyraum
    expect(result.parkierung).toEqual({ parkplatzZusatzChf: 30_000, garagenplatzZusatzChf: 0, hobbyraumZusatzChf: 15_000, totalZusatzChf: 45_000 });

    const hobbyraumEnthalten: BestandsrenditeFacts = { ...mitHobbyraum, hobbyraumImKaufpreisEnthalten: true };
    const resultEnthalten = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, hobbyraumEnthalten);
    expect(resultEnthalten.schnellcheck.kaufpreisChf).toBe(900_000); // Hobbyraum bereits im Kaufpreis, kein Doppelzählen
  });

  describe("kategorienRenditen", () => {
    it("berechnet für jede Kategorie eine eigene Brutto-Rendite aus deren eigenem Kaufpreis/Miete", () => {
      const facts: BestandsrenditeFacts = {
        ...fullFacts,
        garagenplatzKaufpreisChf: 40_000,
        hobbyraumKaufpreisChf: 10_000,
        miete: { ...fullFacts.miete, parkplatzMieteChfPerMonth: 150, garagenplatzMieteChfPerMonth: 200, hobbyraumMieteChfPerMonth: 50 },
      };
      const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, facts);

      expect(result.kategorienRenditen.wohnung).toEqual({ kaufpreisChf: 870_000, jahresmieteChf: 1_450 * 12, bruttoRenditePercent: ((1_450 * 12) / 870_000) * 100 });
      expect(result.kategorienRenditen.aussenparkplatz).toEqual({ kaufpreisChf: 30_000, jahresmieteChf: 150 * 12, bruttoRenditePercent: ((150 * 12) / 30_000) * 100 });
      expect(result.kategorienRenditen.garage).toEqual({ kaufpreisChf: 40_000, jahresmieteChf: 200 * 12, bruttoRenditePercent: ((200 * 12) / 40_000) * 100 });
      expect(result.kategorienRenditen.hobbyraum).toEqual({ kaufpreisChf: 10_000, jahresmieteChf: 50 * 12, bruttoRenditePercent: ((50 * 12) / 10_000) * 100 });
    });

    it("liefert 0% Rendite statt eines Fehlers, wenn eine Kategorie keinen Kaufpreis hat", () => {
      const result = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
      expect(result.kategorienRenditen.garage).toEqual({ kaufpreisChf: 0, jahresmieteChf: 0, bruttoRenditePercent: 0 });
      expect(result.kategorienRenditen.hobbyraum).toEqual({ kaufpreisChf: 0, jahresmieteChf: 0, bruttoRenditePercent: 0 });
    });

    it("Garage-/Hobbyraum-Miete fliesst weiterhin vollständig in die Gesamtrechnung (Schnellcheck/Investment Case) ein, nicht nur in die Einzelkategorie", () => {
      const ohne = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
      const mitGarageMiete: BestandsrenditeFacts = { ...fullFacts, garagenplatzKaufpreisChf: 40_000, miete: { ...fullFacts.miete, garagenplatzMieteChfPerMonth: 200 } };
      const mit = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, mitGarageMiete);
      expect(mit.schnellcheck.jahresnettomieteChf).toBe(ohne.schnellcheck.jahresnettomieteChf + 200 * 12);
    });
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

  it("Renovation ist EIN gemeinsamer Wert (nicht paketgegatet) — fliesst unverändert in beide Vermietungsmodelle ein", () => {
    const moebliert = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const unmoebliert = computeBestandsrenditeAnalysis(
      { kaufpreisChf: 870_000, wohnflaecheM2: 75 },
      { ...fullFacts, miete: { ...fullFacts.miete, vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT" } },
    );
    // Nur die Möblierungskosten (10'000) fallen beim Wechsel weg, die Renovationskosten
    // (25'000, ein gemeinsamer Wert) bleiben in beiden Szenarien identisch enthalten.
    expect(moebliert.allInInvestitionChf - unmoebliert.allInInvestitionChf).toBe(10_000);
  });

  it("Reparatur/Reinigung sind je Vermietungsmodell (Paket 1/2) separat erfasst — nur der Betrag des gewählten Modells fliesst ein", () => {
    const facts: BestandsrenditeFacts = {
      ...fullFacts,
      reparatur: { initialUnmoebliertChf: 8_000, initialMoebliertChf: 3_000 },
      betriebskosten: { ...fullFacts.betriebskosten, reinigungServiceUnmoebliertChfPerYear: 600, reinigungServiceMoebliertChfPerYear: 2_400 },
    };
    const moebliert = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, facts);
    const unmoebliert = computeBestandsrenditeAnalysis(
      { kaufpreisChf: 870_000, wohnflaecheM2: 75 },
      { ...facts, miete: { ...facts.miete, vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT" } },
    );

    // All-in-Investition enthält je Paket nur dessen eigene Reparaturkosten (zusätzlich zu den unveränderten Möblierungskosten).
    expect(moebliert.allInInvestitionChf - unmoebliert.allInInvestitionChf).toBeCloseTo(10_000 + (3_000 - 8_000), 5); // Möblierung + Reparaturdifferenz
    // NOI (Investment Case) berücksichtigt je Paket nur dessen eigene Reinigungskosten —
    // höhere Reinigungskosten bei möbliert senken den NOI zusätzlich zur höheren Miete.
    expect(moebliert.noiBreakdown.reinigungServiceChfPerYear).toBe(2_400);
    expect(unmoebliert.noiBreakdown.reinigungServiceChfPerYear).toBe(600);
  });
});

describe("computeVerhandlungskorridor", () => {
  it("Maximum ist der Kaufpreis, bei dem der nachhaltige Cashflow gerade CHF 0 erreicht; Zielpreis leitet sich aus dem Renditeziel her; Eröffnung bleibt ohne manuelle Eingabe undefined", () => {
    const korridor = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    expect(korridor.maximumChf).toBeDefined();
    expect(korridor.zielChf).toBeDefined();
    expect(korridor.eroeffnungChf).toBeUndefined();
    expect(korridor.zielChf!).toBeLessThanOrEqual(korridor.maximumChf!);

    // Am gefundenen Maximum ist der nachhaltige Cashflow tatsächlich ~CHF 0.
    const amMaximum = computeBestandsrenditeAnalysis({ kaufpreisChf: korridor.maximumChf!, wohnflaecheM2: 75 }, fullFacts);
    expect(amMaximum.investmentCase.wasserfall.nachhaltigerCashflowChf).toBeCloseTo(0, 0);

    // Am Zielpreis erreicht die Bruttorendite (Kaufpreis) exakt das Renditeziel (Default 4.5%).
    const amZiel = computeBestandsrenditeAnalysis({ kaufpreisChf: korridor.zielChf!, wohnflaecheM2: 75 }, fullFacts);
    expect(amZiel.schnellcheck.bruttoRenditePercent).toBeCloseTo(4.5, 1);
  });

  it("eigenes Eröffnungsangebot (Marktrecherche) wird unverändert durchgereicht, nicht mehr rechnerisch aus dem Maximum hergeleitet", () => {
    const ohneAngebot = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    expect(ohneAngebot.eroeffnungChf).toBeUndefined();

    const mitAngebot: BestandsrenditeFacts = { ...fullFacts, eroeffnungsangebotChf: 800_000 };
    const korridor = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, mitAngebot);
    expect(korridor.eroeffnungChf).toBe(800_000);
  });

  it("ein höherer Zinssatz senkt das rechnerische Maximum (weniger Preis bei teurerer Finanzierung tragbar)", () => {
    const guenstig = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    const teuer: BestandsrenditeFacts = { ...fullFacts, hypothek: { ...fullFacts.hypothek, interestRatePercent: 4 } };
    const teurerZins = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, teuer);
    expect(teurerZins.maximumChf!).toBeLessThan(guenstig.maximumChf!);
  });

  it("ein höheres Renditeziel senkt den Zielpreis (strengeres Ziel verlangt mehr Rendite bei tieferem Preis)", () => {
    const tiefesZiel = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts, { bruttoRenditeZielPercent: 4.5 });
    const hohesZiel = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts, { bruttoRenditeZielPercent: 6 });
    expect(hohesZiel.zielChf!).toBeLessThan(tiefesZiel.zielChf!);
  });

  it("nettoZielChf: Kaufpreis, bei dem die Nettorendite vor Finanzierung das Nettorenditeziel erreicht — regressionsrelevant, siehe SIPIS/ChatGPT-Benchmark-Vergleich in DECISIONS.md (Maximum war rechnerisch korrekt, aber als Solvenzgrenze allein irreführend, da weit über einem an der Nettorendite gemessenen sinnvollen Kaufpreis)", () => {
    const korridor = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts);
    expect(korridor.nettoZielChf).toBeDefined();
    expect(korridor.nettoZielChf!).toBeLessThanOrEqual(korridor.maximumChf!);

    // Am gefundenen Preis erreicht die Nettorendite vor Finanzierung exakt das Nettorenditeziel (Default 3%).
    const amNettoZiel = computeBestandsrenditeAnalysis({ kaufpreisChf: korridor.nettoZielChf!, wohnflaecheM2: 75 }, fullFacts);
    expect(amNettoZiel.investmentCase.nettoRenditeVorFinanzierungPercent).toBeCloseTo(3, 0);

    // Die Nettorendite zieht zusätzlich Leerstand/Betriebskosten/Eigentümerkosten ab und
    // braucht daher i.d.R. einen tieferen Preis als die reine Bruttorendite, um dasselbe
    // Ziel-Niveau zu erreichen — nettoZielChf liegt darum nicht über zielChf.
    expect(korridor.nettoZielChf!).toBeLessThanOrEqual(korridor.zielChf!);
  });

  it("ein höheres Nettorenditeziel senkt die Preisobergrenze (Nettorendite) analog zum Bruttorenditeziel", () => {
    const tiefesZiel = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts, { nettoRenditeZielPercent: 2 });
    const hohesZiel = computeVerhandlungskorridor({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, fullFacts, { nettoRenditeZielPercent: 4 });
    expect(hohesZiel.nettoZielChf!).toBeLessThan(tiefesZiel.nettoZielChf!);
  });
});

describe("isAllowedUpdateField / applyFieldUpdate", () => {
  it("erlaubt nur die explizit gelisteten Feldpfade", () => {
    expect(isAllowedUpdateField("miete.wohnungsMieteChfPerMonth")).toBe(true);
    expect(isAllowedUpdateField("stweg.erneuerungsfondsSaldoChf")).toBe(true);
    expect(isAllowedUpdateField("stweg.erneuerungsfondsWohnungsanteilChf")).toBe(true);
    expect(isAllowedUpdateField("erfundenes.feld")).toBe(false);
    expect(isAllowedUpdateField("miete.wohnungsMieteChfPerMonth.zuTief")).toBe(false);
  });

  it("hält Erneuerungsfonds-Gesamtsaldo und -Wohnungsanteil als getrennte Felder auseinander, keins überschreibt das andere", () => {
    const facts = { stweg: { erneuerungsfondsSaldoChf: 238_701.66 } };
    const updated = applyFieldUpdate(facts, "stweg.erneuerungsfondsWohnungsanteilChf", 10_135.3);
    expect(updated.stweg).toEqual({ erneuerungsfondsSaldoChf: 238_701.66, erneuerungsfondsWohnungsanteilChf: 10_135.3 });
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

  it("erlaubt auch Feldpfade ohne Punkt (liegen direkt auf der Wurzel von facts)", () => {
    expect(isAllowedUpdateField("zimmerzahl")).toBe(true);
    expect(isAllowedUpdateField("baujahr")).toBe(true);
    expect(isAllowedUpdateField("parkplatzKaufpreisChf")).toBe(true);
    expect(isAllowedUpdateField("garagenplatzKaufpreisChf")).toBe(true);
  });

  it("setzt ein Feld ohne Punkt direkt auf der Wurzel, ohne andere Felder anzutasten", () => {
    const facts = { zimmerzahl: 3, miete: { wohnungsMieteChfPerMonth: 1200 } };
    const updated = applyFieldUpdate(facts, "baujahr", 1998);
    expect(updated).toEqual({ zimmerzahl: 3, baujahr: 1998, miete: { wohnungsMieteChfPerMonth: 1200 } });
  });
});
