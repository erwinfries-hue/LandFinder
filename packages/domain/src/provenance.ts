/**
 * Herkunft eines Datenpunkts (Abschnitt 8 des Masterdokuments).
 * Jede Zahl im System muss auf eine dieser Quellen zurückführbar sein — keine Zahl ohne Herkunft.
 */
export type DataPointSource =
  | "OFFICIAL_AUTOMATED"
  | "LICENSED_WUEST"
  | "LISTING_EXTRACTED"
  | "USER_CONFIRMED"
  | "USER_ASSUMPTION"
  | "MODEL_ESTIMATE"
  | "LLM_EXTRACTED_UNVERIFIED"
  | "EXTERNAL_EXPERT_CONFIRMED";

export type GeographicLevel = "PARCEL" | "MUNICIPALITY" | "DISTRICT" | "CANTON" | "NATIONAL";

/**
 * Ein einzelner Datenpunkt mit vollständiger Provenienz (Abschnitt 8, Tabelle `data_points`).
 * `T` ist meist `number`, kann aber auch string/boolean/Objekt sein (z.B. eine Zone).
 */
export interface DataPoint<T = number> {
  value: T;
  unit?: string;
  geographicLevel?: GeographicLevel;
  source: DataPointSource;
  sourceName?: string;
  sourceReference?: string;
  /** Datenstand beim Ursprungsanbieter (z.B. Publikationsdatum eines Berichts). */
  observationDate?: string;
  /** Wann dieser Datenpunkt ins System übernommen wurde. */
  fetchedAt: string;
  /** 0–100. */
  confidence: number;
  verified: boolean;
  validUntil?: string;
  note?: string;
}

export type ConfidenceLevel = "hoch" | "mittel" | "tief" | "sehr tief";

/** Klassifikation gemäss Abschnitt 16: 80–100 hoch, 60–79 mittel, 40–59 tief, <40 sehr tief. */
export function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 80) return "hoch";
  if (score >= 60) return "mittel";
  if (score >= 40) return "tief";
  return "sehr tief";
}
