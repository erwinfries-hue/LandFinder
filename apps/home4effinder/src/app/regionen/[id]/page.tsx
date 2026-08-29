import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel, Chip } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { DeleteRegionDocumentButton } from "@/components/DeleteRegionDocumentButton";
import { DeleteRegionButton } from "@/components/DeleteRegionButton";
import { RegionDocumentReanalyzeButton } from "@/components/RegionDocumentReanalyzeButton";
import { RegionKennzahlenView } from "@/components/RegionKennzahlenView";
import { getRegionById, getRegionDocuments } from "@/lib/regionMarketData";
import { formatDateTime } from "@/lib/properties";
import { formatChf } from "@/lib/format";
import { AVAILABLE_CANTONS } from "@/lib/cantons";
import type { RegionQuantileRow } from "@/lib/regionExtraction";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { PENDING: "Wird analysiert…", DONE: "Analysiert", FAILED: "Analyse fehlgeschlagen" };
const STATUS_TONE: Record<string, "neutral" | "good" | "bad"> = { PENDING: "neutral", DONE: "good", FAILED: "bad" };

function QuantileTable({ title, rows, unit }: { title: string; rows: RegionQuantileRow[]; unit: string }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="eyebrow">
        {title} ({unit})
      </div>
      <div className="twrap">
        <table style={{ marginTop: ".5rem" }}>
          <thead>
            <tr>
              <th>Zimmer</th>
              <th className="num">10%</th>
              <th className="num">30%</th>
              <th className="num">50%</th>
              <th className="num">70%</th>
              <th className="num">90%</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => a.zimmerzahl - b.zimmerzahl)
              .map((row) => (
                <tr key={row.zimmerzahl}>
                  <td>{row.zimmerzahl}</td>
                  <td className="num mono">{formatChf(row.q10)}</td>
                  <td className="num mono">{formatChf(row.q30)}</td>
                  <td className="num mono">{formatChf(row.q50)}</td>
                  <td className="num mono">{formatChf(row.q70)}</td>
                  <td className="num mono">{formatChf(row.q90)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function RegionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const region = await getRegionById(id);
  if (region === null) notFound();

  if (region === undefined) {
    return (
      <div className="shell">
        <SideNav current="regionen" />
        <main className="main">
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert — daher lässt sich diese Region nicht anzeigen.
            </p>
          </Panel>
        </main>
      </div>
    );
  }

  const documents = await getRegionDocuments(region.id);
  // Neuester erfolgreich analysierter Report bestimmt die aktuell angezeigten
  // Marktdaten — `documents` ist bereits neuester-zuerst sortiert (siehe getRegionDocuments).
  const latestDone = documents.find((d) => d.analysis_status === "DONE" && d.extraction);
  const extraction = latestDone?.extraction ?? null;

  return (
    <div className="shell">
      <SideNav current="regionen" />
      <main className="main">
        <Panel className="dethead">
          <div className="eyebrow">Region</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <h1>
              {region.gemeinde} ({region.canton})
            </h1>
            <DeleteRegionButton regionId={region.id} label={`${region.gemeinde} (${region.canton})`} redirectTo="/regionen" />
          </div>
        </Panel>

        {extraction ? (
          <Panel style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
            <div className="sectionhead">
              <h2>Kennzahlen{latestDone?.report_date ? ` (Stand ${new Date(latestDone.report_date).toLocaleDateString("de-CH")})` : ""}</h2>
            </div>
            <RegionKennzahlenView
              gemeindeLabel={extraction.gemeinde}
              kantonLabel={`Kanton ${AVAILABLE_CANTONS.find((c) => c.code === extraction.canton)?.name ?? extraction.canton}`}
              gemeindeKennzahlen={extraction.kennzahlen}
              kantonKennzahlen={extraction.kantonKennzahlen}
            />

            <QuantileTable title="Mietwohnungen" rows={extraction.preise.mietwohnungen} unit="CHF/m²/Jahr" />
            <QuantileTable title="Eigentumswohnungen" rows={extraction.preise.eigentumswohnungen} unit="CHF/m²" />
            <QuantileTable title="Einfamilienhäuser" rows={extraction.preise.einfamilienhaeuser} unit="CHF/m²" />

            {extraction.makrolagenbeschreibung ? (
              <div style={{ marginTop: "1rem" }}>
                <div className="eyebrow">Makrolagenbeschreibung</div>
                <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: ".4rem 0 0" }}>{extraction.makrolagenbeschreibung}</p>
              </div>
            ) : null}
          </Panel>
        ) : (
          <Panel style={{ padding: "1.1rem 1.3rem", marginTop: "1rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: 0 }}>
              Noch kein erfolgreich analysierter Report für diese Region — Kennzahlen erscheinen hier, sobald ein Upload abgeschlossen ist.
            </p>
          </Panel>
        )}

        <Panel style={{ padding: "1.1rem 1.3rem", marginTop: "1rem" }}>
          <div className="eyebrow">Hochgeladene Reports</div>
          {documents.length === 0 ? (
            <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: ".6rem 0 0" }}>Noch kein Report hochgeladen.</p>
          ) : (
            <div className="twrap">
              <table style={{ marginTop: ".7rem" }}>
                <thead>
                  <tr>
                    <th>Datei</th>
                    <th>Status</th>
                    <th>Hochgeladen</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td>{d.original_filename}</td>
                      <td>
                        <Chip tone={STATUS_TONE[d.analysis_status] ?? "neutral"}>{STATUS_LABEL[d.analysis_status] ?? d.analysis_status}</Chip>
                        {d.analysis_status === "FAILED" && d.analysis_error ? (
                          <div style={{ color: "var(--bad)", fontSize: ".74rem", marginTop: ".25rem" }}>{d.analysis_error}</div>
                        ) : null}
                      </td>
                      <td>{formatDateTime(d.uploaded_at)}</td>
                      <td style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
                        <RegionDocumentReanalyzeButton regionId={region.id} documentId={d.id} />
                        <DeleteRegionDocumentButton regionId={region.id} documentId={d.id} label={d.original_filename} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p style={{ marginTop: "0.9rem" }}>
          <Link href="/regionen" className="maplink">
            ← Zurück zu Regionen
          </Link>
        </p>
      </main>
    </div>
  );
}
