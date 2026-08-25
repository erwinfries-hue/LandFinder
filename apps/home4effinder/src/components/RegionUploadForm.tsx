"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AVAILABLE_CANTONS } from "@/lib/cantons";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

/**
 * Legt bei Bedarf eine neue Region an (Find-or-Create über POST /api/regions) und lädt
 * direkt danach den ersten/nächsten Report für diese Region hoch. Drei Schritte statt
 * einem einzigen Formular-POST: (1) Region anlegen, (2) Datei DIREKT zu Supabase
 * Storage hochladen (Signed URL, siehe supabaseBrowser.ts — Vercels
 * Serverless-Function-Payload-Limit von 4.5 MB liess einen direkten Upload über eine
 * eigene Route bei mehrseitigen Reports sofort mit einem "Netzwerkfehler"
 * scheitern), (3) Server anweisen, die bereits hochgeladene Datei zu analysieren.
 */
export function RegionUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canton, setCanton] = useState("");
  const [gemeinde, setGemeinde] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Bitte eine PDF-Datei wählen.");
      return;
    }
    if (!canton) {
      setError("Bitte einen Kanton wählen.");
      return;
    }
    if (!gemeinde.trim()) {
      setError("Bitte eine Gemeinde eintragen.");
      return;
    }

    setUploading(true);
    try {
      const regionRes = await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canton, gemeinde: gemeinde.trim() }),
      });
      const regionBody = (await regionRes.json()) as { saved?: boolean; id?: string; error?: string };
      if (!regionBody.saved || !regionBody.id) {
        setError(regionBody.error ?? "Region konnte nicht angelegt werden.");
        return;
      }
      const regionId = regionBody.id;

      const browserClient = createSupabaseBrowserClient();
      if (!browserClient) {
        setError("Supabase ist im Browser nicht konfiguriert (NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt) — Upload nicht möglich.");
        return;
      }

      setStatus("Datei wird direkt zu Supabase hochgeladen…");
      const signedUrlRes = await fetch(`/api/regions/${regionId}/documents/signed-upload-url`, { method: "POST" });
      const signedUrlBody = (await signedUrlRes.json()) as { storagePath?: string; token?: string; error?: string };
      if (!signedUrlRes.ok || !signedUrlBody.storagePath || !signedUrlBody.token) {
        setError(signedUrlBody.error ?? "Signed-Upload-URL konnte nicht erstellt werden.");
        return;
      }

      const { error: uploadStorageError } = await browserClient.storage
        .from("region-documents")
        .uploadToSignedUrl(signedUrlBody.storagePath, signedUrlBody.token, file, { contentType: "application/pdf" });
      if (uploadStorageError) {
        setError(`Upload zu Supabase fehlgeschlagen: ${uploadStorageError.message}`);
        return;
      }

      setStatus("Report wird analysiert — das kann bei umfangreichen Reports etwas dauern…");
      const uploadRes = await fetch(`/api/regions/${regionId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: signedUrlBody.storagePath, originalFilename: file.name }),
      });
      const uploadBody = (await uploadRes.json()) as { saved?: boolean; status?: string; error?: string; duplicate?: boolean };
      if (!uploadRes.ok || !uploadBody.saved) {
        setError(uploadBody.error ?? "Analyse konnte nicht gestartet werden.");
        return;
      }
      if (uploadBody.status === "FAILED") {
        setError(uploadBody.error ?? "Analyse fehlgeschlagen.");
        return;
      }

      setStatus(null);
      setGemeinde("");
      setCanton("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Upload fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="region-canton">Kanton</label>
          <select id="region-canton" required value={canton} onChange={(e) => setCanton(e.target.value)}>
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
          <label htmlFor="region-gemeinde">Gemeinde</label>
          <input id="region-gemeinde" type="text" required placeholder="z.B. Wohlen" value={gemeinde} onChange={(e) => setGemeinde(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="region-file">Standortreport (PDF)</label>
          <input id="region-file" type="file" accept="application/pdf,.pdf" ref={fileInputRef} required />
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
        <button type="submit" className="btn" style={{ width: "auto" }} disabled={uploading}>
          {uploading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Wird hochgeladen…
            </>
          ) : (
            "Report hochladen"
          )}
        </button>
      </div>
    </form>
  );
}
