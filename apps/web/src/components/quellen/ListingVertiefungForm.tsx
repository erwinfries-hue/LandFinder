"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@landfinder/ui";
import type { BaupotenzialFacts, ListingVertiefungFacts } from "@/lib/listingVertiefung";

/**
 * Manuelle Ergänzungsmaske für "Objekt vertiefen" (docs/OPEN_DECISIONS.md) — trägt
 * genau die Angaben nach, die nie automatisch aus einer Suchabo-Mail kommen (Zone,
 * Ausnützungsziffer, ÖV-Güteklasse, Risiken …). Erst danach berechnet
 * `computeListingAnalysis` (apps/web/src/lib/objektAnalysis.ts) einen echten Score.
 */
export function ListingVertiefungForm({ listingId, existing }: { listingId: string; existing: ListingVertiefungFacts | null }) {
  const router = useRouter();
  const [method, setMethod] = useState<BaupotenzialFacts["method"]>(existing?.baupotenzial.method ?? "DENSITY_RATIO");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const num = (key: string): number | undefined => {
      const raw = form.get(key);
      if (typeof raw !== "string" || raw === "") return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };

    let baupotenzial: BaupotenzialFacts;
    if (method === "DENSITY_RATIO") {
      baupotenzial = { method, densityRatio: num("densityRatio") ?? 0 };
    } else if (method === "VOLUME_RATIO") {
      baupotenzial = { method, volumeRatio: num("volumeRatio") ?? 0 };
    } else {
      baupotenzial = { method, siteCoverageRatio: num("siteCoverageRatio") ?? 0, effectiveFloors: num("effectiveFloors") ?? 0 };
    }

    const riskKeys = ["altlasten", "naturgefahren", "gewaesser", "laerm", "planungszone", "zufahrt", "erschliessung", "baukostenrisiken"] as const;
    const facts = {
      baupotenzial,
      zoneLabel: String(form.get("zoneLabel") ?? ""),
      zoneVerification: String(form.get("zoneVerification") ?? "C"),
      overallVerification: String(form.get("overallVerification") ?? "C"),
      oevGueteklasse: String(form.get("oevGueteklasse") ?? "D"),
      erschliessungOk: form.get("erschliessungOk") === "on",
      zufahrtOk: form.get("zufahrtOk") === "on",
      risiken: Object.fromEntries(riskKeys.map((key) => [key, form.get(`risiko.${key}`) === "on"])),
      coordinates: { lat: num("lat") ?? 0, lon: num("lon") ?? 0 },
      egrid: String(form.get("egrid") ?? "") || undefined,
      existingBuildingAreaM2: num("existingBuildingAreaM2"),
      notes: String(form.get("notes") ?? "") || undefined,
      marktAnnahmen: {
        localVacancyRatePercent: num("localVacancyRatePercent"),
        populationGrowth3yPercent: num("populationGrowth3yPercent"),
        rentLevelRatio: num("rentLevelRatio"),
        constructionActivityRatePercent: num("constructionActivityRatePercent"),
        zielmieterFitRatio: num("zielmieterFitRatio"),
        reachableResidents30min: num("reachableResidents30min"),
      },
    };

    try {
      const res = await fetch(`/api/listings/${listingId}/vertiefung`, {
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
    <Panel style={{ padding: "1.4rem 1.6rem", marginTop: "1.6rem" }}>
      <div className="eyebrow">Objekt vertiefen{existing ? " — bearbeiten" : ""}</div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.4rem 0 1.1rem" }}>
        Angaben, die nie automatisch aus einer Suchabo-Mail kommen. Erst danach lässt sich ein echter
        Score/Vertrauen/Empfehlung berechnen, wie bei der Cham-Demo.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="fieldgrid">
          <div className="field">
            <label htmlFor="baupotenzialMethode">Baupotenzial-Methode</label>
            <select
              id="baupotenzialMethode"
              value={method}
              onChange={(e) => setMethod(e.target.value as BaupotenzialFacts["method"])}
            >
              <option value="DENSITY_RATIO">Ausnützungsziffer (AZ)</option>
              <option value="VOLUME_RATIO">Baumassenziffer</option>
              <option value="COVERAGE_RATIO">Überbauungsziffer + Geschosse</option>
            </select>
          </div>

          {method === "DENSITY_RATIO" && (
            <div className="field">
              <label htmlFor="densityRatio">Ausnützungsziffer</label>
              <input
                id="densityRatio"
                name="densityRatio"
                type="number"
                step="0.01"
                required
                defaultValue={existing?.baupotenzial.method === "DENSITY_RATIO" ? existing.baupotenzial.densityRatio : undefined}
              />
            </div>
          )}
          {method === "VOLUME_RATIO" && (
            <div className="field">
              <label htmlFor="volumeRatio">Baumassenziffer (m³/m²)</label>
              <input
                id="volumeRatio"
                name="volumeRatio"
                type="number"
                step="0.01"
                required
                defaultValue={existing?.baupotenzial.method === "VOLUME_RATIO" ? existing.baupotenzial.volumeRatio : undefined}
              />
            </div>
          )}
          {method === "COVERAGE_RATIO" && (
            <>
              <div className="field">
                <label htmlFor="siteCoverageRatio">Überbauungsziffer</label>
                <input
                  id="siteCoverageRatio"
                  name="siteCoverageRatio"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={existing?.baupotenzial.method === "COVERAGE_RATIO" ? existing.baupotenzial.siteCoverageRatio : undefined}
                />
              </div>
              <div className="field">
                <label htmlFor="effectiveFloors">Anzahl Geschosse</label>
                <input
                  id="effectiveFloors"
                  name="effectiveFloors"
                  type="number"
                  step="1"
                  required
                  defaultValue={existing?.baupotenzial.method === "COVERAGE_RATIO" ? existing.baupotenzial.effectiveFloors : undefined}
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="zoneLabel">Zonenbezeichnung</label>
            <input id="zoneLabel" name="zoneLabel" type="text" required placeholder="z.B. W3" defaultValue={existing?.zoneLabel} />
          </div>
          <div className="field">
            <label htmlFor="zoneVerification">Zonen-Verifikation</label>
            <select id="zoneVerification" name="zoneVerification" defaultValue={existing?.zoneVerification ?? "C"}>
              <option value="A">A — amtlich bestätigt</option>
              <option value="B">B — amtliches Dokument vorhanden, nicht bestätigt</option>
              <option value="C">C — ungeprüft</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="overallVerification">Gesamtverifikation</label>
            <select id="overallVerification" name="overallVerification" defaultValue={existing?.overallVerification ?? "C"}>
              <option value="A">A — amtlich bestätigt</option>
              <option value="B">B — amtliches Dokument vorhanden, nicht bestätigt</option>
              <option value="C">C — ungeprüft</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="oevGueteklasse">ÖV-Güteklasse</label>
            <select id="oevGueteklasse" name="oevGueteklasse" defaultValue={existing?.oevGueteklasse ?? "D"}>
              <option value="A">A — sehr gut erschlossen</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D — schlecht erschlossen</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="egrid">EGRID (optional)</label>
            <input id="egrid" name="egrid" type="text" placeholder="z.B. CH685284972" defaultValue={existing?.egrid} />
          </div>
          <div className="field">
            <label htmlFor="lat">Breitengrad</label>
            <input id="lat" name="lat" type="number" step="0.0001" required defaultValue={existing?.coordinates.lat} />
          </div>
          <div className="field">
            <label htmlFor="lon">Längengrad</label>
            <input id="lon" name="lon" type="number" step="0.0001" required defaultValue={existing?.coordinates.lon} />
          </div>
          <div className="field">
            <label htmlFor="existingBuildingAreaM2">Bestehende Gebäudefläche m² (nur Abbruchobjekt)</label>
            <input
              id="existingBuildingAreaM2"
              name="existingBuildingAreaM2"
              type="number"
              step="1"
              defaultValue={existing?.existingBuildingAreaM2}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: "1rem" }}>
          <div className="checkbox-row">
            <input id="erschliessungOk" name="erschliessungOk" type="checkbox" defaultChecked={existing?.erschliessungOk ?? true} />
            <label htmlFor="erschliessungOk" style={{ marginBottom: 0 }}>
              Erschliessung gesichert (Hard Gate)
            </label>
          </div>
        </div>
        <div className="field">
          <div className="checkbox-row">
            <input id="zufahrtOk" name="zufahrtOk" type="checkbox" defaultChecked={existing?.zufahrtOk ?? true} />
            <label htmlFor="zufahrtOk" style={{ marginBottom: 0 }}>
              Zufahrt gesichert (Hard Gate)
            </label>
          </div>
        </div>

        <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
          Weiche Risikofaktoren
        </div>
        <div className="fieldgrid">
          {(
            [
              ["altlasten", "Altlasten"],
              ["naturgefahren", "Naturgefahr"],
              ["gewaesser", "Gewässerabstand"],
              ["laerm", "Lärm"],
              ["planungszone", "Planungszone"],
              ["zufahrt", "Zufahrt unsicher (weicher Risikofaktor trotz Hard Gate)"],
              ["erschliessung", "Erschliessung unsicher (weicher Risikofaktor trotz Hard Gate)"],
              ["baukostenrisiken", "Baukosten nur Inseratsangabe, nicht extern bestätigt"],
            ] as const
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <div className="checkbox-row">
                <input id={`risiko.${key}`} name={`risiko.${key}`} type="checkbox" defaultChecked={existing?.risiken[key] ?? false} />
                <label htmlFor={`risiko.${key}`} style={{ marginBottom: 0 }}>
                  {label}
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
          Markt-/Lage-Annahmen (optional — ohne Angabe gilt ein neutraler Default, transparent ausgewiesen)
        </div>
        <div className="fieldgrid">
          <div className="field">
            <label htmlFor="localVacancyRatePercent">Lokaler Leerstand %</label>
            <input
              id="localVacancyRatePercent"
              name="localVacancyRatePercent"
              type="number"
              step="0.1"
              defaultValue={existing?.marktAnnahmen?.localVacancyRatePercent}
            />
          </div>
          <div className="field">
            <label htmlFor="reachableResidents30min">Erreichbare Einwohner (30 Min.)</label>
            <input
              id="reachableResidents30min"
              name="reachableResidents30min"
              type="number"
              step="1000"
              defaultValue={existing?.marktAnnahmen?.reachableResidents30min}
            />
          </div>
          <div className="field">
            <label htmlFor="populationGrowth3yPercent">Bevölkerungswachstum 3J %</label>
            <input
              id="populationGrowth3yPercent"
              name="populationGrowth3yPercent"
              type="number"
              step="0.1"
              defaultValue={existing?.marktAnnahmen?.populationGrowth3yPercent}
            />
          </div>
          <div className="field">
            <label htmlFor="rentLevelRatio">Mietniveau-Verhältnis (1.0 = Kantonsschnitt)</label>
            <input id="rentLevelRatio" name="rentLevelRatio" type="number" step="0.01" defaultValue={existing?.marktAnnahmen?.rentLevelRatio} />
          </div>
          <div className="field">
            <label htmlFor="constructionActivityRatePercent">Bautätigkeit %</label>
            <input
              id="constructionActivityRatePercent"
              name="constructionActivityRatePercent"
              type="number"
              step="0.1"
              defaultValue={existing?.marktAnnahmen?.constructionActivityRatePercent}
            />
          </div>
          <div className="field">
            <label htmlFor="zielmieterFitRatio">Zielmieter-Fit (0–1)</label>
            <input
              id="zielmieterFitRatio"
              name="zielmieterFitRatio"
              type="number"
              step="0.05"
              min="0"
              max="1"
              defaultValue={existing?.marktAnnahmen?.zielmieterFitRatio}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: "1rem" }}>
          <label htmlFor="notes">Notizen (z.B. ÖREB-Status, Quelle der Zonenangabe)</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={existing?.notes} style={{ width: "100%" }} />
        </div>

        {error ? (
          <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: "1rem" }}>{error}</p>
        ) : null}

        <div className="wizard-actions">
          <button type="submit" className="btn" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Speichert…" : existing ? "Änderungen speichern" : "Vertiefung speichern"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
