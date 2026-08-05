/**
 * Kantonscode als offener String, nicht als geschlossene Union: Die tatsächliche,
 * editierbare Liste lebt in `config/regions.json` (Abschnitt 1.1 — weitere Kantone
 * müssen ohne Codeänderung ergänzt werden können). Validierung erfolgt zur Laufzeit
 * gegen diese Konfigurationsdatei, nicht über das Typsystem.
 */
export type KantonCode = string;

/** ÖV-Güteklasse gemäss ARE, A = sehr gut erschlossen. */
export type OevGueteklasse = "A" | "B" | "C" | "D";

export interface Coordinates {
  lat: number;
  lon: number;
}
