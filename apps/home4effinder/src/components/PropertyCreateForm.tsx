"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel, Chip } from "@landfinder/ui";
import type { DocumentExtractionResult, DueDiligenceDocumentType } from "@landfinder/domain";
import { AVAILABLE_CANTONS } from "@/lib/cantons";
import { DOCUMENT_TYPE_CATALOG } from "@/lib/documentTypes";

type PrefillFile = {
  file: File;
  documentType: DueDiligenceDocumentType;
  status: "ANALYZING" | "DONE" | "FAILED";
  extraction?: DocumentExtractionResult;
  error?: string;
};

/**
 * Minimale manuelle Objekt-Erfassung — bewusst knapp gehalten (nur, was die Engine
 * zwingend braucht). Alles Weitere folgt über "Bestandsrendite erfassen" auf der
 * Objektseite.
 *
 * Optional lässt sich vor dem Anlegen ein Exposé/Inserat (oder andere Dokumente)
 * hochladen — die Stufe-1-Analyse (`/api/properties/prefill`) läuft dann bereits
 * VOR dem Anlegen (es gibt noch kein property_id), liefert aber nur das
 * Extraktionsergebnis zurück, mit dem hier die vier Felder unten vorausgefüllt
 * werden (nie automatisch übernommen als Fakt, sondern als bearbeitbarer Vorschlag).
 * Beim tatsächlichen Anlegen wird das bereits berechnete Ergebnis an das neue Objekt
 * angehängt (`/api/properties/[id]/documents/attach`) statt ein zweites Mal
 * (teuer, langsam) analysiert zu werden.
 */
