"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { QUELLEN_CATEGORY_SUGGESTIONS } from "@/lib/quellen";

type LinkArt = "DATEI" | "URL";

/**
 * Erfasst einen neuen Quellenverzeichnis-Eintrag (Migration 0009) — entweder mit
 * Datei-Upload (direkt zu Supabase Storage per Signed URL, analog zu
 * RegionUploadForm.tsx — Vercels 4.5-MB-Payload-Limit) oder mit einer externen URL,
 * je nach gewählter Link-Art. Bewusst KEINE KI-Extraktion — reine Metadatenerfassung.
 */
export function QuelleUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkArt, setLinkArt] = useState<LinkArt>("DATEI");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!title.trim()) {
      setError("Bitte einen Titel eintragen.");
      return;
    }

    const commonFields = {
      title: title.trim(),
      category: category.trim() || undefined,
      publisher: publisher.trim() || undefined,
      publishedDate: publishedDate || undefined,
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (linkArt === "URL") {
        if (!externalUrl.trim()) {
          setError("Bitte eine URL eintragen.");
          return;
        }
        const res = await fetch("/api/quellen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...commonFields, externalUrl: externalUrl.trim() }),
        });
        const resBody = (await res.json().catch(() => ({}))) as { saved?: boolean; error?: string };
        if (!res.ok || !resBody.saved) {
          setError(resBody.error ?? "Speichern fehlgeschlagen.");
          return;
        }
      } else {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          setError("Bitte eine Datei wählen.");
          return;
        }
        const browserClient = createSupabaseBrowserClient();
        if (!browserClient) {
          setError("Supabase ist im Browser nicht konfiguriert (NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt) — Upload nicht möglich.");
          return;
        }

        setStatus("Datei wird direkt zu Supabase hochgeladen…");
        const signedUrlRes = await fetch("/api/quellen/signed-upload-url", { method: "POST" });
        const signedUrlBody = (await signedUrlRes.json()) as { storagePath?: string; token?: string; error?: string };
        if (!signedUrlRes.ok || !signedUrlBody.storagePath || !signedUrlBody.token) {
          setError(signedUrlBody.error ?? "Signed-Upload-URL konnte nicht erstellt werden.");
          return;
        }

        const { error: uploadStorageError } = await browserClient.storage
          .from("quellen-dokumente")
          .uploadToSignedUrl(signedUrlBody.storagePath, signedUrlBody.token, file, { contentType: file.type || "application/octet-stream" });
        if (uploadStorageError) {
          setError(`Upload zu Supabase fehlgeschlagen: ${uploadStorageError.message}`);
          return;
        }

        setStatus("Eintrag wird gespeichert…");
        const res = await fetch("/api/quellen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...commonFields, storagePath: signedUrlBody.storagePath, originalFilename: file.name }),
        });
        const resBody = (await res.json().catch(() => ({}))) as { saved?: boolean; error?: string };
        if (!res.ok || !resBody.saved) {
          setError(resBody.error ?? "Speichern fehlgeschlagen.");
          return;
        }
      }

      setStatus(null);
      setTitle("");
      setCategory("");
      setPublisher("");
      setPublishedDate("");
      setNotes("");
      setExternalUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <datalist id="dl-quelle-category">
        {QUELLEN_CATEGORY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="fieldgrid">
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="quelle-title">Titel</label>
          <input id="quelle-title" type="text" required placeholder="z.B. UBS Wohnattraktivitätsindikator 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="quelle-category">Kategorie</label>
          <input id="quelle-category" type="text" list="dl-quelle-category" placeholder="Sonstiges" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="quelle-publisher">Herausgeber</label>
          <input id="quelle-publisher" type="text" placeholder="z.B. UBS" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="quelle-published-date">Datum</label>
          <input id="quelle-published-date" type="date" value={publishedDate} onChange={(e) => setPublishedDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="quelle-linkart">Link-Art</label>
          <select id="quelle-linkart" value={linkArt} onChange={(e) => setLinkArt(e.target.value as LinkArt)}>
            <option value="DATEI">Datei hochladen</option>
            <option value="URL">Externe URL</option>
          </select>
        </div>
        {linkArt === "URL" ? (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="quelle-url">URL</label>
            <input id="quelle-url" type="url" required placeholder="https://…" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
          </div>
        ) : (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="quelle-file">Datei</label>
            <input id="quelle-file" type="file" ref={fileInputRef} required />
          </div>
        )}
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="quelle-notes">Notizen (optional)</label>
          <textarea id="quelle-notes" rows={2} style={{ width: "100%" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {status ? (
        <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", marginTop: ".7rem" }}>
          <span className="spinner" aria-hidden="true" />
          {status}
        </p>
      ) : null}
      {error ? <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: ".7rem" }}>{error}</p> : null}
      <div className="wizard-actions">
        <button type="submit" className="btn" style={{ width: "auto" }} disabled={saving}>
          {saving ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Wird gespeichert…
            </>
          ) : (
            "Quelle hinzufügen"
          )}
        </button>
      </div>
    </form>
  );
}
