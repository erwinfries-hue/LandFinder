import { internalRateOfReturn } from "./numeric";
import {
  calculateJahresertrag,
  calculateBetriebskosten,
  calculateCashflowWasserfall,
  resolveAmortisationChfPerYear,
  type JahresertragInput,
  type BetriebskostenInput,
  type AmortisationSpec,
} from "./bestandsrendite";
import { moeblierungErsatzCashflowChf, type MoeblierungLebenszyklusInput } from "./bestandsrenditeValueAdd";

/**
 * Ebene C — Mehrjahres-Investmentmodell (docs/OPEN_DECISIONS.md, Punkt N). Default
 * 15 Jahre Haltedauer, 5–30 wählbar (Rückmeldung 2026-08-16). Modelliert pro Jahr
 * Einnahmen, Kosten, Finanzierung (Restschuld/Zins getrennt von Amortisation) und
 * Cashflow — wiederverwendet dieselbe Ertrags-/Kosten-/Wasserfall-Logik wie Ebene B
 * (`bestandsrendite.ts`) pro Jahr, statt sie zu duplizieren. Am Ende: Exit-Erlös,
 * Equity Multiple, Levered/Unlevered IRR. Bewusst NICHT institutionell (kein DCF/
 * WACC/NPV/Monte-Carlo) — IRR per einfacher Bisektion (`numeric.ts`).
 */

function escalate(base: number, ratePercent: number, years: number): number {
  return base * Math.pow(1 + ratePercent / 100, years);
}

/** Eine einzelne Hypothekartranche (1. oder 2. Hypothek) über die Haltedauer — eigene Restschuld, eigener (aus `amortisation` hergeleiteter) Tilgungsbetrag pro Jahr. */
export interface HypothekTrancheInput {
  initialLoanChf: number;
  amortisation: AmortisationSpec;
}

/**
 * 1. und 2. Hypothek werden unabhängig voneinander amortisiert (übliche
 * Schweizer Struktur: die 2. Hypothek wird typischerweise über eine feste Dauer
 * getilgt, die 1. oft gar nicht oder nur mit einem kleinen Prozentsatz) — deshalb zwei
 * getrennte Restschulden über die Haltedauer, nicht ein gemeinsamer Topf. Der Zinssatz
 * bleibt bewusst EIN gemeinsamer Wert für beide Tranchen (kein separat abgestimmter
 * Bedarf für unterschiedliche Zinssätze je Tranche).
 */
export interface HypothekInput {
  ersteHypothek: HypothekTrancheInput;
  zweiteHypothek: HypothekTrancheInput;
  interestRatePercent: number;
}

export interface ExitInput {
  sellingCostPercent: number;
  /**
   * Optional — grobe Näherung der Grundstückgewinnsteuer auf den vereinfachten Gewinn
   * (Verkaufspreis − Kaufpreis − wertvermehrende Renovation − Verkaufskosten), OHNE
   * Besitzdauerabzug oder sonstige kantonale Details. Kein Steuerberatungsersatz.
   * `undefined` = nicht modelliert.
   */
  grundstueckgewinnsteuerPercent?: number;
}

export interface MehrjahresmodellInput {
  holdingPeriodYears: number;
  kaufpreisChf: number;
  allInInvestitionChf: number;
  eigenkapitalChf: number;
  ertragJahr1: JahresertragInput;
  betriebskostenJahr1: BetriebskostenInput;
  reparaturreserveJahr1Chf: number;
  leerstandsreserveJahr1Chf: number;
  mietsteigerungPercentPerYear: number;
  kosteninflationPercentPerYear: number;
  wertsteigerungPercentPerYear: number;
  /** Fliesst einmalig in den Immobilienwert ein (wertvermehrende Renovation erhöht den Wert, werterhaltende/energetische nicht) — siehe `bestandsrenditeValueAdd.ts::RenovationPositionenSummary`. */
  wertvermehrendeRenovationChf: number;
  moeblierung?: MoeblierungLebenszyklusInput;
  hypothek: HypothekInput;
  kalkulatorischerSteuersatzPercent: number;
  exit: ExitInput;
}

export interface MehrjahresmodellJahrResult {
  jahr: number;
  effektiverJahresertragChf: number;
  betriebskostenChfPerYear: number;
  noiChf: number;
  zinsChf: number;
  amortisationChf: number;
  restschuldChf: number;
  cashflowNachZinsChf: number;
  cashflowNachAmortisationChf: number;
  steuerChf: number;
  cashflowNachSteuerChf: number;
  /** Reparatur- + Leerstandsreserve dieses Jahres, kombiniert. */
  reserveChf: number;
  moeblierungsErsatzChf: number;
  /** Nach Reserven UND — anders als in Ebene B — nach einem eventuell in diesem Jahr fälligen Möblierungsersatz. */
  nachhaltigerCashflowChf: number;
  kumulierterCashflowChf: number;
  immobilienwertChf: number;
  eigenkapitalwertChf: number;
  belehnungPercent: number;
}

