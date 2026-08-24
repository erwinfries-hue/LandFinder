import { bisectRoot } from "./numeric";

/**
 * Rechenmodell für "Bestandsrendite auf Eigentumswohnungen" (docs/OPEN_DECISIONS.md,
 * Punkt N) — Kauf einer bestehenden Eigentumswohnung ausschliesslich zur Vermietung.
 * Struktur laut ausführlicher Rückmeldung des Auftraggebers (2026-08-16): drei Ebenen,
 * bewusst NICHT auf institutionellem Niveau (kein DCF/WACC/NPV/Monte-Carlo):
 *
 * - **Ebene A** (`calculateSchnellcheck`) — Aussortieren in Sekunden.
 * - **Ebene B** (dieses Modul: `calculateAllInInvestition`, `calculateJahresertrag`,
 *   `calculateCashflowWasserfall`, `calculateInvestmentCase`, Break-even-Werte) — die
 *   eigentliche Standardanalyse: All-in-Investition statt nur Kaufpreis, voller
 *   5-stufiger Cashflow-Wasserfall bis zum "nachhaltigen Cashflow".
 * - **Ebene C** (`bestandsrenditeMehrjahresmodell.ts`) — 15-Jahres-Modell mit IRR,
 *   nutzt `calculateJahresertrag`/`calculateBetriebskosten`/`calculateCashflowWasserfall`
 *   aus diesem Modul pro Jahr wieder (kein Duplikat der Formeln).
 *
 * Wert-Add-Analysen (Möblierungs-/Renovations-ROI, Möblierungs-Lebenszyklus) leben in
 * `bestandsrenditeValueAdd.ts` — eigenes Modul, wie vom Auftraggeber gewünscht
 * ("von Anfang an als eigene Module bauen").
 *
 * Wichtig: **kein Score/keine Empfehlung** hier (anders als scoring-engine für
 * Development). Welche Rendite/DSCR als "gut genug" gilt, ist eine persönliche
 * Investitionskriterien-Frage, noch nicht abgestimmt — diese Datei liefert nur
 * Zahlen, keine Bewertung, ausser der rein mechanischen Investment-Treiber-Attribution
 * in `bestandsrenditeMehrjahresmodell.ts`.
 */

export interface NebenkostenInput {
  kaufpreisChf: number;
  handaenderungssteuerPercent: number;
  notariatGrundbuchPercent: number;
  maklerprovisionPercent: number;
}

export interface NebenkostenResult {
  handaenderungssteuerChf: number;
  notariatGrundbuchChf: number;
  maklerprovisionChf: number;
  totalNebenkostenChf: number;
}

/** Kaufnebenkosten als Prozentsätze des Kaufpreises — kantonal/kommunal stark unterschiedlich, siehe Parameter-Platzhalter in parameters.ts. */
export function calculateNebenkosten(input: NebenkostenInput): NebenkostenResult {
  const handaenderungssteuerChf = input.kaufpreisChf * (input.handaenderungssteuerPercent / 100);
  const notariatGrundbuchChf = input.kaufpreisChf * (input.notariatGrundbuchPercent / 100);
  const maklerprovisionChf = input.kaufpreisChf * (input.maklerprovisionPercent / 100);
  return {
    handaenderungssteuerChf,
    notariatGrundbuchChf,
    maklerprovisionChf,
    totalNebenkostenChf: handaenderungssteuerChf + notariatGrundbuchChf + maklerprovisionChf,
  };
}

// ---------------------------------------------------------------------------
// Ebene A — Schnellcheck
// ---------------------------------------------------------------------------

