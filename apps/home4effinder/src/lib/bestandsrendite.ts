import type { StwegFacts } from "@landfinder/domain";
import { getCantonDefaults } from "./cantonDefaults";
import {
  BESTANDSRENDITE_PARAMETERS,
  defaultsOf,
  calculateNebenkosten,
  calculateAllInInvestition,
  calculateSchnellcheck,
  calculateInvestmentCase,
  calculateJahresertrag,
  calculateBetriebskosten,
  breakEvenMieteChfPerMonth,
  breakEvenZinsPercent,
  breakEvenAuslastungPercent,
  bisectRoot,
  resolveReserveChf,
  resolveAmortisationChfPerYear,
  type Vermietungsmodell,
  type InvestmentCaseInput,
  type SchnellcheckResult,
  type InvestmentCaseResult,
  type AmortisationSpec,
  type AmortisationModus,
  type BestandsrenditeParameterKey,
} from "@landfinder/financial-engine";
import {
  calculateRenovationRoi,
  moeblierungGeglaetteReserveChfPerJahr,
  summarizeRenovationPositionen,
  calculateFurnishedOpex,
  calculateFurnishingRoi,
  calculateFurnishedRentalDelta,
  type RenovationPosition,
  type ValueAddRoiResult,
  type RenovationPositionenSummary,
  type MoebliertBetriebskostenInput,
  type FurnishedOpexBreakdown,
  type FurnishedRentalDeltaResult,
} from "@landfinder/financial-engine";
import {
  runMehrjahresmodell,
  computeInvestmentTreiber,
  type MehrjahresmodellResult,
  type InvestmentTreiberResult,
} from "@landfinder/financial-engine";

/** Siehe `BestandsrenditeFacts.openingBidFaktoren`/`priceStrategy.ts::computeOpeningBidSuggestion`. */
export type VerkaeufermotivationStufe = "NIEDRIG" | "MITTEL" | "HOCH";
export type KonkurrenzStufe = "NIEDRIG" | "MITTEL" | "HOCH";
export type CapexRisikoStufe = "NIEDRIG" | "MITTEL" | "HOCH";
export type Dokumentationsluecken = "KEINE" | "EINIGE" | "VIELE";
export type Vermietungsstatus = "VERMIETET" | "UNVERMIETET";

/**
 * Taktische Einschätzungsfaktoren für den Eröffnungsangebot-Vorschlag (Auftrag Abschnitt
 * 8) — jedes Feld einzeln optional und vom Nutzer selbst eingeschätzt, keine
 * automatisch abgeleiteten Werte. Reine Datenhaltung hier, die eigentliche
 * Vorschlagsrechnung lebt bewusst in `priceStrategy.ts` (Preisstrategie-Modul).
 */
export interface OpeningBidFaktoren {
  tageAmMarkt?: number;
  preisreduktionenAnzahl?: number;
  verkaeufermotivation?: VerkaeufermotivationStufe;
  konkurrenzsituation?: KonkurrenzStufe;
  capexRisikoStufe?: CapexRisikoStufe;
  dokumentationsluecken?: Dokumentationsluecken;
  vermietungsstatus?: Vermietungsstatus;
}

/**
 * Manuell erfasste Bestandsrendite-Fakten (`properties.bestandsrendite`, Migration
 * 0001). Jedes optionale Feld fällt auf den ehrlich als Platzhalter markierten
 * Default aus `BESTANDSRENDITE_PARAMETERS` zurück — nichts wird erfunden, jede
 * Annahme ist im Parameter-Register nachvollziehbar.
 */
export interface BestandsrenditeFacts {
  zimmerzahl?: number;
  baujahr?: number;
  /** Offener/Aussen-Parkplatz — getrennt von `garagenplatzKaufpreisChf` (Tiefgaragenplatz/Garage), da beide gleichzeitig vorhanden sein können (z.B. ein Aussenparkplatz UND ein separater Garagenplatz). */
  parkplatzKaufpreisChf: number;
  /** Manuell gesetzt: Inserats-/Kaufpreis (Objekt-Basisdaten) enthält den Parkplatz bereits — dann wird `parkplatzKaufpreisChf` NICHT zusätzlich addiert (verhindert Doppelzählung), bleibt aber informativ erfasst. */
  parkplatzImKaufpreisEnthalten: boolean;
  /** Tiefgaragenplatz/Garage — rechnerisch identisch zu `parkplatzKaufpreisChf` behandelt (reine Kategorisierung/Beschriftung, keine unterschiedliche Formel), aber als eigenes Feld, da ein Objekt beide Parkierungsarten gleichzeitig haben kann. */
  garagenplatzKaufpreisChf: number;
  /** Analog zu `parkplatzImKaufpreisEnthalten`, aber für den Garagenplatz. */
  garagenplatzImKaufpreisEnthalten: boolean;
  /** Separat erfassbarer Hobbyraum (z.B. Kellerabteil-Ausbau) — rechnerisch identisch zu den beiden Parkierungsarten behandelt, eigenes Feld aus demselben Grund (kann zusätzlich zu Parkplatz/Garage vorhanden sein). */
  hobbyraumKaufpreisChf: number;
  /** Analog zu `parkplatzImKaufpreisEnthalten`, aber für den Hobbyraum. */
  hobbyraumImKaufpreisEnthalten: boolean;

  stweg: StwegFacts;

  nebenkosten: {
    handaenderungssteuerPercent?: number;
    notariatGrundbuchPercent?: number;
    maklerprovisionPercent?: number;
  };

  renovation: {
    initialRenovationCostChf: number;
    positionen: RenovationPosition[];
    /** Für den Renovation-ROI (Mehrertrag ÷ Kosten) — beide optional, ohne sie kein ROI berechenbar. */
    mieteVorRenovationChfPerMonth?: number;
    mieteNachRenovationChfPerMonth?: number;
  };

  /**
   * Jährlich wiederkehrende Reparaturkosten NUR für unmöbliert (Paket 1) — Rückmeldung:
   * "die kosten für reparaturen sind jährlich wiederkehrende kosten", Teil der
   * Betriebskosten/des NOI wie z.B. Reinigung/Service. Das möblierte Pendant lebt seit
   * dem SIPIS Furnished-Rental-Modul (v1.1) granularer in
   * `moebliertBetriebskosten.kleinreparaturenChfPerMonth`, nicht mehr hier. Bewusst
   * weiterhin getrennt von `reserven.reparatur*`: das dort ist eine zusätzliche
   * SICHERHEITSRESERVE für unvorhergesehene künftige Reparaturen, nach Steuer am Ende
   * des Cashflow-Wasserfalls abgezogen — hier geht es um die tatsächlich erwarteten,
   * bereits bekannten jährlichen Reparaturkosten.
   */
  reparatur: {
    jaehrlichUnmoebliertChf: number;
  };

  /**
   * Erst-Möblierung (Möbel) — Initialkosten + Nutzungsdauer, für alle drei möblierten
   * Dauer-Varianten (Langzeit/Mittelzeit/Kurzzeit) gemeinsam erfasst (EIN Objekt wird
   * jeweils auf EINE Art möbliert, unabhängig davon, wie lange vermietet wird). Je
   * Dauer-Variante EIGENER Mietaufschlag (`mietPremium{Langzeit,Mittelzeit,Kurzzeit}
   * ChfPerMonth`) — Kurzzeit erzielt typischerweise einen höheren Aufschlag als
   * Langzeit, siehe SIPIS Furnished-Rental-Modul v1.1, "4-Wege-Investment-Value-
   * Vergleich" (`computeVermietungsstrategienVergleich`). Kein `jaehrlicherErsatzsatzPercent`
   * mehr (bis v1.0 eine 70%-Teil-Wiederverwendungsannahme) — die v1.1-Spec kennt kein
   * Teil-Wiederverwendungskonzept, Ersatz wird zu 100% der (inflationierten)
   * Initialkosten angesetzt.
   */
  moeblierung: {
    initialCostChf: number;
    nutzungsdauerJahre?: number;
    kostensteigerungPercentPerYear?: number;
    /** Separat von der Möblierung selbst erfasst (Geschirr, Kleingeräte, Textilien) — eigene Initialkosten/Nutzungsdauer, typischerweise kürzer als die Möbel. */
    haushaltinventarInitialCostChf: number;
    haushaltinventarNutzungsdauerJahre?: number;
    mietPremiumLangzeitChfPerMonth: number;
    mietPremiumMittelzeitChfPerMonth: number;
    mietPremiumKurzzeitChfPerMonth: number;
  };

  /**
   * Granularer Kostenblock für möblierte Vermietung (SIPIS Furnished-Rental-Modul v1.1)
   * — gilt gemeinsam für alle drei möblierten Dauer-Varianten (Langzeit/Mittelzeit/
   * Kurzzeit teilen sich EINEN Kostenblock, nur die Mietaufschläge oben unterscheiden
   * sich je Variante). Ersetzt vollständig die bisherigen Pauschalfelder
   * `reinigungServiceMoebliertChfPerYear`/`nebenkostenMoebliertChfPerYear`/
   * `reparatur.jaehrlichMoebliertChf` (kein Doppelzählungsrisiko). Alle Default-Werte
   * 1:1 aus der vom Auftraggeber gelieferten Fachspezifikation übernommen, siehe
   * DECISIONS.md.
   */
  moebliertBetriebskosten: MoebliertBetriebskostenInput;

  miete: {
    wohnungsMieteChfPerMonth: number;
    /** Nur der offene/Aussen-Parkplatz — siehe `parkplatzKaufpreisChf`. Garage/Hobbyraum haben eigene Mietefelder unten. */
    parkplatzMieteChfPerMonth: number;
    garagenplatzMieteChfPerMonth: number;
    hobbyraumMieteChfPerMonth: number;
    sonstigeEinnahmenChfPerYear: number;
    vermietungsmodell: Vermietungsmodell;
    leerstandPercent?: number;
    auslastungPercent?: number;
  };

  betriebskosten: {
    stwegAkontobeitragChfPerYear: number;
    /**
     * Anteil von `stwegAkontobeitragChfPerYear`, der bei korrektem Mietvertrag über die
     * Nebenkosten auf den Mieter überwälzbar ist (z.B. Heizkosten, allgemeiner
     * Unterhalt) — NICHT der gesamte STWEG-Akontobeitrag ist Vermieterkosten, ein Teil
     * (typischerweise Erneuerungsfonds-Einlage, STWEG-Verwaltung, wertvermehrender
     * Unterhalt) bleibt beim Eigentümer (Rückmeldung aus dem SIPIS/ChatGPT-Benchmark-
     * Vergleich, siehe DECISIONS.md: dort wird dieselbe Trennung explizit vorgenommen
     * und als "zentraler Sensitivitätspunkt" bezeichnet — HOME4efFINDER buchte bisher
     * den kompletten Akontobeitrag als Eigentümerkosten). Default 0 (unverändertes
     * Verhalten, solange nicht erfasst: voller Betrag gilt als nicht überwälzbar).
     * Auf `stwegAkontobeitragChfPerYear` gedeckelt (kein negativer Eigentümerkosten-Anteil).
     */
    stwegAkontobeitragUeberwaelzbarChfPerYear: number;
    eigentuemerkostenChfPerYear: number;
    vermietungskostenChfPerYear: number;
    /** Nur noch für Paket 1 (unmöbliert) — das möblierte Pendant lebt seit dem SIPIS Furnished-Rental-Modul (v1.1) im granularen `moebliertBetriebskosten`-Block (siehe dort). */
    reinigungServiceUnmoebliertChfPerYear: number;
  };

  reserven: {
    reparaturChfPerYear?: number;
    reparaturPercentOfKaufpreis?: number;
    leerstandChfPerYear?: number;
    leerstandPercentOfKaufpreis?: number;
  };

  hypothek: {
    ersteHypothek: HypothekTrancheFacts;
    zweiteHypothek: HypothekTrancheFacts;
    /** Ein gemeinsamer Zinssatz für beide Tranchen — kein separat abgestimmter Bedarf für unterschiedliche Zinssätze je Hypothek. */
    interestRatePercent: number;
  };

  kalkulatorischerSteuersatzPercent?: number;

  /**
   * Eigene, per Marktrecherche bestimmte Eröffnungsangebot-Einschätzung für den
   * Verhandlungskorridor (Rückmeldung: "eröffnungspreis vom markt her (research)
   * bestimmt" — bewusst NICHT rechnerisch aus dem Maximum hergeleitet wie zuvor, das war
   * frei erfunden ohne Marktbezug). `undefined`, solange nicht erfasst — der
   * Verhandlungskorridor zeigt dann kein Eröffnungsangebot an, statt einen Platzhalterwert
   * vorzutäuschen.
   */
  eroeffnungsangebotChf?: number;

  /**
   * Taktische Einschätzungsfaktoren für den Eröffnungsangebot-VORSCHLAG (Auftrag
   * "Advanced Price Strategy & Investment Value Engine", Abschnitt 8) — siehe
   * `priceStrategy.ts::computeOpeningBidSuggestion`. Rein additiv zu
   * `eroeffnungsangebotChf` oben: der Vorschlag füllt das Feld nur VOR, ersetzt es nie
   * automatisch (Nutzer-Entscheidung, siehe DECISIONS.md). Jedes Feld optional — nicht
   * eingeschätzte Faktoren tragen 0 zum Vorschlag bei, nichts wird erfunden.
   */
  openingBidFaktoren?: OpeningBidFaktoren;

  mehrjahresmodell: {
    holdingPeriodYears?: number;
    mietsteigerungPercentPerYear?: number;
    kosteninflationPercentPerYear?: number;
    wertsteigerungPercentPerYear?: number;
    sellingCostPercent?: number;
    grundstueckgewinnsteuerPercent?: number;
  };

  notes?: string;
}

