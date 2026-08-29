import type { Metadata } from "next";
import Image from "next/image";
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

        <Panel style={{ padding: "1.1rem 1.3rem", marginBottom: "1.1rem" }}>
          <div className="eyebrow">UBS Wohnattraktivitätsindikator 2026 — Übersicht</div>
          <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: ".3rem 0 .8rem" }}>
            Zwei Ausschnitte als schnelle visuelle Referenz zur UBS-Mitteilung (siehe Eintrag unten für den Link auf
            das vollständige Dokument): links die vollständige Rangliste je Einkommensklasse für eine Region (Beispiel
            Zentralschweiz) von{" "}
            <a href="https://www.ubs.com/gemeinderanking" target="_blank" rel="noopener noreferrer" className="maplink">
              ubs.com/gemeinderanking
            </a>
            , rechts die Top-3-Gemeinden-Übersichtskarte aus einer Blick-Berichterstattung zur Studie.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <figure style={{ margin: 0, flex: "1 1 260px", maxWidth: "320px" }}>
              <Image
                src="/quellen/ubs-wohnattraktivitaet-2026-region-zentralschweiz.jpg"
                alt="UBS Gemeinderanking: Rangliste Region Zentralschweiz nach mittlerem, niedrigem und hohem Einkommen"
                width={1080}
                height={2340}
                style={{ width: "100%", height: "auto", borderRadius: "6px", border: "1px solid var(--line)" }}
              />
              <figcaption style={{ fontSize: ".72rem", color: "var(--ink-faint)", marginTop: ".3rem" }}>
                Vollständige Rangliste je Einkommensklasse, Beispiel Region Zentralschweiz (ubs.com/gemeinderanking).
              </figcaption>
            </figure>
            <figure style={{ margin: 0, flex: "1 1 260px", maxWidth: "320px" }}>
              <Image
                src="/quellen/ubs-wohnattraktivitaet-2026-top3-karte.jpg"
                alt="Karte der Top-3-Gemeinden in den zehn UBS-Regionen, Wohnattraktivitätsindikator 2026"
                width={1080}
                height={2340}
                style={{ width: "100%", height: "auto", borderRadius: "6px", border: "1px solid var(--line)" }}
              />
              <figcaption style={{ fontSize: ".72rem", color: "var(--ink-faint)", marginTop: ".3rem" }}>
                Top-3-Gemeinden je Region auf einen Blick (Quelle: UBS Wohnattraktivitätsindikator 2026, © Blick Grafik).
              </figcaption>
            </figure>
          </div>
        </Panel>

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
