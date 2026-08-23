"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@landfinder/ui";
import type { Vermietungsmodell, RenovationPosition } from "@landfinder/financial-engine";
import type { BestandsrenditeFacts } from "@/lib/bestandsrendite";
import { BestandsrenditeFactsFields, emptyRenovationPosition } from "./BestandsrenditeFactsFields";
import { buildBestandsrenditeFactsFromFormData } from "@/lib/bestandsrenditeFormParsing";

/**
 * Erfassungsmaske für die Bestandsrendite-Fakten (`properties.bestandsrendite`,
 * Migration 0001) auf der Objekt-Bearbeiten-Seite. Jedes optionale Feld leer gelassen
 * fällt beim Berechnen auf den transparent ausgewiesenen Platzhalter-Default zurück
 * (siehe `computeBestandsrenditeAnalysis`). Die eigentlichen Felder kommen aus
 * `BestandsrenditeFactsFields` — dieselbe Komponente wird auch im kombinierten
 * Neu-Erfassen-Flow verwendet (`PropertyCreateForm`).
 */
export function BestandsrenditeVertiefungForm({ propertyId, existing, canton }: { propertyId: string; existing: BestandsrenditeFacts | null; canton?: string }) {
  const router = useRouter();
  const [vermietungsmodell, setVermietungsmodell] = useState<Vermietungsmodell>(existing?.miete.vermietungsmodell ?? "LANGFRISTIG_UNMOEBLIERT");
  const [renovationPositionen, setRenovationPositionen] = useState<RenovationPosition[]>(existing?.renovation.positionen ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRenovationPosition(index: number, patch: Partial<RenovationPosition>) {
    setRenovationPositionen((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function removeRenovationPosition(index: number) {
    setRenovationPositionen((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const facts = buildBestandsrenditeFactsFromFormData(form, vermietungsmodell, renovationPositionen);

    try {
      const res = await fetch(`/api/properties/${propertyId}/bestandsrendite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facts),
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
      <div className="eyebrow">Bestandsrendite-Fakten{existing ? " — bearbeiten" : " erfassen"}</div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.3rem 0 .8rem" }}>
        Nur Miete, Hypothek-Eckwerte und Vermietungsmodell sind Pflicht. Alle übrigen Felder mit &quot;Standard: …&quot;
        im Label sind bereits mit einem recherchierten Vorschlagswert vorausgefüllt (bei Kanton-abhängigen Werten wie
        Handänderungssteuer und Steuersatz auf {canton ?? "das Objekt"} bezogen) — einfach überschreiben, falls du es
        genauer weisst.
      </p>
      <form onSubmit={handleSubmit}>
        <BestandsrenditeFactsFields
          existing={existing}
          canton={canton}
          vermietungsmodell={vermietungsmodell}
          onVermietungsmodellChange={setVermietungsmodell}
          renovationPositionen={renovationPositionen}
          onAddRenovationPosition={() => setRenovationPositionen((prev) => [...prev, emptyRenovationPosition()])}
          onUpdateRenovationPosition={updateRenovationPosition}
          onRemoveRenovationPosition={removeRenovationPosition}
        />

        {error ? <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: "1rem" }}>{error}</p> : null}

        <div className="wizard-actions">
          <button type="submit" className="btn" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Speichert…" : existing ? "Änderungen speichern" : "Bestandsrendite speichern"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
