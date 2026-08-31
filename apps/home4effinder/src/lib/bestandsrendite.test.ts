import { describe, it, expect } from "vitest";
import {
  computeBestandsrenditeAnalysis,
  computeVerhandlungskorridor,
  computePreisStufentabelle,
  strengsteZielgroesse,
  verhandlungskorridorRelation,
  parseBestandsrenditeFacts,
  applyFieldUpdate,
  isAllowedUpdateField,
  type BestandsrenditeFacts,
} from "./bestandsrendite";

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
  reparatur: { jaehrlichUnmoebliertChf: 0, jaehrlichMoebliertChf: 0 },
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
    nebenkostenMoebliertChfPerYear: 0,
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
      b.stwegAkontobeitragChfPerYear +
        b.eigentuemerkostenChfPerYear +
        b.vermietungskostenChfPerYear +
        b.reinigungServiceChfPerYear +
        b.reparaturChfPerYear +
        b.nebenkostenMoebliertChfPerYear,
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
    // Der informative "überwälzbar"-Ausweis darf ebenfalls nicht grösser als der
    // Gesamtbeitrag (4'800, siehe fullFacts) erscheinen — sonst zeigte die UI einen
    // überwälzbaren Anteil, der grösser als das Gesamt-Akontobeitrag ist (Review-Fund).
    expect(result.noiBreakdown.stwegAkontobeitragUeberwaelzbarChfPerYear).toBe(4_800);
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

  it("Reparatur/Reinigung/möblierte Nebenkosten sind je Vermietungsmodell (Paket 1/2) separat erfasst — nur der Betrag des gewählten Modells fliesst ein", () => {
    const facts: BestandsrenditeFacts = {
      ...fullFacts,
      reparatur: { jaehrlichUnmoebliertChf: 800, jaehrlichMoebliertChf: 300 },
      betriebskosten: {
        ...fullFacts.betriebskosten,
        reinigungServiceUnmoebliertChfPerYear: 600,
        reinigungServiceMoebliertChfPerYear: 2_400,
        nebenkostenMoebliertChfPerYear: 1_500,
      },
    };
    const moebliert = computeBestandsrenditeAnalysis({ kaufpreisChf: 870_000, wohnflaecheM2: 75 }, facts);
    const unmoebliert = computeBestandsrenditeAnalysis(
      { kaufpreisChf: 870_000, wohnflaecheM2: 75 },
      { ...facts, miete: { ...facts.miete, vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT" } },
    );

    // Reparaturkosten sind jährlich wiederkehrend und fliessen daher NICHT in die
    // All-in-Investition ein — nur die Möblierungskosten (10'000) machen hier den Unterschied.
    expect(moebliert.allInInvestitionChf - unmoebliert.allInInvestitionChf).toBe(10_000);
    // NOI (Investment Case) berücksichtigt je Paket nur dessen eigene Reinigungs-/
    // Reparaturkosten — höhere laufende Kosten bei möbliert senken den NOI zusätzlich
    // zur höheren Miete.
    expect(moebliert.noiBreakdown.reinigungServiceChfPerYear).toBe(2_400);
    expect(unmoebliert.noiBreakdown.reinigungServiceChfPerYear).toBe(600);
    expect(moebliert.noiBreakdown.reparaturChfPerYear).toBe(300);
    expect(unmoebliert.noiBreakdown.reparaturChfPerYear).toBe(800);
    // Möblierte Nebenkosten (WLAN/Kabel/Streaming/Abfall) nur bei möbliert relevant, 0 bei unmöbliert.
    expect(moebliert.noiBreakdown.nebenkostenMoebliertChfPerYear).toBe(1_500);
    expect(unmoebliert.noiBreakdown.nebenkostenMoebliertChfPerYear).toBe(0);
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

describe("computePreisStufentabelle", () => {
  const property = { kaufpreisChf: 870_000, wohnflaecheM2: 75 };

  it("liefert mehrere Stufen zwischen Preisobergrenze (Nettorendite) und aktuellem Kaufpreis, mit genau einer exakt als aktuell markierten Zeile — Wunsch aus dem SIPIS/ChatGPT-Benchmark-Vergleich, siehe DECISIONS.md", () => {
    const korridor = computeVerhandlungskorridor(property, fullFacts);
    const stufen = computePreisStufentabelle(property, fullFacts, korridor);

    expect(stufen.length).toBeGreaterThanOrEqual(2);
    // Aufsteigend sortiert.
    for (let i = 1; i < stufen.length; i++) expect(stufen[i].kaufpreisChf).toBeGreaterThan(stufen[i - 1].kaufpreisChf);

    const aktuelleZeilen = stufen.filter((s) => s.istAktuellerKaufpreis);
    expect(aktuelleZeilen).toHaveLength(1);
    expect(aktuelleZeilen[0].kaufpreisChf).toBe(870_000);

    // Jede Zeile stimmt mit einer direkten Neuberechnung bei diesem Kaufpreis überein
    // (keine eigenständige, potenziell abweichende Formel).
    for (const stufe of stufen) {
      const direkt = computeBestandsrenditeAnalysis({ ...property, kaufpreisChf: stufe.kaufpreisChf }, fullFacts);
      expect(stufe.bruttoRenditePercent).toBeCloseTo(direkt.investmentCase.bruttoRenditeKaufpreisPercent, 6);
      expect(stufe.nettoRenditeVorFinanzierungPercent).toBeCloseTo(direkt.investmentCase.nettoRenditeVorFinanzierungPercent, 6);
      expect(stufe.nachhaltigerCashflowChf).toBeCloseTo(direkt.investmentCase.wasserfall.nachhaltigerCashflowChf, 2);
    }
  });

  it("ist leer, wenn weder Netto- noch Bruttorenditeziel gesetzt sind (kein Ankerpunkt für die Spanne)", () => {
    const korridorOhneZiele = computeVerhandlungskorridor(property, fullFacts, { bruttoRenditeZielPercent: 0, nettoRenditeZielPercent: 0 });
    expect(korridorOhneZiele.zielChf).toBeUndefined();
    expect(korridorOhneZiele.nettoZielChf).toBeUndefined();
    expect(computePreisStufentabelle(property, fullFacts, korridorOhneZiele)).toEqual([]);
  });

  it("ist leer, wenn Ziel-Preis und aktueller Kaufpreis nach Rundung auf CHF 5'000 zusammenfallen", () => {
    const korridorAmZiel = { maximumChf: 900_000, zielChf: 871_000, nettoZielChf: 871_000, eroeffnungChf: undefined };
    expect(computePreisStufentabelle(property, fullFacts, korridorAmZiel)).toEqual([]);
  });

  it("verwendet als unteren Anker die STRENGERE (tiefere) der beiden Zielgrössen, nicht unbedingt nettoZielChf — Review-Fund: nettoRenditeZielPercent kann auf dem Annahmen-Reiter lockerer als bruttoRenditeZielPercent gesetzt werden, dann ist zielChf die strengere/tiefere Grenze", () => {
    // nettoZielChf (850k) locker gesetzt, zielChf (800k) ist hier die strengere/tiefere Grenze.
    const korridorNettoWenigerStreng = { maximumChf: 900_000, zielChf: 800_000, nettoZielChf: 850_000, eroeffnungChf: undefined };
    const stufen = computePreisStufentabelle(property, fullFacts, korridorNettoWenigerStreng);
    expect(stufen[0].kaufpreisChf).toBe(800_000);

    // Umgekehrter Fall (nettoZielChf ist die strengere Grenze) bleibt wie zuvor korrekt.
    const korridorZielWenigerStreng = { maximumChf: 900_000, zielChf: 850_000, nettoZielChf: 800_000, eroeffnungChf: undefined };
    const stufenUmgekehrt = computePreisStufentabelle(property, fullFacts, korridorZielWenigerStreng);
    expect(stufenUmgekehrt[0].kaufpreisChf).toBe(800_000);
  });

  it("ergänzt Economic Target/Investment Value/Walk-Away Price/Angebotspreis als exakte, benannte Zeilen — auch ausserhalb der interpolierten Spanne", () => {
    // maximumChf (900k) liegt bewusst weit ausserhalb der interpolierten Spanne
    // (Economic Target 800k bis Angebotspreis 870k) — muss trotzdem als eigene Zeile
    // erscheinen (Auftrag: "Walk-Away Price muss als eigene Zeile enthalten sein").
    const korridor = { maximumChf: 900_000, zielChf: 800_000, nettoZielChf: 820_000, eroeffnungChf: undefined };
    const stufen = computePreisStufentabelle(property, fullFacts, korridor);

    const economicTarget = stufen.find((s) => s.kaufpreisChf === 800_000);
    expect(economicTarget?.anchorLabel).toBe("Economic Target");
    const investmentValue = stufen.find((s) => s.kaufpreisChf === 820_000);
    expect(investmentValue?.anchorLabel).toBe("Investment Value");
    const angebotspreis = stufen.find((s) => s.kaufpreisChf === 870_000);
    expect(angebotspreis?.anchorLabel).toBe("Angebotspreis");
    const walkAway = stufen.find((s) => s.kaufpreisChf === 900_000);
    expect(walkAway).toBeDefined();
    expect(walkAway?.anchorLabel).toBe("Walk-Away Price");
    // Aufsteigend sortiert bleibt auch mit dem ausserhalb liegenden Anker erhalten.
    expect(stufen[stufen.length - 1].kaufpreisChf).toBe(900_000);

    // Zwischenstufen ohne besondere Bedeutung bleiben unbenannt.
    const zwischenstufe = stufen.find((s) => s.kaufpreisChf !== 800_000 && s.kaufpreisChf !== 820_000 && s.kaufpreisChf !== 870_000 && s.kaufpreisChf !== 900_000);
    expect(zwischenstufe?.anchorLabel).toBeUndefined();
  });

  it("führt mehrere zusammenfallende Anker zu einem gemeinsamen Label zusammen, statt doppelte Zeilen zu erzeugen", () => {
    // zielChf und nettoZielChf identisch (400k) -> Economic Target UND Investment Value fallen zusammen.
    const korridor = { maximumChf: 900_000, zielChf: 400_000, nettoZielChf: 400_000, eroeffnungChf: undefined };
    const stufen = computePreisStufentabelle(property, fullFacts, korridor);
    const zusammenfall = stufen.find((s) => s.kaufpreisChf === 400_000);
    expect(zusammenfall?.anchorLabel).toBe("Economic Target / Investment Value");
    // Keine doppelte Zeile für denselben Kaufpreis.
    expect(stufen.filter((s) => s.kaufpreisChf === 400_000)).toHaveLength(1);
  });

  it("liefert je Zeile Total-Investition/Eigenkapital/Cash-on-Cash konsistent mit einer direkten Neuberechnung", () => {
    const korridor = computeVerhandlungskorridor(property, fullFacts);
    const stufen = computePreisStufentabelle(property, fullFacts, korridor);
    for (const stufe of stufen) {
      const direkt = computeBestandsrenditeAnalysis({ ...property, kaufpreisChf: stufe.kaufpreisChf }, fullFacts);
      expect(stufe.totalInvestitionChf).toBeCloseTo(direkt.allInInvestitionChf, 2);
      expect(stufe.eigenkapitalChf).toBeCloseTo(direkt.eigenkapitalChf, 2);
      expect(stufe.cashOnCashPercent).toBeCloseTo(direkt.investmentCase.cashOnCashPercent, 6);
    }
  });
});

describe("computeBestandsrenditeAnalysis — incrementalFurnitureNoi", () => {
  const property = { kaufpreisChf: 870_000, wohnflaecheM2: 75 };
  // leerstandPercent: 0 auf beiden Seiten (gilt laut computeBestandsrenditeAnalysis für
  // beide Vergleichsszenarien gleich, siehe Modulkommentar dort) — macht effektiver =
  // potenzieller Jahresertrag, damit sich die erwarteten CHF-Werte exakt von Hand
  // nachrechnen lassen statt von den Platzhalter-Leerstand-Defaults abzuhängen.
  const baseFacts: BestandsrenditeFacts = {
    ...fullFacts,
    miete: { ...fullFacts.miete, leerstandPercent: 0 },
  };

  it("ist positiv, wenn der Mietaufschlag die möblierungsspezifischen Zusatzkosten (Reinigung + Ersatzreserve) übersteigt", () => {
    const facts: BestandsrenditeFacts = {
      ...baseFacts,
      moeblierung: { initialCostChf: 12_000, mietPremiumChfPerMonth: 300, jaehrlicherErsatzsatzPercent: 100, nutzungsdauerJahre: 10 },
      betriebskosten: { ...baseFacts.betriebskosten, reinigungServiceUnmoebliertChfPerYear: 0, reinigungServiceMoebliertChfPerYear: 600 },
    };
    const result = computeBestandsrenditeAnalysis(property, facts);
    // Reserve = 12'000 × 100% ÷ 10 Jahre = 1'200/Jahr. Mehrertrag = 300×12 = 3'600.
    // Inkrementeller NOI = 3'600 − 600 (Reinigung) − 1'200 (Reserve) = 1'800.
    expect(result.incrementalFurnitureNoi).toBeDefined();
    expect(result.incrementalFurnitureNoi!.incrementalNoiChf).toBeCloseTo(1_800, 5);
    expect(result.incrementalFurnitureNoi!.furnishedNoiChf - result.incrementalFurnitureNoi!.unfurnishedNoiChf).toBeCloseTo(1_800, 5);
  });

  it("ist NEGATIV trotz positivem Mehrertrag, wenn die Zusatzkosten den Mehrertrag übersteigen — Guardrail 'höherer Umsatz ≠ höherer Gewinn'", () => {
    const facts: BestandsrenditeFacts = {
      ...baseFacts,
      moeblierung: { initialCostChf: 12_000, mietPremiumChfPerMonth: 100, jaehrlicherErsatzsatzPercent: 100, nutzungsdauerJahre: 10 },
      betriebskosten: { ...baseFacts.betriebskosten, reinigungServiceUnmoebliertChfPerYear: 0, reinigungServiceMoebliertChfPerYear: 2_000 },
    };
    const result = computeBestandsrenditeAnalysis(property, facts);
    // Mehrertrag = 100×12 = 1'200 (positiv!). Reserve = 1'200/Jahr, Reinigung = 2'000/Jahr.
    // Inkrementeller NOI = 1'200 − 2'000 − 1'200 = −2'000 (negativ trotz positivem Mehrertrag).
    expect(result.incrementalFurnitureNoi).toBeDefined();
    expect(result.incrementalFurnitureNoi!.incrementalNoiChf).toBeCloseTo(-2_000, 5);
  });

  it("ist undefined, wenn keine Möblierungskosten erfasst sind — dieselbe Gating-Bedingung wie furnitureRoi", () => {
    const facts: BestandsrenditeFacts = { ...baseFacts, moeblierung: { initialCostChf: 0, mietPremiumChfPerMonth: 0 } };
    const result = computeBestandsrenditeAnalysis(property, facts);
    expect(result.incrementalFurnitureNoi).toBeUndefined();
    expect(result.furnitureRoi).toBeUndefined();
  });
});

describe("strengsteZielgroesse", () => {
  it("wählt die tiefere der beiden Zielgrössen, wenn beide gesetzt sind", () => {
    expect(strengsteZielgroesse({ zielChf: 800_000, nettoZielChf: 850_000 })).toBe(800_000);
    expect(strengsteZielgroesse({ zielChf: 850_000, nettoZielChf: 800_000 })).toBe(800_000);
  });

  it("fällt auf die jeweils einzeln gesetzte Grösse zurück, wenn nur eine definiert ist", () => {
    expect(strengsteZielgroesse({ zielChf: 800_000, nettoZielChf: undefined })).toBe(800_000);
    expect(strengsteZielgroesse({ zielChf: undefined, nettoZielChf: 800_000 })).toBe(800_000);
  });

  it("liefert undefined, wenn keine der beiden Grössen gesetzt ist", () => {
    expect(strengsteZielgroesse({ zielChf: undefined, nettoZielChf: undefined })).toBeUndefined();
  });
});

describe("verhandlungskorridorRelation", () => {
  it("berechnet CHF- und Prozent-Differenz zum Inseratpreis — negativ, wenn der Punkt unter dem Inseratpreis liegt", () => {
    const relation = verhandlungskorridorRelation(783_000, 870_000);
    expect(relation).toBeDefined();
    expect(relation!.diffChf).toBe(-87_000);
    expect(relation!.diffPercent).toBeCloseTo(-10, 5);
  });

  it("berechnet eine positive Differenz, wenn der Punkt über dem Inseratpreis liegt", () => {
    const relation = verhandlungskorridorRelation(950_000, 870_000);
    expect(relation!.diffChf).toBe(80_000);
    expect(relation!.diffPercent).toBeGreaterThan(0);
  });

  it("liefert undefined, wenn der Punkt selbst undefined ist oder kein positiver Inseratpreis vorliegt", () => {
    expect(verhandlungskorridorRelation(undefined, 870_000)).toBeUndefined();
    expect(verhandlungskorridorRelation(800_000, 0)).toBeUndefined();
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
