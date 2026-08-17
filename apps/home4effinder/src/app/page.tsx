import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { getProperties, formatDateTime } from "@/lib/properties";
import { formatChf } from "@/lib/format";

export const metadata: Metadata = { title: "Objekte — HOME4efFINDER" };

/** Zeigt live den aktuellen Datenbankstand statt eines beim letzten Deploy eingefrorenen Snapshots. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const properties = await getProperties();
  const configured = properties !== null;

  return (
    <div className="shell">
      <SideNav current="objekte" />
      <main className="main">
        <div className="pagehead">
          <h1>Objekte</h1>
        </div>

        {!configured ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              fehlen) — daher lassen sich hier noch keine Objekte anzeigen.
            </p>
          </Panel>
        ) : properties.length === 0 ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: 0 }}>
              Noch keine Objekte erfasst.{" "}
              <Link href="/neu" className="maplink">
                Erste Bestandswohnung erfassen →
              </Link>
            </p>
          </Panel>
        ) : (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <div className="eyebrow">
              {properties.length} Objekt{properties.length === 1 ? "" : "e"}
            </div>
            <table style={{ marginTop: "1rem" }}>
              <thead>
                <tr>
                  <th>Adresse</th>
                  <th>Kanton</th>
                  <th className="num">Kaufpreis</th>
                  <th className="num">Wohnfläche</th>
                  <th>Erfasst</th>
                  <th>Bestandsrendite</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/objekte/${p.id}`} className="maplink">
                        {p.title || p.address_text}
                      </Link>
                    </td>
                    <td>{p.canton}</td>
                    <td className="num mono">CHF {formatChf(p.asking_price_chf)}</td>
                    <td className="num mono">{formatChf(p.wohnflaeche_m2)} m²</td>
                    <td>{formatDateTime(p.created_at)}</td>
                    <td>{p.bestandsrendite ? "erfasst" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </main>
    </div>
  );
}
