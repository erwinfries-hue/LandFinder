"use client";

import { useSyncExternalStore } from "react";
import { EMPFEHLUNG_LABEL, type Empfehlung } from "@landfinder/domain";
import { Panel, Icon, ScoreDialLarge, Chip, InfoHint, type DialTone, type ChipTone } from "@landfinder/ui";
import { getSearchProfileServerSnapshot, getSearchProfileSnapshot, subscribeSearchProfile } from "@/lib/searchProfile";
import { getAnnahmenServerSnapshot, getAnnahmenSnapshot, subscribeAnnahmen } from "@/lib/annahmen";
import { computeChamAnalysis, CHAM_FACTS } from "@/lib/objektAnalysis";
import { formatChf } from "@/lib/demo-data";
import { METRIC_HINTS } from "@/lib/metricHints";
import { Metric, StressRow } from "./MetricPrimitives";

const SCORE_TONE: (score: number) => DialTone = (score) => (score >= 75 ? "good" : score >= 55 ? "accent" : score >= 35 ? "warn" : "neutral");

const EMPFEHLUNG_TONE: Record<Empfehlung, ChipTone> = {
  SOFORT_PRUEFEN: "good",
  POTENZIAL_DRINGEND_VERIFIZIEREN: "accent",
  WEITERVERFOLGEN: "accent",
  BEOBACHTEN_VERHANDELN: "warn",
  NICHT_WEITERVERFOLGEN: "bad",
  UNGENUEGENDE_DATEN: "bad",
};

/**
 * Gemeinsame Grundlage aller Live-Cham-Komponenten: liest Suchprofil + Annahmen-
 * Overrides live (localStorage via useSyncExternalStore) und rechnet bei jeder
 * Änderung neu durch financial-engine/scoring-engine (apps/web/src/lib/
 * objektAnalysis.ts). Mehrere Komponenten rufen das unabhängig auf — die Berechnung
 * selbst ist eine reine, günstige Funktion, doppeltes Rechnen ist hier kein Problem.
 */
function useChamAnalysis() {
  const profile = useSyncExternalStore(subscribeSearchProfile, getSearchProfileSnapshot, getSearchProfileServerSnapshot);
  const overrides = useSyncExternalStore(subscribeAnnahmen, getAnnahmenSnapshot, getAnnahmenServerSnapshot);
  return { profile, a: computeChamAnalysis(profile, overrides) };
}

/** Ersetzt nur den Inhalt von `.det-scores` (Score/Vertrauen-Dials, Empfehlungs-Chip) — der Wrapper-Div bleibt in page.tsx. */
export function LiveChamScoreDials() {
  const { a } = useChamAnalysis();

  return (
    <>
      <div className="scorewrap">
        <ScoreDialLarge value={Math.round(a.score.total)} tone={SCORE_TONE(a.score.total)} />
        <div className="lbl">
          Score (live) <InfoHint text={METRIC_HINTS.score} />
        </div>
      </div>
      <div className="scorewrap">
        <ScoreDialLarge value={Math.round(a.confidence.total)} tone="accent" />
        <div className="lbl">
          Vertrauen (live) <InfoHint text={METRIC_HINTS.vertrauen} />
        </div>
      </div>
      <Chip tone={EMPFEHLUNG_TONE[a.empfehlung]}>{EMPFEHLUNG_LABEL[a.empfehlung]}</Chip>
      <InfoHint text={METRIC_HINTS.empfehlung} />
    </>
  );
}

/** Ersetzt nur den Inhalt von `.metricgrid` — der Wrapper-Div bleibt in page.tsx. */
export function LiveChamMetricGrid() {
  const { profile, a } = useChamAnalysis();

  return (
    <>
      <Metric
        l="Angebotspreis"
        v={`CHF ${formatChf(CHAM_FACTS.askingPriceChf)}`}
        sub={`CHF ${formatChf(Math.round(CHAM_FACTS.askingPriceChf / CHAM_FACTS.parcelAreaM2))} / m² Land`}
        hint={METRIC_HINTS.angebotspreis}
      />
      <Metric l="Grundstücksfläche" v={`${formatChf(CHAM_FACTS.parcelAreaM2)} m²`} sub="Zone W3 (unverändert übernommen)" hint={METRIC_HINTS.grundstuecksflaeche} />
      <Metric l="Berechnete NRA" v={`${formatChf(Math.round(a.baupotenzial.adjustedNraM2))} m²`} sub="live aus Ausnützungsziffer × Fläche" hint={METRIC_HINTS.nra} />
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
    </>
  );
}

/** Ersetzt die statische "Base & Stress"-Tabelle 1:1 mit live berechneten Werten. */
export function LiveChamStressTable() {
  const { profile, a } = useChamAnalysis();

  return (
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
  );
}

/** Transparenz-Panel: listet die Annahmen/Vereinfachungen, die in die Live-Berechnung eingeflossen sind. */
export function LiveChamAssumptions() {
  const { a } = useChamAnalysis();

  return (
    <Panel style={{ padding: "1rem 1.3rem" }}>
      <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
        <Icon name="alert" width={14} style={{ marginRight: ".3rem" }} />
        Berechnungsgrundlage dieser Live-Werte
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: "1.1rem",
          fontSize: ".8125rem",
          color: "var(--ink-soft)",
          display: "flex",
          flexDirection: "column",
          gap: ".3rem",
        }}
      >
        {a.assumptionNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </Panel>
  );
}