/**
 * Eine einzelne Hypothekartranche (1. oder 2. Hypothek) — Betrag als Prozentsatz des
 * Kaufpreises (analog zur bisherigen "Belehnung"), Amortisation über `AmortisationSpec`
 * entweder als Prozentsatz vom ursprünglichen Tranchenbetrag pro Jahr oder als Zieldauer
 * in Jahren (Rückmeldung: "Prozentsatz oder Dauer in Jahren als Variable").
 */
export interface HypothekTrancheFacts {
  belehnungPercent: number;
  amortisation: AmortisationSpec;
}

/** Minimale, aus dem Objekt selbst stammende Eingaben für die Engine. */
export interface BestandsrenditePropertyInput {
  kaufpreisChf: number;
  wohnflaecheM2: number;
  /** Für kantonsspezifische Platzhalter-Defaults (Handänderungssteuer, kalkulatorischer Steuersatz) — siehe cantonDefaults.ts. Ohne Kanton greift der schweizweite Default. */
  canton?: string;
}

/**
 * Überschreibungen der Registry-Defaults aus dem "Annahmen"-Reiter (`app_settings`,
 * Migration 0007) — global für alle Objekte, fehlender Schlüssel fällt auf den
 * Registry-Default zurück. Wird von der aufrufenden Seite/Route geladen
 * (`parameterOverrides.ts`) und optional an jede der drei Berechnungsfunktionen
 * durchgereicht; ohne Angabe verhält sich alles wie bisher (reine Registry-Defaults).
 */
export type ParameterOverrides = Partial<Record<BestandsrenditeParameterKey, number>>;

/** Aufschlüsselung des NOI (Jahr 1) für den Drill-down in der Cashflow-Wasserfall-Tabelle — dieselben Grössen, aus denen `investmentCase.wasserfall.noiChf` besteht, hier einzeln statt nur als eine Zahl. */
export interface NoiBreakdown {
  potenziellerJahresertragChf: number;
  /** = potenziellerJahresertragChf − effektiverJahresertragChf (Leerstand bei Langfristvermietung, Nicht-Auslastung bei Short-Stay). */
  leerstandAbzugChf: number;
  effektiverJahresertragChf: number;
  /** Bereits um `stwegAkontobeitragUeberwaelzbarChfPerYear` bereinigt — das ist der Anteil, der tatsächlich als Eigentümerkosten in den NOI fliesst, nicht der volle Akontobeitrag. */
  stwegAkontobeitragChfPerYear: number;
  /** Rein informativ zur Herleitung: der als überwälzbar erfasste Anteil, der NICHT in `stwegAkontobeitragChfPerYear`/den NOI einfliesst. 0, wenn nicht erfasst. */
  stwegAkontobeitragUeberwaelzbarChfPerYear: number;
  eigentuemerkostenChfPerYear: number;
  vermietungskostenChfPerYear: number;
  reinigungServiceChfPerYear: number;
  /** Nur bei unmöblierter Vermietung > 0 — bei möbliert bereits Teil von `moebliertOpexChfPerYear`. */
  reparaturChfPerYear: number;
  /** = `FurnishedOpexBreakdown.totalChfPerYear` (siehe `furnishedOpexBreakdown` auf `BestandsrenditeAnalysisResult` für die granulare Aufschlüsselung) — 0 bei unmöblierter Vermietung. */
  moebliertOpexChfPerYear: number;
  betriebskostenTotalChf: number;
  noiChf: number;
}

/**
 * Möblierung als NOI-Wirkung statt nur als Umsatz-Wirkung (Guardrail: "höheren
 * möblierten Umsatz automatisch als höheren Gewinn interpretieren" ist ein Fehler, den
 * die App nicht machen darf). `furnitureRoi`/`moeblierungsVergleich` vergleichen bewusst
 * nur den ERTRAG (Miete), nicht den tatsächlichen Betriebsgewinn — der zusätzliche
 * Reinigungsaufwand zwischen Mietern und die Möblierungs-Ersatzreserve sind zwei
 * konkrete, direkt der Möblierung zurechenbare Zusatzkosten, die dort NICHT gegengerechnet
 * werden. `incrementalNoiChf` schliesst genau diese Lücke: Mehrertrag minus diese beiden
 * Zusatzkosten. Kann negativ sein, obwohl der Mehrertrag selbst positiv ist — genau der
 * Fall, den die UI explizit ausweisen muss, statt ihn hinter einer reinen ROI-Prozentzahl
 * zu verstecken.
 */
export interface IncrementalFurnitureNoi {
  unfurnishedNoiChf: number;
  furnishedNoiChf: number;
  incrementalNoiChf: number;
}

/** Eines der beiden Vermietungsszenarien im Möblierungs-Vergleich — siehe `MoeblierungsVergleich`. */
export interface MoeblierungsSzenario {
  mieteChfPerMonth: number;
  kostenInitialChf: number;
  /** Geglättete jährliche Ersatzreserve für Möbel + Haushaltsinventar zusammen — `undefined` beim unmöblierten Szenario (keine Möbel/kein Inventar, keine Ersatzreserve). */
  reserveChfPerJahr: number | undefined;
  effektiverJahresertragChf: number;
  bruttoRenditePercent: number;
}

/**
 * Stellt "unmöbliert vermieten" und "möbliert vermieten" als zwei vollständige,
 * nebeneinander vergleichbare Pakete dar (Kosten + erwartete Miete + resultierender
 * Ertrag je Szenario) — unabhängig davon, welches `vermietungsmodell` tatsächlich für
 * die übrigen Berechnungen (Schnellcheck/Investment Case/15-Jahres-Modell) aktiv ist.
 * Für die "möbliert"-Seite wird die aktuell gewählte möblierte Dauer-Variante genutzt,
 * falls eine gewählt ist, sonst die von der SIPIS-Spec vorgegebene Default-Strategie
 * "Möbliert Mittelzeit" (siehe `resolveMoeblierungsVergleichVariante`) — für den vollen
 * Vergleich aller vier Modelle siehe stattdessen `computeVermietungsstrategienVergleich`.
 * Beide Szenarien nutzen denselben Leerstand/Auslastung-Faktor des aktiven Modells —
 * der einzige Unterschied ist der Möblierungs-Mietaufschlag und die Möblierungskosten.
 */
export interface MoeblierungsVergleich {
  unmoebliert: MoeblierungsSzenario;
  moebliert: MoeblierungsSzenario;
}

/** Reine Brutto-Rendite-Angabe für eine einzelne Kaufpreis-Kategorie — ohne Bezug zu Cashflow/Hypothek/Steuer (die bleiben bewusst auf dem Gesamt-Kaufpreis gerechnet, siehe `schnellcheck`/`investmentCase`). `bruttoRenditePercent` ist 0, wenn kein Kaufpreis erfasst ist (keine Division durch 0). */
export interface KategorieRendite {
  kaufpreisChf: number;
  jahresmieteChf: number;
  bruttoRenditePercent: number;
}

/**
 * Vier separat ausgewiesene Brutto-Renditen (Rückmeldung: "damit können wir die
 * Renditen für die vier Kategorien sauber auseinanderhalten") — rein additiv zur
 * bestehenden Gesamtrechnung, ersetzt sie nicht: eine Liegenschaft hat eine Hypothek/
 * einen Cashflow, nicht vier getrennte, daher bleiben Schnellcheck/Investment Case/
 * 15-Jahres-Modell unverändert auf dem kombinierten Gesamt-Kaufpreis. "Wohnung" nutzt
 * bewusst NICHT `sonstigeEinnahmenChfPerYear` (keiner Raum-Kategorie zuordenbar).
 */
export interface KategorienRenditen {
  wohnung: KategorieRendite;
  garage: KategorieRendite;
  aussenparkplatz: KategorieRendite;
  hobbyraum: KategorieRendite;
}

export interface BestandsrenditeAnalysisResult {
  schnellcheck: SchnellcheckResult;
  allInInvestitionChf: number;
  eigenkapitalChf: number;
  investmentCase: InvestmentCaseResult;
  noiBreakdown: NoiBreakdown;
  breakEven: { mieteChfPerMonth: number | undefined; zinsPercent: number | undefined; auslastungPercent: number | undefined };
  /**
   * NETTO-basierte "Furniture ROI" (SIPIS Furnished-Rental-Modul v1.1: `furnishing_ROI =
   * incremental_NOI / incremental_furnishing_investment`) — ersetzt die frühere, rein
   * bruttomietbasierte `furnitureRoi` (Guardrail: höherer Umsatz durch Möblierung darf
   * nicht automatisch als höherer Gewinn interpretiert werden). `undefined` unter
   * denselben Bedingungen wie `incrementalFurnitureNoi` (keine Möblierungsdaten erfasst).
   */
  furnishingRoi: ValueAddRoiResult | undefined;
  /** Siehe `IncrementalFurnitureNoi` — `undefined`, wenn keine Möblierungsdaten erfasst sind (weder Möbel- noch Haushaltsinventar-Initialkosten, noch ein Mietaufschlag der Vergleichsvariante). */
  incrementalFurnitureNoi: IncrementalFurnitureNoi | undefined;
  /** Break-even-/Mindestrendite-Kennzahlen der SIPIS-Spec (siehe `FurnishedRentalDeltaResult`) — `undefined` unter denselben Bedingungen wie `incrementalFurnitureNoi`. */
  furnishedRentalDelta: FurnishedRentalDeltaResult | undefined;
  /** Granulare möblierte Betriebskosten-Aufschlüsselung der Vergleichsvariante (siehe `resolveMoeblierungsVergleichVariante`) — `undefined` unter denselben Bedingungen wie `incrementalFurnitureNoi`. */
  furnishedOpexBreakdown: FurnishedOpexBreakdown | undefined;
  /** Geglättete jährliche Ersatzreserve für Möbel + Haushaltsinventar zusammen — rein informativ, nicht Grundlage der 15-Jahres-Cashflows (die rechnen mit dem tatsächlichen Ersatz-Cashout im jeweiligen Ersatzjahr, siehe mehrjahresmodell). */
  moeblierungReserveChfPerJahr: number | undefined;
  /** Welche möblierte Dauer-Variante die "möbliert"-Seite von `moeblierungsVergleich` tatsächlich abbildet (siehe `resolveMoeblierungsVergleichVariante`) — für die UI-Beschriftung, da "möbliert" seit den drei Dauer-Varianten allein nicht mehr eindeutig ist. Label via `VERMIETUNGSMODELL_LABELS`. */
  moeblierungsVergleichVariante: Vermietungsmodell;
  moeblierungsVergleich: MoeblierungsVergleich;
  renovationRoi: ValueAddRoiResult | undefined;
  renovationSummary: RenovationPositionenSummary;
  mehrjahresmodell: MehrjahresmodellResult;
  investmentTreiber: InvestmentTreiberResult;
  hypothek: { ersteHypothekChf: number; zweiteHypothekChf: number; ersteAmortisationChfPerYear: number; zweiteAmortisationChfPerYear: number };
  /** Für den Herleitungs-Sub-Text unter "Grober Cashflow" (Ebene A) — dieselben zwei Abzugsposten, die bereits in `schnellcheck.groberCashflowChf` verrechnet sind, hier nur zur Anzeige separat ausgewiesen. */
  schnellcheckKostenBreakdown: { laufendeKostenChfPerYear: number; zinsChf: number };
  /** Wie viel vom Gesamt-Kaufpreis (`schnellcheck.kaufpreisChf`) zusätzlich zum Basis-Kaufpreis (Objekt-Basisdaten) aus Parkplatz/Garage/Hobbyraum stammt — 0, wenn keiner erfasst ist oder alle bereits im Basis-Kaufpreis enthalten sind. */
  parkierung: { parkplatzZusatzChf: number; garagenplatzZusatzChf: number; hobbyraumZusatzChf: number; totalZusatzChf: number };
  /** Siehe `KategorienRenditen` — rein informative Brutto-Rendite je Kaufpreis-Kategorie, zusätzlich zur Gesamtrechnung oben. */
  kategorienRenditen: KategorienRenditen;
  /** Unveränderte STWEG-Fakten aus den Facts — reine Datenhaltung ohne Scoring/Formel, siehe StwegFacts. */
  stweg: StwegFacts;
  assumptionNotes: string[];
}

/** Wählt je Vermietungsmodell den passenden der drei Mietaufschlag-Werte — 0 bei unmöblierter Vermietung (siehe `BestandsrenditeFacts.moeblierung`). */
export function resolveMietPremiumChfPerMonth(vermietungsmodell: Vermietungsmodell, moeblierung: BestandsrenditeFacts["moeblierung"]): number {
  switch (vermietungsmodell) {
    case "LANGFRISTIG_MOEBLIERT":
      return moeblierung.mietPremiumLangzeitChfPerMonth;
    case "MITTELFRISTIG_MOEBLIERT":
      return moeblierung.mietPremiumMittelzeitChfPerMonth;
    case "SHORT_STAY":
      return moeblierung.mietPremiumKurzzeitChfPerMonth;
    case "LANGFRISTIG_UNMOEBLIERT":
      return 0;
  }
}

/**
 * Für den 2-Wege-Vergleich (`moeblierungsVergleich`/`incrementalFurnitureNoi`/
 * `furnishingRoi`/`furnishedRentalDelta`): welche möblierte Dauer-Variante dient als
 * "die" möblierte Vergleichsseite? Ist bereits eine möblierte Variante das gewählte
 * Vermietungsmodell, wird genau diese verwendet — sonst die von der SIPIS-Spec (v1.1)
 * selbst benannte "DEFAULT STRATEGY FOR FURNISHED RENTAL": Möbliert Mittelzeit. Der
 * VOLLE Vergleich aller vier Modelle unabhängig von dieser Wahl lebt in
 * `computeVermietungsstrategienVergleich`.
 */
