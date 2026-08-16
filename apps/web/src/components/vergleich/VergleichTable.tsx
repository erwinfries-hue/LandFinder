"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { EMPFEHLUNG_LABEL, type Empfehlung } from "@landfinder/domain";
import { computeComparisonMetrics, rankAndCompare, type ComparisonEntry, type ValueChange } from "@landfinder/comparison-engine";
import { Chip, SortableTable, type Column, type ChipTone } from "@landfinder/ui";
import { getSearchProfileServerSnapshot, getSearchProfileSnapshot, subscribeSearchProfile } from "@/lib/searchProfile";
import { getAnnahmenServerSnapshot, getAnnahmenSnapshot, subscribeAnnahmen } from "@/lib/annahmen";
import { computeListingAnalysis } from "@/lib/objektAnalysis";
import type { ListingAnalysisInput, ListingVertiefungFacts } from "@/lib/listingVertiefung";
import { formatChf } from "@/lib/demo-data";

const EMPFEHLUNG_TONE: Record<Empfehlung, ChipTone> = {
  SOFORT_PRUEFEN: "good",
  POTENZIAL_DRINGEND_VERIFIZIEREN: "accent",
  WEITERVERFOLGEN: "accent",
  BEOBACHTEN_VERHANDELN: "warn",
  NICHT_WEITERVERFOLGEN: "bad",
  UNGENUEGENDE_DATEN: "bad",
};

export interface VergleichEntry {
  id: string;
  title: string;
  addressText: string | null;
  source: string;
  canton: string;
  listing: ListingAnalysisInput;
  facts: ListingVertiefungFacts;
  /** `null`, wenn für dieses Inserat noch keine zwei Preis-Historie-Einträge vorliegen (Migration 0008). */
  priceChange: ValueChange | null;
}

interface Row {
  entry: VergleichEntry;
  score: number;
  confidence: number;
  empfehlung: Empfehlung;
  yieldOnCostPercent: number;
  pricePerM2LandChf: number;
  equityRequiredChf: number;
  overallRank: number;
  overallCount: number;
  cantonRank: number;
  cantonCount: number;
}

/**
 * Rollender Vergleich (Abschnitt 20) über alle vertieften echten Inserate — das
 * Pendant zu ListingLiveAnalysis.tsx, aber als Übersichtstabelle statt Einzelansicht.
 * Rechnet bei jeder Suchprofil-/Annahmen-Änderung live neu durch dieselbe Engine.
 */
