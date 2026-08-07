import Link from "next/link";
import type { Metadata } from "next";
import { Panel, Chip, ListingLink, InfoHint } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { formatChf } from "@/lib/demo-data";
import { getListings, getInboundAlerts, listingStatus, objectTypeLabel, formatDateTime } from "@/lib/listings";
import { getPersistedSearchProfile } from "@/lib/searchProfile";
import { prescreenListing } from "@/lib/listingPrescreen";

export const metadata: Metadata = { title: "Quellen — SIPIS LandFinder" };

/**
 * Übersicht der echten Stufe-1/2-Daten (Abschnitt 22/24): eingehende Suchabo-Mails
 * (`inbound_alerts`) und die daraus per Einzelseiten-Abruf extrahierten Inserate
 * (`listings`) — bisher nur über das Supabase-Dashboard einsehbar. Jeder Link führt
 * als aktiver Link zum Original-Inserat beim Portal.
 */
const PRESCREEN_STATUS_CHIP: Record<"PASSED" | "REJECTED" | "INSUFFICIENT_DATA", { label: string; tone: "good" | "bad" | "neutral" }> = {
  PASSED: { label: "Passt", tone: "good" },
  REJECTED: { label: "Ausserhalb", tone: "bad" },
  INSUFFICIENT_DATA: { label: "Zu wenig Daten", tone: "neutral" },
};

export default async function QuellenPage() {
  const [listings, alerts, searchProfile] = await Promise.all([getListings(), getInboundAlerts(), getPersistedSearchProfile()]);
  const configured = listings !== null && alerts !== null;

  return (
    <div className="shell">
      <SideNav current="quellen" />
      <main className="main">
        <div className="pagehead">
          <h1>Quellen</h1>
        </div>

        {!configured ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> fehlen) — daher sind hier weder eingehende Suchabo-Mails noch
              daraus extrahierte Inserate sichtbar.
            </p>
          </Panel>
        ) : (
          <>
            <Panel style={{ padding: "1.4rem 1.6rem", marginBottom: "1.6rem" }}>
              <div className="eyebrow">
                Übersicht · Stufe 2 · {listings!.length} Inserat{listings!.length === 1 ? "" : "e"}
              </div>
              <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: "0.4rem 0 1.1rem" }}>
                Aus den Links der Suchabo-Mails abgerufene und extrahierte Inserate. Der Link führt jeweils direkt zum
                Original-Inserat beim Portal.
              </p>
              {listings!.length === 0 ? (
                <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Noch keine Inserate erfasst.</p>
              ) : (
                <div className="twrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Inserat</th>
                        <th style={{ textAlign: "left" }}>Kanton</th>
                        <th style={{ textAlign: "left" }}>Typ</th>
                        <th>Preis</th>
                        <th>Fläche</th>
                        <th style={{ textAlign: "left" }}>Status</th>
                        <th style={{ textAlign: "left" }}>
                          Suchprofil <InfoHint text="Automatische Vorprüfung: Kanton, Objektart, Preis-Obergrenze, Preis/m²-Obergrenze, Flächen-Spanne — keine volle Score/Empfehlung, dafür fehlen Zonendaten." />
                        </th>
                        <th>Zuletzt gesehen</th>
                        <th>Original</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings!.map((l) => {
                        const st = listingStatus(l.ingestion_status);
                        const prescreen = prescreenListing(l, searchProfile);
                        const prescreenChip = PRESCREEN_STATUS_CHIP[prescreen.status];
                        return (
                          <tr key={l.id}>
                            <td style={{ textAlign: "left" }}>
                              <Link href={`/quellen/${l.id}`} className="objcell" style={{ display: "block" }}>
                                <div className="m">{l.title || l.address_text || "Ohne Titel"}</div>
                                <div className="g">{l.source}</div>
                              </Link>
                            </td>
                            <td style={{ textAlign: "left" }} className="mono">
                              {l.canton ?? "—"}
                            </td>
                            <td style={{ textAlign: "left" }}>{objectTypeLabel(l.object_type)}</td>
                            <td className="num mono">
                              {l.asking_price_chf != null ? `CHF ${formatChf(l.asking_price_chf)}` : "—"}
                            </td>
                            <td className="num mono">
                              {l.parcel_area_m2 != null ? `${formatChf(l.parcel_area_m2)} m²` : "—"}
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <Chip tone={st.tone}>{st.label}</Chip>
                            </td>
                            <td style={{ textAlign: "left" }}>
                              <Link href={`/quellen/${l.id}`}>
                                <Chip tone={prescreenChip.tone}>{prescreenChip.label}</Chip>
                              </Link>
                            </td>
                            <td className="num mono">{formatDateTime(l.last_seen_at)}</td>
                            <td>
                              <ListingLink url={l.canonical_url} label="Öffnen" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel style={{ padding: "1.4rem 1.6rem" }}>
              <div className="eyebrow">
                Eingehende Suchabo-Mails · {alerts!.length} Mail{alerts!.length === 1 ? "" : "s"}
              </div>
              <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: "0.4rem 0 1.1rem" }}>
                Rohdaten-Ablage der Discovery-Stufe (Abschnitt 22), bevor die Links oben in strukturierte Inserate
                überführt werden.
              </p>
              {alerts!.length === 0 ? (
                <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Noch keine Suchabo-Mails empfangen.</p>
              ) : (
                <div className="twrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Empfangen</th>
                        <th style={{ textAlign: "left" }}>Von</th>
                        <th style={{ textAlign: "left" }}>Betreff</th>
                        <th style={{ textAlign: "left" }}>Verarbeitet</th>
                        <th style={{ textAlign: "left" }}>Links im Inserat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts!.map((a) => (
                        <tr key={a.id}>
                          <td className="mono">{formatDateTime(a.received_at)}</td>
                          <td>{a.from_address}</td>
                          <td style={{ textAlign: "left" }}>{a.subject}</td>
                          <td style={{ textAlign: "left" }}>
                            <Chip tone={a.processed ? "good" : "neutral"}>
                              {a.processed ? "Verarbeitet" : "Ausstehend"}
                            </Chip>
                          </td>
                          <td style={{ textAlign: "left" }}>
                            {a.listing_links.length === 0 ? (
                              <span style={{ color: "var(--ink-faint)" }}>—</span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
                                {a.listing_links.map((url, i) => (
                                  <ListingLink key={url} url={url} label={`Link ${i + 1} öffnen`} />
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
