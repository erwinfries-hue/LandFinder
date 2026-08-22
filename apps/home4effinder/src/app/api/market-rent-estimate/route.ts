import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/authSession";
import { estimateMarketRent, type MarketRentEstimateResult } from "@/lib/marketRentEstimate";
import { AnthropicNotConfiguredError } from "@/lib/dueDiligenceExtraction";

/**
 * Stateless (kein `propertyId`) — wird sowohl im kombinierten Neu-Erfassen-Flow
 * (`PropertyCreateForm`, Objekt existiert in der DB noch nicht) als auch beim
 * Bearbeiten eines bestehenden Objekts (`BestandsrenditeVertiefungForm`) verwendet,
 * beide brauchen nur Kanton + optional Zimmerzahl aus dem bereits offenen Formular.
 */
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const canton = typeof b.canton === "string" ? b.canton.trim() : "";
  const zimmerzahl = typeof b.zimmerzahl === "number" && b.zimmerzahl > 0 ? b.zimmerzahl : undefined;
  if (!canton) return NextResponse.json({ error: "canton fehlt" }, { status: 400 });

  let result: MarketRentEstimateResult;
  try {
    result = await estimateMarketRent({ canton, zimmerzahl });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Schätzung fehlgeschlagen";
    console.error("[api/market-rent-estimate] Schätzung fehlgeschlagen", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ estimated: true, ...result });
}