export interface MehrjahresmodellExitResult {
  assumedPropertyValueChf: number;
  remainingLoanChf: number;
  sellingCostsChf: number;
  grundstueckgewinnsteuerChf?: number;
  netProceedsChf: number;
}

export interface MehrjahresmodellResult {
  years: MehrjahresmodellJahrResult[];
  exit: MehrjahresmodellExitResult;
  equityMultiple: number;
  leveredIrrPercent: number | undefined;
  unleveredIrrPercent: number | undefined;
}

export function runMehrjahresmodell(input: MehrjahresmodellInput): MehrjahresmodellResult {
  const years: MehrjahresmodellJahrResult[] = [];
  let restschuld1Chf = input.hypothek.ersteHypothek.initialLoanChf;
  let restschuld2Chf = input.hypothek.zweiteHypothek.initialLoanChf;
  // Auf Basis des ursprünglichen Tranchenbetrags einmalig hergeleitet, nicht pro Jahr
  // neu — sonst würde eine sinkende Restschuld bei "Prozent pro Jahr" den Tilgungsbetrag
  // selbst immer kleiner werden lassen (nicht die übliche lineare Amortisation).
  const amortisation1ChfPerYear = resolveAmortisationChfPerYear(input.hypothek.ersteHypothek.initialLoanChf, input.hypothek.ersteHypothek.amortisation);
  const amortisation2ChfPerYear = resolveAmortisationChfPerYear(input.hypothek.zweiteHypothek.initialLoanChf, input.hypothek.zweiteHypothek.amortisation);
  let kumulierterCashflowChf = 0;

  // Mindestens 1 Jahr, damit `years` nie leer bleibt (sonst würde `lastYear` unten
  // undefined — z.B. wenn `holdingPeriodYears` per API-Aufruf ohne das UI-Formular
  // (dessen `min="5"` das sonst verhindert) als 0 oder negativ übergeben wird).
  const holdingPeriodYears = Math.max(1, Math.floor(input.holdingPeriodYears));

  for (let jahr = 1; jahr <= holdingPeriodYears; jahr++) {
    const wachstumsjahre = jahr - 1;

    const ertrag = calculateJahresertrag({
      ...input.ertragJahr1,
      wohnungsMieteChfPerMonth: escalate(input.ertragJahr1.wohnungsMieteChfPerMonth, input.mietsteigerungPercentPerYear, wachstumsjahre),
      parkplatzMieteChfPerMonth: escalate(input.ertragJahr1.parkplatzMieteChfPerMonth, input.mietsteigerungPercentPerYear, wachstumsjahre),
      moeblierungsPremiumChfPerMonth: escalate(input.ertragJahr1.moeblierungsPremiumChfPerMonth, input.mietsteigerungPercentPerYear, wachstumsjahre),
      sonstigeEinnahmenChfPerYear: escalate(input.ertragJahr1.sonstigeEinnahmenChfPerYear, input.mietsteigerungPercentPerYear, wachstumsjahre),
    });

    const betriebskostenChfPerYear = calculateBetriebskosten({
      stwegAkontobeitragChfPerYear: escalate(input.betriebskostenJahr1.stwegAkontobeitragChfPerYear, input.kosteninflationPercentPerYear, wachstumsjahre),
      eigentuemerkostenChfPerYear: escalate(input.betriebskostenJahr1.eigentuemerkostenChfPerYear, input.kosteninflationPercentPerYear, wachstumsjahre),
      vermietungskostenChfPerYear: escalate(input.betriebskostenJahr1.vermietungskostenChfPerYear, input.kosteninflationPercentPerYear, wachstumsjahre),
      reinigungServiceChfPerYear: escalate(input.betriebskostenJahr1.reinigungServiceChfPerYear, input.kosteninflationPercentPerYear, wachstumsjahre),
      reparaturChfPerYear: escalate(input.betriebskostenJahr1.reparaturChfPerYear, input.kosteninflationPercentPerYear, wachstumsjahre),
      nebenkostenMoebliertChfPerYear: escalate(input.betriebskostenJahr1.nebenkostenMoebliertChfPerYear, input.kosteninflationPercentPerYear, wachstumsjahre),
    });

    // Zins auf die gemeinsame Restschuld zu Jahresbeginn (ein Zinssatz für beide
    // Tranchen), Amortisation je Tranche linear fix und nie mehr als deren eigene
    // verbleibende Restschuld — eine bereits getilgte Tranche bleibt bei 0, während die
    // andere ggf. noch weiterläuft.
    const zinsChf = (restschuld1Chf + restschuld2Chf) * (input.hypothek.interestRatePercent / 100);
    const amortisation1Chf = Math.min(amortisation1ChfPerYear, restschuld1Chf);
    const amortisation2Chf = Math.min(amortisation2ChfPerYear, restschuld2Chf);
    const amortisationChf = amortisation1Chf + amortisation2Chf;

    const reparaturreserveChf = escalate(input.reparaturreserveJahr1Chf, input.kosteninflationPercentPerYear, wachstumsjahre);
    const leerstandsreserveChf = escalate(input.leerstandsreserveJahr1Chf, input.kosteninflationPercentPerYear, wachstumsjahre);

    const wasserfall = calculateCashflowWasserfall({
      effektiverJahresertragChf: ertrag.effektiverJahresertragChf,
      betriebskostenChfPerYear,
      zinsChf,
      amortisationChf,
      kalkulatorischerSteuersatzPercent: input.kalkulatorischerSteuersatzPercent,
      reparaturreserveChf,
      leerstandsreserveChf,
    });

    // Möblierungsersatz als konkreter Cash-Abfluss im Ersatzjahr, nicht geglättet
    // (Rückmeldung: "für die Mehrjahresrechnung würde ich tatsächlich den Cash-Abfluss
    // im Ersatzjahr rechnen").
    const moeblierungsErsatzChf = input.moeblierung ? moeblierungErsatzCashflowChf(input.moeblierung, jahr) : 0;
    const nachhaltigerCashflowChf = wasserfall.nachhaltigerCashflowChf - moeblierungsErsatzChf;

    restschuld1Chf = restschuld1Chf - amortisation1Chf;
    restschuld2Chf = restschuld2Chf - amortisation2Chf;
    const restschuldChf = restschuld1Chf + restschuld2Chf;
    kumulierterCashflowChf += nachhaltigerCashflowChf;

    const immobilienwertChf = escalate(input.kaufpreisChf + input.wertvermehrendeRenovationChf, input.wertsteigerungPercentPerYear, jahr);
    const eigenkapitalwertChf = immobilienwertChf - restschuldChf;
    const belehnungPercent = immobilienwertChf > 0 ? (restschuldChf / immobilienwertChf) * 100 : 0;

    years.push({
      jahr,
      effektiverJahresertragChf: ertrag.effektiverJahresertragChf,
      betriebskostenChfPerYear,
      noiChf: wasserfall.noiChf,
      zinsChf,
      amortisationChf,
      restschuldChf,
      cashflowNachZinsChf: wasserfall.cashflowNachZinsChf,
      cashflowNachAmortisationChf: wasserfall.cashflowNachAmortisationChf,
      steuerChf: wasserfall.steuerChf,
      cashflowNachSteuerChf: wasserfall.cashflowNachSteuerChf,
      reserveChf: reparaturreserveChf + leerstandsreserveChf,
      moeblierungsErsatzChf,
      nachhaltigerCashflowChf,
      kumulierterCashflowChf,
      immobilienwertChf,
      eigenkapitalwertChf,
      belehnungPercent,
    });
  }

  const lastYear = years[years.length - 1];
  const assumedPropertyValueChf = lastYear.immobilienwertChf;
  const sellingCostsChf = assumedPropertyValueChf * (input.exit.sellingCostPercent / 100);
  const grossGainChf = Math.max(0, assumedPropertyValueChf - input.kaufpreisChf - input.wertvermehrendeRenovationChf - sellingCostsChf);
  const grundstueckgewinnsteuerChf =
    input.exit.grundstueckgewinnsteuerPercent !== undefined ? grossGainChf * (input.exit.grundstueckgewinnsteuerPercent / 100) : undefined;
  const netProceedsChf = assumedPropertyValueChf - lastYear.restschuldChf - sellingCostsChf - (grundstueckgewinnsteuerChf ?? 0);

  const leveredCashflows = [-input.eigenkapitalChf, ...years.map((y) => y.nachhaltigerCashflowChf)];
  leveredCashflows[leveredCashflows.length - 1] += netProceedsChf;
  const leveredIrrPercent = internalRateOfReturn(leveredCashflows);

  // Unlevered: als wäre die gesamte All-in-Investition ohne Fremdkapital eigenfinanziert — Ertrag ist NOI (vor Zins/Amortisation), Exit ohne Restschuldabzug.
  const unleveredCashflows = [-input.allInInvestitionChf, ...years.map((y) => y.noiChf)];
  unleveredCashflows[unleveredCashflows.length - 1] += assumedPropertyValueChf - sellingCostsChf - (grundstueckgewinnsteuerChf ?? 0);
  const unleveredIrrPercent = internalRateOfReturn(unleveredCashflows);

  const totalDistributionsChf = years.reduce((sum, y) => sum + y.nachhaltigerCashflowChf, 0) + netProceedsChf;
  const equityMultiple = input.eigenkapitalChf > 0 ? totalDistributionsChf / input.eigenkapitalChf : 0;

  return {
    years,
    exit: { assumedPropertyValueChf, remainingLoanChf: lastYear.restschuldChf, sellingCostsChf, grundstueckgewinnsteuerChf, netProceedsChf },
    equityMultiple,
    leveredIrrPercent,
    unleveredIrrPercent,
  };
}

