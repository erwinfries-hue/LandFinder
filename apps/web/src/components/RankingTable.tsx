"use client";

import { useRouter } from "next/navigation";
import {
  ScoreDial,
  EmpfehlungBadge,
  Cell2,
  MapLink,
  SortableTable,
  InfoHint,
  type Column,
} from "@landfinder/ui";
import { formatChf, formatDate, type Objekt } from "@/lib/demo-data";
import { METRIC_HINTS } from "@/lib/metricHints";

/**
 * Eigene Client-Komponente, weil Spaltendefinitionen Funktionen (render/sortValue)
 * enthalten — die dürfen nicht als Props von einer Server- an eine Client-Komponente
 * übergeben werden. Die Seite selbst bleibt dadurch eine Server-Komponente.
 */
export function RankingTable({ rows }: { rows: Objekt[] }) {
  const router = useRouter();
  const columns: Column<Objekt>[] = [
    {
      key: "rank",
      header: "Rang",
      sortValue: (o) => rows.indexOf(o) + 1,
      render: (o) => <span className="mono">{rows.indexOf(o) + 1}</span>,
    },
    {
      key: "obj",
      header: "Objekt",
      align: "left",
      sortValue: (o) => `${o.adresse}, ${o.ort} ${o.kanton}`.toLowerCase(),
      render: (o) => (
        <div className="objcell">
          <div className="m">
            {o.adresse}, {o.ort} {o.kanton}
          </div>
          <div className="g">
            {o.objektart} · Parzelle {o.parzelle}
          </div>
        </div>
      ),
    },
    {
      key: "kanton",
      header: "Kanton",
      sortValue: (o) => o.kanton,
      render: (o) => (
        <Cell2 mono top={o.kanton} bottom={<MapLink address={`${o.adresse}, ${o.plz} ${o.ort}`} label="Lage" />} />
      ),
    },
    {
      key: "score",
      header: (
        <>
          Score <InfoHint text={METRIC_HINTS.score} />
        </>
      ),
      sortValue: (o) => o.score,
      render: (o) => (
        <span className="dial">
          <ScoreDial value={o.score} tone={o.scoreTon} />
          <span className="val">{o.score}</span>
        </span>
      ),
    },
    {
      key: "vertrauen",
      header: (
        <>
          Vertrauen <InfoHint text={METRIC_HINTS.vertrauen} />
        </>
      ),
      sortValue: (o) => o.vertrauen,
      render: (o) => <Cell2 top={o.vertrauen} bottom={o.vertrauenLabel} />,
    },
    {
      key: "empf",
      header: (
        <>
          Empfehlung <InfoHint text={METRIC_HINTS.empfehlung} />
        </>
      ),
      sortValue: (o) => o.empfKlasse,
      render: (o) => <EmpfehlungBadge klasse={o.empfKlasse} wort={o.empfWort} farbe={o.empfFarbe} />,
    },
    {
      key: "flaeche",
      header: (
        <>
          Fläche <InfoHint text={METRIC_HINTS.flaeche} />
        </>
      ),
      sortValue: (o) => o.flaecheM2,
      render: (o) => <Cell2 mono top={`${formatChf(o.flaecheM2)} m²`} bottom={`CHF ${formatChf(o.preisProM2)}/m²`} />,
    },
    {
      key: "preis",
      header: (
        <>
          Preis <InfoHint text={METRIC_HINTS.preis} />
        </>
      ),
      sortValue: (o) => o.preisChf,
      render: (o) => <span className="mono">{formatChf(o.preisChf)}</span>,
    },
    {
      key: "yoc",
      header: (
        <>
          YoC <InfoHint text={METRIC_HINTS.yieldOnCost} />
        </>
      ),
      sortValue: (o) => o.yieldOnCost,
      render: (o) => <span className="mono">{o.yieldOnCost.toFixed(1)}%</span>,
    },
    {
      key: "erfasstAm",
      header: "Erfasst am",
      sortValue: (o) => o.erfasstAm,
      render: (o) => <span className="mono">{formatDate(o.erfasstAm)}</span>,
    },
  ];

  return (
    <SortableTable
      columns={columns}
      rows={rows}
      rowKey={(o) => o.slug}
      onRowClick={(o) => router.push(`/objekte/${o.slug}`)}
    />
  );
}
