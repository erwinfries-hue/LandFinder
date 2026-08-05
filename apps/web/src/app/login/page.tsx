import type { Metadata } from "next";
import { Panel, Icon } from "@landfinder/ui";
import { ContourBackdrop } from "@/components/ContourBackdrop";

export const metadata: Metadata = {
  title: "Anmeldung — SIPIS LandFinder",
};

export default function LoginPage() {
  return (
    <div className="login-screen">
      <ContourBackdrop />
      <div className="login-grid">
        <div className="brandblock">
          <div className="word">SIPIS</div>
          <h1>
            Land<em>Finder</em>
          </h1>
          <p className="lede">
            Privates Vorprüfungs- und Investmentinstrument für Bauland und Grundstücke mit Abbruchobjekt in der
            Schweiz.
          </p>
          <div className="factlist">
            <div>
              <span className="k mono">REGIONEN</span>
              <span className="v">Zürich · Zug · Schwyz · Aargau · Luzern · Obwalden · Nidwalden</span>
            </div>
            <div>
              <span className="k mono">QUELLEN</span>
              <span className="v">Homegate · ImmoScout24 · newhome · manueller Linkimport</span>
            </div>
            <div>
              <span className="k mono">SUCHPROFIL</span>
              <span className="v">Version 3 — aktualisiert 28.07.2026</span>
            </div>
          </div>
        </div>

        <Panel className="loginpanel">
          <div className="eyebrow">Anmeldung</div>
          <h2>Willkommen zurück</h2>
          <div style={{ height: "1.4rem" }} />
          <form>
            <div className="field">
              <label htmlFor="lf-email">E-Mail-Adresse</label>
              <input id="lf-email" type="email" placeholder="name@beispiel.ch" />
            </div>
            <div className="field">
              <label htmlFor="lf-pw">Passwort</label>
              <input id="lf-pw" type="password" placeholder="••••••••••••" />
            </div>
            <div className="rowbetween">
              <label>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} /> Angemeldet bleiben
              </label>
              <a href="#" className="finelink">
                Passwort vergessen?
              </a>
            </div>
            <button type="submit" className="btn">
              Anmelden <Icon name="import" style={{ transform: "rotate(-90deg)" }} />
            </button>
          </form>
        </Panel>
      </div>
      <p className="disclaimer">
        SIPIS LandFinder dient der internen Vorprüfung. Ersetzt keine verbindliche Bauabklärung, Architektenplanung,
        juristische Prüfung, Bankzusage oder Verkehrswertschätzung.
      </p>
    </div>
  );
}