// ---------------------------------------------------------------------------
// Investment-Treiber-Attribution — "Wo entsteht die Rendite?" (Rückmeldung
// 2026-08-16). Mechanische Zerlegung per Vergleichsläufen (mit/ohne Hebel,
// Mietsteigerung, Möblierung, Wertsteigerung), KEINE wissenschaftliche
// Attributionsanalyse. Deckt nur die aus diesem Rechenmodell ableitbaren Treiber ab —
// "Risiko STWEG"/"CapEx-Risiko" aus dem Beispiel des Auftraggebers kommen aus der
// Dokumenten-Due-Diligence (dueDiligenceSynthesis.ts), nicht aus diesem rein
// finanziellen Modell, und werden erst in der UI zusammengeführt.
// ---------------------------------------------------------------------------

export type InvestmentTreiberStaerke = "+" | "++" | "+++";

export interface InvestmentTreiber {
  label: string;
  staerke: InvestmentTreiberStaerke;
  /** Levered-IRR-Differenz in Prozentpunkten ggü. dem Vergleichslauf ohne diesen Treiber (grobe Einordnung, siehe Modulkopf). */
  irrBeitragPercentPoints: number;
}

export interface InvestmentTreiberResult {
  treiber: InvestmentTreiber[];
}

/** Bandbreiten bewusst grob und als reine Präsentations-/MVP-Entscheidung gewählt, nicht mit dem Auftraggeber abgestimmt. */
function staerkeFromDeltaPp(deltaPp: number): InvestmentTreiberStaerke {
  const abs = Math.abs(deltaPp);
  if (abs >= 3) return "+++";
  if (abs >= 1) return "++";
  return "+";
}

