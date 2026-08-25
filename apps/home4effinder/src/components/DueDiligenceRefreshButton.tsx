"use client";

import { useDueDiligenceSynthesis } from "@/lib/useDueDiligenceSynthesis";

/**
 * Kompakter Auslöser für die Due-Diligence-Synthese direkt im Objektseiten-Header
 * (neben "Objekt löschen") — Rückmeldung: der bisherige Knopf sitzt erst unten im
 * `DueDiligencePanel`, auf dem Handy erst nach viel Scrollen erreichbar. Nutzt
 * denselben `useDueDiligenceSynthesis`-Hook wie das Panel, damit die Batch-Loop-Logik
 * nur einmal existiert — ein Klick hier stösst exakt denselben Ablauf an wie der Knopf
 * weiter unten, `router.refresh()` aktualisiert danach die ganze Seite inkl. Panel.
 */
export function DueDiligenceRefreshButton({ propertyId, disabled }: { propertyId: string; disabled?: boolean }) {
  const { synthesizing, progress, error, run } = useDueDiligenceSynthesis(propertyId);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".3rem" }}>
      <button
        type="button"
        className="btn"
        style={{ width: "auto", padding: ".3rem .7rem", fontSize: ".78rem" }}
        disabled={synthesizing || disabled}
        onClick={run}
      >
        {synthesizing ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {progress ? `Analysiert… (${progress.done}/${progress.total})` : "Analysiert…"}
          </>
        ) : (
          "DD aktualisieren"
        )}
      </button>
      {error ? <span style={{ color: "var(--bad)", fontSize: ".74rem", textAlign: "right" }}>{error}</span> : null}
    </div>
  );
}
