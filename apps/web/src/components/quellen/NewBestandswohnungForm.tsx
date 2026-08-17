"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@landfinder/ui";
import { AVAILABLE_CANTONS } from "@/lib/searchProfile";

/**
 * Minimale manuelle Objekt-Erfassung für BESTANDSWOHNUNG (docs/OPEN_DECISIONS.md,
 * Punkt N) — der einzige Weg, wie diese Objektart aktuell entsteht, da die
 * automatische Alert-Mail-Pipeline sie noch nicht erkennt. Bewusst knapp gehalten
 * (nur, was die Engine zwingend braucht) — alles Weitere folgt über "Bestandsrendite
 * erfassen" auf der Detailseite.
 */
export function NewBestandswohnungForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const addressText = String(form.get("addressText") ?? "").trim();
    const canton = String(form.get("canton") ?? "");
    const askingPriceChf = Number(form.get("askingPriceChf"));
    const wohnflaecheM2 = Number(form.get("wohnflaecheM2"));

    try {
      const res = await fetch("/api/listings/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressText, canton, askingPriceChf, wohnflaecheM2 }),
      });
      const body = (await res.json()) as { saved?: boolean; id?: string; error?: string };
      if (!res.ok || !body.saved || !body.id) {
        setError(body.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      router.push(`/quellen/${body.id}`);
    } catch {
      setError("Anlegen fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel style={{ padding: "1.4rem 1.6rem" }}>
      <div className="eyebrow">Neue Bestandswohnung erfassen</div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.4rem 0 1.1rem" }}>
        Nur für bestehende Eigentumswohnungen als reines Rendite-/Buy-to-let-Objekt — nicht für Mehrfamilienhäuser,
        Einfamilienhäuser, Gewerbeobjekte, Bauland oder Neubauprojekte. Nach dem Anlegen folgen Bestandsrendite-Fakten
        und Due-Diligence-Dokumente auf der Objektseite.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="fieldgrid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="addressText">Adresse</label>
            <input id="addressText" name="addressText" type="text" required placeholder="z.B. Obere Haldenstrasse 42, 5610 Wohlen" />
          </div>
          <div className="field">
            <label htmlFor="canton">Kanton</label>
            <select id="canton" name="canton" required defaultValue="">
              <option value="" disabled>
                Bitte wählen
              </option>
              {AVAILABLE_CANTONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="askingPriceChf">Kaufpreis (CHF)</label>
            <input id="askingPriceChf" name="askingPriceChf" type="number" step="1000" min="1" required />
          </div>
          <div className="field">
            <label htmlFor="wohnflaecheM2">Wohnfläche (m²)</label>
            <input id="wohnflaecheM2" name="wohnflaecheM2" type="number" step="0.5" min="1" required />
          </div>
        </div>

        {error ? <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: "1rem" }}>{error}</p> : null}

        <div className="wizard-actions">
          <button type="submit" className="btn" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Legt an…" : "Objekt anlegen"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
