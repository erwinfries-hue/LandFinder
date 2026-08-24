import type { Metadata } from "next";
import Link from "next/link";
import { Panel, Chip, type ChipTone } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { getProperties, getPropertyDueDiligence, type PropertyRow } from "@/lib/properties";
import { computeBestandsrenditeAnalysis, parseBestandsrenditeFacts } from "@/lib/bestandsrendite";
import { computeInvestmentScore, type InvestmentScoreBreakdown } from "@/lib/investmentScore";
import { getParameterOverrides } from "@/lib/parameterOverrides";
import { formatChf } from "@/lib/format";
import type { DueDiligenceResult, DueDiligenceSeverity } from "@landfinder/domain";

export const metadata: Metadata = { title: "Vergleich — HOME4efFINDER" };
export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<DueDiligenceSeverity, ChipTone> = { OK: "good", KLAERUNGSBEDARF: "warn", RISIKO: "bad" };
const SEVERITY_LABEL: Record<DueDiligenceSeverity, string> = { OK: "Unauffällig", KLAERUNGSBEDARF: "Klärungsbedarf", RISIKO: "Wesentliches Risiko" };

function scoreTone(totalScore: number): ChipTone {
  if (totalScore >= 70) return "good";
  if (totalScore >= 40) return "warn";
  return "bad";
}

interface CompareRow {
  property: PropertyRow;
  bruttoRenditePercent: number | null;
  preisProM2Chf: number | null;
  cashflowChf: number | null;
  overallStatus: DueDiligenceSeverity | null;
  overallSummary: string | null;
  score: InvestmentScoreBreakdown | undefined;
}

export default async function VergleichPage() {
  const properties = await getProperties();
  const configured = properties !== null;
  const parameterOverrides = configured ? await getParameterOverrides() : {};

  const rows: CompareRow[] = configured
    ? await Promise.all(
        properties.map(async (property): Promise<CompareRow> => {
          const factsParsed = property.bestandsrendite ? parseBestandsrenditeFacts(property.bestandsrendite) : null;
          const facts = factsParsed && "facts" in factsParsed ? factsParsed.facts : null;
          const analysis = facts
            ? computeBestandsrenditeAnalysis(
                { kaufpreisChf: property.asking_price_chf, wohnflaecheM2: property.wohnflaeche_m2, canton: property.canton },
                facts,
                parameterOverrides,
              )
            : null;

          const dueDiligence = await getPropertyDueDiligence(property.id);
          const result = dueDiligence?.result as DueDiligenceResult | null | undefined;

          const score =
            analysis && result
              ? computeInvestmentScore({
                  categories: result.categories,
                  missingDocuments: result.missingDocuments,
                  bruttoRenditePercent: analysis.schnellcheck.bruttoRenditePercent,
                  cashflowChf: analysis.schnellcheck.groberCashflowChf,
                })
              : undefined;

          return {
            property,
            bruttoRenditePercent: analysis?.schnellcheck.bruttoRenditePercent ?? null,
            preisProM2Chf: analysis?.schnellcheck.preisProM2Chf ?? null,
            cashflowChf: analysis?.schnellcheck.groberCashflowChf ?? null,
            overallStatus: result?.overallStatus ?? null,
            overallSummary: result?.overallSummary || null,
            score,
          };
        }),
      )
    : [];

  // Bester Score zuerst, Objekte ohne Score (noch keine Due-Diligence-Synthese) danach,
  // untereinander nach Erfassungsdatum (neueste zuerst).
  const sortedRows = [...rows].sort((a, b) => {
    if (a.score && b.score) return b.score.totalScore - a.score.totalScore;
    if (a.score && !b.score) return -1;
    if (!a.score && b.score) return 1;
    return new Date(b.property.created_at).getTime() - new Date(a.property.created_at).getTime();
  });

  return (
    <div className="shell">
      <SideNav current="vergleich" />
      <main className="main">
        <div className="pagehead">
          <h1>Vergleich</h1>
        </div>

        {!configured ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              fehlen) — daher lässt sich hier noch nichts vergleichen.
            </p>
          </Panel>
        ) : sortedRows.length === 0 ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: 0 }}>
              Noch keine Objekte erfasst.{" "}
              <Link href="/neu" className="maplink">
                Erste Bestandswohnung erfassen →
              </Link>
            </p>
          </Panel>
        ) : (
          <>
            <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0 0 1rem" }}>
              Sortiert nach Investment-Score (beste zuerst). Objekte ohne Bestandsrendite-Fakten oder ohne
              Due-Diligence-Synthese zeigen die verfügbaren Kennzahlen mit „—“ für den Rest.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
              {sortedRows.map((row) => (
                <details key={row.property.id} className="panel" style={{ padding: 0 }}>
                  <summary className="compare-row-summary">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".875rem" }}>{row.property.title || row.property.address_text}</div>
                      <div style={{ color: "var(--ink-faint)", fontSize: ".74rem" }}>
                        {row.property.canton} · {formatChf(row.property.wohnflaeche_m2)} m²
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow">Kaufpreis</div>
                      <div className="mono" style={{ fontWeight: 600, fontSize: ".85rem" }}>
                        CHF {formatChf(row.property.asking_price_chf)}
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow">CHF/m²</div>
                      <div className="mono" style={{ fontWeight: 600, fontSize: ".85rem" }}>
                        {row.preisProM2Chf !== null ? `CHF ${formatChf(Math.round(row.preisProM2Chf))}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow">Bruttorendite</div>
                      <div className="mono" style={{ fontWeight: 600, fontSize: ".85rem" }}>
                        {row.bruttoRenditePercent !== null ? `${row.bruttoRenditePercent.toFixed(2)}%` : "—"}
                      </div>
                    </div>
                    <div>{row.overallStatus ? <Chip tone={SEVERITY_TONE[row.overallStatus]}>{SEVERITY_LABEL[row.overallStatus]}</Chip> : <Chip tone="neutral">Keine DD</Chip>}</div>
                    <div>{row.score ? <Chip tone={scoreTone(row.score.totalScore)}>Score {row.score.totalScore}/100</Chip> : <Chip tone="neutral">—</Chip>}</div>
                  </summary>
                  <div style={{ padding: "0 1.1rem 1.1rem", borderTop: "1px solid var(--line)" }}>
                    {row.overallSummary ? (
                      <p className="lede" style={{ fontSize: ".9rem", margin: "1rem 0" }}>
                        {row.overallSummary}
                      </p>
                    ) : (
                      <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem", margin: "1rem 0" }}>
                        {row.score === undefined ? "Noch keine Due-Diligence-Synthese gelaufen." : "Keine Gesamteinschätzung verfügbar."}
                      </p>
                    )}
                    {row.score ? (
                      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: "0 0 1rem" }}>
                        Due Diligence {row.score.dueDiligenceScore}/60 · Dokumentation {row.score.documentationScore}/15 · Rendite {row.score.renditeScore}/25
                      </p>
                    ) : null}
                    <Link href={`/objekte/${row.property.id}`} className="maplink">
                      Zur Objektseite ↗
                    </Link>
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
