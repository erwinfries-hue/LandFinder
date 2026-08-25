"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@landfinder/ui";
import { AVAILABLE_CANTONS } from "@/lib/cantons";
import type { PropertyRow } from "@/lib/properties";

/** Korrigiert die Objekt-Basisdaten nachträglich — z.B. einen Tippfehler in der Adresse, ohne das ganze Objekt neu anlegen zu müssen. */
export function PropertyEditForm({
  property,
}: {
  property: Pick<PropertyRow, "id" | "address_text" | "canton" | "gemeinde" | "asking_price_chf" | "wohnflaeche_m2" | "listing_url" | "market_reference_notes">;
}) {
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
    const gemeinde = String(form.get("gemeinde") ?? "").trim();
    const askingPriceChf = Number(form.get("askingPriceChf"));
    const wohnflaecheM2 = Number(form.get("wohnflaecheM2"));
    const listingUrl = String(form.get("listingUrl") ?? "").trim();
    const marketReferenceNotes = String(form.get("marketReferenceNotes") ?? "").trim();

    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressText, canton, gemeinde, askingPriceChf, wohnflaecheM2, listingUrl, marketReferenceNotes }),
      });
      const body = (await res.json()) as { saved?: boolean; error?: string };
      if (!res.ok || !body.saved) {
        setError(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel style={{ padding: "1.1rem 1.3rem", marginTop: "1.1rem" }}>
      <div className="eyebrow">Objekt-Basisdaten bearbeiten</div>
      <form onSubmit={handleSubmit}>
        <div className="fieldgrid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="edit-addressText">Adresse</label>
            <input id="edit-addressText" name="addressText" type="text" required defaultValue={property.address_text} />
          </div>
          <div className="field">
            <label htmlFor="edit-canton">Kanton</label>
            <select id="edit-canton" name="canton" required defaultValue={property.canton}>
              {AVAILABLE_CANTONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="edit-gemeinde">Gemeinde</label>
            <input id="edit-gemeinde" name="gemeinde" type="text" placeholder="z.B. Wohlen" defaultValue={property.gemeinde ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="edit-askingPriceChf">Kaufpreis (CHF, Wohnung — ggf. inkl. Parkplatz/Garage, falls im Preis enthalten)</label>
            <input id="edit-askingPriceChf" name="askingPriceChf" type="number" step="1000" min="0" required defaultValue={property.asking_price_chf} />
          </div>
          <div className="field">
            <label htmlFor="edit-wohnflaecheM2">Wohnfläche (m²)</label>
            <input id="edit-wohnflaecheM2" name="wohnflaecheM2" type="number" step="0.5" min="1" required defaultValue={property.wohnflaeche_m2} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="edit-listingUrl">Inserat-Link (optional)</label>
            <input id="edit-listingUrl" name="listingUrl" type="url" placeholder="https://…" defaultValue={property.listing_url ?? ""} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="edit-marketReferenceNotes">Marktvergleich (optional, frei eintragen)</label>
            <textarea
              id="edit-marketReferenceNotes"
              name="marketReferenceNotes"
              rows={4}
              placeholder="z.B. selbst recherchierte Vergleichsmieten/Preise pro m² aus Inseraten in der Umgebung — wird nie automatisch abgerufen, nur was du hier einträgst."
              defaultValue={property.market_reference_notes ?? ""}
            />
          </div>
        </div>

        {error ? <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: "1rem" }}>{error}</p> : null}

        <div className="wizard-actions">
          <button type="submit" className="btn" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Speichert…" : "Änderungen speichern"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
