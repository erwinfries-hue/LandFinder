import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { getListings, getInboundAlerts } from "@/lib/listings";
import { getPersistedSearchProfile } from "@/lib/searchProfile";
import { QuellenListingsTable } from "@/components/quellen/QuellenListingsTable";
import { QuellenMailsTable } from "@/components/quellen/QuellenMailsTable";

export const metadata: Metadata = { title: "Quellen — SIPIS LandFinder" };

/**
 * `force-dynamic`: diese Seite zeigt live eingehende Suchabo-Mails/Inserate — ohne
 * diesen Export baut Next.js sie als statische Seite (kein erkennbarer
 * Request-abhängiger Code), eingefroren auf den Datenstand des letzten Deploys, statt
 * bei jedem Aufruf neu aus Supabase zu lesen (Bug gefunden am 2026-08-07: die Seite
 * zeigte "0 Mails", obwohl `inbound_alerts` bereits 22 echte Zeilen enthielt).
 */
export const dynamic = "force-dynamic";

/**
 * Übersicht der echten Stufe-1/2-Daten (Abschnitt 22/24): eingehende Suchabo-Mails
 * (`inbound_alerts`) und die daraus per Einzelseiten-Abruf extrahierten Inserate
 * (`listings`) — bisher nur über das Supabase-Dashboard einsehbar. Jeder Link führt
 * als aktiver Link zum Original-Inserat beim Portal.
 */
export default async function QuellenPage() {
  const [listings, alerts, searchProfile] = await Promise.all([getListings(), getInboundAlerts(), getPersistedSearchProfile()]);
  const configured = listings !== null && alerts !== null;

  return (
    <div className="shell">
      <SideNav current="quellen" />
      <main className="main">
        <div className="pagehead" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: ".8rem" }}>
          <h1>Quellen</h1>
          <Link href="/quellen/neu" className="btn" style={{ width: "auto" }}>
            + Bestandswohnung erfassen
          </Link>
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
            <input type="checkbox" id="widen-listings" className="widen-toggle" />
            <div className="widen-scope">
              <Panel style={{ padding: "1.4rem 1.6rem", marginBottom: "1.6rem" }}>
                <div className="widen-head">
                  <div className="eyebrow">
                    Übersicht · Stufe 2 · {listings!.length} Inserat{listings!.length === 1 ? "" : "e"}
                  </div>
                  <label htmlFor="widen-listings" className="widen-btn widen-btn-open">
                    Volle Breite
                  </label>
                  <label htmlFor="widen-listings" className="widen-btn widen-btn-close">
                    Normalansicht
                  </label>
                </div>
                <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: "0.4rem 0 1.1rem" }}>
                  Aus den Links der Suchabo-Mails abgerufene und extrahierte Inserate. Der Link führt jeweils direkt
                  zum Original-Inserat beim Portal. Spalten sind sortierbar (Klick auf den Titel).
                </p>
                {listings!.length === 0 ? (
                  <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Noch keine Inserate erfasst.</p>
                ) : (
                  <QuellenListingsTable rows={listings!} searchProfile={searchProfile} />
                )}
              </Panel>
            </div>

            <input type="checkbox" id="widen-mails" className="widen-toggle" />
            <div className="widen-scope">
              <Panel style={{ padding: "1.4rem 1.6rem" }}>
                <div className="widen-head">
                  <div className="eyebrow">
                    Eingehende Suchabo-Mails · {alerts!.length} Mail{alerts!.length === 1 ? "" : "s"}
                  </div>
                  <label htmlFor="widen-mails" className="widen-btn widen-btn-open">
                    Volle Breite
                  </label>
                  <label htmlFor="widen-mails" className="widen-btn widen-btn-close">
                    Normalansicht
                  </label>
                </div>
                <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: "0.4rem 0 1.1rem" }}>
                  Rohdaten-Ablage der Discovery-Stufe (Abschnitt 22), bevor die Links oben in strukturierte Inserate
                  überführt werden.
                </p>
                {alerts!.length === 0 ? (
                  <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Noch keine Suchabo-Mails empfangen.</p>
                ) : (
                  <QuellenMailsTable rows={alerts!} />
                )}
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
