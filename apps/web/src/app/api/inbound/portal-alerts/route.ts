import { NextResponse } from "next/server";
import { parsePostmarkInboundPayload, type PostmarkInboundPayload } from "@/lib/inboundMail";

/**
 * Empfängt Suchabo-Mails (Homegate/ImmoScout24/newhome), die Postmark Inbound an diese
 * Route weiterleitet (siehe docs/OPEN_DECISIONS.md, Punkt A/C). Das ist kein Zugriff auf
 * die Portale selbst — die Mails wurden von den Portalen an eine eigens dafür
 * eingerichtete Adresse gesendet, wir lesen hier nur unseren eigenen Posteingang aus.
 *
 * Persistenz fehlt noch (Supabase, Punkt C): bis dahin werden gefundene Inserat-Links
 * nur geloggt, nicht gespeichert.
 */
export async function POST(request: Request): Promise<Response> {
  // Erwartetes Format: "username:password" — dieselben Zugangsdaten, die in der
  // Postmark-Webhook-URL als https://username:password@... eingebettet werden.
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const expected = `Basic ${Buffer.from(secret).toString("base64")}`;
    if (auth !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = (await request.json()) as PostmarkInboundPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parsePostmarkInboundPayload(payload);
  // Vorläufiges Logging bis Supabase (Punkt C) steht.
  console.log("[inbound/portal-alerts]", parsed);

  return NextResponse.json({ received: true, listingLinksFound: parsed.listingLinks.length }, { status: 200 });
}
