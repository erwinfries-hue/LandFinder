import Link from "next/link";
import { Panel, InfoHint } from "@landfinder/ui";
import { Metric } from "@/components/MetricPrimitives";
import { formatChf } from "@/lib/format";
import { estimateQuantilePosition, findClosestQuantileRow, quantileLabel } from "@/lib/regionMarketData";
import type { RegionExtractionResult, RegionQuantileRow } from "@/lib/regionExtraction";

/**
 * Zeigt, wo die erfasste Miete/der Kaufpreis eines Objekts innerhalb der Quantile
 * seiner Gemeinde liegt (Regionsreport, siehe regionMarketData.ts) — rein informativ,
 * verändert keine Berechnung. Nur gerendert, wenn eine Region mit erfolgreich
 * analysiertem Report für die Gemeinde des Objekts existiert (siehe
 * objekte/[id]/page.tsx).
 */

function QuantileMetric({ label, ownValue, row, roomLabel }: { label: string; ownValue: number; row: RegionQuantileRow | undefined; roomLabel: string }) {
  if (!row) return null;
  const position = estimateQuantilePosition(ownValue, row);
  return (
    <Metric
      l={label}
      v={`CHF ${formatChf(Math.round(ownValue))}`}
      sub={`${quantileLabel(position)} der Gemeinde (${roomLabel}) — 50%: CHF ${formatChf(row.q50)}`}
      hint={`Vergleich gegen die 10/30/50/70/90%-Quantile des Regionsreports für ${roomLabel} in dieser Gemeinde. Lineare Interpolation zwischen den Stützpunkten, ausserhalb 10-90% nur als "< 10%" bzw. "> 90%" gekennzeichnet statt extrapoliert.`}
    />
  );
}

export function MarktEinordnungView({
  regionId,
  regionData,
  zimmerzahl,
  mieteChfPerM2PerYear,
  kaufpreisChfPerM2,
}: {
  regionId: string;
  regionData: RegionExtractionResult;
  zimmerzahl: number | undefined;
  mieteChfPerM2PerYear: number;
  kaufpreisChfPerM2: number;
}) {
  const roomLabel = zimmerzahl !== undefined ? `${zimmerzahl}-Zimmer` : "nächstgelegene Zimmerzahl";
  const mieteRow = zimmerzahl !== undefined ? findClosestQuantileRow(regionData.preise.mietwohnungen, zimmerzahl) : undefined;
  const kaufpreisRow = zimmerzahl !== undefined ? findClosestQuantileRow(regionData.preise.eigentumswohnungen, zimmerzahl) : undefined;

  const k = regionData.kennzahlen;

  return (
    <Panel id="markteinordnung" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
      <div className="sectionhead">
        <h2>Markteinordnung — Gemeinde {regionData.gemeinde}</h2>
      </div>
      <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".6rem" }}>
        Vergleich gegen den zuletzt hochgeladenen{" "}
        <Link href={`/regionen/${regionId}`} className="maplink">
          Regionsreport
        </Link>{" "}
        — rein informativ, beeinflusst keine Berechnung auf dieser Seite.
      </p>
      <div className="metricgrid">
        {zimmerzahl !== undefined ? (
          <>
            <QuantileMetric label="Nettomiete/m²/Jahr" ownValue={mieteChfPerM2PerYear} row={mieteRow} roomLabel={roomLabel} />
            <QuantileMetric label="Kaufpreis/m²" ownValue={kaufpreisChfPerM2} row={kaufpreisRow} roomLabel={roomLabel} />
          </>
        ) : (
          <Metric l="Miet-/Preisvergleich" v="—" sub="Zimmerzahl nicht erfasst — für den Quantilvergleich benötigt" />
        )}
        {k.leerstandMehrfamilienhaeuserPercent !== undefined ? (
          <Metric l="Leerstand MFH (Gemeinde)" v={`${k.leerstandMehrfamilienhaeuserPercent}%`} hint="Wohnungsleerstände im Verhältnis zum Bestand, Mehrfamilienhäuser." />
        ) : null}
        {k.mietePreisVeraenderung3JahrePercent !== undefined ? <Metric l="Mietpreis-Trend 3J (Gemeinde)" v={`${k.mietePreisVeraenderung3JahrePercent}%`} /> : null}
        {k.eigentumswohnungPreisVeraenderung3JahrePercent !== undefined ? (
          <Metric l="Kaufpreis-Trend 3J (Gemeinde)" v={`${k.eigentumswohnungPreisVeraenderung3JahrePercent}%`} />
        ) : null}
        {k.bevoelkerungsentwicklung3JahrePercent !== undefined ? <Metric l="Bevölkerungswachstum 3J (Gemeinde)" v={`${k.bevoelkerungsentwicklung3JahrePercent}%`} /> : null}
      </div>
      {regionData.reportDatum ? (
        <p style={{ fontSize: ".74rem", color: "var(--ink-faint)", marginTop: ".7rem", marginBottom: 0 }}>
          Stand Regionsreport: {new Date(regionData.reportDatum).toLocaleDateString("de-CH")}
          <InfoHint text="Marktreports veralten — bei einem älteren Stand ggf. einen aktuelleren Report für diese Gemeinde nachladen." />
        </p>
      ) : null}
    </Panel>
  );
}