export interface SchnellcheckInput {
  wohnungskaufpreisChf: number;
  parkplatzkaufpreisChf: number;
  wohnflaecheM2: number;
  wohnungsMieteChfPerMonth: number;
  parkplatzMieteChfPerMonth: number;
  /** Mehrertrag ggü. unmöbliert, CHF/Monat — 0, wenn möbliert nicht das gewählte Vermietungsmodell ist (Aufrufer entscheidet, siehe bestandsrendite.ts::computeBestandsrenditeAnalysis). Muss mit demselben Wert übereinstimmen, der auch in JahresertragInput.moeblierungsPremiumChfPerMonth einfliesst — sonst würden Ebene A (Schnellcheck) und Ebene B/C (Investment Case) unterschiedliche Szenarien zeigen. */
  moeblierungsPremiumChfPerMonth: number;
  kaufnebenkostenPercent: number;
  /** Grobe Pauschale für den Schnellcheck — die volle Aufschlüsselung folgt erst in Ebene B (`calculateBetriebskosten`). */
  laufendeKostenChfPerYear: number;
  loanToValuePercent: number;
  interestRatePercent: number;
}

export interface SchnellcheckResult {
  kaufpreisChf: number;
  preisProM2Chf: number;
  jahresnettomieteChf: number;
  bruttoRenditePercent: number;
  /** Inkl. Kaufnebenkosten, wie vorgegeben. */
  eigenkapitalbedarfChf: number;
  belehnungPercent: number;
  groberCashflowChf: number;
}

export function calculateSchnellcheck(input: SchnellcheckInput): SchnellcheckResult {
  const kaufpreisChf = input.wohnungskaufpreisChf + input.parkplatzkaufpreisChf;
  const preisProM2Chf = input.wohnflaecheM2 > 0 ? kaufpreisChf / input.wohnflaecheM2 : 0;
  const jahresnettomieteChf = (input.wohnungsMieteChfPerMonth + input.parkplatzMieteChfPerMonth + input.moeblierungsPremiumChfPerMonth) * 12;
  const bruttoRenditePercent = kaufpreisChf > 0 ? (jahresnettomieteChf / kaufpreisChf) * 100 : 0;

  const kaufnebenkostenChf = kaufpreisChf * (input.kaufnebenkostenPercent / 100);
  const hypothekChf = kaufpreisChf * (input.loanToValuePercent / 100);
  const eigenkapitalbedarfChf = kaufpreisChf - hypothekChf + kaufnebenkostenChf;
  const zinsChf = hypothekChf * (input.interestRatePercent / 100);
  const groberCashflowChf = jahresnettomieteChf - input.laufendeKostenChfPerYear - zinsChf;

  return { kaufpreisChf, preisProM2Chf, jahresnettomieteChf, bruttoRenditePercent, eigenkapitalbedarfChf, belehnungPercent: input.loanToValuePercent, groberCashflowChf };
}

// ---------------------------------------------------------------------------
// Ebene B — Investment Case
// ---------------------------------------------------------------------------

export interface AllInInvestitionInput {
  kaufpreisChf: number;
  nebenkosten: NebenkostenResult;
  renovationInitialChf: number;
  moeblierungInitialChf: number;
  sonstigeInitialkostenChf: number;
}

/** Kaufpreis + Kaufnebenkosten + Initial-Renovation + Initial-Möblierung + Sonstiges — die "wirtschaftliche" Investitionssumme statt nur des Kaufpreises. */
export function calculateAllInInvestition(input: AllInInvestitionInput): number {
  return input.kaufpreisChf + input.nebenkosten.totalNebenkostenChf + input.renovationInitialChf + input.moeblierungInitialChf + input.sonstigeInitialkostenChf;
}

/**
 * Unterscheidet, wie Mietausfall modelliert wird: bei Langfristvermietung (möbliert
 * oder nicht) über eine Leerstandsquote, bei Short-Stay über eine Auslastungsquote —
 * konzeptionell dieselbe Grösse (Anteil vermieteter Zeit), aber mit unterschiedlichen
 * typischen Grössenordnungen und Nutzererwartungen (siehe Parameter-Platzhalter).
 */
export type Vermietungsmodell = "LANGFRISTIG_UNMOEBLIERT" | "MITTELFRISTIG_MOEBLIERT" | "SHORT_STAY";

