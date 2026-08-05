/** Die sechs möglichen Empfehlungen (Abschnitt 18) — abschliessende Liste. */
export type Empfehlung =
  | "SOFORT_PRUEFEN"
  | "POTENZIAL_DRINGEND_VERIFIZIEREN"
  | "WEITERVERFOLGEN"
  | "BEOBACHTEN_VERHANDELN"
  | "NICHT_WEITERVERFOLGEN"
  | "UNGENUEGENDE_DATEN";

export const EMPFEHLUNG_LABEL: Record<Empfehlung, string> = {
  SOFORT_PRUEFEN: "Sofort prüfen",
  POTENZIAL_DRINGEND_VERIFIZIEREN: "Potenzial – dringend verifizieren",
  WEITERVERFOLGEN: "Weiterverfolgen",
  BEOBACHTEN_VERHANDELN: "Beobachten / verhandeln",
  NICHT_WEITERVERFOLGEN: "Nicht weiterverfolgen",
  UNGENUEGENDE_DATEN: "Ungenügende Daten",
};

/** Gründe für ein Hard Gate (Abschnitt 17) — nicht kompensierbar durch einen guten Score. */
export type HardGateReason =
  | "OUTSIDE_REGION"
  | "WRONG_OBJECT_TYPE"
  | "BAURECHT_EXCLUDED"
  | "NOT_IN_BUILDING_ZONE"
  | "RESIDENTIAL_USE_NOT_PERMITTED"
  | "PRICE_ABOVE_MAXIMUM"
  | "TOTAL_PROJECT_ABOVE_MAXIMUM"
  | "EQUITY_ABOVE_MAXIMUM"
  | "PROJECT_SIZE_UNREACHABLE"
  | "PROHIBITED_NATURAL_HAZARD"
  | "PROHIBITED_CONTAMINATION"
  | "ACCESS_MISSING"
  | "LOCATION_NOT_IDENTIFIABLE";

export interface HardGateOverride {
  overriddenBy: string;
  justification: string;
  at: string;
}

export interface HardGateResult {
  status: "PASSED" | "REJECTED_BY_RULE";
  reason?: HardGateReason;
  evidence?: string;
  override?: HardGateOverride;
}

/** Verifikationsstufe einer Baupotenzial-Angabe (Abschnitt 9). */
export type VerificationLevel = "A" | "B" | "C";

/** Gewichtete Score-Zusammensetzung, Gesamt 100 (Abschnitt 15). */
export interface ScoreBreakdown {
  total: number;
  wirtschaftlichkeit: number;
  baupotenzial: number;
  markt: number;
  lage: number;
  /** Abzüge durch Risikofaktoren, bereits im Total berücksichtigt. */
  risikoAbzug: number;
}

/** Datenvertrauen — separat vom Score, Gesamt 100 (Abschnitt 16). */
export interface ConfidenceBreakdown {
  total: number;
  adresseParzelle: number;
  zoneBauparameter: number;
  risikenOereb: number;
  mietdaten: number;
  baukosten: number;
  inseratsvollstaendigkeit: number;
  finanzierung: number;
}

/** Ergebnis einer Base- oder Stress-Rechnung (Abschnitt 12–14). */
export interface ScenarioResult {
  noiChf: number;
  cashFlowBeforeTaxChf: number;
  dscr: number;
  cashOnCashPercent: number;
  residualLandValueChf: number;
}

/** Entspricht der Tabelle `analyses` (Abschnitt 24). */
export interface Analysis {
  id: string;
  listingId: string;
  profileVersion: number;
  stage: 1 | 2;
  recommendation: Empfehlung;
  attractivenessScore: ScoreBreakdown;
  dataConfidenceScore: ConfidenceBreakdown;
  hardGate: HardGateResult;
  base: ScenarioResult;
  stress: ScenarioResult;
  maxSinnvollerLandpreisChf: number;
  executiveSummary: string;
  positiveFactors: string[];
  negativeFactors: string[];
  missingData: string[];
  createdAt: string;
}
