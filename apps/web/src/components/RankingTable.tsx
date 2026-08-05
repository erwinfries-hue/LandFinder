"use client";

import {
  ScoreDial,
  EmpfehlungBadge,
  Cell2,
  MapLink,
  SortableTable,
  type Column,
} from "@landfinder/ui";
import { formatChf, type Objekt } from "@/lib/demo-data";

/**
 * Eigene Client-Komponente, weil Spaltendefinitionen Funktionen (render/sortValue)
 * enthalten — die dürfen nicht als Props von einer Server- an eine Client-Komponente
 * übergeben werden. Die Seite selbst bleibt dadurch eine Server-Komponente.
 */
export function RankingTable({ rows }: { rows: Objekt[] }) {
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
      render: (o) => <span className="mono">{o.kanton}</span>,
    },
    {
      key: "score",
      header: "Score",
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
      header: "Vertrauen",
      sortValue: (o) => o.vertrauen,
      render: (o) => <Cell2 top={o.vertrauen} bottom={o.vertrauenLabel} />,
    },
    {
      key: "empf",
      header: "Empfehlung",
      sortValue: (o) => o.empfKlasse,
      render: (o) => <EmpfehlungBadge klasse={o.empfKlasse} wort={o.empfWort} farbe={o.empfFarbe} />,
    },
    {
      key: "flaeche",
      header: "Fläche",
      sortValue: (o) => o.flaecheM2,
      render: (o) => <Cell2 mono top={`${formatChf(o.flaecheM2)} m²`} bottom={`CHF ${formatChf(o.preisProM2)}/m²`} />,
    },
    {
      key: "preis",
      header: "Preis",
      sortValue: (o) => o.preisChf,
      render: (o) => <span className="mono">{formatChf(o.preisChf)}</span>,
    },
    {
      key: "yoc",
      header: (
        <>
          Yield&nbsp;on&nbsp;Cost{" "}
          <span
            className="infoicon"
            title="Nettoertrag (NOI) ÷ Gesamtprojektkosten. Zeigt die Rendite auf die gesamte Investition — unabhängig vom späteren Verkehrswert."
          >
            ⓘ
          </span>
        </>
      ),
      sortValue: (o) => o.yieldOnCost,
      render: (o) => <span className="mono">{o.yieldOnCost.toFixed(1)}%</span>,
    },
    {
      key: "lage",
      header: "Lage",
      sortValue: (o) => `${o.adresse}, ${o.plz} ${o.ort}`.toLowerCase(),
      render: (o) => <MapLink address={`${o.adresse}, ${o.plz} ${o.ort}`} />,
    },
  ];

  return <SortableTable columns={columns} rows={rows} rowKey={(o) => o.slug} />;
}
