import { BESTANDSRENDITE_PARAMETERS, defaultsOf } from "@landfinder/financial-engine";
import { computeBestandsrenditeAnalysis } from "./bestandsrendite";
import type { BestandsrenditeFacts, BestandsrenditePropertyInput, BestandsrenditeAnalysisResult, ParameterOverrides } from "./bestandsrendite";

/**
 * Szenario- und Zins-Stresstest-Engine (Auftrag "Advanced Price Strategy & Investment
 * Value Engine", Abschnitte 9+10) — bewusst KEINE neue Rechenlogik: sowohl Szenarien als
 * auch der Zins-Stresstest sind reine Mehrfachaufrufe der bereits vorhandenen,
 * deterministischen `computeBestandsrenditeAnalysis` mit variierten Facts, exakt
 * dasselbe Muster wie das bereits bestehende `computeMoeblierungsAlternative`
 * (möbliert/unmöbliert-Schattenrechnung) und `computePreisStufentabelle`
 * (Mehrfachaufruf über mehrere Kaufpreise).
 */

// ---------------------------------------------------------------------------
// Szenario-Engine (Conservative / Base / Upside)
// ---------------------------------------------------------------------------

export type ScenarioKey = "CONSERVATIVE" | "BASE" | "UPSIDE";

/**
 * Manuelle Überschreibung einzelner Szenario-Parameter (Auftrag: "der Nutzer soll
 * einzelne Parameter manuell überschreiben können") — deckt genau die im Auftrag
 * genannten Stellschrauben ab (Marktmiete, möblierte Miete, Vacancy, Owner Costs,
 * Maintenance/Capex Reserve, Mortgage Rate, Furnishing Cost, Renovation Cost, Purchase
 * Price). `undefined` lässt den jeweiligen Basiswert der Facts unverändert.
 */
export interface ScenarioOverrides {
  wohnungsMieteChfPerMonth?: number;
  moeblierteMietPremiumChfPerMonth?: number;
  /** Leerstand (Langfrist/möbliert) bzw. (100 − Auslastung) bei Short-Stay — EIN einheitlicher "Vacancy"-Wert wie im Auftrag, intern auf das passende Feld gemappt (siehe `applyScenarioOverrides`). */
  vacancyPercent?: number;
  eigentuemerkostenChfPerYear?: number;
  /**
   * "Maintenance" und "Capex Reserve" aus dem Auftrag werden gemeinsam auf
   * `reserven.reparaturChfPerYear` abgebildet — dieselbe Reserve deckt in der
   * Schweizer Bestandsrendite-Praxis dieser App ohnehin beides ab (laufender Unterhalt
   * UND grössere künftige Ersatzinvestitionen), kein separates zweites Feld im
   * bestehenden Datenmodell vorhanden.
   */
  maintenanceCapexReserveChfPerYear?: number;
  interestRatePercent?: number;
  furnishingCostChf?: number;
  renovationCostChf?: number;
  purchasePriceChf?: number;
}

export interface ScenarioDefinition {
  key: ScenarioKey;
  label: string;
  overrides: ScenarioOverrides;
}

export interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  analysis: BestandsrenditeAnalysisResult;
}

/** Dieselbe Herleitung des Leerstand-Platzhalter-Defaults wie in `computeBestandsrenditeAnalysis` — hier separat benötigt, um Conservative/Upside auch OHNE manuell erfasste Vacancy sinnvolle Deltas zeigen zu können. */
function resolveEffectiveVacancyPercent(facts: BestandsrenditeFacts, parameterOverrides?: ParameterOverrides): number {
  const P = { ...defaultsOf(BESTANDSRENDITE_PARAMETERS), ...parameterOverrides };
  if (facts.miete.vermietungsmodell === "SHORT_STAY") return 100 - (facts.miete.auslastungPercent ?? 100);
  if (facts.miete.leerstandPercent !== undefined) return facts.miete.leerstandPercent;
  return facts.miete.vermietungsmodell === "MITTELFRISTIG_MOEBLIERT" ? P.leerstandMoebliertPercent : P.leerstandLangfristigPercent;
}

