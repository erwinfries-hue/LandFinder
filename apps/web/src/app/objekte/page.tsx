import Link from "next/link";
import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { demoObjekte } from "@/lib/demo-data";

export default function ObjektePage() {
  return (
    <div className="shell">
      <SideNav current="objekte" />
      <main className="main">
        <div className="pagehead">
          <h1>Objekte</h1>
        </div>
        <Panel style={{ padding: "1.4rem 1.6rem" }}>
          <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", marginBottom: "1rem" }}>
            Die vollständige, filterbare Objektliste (Abschnitt 22) folgt in Phase 1. Bis dahin: Demo-Objekte direkt
            verlinkt.
          </p>
          <ul style={{ display: "flex", flexDirection: "column", gap: ".5rem", listStyle: "none", padding: 0, margin: 0 }}>
            {demoObjekte.map((o) => (
              <li key={o.slug}>
                <Link href={`/objekte/${o.slug}`} className="maplink">
                  {o.adresse}, {o.ort} {o.kanton} — Score {o.score}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
    </div>
  );
}
