"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@landfinder/ui";
import {
  getSearchProfileServerSnapshot,
  getSearchProfileSnapshot,
  setSearchProfile,
  subscribeSearchProfile,
} from "@/lib/searchProfile";
import {
  RegionenSection,
  BudgetSection,
  ObjektartSection,
  GrundstueckSection,
  ProjektzielSection,
  EigennutzungSection,
  MarktannahmenSection,
  BaukostenSection,
  FinanzierungSection,
  RenditezieleSection,
  RisikenSection,
  AlertsSection,
  QuellenSection,
} from "./sections";
import { AnnahmenRegister } from "./AnnahmenRegister";

const TABS = [
  "Regionen",
  "Budget",
  "Objektart",
  "Grundstück",
  "Projektziel",
  "Eigennutzung",
  "Marktannahmen",
  "Baukosten",
  "Finanzierung",
  "Renditeziele",
  "Risiken",
  "Alerts",
  "Quellen",
  "Annahmen & Formeln",
] as const;

export function SuchprofilWizard() {
  const profile = useSyncExternalStore(subscribeSearchProfile, getSearchProfileSnapshot, getSearchProfileServerSnapshot);
  const [activeTab, setActiveTab] = useState<number>(0);

  function setProfile(next: typeof profile) {
    setSearchProfile(next);
  }

  function bump() {
    setSearchProfile({ ...profile, version: profile.version + 1, updatedAt: new Date().toISOString().slice(0, 10) });
  }

  return (
    <div>
      <div className="wizard-banner">
        <Icon name="alert" width={18} />
        <div>
          Die Startwerte in diesem Suchprofil sind <strong>Schweizer Marktannahmen</strong>, keine bestätigten Werte
          (siehe <code>docs/OPEN_DECISIONS.md</code>, Punkt F). Änderungen werden lokal im Browser gespeichert — noch
          keine Anbindung an eine Datenbank (Phase 1, Schritt 5 von 5, Supabase folgt gemäss Punkt C).
        </div>
      </div>

      <div className="wizard-tabs">
        {TABS.map((tab, i) => (
          <button key={tab} className={`wizard-tab${i === activeTab ? " current" : ""}`} onClick={() => setActiveTab(i)}>
            <span className="n">{i + 1}</span>
            {tab}
          </button>
        ))}
      </div>

      <div className="wizard-section">
        {activeTab === 0 && <RegionenSection value={profile.regions} onChange={(v) => setProfile({ ...profile, regions: v })} />}
        {activeTab === 1 && <BudgetSection value={profile.budget} onChange={(v) => setProfile({ ...profile, budget: v })} />}
        {activeTab === 2 && <ObjektartSection value={profile.objektart} onChange={(v) => setProfile({ ...profile, objektart: v })} />}
        {activeTab === 3 && <GrundstueckSection value={profile.grundstueck} onChange={(v) => setProfile({ ...profile, grundstueck: v })} />}
        {activeTab === 4 && <ProjektzielSection value={profile.projektziel} onChange={(v) => setProfile({ ...profile, projektziel: v })} />}
        {activeTab === 5 && <EigennutzungSection value={profile.eigennutzung} onChange={(v) => setProfile({ ...profile, eigennutzung: v })} />}
        {activeTab === 6 && <MarktannahmenSection value={profile.marktannahmen} onChange={(v) => setProfile({ ...profile, marktannahmen: v })} />}
        {activeTab === 7 && <BaukostenSection value={profile.baukosten} onChange={(v) => setProfile({ ...profile, baukosten: v })} />}
        {activeTab === 8 && <FinanzierungSection value={profile.finanzierung} onChange={(v) => setProfile({ ...profile, finanzierung: v })} />}
        {activeTab === 9 && <RenditezieleSection value={profile.renditeziele} onChange={(v) => setProfile({ ...profile, renditeziele: v })} />}
        {activeTab === 10 && <RisikenSection value={profile.risiken} onChange={(v) => setProfile({ ...profile, risiken: v })} />}
        {activeTab === 11 && <AlertsSection value={profile.alerts} onChange={(v) => setProfile({ ...profile, alerts: v })} />}
        {activeTab === 12 && <QuellenSection value={profile.quellen} onChange={(v) => setProfile({ ...profile, quellen: v })} />}
        {activeTab === 13 && <AnnahmenRegister />}
      </div>

      {activeTab < 13 && (
        <div className="wizard-actions">
          <span className="eyebrow">
            Suchprofil Version {profile.version} — aktualisiert {profile.updatedAt}
          </span>
          <button
            className="btn"
            style={{ width: "auto", padding: ".65rem 1.2rem", background: "var(--accent)" }}
            onClick={bump}
          >
            Als neue Version speichern
          </button>
        </div>
      )}
    </div>
  );
}
