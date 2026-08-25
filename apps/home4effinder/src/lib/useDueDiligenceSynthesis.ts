"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchJsonWithRetry } from "./fetchJsonWithRetry";
import type { PartialSynthesisResult } from "./dueDiligenceSynthesis";

/**
 * Kapselt den batchweisen Ablauf der Stufe-2-Synthese (siehe `dueDiligenceSynthesis.ts`
 * / docs/DECISIONS.md, "Due-Diligence-Synthese batched statt ein einzelner
 * Blocking-Call") — ruft `.../due-diligence` wiederholt mit steigendem `batchIndex`
 * auf (jeweils über `fetchJsonWithRetry`, EIN automatischer Retry PRO Batch statt
 * fürs Ganze), sammelt die Zwischenergebnisse im Speicher und schickt sie danach
 * EINMAL an `.../due-diligence/finalize`. Als Hook extrahiert, damit sowohl
 * `DueDiligencePanel.tsx` (grosser Auswertungsbereich weiter unten) als auch der
 * kompakte `DueDiligenceRefreshButton.tsx` (Objektseiten-Header, direkte
 * Anstoss-Möglichkeit ohne erst zum Panel scrollen zu müssen) dieselbe Loop-Logik
 * verwenden — nicht zweimal dieselbe Batch-Abfolge pflegen.
 */
export function useDueDiligenceSynthesis(propertyId: string) {
  const router = useRouter();
  const [synthesizing, setSynthesizing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setSynthesizing(true);
    setError(null);
    setProgress(null);
    try {
      const batchResults: PartialSynthesisResult[] = [];
      let batchIndex = 0;
      let totalBatches = 1;
      while (batchIndex < totalBatches) {
        const body = await fetchJsonWithRetry<{
          saved?: boolean;
          error?: string;
          batchResult?: PartialSynthesisResult;
          totalBatches?: number;
        }>(`/api/properties/${propertyId}/due-diligence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchIndex }),
        });
        if (!body.saved || !body.batchResult) {
          setError(body.error ?? "Analyse fehlgeschlagen.");
          return;
        }
        batchResults.push(body.batchResult);
        totalBatches = body.totalBatches ?? 1;
        batchIndex += 1;
        setProgress({ done: batchIndex, total: totalBatches });
      }

      const finalizeBody = await fetchJsonWithRetry<{ saved?: boolean; error?: string }>(`/api/properties/${propertyId}/due-diligence/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batches: batchResults }),
      });
      if (!finalizeBody.saved) {
        setError(finalizeBody.error ?? "Zusammenführen fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Analyse fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setSynthesizing(false);
      setProgress(null);
    }
  }

  return { synthesizing, progress, error, run };
}