function resolveMoeblierungsVergleichVariante(vermietungsmodell: Vermietungsmodell): Vermietungsmodell {
  return vermietungsmodell === "LANGFRISTIG_UNMOEBLIERT" ? "MITTELFRISTIG_MOEBLIERT" : vermietungsmodell;
}

/**
 * Rechnet ein beliebiges Bestandswohnungs-Objekt komplett durch alle drei Ebenen
 * (Schnellcheck/Investment Case/15-Jahres-Modell) plus Value-Add. Jede fehlende
 * optionale Annahme wird transparent durch den Platzhalter-Default aus
 * `BESTANDSRENDITE_PARAMETERS` ersetzt und in `assumptionNotes` offen ausgewiesen.
 */
export function computeBestandsrenditeAnalysis(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  parameterOverrides?: ParameterOverrides,
): BestandsrenditeAnalysisResult {
  const P: Record<BestandsrenditeParameterKey, number> = { ...defaultsOf(BESTANDSRENDITE_PARAMETERS), ...parameterOverrides };

  const assumptionNotes: string[] = [];
  const note = (label: string, used: boolean, value: number, unit: string) => {
    if (!used) assumptionNotes.push(`${label} nicht erfasst — Platzhalter-Default (${value}${unit}) verwendet, siehe BESTANDSRENDITE_PARAMETERS.`);
  };

  const cantonDefaults = getCantonDefaults(property.canton);
  const handaenderungssteuerPercent = facts.nebenkosten.handaenderungssteuerPercent ?? cantonDefaults?.handaenderungssteuerPercent ?? P.handaenderungssteuerPercent;
  note("Handänderungssteuer", facts.nebenkosten.handaenderungssteuerPercent !== undefined, handaenderungssteuerPercent, "%");
  const notariatGrundbuchPercent = facts.nebenkosten.notariatGrundbuchPercent ?? P.notariatGrundbuchPercent;
  const maklerprovisionPercent = facts.nebenkosten.maklerprovisionPercent ?? P.maklerprovisionPercent;

  // Ist ein Parkplatz/Garagenplatz laut Nutzer bereits im erfassten Kaufpreis
  // (Objekt-Basisdaten) enthalten, wird sein Kaufpreis NICHT nochmals addiert — sonst
  // würde er doppelt in die Investitionssumme/den Schnellcheck einfliessen. Beide
  // Parkierungsarten sind unabhängig voneinander erfasst (ein Objekt kann z.B. einen
  // Aussenparkplatz UND einen separaten Garagenplatz haben), rechnerisch aber identisch
  // behandelt — reine Kategorisierung/Beschriftung, keine unterschiedliche Formel.
  const parkplatzKaufpreisZusatzChf = facts.parkplatzImKaufpreisEnthalten ? 0 : facts.parkplatzKaufpreisChf;
  const garagenplatzKaufpreisZusatzChf = facts.garagenplatzImKaufpreisEnthalten ? 0 : facts.garagenplatzKaufpreisChf;
  const hobbyraumKaufpreisZusatzChf = facts.hobbyraumImKaufpreisEnthalten ? 0 : facts.hobbyraumKaufpreisChf;
  const parkierungKaufpreisZusatzChf = parkplatzKaufpreisZusatzChf + garagenplatzKaufpreisZusatzChf + hobbyraumKaufpreisZusatzChf;
  const kaufpreisChf = property.kaufpreisChf + parkierungKaufpreisZusatzChf;
  // Kombinierte Nebenraum-Miete für die GESAMTRECHNUNG (Schnellcheck/Investment Case/
  // 15-Jahres-Modell) — die drei Nebenraum-Mietefelder fliessen hier unverändert
  // vollständig ein, nur zusätzlich unten (kategorienRenditen) einzeln ausgewiesen.
  const nebenraeumeMieteChfPerMonth = facts.miete.parkplatzMieteChfPerMonth + facts.miete.garagenplatzMieteChfPerMonth + facts.miete.hobbyraumMieteChfPerMonth;
  const nebenkosten = calculateNebenkosten({ kaufpreisChf, handaenderungssteuerPercent, notariatGrundbuchPercent, maklerprovisionPercent });

  const renovationSummary = summarizeRenovationPositionen(facts.renovation.positionen);

  const moeblierungNutzungsdauerJahre = facts.moeblierung.nutzungsdauerJahre ?? P.moeblierungNutzungsdauerJahre;
  const haushaltinventarNutzungsdauerJahre = facts.moeblierung.haushaltinventarNutzungsdauerJahre ?? P.haushaltinventarNutzungsdauerJahre;
  const moeblierungKostensteigerung = facts.moeblierung.kostensteigerungPercentPerYear ?? P.kosteninflationPercentPerYear;

  // "Vermietungsmodell" ist das eigentliche Auswahlfeld für das bevorzugte Szenario
  // (unmöbliert oder eine der drei möblierten Dauer-Varianten, siehe DECISIONS.md) —
  // Möblierungskosten/-mietaufschlag dürfen NUR einfliessen, wenn eine möblierte
  // Variante tatsächlich das gewählte Modell ist (SIPIS Furnished-Rental-Modul v1.1,
  // Gating-Bugfix: bis dahin rechnete SHORT_STAY fälschlich mit den unmöblierten
  // Werten — "SHORT_STAY nutzt denselben Wert wie unmöbliert" war ein Fehler, keine
  // Absicht). Der volle Vergleich aller vier Modelle bleibt in
  // `computeVermietungsstrategienVergleich` unverändert erhalten — der nutzt bewusst
  // weiterhin die ungegateten Rohwerte je Modell, weil er unabhängig vom aktuell
  // gewählten Szenario beantworten soll, welche Strategie sich am meisten lohnen würde.
  const moeblierungIstGewaehltesSzenario = facts.miete.vermietungsmodell !== "LANGFRISTIG_UNMOEBLIERT";
  const moeblierungsPremiumChfPerMonth = moeblierungIstGewaehltesSzenario ? resolveMietPremiumChfPerMonth(facts.miete.vermietungsmodell, facts.moeblierung) : 0;
  const moeblierungInitialChfEffective = moeblierungIstGewaehltesSzenario ? facts.moeblierung.initialCostChf : 0;
  const haushaltinventarInitialChfEffective = moeblierungIstGewaehltesSzenario ? facts.moeblierung.haushaltinventarInitialCostChf : 0;

  // SHORT_STAY nutzt weiterhin seinen eigenen Auslastungsprozentsatz statt einer
  // Leerstandsquote (siehe calculateJahresertrag) — die beiden übrigen möblierten
  // Varianten (Langzeit/Mittelzeit) nutzen wie bisher den höheren möblierten
  // Leerstand-Default statt des langfristig-unmöblierten (Gating-Bugfix: bisher nur für
  // MITTELFRISTIG_MOEBLIERT).
  const leerstandDefaultPercent =
    facts.miete.vermietungsmodell === "LANGFRISTIG_MOEBLIERT" || facts.miete.vermietungsmodell === "MITTELFRISTIG_MOEBLIERT"
      ? P.leerstandMoebliertPercent
      : P.leerstandLangfristigPercent;

  // Möblierte Betriebskosten (granularer Kostenblock, gemeinsam für alle drei
  // Dauer-Varianten, siehe `BestandsrenditeFacts.moebliertBetriebskosten`) — Verwaltungs-/
  // Plattformgebühr sind ein Prozentsatz des effektiven möblierten Jahresertrags, daher
  // hier vorab mit denselben Mietwerten berechnet, die auch weiter unten in
  // `investmentCaseInput.ertrag` einfliessen (dieselbe Formel wie `calculateJahresertrag`).
  const effektiverJahresertragMoebliertChf = moeblierungIstGewaehltesSzenario
    ? calculateJahresertrag({
        wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
        parkplatzMieteChfPerMonth: nebenraeumeMieteChfPerMonth,
        moeblierungsPremiumChfPerMonth,
        sonstigeEinnahmenChfPerYear: facts.miete.sonstigeEinnahmenChfPerYear,
        vermietungsmodell: facts.miete.vermietungsmodell,
        leerstandPercent: facts.miete.leerstandPercent ?? leerstandDefaultPercent,
        auslastungPercent: facts.miete.auslastungPercent,
      }).effektiverJahresertragChf
    : 0;
  const moebliertOpexBreakdownEffective: FurnishedOpexBreakdown | undefined = moeblierungIstGewaehltesSzenario
    ? calculateFurnishedOpex(facts.moebliertBetriebskosten, effektiverJahresertragMoebliertChf)
    : undefined;
  // Reparaturkosten sind jährlich wiederkehrend und Teil der laufenden Betriebskosten/
  // des NOI, NICHT der einmaligen Investitionssumme (siehe unten,
  // `calculateAllInInvestition` ohne Reparaturkosten) — nur bei unmöblierter Vermietung
  // ein eigener Posten (Paket 1), bei möbliert bereits Teil von `moebliertOpexBreakdownEffective`
  // (Kleinreparaturen-Zeile).
  const reparaturChfPerYearEffective = moeblierungIstGewaehltesSzenario ? 0 : facts.reparatur.jaehrlichUnmoebliertChf;
  const reinigungServiceChfPerYearEffective = moeblierungIstGewaehltesSzenario ? 0 : facts.betriebskosten.reinigungServiceUnmoebliertChfPerYear;
  // Nur der NICHT überwälzbare Anteil des STWEG-Akontobeitrags ist Vermieterkosten (siehe
  // BestandsrenditeFacts.betriebskosten.stwegAkontobeitragUeberwaelzbarChfPerYear) — der
  // überwälzbare Anteil wird bei korrektem Mietvertrag 1:1 über die Nebenkosten vom
  // Mieter getragen und fliesst daher weder in den NOI noch in den Schnellcheck.
  const stwegAkontobeitragNichtUeberwaelzbarChfPerYear = Math.max(
    0,
    facts.betriebskosten.stwegAkontobeitragChfPerYear - facts.betriebskosten.stwegAkontobeitragUeberwaelzbarChfPerYear,
  );
  const betriebskostenEffective = {
    stwegAkontobeitragChfPerYear: stwegAkontobeitragNichtUeberwaelzbarChfPerYear,
    eigentuemerkostenChfPerYear: facts.betriebskosten.eigentuemerkostenChfPerYear,
    vermietungskostenChfPerYear: facts.betriebskosten.vermietungskostenChfPerYear,
    reinigungServiceChfPerYear: reinigungServiceChfPerYearEffective,
    reparaturChfPerYear: reparaturChfPerYearEffective,
    moebliertOpexChfPerYear: moebliertOpexBreakdownEffective?.totalChfPerYear ?? 0,
  };

  const allInInvestitionChf = calculateAllInInvestition({
    kaufpreisChf,
    nebenkosten,
    renovationInitialChf: facts.renovation.initialRenovationCostChf,
    moeblierungInitialChf: moeblierungInitialChfEffective + haushaltinventarInitialChfEffective,
    // Reparaturkosten sind jährlich wiederkehrend und fliessen oben in die
    // Betriebskosten — kein einmaliger Posten mehr, daher hier 0 statt des früheren
    // `sonstigeInitialkostenChf`-Werts.
    sonstigeInitialkostenChf: 0,
  });

  const ersteHypothekChf = kaufpreisChf * (facts.hypothek.ersteHypothek.belehnungPercent / 100);
  const zweiteHypothekChf = kaufpreisChf * (facts.hypothek.zweiteHypothek.belehnungPercent / 100);
  const hypothekChf = ersteHypothekChf + zweiteHypothekChf;
  const belehnungPercent = facts.hypothek.ersteHypothek.belehnungPercent + facts.hypothek.zweiteHypothek.belehnungPercent;
  const ersteAmortisationChfPerYear = resolveAmortisationChfPerYear(ersteHypothekChf, facts.hypothek.ersteHypothek.amortisation);
  const zweiteAmortisationChfPerYear = resolveAmortisationChfPerYear(zweiteHypothekChf, facts.hypothek.zweiteHypothek.amortisation);
  const amortisationChfPerYear = ersteAmortisationChfPerYear + zweiteAmortisationChfPerYear;
  const eigenkapitalChf = allInInvestitionChf - hypothekChf;

  const kaufnebenkostenPercent = handaenderungssteuerPercent + notariatGrundbuchPercent + maklerprovisionPercent;
  const schnellcheckLaufendeKostenChfPerYear =
    stwegAkontobeitragNichtUeberwaelzbarChfPerYear + facts.betriebskosten.eigentuemerkostenChfPerYear + facts.betriebskosten.vermietungskostenChfPerYear;
  const schnellcheck = calculateSchnellcheck({
    wohnungskaufpreisChf: property.kaufpreisChf,
    parkplatzkaufpreisChf: parkierungKaufpreisZusatzChf,
    wohnflaecheM2: property.wohnflaecheM2,
    wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
    parkplatzMieteChfPerMonth: nebenraeumeMieteChfPerMonth,
    moeblierungsPremiumChfPerMonth,
    sonstigeEinnahmenChfPerYear: facts.miete.sonstigeEinnahmenChfPerYear,
    kaufnebenkostenPercent,
    laufendeKostenChfPerYear: schnellcheckLaufendeKostenChfPerYear,
    loanToValuePercent: belehnungPercent,
    interestRatePercent: facts.hypothek.interestRatePercent,
  });
  // Für den Herleitungs-Sub-Text unter "Grober Cashflow" (Rückmeldung: "in kleiner Schrift
  // ergänzend [...] herleiten") — dieselbe Formel wie calculateSchnellcheck intern nutzt
  // (hypothekChf dort = kaufpreisChf × Belehnung-%, identisch zu schnellcheck.kaufpreisChf
  // × schnellcheck.belehnungPercent / 100), hier nur zur Anzeige separat berechnet.
  const schnellcheckZinsChf = schnellcheck.kaufpreisChf * (belehnungPercent / 100) * (facts.hypothek.interestRatePercent / 100);

  const reparaturreserveChf = resolveReserveChf({
    chfPerYear: facts.reserven.reparaturChfPerYear,
    percentOfKaufpreis: facts.reserven.reparaturPercentOfKaufpreis ?? P.reparaturreservePercentOfKaufpreis,
    kaufpreisChf,
  });
  const leerstandsreserveChf = resolveReserveChf({
    chfPerYear: facts.reserven.leerstandChfPerYear,
    percentOfKaufpreis: facts.reserven.leerstandPercentOfKaufpreis ?? P.leerstandsreservePercentOfKaufpreis,
    kaufpreisChf,
  });

  const kalkulatorischerSteuersatzPercent = facts.kalkulatorischerSteuersatzPercent ?? cantonDefaults?.kalkulatorischerSteuersatzPercent ?? P.kalkulatorischerSteuersatzPercent;

  const investmentCaseInput: InvestmentCaseInput = {
    kaufpreisChf,
    allInInvestitionChf,
    ertrag: {
      wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
      parkplatzMieteChfPerMonth: nebenraeumeMieteChfPerMonth,
      moeblierungsPremiumChfPerMonth,
      sonstigeEinnahmenChfPerYear: facts.miete.sonstigeEinnahmenChfPerYear,
      vermietungsmodell: facts.miete.vermietungsmodell,
      leerstandPercent: facts.miete.leerstandPercent ?? leerstandDefaultPercent,
      auslastungPercent: facts.miete.auslastungPercent,
    },
    betriebskosten: betriebskostenEffective,
    hypothekChf,
    interestRatePercent: facts.hypothek.interestRatePercent,
    amortisationChfPerYear,
    kalkulatorischerSteuersatzPercent,
    reparaturreserveChf,
    leerstandsreserveChf,
    eigenkapitalChf,
  };

  const investmentCase = calculateInvestmentCase(investmentCaseInput);

  const jahresertrag = calculateJahresertrag(investmentCaseInput.ertrag);
  const betriebskostenTotalChf = calculateBetriebskosten(investmentCaseInput.betriebskosten);
  const noiBreakdown: NoiBreakdown = {
    potenziellerJahresertragChf: jahresertrag.potenziellerJahresertragChf,
    leerstandAbzugChf: jahresertrag.potenziellerJahresertragChf - jahresertrag.effektiverJahresertragChf,
    effektiverJahresertragChf: jahresertrag.effektiverJahresertragChf,
    stwegAkontobeitragChfPerYear: investmentCaseInput.betriebskosten.stwegAkontobeitragChfPerYear,
    // Auf den Gesamtbeitrag gedeckelt — ein inkonsistent erfasster Wert (überwälzbar >
    // Gesamtbeitrag) darf hier nicht grösser als das Gesamt-Akontobeitrag erscheinen
    // (Review-Fund: sonst zeigte die UI z.B. "nicht überwälzbar: CHF 0" direkt über
    // "davon überwälzbar: CHF 9'999" bei Gesamtbeitrag CHF 4'800 — logisch unmöglich).
    stwegAkontobeitragUeberwaelzbarChfPerYear: Math.min(
      facts.betriebskosten.stwegAkontobeitragUeberwaelzbarChfPerYear,
      facts.betriebskosten.stwegAkontobeitragChfPerYear,
    ),
    eigentuemerkostenChfPerYear: investmentCaseInput.betriebskosten.eigentuemerkostenChfPerYear,
    vermietungskostenChfPerYear: investmentCaseInput.betriebskosten.vermietungskostenChfPerYear,
    reinigungServiceChfPerYear: investmentCaseInput.betriebskosten.reinigungServiceChfPerYear,
    reparaturChfPerYear: investmentCaseInput.betriebskosten.reparaturChfPerYear,
    moebliertOpexChfPerYear: investmentCaseInput.betriebskosten.moebliertOpexChfPerYear,
    betriebskostenTotalChf,
    noiChf: investmentCase.wasserfall.noiChf,
  };

  // "ich möchte zwei Szenarien sehen: unmöbliert vs. möbliert" — beide vollständig
  // nebeneinander gerechnet, statt nur den Mehrertrag/ROI der Möblierung isoliert zu
  // zeigen (siehe DECISIONS.md). Die möblierte Seite nutzt die aktuell gewählte
  // möblierte Dauer-Variante, falls eine gewählt ist, sonst die Default-Strategie
  // "Möbliert Mittelzeit" (siehe `resolveMoeblierungsVergleichVariante`) — für den
  // vollen Vergleich aller vier Modelle siehe `vermietungsstrategienVergleich` unten.
  // Jedes Szenario nutzt seinen EIGENEN Leerstand-Default (möbliert hat empirisch
  // höheren Leerstand als unmöbliert/langfristig, siehe
  // BESTANDSRENDITE_PARAMETERS.leerstandMoebliertPercent vs. .leerstandLangfristigPercent)
  // statt für beide denselben Wert des aktuell gewählten Vermietungsmodells zu übernehmen
  // — sonst hätte das jeweils NICHT gewählte Szenario einen unrealistischen Leerstand
  // gezeigt (Review-Fund). Nur relevant, wenn ein manueller Leerstand-Wert NICHT erfasst
  // ist — ist er erfasst, gilt er bewusst für beide Szenarien (eine einzelne manuelle
  // Einschätzung, kein separates Feld je Szenario).
  const moeblierungsVergleichVariante = resolveMoeblierungsVergleichVariante(facts.miete.vermietungsmodell);
  const moeblierungsVergleichPremiumChfPerMonth = resolveMietPremiumChfPerMonth(moeblierungsVergleichVariante, facts.moeblierung);
  const ertragUnmoebliert = calculateJahresertrag({
    ...investmentCaseInput.ertrag,
    moeblierungsPremiumChfPerMonth: 0,
    vermietungsmodell: "LANGFRISTIG_UNMOEBLIERT",
    leerstandPercent: facts.miete.leerstandPercent ?? P.leerstandLangfristigPercent,
  });
  const ertragMoebliert = calculateJahresertrag({
    ...investmentCaseInput.ertrag,
    moeblierungsPremiumChfPerMonth: moeblierungsVergleichPremiumChfPerMonth,
    vermietungsmodell: moeblierungsVergleichVariante,
    leerstandPercent: facts.miete.leerstandPercent ?? P.leerstandMoebliertPercent,
  });
  const furnishedOpexBreakdown: FurnishedOpexBreakdown | undefined =
    facts.moeblierung.initialCostChf > 0 || facts.moeblierung.haushaltinventarInitialCostChf > 0 || moeblierungsVergleichPremiumChfPerMonth > 0
      ? calculateFurnishedOpex(facts.moebliertBetriebskosten, ertragMoebliert.effektiverJahresertragChf)
      : undefined;
  // "Miete vor Renovation" fällt, wenn nicht explizit abweichend erfasst, auf die
  // bereits oben erfasste "Nettomiete Wohnung" zurück — Rückmeldung: separates
  // Doppelt-Erfassen derselben Ist-Miete "aus meiner Sicht überflüssig". Weiterhin
  // überschreibbar für den Sonderfall, dass die aktuelle Miete unterhalb des
  // eigentlich erzielbaren Marktniveaus liegt (z.B. Altmietvertrag).
  const mieteVorRenovationChfPerMonth = facts.renovation.mieteVorRenovationChfPerMonth ?? facts.miete.wohnungsMieteChfPerMonth;
  const renovationRoi =
    facts.renovation.initialRenovationCostChf > 0 && facts.renovation.mieteNachRenovationChfPerMonth !== undefined
      ? calculateRenovationRoi({
          renovationCostChf: facts.renovation.initialRenovationCostChf,
          mieteVorherChfPerMonth: mieteVorRenovationChfPerMonth,
          mieteNachherChfPerMonth: facts.renovation.mieteNachRenovationChfPerMonth,
        })
      : undefined;

  const moeblierungLebenszyklus =
    facts.moeblierung.initialCostChf > 0
      ? { initialCostChf: facts.moeblierung.initialCostChf, nutzungsdauerJahre: moeblierungNutzungsdauerJahre, ersatzquotePercent: 100, kostensteigerungPercentPerYear: moeblierungKostensteigerung }
      : undefined;
  const haushaltinventarLebenszyklus =
    facts.moeblierung.haushaltinventarInitialCostChf > 0
      ? { initialCostChf: facts.moeblierung.haushaltinventarInitialCostChf, nutzungsdauerJahre: haushaltinventarNutzungsdauerJahre, ersatzquotePercent: 100, kostensteigerungPercentPerYear: moeblierungKostensteigerung }
      : undefined;
  const moeblierungReserveChfPerJahr =
    moeblierungLebenszyklus || haushaltinventarLebenszyklus
      ? (moeblierungLebenszyklus ? moeblierungGeglaetteReserveChfPerJahr(moeblierungLebenszyklus) : 0) +
        (haushaltinventarLebenszyklus ? moeblierungGeglaetteReserveChfPerJahr(haushaltinventarLebenszyklus) : 0)
      : undefined;
  // `moeblierungLebenszyklus`/`haushaltinventarLebenszyklus` bleiben oben ungegatet
  // (Value-Add-Reserve ist informativ, unabhängig vom gewählten Szenario) — für das
  // tatsächliche 15-Jahres-Modell (reale Ersatz-Cashouts) gilt dieselbe Gating-Regel wie
  // überall sonst in dieser Funktion.
  const moeblierungLebenszyklusEffective = moeblierungIstGewaehltesSzenario ? moeblierungLebenszyklus : undefined;
  const haushaltinventarLebenszyklusEffective = moeblierungIstGewaehltesSzenario ? haushaltinventarLebenszyklus : undefined;

  // Siehe IncrementalFurnitureNoi: Mehrertrag NETTO der jeweils EIGENEN vollständigen
  // Betriebskosten beider Pakete (nicht nur der rohe Mehrertrag wie bei
  // moeblierungsVergleich) — Paket 1 (unmöbliert) netto seiner Reinigung/Reparatur,
  // Paket 2 (möbliert) netto des granularen Kostenblocks + der Möblierungs-/
  // Inventar-Ersatzreserve. Nur relevant, wenn überhaupt Möblierungsdaten erfasst sind.
  const incrementalFurnitureNoi: IncrementalFurnitureNoi | undefined = furnishedOpexBreakdown
    ? {
        unfurnishedNoiChf: ertragUnmoebliert.effektiverJahresertragChf - facts.betriebskosten.reinigungServiceUnmoebliertChfPerYear - facts.reparatur.jaehrlichUnmoebliertChf,
        furnishedNoiChf: ertragMoebliert.effektiverJahresertragChf - furnishedOpexBreakdown.totalChfPerYear - (moeblierungReserveChfPerJahr ?? 0),
        incrementalNoiChf:
          ertragMoebliert.effektiverJahresertragChf -
          furnishedOpexBreakdown.totalChfPerYear -
          (moeblierungReserveChfPerJahr ?? 0) -
          (ertragUnmoebliert.effektiverJahresertragChf - facts.betriebskosten.reinigungServiceUnmoebliertChfPerYear - facts.reparatur.jaehrlichUnmoebliertChf),
      }
    : undefined;

  const incrementalFurnishingInvestmentChf = facts.moeblierung.initialCostChf + facts.moeblierung.haushaltinventarInitialCostChf;
  const furnishingRoi = incrementalFurnitureNoi ? calculateFurnishingRoi({ incrementalFurnishingInvestmentChf, incrementalNoiChf: incrementalFurnitureNoi.incrementalNoiChf }) : undefined;
  const furnishedRentalDelta =
    incrementalFurnitureNoi && furnishedOpexBreakdown
      ? calculateFurnishedRentalDelta({
          incrementalOpexChfPerYear: furnishedOpexBreakdown.totalChfPerYear,
          // Möbliert hat typischerweise einen höheren Leerstand-Default als unmöbliert
          // (siehe oben) — der zusätzliche Mietausfall dadurch, auf 0 gedeckelt (falls
          // beide Szenarien denselben manuell erfassten Leerstand nutzen, ist die
          // Differenz 0).
          incrementalVacancyLossChfPerYear: Math.max(
            0,
            ertragMoebliert.potenziellerJahresertragChf -
              ertragMoebliert.effektiverJahresertragChf -
              (ertragUnmoebliert.potenziellerJahresertragChf - ertragUnmoebliert.effektiverJahresertragChf),
          ),
          incrementalFurnishingInvestmentChf,
          minimumRequiredFurnitureRoiPercent: P.minimumRequiredFurnitureRoiPercent,
          additionalGrossRentalIncomeChfPerYear: ertragMoebliert.potenziellerJahresertragChf - ertragUnmoebliert.potenziellerJahresertragChf,
          incrementalNoiChf: incrementalFurnitureNoi.incrementalNoiChf,
        })
      : undefined;

  const moeblierungsVergleich: MoeblierungsVergleich = {
    unmoebliert: {
      mieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
      kostenInitialChf: 0,
      reserveChfPerJahr: undefined,
      effektiverJahresertragChf: ertragUnmoebliert.effektiverJahresertragChf,
      bruttoRenditePercent: kaufpreisChf > 0 ? (ertragUnmoebliert.effektiverJahresertragChf / kaufpreisChf) * 100 : 0,
    },
    moebliert: {
      mieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth + moeblierungsVergleichPremiumChfPerMonth,
      kostenInitialChf: incrementalFurnishingInvestmentChf,
      reserveChfPerJahr: moeblierungReserveChfPerJahr,
      effektiverJahresertragChf: ertragMoebliert.effektiverJahresertragChf,
      bruttoRenditePercent: kaufpreisChf > 0 ? (ertragMoebliert.effektiverJahresertragChf / kaufpreisChf) * 100 : 0,
    },
  };

  const mehrjahresmodellInput = {
    holdingPeriodYears: facts.mehrjahresmodell.holdingPeriodYears ?? P.holdingPeriodYearsDefault,
    kaufpreisChf,
    allInInvestitionChf,
    eigenkapitalChf,
    ertragJahr1: investmentCaseInput.ertrag,
    betriebskostenJahr1: betriebskostenEffective,
    reparaturreserveJahr1Chf: reparaturreserveChf,
    leerstandsreserveJahr1Chf: leerstandsreserveChf,
    mietsteigerungPercentPerYear: facts.mehrjahresmodell.mietsteigerungPercentPerYear ?? P.mietsteigerungPercentPerYear,
    kosteninflationPercentPerYear: facts.mehrjahresmodell.kosteninflationPercentPerYear ?? P.kosteninflationPercentPerYear,
    wertsteigerungPercentPerYear: facts.mehrjahresmodell.wertsteigerungPercentPerYear ?? P.wertsteigerungPercentPerYear,
    wertvermehrendeRenovationChf: renovationSummary.totalByKategorie.WERTVERMEHREND,
    moeblierung: moeblierungLebenszyklusEffective,
    haushaltinventar: haushaltinventarLebenszyklusEffective,
    hypothek: {
      ersteHypothek: { initialLoanChf: ersteHypothekChf, amortisation: facts.hypothek.ersteHypothek.amortisation },
      zweiteHypothek: { initialLoanChf: zweiteHypothekChf, amortisation: facts.hypothek.zweiteHypothek.amortisation },
      interestRatePercent: facts.hypothek.interestRatePercent,
    },
    kalkulatorischerSteuersatzPercent,
    exit: {
      sellingCostPercent: facts.mehrjahresmodell.sellingCostPercent ?? P.sellingCostPercent,
      grundstueckgewinnsteuerPercent: facts.mehrjahresmodell.grundstueckgewinnsteuerPercent,
    },
  };

  const mehrjahresmodell = runMehrjahresmodell(mehrjahresmodellInput);
  const investmentTreiber = computeInvestmentTreiber(mehrjahresmodellInput);

  if ((facts.moeblierung.initialCostChf > 0 || facts.moeblierung.haushaltinventarInitialCostChf > 0) && facts.moeblierung.kostensteigerungPercentPerYear === undefined) {
    assumptionNotes.push(`Kosteninflation Möblierung/Haushaltsinventar nicht erfasst — allgemeine Kosteninflation (${moeblierungKostensteigerung}%/Jahr) verwendet.`);
  }
  if (facts.miete.leerstandPercent === undefined && facts.miete.vermietungsmodell !== "SHORT_STAY") assumptionNotes.push(`Leerstandsquote nicht erfasst — Platzhalter-Default (${leerstandDefaultPercent}%) verwendet.`);
  if (facts.kalkulatorischerSteuersatzPercent === undefined) assumptionNotes.push(`Kalkulatorischer Steuersatz nicht erfasst — Platzhalter-Default (${kalkulatorischerSteuersatzPercent}%) verwendet, kein Steuerberatungsersatz.`);
  if (facts.reserven.reparaturChfPerYear === undefined && facts.reserven.reparaturPercentOfKaufpreis === undefined) assumptionNotes.push(`Eigene Reparaturreserve nicht erfasst — Platzhalter-Default (${P.reparaturreservePercentOfKaufpreis}% des Kaufpreises) verwendet.`);
  if (facts.reserven.leerstandChfPerYear === undefined && facts.reserven.leerstandPercentOfKaufpreis === undefined) assumptionNotes.push(`Eigene Leerstandsreserve nicht erfasst — Platzhalter-Default (${P.leerstandsreservePercentOfKaufpreis}% des Kaufpreises) verwendet.`);
  if (facts.notes) assumptionNotes.push(facts.notes);
  // Keine harte Fehlermeldung (die Engine liefert bewusst immer eine Zahl, nie einen
  // Wurf) — aber ein deutlicher Hinweis, da Eigenkapitalbedarf sonst negativ würde und
  // Cash-on-Cash rechnerisch auf 0.00% fiele, statt als unplausibel erkennbar zu sein
  // (Review-Fund: sähe wie ein echtes Ergebnis aus, ist aber ein Eingabefehler).
  if (belehnungPercent > 100) assumptionNotes.push(`Belehnung insgesamt über 100% (${belehnungPercent}%) — Eingabe prüfen, Kennzahlen unten sind unter dieser Annahme nicht aussagekräftig.`);

  const kategorieRendite = (kategorieKaufpreisChf: number, mieteChfPerMonth: number): KategorieRendite => {
    const jahresmieteChf = mieteChfPerMonth * 12;
    return { kaufpreisChf: kategorieKaufpreisChf, jahresmieteChf, bruttoRenditePercent: kategorieKaufpreisChf > 0 ? (jahresmieteChf / kategorieKaufpreisChf) * 100 : 0 };
  };
  const kategorienRenditen: KategorienRenditen = {
    wohnung: kategorieRendite(property.kaufpreisChf, facts.miete.wohnungsMieteChfPerMonth),
    garage: kategorieRendite(facts.garagenplatzKaufpreisChf, facts.miete.garagenplatzMieteChfPerMonth),
    aussenparkplatz: kategorieRendite(facts.parkplatzKaufpreisChf, facts.miete.parkplatzMieteChfPerMonth),
    hobbyraum: kategorieRendite(facts.hobbyraumKaufpreisChf, facts.miete.hobbyraumMieteChfPerMonth),
  };

  return {
    schnellcheck,
    allInInvestitionChf,
    eigenkapitalChf,
    investmentCase,
    noiBreakdown,
    breakEven: {
      mieteChfPerMonth: breakEvenMieteChfPerMonth(investmentCaseInput),
      zinsPercent: breakEvenZinsPercent(investmentCaseInput),
      auslastungPercent: breakEvenAuslastungPercent(investmentCaseInput),
    },
    furnishingRoi,
    incrementalFurnitureNoi,
    furnishedRentalDelta,
    furnishedOpexBreakdown,
    moeblierungReserveChfPerJahr,
    moeblierungsVergleichVariante,
    moeblierungsVergleich,
    renovationRoi,
    renovationSummary,
    mehrjahresmodell,
    investmentTreiber,
    hypothek: { ersteHypothekChf, zweiteHypothekChf, ersteAmortisationChfPerYear, zweiteAmortisationChfPerYear },
    schnellcheckKostenBreakdown: { laufendeKostenChfPerYear: schnellcheckLaufendeKostenChfPerYear, zinsChf: schnellcheckZinsChf },
    parkierung: {
      parkplatzZusatzChf: parkplatzKaufpreisZusatzChf,
      garagenplatzZusatzChf: garagenplatzKaufpreisZusatzChf,
      hobbyraumZusatzChf: hobbyraumKaufpreisZusatzChf,
      totalZusatzChf: parkierungKaufpreisZusatzChf,
    },
    kategorienRenditen,
    stweg: facts.stweg,
    assumptionNotes,
  };
}

