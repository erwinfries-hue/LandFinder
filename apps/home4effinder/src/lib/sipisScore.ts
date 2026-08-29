import type { RegionExtractionResult } from "./regionExtraction";
import { findClosestQuantileRow, estimateQuantilePosition } from "./regionMarketData";
import type { UbsWohnattraktivitaetEintrag, UbsWohnattraktivitaetKategorie } from "./ubsWohnattraktivitaet";
import type { PriceZone } from "./priceStrategy";

/**
 * SIPIS-Deal-Score-Split (Nutzer-Zusatzwunsch zum Auftrag "Advanced Price Strategy &
 * Investment Value Engine", wörtlich: "ein hervorragendes Objekt ist nicht automatisch
 * ein hervorragendes Investment"): statt eines einzigen Gesamtscores drei getrennte
 * Scores, die unterschiedliche Fragen beantworten.
 *
 * Bewusst additiv: der bestehende `computeInvestmentScore` (investmentScore.ts) bleibt
 * UNVERÄNDERT und wird 1:1 als "Investment Score"-Pfeiler übernommen — deckt bereits
 * genau das im Auftrag Verlangte ab (Rendite/Cashflow/Due-Diligence-Risiko), keine
 * parallele Neuimplementierung. Dieses Modul liefert nur die beiden NEUEN Pfeiler.
 *
 * Beide neuen Scores sind Durchschnitte ihrer jeweils VERFÜGBAREN Komponenten —
 * `undefined`, wenn KEINE Komponente verfügbar ist (kein erfundener Wert, dieselbe
 * "nichts wird erfunden"-Konvention wie überall sonst in dieser App).
 */

// ---------------------------------------------------------------------------
// Market Score — Lage, Marktpreis-Position, Markttrend/Exitfähigkeit
// ---------------------------------------------------------------------------

const LAGE_SCORE_BY_KATEGORIE: Record<UbsWohnattraktivitaetKategorie, number> = {
  TOP3: 90, // je nach Rang 1-3 unten noch feinjustiert (+10/+5/+0)
  AGGLOMERATION: 70,
  STEUERGUENSTIG: 65,
  RAND_LAND: 55,
  BEZAHLBARES_KLEINZENTRUM: 50,
};
const TOP3_RANG_BONUS: Record<1 | 2 | 3, number> = { 1: 10, 2: 5, 3: 0 };

/**
 * Eigene 0-100-Skalierung der UBS-Wohnattraktivitätsindikator-Kategorien/-Ränge — KEINE
 * UBS-eigene Zahl (die Mitteilung selbst liefert keine numerischen Scores, siehe
 * ubsWohnattraktivitaet.ts), sondern eine hier transparent dokumentierte Einordnung.
 * `undefined`, wenn kein UBS-Eintrag für die Gemeinde existiert (deckt nur ~48 von
 * ~2000 Gemeinden ab).
 */
export function computeLageScore(eintrag: UbsWohnattraktivitaetEintrag | undefined): number | undefined {
  if (!eintrag) return undefined;
  const basis = LAGE_SCORE_BY_KATEGORIE[eintrag.kategorie];
  return eintrag.kategorie === "TOP3" && eintrag.rangInRegion ? basis + TOP3_RANG_BONUS[eintrag.rangInRegion] : basis;
}

/**
 * Marktpreis-Position innerhalb der Gemeinde-Quantile (dieselbe Quelle/Logik wie die
 * bestehende Kaufpreis-vs-Markt-Ampel, bewertungsAmpel.ts) — günstiger als üblich = hoher
 * Score (gute Exit-/Verhandlungsbasis), teurer = tiefer Score.
 */
export function computeMarktpreisScore(kaufpreisChfPerM2: number | undefined, regionData: RegionExtractionResult | undefined, zimmerzahl: number | undefined): number | undefined {
  if (kaufpreisChfPerM2 === undefined || !regionData || zimmerzahl === undefined) return undefined;
  const row = findClosestQuantileRow(regionData.preise.eigentumswohnungen, zimmerzahl);
  if (!row) return undefined;
  const position = estimateQuantilePosition(kaufpreisChfPerM2, row);
  if (position.kind === "below") return 95;
  if (position.kind === "above") return 15;
  return Math.round(100 - position.percent);
}

