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
  calculateFurnitureRoi,
  calculateRenovationRoi,
  moeblierungGeglaetteReserveChfPerJahr,
  summarizeRenovationPositionen,
  type RenovationPosition,
  type ValueAddRoiResult,
  type RenovationPositionenSummary,
} from "@landfinder/financial-engine";
import {
  runMehrjahresmodell,
  computeInvestmentTreiber,
  type MehrjahresmodellResult,
  type InvestmentTreiberResult,
} from "@landfinder/financial-engine";

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

  moeblierung: {
    initialCostChf: number;
    mietPremiumChfPerMonth: number;
    jaehrlicherErsatzsatzPercent?: number;
    nutzungsdauerJahre?: number;
    kostensteigerungPercentPerYear?: number;
  };

  miete: {
    wohnungsMieteChfPerMonth: number;
    parkplatzMieteChfPerMonth: number;
    sonstigeEinnahmenChfPerYear: number;
    vermietungsmodell: Vermietungsmodell;
    leerstandPercent?: number;
    auslastungPercent?: number;
  };

  betriebskosten: {
    stwegAkontobeitragChfPerYear: number;
    eigentuemerkostenChfPerYear: number;
    vermietungskostenChfPerYear: number;
    reinigungServiceChfPerYear: number;
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
  stwegAkontobeitragChfPerYear: number;
  eigentuemerkostenChfPerYear: number;
  vermietungskostenChfPerYear: number;
  reinigungServiceChfPerYear: number;
  betriebskostenTotalChf: number;
  noiChf: number;
}

/** Eines der beiden Vermietungsszenarien im Möblierungs-Vergleich — siehe `MoeblierungsVergleich`. */
export interface MoeblierungsSzenario {
  mieteChfPerMonth: number;
  kostenInitialChf: number;
  /** Geglättete jährliche Ersatzreserve — `undefined` beim unmöblierten Szenario (keine Möbel, keine Ersatzreserve). */
  reserveChfPerJahr: number | undefined;
  effektiverJahresertragChf: number;
  bruttoRenditePercent: number;
}

/**
 * Stellt "unmöbliert vermieten" und "möbliert vermieten" als zwei vollständige,
 * nebeneinander vergleichbare Pakete dar (Kosten + erwartete Miete + resultierender
 * Ertrag je Szenario) — unabhängig davon, welches `vermietungsmodell` tatsächlich für
 * die übrigen Berechnungen (Schnellcheck/Investment Case/15-Jahres-Modell) aktiv ist.
 * Beide Szenarien nutzen denselben Leerstand/Auslastung-Faktor des aktiven Modells —
 * der einzige Unterschied ist der Möblierungs-Mietaufschlag und die Möblierungskosten.
 */
export interface MoeblierungsVergleich {
  unmoebliert: MoeblierungsSzenario;
  moebliert: MoeblierungsSzenario;
}

export interface BestandsrenditeAnalysisResult {
  schnellcheck: SchnellcheckResult;
  allInInvestitionChf: number;
  eigenkapitalChf: number;
  investmentCase: InvestmentCaseResult;
  noiBreakdown: NoiBreakdown;
  breakEven: { mieteChfPerMonth: number | undefined; zinsPercent: number | undefined; auslastungPercent: number | undefined };
  furnitureRoi: ValueAddRoiResult | undefined;
  /** Geglättete jährliche Ersatzreserve für die Möblierung — rein informativ, nicht Grundlage der 15-Jahres-Cashflows (die rechnen mit dem tatsächlichen Ersatz-Cashout im Ersatzjahr, siehe mehrjahresmodell). */
  moeblierungReserveChfPerJahr: number | undefined;
  moeblierungsVergleich: MoeblierungsVergleich;
  renovationRoi: ValueAddRoiResult | undefined;
  renovationSummary: RenovationPositionenSummary;
  mehrjahresmodell: MehrjahresmodellResult;
  investmentTreiber: InvestmentTreiberResult;
  hypothek: { ersteHypothekChf: number; zweiteHypothekChf: number; ersteAmortisationChfPerYear: number; zweiteAmortisationChfPerYear: number };
  /** Wie viel vom Gesamt-Kaufpreis (`schnellcheck.kaufpreisChf`) zusätzlich zum Basis-Kaufpreis (Objekt-Basisdaten) aus Parkplatz/Garage stammt — 0, wenn keiner erfasst ist oder beide bereits im Basis-Kaufpreis enthalten sind. */
  parkierung: { parkplatzZusatzChf: number; garagenplatzZusatzChf: number; totalZusatzChf: number };
  /** Unveränderte STWEG-Fakten aus den Facts — reine Datenhaltung ohne Scoring/Formel, siehe StwegFacts. */
  stweg: StwegFacts;
  assumptionNotes: string[];
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
  const parkierungKaufpreisZusatzChf = parkplatzKaufpreisZusatzChf + garagenplatzKaufpreisZusatzChf;
  const kaufpreisChf = property.kaufpreisChf + parkierungKaufpreisZusatzChf;
  const nebenkosten = calculateNebenkosten({ kaufpreisChf, handaenderungssteuerPercent, notariatGrundbuchPercent, maklerprovisionPercent });

