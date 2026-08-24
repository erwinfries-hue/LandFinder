import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { parseSynthesisResponse, type SynthesisDocumentInput, type SynthesisKnownField } from "@/lib/dueDiligenceSynthesis";

/**
 * Persistiert eine bereits berechnete Due-Diligence-Synthese (aus dem kombinierten
 * Neu-Erfassen-Flow, `/api/properties/prefill-synthesis`, VOR dem Anlegen des Objekts
 * gelaufen) — ohne Claude ein zweites Mal aufzurufen. Das mitgeschickte Ergebnis läuft
 * trotzdem durch denselben defensiven Parser wie eine frische LLM-Antwort (analog zu
 * `documents/attach/route.ts`): dieselbe Struktur-/Pfadprüfung, kein zusätzlicher
 * Vertrauensvorschuss nur weil es "der eigene" vorherige Aufruf war.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (typeof b.result !== "object" || b.result === null) return NextResponse.json({ error: "result fehlt" }, { status: 400 });
  if (!Array.isArray(b.documents)) return NextResponse.json({ error: "documents fehlt" }, { status: 400 });
  const documents = b.documents as SynthesisDocumentInput[];
  const knownFields = (Array.isArray(b.knownFields) ? b.knownFields : []) as SynthesisKnownField[];

  let result;
  try {
    result = parseSynthesisResponse(JSON.stringify(b.result), documents, knownFields);
  } catch {
    return NextResponse.json({ error: "result ist kein gültiges Synthese-Ergebnis" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: property, error: propertyError } = await supabase.from("properties").select("id").eq("id", propertyId).maybeSingle();
  if (propertyError) {
    console.error(`[api/properties/${propertyId}/due-diligence/save-prefilled] Lesen des Objekts fehlgeschlagen`, propertyError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const { error: upsertError } = await supabase
    .from("property_due_diligence")
    .upsert({ property_id: propertyId, status: "DONE", result, error_message: null, generated_at: new Date().toISOString() });
  if (upsertError) {
    console.error(`[api/properties/${propertyId}/due-diligence/save-prefilled] Speichern fehlgeschlagen`, upsertError);
    return NextResponse.json({ saved: false, error: `write failed: ${upsertError.message} (${upsertError.code})` }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
