import type { StwegFacts } from "@landfinder/domain";
import { getCantonDefaults } from "./cantonDefaults";
import {
  BESTANDSRENDITE_PARAMETERS,
  calculateNebenkosten,
  calculateAllInInvestition,
  calculateSchnellcheck,
  calculateInvestmentCase,
  breakEvenMieteChfPerMonth,
  breakEvenZinsPercent,
  breakEvenAuslastungPercent,
  resolveReserveChf,
  resolveAmortisationChfPerYear,
  type Vermietungsmodell,
  type InvestmentCaseInput,
  type SchnellcheckResult,
  type InvestmentCaseResult,
  type AmortisationSpec,
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
  parkplatzKaufpreisChf: number;
  /** Manuell gesetzt: Inserats-/Kaufpreis (Objekt-Basisdaten) enthält den Parkplatz bereits — dann wird `parkplatzKaufpreisChf` NICHT zusätzlich addiert (verhindert Doppelzählung), bleibt aber informativ erfasst. */
  parkplatzImKaufpreisEnthalten: boolean;

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

const P = BESTANDSRENDITE_PARAMETERS;

export interface BestandsrenditeAnalysisResult {
  schnellcheck: SchnellcheckResult;
  allInInvestitionChf: number;
  eigenkapitalChf: number;
  investmentCase: InvestmentCaseResult;
  breakEven: { mieteChfPerMonth: number | undefined; zinsPercent: number | undefined; auslastungPercent: number | undefined };
  furnitureRoi: ValueAddRoiResult | undefined;
  /** Geglättete jährliche Ersatzreserve für die Möblierung — rein informativ, nicht Grundlage der 15-Jahres-Cashflows (die rechnen mit dem tatsächlichen Ersatz-Cashout im Ersatzjahr, siehe mehrjahresmodell). */
  moeblierungReserveChfPerJahr: number | undefined;
  renovationRoi: ValueAddRoiResult | undefined;
  renovationSummary: RenovationPositionenSummary;
  mehrjahresmodell: MehrjahresmodellResult;
  investmentTreiber: InvestmentTreiberResult;
  hypothek: { ersteHypothekChf: number; zweiteHypothekChf: number; ersteAmortisationChfPerYear: number; zweiteAmortisationChfPerYear: number };
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
export function computeBestandsrenditeAnalysis(property: BestandsrenditePropertyInput, facts: BestandsrenditeFacts): BestandsrenditeAnalysisResult {
  const assumptionNotes: string[] = [];
  const note = (label: string, used: boolean, value: number, unit: string) => {
    if (!used) assumptionNotes.push(`${label} nicht erfasst — Platzhalter-Default (${value}${unit}) verwendet, siehe BESTANDSRENDITE_PARAMETERS.`);
  };

  const cantonDefaults = getCantonDefaults(property.canton);
  const handaenderungssteuerPercent = facts.nebenkosten.handaenderungssteuerPercent ?? cantonDefaults?.handaenderungssteuerPercent ?? P.handaenderungssteuerPercent.defaultValue;
  note("Handänderungssteuer", facts.nebenkosten.handaenderungssteuerPercent !== undefined, handaenderungssteuerPercent, "%");
  const notariatGrundbuchPercent = facts.nebenkosten.notariatGrundbuchPercent ?? P.notariatGrundbuchPercent.defaultValue;
  const maklerprovisionPercent = facts.nebenkosten.maklerprovisionPercent ?? P.maklerprovisionPercent.defaultValue;

  // Ist der Parkplatz laut Nutzer bereits im erfassten Kaufpreis (Objekt-Basisdaten)
  // enthalten, wird `parkplatzKaufpreisChf` NICHT nochmals addiert — sonst würde der
  // Parkplatzwert doppelt in die Investitionssumme/den Schnellcheck einfliessen.
  const parkplatzKaufpreisZusatzChf = facts.parkplatzImKaufpreisEnthalten ? 0 : facts.parkplatzKaufpreisChf;
  const kaufpreisChf = property.kaufpreisChf + parkplatzKaufpreisZusatzChf;
  const nebenkosten = calculateNebenkosten({ kaufpreisChf, handaenderungssteuerPercent, notariatGrundbuchPercent, maklerprovisionPercent });

  const renovationSummary = summarizeRenovationPositionen(facts.renovation.positionen);

  const jaehrlicherErsatzsatzPercent = facts.moeblierung.jaehrlicherErsatzsatzPercent ?? P.moeblierungErsatzquotePercent.defaultValue;
  const moeblierungNutzungsdauerJahre = facts.moeblierung.nutzungsdauerJahre ?? P.moeblierungNutzungsdauerJahre.defaultValue;
  const moeblierungKostensteigerung = facts.moeblierung.kostensteigerungPercentPerYear ?? P.kosteninflationPercentPerYear.defaultValue;

  const allInInvestitionChf = calculateAllInInvestition({
    kaufpreisChf,
    nebenkosten,
    renovationInitialChf: facts.renovation.initialRenovationCostChf,
    moeblierungInitialChf: facts.moeblierung.initialCostChf,
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
    parkplatzkaufpreisChf: parkplatzKaufpreisZusatzChf,
    wohnflaecheM2: property.wohnflaecheM2,
    wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
    parkplatzMieteChfPerMonth: facts.miete.parkplatzMieteChfPerMonth,
    kaufnebenkostenPercent,
    laufendeKostenChfPerYear:
      facts.betriebskosten.stwegAkontobeitragChfPerYear + facts.betriebskosten.eigentuemerkostenChfPerYear + facts.betriebskosten.vermietungskostenChfPerYear,
    loanToValuePercent: belehnungPercent,
    interestRatePercent: facts.hypothek.interestRatePercent,
  });

  const reparaturreserveChf = resolveReserveChf({
    chfPerYear: facts.reserven.reparaturChfPerYear,
    percentOfKaufpreis: facts.reserven.reparaturPercentOfKaufpreis ?? P.reparaturreservePercentOfKaufpreis.defaultValue,
    kaufpreisChf,
  });
  const leerstandsreserveChf = resolveReserveChf({
    chfPerYear: facts.reserven.leerstandChfPerYear,
    percentOfKaufpreis: facts.reserven.leerstandPercentOfKaufpreis ?? P.leerstandsreservePercentOfKaufpreis.defaultValue,
    kaufpreisChf,
  });

  const leerstandDefaultPercent = facts.miete.vermietungsmodell === "MITTELFRISTIG_MOEBLIERT" ? P.leerstandMoebliertPercent.defaultValue : P.leerstandLangfristigPercent.defaultValue;
  const kalkulatorischerSteuersatzPercent = facts.kalkulatorischerSteuersatzPercent ?? cantonDefaults?.kalkulatorischerSteuersatzPercent ?? P.kalkulatorischerSteuersatzPercent.defaultValue;

  const investmentCaseInput: InvestmentCaseInput = {
    kaufpreisChf,
    allInInvestitionChf,
    ertrag: {
      wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth,
      parkplatzMieteChfPerMonth: facts.miete.parkplatzMieteChfPerMonth,
      moeblierungsPremiumChfPerMonth: facts.moeblierung.mietPremiumChfPerMonth,
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

  const furnitureRoi = facts.moeblierung.initialCostChf > 0 ? calculateFurnitureRoi({ moeblierungInitialChf: facts.moeblierung.initialCostChf, mietPremiumChfPerMonth: facts.moeblierung.mietPremiumChfPerMonth }) : undefined;
  const renovationRoi =
    facts.renovation.initialRenovationCostChf > 0 &&
    facts.renovation.mieteVorRenovationChfPerMonth !== undefined &&
    facts.renovation.mieteNachRenovationChfPerMonth !== undefined
      ? calculateRenovationRoi({
          renovationCostChf: facts.renovation.initialRenovationCostChf,
          mieteVorherChfPerMonth: facts.renovation.mieteVorRenovationChfPerMonth,
          mieteNachherChfPerMonth: facts.renovation.mieteNachRenovationChfPerMonth,
        })
      : undefined;

  const moeblierungLebenszyklus =
    facts.moeblierung.initialCostChf > 0
      ? { initialCostChf: facts.moeblierung.initialCostChf, nutzungsdauerJahre: moeblierungNutzungsdauerJahre, ersatzquotePercent: jaehrlicherErsatzsatzPercent, kostensteigerungPercentPerYear: moeblierungKostensteigerung }
      : undefined;
  const moeblierungReserveChfPerJahr = moeblierungLebenszyklus ? moeblierungGeglaetteReserveChfPerJahr(moeblierungLebenszyklus) : undefined;

  const mehrjahresmodellInput = {
    holdingPeriodYears: facts.mehrjahresmodell.holdingPeriodYears ?? P.holdingPeriodYearsDefault.defaultValue,
    kaufpreisChf,
    allInInvestitionChf,
    eigenkapitalChf,
    ertragJahr1: investmentCaseInput.ertrag,
    betriebskostenJahr1: facts.betriebskosten,
    reparaturreserveJahr1Chf: reparaturreserveChf,
    leerstandsreserveJahr1Chf: leerstandsreserveChf,
    mietsteigerungPercentPerYear: facts.mehrjahresmodell.mietsteigerungPercentPerYear ?? P.mietsteigerungPercentPerYear.defaultValue,
    kosteninflationPercentPerYear: facts.mehrjahresmodell.kosteninflationPercentPerYear ?? P.kosteninflationPercentPerYear.defaultValue,
    wertsteigerungPercentPerYear: facts.mehrjahresmodell.wertsteigerungPercentPerYear ?? P.wertsteigerungPercentPerYear.defaultValue,
    wertvermehrendeRenovationChf: renovationSummary.totalByKategorie.WERTVERMEHREND,
    moeblierung: moeblierungLebenszyklus,
    hypothek: {
      ersteHypothek: { initialLoanChf: ersteHypothekChf, amortisation: facts.hypothek.ersteHypothek.amortisation },
      zweiteHypothek: { initialLoanChf: zweiteHypothekChf, amortisation: facts.hypothek.zweiteHypothek.amortisation },
      interestRatePercent: facts.hypothek.interestRatePercent,
    },
    kalkulatorischerSteuersatzPercent,
    exit: {
      sellingCostPercent: facts.mehrjahresmodell.sellingCostPercent ?? P.sellingCostPercent.defaultValue,
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
  if (facts.reserven.reparaturChfPerYear === undefined && facts.reserven.reparaturPercentOfKaufpreis === undefined) assumptionNotes.push(`Eigene Reparaturreserve nicht erfasst — Platzhalter-Default (${P.reparaturreservePercentOfKaufpreis.defaultValue}% des Kaufpreises) verwendet.`);
  if (facts.reserven.leerstandChfPerYear === undefined && facts.reserven.leerstandPercentOfKaufpreis === undefined) assumptionNotes.push(`Eigene Leerstandsreserve nicht erfasst — Platzhalter-Default (${P.leerstandsreservePercentOfKaufpreis.defaultValue}% des Kaufpreises) verwendet.`);
  if (facts.notes) assumptionNotes.push(facts.notes);

  return {
    schnellcheck,
    allInInvestitionChf,
    eigenkapitalChf,
    investmentCase,
    breakEven: {
      mieteChfPerMonth: breakEvenMieteChfPerMonth(investmentCaseInput),
      zinsPercent: breakEvenZinsPercent(investmentCaseInput),
      auslastungPercent: breakEvenAuslastungPercent(investmentCaseInput),
    },
    furnitureRoi,
    moeblierungReserveChfPerJahr,
    renovationRoi,
    renovationSummary,
    mehrjahresmodell,
    investmentTreiber,
    hypothek: { ersteHypothekChf, zweiteHypothekChf, ersteAmortisationChfPerYear, zweiteAmortisationChfPerYear },
    stweg: facts.stweg,
    assumptionNotes,
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
  if (!hypothek || typeof hypothek.interestRatePercent !== "number") return { error: "hypothek.interestRatePercent fehlt" };
  if (!ersteHypothek || typeof ersteHypothek.belehnungPercent !== "number" || typeof ersteHypothek.amortisationModus !== "string") {
    return { error: "hypothek.ersteHypothek.belehnungPercent/amortisationModus fehlt" };
  }
  if (!zweiteHypothek || typeof zweiteHypothek.belehnungPercent !== "number" || typeof zweiteHypothek.amortisationModus !== "string") {
    return { error: "hypothek.zweiteHypothek.belehnungPercent/amortisationModus fehlt" };
  }
  if (ersteHypothek.amortisationModus !== "PROZENT_PRO_JAHR" && ersteHypothek.amortisationModus !== "DAUER_JAHRE") {
    return { error: "hypothek.ersteHypothek.amortisationModus muss PROZENT_PRO_JAHR oder DAUER_JAHRE sein" };
  }
  if (zweiteHypothek.amortisationModus !== "PROZENT_PRO_JAHR" && zweiteHypothek.amortisationModus !== "DAUER_JAHRE") {
    return { error: "hypothek.zweiteHypothek.amortisationModus muss PROZENT_PRO_JAHR oder DAUER_JAHRE sein" };
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
            modus: ersteHypothek.amortisationModus,
            prozentProJahr: num(ersteHypothek.amortisationProzentProJahr),
            dauerJahre: num(ersteHypothek.amortisationDauerJahre),
          },
        },
        zweiteHypothek: {
          belehnungPercent: zweiteHypothek.belehnungPercent,
          amortisation: {
            modus: zweiteHypothek.amortisationModus,
            prozentProJahr: num(zweiteHypothek.amortisationProzentProJahr),
            dauerJahre: num(zweiteHypothek.amortisationDauerJahre),
          },
        },
        interestRatePercent: hypothek.interestRatePercent,
      },
      kalkulatorischerSteuersatzPercent: num(body.kalkulatorischerSteuersatzPercent),
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
  "miete.wohnungsMieteChfPerMonth",
  "miete.parkplatzMieteChfPerMonth",
  "miete.sonstigeEinnahmenChfPerYear",
  "miete.leerstandPercent",
  "betriebskosten.stwegAkontobeitragChfPerYear",
  "stweg.erneuerungsfondsSaldoChf",
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
