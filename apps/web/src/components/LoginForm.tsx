"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@landfinder/ui";

/**
 * Wirft nur das Passwort-Feld gegen `/api/auth/login` — ein geteiltes Passwort für
 * den ganzen Nutzerkreis (siehe docs/OPEN_DECISIONS.md, Punkt D), kein individuelles
 * Konto pro Person. E-Mail-Feld und "Angemeldet bleiben" bleiben aus dem
 * ursprünglichen, bereits abgenommenen Mockup-Design (Punkt H) erhalten, sind aber
 * aktuell rein kosmetisch — ein künftiges Mehrbenutzer-Login kann sie später nutzen.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const notConfigured = searchParams.get("reason") === "not-configured";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Anmeldung fehlgeschlagen.");
        return;
      }
      router.push(searchParams.get("redirect") || "/");
      router.refresh();
    } catch {
      setError("Anmeldung fehlgeschlagen — bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {notConfigured && (
        <p className="loginerror" role="alert">
          Login ist noch nicht eingerichtet (fehlende Umgebungsvariable). Bitte <code>APP_PASSWORD</code> in den
          Vercel-Projekteinstellungen setzen.
        </p>
      )}
      {error && (
        <p className="loginerror" role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor="lf-email">E-Mail-Adresse</label>
        <input id="lf-email" type="email" placeholder="name@beispiel.ch" />
      </div>
      <div className="field">
        <label htmlFor="lf-pw">Passwort</label>
        <input
          id="lf-pw"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="rowbetween">
        <label>
          <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} /> Angemeldet bleiben
        </label>
      </div>
      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? "Meldet an …" : "Anmelden"} <Icon name="import" style={{ transform: "rotate(-90deg)" }} />
      </button>
    </form>
  );
}