  const renovationSummary = summarizeRenovationPositionen(facts.renovation.positionen);

  const jaehrlicherErsatzsatzPercent = facts.moeblierung.jaehrlicherErsatzsatzPercent ?? P.moeblierungErsatzquotePercent;
  const moeblierungNutzungsdauerJahre = facts.moeblierung.nutzungsdauerJahre ?? P.moeblierungNutzungsdauerJahre;
  const moeblierungKostensteigerung = facts.moeblierung.kostensteigerungPercentPerYear ?? P.kosteninflationPercentPerYear;

  // "Vermietungsmodell" ist das eigentliche Auswahlfeld für das bevorzugte Szenario
  // (unmöbliert/möbliert, siehe DECISIONS.md) — Möblierungskosten/-mietaufschlag dürfen
  // NUR einfliessen, wenn möbliert tatsächlich das gewählte Modell ist. Vorher
  // inkonsistent: Ebene A (Schnellcheck) ignorierte sie immer, Ebene B/C (All-in-
  // Investition, Investment Case, Mehrjahresmodell, Verhandlungskorridor)
  // berücksichtigten sie immer, sobald erfasst — unabhängig vom gewählten Modell. Der
  // volle Vergleich beider Szenarien bleibt in `moeblierungsVergleich`/`furnitureRoi`
  // (Value-Add-Möblierung-Panel) unverändert erhalten — die verwenden bewusst weiterhin
  // die ungegateten Rohwerte, weil sie unabhängig vom aktuell gewählten Szenario
  // beantworten sollen, ob sich Möblieren überhaupt lohnen würde.
  const moeblierungIstGewaehltesSzenario = facts.miete.vermietungsmodell === "MITTELFRISTIG_MOEBLIERT";
  const moeblierungsPremiumChfPerMonth = moeblierungIstGewaehltesSzenario ? facts.moeblierung.mietPremiumChfPerMonth : 0;
  const moeblierungInitialChfEffective = moeblierungIstGewaehltesSzenario ? facts.moeblierung.initialCostChf : 0;

