import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { parseBestandsrenditeFacts } from "@/lib/bestandsrendite";

/**
 * Speichert die manuell erfassten Bestandsrendite-Fakten (`properties.bestandsrendite`,
 * Migration 0001). Erst danach lässt sich `computeBestandsrenditeAnalysis` sinnvoll
 * berechnen (siehe bestandsrendite.ts).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parseBestandsrenditeFacts(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: property, error: fetchError } = await supabase.from("properties").select("id").eq("id", id).maybeSingle();
  if (fetchError) {
    console.error(`[api/properties/${id}/bestandsrendite] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const { error: updateError } = await supabase
    .from("properties")
    .update({ bestandsrendite: parsed.facts, bestandsrendite_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    console.error(`[api/properties/${id}/bestandsrendite] Speichern fehlgeschlagen`, updateError);
    return NextResponse.json({ saved: false, error: `write failed: ${updateError.message} (${updateError.code})` }, { status: 500 });
  }

  return NextResponse.json({ saved: true }, { status: 200 });
}
