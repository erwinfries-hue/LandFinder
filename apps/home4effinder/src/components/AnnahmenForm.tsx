"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Panel } from "@landfinder/ui";
import { BESTANDSRENDITE_PARAMETERS, type BestandsrenditeParameterKey } from "@landfinder/financial-engine";
import type { ParameterOverrides } from "@/lib/bestandsrendite";

const P = BESTANDSRENDITE_PARAMETERS;

/** Grobe thematische Gruppierung der Registry — rein für die Darstellung, keine eigene Datenstruktur. */
const GROUPS: { title: string; keys: BestandsrenditeParameterKey[] }[] = [
  { title: "Finanzierung — Vorschlagswerte für neue Objekte", keys: ["ersteHypothekBelehnungPercentDefault", "zweiteHypothekBelehnungPercentDefault", "zinsPercentDefault"] },
  { title: "Renditeziele (reine Referenzwerte, ohne Einfluss auf die Ampel-Bewertung)", keys: ["bruttoRenditeZielPercent", "nettoRenditeZielPercent"] },
  { title: "Leerstand & Vermietung", keys: ["leerstandLangfristigPercent", "leerstandMoebliertPercent"] },
  { title: "Kaufnebenkosten", keys: ["handaenderungssteuerPercent", "notariatGrundbuchPercent", "maklerprovisionPercent"] },
  { title: "Eigene Reserven", keys: ["reparaturreservePercentOfKaufpreis", "leerstandsreservePercentOfKaufpreis"] },
  { title: "Steuer", keys: ["kalkulatorischerSteuersatzPercent"] },
  { title: "Möblierung", keys: ["moeblierungNutzungsdauerJahre", "moeblierungErsatzquotePercent"] },
  {
    title: "15-Jahres-Modell",
    keys: ["holdingPeriodYearsDefault", "mietsteigerungPercentPerYear", "kosteninflationPercentPerYear", "wertsteigerungPercentPerYear", "sellingCostPercent"],
  },
  { title: "Verhandlungskorridor", keys: ["verhandlungsmargeZielPercent", "verhandlungsmargeEroeffnungPercent"] },
];

/**
 * Editierbares Register aller in `BESTANDSRENDITE_PARAMETERS` benannten Annahmen
 * (Rückmeldung: "einen Reiter machen, welcher alle Variablen enthält [...], diese Werte
 * sollen da auch anpassbar sein und entsprechend für die Berechnungen gezogen werden") —
 * genau das bereits im Registry-Kommentar (parameters.ts) als künftiges Ziel angelegte
 * "Annahmen"-Register. Überschreibungen landen in `app_settings` (Migration 0007) und
 * gelten global für ALLE Objekte — nicht pro Objekt (die bleiben weiterhin per Feld
 * individuell überschreibbar, wie bisher). Leer gelassene Felder beim Speichern setzen
 * die Überschreibung zurück auf den Registry-Default, statt sie einfach zu ignorieren —
 * "nichts wird stillschweigend erfunden" gilt auch für das Zurücksetzen selbst.
 */
export function AnnahmenForm({ overrides }: { overrides: ParameterOverrides }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const values: Record<string, number | null> = {};
      for (const key of Object.keys(P) as BestandsrenditeParameterKey[]) {
        const raw = form.get(key);
        const text = typeof raw === "string" ? raw.trim() : "";
        values[key] = text === "" ? null : Number(text);
      }
      const res = await fetch("/api/settings/parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await res.json().catch(() => ({}))) as { saved?: boolean; error?: string };
      if (!res.ok || !body.saved) {
        setError(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setSaving(false);
    }
  }

  function resetField(key: BestandsrenditeParameterKey) {
    const input = formRef.current?.elements.namedItem(key);
    if (input instanceof HTMLInputElement) input.value = "";
  }

  return (
    <Panel style={{ padding: "1.4rem 1.6rem" }}>
      <div className="eyebrow">Annahmen — global für alle Objekte</div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.4rem 0 1.1rem" }}>
        Jeder Wert unten ist ein benannter Parameter, der irgendwo in den Berechnungen verwendet wird — mit Standardwert
        (angezeigt als Platzhalter). Ein hier gesetzter Wert überschreibt den Standard ab sofort für alle Objekte;
        leer lassen und speichern setzt ihn wieder zurück. Objekte, die ein Feld selbst erfasst haben (z.B. Belehnung,
        Zinssatz im Erfassungsformular), sind davon nicht betroffen — dort gilt weiterhin der individuell erfasste
        Wert.
      </p>
      <form ref={formRef} onSubmit={handleSubmit}>
        {GROUPS.map((group) => (
          <div key={group.title} style={{ marginTop: "1.1rem" }}>
            <div className="eyebrow" style={{ marginBottom: ".4rem" }}>
              {group.title}
            </div>
            <div className="fieldgrid">
              {group.keys.map((key) => {
                const descriptor = P[key];
                const currentOverride = overrides[key];
                return (
                  <div className="field" key={key}>
                    <label htmlFor={key}>
                      {descriptor.label} ({descriptor.unit}, Standard: {descriptor.defaultValue})
                    </label>
                    <div style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                      <input id={key} name={key} type="number" step="any" defaultValue={currentOverride ?? ""} placeholder={String(descriptor.defaultValue)} />
                      {currentOverride !== undefined ? (
                        <button
                          type="button"
                          className="btn"
                          style={{ width: "auto", padding: ".2rem .5rem", fontSize: ".7rem" }}
                          onClick={() => resetField(key)}
                          title="Feld leeren — beim Speichern zurück auf den Standardwert"
                        >
                          Zurücksetzen
                        </button>
                      ) : null}
                    </div>
                    <p style={{ color: "var(--ink-faint)", fontSize: ".72rem", margin: ".25rem 0 0" }}>{descriptor.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {error ? <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: "1rem" }}>{error}</p> : null}
        {savedAt ? (
          <p style={{ color: "var(--good)", fontSize: ".8125rem", marginTop: "1rem" }}>Gespeichert — gilt ab sofort für alle Berechnungen.</p>
        ) : null}

        <div className="wizard-actions">
          <button type="submit" className="btn" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Speichert…" : "Annahmen speichern"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
