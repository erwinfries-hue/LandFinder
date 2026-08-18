"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PropertyDeleteButton({ propertyId, propertyLabel }: { propertyId: string; propertyLabel: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`"${propertyLabel}" wirklich löschen? Alle erfassten Daten, Dokumente und die Due-Diligence-Synthese gehen dabei unwiderruflich verloren.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { deleted?: boolean; error?: string };
      if (!res.ok || !body.deleted) {
        window.alert(body.error ?? "Löschen fehlgeschlagen.");
        setDeleting(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      window.alert("Löschen fehlgeschlagen (Netzwerkfehler).");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className="btn"
      style={{ width: "auto", padding: ".3rem .7rem", fontSize: ".78rem", background: "none", color: "var(--bad)", border: "1px solid var(--bad)" }}
      disabled={deleting}
      onClick={handleDelete}
    >
      {deleting ? "Löscht…" : "Objekt löschen"}
    </button>
  );
}
