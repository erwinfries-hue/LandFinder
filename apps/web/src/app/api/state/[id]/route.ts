import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { isValidSessionToken, SESSION_COOKIE_NAME } from "@/lib/authSession";

/**
 * Generischer Key-Value-Endpunkt über die `app_state`-Tabelle (Migration 0002) —
 * ersetzt den bisherigen localStorage-only-Speicher für Suchprofil und
 * Annahmen-Register-Overrides (siehe docs/OPEN_DECISIONS.md, Punkt F/D).
 * Nur GET/PUT auf global bekannte ids, kein individueller Nutzerkontext (ein
 * geteiltes Passwort für den ganzen Nutzerkreis, siehe Abschnitt 6).
 *
 * Der Zugriffsschutz läuft primär über middleware.ts; die Prüfung hier ist
 * bewusste Redundanz (defense in depth) für diesen besonders sensiblen
 * Endpunkt, falls die Middleware-Konfiguration je versehentlich geändert wird.
 */

const ALLOWED_IDS = new Set(["search-profile", "annahmen-overrides"]);

async function hasValidSession(request: Request): Promise<boolean> {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return isValidSessionToken(match?.[1], appPassword);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ALLOWED_IDS.has(id)) return NextResponse.json({ error: "unknown id" }, { status: 404 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ data: null, configured: false }, { status: 200 });

  const { data, error } = await supabase.from("app_state").select("data").eq("id", id).maybeSingle();
  if (error) {
    console.error(`[api/state/${id}] GET failed`, error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  return NextResponse.json({ data: data?.data ?? null, configured: true }, { status: 200 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ALLOWED_IDS.has(id)) return NextResponse.json({ error: "unknown id" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { error } = await supabase.from("app_state").upsert({ id, data: body, updated_at: new Date().toISOString() });
  if (error) {
    console.error(`[api/state/${id}] PUT failed`, error);
    return NextResponse.json({ saved: false, error: "write failed" }, { status: 500 });
  }
  return NextResponse.json({ saved: true }, { status: 200 });
}
