"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Stösst eine erneute Analyse eines bereits hochgeladenen Regionsreports an (ohne
 * erneuten Upload) — u.a. nötig, um bereits erfasste Reports von einem erweiterten
 * Extraktionsschema (z.B. neu ergänztes `kantonKennzahlen`) profitieren zu lassen, ohne
 * die Datei erneut hochladen zu müssen (der Content-Hash-Dublettenschutz würde das sonst
 * verhindern). Mirrort DueDiligenceRefreshButton.tsx.
 */
export function RegionDocumentReanalyzeButton({ regionId, documentId }: { regionId: string; documentId: string }) {
  const router = useRouter();
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReanalyze() {
    setReanalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/regions/${regionId}/documents/${documentId}/reanalyze`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { analyzed?: boolean; error?: string };
      if (!res.ok || !body.analyzed) {
        setError(body.error ?? "Analyse fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Analyse fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: ".2rem" }}>
      <button type="button" className="btn" style={{ width: "auto", padding: ".2rem .6rem", fontSize: ".76rem" }} disabled={reanalyzing} onClick={handleReanalyze}>
        {reanalyzing ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Analysiert…
          </>
        ) : (
          "Neu analysieren"
        )}
      </button>
      {error ? <span style={{ color: "var(--bad)", fontSize: ".72rem" }}>{error}</span> : null}
    </div>
  );
}
