"use client";

import { useSyncExternalStore } from "react";
import { EMPFEHLUNG_LABEL, type Empfehlung } from "@landfinder/domain";
import { computeComparisonMetrics, rankAndCompare, type ComparisonEntry } from "@landfinder/comparison-engine";
import { Panel, Icon, ScoreDialLarge, Chip, InfoHint, type DialTone, type ChipTone } from "@landfinder/ui";
import { getSearchProfileServerSnapshot, getSearchProfileSnapshot, subscribeSearchProfile } from "@/lib/searchProfile";
import { getAnnahmenServerSnapshot, getAnnahmenSnapshot, subscribeAnnahmen } from "@/lib/annahmen";
import { computeListingAnalysis } from "@/lib/objektAnalysis";
import type { ListingAnalysisInput, ListingVertiefungFacts } from "@/lib/listingVertiefung";
import { formatChf } from "@/lib/demo-data";
import { METRIC_HINTS } from "@/lib/metricHints";
import { Metric, StressRow } from "@/components/objekte/MetricPrimitives";

const SCORE_TONE: (score: number) => DialTone = (score) => (score >= 75 ? "good" : score >= 55 ? "accent" : score >= 35 ? "warn" : "neutral");

const EMPFEHLUNG_TONE: Record<Empfehlung, ChipTone> = {
  SOFORT_PRUEFEN: "good",
  POTENZIAL_DRINGEND_VERIFIZIEREN: "accent",
  WEITERVERFOLGEN: "accent",
  BEOBACHTEN_VERHANDELN: "warn",
  NICHT_WEITERVERFOLGEN: "bad",
  UNGENUEGENDE_DATEN: "bad",
};

export interface ComparisonPoolEntry {
  listingId: string;
  listing: ListingAnalysisInput;
  facts: ListingVertiefungFacts;
}

/**
 * Live-Analyse-Panels für ein vertieftes echtes Inserat — das Pendant zu
 * `LiveChamAnalysis.tsx`, aber für beliebige `/quellen`-Treffer statt nur die
 * Cham-Demo. Rechnet bei jeder Suchprofil-/Annahmen-Änderung neu durch dieselbe
 * Engine (`computeListingAnalysis`). Der Kantonsvergleich läuft nur unter anderen
 * vertieften ECHTEN Inseraten im selben Kanton (`comparisonPool`), nicht gegen die
 * statischen Demo-Objekte — unterschiedliche Berechnungsgrundlage, sonst irreführend.
 */
