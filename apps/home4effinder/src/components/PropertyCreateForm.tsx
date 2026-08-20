"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel, Chip } from "@landfinder/ui";
import type { DocumentExtractionResult, DueDiligenceDocumentType, DueDiligenceResult } from "@landfinder/domain";
import type { RenovationPosition, Vermietungsmodell } from "@landfinder/financial-engine";
import { AVAILABLE_CANTONS } from "@/lib/cantons";
import { DOCUMENT_TYPE_CATALOG } from "@/lib/documentTypes";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dueDiligenceCategories";
import { guessDocumentType } from "@/lib/documentTypeGuess";
import { BestandsrenditeFactsFields, emptyRenovationPosition } from "./BestandsrenditeFactsFields";
import { buildBestandsrenditeFactsFromFormData } from "@/lib/bestandsrenditeFormParsing";
import { BESTANDSRENDITE_KNOWN_FIELD_LABELS } from "@/lib/bestandsrenditeKnownFields";

/** Datei, die ausgewählt aber noch nicht analysiert ist — Dokumenttyp aus dem Dateinamen vorgeschlagen (`documentTypeGuess.ts`), vor dem Hochladen editierbar. */
type StagedFile = { file: File; documentType: DueDiligenceDocumentType; guessed: boolean };

/** Bewusst dieselbe Grenze wie `MAX_PASTED_TEXT_LENGTH` in dueDiligenceExtraction.ts (nicht von dort importiert, um den Anthropic-SDK-Server-Code nicht ins Client-Bundle zu ziehen). */
const MAX_PASTED_TEXT_LENGTH = 200_000;

type PrefillFile = {
  file: File;
  documentType: DueDiligenceDocumentType;
  status: "ANALYZING" | "DONE" | "FAILED";
  extraction?: DocumentExtractionResult;
  error?: string;
};

/** Für die stateless Synthese/das spätere Speichern gebraucht — dieselbe Form wie `SynthesisDocumentInput` in dueDiligenceSynthesis.ts. */
type SynthesisDoc = { id: string; filename: string; documentType: DueDiligenceDocumentType; summary: string; facts: Record<string, unknown>; findings: unknown[] };

