import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { AVAILABLE_CANTONS } from "@/lib/cantons";
import { normalizeGemeinde } from "@/lib/gemeindeParsing";

const CANTON_CODES = new Set(AVAILABLE_CANTONS.map((c) => c.code));

/**
 * Find-or-Create für eine Region (Kanton+Gemeinde) — vom "Regionen"-Bereich beim
 * Anlegen einer neuen Region bzw. beim Hochladen des ersten Reports für eine noch
 * unbekannte Gemeinde aufgerufen. Zwei Requests mit identischem Kanton+Gemeinde (auch
 * bei abweichender Gross-/Kleinschreibung) liefern dieselbe Region zurück statt
 * Duplikate anzulegen — der Unique-Index auf `(canton, gemeinde_normalized)` ist die
 * harte Absicherung, dieser Upsert-Pfad der komfortable Regelfall.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const canton = typeof b.canton === "string" ? b.canton.trim().toUpperCase() : "";
  const gemeinde = typeof b.gemeinde === "string" ? b.gemeinde.trim() : "";
  if (!canton || !CANTON_CODES.has(canton)) return NextResponse.json({ error: "canton fehlt oder unbekannt" }, { status: 400 });
  if (!gemeinde) return NextResponse.json({ error: "gemeinde fehlt" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const gemeindeNormalized = normalizeGemeinde(gemeinde);
  const { data: existing, error: fetchError } = await supabase
    .from("regions")
    .select("id, canton, gemeinde")
    .eq("canton", canton)
    .eq("gemeinde_normalized", gemeindeNormalized)
    .maybeSingle();
  if (fetchError) {
    console.error("[api/regions] Lesen fehlgeschlagen", fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (existing) return NextResponse.json({ saved: true, id: existing.id, existed: true });

  const { data: created, error: insertError } = await supabase
    .from("regions")
    .insert({ canton, gemeinde, gemeinde_normalized: gemeindeNormalized })
    .select("id")
    .single();
  if (insertError) {
    console.error("[api/regions] Anlegen fehlgeschlagen", insertError);
    return NextResponse.json({ saved: false, error: `write failed: ${insertError.message} (${insertError.code})` }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: created.id, existed: false }, { status: 201 });
}
