import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/authSession";
import { synthesizeDueDiligence, type SynthesisDocumentInput, type SynthesisKnownFact, type SynthesisKnownField } from "@/lib/dueDiligenceSynthesis";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";

/**
 * Zustandslose Stufe-2-Synthese, BEVOR ein Objekt überhaupt existiert (kombinierter
 * Neu-Erfassen-Flow, `PropertyCreateForm`) — nutzt dieselbe reine Funktion
 * `synthesizeDueDiligence` wie die reguläre, objektgebundene Route
 * (`/api/properties/[id]/due-diligence`), aber mit Dokumenten, die noch nicht in der DB
 * liegen (jeweils schon einzeln über `/api/properties/prefill` analysiert). Schreibt
 * nichts — der Client verwendet `fieldUpdateProposals` daraus, um die
 * Bestandsrendite-Fakten-Felder vorauszufüllen, und hängt beim tatsächlichen Anlegen das
 * bereits berechnete Gesamtergebnis über `/api/properties/[id]/due-diligence/save-prefilled`
 * an, statt Claude ein zweites Mal aufzurufen.
 */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.documents) || b.documents.length === 0) {
    return NextResponse.json({ error: "documents fehlt oder leer" }, { status: 400 });
  }
  const documents = b.documents as SynthesisDocumentInput[];
  const knownFacts = (Array.isArray(b.knownFacts) ? b.knownFacts : []) as SynthesisKnownFact[];
  const knownFields = (Array.isArray(b.knownFields) ? b.knownFields : []) as SynthesisKnownField[];

  try {
    const result = await synthesizeDueDiligence(documents, knownFacts, knownFields);
    return NextResponse.json({ synthesized: true, result });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Synthese fehlgeschlagen";
    console.error("[api/properties/prefill-synthesis] Synthese fehlgeschlagen", err);
    return NextResponse.json({ synthesized: false, error: message }, { status: 502 });
  }
}
