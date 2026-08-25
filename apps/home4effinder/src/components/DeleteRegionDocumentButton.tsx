"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Löscht einen einzelnen Regionsreport — mirrort DeletePropertyButton.tsx. */
export function DeleteRegionDocumentButton({ regionId, documentId, label }: { regionId: string; documentId: string; label: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`"${label}" wirklich löschen? Kann nicht rückgängig gemacht werden.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/regions/${regionId}/documents/${documentId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { deleted?: boolean; error?: string };
      if (!res.ok || !body.deleted) {
        window.alert(body.error ?? "Löschen fehlgeschlagen.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Löschen fehlgeschlagen (Netzwerkfehler).");
      setDeleting(false);
    }
  }

  return (
    <button type="button" className="btn" style={{ width: "auto", padding: ".2rem .6rem", fontSize: ".76rem" }} disabled={deleting} onClick={handleDelete}>
      {deleting ? "Löscht…" : "Löschen"}
    </button>
  );
}
