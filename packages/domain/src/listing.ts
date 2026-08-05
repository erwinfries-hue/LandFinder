import type { Coordinates, KantonCode } from "./geography";

/** Objektarten im MVP-Scope (Abschnitt 1.3) — bewusst nicht erweitert. */
export type Objektart = "BAULAND" | "ABBRUCHOBJEKT";

export type ListingSource =
  | "HOMEGATE"
  | "IMMOSCOUT24"
  | "NEWHOME"
  | "EMAIL_IMPORT"
  | "MANUAL_URL"
  | "MANUAL_UPLOAD"
  | "MANUAL_ENTRY";

/**
 * Fehler-/Verarbeitungsstatus eines Inserats (Abschnitt 5.7 / 26).
 * Teilinformationen erlauben eine Analyse, senken aber das Datenvertrauen — es werden
 * nie Werte erfunden, um eine Lücke zu füllen.
 */
export type IngestionStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "BLOCKED"
  | "NOT_AVAILABLE"
  | "INVALID"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "MANUAL_INPUT_REQUIRED";

export type ListingStatus =
  | "NEW"
  | "STAGE_1_COMPLETE"
  | "STAGE_2_COMPLETE"
  | "MANUAL_INPUT_REQUIRED"
  | "REJECTED_BY_RULE"
  | "ARCHIVED";

/** Entspricht der Tabelle `listings` (Abschnitt 24). */
export interface Listing {
  id: string;
  canonicalKey: string;
  source: ListingSource;
  sourceListingId?: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  objectType: Objektart;
  addressText?: string;
  canton?: KantonCode;
  municipality?: string;
  municipalityBfsId?: string;
  coordinates?: Coordinates;
  parcelNumber?: string;
  egrid?: string;
  askingPriceChf?: number;
  parcelAreaM2?: number;
  existingBuilding?: boolean;
  knownZone?: string;
  erschliessung?: boolean;
  baurecht?: boolean;
  broker?: string;
  publishedAt?: string;
  status: ListingStatus;
  ingestionStatus: IngestionStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  active: boolean;
}

export type ExtractionMethod =
  | "JSON_LD"
  | "SCHEMA_ORG"
  | "OPEN_GRAPH"
  | "STRUCTURED_HTML"
  | "MAIN_TEXT"
  | "PORTAL_ADAPTER"
  | "PLAYWRIGHT"
  | "LLM"
  | "USER_INPUT";

/**
 * Einzelnes extrahiertes Feld mit Beleg (Abschnitt 4.3 / 5.6 / 24, Tabelle `extracted_fields`).
 * Jedes Feld trägt Wert, Quelle, Methode, Konfidenz, Originaltextbeleg und Bestätigungsstatus.
 */
export interface ExtractedField<T = unknown> {
  listingId: string;
  fieldKey: string;
  value: T;
  sourceMethod: ExtractionMethod;
  sourceExcerpt?: string;
  confidence: number;
  userConfirmed: boolean;
}
