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

export interface DueDiligenceDocumentRow {
  id: string;
  document_type: string;
  original_filename: string;
  uploaded_at: string;
  analysis_status: string;
  analysis_error: string | null;
  extraction: { summary?: string; findings?: unknown[] } | null;
}

const SEVERITY_TONE: Record<DueDiligenceSeverity, ChipTone> = { OK: "good", KLAERUNGSBEDARF: "warn", RISIKO: "bad" };
const SEVERITY_LABEL: Record<DueDiligenceSeverity, string> = { OK: "Unauffällig", KLAERUNGSBEDARF: "Klärungsbedarf", RISIKO: "Wesentliches Risiko" };
const PRIORITY_LABEL: Record<string, string> = { ZWINGEND: "Zwingend vor Kauf", EMPFOHLEN: "Empfehlenswert", OPTIONAL: "Optional" };

/** Datei, die ausgewählt aber noch nicht hochgeladen ist — Dokumenttyp aus dem Dateinamen vorgeschlagen, vor dem Hochladen editierbar. */
type StagedFile = { file: File; documentType: DueDiligenceDocumentType; guessed: boolean };

type UploadState = { filename: string; status: "UPLOADING" | "DONE" | "FAILED"; error?: string };

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
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
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

  async function handleUpload() {
    if (stagedFiles.length === 0) return;
    const toUpload = stagedFiles;
    setStagedFiles([]);

    setUploading(true);
    setUploads(toUpload.map((s) => ({ filename: s.file.name, status: "UPLOADING" as const })));

    for (let i = 0; i < toUpload.length; i++) {
      const { file, documentType } = toUpload[i];
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", documentType);
        const res = await fetch(`/api/properties/${propertyId}/documents`, { method: "POST", body: formData });
        const body = (await res.json()) as { status?: string; error?: string };
        setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: body.status === "DONE" ? "DONE" : "FAILED", error: body.error } : u)));
      } catch {
        setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: "FAILED", error: "Netzwerkfehler" } : u)));
      }
    }

    setUploading(false);
    router.refresh();
  }

  async function handleSynthesize() {
    setSynthesizing(true);
    setSynthesisError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/due-diligence`, { method: "POST" });
      const body = (await res.json()) as { saved?: boolean; error?: string };
      if (!res.ok || !body.saved) {
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
      await fetch(`/api/properties/${propertyId}/due-diligence/apply-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, newValue }),
      });
      router.refresh();
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

  return (
    <Panel style={{ padding: "1.4rem 1.6rem", marginTop: "1.6rem" }}>
      <div className="eyebrow">Dokumentenprüfung / Due Diligence</div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.4rem 0 1.1rem" }}>
        PDFs hochladen (auch gescannt) — jedes Dokument wird einzeln analysiert. Danach &quot;Due-Diligence
        aktualisieren&quot; für den kategorisierten Gesamtbefund inkl. Widersprüchen, fehlenden Unterlagen und
        Rückfragen.
      </p>

      <div className="field" style={{ marginBottom: stagedFiles.length > 0 ? ".8rem" : "1.2rem" }}>
        <label htmlFor="files">PDF-Dateien auswählen</label>
        <input id="files" type="file" accept="application/pdf" multiple onChange={handleFilesSelected} />
      </div>

      {stagedFiles.length > 0 ? (
        <div style={{ marginBottom: "1.2rem" }}>
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
        <ul style={{ listStyle: "none", margin: "0 0 1.2rem", padding: 0, display: "flex", flexDirection: "column", gap: ".3rem" }}>
          {uploads.map((u) => (
            <li key={u.filename} style={{ fontSize: ".8125rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
              <Chip tone={u.status === "DONE" ? "good" : u.status === "FAILED" ? "bad" : "neutral"}>
                {u.status === "UPLOADING" ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Lädt…
                  </>
                ) : u.status === "DONE" ? (
                  "Analysiert"
                ) : (
                  "Fehler"
                )}
              </Chip>
              {u.filename}
              {u.status === "UPLOADING" ? <span style={{ color: "var(--ink-faint)", fontSize: ".76rem" }}>kann bis zu einer Minute dauern…</span> : null}
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
        <div style={{ display: "flex", flexDirection: "column", gap: ".9rem", marginBottom: "1.4rem" }}>
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
                        <strong>{DOCUMENT_TYPE_CATALOG[d.document_type as DueDiligenceDocumentType]?.label ?? d.document_type}</strong>
                        <span style={{ color: "var(--ink-faint)" }}>{d.original_filename}</span>
                        <span style={{ color: "var(--ink-faint)" }}>{formatDateTime(d.uploaded_at)}</span>
                        {d.analysis_error ? <span style={{ color: "var(--bad)" }}>— {d.analysis_error}</span> : null}
                        <button
                          type="button"
                          className="btn"
                          style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem", marginLeft: "auto" }}
                          disabled={deleting === d.id}
                          onClick={() => handleDeleteDocument(d.id, d.original_filename)}
                        >
                          {deleting === d.id ? "Löscht…" : "Löschen"}
                        </button>
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

      <div className="wizard-actions" style={{ marginBottom: result ? "1.4rem" : 0 }}>
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
          {result.overallSummary ? <p className="lede" style={{ fontSize: "1rem", marginBottom: "1.2rem" }}>{result.overallSummary}</p> : null}

          <div style={{ display: "flex", flexDirection: "column", gap: ".8rem", marginBottom: "1.4rem" }}>
            {result.categories.map((c) => (
              <div key={c.category} style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: ".8rem 1rem" }}>
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
            <ul style={{ margin: "0 0 1.4rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: ".3rem" }}>
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
                  <div style={{ marginBottom: "1.4rem" }}>
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
                  <button type="button" className="btn" style={{ width: "auto", padding: ".2rem .6rem", fontSize: ".76rem" }} disabled={applying === p.field} onClick={() => handleApplyProposal(p.field, p.newValue)}>
                    {applying === p.field ? "Übernimmt…" : "Übernehmen"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Panel>
  );
}