export interface Verhandlungskorridor {
  /** Rechnerisches Maximum — Kaufpreis, bei dem der nachhaltige Cashflow gerade CHF 0 erreicht (alles darüber ist rechnerisch nicht mehr cashflow-tragfähig unter den aktuellen Annahmen). Das ist eine reine Solvenzgrenze ("ab wann geht bei diesem Fremdkapitalzins das Geld aus") — bei tiefen Zinsen und hoher Belehnung liegt sie oft weit über dem, was unter dem eigenen Renditeziel noch eine gute Investition wäre; für die Preisverhandlung ist meist `nettoZielChf` die relevantere Obergrenze. `undefined`, wenn selbst ein Kaufpreis nahe CHF 0 keinen positiven Cashflow ergibt (Objekt trägt sich unter keinen Umständen). */
  maximumChf: number | undefined;
  /** Kaufpreis, bei dem die Bruttorendite (Kaufpreis) genau das gespeicherte Renditeziel (Annahmen-Reiter, `bruttoRenditeZielPercent`) erreicht — algebraisch hergeleitet aus der ohnehin konstanten Jahresnettomiete, nicht als Sicherheitsmarge vom Maximum. Nach oben durch `maximumChf` gedeckelt (ein Ziel über dem cashflow-neutralen Maximum wäre widersinnig). `undefined`, wenn kein Renditeziel gesetzt ist oder `maximumChf` selbst `undefined` ist. */
  zielChf: number | undefined;
  /**
   * Kaufpreis, bei dem die Nettorendite vor Finanzierung genau das gespeicherte
   * Nettorenditeziel (Annahmen-Reiter, `nettoRenditeZielPercent`) erreicht — per Bisektion,
   * da die Nettorendite (anders als die Bruttorendite) über die kaufpreisabhängigen
   * Kaufnebenkosten in der All-in-Investition nicht rein algebraisch nach dem Kaufpreis
   * auflösbar ist. Ergänzt `zielChf` (der nur die Bruttorendite trifft): weil die
   * Nettorendite zusätzlich Leerstand/Betriebskosten/Eigentümerkosten abzieht, liegt
   * `nettoZielChf` in aller Regel deutlich UNTER `zielChf` und oft auch deutlich unter
   * `maximumChf` — anders als die reine Cashflow-Solvenzgrenze bildet er tatsächlich ab,
   * ob der Kauf beim eigenen Nettorenditeziel noch lohnt. Nach oben durch `maximumChf`
   * gedeckelt. `undefined`, wenn kein Nettorenditeziel gesetzt ist oder `maximumChf` selbst
   * `undefined` ist.
   */
  nettoZielChf: number | undefined;
  /** Eigene, per Marktrecherche bestimmte Einschätzung (`facts.eroeffnungsangebotChf`) — bewusst NICHT rechnerisch hergeleitet (Rückmeldung: "eröffnungspreis vom markt her (research) bestimmt", vorher waren das frei erfundene Prozentzahlen ohne Marktbezug). `undefined`, solange nicht erfasst. */
  eroeffnungChf: number | undefined;
}

