import { NextResponse, after } from "next/server";
import { parsePostmarkInboundPayload, type PostmarkInboundPayload } from "@/lib/inboundMail";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { processListingLinks } from "@/lib/processListingLinks";

export const maxDuration = 30;

/**
 * Empfängt Suchabo-Mails (Homegate/ImmoScout24/newhome), die Postmark Inbound an diese
 * Route weiterleitet (siehe docs/OPEN_DECISIONS.md, Punkt A/C). Das ist kein Zugriff auf
 * die Portale selbst — die Mails wurden von den Portalen an eine eigens dafür
 * eingerichtete Adresse gesendet, wir lesen hier nur unseren eigenen Posteingang aus.
 *
 * Speichert jeden Treffer in `inbound_alerts` (supabase/migrations/0001_inbound_alerts.sql).
 * Solange die Supabase-Umgebungsvariablen fehlen (z.B. lokal ohne .env), wird nur
 * geloggt statt gespeichert — kein harter Fehler, damit lokale Entwicklung/Tests ohne
 * Datenbank weiterlaufen.
 *
 * Stufe 2 (Einzelseiten-Abruf + Extraktion, `processListingLinks`) läuft über
 * `after()`, damit Postmark sofort eine schnelle Antwort bekommt, statt auf externe
 * Seitenabrufe/LLM-Aufrufe warten zu müssen — reduziert unnötige Retry-Versuche.
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
  console.log("[inbound/portal-alerts]", parsed);

  const supabase = createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.from("inbound_alerts").insert({
      from_address: parsed.from,
      subject: parsed.subject,
      portal_message_date: parsed.date,
      listing_links: parsed.listingLinks,
      raw_payload: payload,
    });
    if (error) {
      console.error("[inbound/portal-alerts] Supabase insert failed", error);
      // 500 statt 200: Postmark wiederholt die Zustellung automatisch (Retry-Mechanismus),
      // damit ein transienter DB-Fehler nicht zu endgültigem Datenverlust führt.
      return NextResponse.json({ received: true, stored: false, error: "storage failed" }, { status: 500 });
    }
  } else {
    console.warn("[inbound/portal-alerts] Supabase nicht konfiguriert — nur geloggt, nicht gespeichert");
  }

  if (supabase && parsed.listingLinks.length > 0) {
    after(async () => {
      try {
        await processListingLinks(supabase, parsed.listingLinks, {
          subject: parsed.subject,
          htmlBody: payload.HtmlBody,
          textBody: payload.TextBody,
        });
      } catch (err) {
        console.error("[inbound/portal-alerts] processListingLinks fehlgeschlagen", err);
      }
    });
  }

  return NextResponse.json(
    { received: true, stored: Boolean(supabase), listingLinksFound: parsed.listingLinks.length },
    { status: 200 },
  );
}
