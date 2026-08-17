import { calculateErtrag, calculateFinanzierung, type ErtragResult, type FinanzierungResult } from "./ertragFinanzierung";

/**
 * Rechenmodell für "Bestandsrendite auf Eigentumswohnungen" (docs/OPEN_DECISIONS.md,
 * Punkt I.2/M) — Kauf einer bestehenden, renovierbaren oder bereits sanierten
 * Eigentumswohnung ausschliesslich zur Vermietung (möbliert als Business Apartment
 * oder unmöbliert langfristig, nie Eigennutzung). Strukturell eine andere Rechnung
 * als das Bauland-/Development-Underwriting in `baupotenzial.ts`/`projektkosten.ts`/
 * `residualwert.ts`: kein Baupotenzial, kein Residualwert, keine
 * Ausnützungsziffer — stattdessen ein einfacher Kaufpreis-plus-Nebenkosten-Stack.
 *
 * Modellentscheid (Rückmeldung Auftraggeber, 2026-08-16): **unmöbliert ist die
 * einzige Mietbasis** — dieselbe CHF/m²/Monat-Formel gilt für möblierte wie
 * unmöblierte Vermietung (eine Business-Apartment-Miete ist einfach ein höherer
 * eingegebener CHF/m²/Monat-Wert, keine eigene Tagesansatz-/Auslastungs-Formel).
 * Möblierung ist stattdessen ein reiner Kosten-Zusatz: Initialkosten (einmalig, in
 * `totalInvestmentChf`) plus ein jährlicher Ersatzsatz in % davon (laufende Kosten).
 * Renovation ist analog aufgebaut: Initial-Renovationskosten (einmalig, direkt
 * eingegeben statt aus Fläche×Kostensatz berechnet) plus ein jährlicher
 * Renovationssatz in % **des Kaufpreises** (laufende Rückstellung, nicht der
 * Renovationskosten) — beide Sätze sind eigene Variablen. Kein Score/keine
 * Empfehlung hier (anders als scoring-engine für Development): welche Rendite/DSCR
 * als "gut genug" gilt, ist eine Investitionskriterien-Frage, noch nicht mit dem
 * Auftraggeber abgestimmt — diese Datei liefert nur die Zahlen, keine Bewertung.
 *
 * `calculateErtrag`/`calculateFinanzierung` aus `ertragFinanzierung.ts` sind bereits
 * objektart-neutral (reine NOI-/Finanzierungsformeln, keine Development-Kopplung) —
 * hier bewusst wiederverwendet statt dupliziert, siehe `runBestandsrenditeScenario`.
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

export interface RenovationInput {
  /** Einmalige Initial-Renovationskosten — direkt eingegebener CHF-Betrag, nicht aus Fläche×Kostensatz berechnet (0, wenn bereits saniert). */
  initialRenovationCostChf: number;
  kaufpreisChf: number;
  /** Laufende Renovations-/Instandhaltungsrückstellung, in % **des Kaufpreises** (nicht der Initialkosten) pro Jahr. */
  jaehrlicherRenovationssatzPercent: number;
}

export interface RenovationResult {
  initialRenovationCostChf: number;
  jaehrlicheRenovationsrueckstellungChf: number;
}

export function calculateRenovation(input: RenovationInput): RenovationResult {
  return {
    initialRenovationCostChf: input.initialRenovationCostChf,
    jaehrlicheRenovationsrueckstellungChf: input.kaufpreisChf * (input.jaehrlicherRenovationssatzPercent / 100),
  };
}

export interface MoeblierungInput {
  /** Einmalige Initial-Möblierungskosten — 0 für unmöblierte Vermietung. */
  initialCostChf: number;
  /** Jährlicher Ersatz-/Erneuerungssatz, in % **der Möblierungs-Initialkosten** pro Jahr. */
  jaehrlicherErsatzsatzPercent: number;
}

export interface MoeblierungResult {
  initialCostChf: number;
  jaehrlicheErsatzkostenChf: number;
}

/** 0/0 für eine unmöblierte Vermietung (initialCostChf = 0) — dieselbe Formel deckt beide Fälle ab, kein separater Vermietungsart-Zweig nötig. */
export function calculateMoeblierung(input: MoeblierungInput): MoeblierungResult {
  return {
    initialCostChf: input.initialCostChf,
    jaehrlicheErsatzkostenChf: input.initialCostChf * (input.jaehrlicherErsatzsatzPercent / 100),
  };
}

export interface GesamtinvestitionInput {
  kaufpreisChf: number;
  nebenkosten: NebenkostenResult;
  renovation: RenovationResult;
  moeblierung: MoeblierungResult;
}

