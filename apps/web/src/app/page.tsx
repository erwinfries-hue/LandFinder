import Link from "next/link";
import { Panel, Icon, Ticker } from "@landfinder/ui";
import { ContourBackdrop } from "@/components/ContourBackdrop";
import { SideNav } from "@/components/SideNav";
import { RankingTable } from "@/components/RankingTable";
import { demoObjekte } from "@/lib/demo-data";

export default function DashboardPage() {
  return (
    <div className="shell">
      <ContourBackdrop />
      <SideNav current="uebersicht" />
      <main className="main">
        <div className="pagehead">
          <h1>Übersicht</h1>
          <div className="date mono">Mittwoch, 5. August 2026 · 07:42</div>
        </div>

        <Ticker
          items={[
            { value: 7, label: "Neue Treffer", sub: "seit 06:00 Uhr" },
            { value: 2, label: "A-Treffer", sub: "sofort prüfen", color: "var(--good)" },
            { value: 3, label: "Potenzial-A", sub: "Daten unvollständig", color: "var(--warn)" },
            { value: 1, label: "Preisreduktion", sub: "über Alert-Schwelle" },
            { value: 34, label: "Aktive Objekte", sub: "in Beobachtung" },
          ]}
        />

        <Panel className="cta-panel">
          <Icon name="import" width={22} />
          <input type="text" placeholder="https://… — beliebige öffentliche Angebotsseite einfügen" />
          <button className="btn" style={{ background: "var(--accent)" }}>
            Inseratslink analysieren
          </button>
        </Panel>

        <Panel style={{ padding: "1.3rem 1.4rem" }}>
          <div className="sectionhead">
            <h2>Rangliste — Top-Treffer</h2>
            <Link href="/objekte" className="more">
              Alle Objekte →
            </Link>
          </div>
          <RankingTable rows={demoObjekte} />
        </Panel>

        <div className="statusrow">
          <Panel style={{ padding: "1.2rem 1.3rem" }}>
            <div className="sectionhead">
              <h2>Quellenstatus</h2>
            </div>
            <div className="status-list">
              <StatusRow name="Homegate" meta="Direktadapter · letzter Lauf vor 12 Min." neu={4} />
              <StatusRow name="ImmoScout24" meta="Direktadapter · letzter Lauf vor 12 Min." neu={2} />
              <StatusRow name="newhome" meta="Direktadapter · letzter Lauf vor 41 Min." neu={1} warn />
              <StatusRow name="E-Mail-Import" meta="IMAP-Fallback · vor 3 Std." neu={0} />
              <StatusRow name="Manuelle Links" meta="On-Demand · vor 1 Std." neu={0} />
            </div>
          </Panel>
          <Panel style={{ padding: "1.2rem 1.3rem" }}>
            <div className="sectionhead">
              <h2>Letzte Fehler</h2>
            </div>
            <div className="errlog">
              <div className="t">Vor 2 Tagen</div>
              newhome — Layoutänderung, Detailseite nicht vollständig extrahierbar. Status: teilweise extrahiert.
            </div>
          </Panel>
        </div>

        <p style={{ marginTop: "2rem" }}>
          <Link href="/objekte/cham-chamerstrasse-2214" className="finelink">
            → Objekt-Detailseite ansehen (Demo)
          </Link>
        </p>
      </main>
    </div>
  );
}

function StatusRow({ name, meta, neu, warn }: { name: string; meta: string; neu: number; warn?: boolean }) {
  return (
    <div className="status-row">
      <span className="dot" style={warn ? { background: "var(--warn)" } : undefined} />
      <div>
        <div className="name">{name}</div>
        <div className="meta">{meta}</div>
      </div>
      <div className="newct">+{neu}</div>
    </div>
  );
}
