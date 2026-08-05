"use client";

import { useSyncExternalStore } from "react";
import type { SearchProfile } from "@landfinder/domain";
import { Panel, Icon } from "@landfinder/ui";
import {
  getSearchProfileServerSnapshot,
  getSearchProfileSnapshot,
  setSearchProfile,
  subscribeSearchProfile,
} from "@/lib/searchProfile";
import { PROFILE_SECTIONS } from "@/lib/profileFields";

type SectionRecord = Record<string, unknown>;

export function AlleWerteTabelle() {
  const profile = useSyncExternalStore(subscribeSearchProfile, getSearchProfileSnapshot, getSearchProfileServerSnapshot);

  function setField(sectionKey: keyof SearchProfile, fieldKey: string, value: number | boolean) {
    const section = profile[sectionKey] as unknown as SectionRecord;
    setSearchProfile({ ...profile, [sectionKey]: { ...section, [fieldKey]: value } });
  }

  return (
    <div>
      <div className="wizard-banner">
        <Icon name="doc" width={18} />
        <div>
          <strong>Alle Werte</strong> — jedes numerische/boolesche Feld des Suchprofils an einem Ort, als Ergänzung zu
          den einzelnen Wizard-Reitern (die dieselben Werte mit Erklärungen zeigen). Listen- und Textfelder (Kantone,
          Empfänger, Energiestandard etc.) bleiben in ihren jeweiligen Reitern. Änderungen hier sind sofort auch in
          den Wizard-Reitern sichtbar — beides liest/schreibt dasselbe Suchprofil.
        </div>
      </div>

      {PROFILE_SECTIONS.map((section) => {
        const values = profile[section.sectionKey] as unknown as SectionRecord;
        return (
          <Panel key={section.sectionKey} className="paramtable" style={{ padding: "1.2rem 1.3rem", marginBottom: "1.4rem" }}>
            <div className="sectionhead">
              <h2 style={{ fontSize: "1rem" }}>{section.title}</h2>
            </div>
            <div className="twrap">
              <table>
                <thead>
                  <tr>
                    <th>Feld</th>
                    <th className="num">Wert</th>
                    <th>Einheit</th>
                  </tr>
                </thead>
                <tbody>
                  {section.fields.map((field) => {
                    const raw = values[field.key];
                    return (
                      <tr key={field.key}>
                        <td style={{ fontWeight: 600 }}>{field.label}</td>
                        <td className="num">
                          {field.type === "boolean" ? (
                            <input
                              type="checkbox"
                              checked={Boolean(raw)}
                              onChange={(e) => setField(section.sectionKey, field.key, e.target.checked)}
                              style={{ accentColor: "var(--accent)" }}
                            />
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={typeof raw === "number" ? raw : ""}
                              onChange={(e) => setField(section.sectionKey, field.key, e.target.value === "" ? 0 : Number(e.target.value))}
                            />
                          )}
                        </td>
                        <td className="mono" style={{ color: "var(--ink-faint)", fontSize: ".75rem" }}>
                          {field.unit ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