export interface JahresertragInput {
  wohnungsMieteChfPerMonth: number;
  parkplatzMieteChfPerMonth: number;
  /** Mehrertrag ggü. unmöbliert, CHF/Monat — 0 bei unmöblierter Vermietung. Basisformel bleibt CHF/Monat, kein separates Ertragsmodell (siehe bestandsrenditeValueAdd.ts). */
  moeblierungsPremiumChfPerMonth: number;
  sonstigeEinnahmenChfPerYear: number;
  vermietungsmodell: Vermietungsmodell;
  /** Für LANGFRISTIG_UNMOEBLIERT/MITTELFRISTIG_MOEBLIERT. */
  leerstandPercent?: number;
  /** Für SHORT_STAY, statt Leerstand. */
  auslastungPercent?: number;
}

export interface JahresertragResult {
  potenziellerJahresertragChf: number;
  effektiverJahresertragChf: number;
}

export function calculateJahresertrag(input: JahresertragInput): JahresertragResult {
  const potenziellerJahresertragChf =
    (input.wohnungsMieteChfPerMonth + input.parkplatzMieteChfPerMonth + input.moeblierungsPremiumChfPerMonth) * 12 + input.sonstigeEinnahmenChfPerYear;

  const auslastungsfaktor =
    input.vermietungsmodell === "SHORT_STAY" ? (input.auslastungPercent ?? 100) / 100 : 1 - (input.leerstandPercent ?? 0) / 100;

  return { potenziellerJahresertragChf, effektiverJahresertragChf: potenziellerJahresertragChf * auslastungsfaktor };
}

export interface BetriebskostenInput {
  /** STWEG-Akontobeiträge — in der Schweiz üblicherweise EIN Betrag, der Verwaltung/Versicherung/Unterhalt/Erneuerungsfonds-Beitrag bereits bündelt (siehe StwegFacts für die separate Risikobeurteilung des Fonds selbst). */
  stwegAkontobeitragChfPerYear: number;
  eigentuemerkostenChfPerYear: number;
  vermietungskostenChfPerYear: number;
  reinigungServiceChfPerYear: number;
}

export function calculateBetriebskosten(input: BetriebskostenInput): number {
  return input.stwegAkontobeitragChfPerYear + input.eigentuemerkostenChfPerYear + input.vermietungskostenChfPerYear + input.reinigungServiceChfPerYear;
}

/**
 * Eine Reserve ist entweder als fixer CHF-Betrag ODER als Prozentsatz vom Kaufpreis
 * definierbar (Rückmeldung: "zwei Eingabemethoden") — `chfPerYear` hat Vorrang, wenn
 * gesetzt.
 */
export interface ReserveInput {
  chfPerYear?: number;
  percentOfKaufpreis?: number;
  kaufpreisChf: number;
}

export function resolveReserveChf(input: ReserveInput): number {
  if (input.chfPerYear !== undefined) return input.chfPerYear;
  return input.kaufpreisChf * ((input.percentOfKaufpreis ?? 0) / 100);
}

/**
 * Eine Hypothekartranche (1. oder 2. Hypothek) wird linear amortisiert, wahlweise über
 * einen Prozentsatz des ursprünglichen Tranchenbetrags pro Jahr ODER über eine
 * Zieldauer in Jahren, nach der die Tranche vollständig getilgt ist (Rückmeldung: "die
 * 1. und 2. [Hypothek je] einen Prozentsatz oder Dauer in Jahren als Variable
 * einbauen"). Beide Varianten sind ineinander umrechenbar (`prozentProJahr = 100 /
 * dauerJahre`), aber je nach Tranche ist die eine oder andere Formulierung der
 * natürlichere Ausgangspunkt (1. Hypothek oft "1% p.a.", 2. Hypothek oft "linear über
 * 15 Jahre") — deshalb beide als Eingabemodus statt eine Umrechnung zu erzwingen.
 */
export type AmortisationModus = "PROZENT_PRO_JAHR" | "DAUER_JAHRE";

