"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AVAILABLE_CANTONS } from "@/lib/cantons";

/**
 * Legt bei Bedarf eine neue Region an (Find-or-Create über POST /api/regions) und lädt
 * direkt danach den ersten/nächsten Report für diese Region hoch. Zwei Requests statt
 * einem — hält beide Endpunkte einfach und wiederverwendbar (dieselbe Region kann später
 * auch ohne neuen Upload existieren, derselbe Upload-Endpunkt wird auch von der
 * Regions-Detailseite für weitere Reports genutzt).
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

      setStatus("Report wird hochgeladen und analysiert — das kann bei umfangreichen Reports etwas dauern…");
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`/api/regions/${regionBody.id}/documents`, { method: "POST", body: formData });
      const uploadBody = (await uploadRes.json()) as { saved?: boolean; status?: string; error?: string; duplicate?: boolean };
      if (!uploadRes.ok || !uploadBody.saved) {
        setError(uploadBody.error ?? "Upload fehlgeschlagen.");
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
      {status ? <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", marginTop: ".7rem" }}>{status}</p> : null}
      {error ? <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: ".7rem" }}>{error}</p> : null}
      <div className="wizard-actions">
        <button type="submit" className="btn" style={{ width: "auto" }} disabled={uploading}>
          {uploading ? "Wird hochgeladen…" : "Report hochladen"}
        </button>
      </div>
    </form>
  );
}
