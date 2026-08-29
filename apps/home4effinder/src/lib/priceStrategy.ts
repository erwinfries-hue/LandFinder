import type { RegionExtractionResult } from "./regionExtraction";
import { findClosestQuantileRow } from "./regionMarketData";

/**
 * "Investment Value & Market Value"-Preisstrategie-Bausteine (Auftrag: "Advanced Price
 * Strategy & Investment Value Engine"). Bewusst ein SCHLANKES neues Modul, weil der
 * grösste Teil der eigentlichen Rechenlogik bereits existiert und hier nur
 * wiederverwendet/kombiniert wird, statt parallel neu gebaut zu werden:
 *
 * - "Investment Value" (Kaufpreis, den NOI/Zielrendite rückwärts noch rechtfertigt) IST
 *   bereits `verhandlungskorridor.nettoZielChf` (bestandsrendite.ts::computeVerhandlungskorridor)
 *   — löst exakt `NOI ÷ All-in-Investition = Nettorenditeziel` per Bisektion. Kein Alias/
 *   keine neue Funktion hier, Aufrufer verwenden den bestehenden Wert direkt.
 * - "Economic Target"/"Opening Bid"/"Walk-Away" SIND bereits
 *   `strengsteZielgroesse(verhandlungskorridor)` / `verhandlungskorridor.eroeffnungChf` /
 *   `verhandlungskorridor.maximumChf`.
 * - "Price Gap" IST bereits die generische `verhandlungskorridorRelation(punktChf, basisChf)`.
 *
 * Neu ist nur, was es so noch nicht gab: eine CHF-Marktwert-BANDBREITE (nicht nur der
 * einzelne Median-Punkt aus PR "Markt-Median-Kaufpreis als Referenzpunkt") mit
 * Confidence-Einstufung, sowie zwei zusätzliche, einfachere Cash-on-Cash-Kennzahlen VOR
 * Steuer/Reserven (die bestehende `investmentCase.cashOnCashPercent` rechnet NACH
 * Steuer/Reparatur-/Leerstandsreserve — bewusst NICHT ersetzt, siehe DECISIONS.md).
 */

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface MarketValueRange {
  lowChf: number;
  baseChf: number;
  highChf: number;
  confidence: ConfidenceLevel;
  confidenceReason: string;
}

const MAX_REPORT_AGE_YEARS_FOR_HIGH_CONFIDENCE = 2;

/**
 * Marktwert-Bandbreite aus dem Regionsreport (Wüest-Partner-Standortinformation, siehe
 * regionMarketData.ts) — dieselbe Datenquelle wie die bestehende Kaufpreis-vs-Markt-Ampel
 * und der Markt-Median-Referenzpunkt im Verhandlungskorridor, hier zu einem CHF-Bereich
 * statt nur einem Einzelwert aufbereitet. Low/High bewusst auf dem 30%/70%-Quantil
 * (nicht 10%/90%) — das ist die "typische" Marktspanne, die 10/90%-Ausreisser bleiben
 * bewusst aussen vor (dieselbe Überlegung wie bei `estimateQuantilePosition`s
 * Nicht-Extrapolation ausserhalb 10-90%: eine Bandbreite bis zu den Extremquantilen wäre
 * für eine Kaufpreiseinschätzung zu breit, um noch aussagekräftig zu sein).
 *
 * `undefined`, wenn keine Zimmerzahl erfasst ist, die Wohnfläche 0/negativ ist, oder der
 * Regionsreport keine Eigentumswohnungs-Preiszeile enthält — kein erfundener Wert.
 */