export function PropertyCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addressText, setAddressText] = useState("");
  const [canton, setCanton] = useState("");
  const [askingPriceChf, setAskingPriceChf] = useState("");
  const [wohnflaecheM2, setWohnflaecheM2] = useState("");
  const [listingUrl, setListingUrl] = useState("");

  const [prefillDocumentType, setPrefillDocumentType] = useState<DueDiligenceDocumentType>("EXPOSE_INSERAT");
  const [prefillFiles, setPrefillFiles] = useState<PrefillFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = (event.currentTarget.elements.namedItem("prefillFiles") as HTMLInputElement) ?? null;
    const files = input?.files ? Array.from(input.files) : [];
    if (files.length === 0) return;

    setAnalyzing(true);
    const newEntries: PrefillFile[] = files.map((file) => ({ file, documentType: prefillDocumentType, status: "ANALYZING" as const }));
    setPrefillFiles((prev) => [...prev, ...newEntries]);

    for (const entry of newEntries) {
      try {
        const formData = new FormData();
        formData.append("file", entry.file);
        formData.append("documentType", entry.documentType);
        const res = await fetch("/api/properties/prefill", { method: "POST", body: formData });
        const body = (await res.json()) as { analyzed?: boolean; extraction?: DocumentExtractionResult; error?: string };
        setPrefillFiles((prev) =>
          prev.map((p) => (p.file === entry.file ? { ...p, status: body.analyzed ? "DONE" : "FAILED", extraction: body.extraction, error: body.error } : p)),
        );
        if (body.analyzed && body.extraction?.basisdaten) {
          const b = body.extraction.basisdaten;
          if (b.adresseText) setAddressText(b.adresseText);
          if (b.kantonCode) setCanton(b.kantonCode);
          if (b.kaufpreisChf) setAskingPriceChf(String(b.kaufpreisChf));
          if (b.wohnflaecheM2) setWohnflaecheM2(String(b.wohnflaecheM2));
        }
      } catch {
        setPrefillFiles((prev) => (prev.map((p) => (p.file === entry.file ? { ...p, status: "FAILED", error: "Netzwerkfehler" } : p))));
      }
    }

    setAnalyzing(false);
    if (input) input.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressText: addressText.trim(),
          canton,
          askingPriceChf: Number(askingPriceChf),
          wohnflaecheM2: Number(wohnflaecheM2),
          listingUrl: listingUrl.trim(),
        }),
      });
      const body = (await res.json()) as { saved?: boolean; id?: string; error?: string };
      if (!res.ok || !body.saved || !body.id) {
        setError(body.error ?? "Anlegen fehlgeschlagen.");
        return;
      }

      // Bereits analysierte Dokumente ans neue Objekt anhängen — ohne erneute
      // Claude-Analyse, das Ergebnis ist schon da (siehe Kommentar am Komponentenkopf).
      const analyzed = prefillFiles.filter((p) => p.status === "DONE" && p.extraction);
      for (const p of analyzed) {
        const attachFormData = new FormData();
        attachFormData.append("file", p.file);
        attachFormData.append("documentType", p.documentType);
        attachFormData.append("extraction", JSON.stringify(p.extraction));
        try {
          await fetch(`/api/properties/${body.id}/documents/attach`, { method: "POST", body: attachFormData });
        } catch {
          // Nicht abbrechen — das Objekt ist bereits angelegt, ein einzelnes
          // fehlgeschlagenes Anhängen kann der Nutzer auf der Objektseite nachholen
          // (dort lässt sich dasselbe Dokument einfach nochmal hochladen).
        }
      }

      router.push(`/objekte/${body.id}`);
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

      <div style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "1rem 1.1rem", marginBottom: "1.4rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
          Optional: aus Dokumenten vorausfüllen
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: ".8rem", margin: "0 0 .8rem" }}>
          Exposé/Inserat (oder andere Dokumente) hier schon hochladen — die Felder unten werden, soweit erkennbar,
          automatisch vorausgefüllt (bleiben editierbar). Die Dokumente werden beim Anlegen direkt ans neue Objekt
          angehängt, keine zweite Analyse nötig.
        </p>
        <form onSubmit={handleAnalyze} style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: prefillFiles.length > 0 ? ".8rem" : 0 }}>
          <div className="field" style={{ minWidth: "220px" }}>
            <label htmlFor="prefillDocumentType">Dokumenttyp</label>
            <select id="prefillDocumentType" value={prefillDocumentType} onChange={(e) => setPrefillDocumentType(e.target.value as DueDiligenceDocumentType)}>
              {Object.values(DOCUMENT_TYPE_CATALOG).map((c) => (
                <option key={c.type} value={c.type}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="prefillFiles">PDF-Dateien</label>
            <input id="prefillFiles" name="prefillFiles" type="file" accept="application/pdf" multiple />
          </div>
          <button type="submit" className="btn" style={{ width: "auto" }} disabled={analyzing}>
            {analyzing ? "Analysiert…" : "Analysieren"}
          </button>
        </form>
        {prefillFiles.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: ".3rem" }}>
            {prefillFiles.map((p, i) => (
              <li key={i} style={{ fontSize: ".8125rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
                <Chip tone={p.status === "DONE" ? "good" : p.status === "FAILED" ? "bad" : "neutral"}>
                  {p.status === "ANALYZING" ? "Analysiert…" : p.status === "DONE" ? "Analysiert" : "Fehler"}
                </Chip>
                {p.file.name}
                {p.error ? <span style={{ color: "var(--bad)" }}>— {p.error}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="fieldgrid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="addressText">Adresse</label>
            <input
              id="addressText"
              type="text"
              required
              placeholder="z.B. Obere Haldenstrasse 42, 5610 Wohlen"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="canton">Kanton</label>
            <select id="canton" required value={canton} onChange={(e) => setCanton(e.target.value)}>
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
            <input
              id="askingPriceChf"
              type="number"
              step="1000"
              min="0"
              required
              value={askingPriceChf}
              onChange={(e) => setAskingPriceChf(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="wohnflaecheM2">Wohnfläche (m²)</label>
            <input
              id="wohnflaecheM2"
              type="number"
              step="0.5"
              min="1"
              required
              value={wohnflaecheM2}
              onChange={(e) => setWohnflaecheM2(e.target.value)}
            />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="listingUrl">Inserat-Link (optional)</label>
            <input
              id="listingUrl"
              type="url"
              placeholder="https://…"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
            />
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