/** Überträgt einen ScenarioOverrides-Satz in eine neue, unveränderte Kopie von Property/Facts — reine Funktion, keine Mutation der Originale. */
export function applyScenarioOverrides(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  overrides: ScenarioOverrides,
): { property: BestandsrenditePropertyInput; facts: BestandsrenditeFacts } {
  const isShortStay = facts.miete.vermietungsmodell === "SHORT_STAY";
  return {
    property: overrides.purchasePriceChf !== undefined ? { ...property, kaufpreisChf: overrides.purchasePriceChf } : property,
    facts: {
      ...facts,
      miete: {
        ...facts.miete,
        wohnungsMieteChfPerMonth: overrides.wohnungsMieteChfPerMonth ?? facts.miete.wohnungsMieteChfPerMonth,
        leerstandPercent: overrides.vacancyPercent !== undefined && !isShortStay ? overrides.vacancyPercent : facts.miete.leerstandPercent,
        auslastungPercent: overrides.vacancyPercent !== undefined && isShortStay ? 100 - overrides.vacancyPercent : facts.miete.auslastungPercent,
      },
      moeblierung: {
        ...facts.moeblierung,
        mietPremiumChfPerMonth: overrides.moeblierteMietPremiumChfPerMonth ?? facts.moeblierung.mietPremiumChfPerMonth,
        initialCostChf: overrides.furnishingCostChf ?? facts.moeblierung.initialCostChf,
      },
      renovation: {
        ...facts.renovation,
        initialRenovationCostChf: overrides.renovationCostChf ?? facts.renovation.initialRenovationCostChf,
      },
      betriebskosten: {
        ...facts.betriebskosten,
        eigentuemerkostenChfPerYear: overrides.eigentuemerkostenChfPerYear ?? facts.betriebskosten.eigentuemerkostenChfPerYear,
      },
      reserven: {
        ...facts.reserven,
        reparaturChfPerYear: overrides.maintenanceCapexReserveChfPerYear ?? facts.reserven.reparaturChfPerYear,
      },
      hypothek: {
        ...facts.hypothek,
        interestRatePercent: overrides.interestRatePercent ?? facts.hypothek.interestRatePercent,
      },
    },
  };
}

/**
 * Default-Deltas für Conservative/Upside — eine eigene, klar deklarierte Annahme (wie
 * `BESTANDSRENDITE_PARAMETERS`: ein Platzhalter, kein objektspezifisch hergeleiteter
 * Fakt), prozentual/punktuell relativ zum jeweils EFFEKTIVEN Basiswert. "Base" bleibt
 * bewusst ein No-Op (leere Overrides) — das ist exakt der bereits überall sonst auf der
 * Objektseite gezeigte Ist-Zustand, keine zweite, potenziell abweichende Berechnung.
 */
const DEFAULT_SCENARIO_DELTA = {
  CONSERVATIVE: { mieteFactor: -0.05, vacancyPercentPoints: 2, interestRatePercentPoints: 1, ownerCostsFactor: 0.1 },
  UPSIDE: { mieteFactor: 0.05, vacancyPercentPoints: -2, interestRatePercentPoints: -0.5, ownerCostsFactor: -0.1 },
} as const;

/** Baut die drei Standard-Szenarien (Conservative/Base/Upside) — Ausgangspunkt für `computeScenarios`; einzelne Overrides können vor dem Aufruf manuell angepasst werden (Auftrag: manuelles Überschreiben einzelner Parameter). */
export function buildDefaultScenarios(facts: BestandsrenditeFacts, parameterOverrides?: ParameterOverrides): ScenarioDefinition[] {
  const effectiveVacancy = resolveEffectiveVacancyPercent(facts, parameterOverrides);
  const clampVacancy = (v: number) => Math.min(100, Math.max(0, v));

  return [
    {
      key: "CONSERVATIVE",
      label: "Conservative",
      overrides: {
        wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth * (1 + DEFAULT_SCENARIO_DELTA.CONSERVATIVE.mieteFactor),
        moeblierteMietPremiumChfPerMonth: facts.moeblierung.mietPremiumChfPerMonth * (1 + DEFAULT_SCENARIO_DELTA.CONSERVATIVE.mieteFactor),
        vacancyPercent: clampVacancy(effectiveVacancy + DEFAULT_SCENARIO_DELTA.CONSERVATIVE.vacancyPercentPoints),
        interestRatePercent: Math.max(0, facts.hypothek.interestRatePercent + DEFAULT_SCENARIO_DELTA.CONSERVATIVE.interestRatePercentPoints),
        eigentuemerkostenChfPerYear: facts.betriebskosten.eigentuemerkostenChfPerYear * (1 + DEFAULT_SCENARIO_DELTA.CONSERVATIVE.ownerCostsFactor),
      },
    },
    { key: "BASE", label: "Base", overrides: {} },
    {
      key: "UPSIDE",
      label: "Upside",
      overrides: {
        wohnungsMieteChfPerMonth: facts.miete.wohnungsMieteChfPerMonth * (1 + DEFAULT_SCENARIO_DELTA.UPSIDE.mieteFactor),
        moeblierteMietPremiumChfPerMonth: facts.moeblierung.mietPremiumChfPerMonth * (1 + DEFAULT_SCENARIO_DELTA.UPSIDE.mieteFactor),
        vacancyPercent: clampVacancy(effectiveVacancy + DEFAULT_SCENARIO_DELTA.UPSIDE.vacancyPercentPoints),
        interestRatePercent: Math.max(0, facts.hypothek.interestRatePercent + DEFAULT_SCENARIO_DELTA.UPSIDE.interestRatePercentPoints),
        eigentuemerkostenChfPerYear: Math.max(0, facts.betriebskosten.eigentuemerkostenChfPerYear * (1 + DEFAULT_SCENARIO_DELTA.UPSIDE.ownerCostsFactor)),
      },
    },
  ];
}