export interface AmortisationSpec {
  modus: AmortisationModus;
  /** Nur bei modus "PROZENT_PRO_JAHR" massgeblich. */
  prozentProJahr?: number;
  /** Nur bei modus "DAUER_JAHRE" massgeblich. */
  dauerJahre?: number;
}

/** Fixer jährlicher Amortisationsbetrag einer Tranche, hergeleitet aus deren ursprünglichem Betrag und ihrem Amortisationsmodus. */
export function resolveAmortisationChfPerYear(trancheChf: number, spec: AmortisationSpec): number {
  if (spec.modus === "DAUER_JAHRE") {
    const dauerJahre = spec.dauerJahre ?? 0;
    return dauerJahre > 0 ? trancheChf / dauerJahre : 0;
  }
  return trancheChf * ((spec.prozentProJahr ?? 0) / 100);
}

export interface CashflowWasserfallInput {
  effektiverJahresertragChf: number;
  betriebskostenChfPerYear: number;
  zinsChf: number;
  amortisationChf: number;
  /**
   * Grobe, persönliche Schätzung — KEIN Steuerberatungsersatz. Steuerbasis ist
   * NOI minus Zins (nur der Hypothekarzins ist in der Schweiz abzugsfähig, die
   * Amortisation nicht) — eine bewusste Vereinfachung, reale Steuerlast hängt von
   * Kanton, Gemeinde, Progression und der gesamten persönlichen Steuersituation ab.
   */
  kalkulatorischerSteuersatzPercent: number;
  reparaturreserveChf: number;
  leerstandsreserveChf: number;
}

export interface CashflowWasserfallResult {
  /** = Cashflow vor Finanzierung. */
  noiChf: number;
  cashflowNachZinsChf: number;
  cashflowNachAmortisationChf: number;
  steuerChf: number;
  cashflowNachSteuerChf: number;
  /** = Cashflow nach eigener Reparatur-/Leerstandsreserve, wie vorgegeben. */
  nachhaltigerCashflowChf: number;
}

/**
 * Der 5-stufige Cashflow-Wasserfall aus der Rückmeldung, wörtlich: vor Finanzierung →
 * nach Finanzierung (Zins) → nach Amortisation → nach kalkulatorischer Steuer → nach
 * eigener Reparatur-/Leerstandsreserve. Wird sowohl für die Einzeljahr-Ansicht (Ebene
 * B) als auch pro Jahr im 15-Jahres-Modell (Ebene C) verwendet — eine Formel, zwei
 * Verwendungen, keine Duplikation.
 */
export function calculateCashflowWasserfall(input: CashflowWasserfallInput): CashflowWasserfallResult {
  const noiChf = input.effektiverJahresertragChf - input.betriebskostenChfPerYear;
  const cashflowNachZinsChf = noiChf - input.zinsChf;
  const cashflowNachAmortisationChf = cashflowNachZinsChf - input.amortisationChf;

  const steuerbaresEinkommenChf = Math.max(0, cashflowNachZinsChf);
  const steuerChf = steuerbaresEinkommenChf * (input.kalkulatorischerSteuersatzPercent / 100);
  const cashflowNachSteuerChf = cashflowNachAmortisationChf - steuerChf;
  const nachhaltigerCashflowChf = cashflowNachSteuerChf - input.reparaturreserveChf - input.leerstandsreserveChf;

  return { noiChf, cashflowNachZinsChf, cashflowNachAmortisationChf, steuerChf, cashflowNachSteuerChf, nachhaltigerCashflowChf };
}

export interface InvestmentCaseInput {
  kaufpreisChf: number;
  allInInvestitionChf: number;
  ertrag: JahresertragInput;
  betriebskosten: BetriebskostenInput;
  hypothekChf: number;
  interestRatePercent: number;
  amortisationChfPerYear: number;
  kalkulatorischerSteuersatzPercent: number;
  reparaturreserveChf: number;
  leerstandsreserveChf: number;
  eigenkapitalChf: number;
}

