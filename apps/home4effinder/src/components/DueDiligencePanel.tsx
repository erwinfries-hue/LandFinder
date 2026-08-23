"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel, Chip, type ChipTone } from "@landfinder/ui";
import type { DueDiligenceDocumentType, DueDiligenceResult, DueDiligenceSeverity } from "@landfinder/domain";
import { DOCUMENT_TYPE_CATALOG } from "@/lib/documentTypes";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/dueDiligenceCategories";
import { guessDocumentType } from "@/lib/documentTypeGuess";
import { formatDateTime } from "@/lib/properties";
import { buildSellerQuestionsEmailDraft, buildMailtoUrl } from "@/lib/sellerQuestionsEmail";
import { fetchJsonWithRetry } from "@/lib/fetchJsonWithRetry";

export interface DueDiligenceDocumentRow {
  id: string;
  document_type: string;
  original_filename: string;
  uploaded_at: string;
  analysis_status: string;
  analysis_error: string | null;
  extraction: { summary?: string; findings?: unknown[] } | null;
  excluded_from_synthesis: boolean;
}

const SEVERITY_TONE: Record<DueDiligenceSeverity, ChipTone> = { OK: "good", KLAERUNGSBEDARF: "warn", RISIKO: "bad" };
const SEVERITY_LABEL: Record<DueDiligenceSeverity, string> = { OK: "Unauffällig", KLAERUNGSBEDARF: "Klärungsbedarf", RISIKO: "Wesentliches Risiko" };
const PRIORITY_LABEL: Record<string, string> = { ZWINGEND: "Zwingend vor Kauf", EMPFOHLEN: "Empfehlenswert", OPTIONAL: "Optional" };

/** Datei, die ausgewählt aber noch nicht hochgeladen ist — Dokumenttyp aus dem Dateinamen vorgeschlagen, vor dem Hochladen editierbar. */
type StagedFile = { file: File; documentType: DueDiligenceDocumentType; guessed: boolean };

/** Bewusst dieselbe Grenze wie `MAX_PASTED_TEXT_LENGTH` in dueDiligenceExtraction.ts (nicht von dort importiert, um den Anthropic-SDK-Server-Code nicht ins Client-Bundle zu ziehen). */
const MAX_PASTED_TEXT_LENGTH = 200_000;

type UploadState = { filename: string; status: "UPLOADING" | "DONE" | "FAILED" | "CANCELLED"; error?: string; controller?: AbortController };