/**
 * Die strengere (= tiefere) der beiden gesetzten Zielgrössen (Bruttorendite-Zielpreis /
 * Nettorendite-Preisobergrenze) — in aller Regel liegt `nettoZielChf` deutlich unter
 * `zielChf` (Nettorendite ist die strengere Grösse), das kehrt sich aber um, wenn
 * `nettoRenditeZielPercent` auf dem Annahmen-Reiter deutlich lockerer gesetzt wird als
 * `bruttoRenditeZielPercent` (beide frei überschreibbar) — dann wäre `zielChf` die
 * strengere/tiefere Grenze. Verwendet sowohl als unterer Anker der Preis-Stufentabelle
 * (`computePreisStufentabelle`) als auch als "realistisches Verhandlungsziel" im
 * Verhandlungskorridor-Panel (Rückmeldung: "muss noch aussagekräftiger, griffiger und
 * realitätsnah gemacht werden") — an EINER Stelle definiert statt zweimal dieselbe
 * Min-Logik zu pflegen.
 */
export function strengsteZielgroesse(korridor: Pick<Verhandlungskorridor, "zielChf" | "nettoZielChf">): number | undefined {
  const { zielChf, nettoZielChf } = korridor;
  if (zielChf !== undefined && nettoZielChf !== undefined) return Math.min(zielChf, nettoZielChf);
  return nettoZielChf ?? zielChf;
}

export interface VerhandlungskorridorRelation {
  /** Negativ = Punkt liegt UNTER dem Inseratpreis (für Eröffnung/Ziel der Normalfall — Verhandlungsspielraum), positiv = darüber. */
  diffChf: number;
  diffPercent: number;
}

/**
 * Setzt einen Verhandlungskorridor-Punkt (Eröffnung/Ziel/Preisobergrenze/Maximum) in
 * Relation zum aktuellen Inseratpreis (`property.kaufpreisChf` — derselbe Basis-Kaufpreis
 * Wohnung, auf dem auch `computeVerhandlungskorridor` selbst rechnet, OHNE Parkplatz/
 * Garage/Hobbyraum-Zuschlag) — Rückmeldung: "zus. ins Verhältnis zum
 * Inserate-Start-Verkäuferpreis gesetzt". `undefined`, wenn der Punkt selbst `undefined`
 * ist oder kein positiver Inseratpreis vorliegt.
 */
export function verhandlungskorridorRelation(punktChf: number | undefined, inseratpreisChf: number): VerhandlungskorridorRelation | undefined {
  if (punktChf === undefined || inseratpreisChf <= 0) return undefined;
  const diffChf = punktChf - inseratpreisChf;
  return { diffChf, diffPercent: (diffChf / inseratpreisChf) * 100 };
}

/**
 * Preisverhandlungsspanne (Eröffnungsangebot/Ziel/Maximum) — Wunsch aus dem ChatGPT-
 * Analysenvergleich: eine dort mitgelieferte Verhandlungsstrategie, die es bei HOME4efFINDER
 * noch nicht gab. Das Maximum ist der Kaufpreis, bei dem der bereits an anderer Stelle
 * verwendete "nachhaltige Cashflow" (siehe Cashflow-Wasserfall) gerade CHF 0 erreicht —
 * mit numerischer Bisektion wie bei den bestehenden `breakEvenMieteChfPerMonth`/
 * `breakEvenZinsPercent`. Variiert bewusst nur den Basis-Kaufpreis der Wohnung
 * (property.kaufpreisChf) — Parkplatz/Garage/Möblierung/alle übrigen Fakten bleiben fix,
 * das ist der Teil des Pakets, über den tatsächlich verhandelt wird.
 *
 * `nettoZielChf` (Rückmeldung aus dem SIPIS/ChatGPT-Benchmark-Vergleich, siehe
 * DECISIONS.md): das cashflow-basierte Maximum beantwortet nur "ab wann trägt sich das
 * Objekt nicht mehr", nicht "ab wann ist es noch eine gute Investition nach meinem
 * Nettorenditeziel" — bei tiefen Zinsen kann das Maximum daher weit über einem Preis
 * liegen, den ein diszipliniertes Renditeziel noch zuliesse. `nettoZielChf` schliesst
 * diese Lücke mit derselben Bisektionslogik, nur gegen die Nettorendite statt gegen den
 * Cashflow.
 */
