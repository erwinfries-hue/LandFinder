import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Generischer Key-Value-Endpunkt über die `app_state`-Tabelle (Migration 0002) —
 * ersetzt den bisherigen localStorage-only-Speicher für Suchprofil und
 * Annahmen-Register-Overrides (siehe docs/OPEN_DECISIONS.md, Punkt F/D).
 * Nur GET/PUT auf global bekannte ids, kein Nutzerkontext (kein Login im MVP).
 */

const ALLOWED_IDS = new Set(["search-profile", "annahmen-overrides"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
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