/** Markttrend/Exitfähigkeit — 3-Jahres-Kaufpreisveränderung der Gemeinde (Regionsreport), linear auf 0-100 skaliert: 0% = 50 Punkte, +10% = 100, −10% = 0. */
export function computeMarkttrendScore(eigentumswohnungPreisVeraenderung3JahrePercent: number | undefined): number | undefined {
  if (eigentumswohnungPreisVeraenderung3JahrePercent === undefined) return undefined;
  return Math.round(Math.min(100, Math.max(0, 50 + eigentumswohnungPreisVeraenderung3JahrePercent * 5)));
}

export interface MarketScoreBreakdown {
  totalScore: number;
  lageScore: number | undefined;
  marktpreisScore: number | undefined;
  markttrendScore: number | undefined;
}

export function computeMarketScore(params: {
  ubsEintrag: UbsWohnattraktivitaetEintrag | undefined;
  kaufpreisChfPerM2: number | undefined;
  regionData: RegionExtractionResult | undefined;
  zimmerzahl: number | undefined;
}): MarketScoreBreakdown | undefined {
  const lageScore = computeLageScore(params.ubsEintrag);
  const marktpreisScore = computeMarktpreisScore(params.kaufpreisChfPerM2, params.regionData, params.zimmerzahl);
  const markttrendScore = computeMarkttrendScore(params.regionData?.kennzahlen.eigentumswohnungPreisVeraenderung3JahrePercent);

  const verfuegbar = [lageScore, marktpreisScore, markttrendScore].filter((s): s is number => s !== undefined);
  if (verfuegbar.length === 0) return undefined;
  const totalScore = Math.round(verfuegbar.reduce((sum, s) => sum + s, 0) / verfuegbar.length);
  return { totalScore, lageScore, marktpreisScore, markttrendScore };
}

// ---------------------------------------------------------------------------
// Strategic Fit — Preiszonen-Position zur eigenen Zielrendite + Value-Add-Potenzial
// ---------------------------------------------------------------------------

const PRICE_ZONE_FIT_SCORE: Record<PriceZone, number> = {
  EXCEPTIONAL_STRONG_BUY: 100,
  VERY_ATTRACTIVE: 85,
  ATTRACTIVE: 70,
  ACCEPTABLE: 55,
  SELECTIVE_NEGOTIATE: 40,
  TOO_EXPENSIVE: 20,
  REJECT: 0,
};

export interface StrategicFitBreakdown {
  totalScore: number;
  preiszonenScore: number | undefined;
  valueAddScore: number | undefined;
}

/**
 * Strategic Fit beantwortet eine andere Frage als Investment Score (Qualität des Deals
 * an sich) und Market Score (Standort-/Marktqualität unabhängig vom eigenen Ziel): passt
 * der aktuelle Preis + das hier konkret vorhandene Value-Add-Potenzial zur EIGENEN
 * Renditestrategie? `totalValueCreationChf` = Summe der bereits vorhandenen Value-
 * Creation-Beträge (Möblierung/Renovation, siehe priceStrategy.ts::computeValueCreation),
 * als Anteil am Kaufpreis skaliert (5% Value-Add-zu-Kaufpreis-Verhältnis = 100 Punkte).
 */
export function computeStrategicFitScore(params: {
  priceZone: PriceZone | undefined;
  totalValueCreationChf: number | undefined;
  kaufpreisChf: number;
}): StrategicFitBreakdown | undefined {
  const preiszonenScore = params.priceZone !== undefined ? PRICE_ZONE_FIT_SCORE[params.priceZone] : undefined;
  const valueAddScore =
    params.totalValueCreationChf !== undefined && params.kaufpreisChf > 0
      ? Math.round(Math.min(100, Math.max(0, (params.totalValueCreationChf / params.kaufpreisChf) * 100 * 20)))
      : undefined;

  const verfuegbar = [preiszonenScore, valueAddScore].filter((s): s is number => s !== undefined);
  if (verfuegbar.length === 0) return undefined;
  const totalScore = Math.round(verfuegbar.reduce((sum, s) => sum + s, 0) / verfuegbar.length);
  return { totalScore, preiszonenScore, valueAddScore };
}