export function computeInvestmentTreiber(input: MehrjahresmodellInput): InvestmentTreiberResult {
  const full = runMehrjahresmodell(input);
  const fullLeveredIrr = full.leveredIrrPercent ?? 0;
  const baseUnleveredIrr = full.unleveredIrrPercent ?? 0;

  const withoutGrowth = runMehrjahresmodell({ ...input, mietsteigerungPercentPerYear: 0 });
  const withoutFurniture = runMehrjahresmodell({
    ...input,
    ertragJahr1: { ...input.ertragJahr1, moeblierungsPremiumChfPerMonth: 0 },
    moeblierung: undefined,
  });
  const withoutAppreciation = runMehrjahresmodell({ ...input, wertsteigerungPercentPerYear: 0 });

  const treiber: InvestmentTreiber[] = [
    { label: "Mietertrag (unlevered)", staerke: staerkeFromDeltaPp(baseUnleveredIrr), irrBeitragPercentPoints: baseUnleveredIrr },
    { label: "Finanzierungshebel", staerke: staerkeFromDeltaPp(fullLeveredIrr - baseUnleveredIrr), irrBeitragPercentPoints: fullLeveredIrr - baseUnleveredIrr },
    {
      label: "Mietsteigerungspotenzial",
      staerke: staerkeFromDeltaPp(fullLeveredIrr - (withoutGrowth.leveredIrrPercent ?? 0)),
      irrBeitragPercentPoints: fullLeveredIrr - (withoutGrowth.leveredIrrPercent ?? 0),
    },
    {
      label: "Möblierungspotenzial",
      staerke: staerkeFromDeltaPp(fullLeveredIrr - (withoutFurniture.leveredIrrPercent ?? 0)),
      irrBeitragPercentPoints: fullLeveredIrr - (withoutFurniture.leveredIrrPercent ?? 0),
    },
    {
      label: "Wertsteigerung",
      staerke: staerkeFromDeltaPp(fullLeveredIrr - (withoutAppreciation.leveredIrrPercent ?? 0)),
      irrBeitragPercentPoints: fullLeveredIrr - (withoutAppreciation.leveredIrrPercent ?? 0),
    },
  ];

  return { treiber };
}
