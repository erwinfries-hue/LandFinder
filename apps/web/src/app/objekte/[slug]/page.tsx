import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel, Icon, ScoreDialLarge, MapLink, Chip, InfoHint } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { demoObjekte, formatChf } from "@/lib/demo-data";
import { METRIC_HINTS } from "@/lib/metricHints";
import { Metric, StressRow } from "@/components/objekte/MetricPrimitives";
import { LiveChamScoreDials, LiveChamMetricGrid, LiveChamStressTable, LiveChamAssumptions } from "@/components/objekte/LiveChamAnalysis";

const LIVE_WIRED_SLUGS = ["cham-chamerstrasse-2214"];

export function generateStaticParams() {
  return demoObjekte.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const objekt = demoObjekte.find((o) => o.slug === slug);
  return { title: objekt ? `${objekt.adresse}, ${objekt.ort} — SIPIS LandFinder` : "Objekt — SIPIS LandFinder" };
}

export default async function ObjektDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const objekt = demoObjekte.find((o) => o.slug === slug);
  if (!objekt) notFound();

  const v = objekt.vertiefung;
  const adresseVoll = `${objekt.adresse}, ${objekt.plz} ${objekt.ort}`;
  const isLiveWired = LIVE_WIRED_SLUGS.includes(objekt.slug);

  return (
    <div className="shell">
      <SideNav current="objekte" activeSlug={objekt.slug} />
      <main className="main">
        <Panel className="dethead">
          <div className="eyebrow">
            Objekt · {objekt.objektart === "Bauland" ? "Unbebautes Bauland" : "Grundstück mit Abbruchobjekt"} ·{" "}
            {objekt.ort}, {objekt.kanton} · Parzelle {objekt.parzelle}
            {v ? ` · EGRID ${v.egrid}` : ""}
          </div>
          <div className="dethead-top">
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: ".9rem", flexWrap: "wrap" }}>
                <h1>{adresseVoll}</h1>
                <MapLink address={adresseVoll} label="Lage auf Karte" />
              </div>
              {v ? <p className="lede lede-line">{v.leadSummary}</p> : null}
            </div>
            <div className="det-scores">
              {isLiveWired ? (
                <LiveChamScoreDials />
              ) : (
                <>
                  <div className="scorewrap">
                    <ScoreDialLarge value={objekt.score} tone={objekt.scoreTon} />
                    <div className="lbl" title={METRIC_HINTS.score}>Score</div>
                  </div>
                  <div className="scorewrap">
                    <ScoreDialLarge value={objekt.vertrauen} tone="accent" />
                    <div className="lbl" title={METRIC_HINTS.vertrauen}>Vertrauen</div>
                  </div>
                  <Chip tone={objekt.empfKlasse === "A" ? "good" : objekt.empfKlasse === "B" ? "accent" : "warn"}>
                    <span title={METRIC_HINTS.empfehlung}>{objekt.empfWort}</span>
                  </Chip>
                </>
              )}
            </div>
          </div>

          <div className="metricgrid">
            {isLiveWired ? (
              <LiveChamMetricGrid />
            ) : (
              <>
                <Metric l="Angebotspreis" v={`CHF ${formatChf(objekt.preisChf)}`} sub={`CHF ${formatChf(objekt.preisProM2)} / m² Land`} hint={METRIC_HINTS.angebotspreis} />
                <Metric l="Grundstücksfläche" v={`${formatChf(objekt.flaecheM2)} m²`} sub={v?.zone ?? "Zone unbestätigt"} hint={METRIC_HINTS.grundstuecksflaeche} />
                {v ? (
                  <>
                    <Metric l="Geschätzte NRA" v={`${formatChf(v.nraM2)} m²`} sub={<>Verifikation <span className="badge-verify">{v.nraVerifikation}</span></>} hint={METRIC_HINTS.nra} />
                    <Metric l="Gesamtinvestition" v={`CHF ${formatChf(v.gesamtinvestitionChf)}`} sub="Base Case" hint={METRIC_HINTS.gesamtinvestition} />
                    <Metric l="Eigenkapitalbedarf" v={`CHF ${formatChf(v.eigenkapitalbedarfChf)}`} sub={`LTC ${v.ltcProzent}%`} hint={METRIC_HINTS.eigenkapitalbedarf} />
                    <Metric l="Yield on Cost" v={`${objekt.yieldOnCost}%`} sub="Ziel ≥ 4.2%" valueColor="var(--good)" hint={METRIC_HINTS.yieldOnCost} />
                    <Metric l="DSCR (Base)" v={v.dscrBase.toFixed(2)} sub={`Stress: ${v.dscrStress.toFixed(2)}`} hint={METRIC_HINTS.dscr} />
                    <Metric
                      l="Residualwert"
                      v={`CHF ${formatChf(v.residualwertChf)}`}
                      sub={`+CHF ${formatChf(v.residualwertDiffChf)} · +${v.residualwertDiffProzent}% ggü. Angebot`}
                      subColor="var(--good)"
                      hint={METRIC_HINTS.residualwert}
                    />
                  </>
                ) : (
                  <Metric l="Vertiefung" v="Ausstehend" sub="Stufe 2 noch nicht ausgeführt" />
                )}
              </>
            )}
          </div>
        </Panel>

        {v ? (
          <>
            <div className="twocol">
              <Panel className="reasons pos">
                <h3>
                  <Icon name="check" /> Warum attraktiv
                </h3>
                <ul>
                  {v.positives.map((p) => (
                    <li key={p}>
                      <Icon name="check" width={14} style={{ color: "var(--good)" }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel className="reasons neg">
                <h3>
                  <Icon name="alert" /> Warum riskant
                </h3>
                <ul>
                  {v.negatives.map((n) => (
                    <li key={n}>
                      <Icon name="alert" width={14} style={{ color: "var(--bad)" }} />
                      {n}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <div className="subgrid">
              {isLiveWired ? (
                <LiveChamStressTable />
              ) : (
                <Panel style={{ padding: "1.2rem 1.3rem" }}>
                  <div className="sectionhead">
                    <h2>Base &amp; Stress</h2>
                  </div>
                  <table className="stresstable">
                    <thead>
                      <tr>
                        <th />
                        <th className="num">Base</th>
                        <th className="num">Stress</th>
                      </tr>
                    </thead>
                    <tbody>
                      <StressRow label="Nettomiete CHF/m²/Mt." base={v.base.nettomiete} stress={v.stress.nettomiete} hint={METRIC_HINTS.nettomiete} />
                      <StressRow label="Baukosten/m² NRA" base={v.base.baukosten} stress={v.stress.baukosten} hint={METRIC_HINTS.baukostenM2} />
                      <StressRow label="Zinssatz" base={v.base.zinssatz} stress={v.stress.zinssatz} hint={METRIC_HINTS.zinssatz} />
                      <StressRow label="DSCR" base={v.base.dscr} stress={v.stress.dscr} hint={METRIC_HINTS.dscr} />
                      <StressRow label="Cash-on-Cash" base={v.base.cashOnCash} stress={v.stress.cashOnCash} hint={METRIC_HINTS.cashOnCash} />
                    </tbody>
                  </table>
                </Panel>
              )}
              <Panel style={{ padding: "1.2rem 1.3rem" }}>
                <div className="sectionhead">
                  <h2>
                    Baupotenzial <InfoHint text={METRIC_HINTS.baupotenzialMethode} />
                  </h2>
                </div>
                <div style={{ display: "flex", gap: ".8rem", alignItems: "flex-start", marginBottom: ".9rem" }}>
                  <Icon name="tri" width={22} style={{ color: "var(--accent)" }} />
                  <div style={{ fontSize: ".8125rem", color: "var(--ink-soft)" }}>
                    Methode: {v.baupotenzialMethode}
                    <br />
                    Verifikation: <span className="badge-verify" title={METRIC_HINTS.verifikation}>{v.baupotenzialVerifikation}</span>
                  </div>
                </div>
                <div className="sectionhead" style={{ marginTop: "1rem" }}>
                  <h2 style={{ fontSize: ".85rem" }}>
                    Vergleich Kanton {objekt.kanton} <InfoHint text={METRIC_HINTS.vergleichKanton} />
                  </h2>
                </div>
                <div className="compare-strip" style={{ padding: 0, marginTop: ".3rem" }}>
                  <span className="big">
                    Rang {v.rangKanton} / {v.totalKanton}
                  </span>
                  <div className="percentile-track">
                    <div className="percentile-fill" style={{ width: `${v.perzentil}%` }} />
                  </div>
                  <span className="mono" style={{ fontSize: ".75rem", color: "var(--ink-soft)" }}>
                    Perzentil {v.perzentil}
                  </span>
                </div>
              </Panel>
            </div>

            {isLiveWired && <LiveChamAssumptions />}

            <Panel className="provenance" style={{ padding: "1rem 1.3rem" }}>
              <span className="eyebrow">Herkunft der Datenpunkte</span>
              {v.provenance.map((p) => (
                <span key={p} className={`chip mono ${p === "USER_ASSUMPTION" ? "warn" : "neutral"}`}>
                  {p}
                </span>
              ))}
            </Panel>
          </>
        ) : (
          <Panel style={{ padding: "1.3rem 1.4rem", marginTop: "1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Für dieses Objekt liegt noch keine Stufe-2-Vertiefung vor (Parzelle/EGRID, ÖREB, Base/Stress,
              Kantonsvergleich). Die Vertiefung wird ausgelöst, sobald die Score-Schwelle erreicht ist, der Preis sich
              relevant ändert oder manuell angefordert wird (Abschnitt 4.6 des Masterdokuments).
            </p>
          </Panel>
        )}
      </main>
    </div>
  );
}
