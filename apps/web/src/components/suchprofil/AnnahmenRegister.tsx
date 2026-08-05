"use client";

import { useSyncExternalStore } from "react";
import { Panel } from "@landfinder/ui";
import {
  ANNAHME_GROUPS,
  getAnnahmenServerSnapshot,
  getAnnahmenSnapshot,
  overrideKey,
  setAnnahmenOverrides,
  subscribeAnnahmen,
} from "@/lib/annahmen";

export function AnnahmenRegister() {
  const overrides = useSyncExternalStore(subscribeAnnahmen, getAnnahmenSnapshot, getAnnahmenServerSnapshot);

  function setValue(groupId: string, paramKey: string, value: number) {
    setAnnahmenOverrides({ ...overrides, [overrideKey(groupId, paramKey)]: value });
  }

  function resetGroup(groupId: string) {
    const next = { ...overrides };
    for (const key of Object.keys(next)) {
      if (key.startsWith(`${groupId}.`)) delete next[key];
    }
    setAnnahmenOverrides(next);
  }

  function resetAll() {
    setAnnahmenOverrides({});
  }

  return (
    <div>
      <div className="wizard-banner">
        <svg className="icon" width={18}>
          <use href="#i-doc" />
        </svg>
        <div>
          <strong>Annahmen &amp; Formeln</strong> — jeder Wert hier ist derselbe Default, den die Finanz- und
          Scoring-Formeln tatsächlich verwenden (<code>packages/financial-engine</code>,{" "}
          <code>packages/scoring-engine</code>). Änderungen hier werden lokal gespeichert (kein Server, keine
          Datenbank) und wirken sich in einer künftigen Anbindung direkt auf jede Berechnung aus, die diesen
          Parameter als Default nutzt.
        </div>
      </div>

      <div className="wizard-actions" style={{ marginTop: 0, borderTop: "none", paddingTop: 0, marginBottom: "1.2rem" }}>
        <span className="eyebrow">{Object.keys(overrides).length} Wert(e) überschrieben</span>
        <button onClick={resetAll} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: ".8125rem" }}>
          Alle auf Standard zurücksetzen
        </button>
      </div>

      {ANNAHME_GROUPS.map((group) => (
        <Panel key={group.id} className="paramtable" style={{ padding: "1.2rem 1.3rem", marginBottom: "1.4rem" }}>
          <div className="sectionhead">
            <div>
              <h2 style={{ fontSize: "1rem" }}>{group.title}</h2>
              <div className="fieldhelp" style={{ marginTop: ".2rem" }}>
                {group.description}
              </div>
            </div>
            <button
              onClick={() => resetGroup(group.id)}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: ".75rem" }}
            >
              Zurücksetzen
            </button>
          </div>
          <div className="twrap">
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Beschreibung</th>
                  <th>Quelle</th>
                  <th className="num">Wert</th>
                  <th>Einheit</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(group.registry).map((param) => {
                  const key = overrideKey(group.id, param.key);
                  const currentValue = overrides[key] ?? param.defaultValue;
                  const isOverridden = key in overrides;
                  return (
                    <tr key={param.key}>
                      <td style={{ fontWeight: 600 }}>{param.label}</td>
                      <td style={{ color: "var(--ink-soft)", fontSize: ".78rem" }}>{param.description}</td>
                      <td className="paramtable-source">{param.source}</td>
                      <td className="num">
                        <input
                          type="number"
                          step="any"
                          value={currentValue}
                          onChange={(e) => setValue(group.id, param.key, Number(e.target.value))}
                          style={isOverridden ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
                        />
                      </td>
                      <td className="mono" style={{ color: "var(--ink-faint)", fontSize: ".75rem" }}>
                        {param.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  );
}
