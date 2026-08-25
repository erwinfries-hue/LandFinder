import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { RegionUploadForm } from "@/components/RegionUploadForm";
import { DeleteRegionButton } from "@/components/DeleteRegionButton";
import { listRegions } from "@/lib/regionMarketData";
import { getProperties, formatDateTime } from "@/lib/properties";
import { normalizeGemeinde } from "@/lib/gemeindeParsing";

export const metadata: Metadata = { title: "Regionen — HOME4efFINDER" };
export const dynamic = "force-dynamic";

/**
 * Regionen-Marktdaten (Gemeinde-/Regions-Standortreports, z.B. Wüest Partner
 * "Standortinformation") — anders als Objektdokumente NICHT einem einzelnen Objekt
 * zugeordnet, sondern wiederverwendbar für alle Objekte in derselben Gemeinde (siehe
 * regionMarketData.ts, Migration 0008). Reine Marktdaten-Verwaltung hier — die
 * Einordnung eines konkreten Objekts gegenüber seiner Gemeinde zeigt das
 * Markteinordnungs-Panel auf der jeweiligen Objektseite.
 */
export default async function RegionenPage() {
  const [regions, properties] = await Promise.all([listRegions(), getProperties()]);
  const configured = regions !== null;

  const propertyCountByRegionKey = new Map<string, number>();
  for (const p of properties ?? []) {
    if (!p.gemeinde) continue;
    const key = `${p.canton}::${normalizeGemeinde(p.gemeinde)}`;
    propertyCountByRegionKey.set(key, (propertyCountByRegionKey.get(key) ?? 0) + 1);
  }

  return (
    <div className="shell">
      <SideNav current="regionen" />
      <main className="main">
        <div className="pagehead">
          <h1>Regionen</h1>
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0 0 1rem" }}>
          Gemeinde-/Regions-Marktreports (z.B. Wüest Partner &quot;Standortinformation&quot;) — einmal pro Gemeinde
          hochgeladen, gelten für alle Objekte in dieser Gemeinde. Auf der jeweiligen Objektseite zeigt das
          Markteinordnungs-Panel, wo Miete/Kaufpreis des Objekts gegenüber diesen Marktdaten liegen.
        </p>

        {!configured ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              fehlen) — daher lassen sich hier noch keine Regionen anzeigen.
            </p>
          </Panel>
        ) : (
          <>
            <Panel style={{ padding: "1.1rem 1.3rem", marginBottom: "1.1rem" }}>
              <div className="eyebrow">Neue Region / neuen Report hochladen</div>
              <RegionUploadForm />
            </Panel>

            {regions.length === 0 ? (
              <Panel style={{ padding: "1.4rem 1.6rem" }}>
                <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: 0 }}>Noch keine Regionen erfasst.</p>
              </Panel>
            ) : (
              <Panel style={{ padding: "1.4rem 1.6rem" }}>
                <div className="eyebrow">
                  {regions.length} Region{regions.length === 1 ? "" : "en"}
                </div>
                <div className="twrap">
                  <table style={{ marginTop: "1rem" }}>
                    <thead>
                      <tr>
                        <th>Gemeinde</th>
                        <th>Kanton</th>
                        <th className="num">Objekte in dieser Gemeinde</th>
                        <th>Erfasst</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map((r) => {
                        const propertyCount = propertyCountByRegionKey.get(`${r.canton}::${normalizeGemeinde(r.gemeinde)}`) ?? 0;
                        return (
                          <tr key={r.id}>
                            <td>
                              <Link href={`/regionen/${r.id}`} className="maplink">
                                {r.gemeinde}
                              </Link>
                            </td>
                            <td>{r.canton}</td>
                            <td className="num mono">{propertyCount}</td>
                            <td>{formatDateTime(r.created_at)}</td>
                            <td style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                              <Link href={`/regionen/${r.id}`} className="maplink">
                                Details →
                              </Link>
                              <DeleteRegionButton regionId={r.id} label={`${r.gemeinde} (${r.canton})`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </>
        )}
      </main>
    </div>
  );
}
