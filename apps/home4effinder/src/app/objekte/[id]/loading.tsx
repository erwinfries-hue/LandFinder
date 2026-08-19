import { SideNav } from "@/components/SideNav";

/**
 * Next.js-Loading-UI für diese Route — wird sofort gestreamt, sobald die Navigation
 * beginnt, noch bevor die Server-Component-Datenabfragen (Objekt, Dokumente,
 * Due-Diligence, Bestandsrendite-Analyse) fertig sind. Ohne diese Datei bleibt der
 * Mauszeiger bis zum vollständigen Laden auf "Sanduhr", weil der Browser die
 * Navigation erst als abgeschlossen betrachtet, wenn überhaupt etwas gerendert wird.
 */
export default function Loading() {
  return (
    <div className="shell">
      <SideNav current="objekte" />
      <main className="main">
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", padding: "2rem 0", color: "var(--ink-soft)", fontSize: ".875rem" }}>
          <span className="spinner" aria-hidden="true" />
          Lädt…
        </div>
      </main>
    </div>
  );
}