  const allInInvestitionChf = calculateAllInInvestition({
    kaufpreisChf,
    nebenkosten,
    renovationInitialChf: facts.renovation.initialRenovationCostChf,
    moeblierungInitialChf: moeblierungInitialChfEffective,
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
  const schnellcheck = calculateSchnellcheck({
    wohnungskaufpreisChf: property.kaufpreisChf,
    parkplatzkaufpreisChf: parkierungKaufpreisZusatzChf,
    wohnflaecheM2: property.wohnflaecheM2,
    wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
    parkplatzMieteChfPerMonth: facts.miete.parkplatzMieteChfPerMonth,
    moeblierungsPremiumChfPerMonth,
    kaufnebenkostenPercent,
    laufendeKostenChfPerYear:
      facts.betriebskosten.stwegAkontobeitragChfPerYear + facts.betriebskosten.eigentuemerkostenChfPerYear + facts.betriebskosten.vermietungskostenChfPerYear,
    loanToValuePercent: belehnungPercent,
    interestRatePercent: facts.hypothek.interestRatePercent,
  });

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

  const leerstandDefaultPercent = facts.miete.vermietungsmodell === "MITTELFRISTIG_MOEBLIERT" ? P.leerstandMoebliertPercent : P.leerstandLangfristigPercent;
  const kalkulatorischerSteuersatzPercent = facts.kalkulatorischerSteuersatzPercent ?? cantonDefaults?.kalkulatorischerSteuersatzPercent ?? P.kalkulatorischerSteuersatzPercent;

  const investmentCaseInput: InvestmentCaseInput = {
    kaufpreisChf,
    allInInvestitionChf,
    ertrag: {
      wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
      parkplatzMieteChfPerMonth: facts.miete.parkplatzMieteChfPerMonth,
      moeblierungsPremiumChfPerMonth,
      sonstigeEinnahmenChfPerYear: facts.miete.sonstigeEinnahmenChfPerYear,
      vermietungsmodell: facts.miete.vermietungsmodell,
      leerstandPercent: facts.miete.leerstandPercent ?? leerstandDefaultPercent,
      auslastungPercent: facts.miete.auslastungPercent,
    },
    betriebskosten: facts.betriebskosten,
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
    eigentuemerkostenChfPerYear: investmentCaseInput.betriebskosten.eigentuemerkostenChfPerYear,
    vermietungskostenChfPerYear: investmentCaseInput.betriebskosten.vermietungskostenChfPerYear,
    reinigungServiceChfPerYear: investmentCaseInput.betriebskosten.reinigungServiceChfPerYear,
    betriebskostenTotalChf,
    noiChf: investmentCase.wasserfall.noiChf,
  };

  const furnitureRoi = facts.moeblierung.initialCostChf > 0 ? calculateFurnitureRoi({ moeblierungInitialChf: facts.moeblierung.initialCostChf, mietPremiumChfPerMonth: facts.moeblierung.mietPremiumChfPerMonth }) : undefined;

  // "ich möchte zwei Szenarien sehen: unmöbliert vs. möbliert" — beide vollständig
  // nebeneinander gerechnet, statt nur den Mehrertrag/ROI der Möblierung isoliert zu
  // zeigen (siehe DECISIONS.md). Nutzt denselben Leerstand/Auslastung-Faktor wie das
  // aktive Vermietungsmodell, nur der Möblierungs-Mietaufschlag unterscheidet sich.
  const ertragUnmoebliert = calculateJahresertrag({ ...investmentCaseInput.ertrag, moeblierungsPremiumChfPerMonth: 0 });
  const ertragMoebliert = calculateJahresertrag({ ...investmentCaseInput.ertrag, moeblierungsPremiumChfPerMonth: facts.moeblierung.mietPremiumChfPerMonth });
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
      ? { initialCostChf: facts.moeblierung.initialCostChf, nutzungsdauerJahre: moeblierungNutzungsdauerJahre, ersatzquotePercent: jaehrlicherErsatzsatzPercent, kostensteigerungPercentPerYear: moeblierungKostensteigerung }
      : undefined;
  const moeblierungReserveChfPerJahr = moeblierungLebenszyklus ? moeblierungGeglaetteReserveChfPerJahr(moeblierungLebenszyklus) : undefined;
  // `moeblierungLebenszyklus` bleibt oben ungegatet (Value-Add-Reserve ist informativ,
  // unabhängig vom gewählten Szenario) — für das tatsächliche 15-Jahres-Modell (reale
  // Ersatz-Cashouts) gilt dieselbe Gating-Regel wie überall sonst in dieser Funktion.
  const moeblierungLebenszyklusEffective = moeblierungIstGewaehltesSzenario ? moeblierungLebenszyklus : undefined;

  const moeblierungsVergleich: MoeblierungsVergleich = {
    unmoebliert: {
      mieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
      kostenInitialChf: 0,
      reserveChfPerJahr: undefined,
      effektiverJahresertragChf: ertragUnmoebliert.effektiverJahresertragChf,
      bruttoRenditePercent: kaufpreisChf > 0 ? (ertragUnmoebliert.effektiverJahresertragChf / kaufpreisChf) * 100 : 0,
    },
    moebliert: {
      mieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth + facts.moeblierung.mietPremiumChfPerMonth,
      kostenInitialChf: facts.moeblierung.initialCostChf,
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
    betriebskostenJahr1: facts.betriebskosten,
    reparaturreserveJahr1Chf: reparaturreserveChf,
    leerstandsreserveJahr1Chf: leerstandsreserveChf,
    mietsteigerungPercentPerYear: facts.mehrjahresmodell.mietsteigerungPercentPerYear ?? P.mietsteigerungPercentPerYear,
    kosteninflationPercentPerYear: facts.mehrjahresmodell.kosteninflationPercentPerYear ?? P.kosteninflationPercentPerYear,
    wertsteigerungPercentPerYear: facts.mehrjahresmodell.wertsteigerungPercentPerYear ?? P.wertsteigerungPercentPerYear,
    wertvermehrendeRenovationChf: renovationSummary.totalByKategorie.WERTVERMEHREND,
    moeblierung: moeblierungLebenszyklusEffective,
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

  if (facts.moeblierung.initialCostChf > 0 && facts.moeblierung.jaehrlicherErsatzsatzPercent === undefined) assumptionNotes.push(`Möblierungs-Ersatzquote nicht erfasst — Platzhalter-Default (${jaehrlicherErsatzsatzPercent}%) verwendet.`);
  if (facts.moeblierung.initialCostChf > 0 && facts.moeblierung.kostensteigerungPercentPerYear === undefined) {
    assumptionNotes.push(`Kosteninflation Möblierung nicht erfasst — allgemeine Kosteninflation (${moeblierungKostensteigerung}%/Jahr) verwendet.`);
  }
  if (facts.miete.leerstandPercent === undefined && facts.miete.vermietungsmodell !== "SHORT_STAY") assumptionNotes.push(`Leerstandsquote nicht erfasst — Platzhalter-Default (${leerstandDefaultPercent}%) verwendet.`);
  if (facts.kalkulatorischerSteuersatzPercent === undefined) assumptionNotes.push(`Kalkulatorischer Steuersatz nicht erfasst — Platzhalter-Default (${kalkulatorischerSteuersatzPercent}%) verwendet, kein Steuerberatungsersatz.`);
  if (facts.reserven.reparaturChfPerYear === undefined && facts.reserven.reparaturPercentOfKaufpreis === undefined) assumptionNotes.push(`Eigene Reparaturreserve nicht erfasst — Platzhalter-Default (${P.reparaturreservePercentOfKaufpreis}% des Kaufpreises) verwendet.`);
  if (facts.reserven.leerstandChfPerYear === undefined && facts.reserven.leerstandPercentOfKaufpreis === undefined) assumptionNotes.push(`Eigene Leerstandsreserve nicht erfasst — Platzhalter-Default (${P.leerstandsreservePercentOfKaufpreis}% des Kaufpreises) verwendet.`);
  if (facts.notes) assumptionNotes.push(facts.notes);

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
    furnitureRoi,
    moeblierungReserveChfPerJahr,
    moeblierungsVergleich,
    renovationRoi,
    renovationSummary,
    mehrjahresmodell,
    investmentTreiber,
    hypothek: { ersteHypothekChf, zweiteHypothekChf, ersteAmortisationChfPerYear, zweiteAmortisationChfPerYear },
    parkierung: { parkplatzZusatzChf: parkplatzKaufpreisZusatzChf, garagenplatzZusatzChf: garagenplatzKaufpreisZusatzChf, totalZusatzChf: parkierungKaufpreisZusatzChf },
    stweg: facts.stweg,
    assumptionNotes,
  };
}

export interface Verhandlungskorridor {
  /** Rechnerisches Maximum — Kaufpreis, bei dem der nachhaltige Cashflow gerade CHF 0 erreicht (alles darüber ist rechnerisch nicht mehr cashflow-tragfähig unter den aktuellen Annahmen). `undefined`, wenn selbst ein Kaufpreis nahe CHF 0 keinen positiven Cashflow ergibt (Objekt trägt sich unter keinen Umständen). */
  maximumChf: number | undefined;
  /** Kaufpreis, bei dem die Bruttorendite (Kaufpreis) genau das gespeicherte Renditeziel (Annahmen-Reiter, `bruttoRenditeZielPercent`) erreicht — algebraisch hergeleitet aus der ohnehin konstanten Jahresnettomiete, nicht als Sicherheitsmarge vom Maximum. Nach oben durch `maximumChf` gedeckelt (ein Ziel über dem cashflow-neutralen Maximum wäre widersinnig). `undefined`, wenn kein Renditeziel gesetzt ist oder `maximumChf` selbst `undefined` ist. */
  zielChf: number | undefined;
  /** Eigene, per Marktrecherche bestimmte Einschätzung (`facts.eroeffnungsangebotChf`) — bewusst NICHT rechnerisch hergeleitet (Rückmeldung: "eröffnungspreis vom markt her (research) bestimmt", vorher waren das frei erfundene Prozentzahlen ohne Marktbezug). `undefined`, solange nicht erfasst. */
  eroeffnungChf: number | undefined;
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
  if (maximumChf === undefined) return { maximumChf: undefined, zielChf: undefined, eroeffnungChf };

  // Bruttorendite (Kaufpreis) = Jahresnettomiete ÷ (Basis-Kaufpreis + Parkplatz/Garage) —
  // die Jahresnettomiete selbst hängt nicht vom (verhandelbaren) Basis-Kaufpreis ab, daher
  // lässt sich der Zielpreis direkt algebraisch auflösen statt erneut per Bisektion zu
  // suchen (schneller und exakt, kein Wurzelfindungs-Toleranzfehler).
  const referenz = computeBestandsrenditeAnalysis(property, facts, parameterOverrides);
  const zielRenditePercent = P.bruttoRenditeZielPercent;
  const zielRenditeKaufpreisChf =
    zielRenditePercent > 0 ? referenz.schnellcheck.jahresnettomieteChf / (zielRenditePercent / 100) - referenz.parkierung.totalZusatzChf : undefined;
  const zielChf = zielRenditeKaufpreisChf !== undefined ? Math.min(Math.max(0, zielRenditeKaufpreisChf), maximumChf) : undefined;

  return { maximumChf, zielChf, eroeffnungChf };
}

export interface MoeblierungsAlternative {
  label: "unmöbliert" | "möbliert";
  analysis: BestandsrenditeAnalysisResult;
  verhandlungskorridor: Verhandlungskorridor;
}

/**
 * Rechnet das jeweils ANDERE Szenario (möbliert/unmöbliert) komplett durch — für eine
 * kompakte "Schattenrechnung" neben den Hauptkennzahlen auf allen Ebenen (Rückmeldung:
 * "bitte prüfen, wo dieser Vergleich überall durchschlägt resp. als Vergleich
 * dargestellt werden soll", siehe DECISIONS.md). Ergänzt `moeblierungsVergleich` (der nur
 * Miete/Kosten/Jahresertrag/Bruttorendite vergleicht) um die übrigen, vom gewählten
 * Szenario abhängigen Kennzahlen (IRR, Equity Multiple, Verhandlungskorridor, …), die sich
 * nicht einfach algebraisch aus den beiden Ertragswerten ableiten lassen.
 *
 * `null`, wenn kein sinnvolles Alternativszenario existiert: SHORT_STAY kennt keine
 * unmöbliert/möbliert-Unterscheidung, und ohne erfasste Möblierungsdaten (weder Kosten
 * noch Mietaufschlag) wäre das Alternativszenario ohnehin identisch mit dem Hauptszenario.
 */
export function computeMoeblierungsAlternative(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  parameterOverrides?: ParameterOverrides,
): MoeblierungsAlternative | null {
  const aktuell = facts.miete.vermietungsmodell;
  if (aktuell !== "LANGFRISTIG_UNMOEBLIERT" && aktuell !== "MITTELFRISTIG_MOEBLIERT") return null;
  if (facts.moeblierung.initialCostChf <= 0 && facts.moeblierung.mietPremiumChfPerMonth <= 0) return null;

  const alternativesModell: Vermietungsmodell = aktuell === "LANGFRISTIG_UNMOEBLIERT" ? "MITTELFRISTIG_MOEBLIERT" : "LANGFRISTIG_UNMOEBLIERT";
  const alternativeFacts: BestandsrenditeFacts = { ...facts, miete: { ...facts.miete, vermietungsmodell: alternativesModell } };
  return {
    label: alternativesModell === "MITTELFRISTIG_MOEBLIERT" ? "möbliert" : "unmöbliert",
    analysis: computeBestandsrenditeAnalysis(property, alternativeFacts, parameterOverrides),
    verhandlungskorridor: computeVerhandlungskorridor(property, alternativeFacts, parameterOverrides),
  };
}

const VERMIETUNGSMODELL_VALUES: Vermietungsmodell[] = ["LANGFRISTIG_UNMOEBLIERT", "MITTELFRISTIG_MOEBLIERT", "SHORT_STAY"];

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
    return { error: "miete.vermietungsmodell muss LANGFRISTIG_UNMOEBLIERT/MITTELFRISTIG_MOEBLIERT/SHORT_STAY sein" };
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
  const moeblierung = (body.moeblierung as Record<string, unknown>) ?? {};
  const reserven = (body.reserven as Record<string, unknown>) ?? {};
  const mehrjahresmodell = (body.mehrjahresmodell as Record<string, unknown>) ?? {};
  const stweg = (body.stweg as StwegFacts) ?? {};

  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

  return {
    facts: {
      zimmerzahl: num(body.zimmerzahl),
      baujahr: num(body.baujahr),
      parkplatzKaufpreisChf: num(body.parkplatzKaufpreisChf) ?? 0,
      parkplatzImKaufpreisEnthalten: body.parkplatzImKaufpreisEnthalten === true,
      garagenplatzKaufpreisChf: num(body.garagenplatzKaufpreisChf) ?? 0,
      garagenplatzImKaufpreisEnthalten: body.garagenplatzImKaufpreisEnthalten === true,
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
      moeblierung: {
        initialCostChf: num(moeblierung.initialCostChf) ?? 0,
        mietPremiumChfPerMonth: num(moeblierung.mietPremiumChfPerMonth) ?? 0,
        jaehrlicherErsatzsatzPercent: num(moeblierung.jaehrlicherErsatzsatzPercent),
        nutzungsdauerJahre: num(moeblierung.nutzungsdauerJahre),
        kostensteigerungPercentPerYear: num(moeblierung.kostensteigerungPercentPerYear),
      },
      miete: {
        wohnungsMieteChfPerMonth: miete.wohnungsMieteChfPerMonth,
        parkplatzMieteChfPerMonth: num(miete.parkplatzMieteChfPerMonth) ?? 0,
        sonstigeEinnahmenChfPerYear: num(miete.sonstigeEinnahmenChfPerYear) ?? 0,
        vermietungsmodell: miete.vermietungsmodell as Vermietungsmodell,
        leerstandPercent: num(miete.leerstandPercent),
        auslastungPercent: num(miete.auslastungPercent),
      },
      betriebskosten: {
        stwegAkontobeitragChfPerYear: num(betriebskosten.stwegAkontobeitragChfPerYear) ?? 0,
        eigentuemerkostenChfPerYear: num(betriebskosten.eigentuemerkostenChfPerYear) ?? 0,
        vermietungskostenChfPerYear: num(betriebskosten.vermietungskostenChfPerYear) ?? 0,
        reinigungServiceChfPerYear: num(betriebskosten.reinigungServiceChfPerYear) ?? 0,
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
  "miete.wohnungsMieteChfPerMonth",
  "miete.parkplatzMieteChfPerMonth",
  "miete.sonstigeEinnahmenChfPerYear",
  "miete.leerstandPercent",
  "betriebskosten.stwegAkontobeitragChfPerYear",
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
