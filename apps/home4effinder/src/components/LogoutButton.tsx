"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontSize: "inherit", textDecoration: "underline" }}
    >
      {loading ? "Meldet ab…" : "Abmelden"}
    </button>
  );
}