export function computeVerhandlungskorridor(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  parameterOverrides?: ParameterOverrides,
): Verhandlungskorridor {
  const P: Record<BestandsrenditeParameterKey, number> = { ...defaultsOf(BESTANDSRENDITE_PARAMETERS), ...parameterOverrides };
  const nachhaltigerCashflowFuerKaufpreis = (kaufpreisChf: number): number =>
    computeBestandsrenditeAnalysis({ ...property, kaufpreisChf }, facts, parameterOverrides).investmentCase.wasserfall.nachhaltigerCashflowChf;

  const maximumChf = bisectRoot(nachhaltigerCashflowFuerKaufpreis, 1_000, property.kaufpreisChf * 5 + 500_000);
  const eroeffnungChf = facts.eroeffnungsangebotChf;
  if (maximumChf === undefined) return { maximumChf: undefined, zielChf: undefined, nettoZielChf: undefined, eroeffnungChf };

  // Bruttorendite (Kaufpreis) = Jahresnettomiete ÷ (Basis-Kaufpreis + Parkplatz/Garage) —
  // die Jahresnettomiete selbst hängt nicht vom (verhandelbaren) Basis-Kaufpreis ab, daher
  // lässt sich der Zielpreis direkt algebraisch auflösen statt erneut per Bisektion zu
  // suchen (schneller und exakt, kein Wurzelfindungs-Toleranzfehler).
  const referenz = computeBestandsrenditeAnalysis(property, facts, parameterOverrides);
  const zielRenditePercent = P.bruttoRenditeZielPercent;
  const zielRenditeKaufpreisChf =
    zielRenditePercent > 0 ? referenz.schnellcheck.jahresnettomieteChf / (zielRenditePercent / 100) - referenz.parkierung.totalZusatzChf : undefined;
  const zielChf = zielRenditeKaufpreisChf !== undefined ? Math.min(Math.max(0, zielRenditeKaufpreisChf), maximumChf) : undefined;

  // Nettorendite vor Finanzierung = NOI ÷ All-in-Investition — die All-in-Investition
  // enthält kaufpreisabhängige Kaufnebenkosten (Handänderungssteuer/Notariat/Makler als
  // Prozentsatz des Kaufpreises), daher keine geschlossene Formel wie bei der
  // Bruttorendite: numerische Bisektion, analog zu `maximumChf`.
  const nettoRenditeFuerKaufpreis = (kaufpreisChf: number): number =>
    computeBestandsrenditeAnalysis({ ...property, kaufpreisChf }, facts, parameterOverrides).investmentCase.nettoRenditeVorFinanzierungPercent -
    P.nettoRenditeZielPercent;
  const nettoZielRohChf = P.nettoRenditeZielPercent > 0 ? bisectRoot(nettoRenditeFuerKaufpreis, 1_000, property.kaufpreisChf * 5 + 500_000) : undefined;
  const nettoZielChf = nettoZielRohChf !== undefined ? Math.min(Math.max(0, nettoZielRohChf), maximumChf) : undefined;

  return { maximumChf, zielChf, nettoZielChf, eroeffnungChf };
}

/** Eine einzelne Zeile der Preis-Stufentabelle (siehe `computePreisStufentabelle`) — dieselben drei Kennzahlen, die auch den Verhandlungskorridor bestimmen (Bruttorendite → Zielpreis, Nettorendite → Preisobergrenze, nachhaltiger Cashflow → Maximum), hier für mehrere Kaufpreise nebeneinander statt nur an den drei Korridor-Punkten. */
export interface PreisStufe {
  kaufpreisChf: number;
  bruttoRenditePercent: number;
  nettoRenditeVorFinanzierungPercent: number;
  nachhaltigerCashflowChf: number;
  /** = `allInInvestitionChf` bei diesem Kaufpreis (Kaufpreis + Nebenkosten + Renovation + Möblierung — Reparaturkosten sind jährlich wiederkehrend und fliessen NICHT in die Investitionssumme, siehe `BestandsrenditeFacts.reparatur`). */
  totalInvestitionChf: number;
  /** = All-in-Investition − Hypothek bei diesem Kaufpreis. */
  eigenkapitalChf: number;
  /** = nachhaltiger Cashflow ÷ Eigenkapital × 100 bei diesem Kaufpreis — dieselbe (vollständigste) Definition wie `investmentCase.cashOnCashPercent`. */
  cashOnCashPercent: number;
  /** `true` für genau die Zeile, die exakt dem aktuellen Kaufpreis (`property.kaufpreisChf`) entspricht — dieser wird der (auf CHF 5'000 gerundeten) Stufenliste immer exakt hinzugefügt, statt darauf zu hoffen, dass ihn eine Rundung zufällig trifft, damit die UI ihn zuverlässig hervorheben kann. */
  istAktuellerKaufpreis: boolean;
  /**
   * Benannte(r) Ankerpunkt(e), die exakt auf diesen Kaufpreis fallen — "Economic
   * Target"/"Investment Value"/"Walk-Away Price"/"Angebotspreis", mit " / " verbunden,
   * falls mehrere zusammenfallen (z.B. wenn Brutto- und Nettorendite-Zielpreis identisch
   * sind). `undefined` für reine Zwischenstufen ohne besondere Bedeutung.
   */
  anchorLabel: string | undefined;
}

/**
 * Preis-Stufentabelle — Wunsch aus dem SIPIS/ChatGPT-Benchmark-Vergleich (siehe
 * DECISIONS.md): der Verhandlungskorridor liefert nur drei diskrete Ankerpunkte
 * (Zielpreis/Preisobergrenze/Maximum), SIPIS zeigt zusätzlich eine durchgehende Tabelle
 * "was passiert mit Rendite/Cashflow bei diesem Kaufpreis" über mehrere Preisschritte —
 * genau die Kurve, die man in einer echten Verhandlung braucht, nicht nur die Endpunkte.
 *
 * Die INTERPOLIERTEN Zwischenstufen ergeben sich aus den bereits vorhandenen
 * Korridor-Werten: von der strengsten gesetzten Zielgrösse (`nettoZielChf`, sonst
 * `zielChf`) bis zum aktuellen Kaufpreis — unabhängig davon, ob der aktuelle Preis über
 * oder unter dem Ziel liegt (Reihenfolge wird über min/max hergestellt, nicht
 * angenommen). Diese Zwischenstufen reichen bewusst NICHT bis `maximumChf`: das ist eine
 * reine Cashflow-Solvenzgrenze, die bei tiefen Zinsen weit ausserhalb jeder sinnvollen
 * Verhandlungsspanne liegen kann und die dichte Interpolation unbrauchbar strecken würde.
 * Beide Enden werden auf CHF 5'000 gerundet, damit die Stufen "runde",
 * verhandlungstaugliche Preise zeigen statt krummer Bisektions-Zwischenwerte.
 *
 * ZUSÄTZLICH werden vier benannte Ankerpunkte exakt (nicht gerundet) ergänzt, auch wenn
 * sie ausserhalb der interpolierten Spanne liegen — Auftrag "Advanced Price Strategy
 * Engine": "mindestens Investment Value / Economic Target / aktuelles Angebot /
 * Walk-Away Price müssen als eigene Zeilen enthalten sein" (siehe `anchorLabel` in
 * `PreisStufe`). Das widerspricht der obigen "nicht bis maximumChf"-Entscheidung nicht:
 * die DICHTE Interpolation bleibt auf die sinnvolle Spanne begrenzt, nur der
 * Walk-Away-Punkt selbst wird als einzelne zusätzliche Zeile sichtbar gemacht.
 *
 * `[]`, wenn kein sinnvoller interpolierter Bereich existiert (kein Renditeziel gesetzt
 * und Maximum `undefined`, oder Ziel-Preis und aktueller Kaufpreis fallen nach Rundung
 * zusammen) — auch dann werden bewusst KEINE nackten Anker-Zeilen ohne jede
 * Zwischenstufe gezeigt, um dieselbe Fallunterscheidung wie bisher (leere Tabelle statt
 * einer Tabelle mit nur einer Zeile) beizubehalten.
 */
export function computePreisStufentabelle(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  verhandlungskorridor: Verhandlungskorridor,
  parameterOverrides?: ParameterOverrides,
  steps = 6,
): PreisStufe[] {
  const zielAnker = strengsteZielgroesse(verhandlungskorridor);
  if (zielAnker === undefined) return [];

  const rundenAuf5000 = (chf: number): number => Math.round(chf / 5_000) * 5_000;
  const tiefChf = rundenAuf5000(Math.min(zielAnker, property.kaufpreisChf));
  const hochChf = rundenAuf5000(Math.max(zielAnker, property.kaufpreisChf));
  if (tiefChf >= hochChf || steps < 2) return [];

  const gerundeteStufenpreise = Array.from({ length: steps }, (_, i) => Math.round(tiefChf + ((hochChf - tiefChf) * i) / (steps - 1)));

  // Benannte Ankerpunkte exakt (nicht gerundet) ergänzen — siehe Funktionskommentar.
  // Mehrere Anker können auf denselben Kaufpreis fallen (z.B. wenn Brutto- und
  // Nettorendite-Zielpreis identisch sind, oder wenn der aktuelle Kaufpreis selbst genau
  // dem Economic Target entspricht) — dann werden ihre Labels zusammengeführt, statt
  // doppelte Zeilen zu erzeugen.
  const ankerpunkte: { kaufpreisChf: number; label: string }[] = [
    { kaufpreisChf: zielAnker, label: "Economic Target" },
    ...(verhandlungskorridor.nettoZielChf !== undefined ? [{ kaufpreisChf: verhandlungskorridor.nettoZielChf, label: "Investment Value" }] : []),
    ...(verhandlungskorridor.maximumChf !== undefined ? [{ kaufpreisChf: verhandlungskorridor.maximumChf, label: "Walk-Away Price" }] : []),
    { kaufpreisChf: property.kaufpreisChf, label: "Angebotspreis" },
  ];
  const anchorLabelsByPreis = new Map<number, string[]>();
  for (const { kaufpreisChf, label } of ankerpunkte) {
    anchorLabelsByPreis.set(kaufpreisChf, [...(anchorLabelsByPreis.get(kaufpreisChf) ?? []), label]);
  }
  for (const kaufpreisChf of gerundeteStufenpreise) {
    if (!anchorLabelsByPreis.has(kaufpreisChf)) anchorLabelsByPreis.set(kaufpreisChf, []);
  }
  const alleKaufpreise = Array.from(anchorLabelsByPreis.keys()).sort((a, b) => a - b);

  return alleKaufpreise.map((kaufpreisChf) => {
    const analysis = computeBestandsrenditeAnalysis({ ...property, kaufpreisChf }, facts, parameterOverrides);
    const labels = anchorLabelsByPreis.get(kaufpreisChf) ?? [];
    return {
      kaufpreisChf,
      bruttoRenditePercent: analysis.investmentCase.bruttoRenditeKaufpreisPercent,
      nettoRenditeVorFinanzierungPercent: analysis.investmentCase.nettoRenditeVorFinanzierungPercent,
      nachhaltigerCashflowChf: analysis.investmentCase.wasserfall.nachhaltigerCashflowChf,
      totalInvestitionChf: analysis.allInInvestitionChf,
      eigenkapitalChf: analysis.eigenkapitalChf,
      cashOnCashPercent: analysis.investmentCase.cashOnCashPercent,
      istAktuellerKaufpreis: kaufpreisChf === property.kaufpreisChf,
      anchorLabel: labels.length > 0 ? labels.join(" / ") : undefined,
    };
  });
}

export interface MoeblierungsAlternative {
  /** Konkretes Vermietungsmodell-Label der Alternative (z.B. "Möbliert Mittelzeit", nicht nur pauschal "möbliert") — siehe `VERMIETUNGSMODELL_LABELS`. */
  label: string;
  analysis: BestandsrenditeAnalysisResult;
  verhandlungskorridor: Verhandlungskorridor;
}

const VERMIETUNGSMODELL_VALUES: Vermietungsmodell[] = ["LANGFRISTIG_UNMOEBLIERT", "LANGFRISTIG_MOEBLIERT", "MITTELFRISTIG_MOEBLIERT", "SHORT_STAY"];

/** Anzeigetext je Vermietungsmodell, z.B. für `MoeblierungsAlternative.label`/`VermietungsstrategieErgebnis.label` und zur Beschriftung von `moeblierungsVergleichVariante` in der UI. */
export const VERMIETUNGSMODELL_LABELS: Record<Vermietungsmodell, string> = {
  LANGFRISTIG_UNMOEBLIERT: "Unmöbliert",
  LANGFRISTIG_MOEBLIERT: "Möbliert Langzeit",
  MITTELFRISTIG_MOEBLIERT: "Möbliert Mittelzeit",
  SHORT_STAY: "Möbliert Kurzzeit",
};

/**
 * Rechnet das jeweils ANDERE Szenario (möbliert/unmöbliert) komplett durch — für eine
 * kompakte "Schattenrechnung" neben den Hauptkennzahlen auf allen Ebenen (Rückmeldung:
 * "bitte prüfen, wo dieser Vergleich überall durchschlägt resp. als Vergleich
 * dargestellt werden soll", siehe DECISIONS.md). Ergänzt `moeblierungsVergleich` (der nur
 * Miete/Kosten/Jahresertrag/Bruttorendite vergleicht) um die übrigen, vom gewählten
 * Szenario abhängigen Kennzahlen (IRR, Equity Multiple, Verhandlungskorridor, …), die sich
 * nicht einfach algebraisch aus den beiden Ertragswerten ableiten lassen.
 *
 * `null`, wenn kein sinnvolles Alternativszenario existiert: ohne erfasste
 * Möblierungsdaten (weder Möbel-/Haushaltsinventar-Initialkosten noch ein Mietaufschlag
 * der Alternativ-Variante) wäre das Alternativszenario ohnehin identisch mit dem
 * Hauptszenario. Ist bereits eine möblierte Variante gewählt, ist "die Alternative"
 * unmöbliert; ist unmöbliert gewählt, ist es die Vergleichsvariante aus
 * `resolveMoeblierungsVergleichVariante` (Default "Möbliert Mittelzeit"). Für den vollen
 * Vergleich aller vier Modelle siehe stattdessen `computeVermietungsstrategienVergleich`.
 */
