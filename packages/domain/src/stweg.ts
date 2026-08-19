/**
 * Strukturierte STWEG-Fakten (Stockwerkeigentümergemeinschaft) — reine Datenhaltung,
 * bewusst OHNE Scoring/Formel: welche STWEG-Kennzahlen als "gut"/"riskant" gelten,
 * ist eine Investitionskriterien-Frage, die noch nicht mit dem Auftraggeber
 * abgestimmt ist (siehe docs/OPEN_DECISIONS.md, Punkt M). Analog zu
 * `ListingVertiefungFacts` (apps/web/src/lib/listingVertiefung.ts) für Bauland: erst
 * Fakten erfassbar machen, Bewertung folgt separat.
 *
 * Diese Felder sind auch die Zielstruktur für eine künftige STWEG-Protokoll-Analyse
 * per LLM (aus dem Masterbriefing: "STWEG-Protokolle, Verkaufsdokumentationen" als
 * KI-Anwendungsfall) — noch nicht gebaut, aber die Datenform steht bereits.
 */
export interface StwegFacts {
  /** Miteigentumsanteil in Promille (z.B. 85/1000) — bestimmt Stimmrecht und Kostenanteil. */
  wertquotePromille?: number;
  erneuerungsfondsSaldoChf?: number;
  /** Vom Protokoll/der Verwaltung genannter Zielwert, falls vorhanden — für sich allein kein "gut/schlecht"-Urteil. */
  erneuerungsfondsZielwertChf?: number;
  naechsteGrossaSanierungGeplant?: boolean;
  naechsteGrossaSanierungNotes?: string;
  /** Freitext statt Kategorien — Sanierungsstau ist selten sauber klassifizierbar ohne das Protokoll selbst gelesen zu haben. */
  sanierungsstauNotes?: string;
  /** Anzahl strittiger/offener Beschlüsse laut letzter Versammlung, falls bekannt. */
  offeneBeschluesseCount?: number;
  /** Freitext, z.B. Rechtsstreitigkeiten zwischen Eigentümern. */
  beschlussrisikenNotes?: string;
  /** Quelle/Datum der Angaben, z.B. "Protokoll ordentliche Versammlung 2026-03-12". */
  quelle?: string;
}