export function computeMarketValueRange(
  regionData: RegionExtractionResult,
  zimmerzahl: number | undefined,
  wohnflaecheM2: number,
): MarketValueRange | undefined {
  if (zimmerzahl === undefined || wohnflaecheM2 <= 0) return undefined;
  const row = findClosestQuantileRow(regionData.preise.eigentumswohnungen, zimmerzahl);
  if (!row) return undefined;

  const exactZimmerzahlMatch = row.zimmerzahl === zimmerzahl;
  const reportAgeYears = regionData.reportDatum ? (Date.now() - new Date(regionData.reportDatum).getTime()) / (365.25 * 24 * 3600 * 1000) : undefined;
  const reportRecent = reportAgeYears === undefined || reportAgeYears <= MAX_REPORT_AGE_YEARS_FOR_HIGH_CONFIDENCE;
  const standHinweis = regionData.reportDatum ? `, Stand ${regionData.reportDatum}` : " (Berichtsdatum nicht erkannt)";

  let confidence: ConfidenceLevel;
  let confidenceReason: string;
  if (exactZimmerzahlMatch && reportRecent) {
    confidence = "HIGH";
    confidenceReason = `Regionsreport mit exakter ${zimmerzahl}-Zimmer-Zeile${standHinweis}.`;
  } else if (exactZimmerzahlMatch) {
    confidence = "MEDIUM";
    confidenceReason = `Regionsreport mit exakter ${zimmerzahl}-Zimmer-Zeile, aber Berichtsstand ${regionData.reportDatum} älter als ${MAX_REPORT_AGE_YEARS_FOR_HIGH_CONFIDENCE} Jahre.`;
  } else if (reportRecent) {
    confidence = "MEDIUM";
    confidenceReason = `Regionsreport ohne exakte ${zimmerzahl}-Zimmer-Zeile — nächstgelegene Zeile (${row.zimmerzahl}-Zimmer) verwendet${standHinweis}.`;
  } else {
    confidence = "LOW";
    confidenceReason = `Regionsreport ohne exakte ${zimmerzahl}-Zimmer-Zeile UND Berichtsstand ${regionData.reportDatum} älter als ${MAX_REPORT_AGE_YEARS_FOR_HIGH_CONFIDENCE} Jahre — nächstgelegene Zeile (${row.zimmerzahl}-Zimmer) verwendet.`;
  }

  return {
    lowChf: row.q30 * wohnflaecheM2,
    baseChf: row.q50 * wohnflaecheM2,
    highChf: row.q70 * wohnflaecheM2,
    confidence,
    confidenceReason,
  };
}

/**
 * 7-stufige Preisampel (Auftrag: "die Preisampel darf nicht aus statischen Prozentwerten
 * zum Angebotspreis entstehen. Sie soll primär aus Investment Value, Market Value,
 * Nutzerhürde und Finanzierung abgeleitet werden") — bewusst NICHT aus dem Marktwert
 * abgeleitet (Guardrail: "Strong Buy != günstiger als Markt. Ein Strong Buy muss
 * wirtschaftlich attraktiv sein"), sondern ausschliesslich aus den beiden bereits
 * vorhandenen finanziellen Ankerpunkten:
 *
 * - Untere Grenze: die strengere der beiden Renditeziel-Grenzen
 *   (`strengsteZielgroesse`/"Economic Target"/"Investment Value"-Nachbarschaft) — ab hier
 *   erreicht der Deal das eigene Renditeziel.
 * - Obere Grenze: `maximumChf`/"Walk-Away Price" — die reine Cashflow-Solvenzgrenze, in
 *   der bereits die Finanzierungskonditionen (Belehnung/Zins/Amortisation) stecken.
 *
 * Der Marktwert bleibt bewusst aussen vor — er fliesst stattdessen in die separate,
 * regelbasierte Interpretation im Preisstrategie-Panel ein (siehe
 * BestandsrenditeAnalysisView.tsx), nicht in die Zonen-Grenzen selbst. Die fünf mittleren
 * Zonen sind gleich breite CHF-Bänder zwischen den beiden Ankern.
 */
export type PriceZone = "EXCEPTIONAL_STRONG_BUY" | "VERY_ATTRACTIVE" | "ATTRACTIVE" | "ACCEPTABLE" | "SELECTIVE_NEGOTIATE" | "TOO_EXPENSIVE" | "REJECT";

export interface PriceZoneBand {
  zone: PriceZone;
  label: string;
  /** `undefined` = keine Untergrenze (offen nach unten). */
  lowChf: number | undefined;
  /** `undefined` = keine Obergrenze (offen nach oben). Inklusive Untergrenze, exklusive Obergrenze (siehe `classifyPriceZone`). */
  highChf: number | undefined;
}

const PRICE_ZONE_LABELS: Record<PriceZone, string> = {
  EXCEPTIONAL_STRONG_BUY: "Exceptional / Strong Buy",
  VERY_ATTRACTIVE: "Very Attractive",
  ATTRACTIVE: "Attractive",
  ACCEPTABLE: "Acceptable",
  SELECTIVE_NEGOTIATE: "Selective / Negotiate",
  TOO_EXPENSIVE: "Too Expensive",
  REJECT: "Reject",
};