export function computeMoeblierungsAlternative(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  parameterOverrides?: ParameterOverrides,
): MoeblierungsAlternative | null {
  const aktuell = facts.miete.vermietungsmodell;
  const alternativesModell: Vermietungsmodell = aktuell === "LANGFRISTIG_UNMOEBLIERT" ? resolveMoeblierungsVergleichVariante(aktuell) : "LANGFRISTIG_UNMOEBLIERT";
  const alternativesModellIstMoebliert = alternativesModell !== "LANGFRISTIG_UNMOEBLIERT";
  const relevanterMietPremiumChfPerMonth = resolveMietPremiumChfPerMonth(alternativesModellIstMoebliert ? alternativesModell : aktuell, facts.moeblierung);
  if (facts.moeblierung.initialCostChf <= 0 && facts.moeblierung.haushaltinventarInitialCostChf <= 0 && relevanterMietPremiumChfPerMonth <= 0) return null;

  const alternativeFacts: BestandsrenditeFacts = { ...facts, miete: { ...facts.miete, vermietungsmodell: alternativesModell } };
  return {
    label: VERMIETUNGSMODELL_LABELS[alternativesModell],
    analysis: computeBestandsrenditeAnalysis(property, alternativeFacts, parameterOverrides),
    verhandlungskorridor: computeVerhandlungskorridor(property, alternativeFacts, parameterOverrides),
  };
}

/** Wie verlässlich die Annahmen einer Vermietungsstrategie im 4-Wege-Vergleich sind — dieselbe Skala wie `priceStrategy.ts::ConfidenceLevel`, hier bewusst lokal definiert statt importiert (priceStrategy.ts importiert bereits von diesem Modul, ein Rückimport würde einen Zirkelbezug erzeugen). */
export type VermietungsstrategieConfidence = "HIGH" | "MEDIUM" | "LOW";

/** Eine einzelne Zeile im 4-Wege-Vergleich — siehe `computeVermietungsstrategienVergleich`. */
export interface VermietungsstrategieErgebnis {
  modell: Vermietungsmodell;
  label: string;
  stabilisierterNoiChf: number;
  nettoRenditeVorFinanzierungPercent: number;
  cashOnCashPercent: number;
  /** = stabilisierterNoiChf ÷ (Nettorendite-Ziel ÷ 100), siehe `computeVermietungsstrategienVergleich`. */
  investmentValueChf: number;
  /** = investmentValueChf dieser Strategie − investmentValueChf von "Unmöbliert" (0 für Unmöbliert selbst). */
  valueCreationChf: number;
  confidence: VermietungsstrategieConfidence;
}

export interface VermietungsstrategienVergleich {
  /** Immer alle vier Vermietungsmodelle, in fester Reihenfolge (siehe `VERMIETUNGSMODELL_VALUES`). */
  strategien: VermietungsstrategieErgebnis[];
  /**
   * Unter den Strategien mit Confidence ≠ LOW diejenige mit dem höchsten stabilisierten
   * NOI — "Unmöbliert" braucht nie einen Mietaufschlag und ist daher nie LOW, fällt die
   * Empfehlung also automatisch auf "Unmöbliert" zurück, wenn keine möblierte Variante
   * verlässlich genug ist (kein erfasster Mietaufschlag). `undefined` nur theoretisch
   * möglich (leere Strategienliste kommt praktisch nicht vor, da immer alle vier Modelle
   * durchgerechnet werden).
   */
  empfehlung: { modell: Vermietungsmodell; begruendung: string } | undefined;
}

/**
 * HIGH: Mietaufschlag der Variante ist erfasst UND Leerstand ist manuell erfasst (nicht
 * auf Platzhalter-Default angewiesen). MEDIUM: Mietaufschlag erfasst, Leerstand auf
 * Default. LOW: für eine möblierte Variante gar kein Mietaufschlag erfasst — deren
 * Zielmiete ist dann komplett ungeprüft, nicht Grundlage einer automatischen Empfehlung.
 * "Unmöbliert" braucht keinen Aufschlag, daher nie LOW.
 */
function resolveVermietungsstrategieConfidence(modell: Vermietungsmodell, facts: BestandsrenditeFacts): VermietungsstrategieConfidence {
  // SHORT_STAY nutzt auslastungPercent statt leerstandPercent für den Mietausfall (siehe
  // calculateJahresertrag) — die "ist der Mietausfall manuell erfasst"-Frage muss daher
  // je Modell das jeweils richtige Feld prüfen.
  const mietausfallErfasst = modell === "SHORT_STAY" ? facts.miete.auslastungPercent !== undefined : facts.miete.leerstandPercent !== undefined;
  if (modell === "LANGFRISTIG_UNMOEBLIERT") return mietausfallErfasst ? "HIGH" : "MEDIUM";
  const premiumChfPerMonth = resolveMietPremiumChfPerMonth(modell, facts.moeblierung);
  if (premiumChfPerMonth <= 0) return "LOW";
  return mietausfallErfasst ? "HIGH" : "MEDIUM";
}

/**
 * SIPIS Furnished-Rental-Modul (v1.1) — voller Vergleich aller vier Vermietungsmodelle
 * (Investment Value/Cash-on-Cash/Nettorendite/Value Creation je Modell, plus eine
 * Empfehlung) unabhängig davon, welches Modell aktuell tatsächlich gewählt ist. Anders
 * als `computeMoeblierungsAlternative` (EIN "Schatten"-Alternativszenario mit vollem
 * IRR/Verhandlungskorridor) hier bewusst NUR die für einen schnellen Strategie-Vergleich
 * nötigen Kennzahlen, dafür alle vier Modelle gleichzeitig — für JEDES Modell wird
 * `computeBestandsrenditeAnalysis` einmal komplett durchgerechnet (mit dem jeweils
 * passenden Mietaufschlag, siehe `resolveMietPremiumChfPerMonth`).
 *
 * `investmentValueChf = stabilisierterNoiChf / (nettoRenditeZielPercent / 100)` — direkte
 * Umsetzung der Spec-Formel, kein Bisektionsverfahren wie beim Verhandlungskorridor.
 *
 * Empfehlung: unter den Strategien mit Confidence ≠ LOW (nichts auf Basis einer reinen
 * Rateweite empfehlen) diejenige mit dem höchsten stabilisierten NOI, bei Gleichstand der
 * höchste Investment Value. "Unmöbliert" braucht nie einen Mietaufschlag und ist daher nie
 * LOW — erreicht keine möblierte Variante mindestens MEDIUM-Confidence, fällt die
 * Empfehlung automatisch auf "Unmöbliert" zurück (die einzig verlässlich einschätzbare
 * Option), statt ganz zu entfallen.
 *
 * Bewusst NICHT modelliert: operativer Aufwand und Risiko (zwei der sechs von der Spec
 * genannten Entscheidungskriterien) — HOME4efFINDER hat dafür keine Datenquelle, ein
 * erfundener Wert wäre keine Verbesserung (dieselbe Linie wie bei "Objektqualität" im
 * SIPIS-Score, siehe DECISIONS.md). Guardrail der Spec: "Highest gross rent MUST NOT
 * automatically be considered the best strategy" — die Empfehlung basiert auf NOI/
 * Investment Value (bereits netto aller möblierungsspezifischen Zusatzkosten), nicht auf
 * der Bruttomiete.
 */
export function computeVermietungsstrategienVergleich(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  parameterOverrides?: ParameterOverrides,
): VermietungsstrategienVergleich {
  const P = { ...defaultsOf(BESTANDSRENDITE_PARAMETERS), ...parameterOverrides };

  const strategien: VermietungsstrategieErgebnis[] = VERMIETUNGSMODELL_VALUES.map((modell) => {
    const modellFacts: BestandsrenditeFacts = { ...facts, miete: { ...facts.miete, vermietungsmodell: modell } };
    const analysis = computeBestandsrenditeAnalysis(property, modellFacts, parameterOverrides);
    const stabilisierterNoiChf = analysis.investmentCase.wasserfall.noiChf;
    const investmentValueChf = P.nettoRenditeZielPercent > 0 ? stabilisierterNoiChf / (P.nettoRenditeZielPercent / 100) : 0;
    return {
      modell,
      label: VERMIETUNGSMODELL_LABELS[modell],
      stabilisierterNoiChf,
      nettoRenditeVorFinanzierungPercent: analysis.investmentCase.nettoRenditeVorFinanzierungPercent,
      cashOnCashPercent: analysis.investmentCase.cashOnCashPercent,
      investmentValueChf,
      valueCreationChf: 0, // unten relativ zu "Unmöbliert" nachgetragen
      confidence: resolveVermietungsstrategieConfidence(modell, facts),
    };
  });

  const unmoebliertInvestmentValueChf = strategien.find((s) => s.modell === "LANGFRISTIG_UNMOEBLIERT")?.investmentValueChf ?? 0;
  for (const s of strategien) s.valueCreationChf = s.investmentValueChf - unmoebliertInvestmentValueChf;

  const kandidaten = strategien.filter((s) => s.confidence !== "LOW");
  let empfehlung: VermietungsstrategienVergleich["empfehlung"];
  if (kandidaten.length > 0) {
    const beste = kandidaten.reduce((best, s) =>
      s.stabilisierterNoiChf > best.stabilisierterNoiChf || (s.stabilisierterNoiChf === best.stabilisierterNoiChf && s.investmentValueChf > best.investmentValueChf) ? s : best,
    );
    empfehlung = {
      modell: beste.modell,
      begruendung:
        "Höchster stabilisierter NOI unter den Strategien mit ausreichend verlässlichen Annahmen (Mietaufschlag erfasst) — operativer Aufwand und Risiko sind mangels Datenquelle nicht Teil dieser automatischen Einschätzung, höhere Bruttomiete allein war nicht ausschlaggebend.",
    };
  }

  return { strategien, empfehlung };
}

/**
 * Manuelle Validierung statt einer Schema-Bibliothek (keine im Projekt vorhanden,
 * gleiches Muster wie `parseListingVertiefungFacts`) — prüft nur, was die Engine
 * zwingend braucht, um nicht abzustürzen. Fehlende optionale Annahmen sind erlaubt
 * (siehe `computeBestandsrenditeAnalysis`).
 */