/** Rechnet eine Liste von Szenario-Definitionen komplett durch — jede über dieselbe `computeBestandsrenditeAnalysis` wie die Hauptseite, kein paralleler Rechenweg. */
export function computeScenarios(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  scenarios: ScenarioDefinition[],
  parameterOverrides?: ParameterOverrides,
): ScenarioResult[] {
  return scenarios.map(({ key, label, overrides }) => {
    const applied = applyScenarioOverrides(property, facts, overrides);
    return { key, label, analysis: computeBestandsrenditeAnalysis(applied.property, applied.facts, parameterOverrides) };
  });
}

// ---------------------------------------------------------------------------
// Zins-Stresstest + DSCR
// ---------------------------------------------------------------------------

export interface InterestRateStressTestRow {
  interestRatePercent: number;
  /** `true` für genau die Zeile, die dem aktuell erfassten Zinssatz entspricht. */
  isBaseRate: boolean;
  annualInterestChf: number;
  nachhaltigerCashflowChf: number;
  cashOnCashPercent: number;
  /**
   * Debt Service Coverage Ratio = NOI ÷ Schuldendienst (Zins + Amortisation) — neue
   * Kennzahl, im bisherigen Modell nicht vorhanden. `undefined`, wenn kein Schuldendienst
   * anfällt (keine Hypothek/Amortisation), damit keine Division durch 0 eine falsche "0"
   * statt einer echten Aussagelosigkeit vortäuscht.
   */
  dscr: number | undefined;
}

const STRESS_TEST_RATES_PERCENT = [2.5, 3.5, 5.0];

/**
 * Zins-Stresstest (Auftrag Abschnitt 10) — mindestens aktueller/Basiszins, 2.5%, 3.5%,
 * 5.0%. Der Basiszins wird dedupliziert eingefügt, falls er zufällig exakt einem der
 * festen Stresswerte entspricht, und die Zeilen bleiben aufsteigend sortiert.
 */
export function computeInterestRateStressTest(
  property: BestandsrenditePropertyInput,
  facts: BestandsrenditeFacts,
  parameterOverrides?: ParameterOverrides,
): InterestRateStressTestRow[] {
  const baseRate = facts.hypothek.interestRatePercent;
  const rates = Array.from(new Set([baseRate, ...STRESS_TEST_RATES_PERCENT])).sort((a, b) => a - b);

  return rates.map((interestRatePercent) => {
    const stressedFacts: BestandsrenditeFacts = { ...facts, hypothek: { ...facts.hypothek, interestRatePercent } };
    const analysis = computeBestandsrenditeAnalysis(property, stressedFacts, parameterOverrides);
    const hypothekTotalChf = analysis.hypothek.ersteHypothekChf + analysis.hypothek.zweiteHypothekChf;
    const amortisationChfPerYear = analysis.hypothek.ersteAmortisationChfPerYear + analysis.hypothek.zweiteAmortisationChfPerYear;
    const annualInterestChf = hypothekTotalChf * (interestRatePercent / 100);
    const debtServiceChf = annualInterestChf + amortisationChfPerYear;
    return {
      interestRatePercent,
      isBaseRate: interestRatePercent === baseRate,
      annualInterestChf,
      nachhaltigerCashflowChf: analysis.investmentCase.wasserfall.nachhaltigerCashflowChf,
      cashOnCashPercent: analysis.investmentCase.cashOnCashPercent,
      dscr: debtServiceChf > 0 ? analysis.investmentCase.wasserfall.noiChf / debtServiceChf : undefined,
    };
  });
}

/**
 * Warnhinweis (Auftrag, wörtlich: "Return materially dependent on low financing
 * costs") — `true`, wenn der nachhaltige Cashflow beim Basiszins (noch) positiv ist,
 * bei mindestens einem der Stress-Zinssätze aber negativ wird. Rein regelbasiert aus den
 * bereits berechneten Zeilen, keine neue Schwelle/Formel.
 */
export function isReturnMateriallyRateDependent(rows: InterestRateStressTestRow[]): boolean {
  const base = rows.find((r) => r.isBaseRate);
  if (!base || base.nachhaltigerCashflowChf < 0) return false;
  return rows.some((r) => !r.isBaseRate && r.nachhaltigerCashflowChf < 0);
}