export function DueDiligencePanel({
  propertyId,
  objectLabel,
  initialDocuments,
  initialDueDiligence,
}: {
  propertyId: string;
  /** Adresse/Titel des Objekts — für den Betreff des E-Mail-Entwurfs der Rückfragen. */
  objectLabel: string;
  initialDocuments: DueDiligenceDocumentRow[];
  initialDueDiligence: { status: string; result: DueDiligenceResult | null; error_message: string | null; generated_at: string | null } | null;
}) {
  const router = useRouter();
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteDocumentType, setPasteDocumentType] = useState<DueDiligenceDocumentType>("SONSTIGES");
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  /** Felder, die in dieser Sitzung bereits erfolgreich übernommen wurden — sofortiges "Übernommen ✓" statt Button, ohne auf den nächsten `router.refresh()` warten zu müssen (der die Formularfelder erst nach dem Neuladen aktualisiert). */
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [togglingExcluded, setTogglingExcluded] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

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

  /** Eingefügter Text wird als reguläre Text-Datei in den bestehenden Staging-/Upload-Ablauf eingespiesen — kein separater Codepfad nötig. */
  function handleAddPastedText() {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    const filename = `${pasteTitle.trim() || "Eingefügter Text"}.txt`;
    const file = new File([trimmed], filename, { type: "text/plain" });
    setStagedFiles((prev) => [...prev, { file, documentType: pasteDocumentType, guessed: false }]);
    setPasteText("");
    setPasteTitle("");
  }

  async function handleUpload() {
    if (stagedFiles.length === 0) return;
    const toUpload = stagedFiles;
    setStagedFiles([]);

    const controllers = toUpload.map(() => new AbortController());
    setUploading(true);
    setUploads(toUpload.map((s, i) => ({ filename: s.file.name, status: "UPLOADING" as const, controller: controllers[i] })));

    for (let i = 0; i < toUpload.length; i++) {
      const { file, documentType } = toUpload[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", documentType);
        const body = await fetchJsonWithRetry<{ status?: string; error?: string }>(`/api/properties/${propertyId}/documents`, {
          method: "POST",
          body: formData,
          signal: controllers[i].signal,
        });
        setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: body.status === "DONE" ? "DONE" : "FAILED", error: body.error } : u)));
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        setUploads((prev) =>
          prev.map((u, idx) => (idx === i ? { ...u, status: aborted ? "CANCELLED" : "FAILED", error: aborted ? undefined : "Netzwerkfehler" } : u)),
        );
      }
    }

    setUploading(false);
    router.refresh();
  }

  /**
   * Bricht die Warte auf ein einzelnes, gerade hochladendes/analysierendes Dokument ab —
   * die Analyse dauert bei grossen/gescannten PDFs mitunter sehr lange. Der Server-Request
   * läuft im Hintergrund zu Ende (kein Job-Abbruch, siehe documents/route.ts), aber der
   * Nutzer muss nicht mehr darauf warten und kann mit den übrigen Dateien weiterarbeiten;
   * das begonnene Dokument taucht nach "Aktualisieren" der Seite ggf. trotzdem fertig
   * analysiert in der Liste unten auf.
   */
  function handleCancelUpload(index: number) {
    setUploads((prev) => {
      prev[index]?.controller?.abort();
      return prev;
    });
  }

  async function handleSynthesize() {
    setSynthesizing(true);
    setSynthesisError(null);
    try {
      const body = await fetchJsonWithRetry<{ saved?: boolean; error?: string }>(`/api/properties/${propertyId}/due-diligence`, { method: "POST" });
      if (!body.saved) {
        setSynthesisError(body.error ?? "Analyse fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setSynthesisError("Analyse fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleApplyProposal(field: string, newValue: string | number) {
    setApplying(field);
    try {
      const res = await fetch(`/api/properties/${propertyId}/due-diligence/apply-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, newValue }),
      });
      const body = (await res.json().catch(() => ({}))) as { saved?: boolean; error?: string };
      if (!res.ok || !body.saved) {
        window.alert(body.error ?? "Übernehmen fehlgeschlagen.");
        return;
      }
      setAppliedFields((prev) => new Set(prev).add(field));
      router.refresh();
    } catch {
      window.alert("Übernehmen fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setApplying(null);
    }
  }

  async function handleDeleteDocument(documentId: string, filename: string) {
    if (!window.confirm(`"${filename}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    setDeleting(documentId);
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents/${documentId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { deleted?: boolean; error?: string };
      if (!res.ok || !body.deleted) {
        window.alert(body.error ?? "Löschen fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Löschen fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setDeleting(null);
    }
  }

  async function handleReanalyzeDocument(documentId: string) {
    setReanalyzing(documentId);
    try {
      const body = await fetchJsonWithRetry<{ analyzed?: boolean; error?: string }>(`/api/properties/${propertyId}/documents/${documentId}/reanalyze`, { method: "POST" });
      if (!body.analyzed) {
        window.alert(body.error ?? "Analyse fehlgeschlagen.");
      }
      router.refresh();
    } catch {
      window.alert("Analyse fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setReanalyzing(null);
    }
  }

  /**
   * Schaltet den dauerhaften Ausschluss eines bereits hochgeladenen Dokuments aus der
   * Synthese um (`excluded_from_synthesis`, siehe Migration 0004) — für Dokumente, die
   * die Synthese unnötig verlangsamen oder wiederholt zum Timeout führen. Das Dokument
   * bleibt erhalten und weiter analysiert, wird nur nicht mehr an Stufe 2 übergeben, bis
   * es wieder eingeschlossen wird.
   */
  async function handleToggleExcluded(documentId: string, currentlyExcluded: boolean) {
    setTogglingExcluded(documentId);
    try {
      const res = await fetch(`/api/properties/${propertyId}/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedFromSynthesis: !currentlyExcluded }),
      });
      const body = (await res.json().catch(() => ({}))) as { saved?: boolean; error?: string };
      if (!res.ok || !body.saved) {
        window.alert(body.error ?? "Aktualisieren fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Aktualisieren fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setTogglingExcluded(null);
    }
  }

  async function handleCopyEmailDraft(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Clipboard-API kann in seltenen Browser-/Berechtigungskonstellationen fehlen —
      // die Textarea daneben bleibt in dem Fall der manuelle Kopierweg.
    }
  }

  const result = initialDueDiligence?.result ?? null;
  const excludedCount = initialDocuments.filter((d) => d.excluded_from_synthesis).length;

  return (
    <Panel style={{ padding: "1rem 1.2rem", marginTop: "1.1rem" }}>
      <div className="eyebrow">Dokumentenprüfung / Due Diligence</div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.3rem 0 0.8rem" }}>
        PDFs hochladen (auch gescannt) — jedes Dokument wird einzeln analysiert. Danach &quot;Due-Diligence
        aktualisieren&quot; für den kategorisierten Gesamtbefund inkl. Widersprüchen, fehlenden Unterlagen und
        Rückfragen.
      </p>

      <div className="field" style={{ marginBottom: ".8rem" }}>
        <label htmlFor="files">PDF-Dateien auswählen</label>
        <input id="files" type="file" accept="application/pdf" multiple onChange={handleFilesSelected} />
      </div>

      <div className="field" style={{ marginBottom: stagedFiles.length > 0 ? ".6rem" : "0.9rem" }}>
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
                {c.label} ({PRIORITY_LABEL[c.priority]})
              </option>
            ))}
          </select>
          <button type="button" className="btn" style={{ width: "auto" }} disabled={!pasteText.trim()} onClick={handleAddPastedText}>
            Text hinzufügen
          </button>
        </div>
      </div>

      {stagedFiles.length > 0 ? (
        <div style={{ marginBottom: "0.9rem" }}>
          <p style={{ color: "var(--ink-soft)", fontSize: ".78rem", margin: "0 0 .5rem" }}>
            Dokumenttyp aus dem Dateinamen vorgeschlagen, wo erkennbar — bei Bedarf korrigieren, dann hochladen.
          </p>
          <ul style={{ listStyle: "none", margin: "0 0 .8rem", padding: 0, display: "flex", flexDirection: "column", gap: ".4rem" }}>
            {stagedFiles.map((s, i) => (
              <li key={i} style={{ fontSize: ".8125rem", display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ minWidth: "0", flex: "1 1 220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.file.name}</span>
                <select value={s.documentType} onChange={(e) => updateStagedType(i, e.target.value as DueDiligenceDocumentType)} style={{ fontSize: ".78rem", padding: ".2rem .4rem" }}>
                  {Object.values(DOCUMENT_TYPE_CATALOG).map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.label} ({PRIORITY_LABEL[c.priority]})
                    </option>
                  ))}
                </select>
                {s.guessed ? <Chip tone="neutral">erkannt</Chip> : null}
                <button type="button" className="btn" style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem" }} onClick={() => removeStaged(i)}>
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" style={{ width: "auto" }} disabled={uploading} onClick={handleUpload}>
            {uploading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Lädt hoch…
              </>
            ) : (
              `${stagedFiles.length} Datei(en) hochladen`
            )}
          </button>
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <ul style={{ listStyle: "none", margin: "0 0 0.9rem", padding: 0, display: "flex", flexDirection: "column", gap: ".3rem" }}>
          {uploads.map((u, i) => (
            <li key={u.filename} style={{ fontSize: ".8125rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
              <Chip tone={u.status === "DONE" ? "good" : u.status === "FAILED" ? "bad" : "neutral"}>
                {u.status === "UPLOADING" ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Lädt…
                  </>
                ) : u.status === "DONE" ? (
                  "Analysiert"
                ) : u.status === "CANCELLED" ? (
                  "Abgebrochen"
                ) : (
                  "Fehler"
                )}
              </Chip>
              {u.filename}
              {u.status === "UPLOADING" ? (
                <>
                  <span style={{ color: "var(--ink-faint)", fontSize: ".76rem" }}>kann bis zu einer Minute dauern…</span>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "auto", padding: ".1rem .45rem", fontSize: ".7rem", marginLeft: "auto" }}
                    onClick={() => handleCancelUpload(i)}
                  >
                    Abbrechen
                  </button>
                </>
              ) : null}
              {u.error ? <span style={{ color: "var(--bad)" }}>— {u.error}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="sectionhead">
        <h2 style={{ fontSize: ".85rem" }}>Hochgeladene Dokumente ({initialDocuments.length})</h2>
      </div>
      {initialDocuments.length === 0 ? (
        <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Noch keine Dokumente hochgeladen.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", marginBottom: "1rem" }}>
          {CATEGORY_ORDER.map((category) => {
            const inCategory = initialDocuments.filter((d) => (DOCUMENT_TYPE_CATALOG[d.document_type as DueDiligenceDocumentType]?.defaultCategory ?? "DOKUMENTENVOLLSTAENDIGKEIT") === category);
            if (inCategory.length === 0) return null;
            return (
              <div key={category}>
                <div className="eyebrow" style={{ marginBottom: ".3rem" }}>
                  {CATEGORY_LABEL[category]}
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: ".4rem" }}>
                  {inCategory.map((d) => (
                    <li key={d.id} style={{ fontSize: ".8125rem" }}>
                      <div style={{ display: "flex", gap: ".6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                        <Chip tone={d.analysis_status === "DONE" ? "good" : d.analysis_status === "FAILED" ? "bad" : "neutral"}>{d.analysis_status}</Chip>
                        {d.excluded_from_synthesis ? <Chip tone="warn">Von Synthese ausgeschlossen</Chip> : null}
                        <strong>{DOCUMENT_TYPE_CATALOG[d.document_type as DueDiligenceDocumentType]?.label ?? d.document_type}</strong>
                        <span style={{ color: "var(--ink-faint)" }}>{d.original_filename}</span>
                        <span style={{ color: "var(--ink-faint)" }}>{formatDateTime(d.uploaded_at)}</span>
                        {d.analysis_error ? <span style={{ color: "var(--bad)" }}>— {d.analysis_error}</span> : null}
                        <div style={{ display: "flex", gap: ".4rem", marginLeft: "auto" }}>
                          {d.analysis_status === "FAILED" ? (
                            <button
                              type="button"
                              className="btn"
                              style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem" }}
                              disabled={reanalyzing === d.id}
                              onClick={() => handleReanalyzeDocument(d.id)}
                            >
                              {reanalyzing === d.id ? (
                                <>
                                  <span className="spinner" aria-hidden="true" />
                                  Analysiert…
                                </>
                              ) : (
                                "Erneut analysieren"
                              )}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn"
                            style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem" }}
                            disabled={togglingExcluded === d.id}
                            onClick={() => handleToggleExcluded(d.id, d.excluded_from_synthesis)}
                          >
                            {togglingExcluded === d.id ? "…" : d.excluded_from_synthesis ? "Wieder einschliessen" : "Von Synthese ausschliessen"}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem" }}
                            disabled={deleting === d.id}
                            onClick={() => handleDeleteDocument(d.id, d.original_filename)}
                          >
                            {deleting === d.id ? "Löscht…" : "Löschen"}
                          </button>
                        </div>
                      </div>
                      {/* Sofortiges Feedback aus Stufe 1 — sonst sieht der Nutzer vor dem nächsten
                          "Due-Diligence aktualisieren" nichts vom bereits extrahierten Inhalt. */}
                      {d.extraction?.summary ? (
                        <p style={{ color: "var(--ink-soft)", fontSize: ".78rem", margin: ".3rem 0 0" }}>{d.extraction.summary}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="wizard-actions" style={{ marginBottom: result ? "1rem" : 0 }}>
        <button type="button" className="btn" style={{ width: "auto" }} disabled={synthesizing || initialDocuments.length === 0} onClick={handleSynthesize}>
          {synthesizing ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Analysiert…
            </>
          ) : (
            "Due-Diligence aktualisieren"
          )}
        </button>
        {initialDueDiligence?.generated_at ? (
          <span style={{ color: "var(--ink-faint)", fontSize: ".78rem" }}>Zuletzt aktualisiert: {formatDateTime(initialDueDiligence.generated_at)}</span>
        ) : null}
        {excludedCount > 0 ? (
          <span style={{ color: "var(--ink-faint)", fontSize: ".78rem" }}>
            {excludedCount} Dokument{excludedCount === 1 ? "" : "e"} von der Synthese ausgeschlossen
          </span>
        ) : null}
      </div>
      {synthesisError ? <p style={{ color: "var(--bad)", fontSize: ".8125rem" }}>{synthesisError}</p> : null}
      {initialDueDiligence?.status === "FAILED" && initialDueDiligence.error_message ? (
        <p style={{ color: "var(--bad)", fontSize: ".8125rem" }}>{initialDueDiligence.error_message}</p>
      ) : null}

      {result ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: ".7rem", marginBottom: result.overallSummary ? ".6rem" : "1rem" }}>
            <Chip tone={SEVERITY_TONE[result.overallStatus]}>{SEVERITY_LABEL[result.overallStatus]}</Chip>
            <strong style={{ fontSize: ".875rem" }}>Gesamtstatus</strong>
          </div>
          {result.overallSummary ? <p className="lede" style={{ fontSize: "1rem", marginBottom: "0.9rem" }}>{result.overallSummary}</p> : null}

          {result.contradictions.length > 0 ? (
            <>
              <div className="sectionhead">
                <h2 style={{ fontSize: ".85rem" }}>Widersprüchliche Angaben — bitte entscheiden</h2>
              </div>
              <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0 0 .6rem" }}>
                Die Quellen widersprechen sich bei folgenden Punkten. Wähle pro Punkt den zutreffenden Wert — bei
                bekannten Feldern lässt er sich direkt übernehmen.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", marginBottom: "1rem" }}>
                {result.contradictions.map((contradiction, i) => (
                  <div key={i} style={{ border: "1px solid var(--warn)", borderRadius: "6px", padding: ".6rem .85rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".5rem" }}>
                      <Chip tone="warn">Widerspruch</Chip>
                      <strong style={{ fontSize: ".8125rem" }}>{contradiction.topic}</strong>
                      <span style={{ color: "var(--ink-faint)", fontSize: ".76rem" }}>({CATEGORY_LABEL[contradiction.category] ?? contradiction.category})</span>
                    </div>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: ".4rem" }}>
                      {contradiction.options.map((option, j) => (
                        <li key={j} style={{ fontSize: ".8125rem", display: "flex", gap: ".6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                          <strong>{option.value}</strong>
                          <span style={{ color: "var(--ink-faint)", fontSize: ".76rem" }}>
                            laut {option.sourceDocumentName || "unbekannter Quelle"}
                            {option.sourcePage ? `, Seite ${option.sourcePage}` : ""}
                            {option.sourceQuote ? `: „${option.sourceQuote}“` : ""}
                          </span>
                          {contradiction.field && appliedFields.has(contradiction.field) ? (
                            <Chip tone="good">Übernommen ✓</Chip>
                          ) : contradiction.field ? (
                            <button
                              type="button"
                              className="btn"
                              style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem", marginLeft: "auto" }}
                              disabled={applying === contradiction.field}
                              onClick={() => handleApplyProposal(contradiction.field!, option.value)}
                            >
                              {applying === contradiction.field ? "Übernimmt…" : "Das stimmt — übernehmen"}
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", marginBottom: "1rem" }}>
            {result.categories.map((c) => (
              <div key={c.category} style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: ".6rem .85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: c.findings.length > 0 ? ".5rem" : 0 }}>
                  <Chip tone={SEVERITY_TONE[c.status]}>{SEVERITY_LABEL[c.status]}</Chip>
                  <strong style={{ fontSize: ".8125rem" }}>{CATEGORY_LABEL[c.category] ?? c.category}</strong>
                </div>
                {c.findings.map((f, i) => (
                  <div key={i} style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: ".4rem", paddingLeft: ".2rem" }}>
                    {f.isContradiction ? <Chip tone="warn">Widerspruch</Chip> : null} {f.summary}
                    {f.detail ? <div style={{ color: "var(--ink-faint)", fontSize: ".76rem" }}>{f.detail}</div> : null}
                    {f.sourceDocumentName || f.sourcePage || f.sourceQuote ? (
                      <div style={{ color: "var(--ink-faint)", fontSize: ".74rem", fontStyle: "italic", marginTop: ".2rem" }}>
                        {f.sourceDocumentName}
                        {f.sourcePage ? `, Seite ${f.sourcePage}` : ""}
                        {f.sourceQuote ? `: „${f.sourceQuote}“` : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="sectionhead">
            <h2 style={{ fontSize: ".85rem" }}>Fehlende Unterlagen</h2>
          </div>
          {result.missingDocuments.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Keine — alle bekannten Dokumenttypen sind erfasst.</p>
          ) : (
            <ul style={{ margin: "0 0 1rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: ".3rem" }}>
              {result.missingDocuments.map((m) => (
                <li key={m.documentType} style={{ fontSize: ".8125rem", display: "flex", gap: ".6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                  <Chip tone={m.priority === "ZWINGEND" ? "bad" : m.priority === "EMPFOHLEN" ? "warn" : "neutral"}>{PRIORITY_LABEL[m.priority]}</Chip>
                  <strong>{DOCUMENT_TYPE_CATALOG[m.documentType].label}</strong>
                  {m.note ? <span style={{ color: "var(--ink-faint)" }}>— {m.note}</span> : null}
                </li>
              ))}
            </ul>
          )}

          <div className="sectionhead">
            <h2 style={{ fontSize: ".85rem" }}>Empfohlene Rückfragen an Verkäufer/Makler/Verwaltung</h2>
          </div>
          {result.sellerQuestions.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Keine offenen Rückfragen.</p>
          ) : (
            <>
              <ul style={{ margin: "0 0 .8rem", paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: ".4rem" }}>
                {result.sellerQuestions.map((q, i) => (
                  <li key={i} style={{ fontSize: ".8125rem" }}>
                    {q.question}
                    {q.relatedFindingSummary ? (
                      <div style={{ color: "var(--ink-faint)", fontSize: ".74rem", fontStyle: "italic", marginTop: ".15rem" }}>Grund: {q.relatedFindingSummary}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {(() => {
                const draft = buildSellerQuestionsEmailDraft(result.sellerQuestions, objectLabel);
                const fullText = `Betreff: ${draft.subject}\n\n${draft.body}`;
                return (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginBottom: ".5rem" }}>
                      <a href={buildMailtoUrl(draft)} className="btn" style={{ width: "auto", padding: ".3rem .7rem", fontSize: ".78rem" }}>
                        In E-Mail-Programm öffnen
                      </a>
                      <button
                        type="button"
                        className="btn"
                        style={{ width: "auto", padding: ".3rem .7rem", fontSize: ".78rem" }}
                        onClick={() => handleCopyEmailDraft(fullText)}
                      >
                        {copyFeedback ? "Kopiert!" : "Text kopieren"}
                      </button>
                    </div>
                    <textarea readOnly rows={4} value={fullText} style={{ width: "100%", fontSize: ".76rem", color: "var(--ink-soft)" }} />
                  </div>
                );
              })()}
            </>
          )}

          <div className="sectionhead">
            <h2 style={{ fontSize: ".85rem" }}>Erkannte Werte zur Übernahme</h2>
          </div>
          {result.fieldUpdateProposals.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>Keine.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: ".5rem" }}>
              {result.fieldUpdateProposals.map((p) => (
                <li key={p.field} style={{ fontSize: ".8125rem", display: "flex", gap: ".6rem", alignItems: "baseline", flexWrap: "wrap" }}>
                  <span>
                    <strong>{p.label}</strong>: neuer Wert <strong>{p.newValue}</strong>
                    {p.currentValue != null ? ` (bisher ${p.currentValue})` : " (bisher nicht erfasst)"} — laut {p.sourceDocumentName}
                    {p.sourcePage ? `, Seite ${p.sourcePage}` : ""}
                  </span>
                  {appliedFields.has(p.field) ? (
                    <Chip tone="good">Übernommen ✓</Chip>
                  ) : (
                    <button type="button" className="btn" style={{ width: "auto", padding: ".2rem .6rem", fontSize: ".76rem" }} disabled={applying === p.field} onClick={() => handleApplyProposal(p.field, p.newValue)}>
                      {applying === p.field ? "Übernimmt…" : "Übernehmen"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Panel>
  );
}