export function parseBestandsrenditeFacts(input: unknown): { facts: BestandsrenditeFacts } | { error: string } {
  if (typeof input !== "object" || input === null) return { error: "Kein Objekt" };
  const body = input as Record<string, unknown>;

  const miete = body.miete as Record<string, unknown> | undefined;
  if (!miete || typeof miete.wohnungsMieteChfPerMonth !== "number") return { error: "miete.wohnungsMieteChfPerMonth fehlt" };
  if (typeof miete.vermietungsmodell !== "string" || !VERMIETUNGSMODELL_VALUES.includes(miete.vermietungsmodell as Vermietungsmodell)) {
    return { error: "miete.vermietungsmodell muss LANGFRISTIG_UNMOEBLIERT/LANGFRISTIG_MOEBLIERT/MITTELFRISTIG_MOEBLIERT/SHORT_STAY sein" };
  }

  const hypothek = body.hypothek as Record<string, unknown> | undefined;
  const ersteHypothek = hypothek?.ersteHypothek as Record<string, unknown> | undefined;
  const zweiteHypothek = hypothek?.zweiteHypothek as Record<string, unknown> | undefined;
  // `amortisation` ist ein VERSCHACHTELTES Objekt ({ modus, prozentProJahr?, dauerJahre? },
  // siehe AmortisationSpec in @landfinder/financial-engine) — sowohl der von
  // buildBestandsrenditeFactsFromFormData gebaute Request-Body als auch der kanonische
  // HypothekTrancheFacts-Typ verschachteln so. Diese Prüfung erwartete früher fälschlich
  // ein FLACHES `amortisationModus`-Feld, das nie gesendet wurde — jede Speicherung von
  // Bestandsrendite-Fakten schlug dadurch mit einem 400 fehl, unbemerkt, solange die
  // Antwort clientseitig nicht geprüft wurde (siehe DECISIONS.md).
  const ersteAmortisation = ersteHypothek?.amortisation as Record<string, unknown> | undefined;
  const zweiteAmortisation = zweiteHypothek?.amortisation as Record<string, unknown> | undefined;
  if (!hypothek || typeof hypothek.interestRatePercent !== "number") return { error: "hypothek.interestRatePercent fehlt" };
  if (!ersteHypothek || typeof ersteHypothek.belehnungPercent !== "number" || typeof ersteAmortisation?.modus !== "string") {
    return { error: "hypothek.ersteHypothek.belehnungPercent/amortisation.modus fehlt" };
  }
  if (!zweiteHypothek || typeof zweiteHypothek.belehnungPercent !== "number" || typeof zweiteAmortisation?.modus !== "string") {
    return { error: "hypothek.zweiteHypothek.belehnungPercent/amortisation.modus fehlt" };
  }
  if (ersteAmortisation.modus !== "PROZENT_PRO_JAHR" && ersteAmortisation.modus !== "DAUER_JAHRE") {
    return { error: "hypothek.ersteHypothek.amortisation.modus muss PROZENT_PRO_JAHR oder DAUER_JAHRE sein" };
  }
  if (zweiteAmortisation.modus !== "PROZENT_PRO_JAHR" && zweiteAmortisation.modus !== "DAUER_JAHRE") {
    return { error: "hypothek.zweiteHypothek.amortisation.modus muss PROZENT_PRO_JAHR oder DAUER_JAHRE sein" };
  }

  const betriebskosten = (body.betriebskosten as Record<string, unknown>) ?? {};
  const nebenkosten = (body.nebenkosten as Record<string, unknown>) ?? {};
  const renovation = (body.renovation as Record<string, unknown>) ?? {};
  const reparatur = (body.reparatur as Record<string, unknown>) ?? {};
  const moeblierung = (body.moeblierung as Record<string, unknown>) ?? {};
  const moebliertBetriebskosten = (body.moebliertBetriebskosten as Record<string, unknown>) ?? {};
  const reserven = (body.reserven as Record<string, unknown>) ?? {};
  const mehrjahresmodell = (body.mehrjahresmodell as Record<string, unknown>) ?? {};
  const stweg = (body.stweg as StwegFacts) ?? {};
  const openingBidFaktorenRaw = body.openingBidFaktoren as Record<string, unknown> | undefined;

  const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  return {
    facts: {
      zimmerzahl: num(body.zimmerzahl),
      baujahr: num(body.baujahr),
      parkplatzKaufpreisChf: num(body.parkplatzKaufpreisChf) ?? 0,
      parkplatzImKaufpreisEnthalten: body.parkplatzImKaufpreisEnthalten === true,
      garagenplatzKaufpreisChf: num(body.garagenplatzKaufpreisChf) ?? 0,
      garagenplatzImKaufpreisEnthalten: body.garagenplatzImKaufpreisEnthalten === true,
      hobbyraumKaufpreisChf: num(body.hobbyraumKaufpreisChf) ?? 0,
      hobbyraumImKaufpreisEnthalten: body.hobbyraumImKaufpreisEnthalten === true,
      stweg,
      nebenkosten: {
        handaenderungssteuerPercent: num(nebenkosten.handaenderungssteuerPercent),
        notariatGrundbuchPercent: num(nebenkosten.notariatGrundbuchPercent),
        maklerprovisionPercent: num(nebenkosten.maklerprovisionPercent),
      },
      renovation: {
        initialRenovationCostChf: num(renovation.initialRenovationCostChf) ?? 0,
        positionen: Array.isArray(renovation.positionen) ? (renovation.positionen as RenovationPosition[]) : [],
        mieteVorRenovationChfPerMonth: num(renovation.mieteVorRenovationChfPerMonth),
        mieteNachRenovationChfPerMonth: num(renovation.mieteNachRenovationChfPerMonth),
      },
      reparatur: {
        jaehrlichUnmoebliertChf: num(reparatur.jaehrlichUnmoebliertChf) ?? 0,
      },
      moeblierung: {
        initialCostChf: num(moeblierung.initialCostChf) ?? 0,
        nutzungsdauerJahre: num(moeblierung.nutzungsdauerJahre),
        kostensteigerungPercentPerYear: num(moeblierung.kostensteigerungPercentPerYear),
        haushaltinventarInitialCostChf: num(moeblierung.haushaltinventarInitialCostChf) ?? 0,
        haushaltinventarNutzungsdauerJahre: num(moeblierung.haushaltinventarNutzungsdauerJahre),
        mietPremiumLangzeitChfPerMonth: num(moeblierung.mietPremiumLangzeitChfPerMonth) ?? 0,
        mietPremiumMittelzeitChfPerMonth: num(moeblierung.mietPremiumMittelzeitChfPerMonth) ?? 0,
        mietPremiumKurzzeitChfPerMonth: num(moeblierung.mietPremiumKurzzeitChfPerMonth) ?? 0,
      },
      miete: {
        wohnungsMieteChfPerMonth: miete.wohnungsMieteChfPerMonth,
        parkplatzMieteChfPerMonth: num(miete.parkplatzMieteChfPerMonth) ?? 0,
        garagenplatzMieteChfPerMonth: num(miete.garagenplatzMieteChfPerMonth) ?? 0,
        hobbyraumMieteChfPerMonth: num(miete.hobbyraumMieteChfPerMonth) ?? 0,
        sonstigeEinnahmenChfPerYear: num(miete.sonstigeEinnahmenChfPerYear) ?? 0,
        vermietungsmodell: miete.vermietungsmodell as Vermietungsmodell,
        leerstandPercent: num(miete.leerstandPercent),
        auslastungPercent: num(miete.auslastungPercent),
      },
      betriebskosten: {
        stwegAkontobeitragChfPerYear: num(betriebskosten.stwegAkontobeitragChfPerYear) ?? 0,
        stwegAkontobeitragUeberwaelzbarChfPerYear: num(betriebskosten.stwegAkontobeitragUeberwaelzbarChfPerYear) ?? 0,
        eigentuemerkostenChfPerYear: num(betriebskosten.eigentuemerkostenChfPerYear) ?? 0,
        vermietungskostenChfPerYear: num(betriebskosten.vermietungskostenChfPerYear) ?? 0,
        reinigungServiceUnmoebliertChfPerYear: num(betriebskosten.reinigungServiceUnmoebliertChfPerYear) ?? 0,
      },
      moebliertBetriebskosten: {
        internetChfPerMonth: num(moebliertBetriebskosten.internetChfPerMonth) ?? 0,
        kabelTvChfPerMonth: num(moebliertBetriebskosten.kabelTvChfPerMonth) ?? 0,
        streamingChfPerMonth: num(moebliertBetriebskosten.streamingChfPerMonth) ?? 0,
        stromChfPerMonth: num(moebliertBetriebskosten.stromChfPerMonth) ?? 0,
        abfallChfPerMonth: num(moebliertBetriebskosten.abfallChfPerMonth) ?? 0,
        mieterwechselProJahr: num(moebliertBetriebskosten.mieterwechselProJahr) ?? 0,
        reinigungProWechselChf: num(moebliertBetriebskosten.reinigungProWechselChf) ?? 0,
        waescheProWechselChf: num(moebliertBetriebskosten.waescheProWechselChf) ?? 0,
        inseratProWechselChf: num(moebliertBetriebskosten.inseratProWechselChf) ?? 0,
        verbrauchsmaterialChfPerMonth: num(moebliertBetriebskosten.verbrauchsmaterialChfPerMonth) ?? 0,
        kleinreparaturenChfPerMonth: num(moebliertBetriebskosten.kleinreparaturenChfPerMonth) ?? 0,
        hausratversicherungChfPerMonth: num(moebliertBetriebskosten.hausratversicherungChfPerMonth) ?? 0,
        schadenreserveChfPerMonth: num(moebliertBetriebskosten.schadenreserveChfPerMonth) ?? 0,
        verwaltungsgebuehrPercent: num(moebliertBetriebskosten.verwaltungsgebuehrPercent) ?? 0,
        plattformgebuehrPercent: num(moebliertBetriebskosten.plattformgebuehrPercent) ?? 0,
      },
      reserven: {
        reparaturChfPerYear: num(reserven.reparaturChfPerYear),
        reparaturPercentOfKaufpreis: num(reserven.reparaturPercentOfKaufpreis),
        leerstandChfPerYear: num(reserven.leerstandChfPerYear),
        leerstandPercentOfKaufpreis: num(reserven.leerstandPercentOfKaufpreis),
      },
      hypothek: {
        ersteHypothek: {
          belehnungPercent: ersteHypothek.belehnungPercent,
          amortisation: {
            modus: ersteAmortisation.modus as AmortisationModus,
            prozentProJahr: num(ersteAmortisation.prozentProJahr),
            dauerJahre: num(ersteAmortisation.dauerJahre),
          },
        },
        zweiteHypothek: {
          belehnungPercent: zweiteHypothek.belehnungPercent,
          amortisation: {
            modus: zweiteAmortisation.modus as AmortisationModus,
            prozentProJahr: num(zweiteAmortisation.prozentProJahr),
            dauerJahre: num(zweiteAmortisation.dauerJahre),
          },
        },
        interestRatePercent: hypothek.interestRatePercent,
      },
      kalkulatorischerSteuersatzPercent: num(body.kalkulatorischerSteuersatzPercent),
      eroeffnungsangebotChf: num(body.eroeffnungsangebotChf),
      openingBidFaktoren: openingBidFaktorenRaw
        ? {
            tageAmMarkt: num(openingBidFaktorenRaw.tageAmMarkt),
            preisreduktionenAnzahl: num(openingBidFaktorenRaw.preisreduktionenAnzahl),
            verkaeufermotivation: openingBidFaktorenRaw.verkaeufermotivation as VerkaeufermotivationStufe | undefined,
            konkurrenzsituation: openingBidFaktorenRaw.konkurrenzsituation as KonkurrenzStufe | undefined,
            capexRisikoStufe: openingBidFaktorenRaw.capexRisikoStufe as CapexRisikoStufe | undefined,
            dokumentationsluecken: openingBidFaktorenRaw.dokumentationsluecken as Dokumentationsluecken | undefined,
            vermietungsstatus: openingBidFaktorenRaw.vermietungsstatus as Vermietungsstatus | undefined,
          }
        : undefined,
      mehrjahresmodell: {
        holdingPeriodYears: num(mehrjahresmodell.holdingPeriodYears),
        mietsteigerungPercentPerYear: num(mehrjahresmodell.mietsteigerungPercentPerYear),
        kosteninflationPercentPerYear: num(mehrjahresmodell.kosteninflationPercentPerYear),
        wertsteigerungPercentPerYear: num(mehrjahresmodell.wertsteigerungPercentPerYear),
        sellingCostPercent: num(mehrjahresmodell.sellingCostPercent),
        grundstueckgewinnsteuerPercent: num(mehrjahresmodell.grundstueckgewinnsteuerPercent),
      },
      notes: typeof body.notes === "string" && body.notes ? body.notes : undefined,
    },
  };
}

/**
 * Feldpfade, die per Due-Diligence-Feldwert-Übernahmevorschlag gesetzt werden dürfen —
 * muss exakt der Liste in `app/api/properties/[id]/due-diligence/route.ts::buildKnownFields`
 * entsprechen. Eine geschlossene Allow-Liste statt eines generischen Dot-Path-Setters
 * auf beliebige Feldnamen — verhindert, dass ein von der KI erfundener Feldname
 * unbemerkt eine falsche Stelle im Facts-Objekt beschreibt.
 */
const ALLOWED_UPDATE_FIELDS = [
  "zimmerzahl",
  "baujahr",
  "parkplatzKaufpreisChf",
  "garagenplatzKaufpreisChf",
  "hobbyraumKaufpreisChf",
  "miete.wohnungsMieteChfPerMonth",
  "miete.parkplatzMieteChfPerMonth",
  "miete.garagenplatzMieteChfPerMonth",
  "miete.hobbyraumMieteChfPerMonth",
  "miete.sonstigeEinnahmenChfPerYear",
  "miete.leerstandPercent",
  "betriebskosten.stwegAkontobeitragChfPerYear",
  "betriebskosten.stwegAkontobeitragUeberwaelzbarChfPerYear",
  "stweg.erneuerungsfondsSaldoChf",
  "stweg.erneuerungsfondsWohnungsanteilChf",
  "stweg.erneuerungsfondsZielwertChf",
  "stweg.wertquotePromille",
] as const;

export type AllowedUpdateField = (typeof ALLOWED_UPDATE_FIELDS)[number];

export function isAllowedUpdateField(field: string): field is AllowedUpdateField {
  return (ALLOWED_UPDATE_FIELDS as readonly string[]).includes(field);
}

/**
 * Wendet einen einzelnen, vom Nutzer bestätigten Feldwert-Übernahmevorschlag auf ein
 * Bestandsrendite-Facts-Objekt an — nie automatisch, nur nach explizitem "übernehmen"
 * (apps/home4effinder/docs/DECISIONS.md: "Keine Werte stillschweigend überschreiben").
 * Erstellt fehlende Zwischenobjekte (z.B. `stweg`), überschreibt nur das eine Blattfeld.
 * Felder ohne Punkt (z.B. "zimmerzahl") liegen direkt auf der Wurzel von `facts`, statt
 * in einer Untergruppe.
 */
export function applyFieldUpdate(facts: Record<string, unknown>, field: AllowedUpdateField, newValue: string | number): Record<string, unknown> {
  if (!field.includes(".")) return { ...facts, [field]: newValue };
  const [group, key] = field.split(".") as [string, string];
  const existingGroup = (facts[group] as Record<string, unknown> | undefined) ?? {};
  return { ...facts, [group]: { ...existingGroup, [key]: newValue } };
}

/** Liest den aktuellen Wert eines `AllowedUpdateField` aus den Facts — die Umkehrung von `applyFieldUpdate`, für den Vergleich "wurde dieser Vorschlag bereits übernommen?" (siehe `alreadyAppliedProposalKeys` in der Objektseite). */
export function getAllowedFieldValue(facts: Record<string, unknown>, field: AllowedUpdateField): unknown {
  if (!field.includes(".")) return facts[field];
  const [group, key] = field.split(".") as [string, string];
  return (facts[group] as Record<string, unknown> | undefined)?.[key];
}

/** `true`, wenn der aktuell gespeicherte Wert des Felds bereits exakt dem vorgeschlagenen Wert entspricht (zahlentolerant, da beide Seiten je nach Herkunft number oder numerische Strings sein können). */
export function isProposalAlreadyApplied(facts: Record<string, unknown>, field: AllowedUpdateField, proposedValue: string | number): boolean {
  const current = getAllowedFieldValue(facts, field);
  if (current === undefined || current === null) return false;
  const currentNum = typeof current === "number" ? current : Number(current);
  const proposedNum = typeof proposedValue === "number" ? proposedValue : Number(proposedValue);
  if (Number.isFinite(currentNum) && Number.isFinite(proposedNum)) return currentNum === proposedNum;
  return String(current) === String(proposedValue);
}