export function ListingLiveAnalysis({
  listingId,
  listing,
  facts,
  comparisonPool,
}: {
  listingId: string;
  listing: ListingAnalysisInput;
  facts: ListingVertiefungFacts;
  comparisonPool: ComparisonPoolEntry[];
}) {
  const profile = useSyncExternalStore(subscribeSearchProfile, getSearchProfileSnapshot, getSearchProfileServerSnapshot);
  const overrides = useSyncExternalStore(subscribeAnnahmen, getAnnahmenSnapshot, getAnnahmenServerSnapshot);

  const a = computeListingAnalysis(profile, overrides, listing, facts);

  const poolEntries: ComparisonEntry[] = [{ listingId, canton: listing.canton, metrics: metricsOf(listing, a) }, ...comparisonPool.map((p) => {
    const pa = computeListingAnalysis(profile, overrides, p.listing, p.facts);
    return { listingId: p.listingId, canton: p.listing.canton, metrics: metricsOf(p.listing, pa) };
  })];
  const ranking = rankAndCompare(poolEntries).find((r) => r.listingId === listingId);

  return (
    <>
      <Panel className="dethead" style={{ marginTop: "1.6rem" }}>
        <div className="eyebrow">Vertiefte Analyse (live) — echte Daten, kein Demo-Objekt</div>
        <div className="dethead-top">
          <div className="det-scores">
            <div className="scorewrap">
              <ScoreDialLarge value={Math.round(a.score.total)} tone={SCORE_TONE(a.score.total)} />
              <div className="lbl">
                Score <InfoHint text={METRIC_HINTS.score} />
              </div>
            </div>
            <div className="scorewrap">
              <ScoreDialLarge value={Math.round(a.confidence.total)} tone="accent" />
              <div className="lbl">
                Vertrauen <InfoHint text={METRIC_HINTS.vertrauen} />
              </div>
            </div>
            <Chip tone={EMPFEHLUNG_TONE[a.empfehlung]}>{EMPFEHLUNG_LABEL[a.empfehlung]}</Chip>
            <InfoHint text={METRIC_HINTS.empfehlung} />
          </div>
        </div>

        <div className="metricgrid">
          <Metric
            l="Angebotspreis"
            v={`CHF ${formatChf(listing.askingPriceChf)}`}
            sub={`CHF ${formatChf(Math.round(listing.askingPriceChf / listing.parcelAreaM2))} / m² Land`}
            hint={METRIC_HINTS.angebotspreis}
          />
          <Metric l="Grundstücksfläche" v={`${formatChf(listing.parcelAreaM2)} m²`} sub={facts.zoneLabel} hint={METRIC_HINTS.grundstuecksflaeche} />
          <Metric l="Berechnete NRA" v={`${formatChf(Math.round(a.baupotenzial.adjustedNraM2))} m²`} sub="live aus Baupotenzial-Eingabe × Fläche" hint={METRIC_HINTS.nra} />
          <Metric l="Gesamtinvestition" v={`CHF ${formatChf(Math.round(a.base.totalDevelopmentCostChf))}`} sub="Base Case, live" hint={METRIC_HINTS.gesamtinvestition} />
          <Metric l="Eigenkapitalbedarf" v={`CHF ${formatChf(Math.round(a.base.equityRequiredChf))}`} sub={`LTC ${a.base.loanToCostPercent}%`} hint={METRIC_HINTS.eigenkapitalbedarf} />
          <Metric
            l="Yield on Cost"
            v={`${a.yieldOnCostPercent.toFixed(1)}%`}
            sub={`Ziel ≥ ${profile.renditeziele.minYieldOnCostPercent}%`}
            valueColor={a.yieldOnCostPercent >= profile.renditeziele.minYieldOnCostPercent ? "var(--good)" : "var(--bad)"}
            hint={METRIC_HINTS.yieldOnCost}
          />
          <Metric l="DSCR (Base)" v={a.base.dscr.toFixed(2)} sub={`Stress: ${a.stress.dscr.toFixed(2)}`} hint={METRIC_HINTS.dscr} />
          <Metric
            l="Residualwert"
            v={`CHF ${formatChf(Math.round(a.wert.residualLandValueChf))}`}
            sub={`${a.wert.landValueGapPercent >= 0 ? "+" : ""}CHF ${formatChf(Math.round(a.wert.landValueGapChf))} · ${
              a.wert.landValueGapPercent >= 0 ? "+" : ""
            }${a.wert.landValueGapPercent.toFixed(1)}% ggü. Angebot`}
            subColor={a.wert.landValueGapPercent >= 0 ? "var(--good)" : "var(--bad)"}
            hint={METRIC_HINTS.residualwert}
          />
        </div>
      </Panel>

      <div className="subgrid">
        <Panel style={{ padding: "1.2rem 1.3rem" }}>
          <div className="sectionhead">
            <h2>Base &amp; Stress (live)</h2>
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
              <StressRow
                label="Nettomiete CHF/m²/Mt."
                base={profile.marktannahmen.netRentChfPerM2Month.toFixed(2)}
                stress={a.stress.rentChfPerM2Month.toFixed(2)}
                hint={METRIC_HINTS.nettomiete}
              />
              <StressRow
                label="Baukosten/m² NRA"
                base={formatChf(profile.baukosten.buildingCostChfPerM2)}
                stress={formatChf(Math.round(a.stress.buildingCostPerM2Chf))}
                hint={METRIC_HINTS.baukostenM2}
              />
              <StressRow
                label="Zinssatz"
                base={`${profile.finanzierung.interestRateBasePercent.toFixed(1)}%`}
                stress={`${a.stress.interestRatePercent.toFixed(1)}%`}
                hint={METRIC_HINTS.zinssatz}
              />
              <StressRow label="DSCR" base={a.base.dscr.toFixed(2)} stress={a.stress.dscr.toFixed(2)} hint={METRIC_HINTS.dscr} />
              <StressRow
                label="Cash-on-Cash"
                base={`${a.base.cashOnCashPercent.toFixed(1)}%`}
                stress={`${a.stress.cashOnCashPercent.toFixed(1)}%`}
                hint={METRIC_HINTS.cashOnCash}
              />
            </tbody>
          </table>
        </Panel>

        <Panel style={{ padding: "1.2rem 1.3rem" }}>
          <div className="sectionhead">
            <h2>
              Baupotenzial <InfoHint text={METRIC_HINTS.baupotenzialMethode} />
            </h2>
          </div>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "flex-start", marginBottom: ".9rem" }}>
            <Icon name="tri" width={22} style={{ color: "var(--accent)" }} />
            <div style={{ fontSize: ".8125rem", color: "var(--ink-soft)" }}>
              Zone {facts.zoneLabel}, Methode {facts.baupotenzial.method}
              <br />
              Verifikation <InfoHint text={METRIC_HINTS.verifikation} />: <span className="badge-verify">{facts.overallVerification}</span>
            </div>
          </div>
          <div className="sectionhead" style={{ marginTop: "1rem" }}>
            <h2 style={{ fontSize: ".85rem" }}>
              Vergleich Kanton {listing.canton} <InfoHint text={METRIC_HINTS.vergleichKanton} />
            </h2>
          </div>
          {ranking ? (
            <div className="compare-strip" style={{ padding: 0, marginTop: ".3rem" }}>
              <span className="big">
                Rang {ranking.cantonRank} / {ranking.cantonCount}
              </span>
              <div className="percentile-track">
                <div className="percentile-fill" style={{ width: `${ranking.percentile}%` }} />
              </div>
              <span className="mono" style={{ fontSize: ".75rem", color: "var(--ink-soft)" }}>
                Perzentil {Math.round(ranking.percentile)}
              </span>
            </div>
          ) : null}
          <p style={{ color: "var(--ink-faint)", fontSize: ".72rem", marginTop: ".6rem" }}>
            Nur unter anderen vertieften echten Inseraten im selben Kanton — nicht gegen die statischen Demo-Objekte
            (unterschiedliche Berechnungsgrundlage).
          </p>
        </Panel>
      </div>

      <Panel style={{ padding: "1rem 1.3rem", marginTop: "1.4rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
          <Icon name="alert" width={14} style={{ marginRight: ".3rem" }} />
          Berechnungsgrundlage dieser Live-Werte
        </div>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: ".8125rem", color: "var(--ink-soft)", display: "flex", flexDirection: "column", gap: ".3rem" }}>
          {a.assumptionNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function metricsOf(listing: ListingAnalysisInput, a: ReturnType<typeof computeListingAnalysis>) {
  return computeComparisonMetrics({
    scoreTotal: a.score.total,
    dataConfidenceTotal: a.confidence.total,
    askingPriceChf: listing.askingPriceChf,
    parcelAreaM2: listing.parcelAreaM2,
    achievedNraM2: a.baupotenzial.adjustedNraM2,
    totalDevelopmentCostChf: a.base.totalDevelopmentCostChf,
    noiChf: a.base.noiChf,
    residualLandValueChf: a.wert.residualLandValueChf,
    equityRequiredChf: a.base.equityRequiredChf,
  });
}