export interface InvestmentCaseResult {
  bruttoRenditeKaufpreisPercent: number;
  bruttoRenditeAllInPercent: number;
  /** = NOI / All-in-Investition. */
  nettoRenditeVorFinanzierungPercent: number;
  wasserfall: CashflowWasserfallResult;
  /** = nachhaltiger Cashflow / eingesetztes Eigenkapital. */
  cashOnCashPercent: number;
}

export function calculateInvestmentCase(input: InvestmentCaseInput): InvestmentCaseResult {
  const ertrag = calculateJahresertrag(input.ertrag);
  const betriebskostenChfPerYear = calculateBetriebskosten(input.betriebskosten);
  const zinsChf = input.hypothekChf * (input.interestRatePercent / 100);

  const wasserfall = calculateCashflowWasserfall({
    effektiverJahresertragChf: ertrag.effektiverJahresertragChf,
    betriebskostenChfPerYear,
    zinsChf,
    amortisationChf: input.amortisationChfPerYear,
    kalkulatorischerSteuersatzPercent: input.kalkulatorischerSteuersatzPercent,
    reparaturreserveChf: input.reparaturreserveChf,
    leerstandsreserveChf: input.leerstandsreserveChf,
  });

  const bruttoRenditeKaufpreisPercent = input.kaufpreisChf > 0 ? (ertrag.potenziellerJahresertragChf / input.kaufpreisChf) * 100 : 0;
  const bruttoRenditeAllInPercent = input.allInInvestitionChf > 0 ? (ertrag.potenziellerJahresertragChf / input.allInInvestitionChf) * 100 : 0;
  const nettoRenditeVorFinanzierungPercent = input.allInInvestitionChf > 0 ? (wasserfall.noiChf / input.allInInvestitionChf) * 100 : 0;
  const cashOnCashPercent = input.eigenkapitalChf > 0 ? (wasserfall.nachhaltigerCashflowChf / input.eigenkapitalChf) * 100 : 0;

  return { bruttoRenditeKaufpreisPercent, bruttoRenditeAllInPercent, nettoRenditeVorFinanzierungPercent, wasserfall, cashOnCashPercent };
}

// ---------------------------------------------------------------------------
// Break-even-Werte — numerisch per Bisektion (siehe numeric.ts), nicht als
// geschlossene Formel: robuster gegenüber der Steuer-Nichtnegativitätsschranke im
// Wasserfall, passend zum "nicht institutionellen" MVP-Anspruch.
// ---------------------------------------------------------------------------

/** Monatsmiete (Wohnung), bei der der nachhaltige Cashflow gerade 0 erreicht — alles andere in `input` bleibt fest. */
export function breakEvenMieteChfPerMonth(input: InvestmentCaseInput): number | undefined {
  return bisectRoot(
    (miete) => calculateInvestmentCase({ ...input, ertrag: { ...input.ertrag, wohnungsMieteChfPerMonth: miete } }).wasserfall.nachhaltigerCashflowChf,
    0,
    input.ertrag.wohnungsMieteChfPerMonth * 5 + 10_000,
  );
}

/** Zinssatz, bei dem der nachhaltige Cashflow gerade 0 erreicht. */
export function breakEvenZinsPercent(input: InvestmentCaseInput): number | undefined {
  return bisectRoot((zins) => calculateInvestmentCase({ ...input, interestRatePercent: zins }).wasserfall.nachhaltigerCashflowChf, 0, 25);
}

/** Nur sinnvoll für SHORT_STAY (siehe Vermietungsmodell) — Auslastung, bei der der nachhaltige Cashflow gerade 0 erreicht. */
export function breakEvenAuslastungPercent(input: InvestmentCaseInput): number | undefined {
  if (input.ertrag.vermietungsmodell !== "SHORT_STAY") return undefined;
  return bisectRoot(
    (auslastung) => calculateInvestmentCase({ ...input, ertrag: { ...input.ertrag, auslastungPercent: auslastung } }).wasserfall.nachhaltigerCashflowChf,
    0,
    100,
  );
}