export function calculateGesamtinvestition(input: GesamtinvestitionInput): number {
  return input.kaufpreisChf + input.nebenkosten.totalNebenkostenChf + input.renovation.initialRenovationCostChf + input.moeblierung.initialCostChf;
}

export interface MietertragInput {
  wohnflaecheM2: number;
  /** Gilt für möblierte wie unmöblierte Vermietung gleichermassen — siehe Modellentscheid oben. */
  netRentChfPerM2Month: number;
}

export function estimateAnnualPotentialRentChf(input: MietertragInput): number {
  return input.wohnflaecheM2 * input.netRentChfPerM2Month * 12;
}

export interface RenditeResult {
  bruttoRenditePercent: number;
  nettoRenditePercent: number;
}

/** Brutto = potenzielle Jahresmiete / Gesamtinvestition. Netto = NOI / Gesamtinvestition (nach Leerstand/Betriebskosten). Beide immer gemeinsam ausgewiesen. */
export function calculateRendite(annualPotentialRentChf: number, noiChf: number, totalInvestmentChf: number): RenditeResult {
  if (totalInvestmentChf <= 0) return { bruttoRenditePercent: 0, nettoRenditePercent: 0 };
  return {
    bruttoRenditePercent: (annualPotentialRentChf / totalInvestmentChf) * 100,
    nettoRenditePercent: (noiChf / totalInvestmentChf) * 100,
  };
}

export interface BestandsrenditeScenarioInputs {
  kaufpreisChf: number;
  nebenkosten: Omit<NebenkostenInput, "kaufpreisChf">;
  renovation: Omit<RenovationInput, "kaufpreisChf">;
  moeblierung: MoeblierungInput;
  miete: MietertragInput;
  vacancyRatePercent: number;
  collectionLossRatePercent: number;
  operatingExpenseRatioPercent: number;
  fixedNonRecoverableCostsChfPerYear: number;
  annualCapexReserveChfPerYear: number;
  loanToCostPercent: number;
  interestRatePercent: number;
  amortizationChfPerYear: number;
}

export interface BestandsrenditeScenarioResult {
  nebenkosten: NebenkostenResult;
  renovation: RenovationResult;
  moeblierung: MoeblierungResult;
  totalInvestmentChf: number;
  ertrag: ErtragResult;
  finanzierung: FinanzierungResult;
  rendite: RenditeResult;
}

/**
 * Orchestriert Nebenkosten → Renovation → Möblierung → Gesamtinvestition → Ertrag
 * (inkl. laufender Renovations-/Möblierungs-Rückstellung als Betriebskosten) →
 * Finanzierung → Brutto-/Nettorendite. Pendant zu `szenarien.ts::runScenario`, aber
 * für die Bestandsrendite-Kostenstruktur statt Development-Projektkosten.
 */
export function runBestandsrenditeScenario(input: BestandsrenditeScenarioInputs): BestandsrenditeScenarioResult {
  const nebenkosten = calculateNebenkosten({ kaufpreisChf: input.kaufpreisChf, ...input.nebenkosten });
  const renovation = calculateRenovation({ kaufpreisChf: input.kaufpreisChf, ...input.renovation });
  const moeblierung = calculateMoeblierung(input.moeblierung);
  const totalInvestmentChf = calculateGesamtinvestition({ kaufpreisChf: input.kaufpreisChf, nebenkosten, renovation, moeblierung });

  const ertrag = calculateErtrag({
    rentalNraM2: input.miete.wohnflaecheM2,
    rentChfPerM2Month: input.miete.netRentChfPerM2Month,
    parkingIncomeChfPerYear: 0,
    otherIncomeChfPerYear: 0,
    vacancyRatePercent: input.vacancyRatePercent,
    collectionLossRatePercent: input.collectionLossRatePercent,
    operatingExpenseRatioPercent: input.operatingExpenseRatioPercent,
    fixedNonRecoverableCostsChfPerYear:
      input.fixedNonRecoverableCostsChfPerYear + renovation.jaehrlicheRenovationsrueckstellungChf + moeblierung.jaehrlicheErsatzkostenChf,
    annualCapexReserveChfPerYear: input.annualCapexReserveChfPerYear,
  });

  const finanzierung = calculateFinanzierung({
    totalDevelopmentCostChf: totalInvestmentChf,
    loanToCostPercent: input.loanToCostPercent,
    interestRatePercent: input.interestRatePercent,
    amortizationChfPerYear: input.amortizationChfPerYear,
    noiChf: ertrag.noiChf,
  });

  const rendite = calculateRendite(ertrag.annualPotentialRentChf, ertrag.noiChf, totalInvestmentChf);

  return { nebenkosten, renovation, moeblierung, totalInvestmentChf, ertrag, finanzierung, rendite };
}