export function VergleichTable({ entries }: { entries: VergleichEntry[] }) {
  const profile = useSyncExternalStore(subscribeSearchProfile, getSearchProfileSnapshot, getSearchProfileServerSnapshot);
  const overrides = useSyncExternalStore(subscribeAnnahmen, getAnnahmenSnapshot, getAnnahmenServerSnapshot);

  const analyses = entries.map((entry) => ({ entry, a: computeListingAnalysis(profile, overrides, entry.listing, entry.facts) }));

  const comparisonEntries: ComparisonEntry[] = analyses.map(({ entry, a }) => ({
    listingId: entry.id,
    canton: entry.canton,
    metrics: computeComparisonMetrics({
      scoreTotal: a.score.total,
      dataConfidenceTotal: a.confidence.total,
      askingPriceChf: entry.listing.askingPriceChf,
      parcelAreaM2: entry.listing.parcelAreaM2,
      achievedNraM2: a.baupotenzial.adjustedNraM2,
      totalDevelopmentCostChf: a.base.totalDevelopmentCostChf,
      noiChf: a.base.noiChf,
      residualLandValueChf: a.wert.residualLandValueChf,
      equityRequiredChf: a.base.equityRequiredChf,
    }),
  }));
  const ranking = rankAndCompare(comparisonEntries);
  const rankingById = new Map(ranking.map((r) => [r.listingId, r]));

  const rows: Row[] = analyses.flatMap(({ entry, a }) => {
    const r = rankingById.get(entry.id);
    if (!r) return [];
    return [
      {
        entry,
        score: a.score.total,
        confidence: a.confidence.total,
        empfehlung: a.empfehlung,
        yieldOnCostPercent: a.yieldOnCostPercent,
        pricePerM2LandChf: entry.listing.askingPriceChf / entry.listing.parcelAreaM2,
        equityRequiredChf: a.base.equityRequiredChf,
        overallRank: r.overallRank,
        overallCount: r.overallCount,
        cantonRank: r.cantonRank,
        cantonCount: r.cantonCount,
      },
    ];
  });

  const columns: Column<Row>[] = [
    {
      key: "rang",
      header: "Rang",
      sortValue: (row) => row.overallRank,
      render: (row) => (
        <span className="mono">
          {row.overallRank} / {row.overallCount}
        </span>
      ),
    },
    {
      key: "objekt",
      header: "Objekt",
      align: "left",
      sortValue: (row) => row.entry.title.toLowerCase(),
      render: (row) => (
        <Link href={`/quellen/${row.entry.id}`} className="objcell objcell-narrow" style={{ display: "block" }} title={row.entry.title}>
          <div className="m">{row.entry.title}</div>
          <div className="g">
            {row.entry.source} · {row.entry.addressText ?? row.entry.canton}
          </div>
        </Link>
      ),
    },
    {
      key: "kanton",
      header: "Kanton",
      align: "left",
      sortValue: (row) => row.entry.canton,
      render: (row) => (
        <span className="mono">
          {row.entry.canton} <span style={{ color: "var(--ink-faint)" }}>({row.cantonRank}/{row.cantonCount})</span>
        </span>
      ),
    },
    {
      key: "score",
      header: "Score",
      sortValue: (row) => row.score,
      render: (row) => <span className="mono">{Math.round(row.score)}</span>,
    },
    {
      key: "vertrauen",
      header: "Vertrauen",
      sortValue: (row) => row.confidence,
      render: (row) => <span className="mono">{Math.round(row.confidence)}</span>,
    },
    {
      key: "empfehlung",
      header: "Empfehlung",
      align: "left",
      sortValue: (row) => row.empfehlung,
      render: (row) => <Chip tone={EMPFEHLUNG_TONE[row.empfehlung]}>{EMPFEHLUNG_LABEL[row.empfehlung]}</Chip>,
    },
    {
      key: "yield",
      header: "Yield on Cost",
      sortValue: (row) => row.yieldOnCostPercent,
      render: (row) => (
        <span className="mono" style={{ color: row.yieldOnCostPercent >= profile.renditeziele.minYieldOnCostPercent ? "var(--good)" : "var(--bad)" }}>
          {row.yieldOnCostPercent.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "preisM2",
      header: "CHF/m² Land",
      sortValue: (row) => row.pricePerM2LandChf,
      render: (row) => <span className="num mono">{formatChf(Math.round(row.pricePerM2LandChf))}</span>,
    },
    {
      key: "preisaenderung",
      header: "Preisänderung",
      sortValue: (row) => row.entry.priceChange?.deltaPercent ?? 0,
      render: (row) => {
        const c = row.entry.priceChange;
        if (!c || c.deltaAbsolute === 0) return <span style={{ color: "var(--ink-faint)" }}>—</span>;
        const down = c.deltaAbsolute < 0;
        return (
          <span className="mono" style={{ color: down ? "var(--good)" : "var(--bad)" }}>
            {down ? "" : "+"}
            {c.deltaPercent.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: "eigenkapital",
      header: "Eigenkapital",
      sortValue: (row) => row.equityRequiredChf,
      render: (row) => <span className="num mono">CHF {formatChf(Math.round(row.equityRequiredChf))}</span>,
    },
  ];

  return <SortableTable columns={columns} rows={rows} rowKey={(row) => row.entry.id} wrapClassName="twrap scroll-y" />;
}
