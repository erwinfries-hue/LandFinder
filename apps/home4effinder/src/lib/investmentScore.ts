import type { DueDiligenceCategoryResult, DueDiligenceMissingDocument } from "@landfinder/domain";
import type { ChipTone } from "@landfinder/ui";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";

/**
 * Deterministischer Investment-Score (0-100) — bewusst NICHT von Claude geschätzt,
 * sondern aus bereits vorhandenen, selbst berechneten/geprüften Werten zusammengesetzt
 * ("nichts wird erfunden" gilt auch hier: kein LLM darf sich eine Gesamtpunktzahl
 * ausdenken). Drei Komponenten, die addiert 100 ergeben:
 *
 * - **Due-Diligence-Status (0-60)**: pro DD-Kategorie gleich gewichtet, OK = voller
 *   Anteil, KLAERUNGSBEDARF = halber Anteil, RISIKO = null.
 * - **Dokumentenvollständigkeit (0-15)**: Anteil der "ZWINGEND"-Dokumenttypen
 *   (`documentTypes.ts`), die bereits hochgeladen wurden.
 * - **Rendite/Cashflow (0-25)**: aus der Bestandsrendite-Schnellcheck-Berechnung —
 *   Bruttorendite linear zwischen 2% (0 Punkte) und 6% (20 Punkte) skaliert (unterhalb
 *   von 4% gilt eine Bestandswohnung als Buy-to-let gemeinhin als mager, ab 6% als
 *   stark; die Grenzen sind bewusst grosszügig gewählt, keine harte Kaufempfehlung),
 *   plus 5 Punkte, falls der grobe Cashflow nicht negativ ist.
 *
 * Ergibt `undefined`, solange noch keine Due-Diligence-Synthese gelaufen ist — ein
 * Score ohne jede Kategorie-Bewertung wäre irreführend präzise für "noch nicht
 * geprüft", nicht "schlecht bewertet".
 */

export interface InvestmentScoreBreakdown {
  totalScore: number;
  dueDiligenceScore: number;
  documentationScore: number;
  renditeScore: number;
}

const TOTAL_ZWINGEND_TYPES = Object.values(DOCUMENT_TYPE_CATALOG).filter((c) => c.priority === "ZWINGEND").length;

export function computeInvestmentScore(params: {
  categories: DueDiligenceCategoryResult[];
  missingDocuments: DueDiligenceMissingDocument[];
  bruttoRenditePercent: number;
  cashflowChf: number;
}): InvestmentScoreBreakdown | undefined {
  const { categories, missingDocuments, bruttoRenditePercent, cashflowChf } = params;
  if (categories.length === 0) return undefined;

  const perCategoryMax = 60 / categories.length;
  const dueDiligenceScore = categories.reduce((sum, c) => {
    const factor = c.status === "OK" ? 1 : c.status === "KLAERUNGSBEDARF" ? 0.5 : 0;
    return sum + factor * perCategoryMax;
  }, 0);

  const zwingendMissing = missingDocuments.filter((m) => m.priority === "ZWINGEND").length;
  const documentationScore = TOTAL_ZWINGEND_TYPES > 0 ? (Math.max(0, TOTAL_ZWINGEND_TYPES - zwingendMissing) / TOTAL_ZWINGEND_TYPES) * 15 : 15;

  const renditeFactor = Math.max(0, Math.min(1, (bruttoRenditePercent - 2) / 4));
  const renditeScore = renditeFactor * 20 + (cashflowChf >= 0 ? 5 : 0);

  const totalScore = Math.max(0, Math.min(100, Math.round(dueDiligenceScore + documentationScore + renditeScore)));
  return {
    totalScore,
    dueDiligenceScore: Math.round(dueDiligenceScore),
    documentationScore: Math.round(documentationScore),
    renditeScore: Math.round(renditeScore),
  };
}

/**
 * Ampel-Farbe für den Investment-Score — eine gemeinsame Stelle statt in jeder
 * verwendenden Seite neu definiert (Objekt-Detailseite UND Objektliste, siehe
 * DECISIONS.md "Ampelsystem"). Grenzen bewusst grosszügig (siehe computeInvestmentScore),
 * keine harte Kauf-/Ablehnungsempfehlung.
 */
export function scoreTone(totalScore: number): ChipTone {
  if (totalScore >= 70) return "good";
  if (totalScore >= 40) return "warn";
  return "bad";
}

/**
 * Ampel-Farbe für eine einzelne Kennzahl gegenüber ihrem gespeicherten Zielwert
 * (Rückmeldung: "die ampel auch auf der objektdetailseite einbauen, überall dort, wo
 * werte und/oder informationen vom soll abweichen") — bewusst als CSS-Custom-Property
 * statt `ChipTone`, damit sie direkt als `valueColor`/`subColor` auf `Metric` passt statt
 * einen eigenen Chip neben jede Kennzahl zu setzen. Erreicht/übertrifft der Ist-Wert das
 * Ziel: grün. Bis zu 1 Prozentpunkt darunter: gelb (knapp verfehlt). Mehr als 1
 * Prozentpunkt darunter: rot.
 */
export function renditeAmpelColor(istPercent: number, zielPercent: number): string {
  if (istPercent >= zielPercent) return "var(--good)";
  if (istPercent >= zielPercent - 1) return "var(--warn)";
  return "var(--bad)";
}
