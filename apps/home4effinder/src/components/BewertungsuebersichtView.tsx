import { Panel, Chip } from "@landfinder/ui";
import type { AmpelDimension } from "@/lib/bewertungsAmpel";

/**
 * Kompakte "Bewertungsübersicht" ganz oben auf der Objektseite — mehrere Ampeln
 * nebeneinander statt über die Seite verstreut (siehe `computeBewertungsAmpeln`).
 * Rein informative Zusammenfassung bereits vorhandener Werte, keine neue Berechnung.
 * `null`, solange keine einzige Dimension bestimmbar ist (z.B. ganz neues Objekt ohne
 * Bestandsrendite-Fakten und ohne Due-Diligence-Synthese).
 */
export function BewertungsuebersichtView({ ampeln }: { ampeln: AmpelDimension[] }) {
  if (ampeln.length === 0) return null;

  return (
    <Panel id="bewertungsuebersicht" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
      <div className="sectionhead">
        <h2>Bewertungsübersicht</h2>
      </div>
      <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".7rem" }}>
        Ampeln zu den wichtigsten Dimensionen auf einen Blick — Details je Kennzahl weiter unten (Investment Case,
        Value-Add, Markteinordnung, Due Diligence).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {ampeln.map((a) => (
          <div key={a.key} style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
            <Chip tone={a.status}>{a.label}</Chip>
            <span style={{ fontSize: ".72rem", color: "var(--ink-faint)" }}>{a.detail}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
