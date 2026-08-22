"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Löscht ein Objekt komplett (inkl. Dokumente/Due-Diligence, siehe
 * `DELETE /api/properties/[id]`) — von der Objektliste aus, ohne den Umweg über die
 * Objektseite. Eigene Client-Komponente, weil `app/page.tsx` eine Server Component ist
 * und Löschen einen Bestätigungsdialog + Fetch + Refresh braucht.
 */
export function DeletePropertyButton({ propertyId, label }: { propertyId: string; label: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`"${label}" wirklich löschen? Das entfernt auch alle hochgeladenen Dokumente und die Due-Diligence-Auswertung — kann nicht rückgängig gemacht werden.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
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
