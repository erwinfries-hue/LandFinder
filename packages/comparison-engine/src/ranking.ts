import type { KantonCode } from "@landfinder/domain";
import { METRIC_DIRECTION, type ComparisonMetrics } from "./metrics";

export interface ComparisonEntry {
  listingId: string;
  canton: KantonCode;
  metrics: ComparisonMetrics;
}

export interface MetricStanding {
  metric: keyof ComparisonMetrics;
  /** 0–100 innerhalb der Kantons-Vergleichsgruppe, höher = besser (unabhängig von der Richtung der Kennzahl). */
  percentile: number;
  deltaFromMedianPercent: number;
}

export interface VsTopObject {
  topListingId: string;
  scoreDeltaPoints: number;
  yieldOnCostDeltaPercent: number;
}

/** Entspricht der Tabelle `comparisons` (Abschnitt 24) für ein Objekt. */
export interface ComparisonResult {
  listingId: string;
  /** Rang unter allen aktiven Objekten, unabhängig vom Kanton. */
  overallRank: number;
  overallCount: number;
  /** Rang unter den aktiven Objekten im gleichen Kanton (Abschnitt 20, Vergleichsscope). */
  cantonRank: number;
  cantonCount: number;
  percentile: number;
  vsTopObject: VsTopObject;
  biggestAdvantage: MetricStanding;
  biggestDisadvantage: MetricStanding;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const METRIC_KEYS = Object.keys(METRIC_DIRECTION) as (keyof ComparisonMetrics)[];

function metricStanding(entry: ComparisonEntry, group: ComparisonEntry[], metric: keyof ComparisonMetrics): MetricStanding {
  const values = group.map((e) => e.metrics[metric]);
  const value = entry.metrics[metric];
  const direction = METRIC_DIRECTION[metric];

  const better = values.filter((v) => (direction === "higher_is_better" ? value >= v : value <= v)).length;
  const percentile = values.length > 1 ? ((better - 1) / (values.length - 1)) * 100 : 100;

  const med = median(values);
  const deltaFromMedianPercent = med !== 0 ? ((value - med) / Math.abs(med)) * 100 : 0;

  return { metric, percentile, deltaFromMedianPercent };
}

/**
 * Rollender Vergleich (Abschnitt 20): Gesamtrang über alle aktiven Objekte, plus
 * Kantonsrang/Perzentil/Top-Objekt-Vergleich/Vor-Nachteil innerhalb der
 * Kantons-Vergleichsgruppe (nur aktive Objekte im gleichen Kanton).
 */
export function rankAndCompare(entries: ComparisonEntry[]): ComparisonResult[] {
  if (entries.length === 0) return [];

  const byOverallScore = [...entries].sort((a, b) => b.metrics.scoreTotal - a.metrics.scoreTotal);
  const overallRankOf = new Map<string, number>();
  byOverallScore.forEach((e, i) => overallRankOf.set(e.listingId, i + 1));

  const groups = new Map<KantonCode, ComparisonEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.canton) ?? [];
    group.push(entry);
    groups.set(entry.canton, group);
  }

  const results: ComparisonResult[] = [];

  for (const group of groups.values()) {
    const sortedByScore = [...group].sort((a, b) => b.metrics.scoreTotal - a.metrics.scoreTotal);
    const cantonCount = sortedByScore.length;
    const top = sortedByScore[0];

    sortedByScore.forEach((entry, index) => {
      const cantonRank = index + 1;
      const percentile = cantonCount > 1 ? ((cantonCount - cantonRank) / (cantonCount - 1)) * 100 : 100;

      const standings = METRIC_KEYS.map((metric) => metricStanding(entry, group, metric));
      const biggestAdvantage = standings.reduce((best, s) => (s.percentile > best.percentile ? s : best));
      const biggestDisadvantage = standings.reduce((worst, s) => (s.percentile < worst.percentile ? s : worst));

      results.push({
        listingId: entry.listingId,
        overallRank: overallRankOf.get(entry.listingId)!,
        overallCount: entries.length,
        cantonRank,
        cantonCount,
        percentile,
        vsTopObject: {
          topListingId: top.listingId,
          scoreDeltaPoints: entry.metrics.scoreTotal - top.metrics.scoreTotal,
          yieldOnCostDeltaPercent: entry.metrics.yieldOnCostPercent - top.metrics.yieldOnCostPercent,
        },
        biggestAdvantage,
        biggestDisadvantage,
      });
    });
  }

  return results;
}
