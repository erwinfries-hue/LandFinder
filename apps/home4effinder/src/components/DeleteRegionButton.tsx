"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Löscht eine Region komplett (inkl. aller Reports, siehe `DELETE /api/regions/[id]`)
 * — mirrort DeletePropertyButton.tsx/PropertyDeleteButton.tsx. `redirectTo` optional:
 * auf der Regions-Detailseite muss nach dem Löschen weggeleitet werden (die Seite
 * existiert danach nicht mehr, analog zu PropertyDeleteButton.tsx), in der Regionen-
 * Liste reicht ein einfacher Refresh (Zeile verschwindet, Seite bleibt dieselbe).
 */
export function DeleteRegionButton({ regionId, label, redirectTo }: { regionId: string; label: string; redirectTo?: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Region "${label}" wirklich löschen? Das entfernt auch alle hochgeladenen Reports — kann nicht rückgängig gemacht werden.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/regions/${regionId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { deleted?: boolean; error?: string };
      if (!res.ok || !body.deleted) {
        window.alert(body.error ?? "Löschen fehlgeschlagen.");
        setDeleting(false);
        return;
      }
      if (redirectTo) router.push(redirectTo);
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