/**
 * Kombinierter Neu-Erfassen-Flow: Objekt-Basisdaten UND Bestandsrendite-Fakten in einem
 * einzigen Formular, optional vorausgefüllt aus vorab hochgeladenen Dokumenten (Exposé
 * ODER Due-Diligence-Unterlagen wie STWEG-Protokoll/Mietvertrag/Grundbuchauszug — alles,
 * was sonst auf der Objektseite einzeln nachgetragen würde).
 *
 * Ablauf: Dokumente hochladen & analysieren (Stufe 1, zustandslos, `/api/properties/
 * prefill`) → aus allen bisher analysierten Dokumenten automatisch eine
 * Due-Diligence-Synthese berechnen (Stufe 2, ebenfalls zustandslos, `/api/properties/
 * prefill-synthesis`) → deren Feldwert-Übernahmevorschläge füllen die Bestandsrendite-
 * Fakten-Felder unten vor. Was sich aus den Dokumenten nicht ableiten liess, bleibt ein
 * normales, leeres Feld im selben Formular (per Rückmeldung so gewünscht, statt eines
 * separaten Dialogs nur für die Lücken). Erst beim tatsächlichen "Bestandsrendite
 * speichern"-Klick wird das Objekt angelegt, die Fakten gespeichert, die Dokumente
 * angehängt und — falls eine Synthese gelaufen ist — die bereits berechnete
 * Due-Diligence direkt mitgespeichert, sodass sie auf der Objektseite sofort bereitsteht.
 * Keiner der Claude-Aufrufe läuft dabei ein zweites Mal.
 *
 * Bewusste Vereinfachung: die Bestandsrendite-Felder sind unkontrollierte Inputs
 * (`defaultValue`, wie überall in diesem Formular) — trifft eine neue/aktualisierte
 * Dokumenten-Analyse ein, wird die Feldgruppe per `key` neu gemountet, damit die neuen
 * Vorschlagswerte sichtbar werden. Das setzt auch bereits manuell eingetippte Werte in
 * diesen Feldern zurück — darum zuerst alle Dokumente hochladen, danach die restlichen
 * Lücken von Hand ergänzen, nicht umgekehrt.
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

  const [vermietungsmodell, setVermietungsmodell] = useState<Vermietungsmodell>("LANGFRISTIG_UNMOEBLIERT");
  const [renovationPositionen, setRenovationPositionen] = useState<RenovationPosition[]>([]);

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [prefillFiles, setPrefillFiles] = useState<PrefillFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteDocumentType, setPasteDocumentType] = useState<DueDiligenceDocumentType>("SONSTIGES");

  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<DueDiligenceResult | null>(null);
  const [synthesisDocuments, setSynthesisDocuments] = useState<SynthesisDoc[]>([]);
  const [docFieldProposals, setDocFieldProposals] = useState<Record<string, string | number>>({});
  const [factsFieldsVersion, setFactsFieldsVersion] = useState(0);

  function updateRenovationPosition(index: number, patch: Partial<RenovationPosition>) {
    setRenovationPositionen((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function removeRenovationPosition(index: number) {
    setRenovationPositionen((prev) => prev.filter((_, i) => i !== index));
  }

  async function runSynthesisPrefill(allFiles: PrefillFile[]) {
    const analyzed = allFiles.filter((p) => p.status === "DONE" && p.extraction);
    if (analyzed.length === 0) return;

    setSynthesizing(true);
    setSynthesisError(null);
    try {
      const documents: SynthesisDoc[] = analyzed.map((p, i) => ({
        id: String(i),
        filename: p.file.name,
        documentType: p.documentType,
        summary: p.extraction!.summary,
        facts: p.extraction!.facts,
        findings: p.extraction!.findings,
      }));
      const knownFacts: { label: string; value: string | number }[] = [];
      if (addressText.trim()) knownFacts.push({ label: "Adresse (laut Erfassung)", value: addressText.trim() });
      if (canton) knownFacts.push({ label: "Kanton", value: canton });
      if (askingPriceChf) knownFacts.push({ label: "Kaufpreis (CHF, laut Erfassung)", value: Number(askingPriceChf) });
      if (wohnflaecheM2) knownFacts.push({ label: "Wohnfläche (m², laut Erfassung)", value: Number(wohnflaecheM2) });
      const knownFields = BESTANDSRENDITE_KNOWN_FIELD_LABELS.map(({ field, label }) => ({ field, label }));

      const res = await fetch("/api/properties/prefill-synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents, knownFacts, knownFields }),
      });
      const body = (await res.json()) as { synthesized?: boolean; result?: DueDiligenceResult; error?: string };
      if (!body.synthesized || !body.result) {
        setSynthesisError(body.error ?? "Vorschläge aus den Dokumenten konnten nicht ermittelt werden.");
        return;
      }

      setSynthesisResult(body.result);
      setSynthesisDocuments(documents);
      const proposals: Record<string, string | number> = {};
      for (const p of body.result.fieldUpdateProposals) proposals[p.field] = p.newValue;
      setDocFieldProposals(proposals);
      setFactsFieldsVersion((v) => v + 1);
    } catch {
      setSynthesisError("Vorschläge aus den Dokumenten konnten nicht ermittelt werden (Netzwerkfehler).");
    } finally {
      setSynthesizing(false);
    }
  }

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      const newlyStaged: StagedFile[] = files.map((file) => {
        const guessed = guessDocumentType(file.name);
        return { file, documentType: guessed ?? "SONSTIGES", guessed: guessed !== undefined };
      });
      setStagedFiles((prev) => [...prev, ...newlyStaged]);
    }
    event.target.value = ""; // dieselbe Datei danach erneut auswählbar
  }
  function updateStagedType(index: number, documentType: DueDiligenceDocumentType) {
    setStagedFiles((prev) => prev.map((s, i) => (i === index ? { ...s, documentType, guessed: false } : s)));
  }
  function removeStaged(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /** Eingefügter Text wird als reguläre Text-Datei in den bestehenden Staging-/Analyse-Ablauf eingespiesen — kein separater Codepfad nötig. */
  function handleAddPastedText() {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    const filename = `${pasteTitle.trim() || "Eingefügter Text"}.txt`;
    const file = new File([trimmed], filename, { type: "text/plain" });
    setStagedFiles((prev) => [...prev, { file, documentType: pasteDocumentType, guessed: false }]);
    setPasteText("");
    setPasteTitle("");
  }

  /** Analysiert einen einzelnen Eintrag (Stufe 1) und liefert das aktualisierte Ergebnis — gemeinsam genutzt vom Erst-Anstoss und vom Erneut-versuchen-Retry einzelner fehlgeschlagener Dateien. */
  async function analyzeEntry(entry: PrefillFile): Promise<PrefillFile> {
    try {
      const formData = new FormData();
      formData.append("file", entry.file);
      formData.append("documentType", entry.documentType);
      const res = await fetch("/api/properties/prefill", { method: "POST", body: formData });
      const body = (await res.json()) as { analyzed?: boolean; extraction?: DocumentExtractionResult; error?: string };
      const updated: PrefillFile = { ...entry, status: body.analyzed ? "DONE" : "FAILED", extraction: body.extraction, error: body.error };

      if (body.analyzed && body.extraction?.basisdaten) {
        const b = body.extraction.basisdaten;
        if (b.adresseText) setAddressText(b.adresseText);
        if (b.kantonCode) setCanton(b.kantonCode);
        if (b.kaufpreisChf) setAskingPriceChf(String(b.kaufpreisChf));
        if (b.wohnflaecheM2) setWohnflaecheM2(String(b.wohnflaecheM2));
      }
      return updated;
    } catch {
      return { ...entry, status: "FAILED", error: "Netzwerkfehler" };
    }
  }

  async function handleAnalyze() {
    if (stagedFiles.length === 0) return;

    setAnalyzing(true);
    const newEntries: PrefillFile[] = stagedFiles.map((s) => ({ file: s.file, documentType: s.documentType, status: "ANALYZING" as const }));
    setStagedFiles([]);
    // Lokaler Snapshot statt React-State, damit wir am Ende der Schleife garantiert den
    // vollständigen, aktuellen Stand haben (State-Updates in der Schleife sind async).
    let allFiles = [...prefillFiles, ...newEntries];
    setPrefillFiles(allFiles);

    for (const entry of newEntries) {
      const updated = await analyzeEntry(entry);
      allFiles = allFiles.map((p) => (p === entry ? updated : p));
      setPrefillFiles(allFiles);
    }

    setAnalyzing(false);

    await runSynthesisPrefill(allFiles);
  }

  /** Stösst die Analyse für genau eine bereits fehlgeschlagene Datei erneut an, ohne alle anderen neu zu analysieren — schliesst danach mit einer neuen Synthese ab, falls diese Datei jetzt erfolgreich war. */
  async function retryAnalyze(entry: PrefillFile) {
    if (entry.status !== "FAILED") return;
    const analyzing: PrefillFile = { ...entry, status: "ANALYZING", error: undefined };
    let allFiles = prefillFiles.map((p) => (p === entry ? analyzing : p));
    setPrefillFiles(allFiles);

    const updated = await analyzeEntry(analyzing);
    allFiles = allFiles.map((p) => (p === analyzing ? updated : p));
    setPrefillFiles(allFiles);

    await runSynthesisPrefill(allFiles);
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
      const propertyId = body.id;

      const formData = new FormData(event.currentTarget);
      const facts = buildBestandsrenditeFactsFromFormData(formData, vermietungsmodell, renovationPositionen);
      await fetch(`/api/properties/${propertyId}/bestandsrendite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facts),
      });

      // Bereits analysierte Dokumente ans neue Objekt anhängen — ohne erneute
      // Claude-Analyse, das Ergebnis ist schon da.
      const analyzed = prefillFiles.filter((p) => p.status === "DONE" && p.extraction);
      for (const p of analyzed) {
        const attachFormData = new FormData();
        attachFormData.append("file", p.file);
        attachFormData.append("documentType", p.documentType);
        attachFormData.append("extraction", JSON.stringify(p.extraction));
        try {
          await fetch(`/api/properties/${propertyId}/documents/attach`, { method: "POST", body: attachFormData });
        } catch {
          // Nicht abbrechen — das Objekt ist bereits angelegt, ein einzelnes
          // fehlgeschlagenes Anhängen kann der Nutzer auf der Objektseite nachholen.
        }
      }

      // Bereits berechnete Due-Diligence-Synthese direkt mitspeichern, statt Claude ein
      // zweites Mal aufzurufen — steht dann sofort auf der Objektseite bereit.
      if (synthesisResult) {
        const knownFields = BESTANDSRENDITE_KNOWN_FIELD_LABELS.map(({ field, label }) => ({ field, label }));
        try {
          await fetch(`/api/properties/${propertyId}/due-diligence/save-prefilled`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result: synthesisResult, documents: synthesisDocuments, knownFields }),
          });
        } catch {
          // Nicht abbrechen — kann auf der Objektseite jederzeit über "Due-Diligence
          // aktualisieren" nachgeholt werden.
        }
      }

      router.push(`/objekte/${propertyId}`);
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
        Einfamilienhäuser, Gewerbeobjekte, Bauland oder Neubauprojekte.
      </p>

      <div style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "1rem 1.1rem", marginBottom: "1.4rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
          Optional zuerst: Dokumente hochladen &amp; automatisch auswerten
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: ".8rem", margin: "0 0 .8rem" }}>
          Exposé/Inserat UND/ODER Due-Diligence-Unterlagen (STWEG-Protokoll, Mietvertrag, Grundbuchauszug, …) hier
          schon hochladen — die Felder unten (Objekt-Basisdaten UND Bestandsrendite-Fakten) werden, soweit erkennbar,
          automatisch vorausgefüllt und bleiben editierbar. Alle Dokumente werden beim Anlegen direkt ans neue Objekt
          angehängt und die daraus schon berechnete Due-Diligence-Prüfung gleich mitgespeichert — keine zweite
          Analyse nötig, steht auf der Objektseite sofort bereit.
        </p>
        <div className="field" style={{ marginBottom: ".8rem" }}>
          <label htmlFor="prefillFiles">PDF-Dateien auswählen</label>
          <input id="prefillFiles" type="file" accept="application/pdf" multiple onChange={handleFilesSelected} />
        </div>

        <div className="field" style={{ marginBottom: stagedFiles.length > 0 ? ".8rem" : 0 }}>
          <label htmlFor="pasteText">…oder Text einfügen (z.B. aus E-Mail oder Inserat kopiert)</label>
          <textarea
            id="pasteText"
            rows={4}
            maxLength={MAX_PASTED_TEXT_LENGTH}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Text hier einfügen…"
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Titel (optional)"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              style={{ flex: "1 1 160px" }}
            />
            <select
              value={pasteDocumentType}
              onChange={(e) => setPasteDocumentType(e.target.value as DueDiligenceDocumentType)}
              style={{ fontSize: ".78rem", padding: ".2rem .4rem" }}
            >
              {Object.values(DOCUMENT_TYPE_CATALOG).map((c) => (
                <option key={c.type} value={c.type}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              style={{ width: "auto" }}
              disabled={!pasteText.trim()}
              onClick={handleAddPastedText}
            >
              Text hinzufügen
            </button>
          </div>
        </div>

        {stagedFiles.length > 0 ? (
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".78rem", margin: "0 0 .5rem" }}>
              Dokumenttyp aus dem Dateinamen vorgeschlagen, wo erkennbar — bei Bedarf korrigieren, dann analysieren.
            </p>
            <ul style={{ listStyle: "none", margin: "0 0 .8rem", padding: 0, display: "flex", flexDirection: "column", gap: ".4rem" }}>
              {stagedFiles.map((s, i) => (
                <li key={i} style={{ fontSize: ".8125rem", display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ minWidth: "0", flex: "1 1 220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.file.name}</span>
                  <select value={s.documentType} onChange={(e) => updateStagedType(i, e.target.value as DueDiligenceDocumentType)} style={{ fontSize: ".78rem", padding: ".2rem .4rem" }}>
                    {Object.values(DOCUMENT_TYPE_CATALOG).map((c) => (
                      <option key={c.type} value={c.type}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {s.guessed ? <Chip tone="neutral">erkannt</Chip> : null}
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem" }}
                    onClick={() => removeStaged(i)}
                  >
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn" style={{ width: "auto" }} disabled={analyzing} onClick={handleAnalyze}>
              {analyzing ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Analysiert…
                </>
              ) : (
                `${stagedFiles.length} Datei(en) analysieren`
              )}
            </button>
          </div>
        ) : null}

        {prefillFiles.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
            {CATEGORY_ORDER.map((category) => {
              const inCategory = prefillFiles.filter((p) => DOCUMENT_TYPE_CATALOG[p.documentType].defaultCategory === category);
              if (inCategory.length === 0) return null;
              return (
                <div key={category}>
                  <div className="eyebrow" style={{ marginBottom: ".3rem" }}>
                    {CATEGORY_LABEL[category]}
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: ".3rem" }}>
                    {inCategory.map((p, i) => (
                      <li key={i} style={{ fontSize: ".8125rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
                        <Chip tone={p.status === "DONE" ? "good" : p.status === "FAILED" ? "bad" : "neutral"}>
                          {p.status === "ANALYZING" ? (
                            <>
                              <span className="spinner" aria-hidden="true" />
                              Analysiert…
                            </>
                          ) : p.status === "DONE" ? (
                            "Analysiert"
                          ) : (
                            "Fehler"
                          )}
                        </Chip>
                        <span style={{ color: "var(--ink-faint)" }}>{DOCUMENT_TYPE_CATALOG[p.documentType].label}</span>
                        {p.file.name}
                        {p.status === "ANALYZING" ? (
                          <span style={{ color: "var(--ink-faint)", fontSize: ".76rem" }}>kann bis zu einer Minute dauern…</span>
                        ) : null}
                        {p.error ? <span style={{ color: "var(--bad)" }}>— {p.error}</span> : null}
                        {p.status === "FAILED" ? (
                          <button
                            type="button"
                            className="btn"
                            style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem", marginLeft: "auto" }}
                            onClick={() => retryAnalyze(p)}
                          >
                            Erneut versuchen
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : null}
        {synthesizing ? (
          <p style={{ color: "var(--ink-soft)", fontSize: ".8rem", marginTop: ".6rem", display: "flex", alignItems: "center", gap: ".4rem" }}>
            <span className="spinner" aria-hidden="true" />
            Ermittelt Vorschlagswerte für die Bestandsrendite-Fakten aus den hochgeladenen Dokumenten…
          </p>
        ) : null}
        {synthesisError ? <p style={{ color: "var(--bad)", fontSize: ".8rem", marginTop: ".6rem" }}>{synthesisError}</p> : null}
        {!synthesizing && synthesisResult ? (
          <>
            {synthesisResult.overallSummary ? (
              <p className="lede" style={{ fontSize: ".9rem", marginTop: ".7rem" }}>
                {synthesisResult.overallSummary}
              </p>
            ) : null}
            <p style={{ color: "var(--good)", fontSize: ".8rem", marginTop: ".4rem" }}>
              {Object.keys(docFieldProposals).length > 0
                ? `${Object.keys(docFieldProposals).length} Feld(er) unten aus den Dokumenten vorausgefüllt.`
                : "Dokumente ausgewertet — keine der bekannten Bestandsrendite-Felder konnten daraus eindeutig abgeleitet werden."}
            </p>
          </>
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

        <div className="eyebrow" style={{ marginTop: "1.6rem", marginBottom: ".5rem" }}>
          Bestandsrendite-Fakten
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0 0 1rem" }}>
          Nur Miete, Hypothek-Eckwerte und Vermietungsmodell sind Pflicht. Alle übrigen Felder mit &quot;Standard:
          …&quot; im Label sind mit einem recherchierten Vorschlagswert vorausgefüllt, Felder mit &quot;aus
          Dokument: …&quot; stammen aus den oben hochgeladenen Unterlagen — beides einfach überschreiben, falls du
          es genauer weisst.
        </p>
        <BestandsrenditeFactsFields
          key={factsFieldsVersion}
          existing={null}
          canton={canton || undefined}
          docProposals={docFieldProposals}
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
            {saving ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Legt an…
              </>
            ) : (
              "Bestandsrendite speichern"
            )}
          </button>
        </div>
      </form>
    </Panel>
  );
}