/**
 * Fünf gleich breite CHF-Bänder zwischen `realistischesZielChf` (Economic Target) und
 * `maximumChf` (Walk-Away Price), umrahmt von den beiden offenen Randzonen. `undefined`,
 * wenn `realistischesZielChf >= maximumChf` (kein sinnvoller Zwischenraum — z.B. wenn das
 * Renditeziel bereits die Solvenzgrenze erreicht/überschreitet).
 */
export function computePriceZones(realistischesZielChf: number, maximumChf: number): PriceZoneBand[] | undefined {
  if (realistischesZielChf >= maximumChf) return undefined;
  const spanChf = maximumChf - realistischesZielChf;
  const step = spanChf / 5;
  const bounds = [0, 1, 2, 3, 4, 5].map((i) => realistischesZielChf + i * step);

  const zonesInOrder: PriceZone[] = ["EXCEPTIONAL_STRONG_BUY", "VERY_ATTRACTIVE", "ATTRACTIVE", "ACCEPTABLE", "SELECTIVE_NEGOTIATE", "TOO_EXPENSIVE", "REJECT"];
  return zonesInOrder.map((zone, i) => ({
    zone,
    label: PRICE_ZONE_LABELS[zone],
    lowChf: i === 0 ? undefined : bounds[i - 1],
    highChf: i === zonesInOrder.length - 1 ? undefined : bounds[i],
  }));
}

/** Ordnet einen Kaufpreis der passenden Zone zu — inklusive Untergrenze, exklusive Obergrenze. Fällt auf die letzte Zone (REJECT) zurück, falls (durch Rundungsfehler) keine Zone exakt passt. */
export function classifyPriceZone(priceChf: number, bands: PriceZoneBand[]): PriceZoneBand {
  for (const band of bands) {
    const aboveLow = band.lowChf === undefined || priceChf >= band.lowChf;
    const belowHigh = band.highChf === undefined || priceChf < band.highChf;
    if (aboveLow && belowHigh) return band;
  }
  return bands[bands.length - 1];
}

/** Ampel-Ton je Preiszone — dieselbe 3-Ton-Konvention wie überall sonst in der App (Chip/AmpelStatus). */
export function priceZoneTone(zone: PriceZone): "good" | "warn" | "bad" {
  if (zone === "EXCEPTIONAL_STRONG_BUY" || zone === "VERY_ATTRACTIVE" || zone === "ATTRACTIVE") return "good";
  if (zone === "ACCEPTABLE" || zone === "SELECTIVE_NEGOTIATE") return "warn";
  return "bad";
}

export interface CashOnCashBreakdown {
  /** = (NOI − Zins) ÷ Eigenkapital × 100 — vor Amortisation, Steuer und Reparatur-/Leerstandsreserve. */
  preAmortizationPercent: number;
  /** = (NOI − Zins − Amortisation) ÷ Eigenkapital × 100 — nach Amortisation, weiterhin vor Steuer und Reparatur-/Leerstandsreserve. */
  postAmortizationPercent: number;
}

/**
 * Zwei zusätzliche, einfachere Cash-on-Cash-Kennzahlen — ergänzend zur bestehenden
 * `investmentCase.cashOnCashPercent` (die zusätzlich Steuer und Reparatur-/
 * Leerstandsreserve abzieht, also die konservativere/vollständigere Grösse ist). Beide
 * Varianten bleiben nebeneinander sichtbar statt eine zu ersetzen — unterschiedliche
 * Aussagen, keine "richtigere" Zahl. `undefined`, wenn kein Eigenkapital eingesetzt wird
 * (Division durch 0/negativ wäre nicht aussagekräftig, siehe bestehendes Muster bei
 * `cashOnCashPercent` selbst in `calculateInvestmentCase`).
 */
export function computeCashOnCashBreakdown(
  wasserfall: { cashflowNachZinsChf: number; cashflowNachAmortisationChf: number },
  eigenkapitalChf: number,
): CashOnCashBreakdown | undefined {
  if (eigenkapitalChf <= 0) return undefined;
  return {
    preAmortizationPercent: (wasserfall.cashflowNachZinsChf / eigenkapitalChf) * 100,
    postAmortizationPercent: (wasserfall.cashflowNachAmortisationChf / eigenkapitalChf) * 100,
  };
}
