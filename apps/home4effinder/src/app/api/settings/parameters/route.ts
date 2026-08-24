import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/authSession";
import { saveParameterOverrides } from "@/lib/parameterOverrides";

/**
 * Speichert Überschreibungen für den "Annahmen"-Reiter (`app_settings`, Migration 0007).
 * Body: `Record<string, number | null>` — ein `null`-Wert (leer gelassenes Feld im
 * Formular) löscht die Überschreibung wieder, Rückfall auf den Registry-Default.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const result = await saveParameterOverrides(body as Record<string, number | null>);
  if (!result.saved) return NextResponse.json({ saved: false, error: result.error ?? "write failed" }, { status: 500 });
  return NextResponse.json({ saved: true }, { status: 200 });
}
