import type { Metadata } from "next";
import { Panel, Icon } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { QuelleUploadForm } from "@/components/QuelleUploadForm";
import { DeleteQuelleButton } from "@/components/DeleteQuelleButton";
import { listQuellen } from "@/lib/quellen";

export const metadata: Metadata = { title: "Quellen — HOME4efFINDER" };
export const dynamic = "force-dynamic";

/**
 * Quellenverzeichnis (Migration 0009) — allgemeine Studien/Marktberichte/
 * Referenzdokumente (z.B. UBS Wohnattraktivitätsindikator), unabhängig von einem
 * einzelnen Objekt oder einer Region. Rein zur Nachverfolgung/Verlinkung, siehe
 * src/lib/quellen.ts — anders als Regionsreports OHNE KI-Extraktion.
 */
export default async function QuellenPage() {
  const quellen = await listQuellen();
  const configured = quellen !== null;

  return (
    <div className="shell">
      <SideNav current="quellen" />
      <main className="main">
        <div className="pagehead">
          <h1>Quellen</h1>
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0 0 1rem" }}>
          Studien, Marktberichte und sonstige Referenzdokumente (z.B. UBS Wohnattraktivitätsindikator) — als Datei
          hochgeladen oder als externer Link erfasst. Rein informativ, ohne Bezug zu einem einzelnen Objekt.
        </p>

        {!configured ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              fehlen) — daher lassen sich hier noch keine Quellen anzeigen.
            </p>
          </Panel>
        ) : (
          <>
            <Panel style={{ padding: "1.1rem 1.3rem", marginBottom: "1.1rem" }}>
              <div className="eyebrow">Neue Quelle hinzufügen</div>
              <QuelleUploadForm />
            </Panel>

            {quellen.length === 0 ? (
              <Panel style={{ padding: "1.4rem 1.6rem" }}>
                <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: 0 }}>Noch keine Quellen erfasst.</p>
              </Panel>
            ) : (
              <Panel style={{ padding: "1.4rem 1.6rem" }}>
                <div className="eyebrow">
                  {quellen.length} Quelle{quellen.length === 1 ? "" : "n"}
                </div>
                <div className="twrap">
                  <table style={{ marginTop: "1rem" }}>
                    <thead>
                      <tr>
                        <th>Titel</th>
                        <th>Kategorie</th>
                        <th>Herausgeber</th>
                        <th>Datum</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {quellen.map((q) => (
                        <tr key={q.id}>
                          <td>
                            <a href={`/api/quellen/${q.id}/download`} target="_blank" rel="noopener noreferrer" className="maplink">
                              <Icon name="doc" width={14} /> {q.title}
                            </a>
                            {q.notes ? <div style={{ color: "var(--ink-faint)", fontSize: ".74rem", marginTop: ".2rem" }}>{q.notes}</div> : null}
                          </td>
                          <td>{q.category}</td>
                          <td>{q.publisher ?? "—"}</td>
                          <td>{q.published_date ? new Date(q.published_date).toLocaleDateString("de-CH") : "—"}</td>
                          <td>
                            <DeleteQuelleButton quelleId={q.id} label={q.title} />
                          </td>
                        </tr>
                      ))}
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
