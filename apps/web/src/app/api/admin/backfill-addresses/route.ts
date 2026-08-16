import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { extractFromEmailContent } from "@/lib/listingExtraction";
import { deriveCantonFromAddress } from "@/lib/plzKanton";

export const maxDuration = 30;

/**
 * Wartungs-Route, bewusst als Dauerfeature angelegt (nicht wie /api/debug-supabase-url
 * temporär) — mehrfach und gefahrlos wiederholt aufrufbar: verarbeitet bei jedem
 * Aufruf nur, was zu diesem Zeitpunkt tatsächlich noch fehlt (`address_text IS NULL`),
 * bereits erfolgreich nachgetragene Zeilen werden beim nächsten Lauf automatisch
 * übersprungen. Sinnvoll erneut auszuführen, wann immer sich an der
 * Mailinhalt-Extraktion (`extractFromEmailContent()`) etwas ändert, das zuvor
 * gespeicherte Zeilen betreffen könnte — nicht nur für den unten beschriebenen Anlass.
 *
 * Ursprünglicher Anlass (2026-08-16, docs/OPEN_DECISIONS.md): `extractFromEmailContent()`
 * fand bei einer Adresse ohne Strassenangabe (nur PLZ + Ort, z.B. "8545 Rickenbach
 * Sulz") bisher gar nichts. Der Code-Fix wirkt nur auf künftig neu verarbeitete Mails —
 * diese Route trägt es für bereits gespeicherte `listings`-Zeilen ohne `address_text`
 * (Methode EMAIL_HEURISTIC) nach, indem die zugehörige Original-Mail aus
 * `inbound_alerts` erneut mit der jeweils aktuellen Extraktionsfunktion durchlaufen
 * wird. Ändert ausschliesslich `address_text` und — falls noch nicht gesetzt —
 * `canton`; alle anderen Felder bleiben unangetastet.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, canonical_url, canton, extraction")
    .is("address_text", null);
  if (listingsError) {
    console.error("[admin/backfill-addresses] Lesen von listings fehlgeschlagen", listingsError);
    return NextResponse.json({ error: "read listings failed" }, { status: 500 });
  }

  const candidates = (listings ?? []).filter(
    (l) => (l.extraction as { method?: string } | null)?.method === "EMAIL_HEURISTIC",
  );
  if (candidates.length === 0) {
    return NextResponse.json({ checked: 0, updated: 0, stillUnresolved: 0 });
  }

  const { data: alerts, error: alertsError } = await supabase
    .from("inbound_alerts")
    .select("subject, raw_payload, listing_links");
  if (alertsError) {
    console.error("[admin/backfill-addresses] Lesen von inbound_alerts fehlgeschlagen", alertsError);
    return NextResponse.json({ error: "read inbound_alerts failed" }, { status: 500 });
  }

  const linkToMail = new Map<string, { subject: string; rawPayload: { HtmlBody?: string; TextBody?: string } }>();
  for (const alert of alerts ?? []) {
    for (const link of (alert.listing_links as string[] | null) ?? []) {
      if (!linkToMail.has(link)) {
        linkToMail.set(link, { subject: alert.subject, rawPayload: alert.raw_payload as { HtmlBody?: string; TextBody?: string } });
      }
    }
  }

  let updated = 0;
  let stillUnresolved = 0;

  await Promise.all(
    candidates.map(async (listing) => {
      const mail = linkToMail.get(listing.canonical_url);
      if (!mail) {
        stillUnresolved++;
        return;
      }
      const result = extractFromEmailContent({ subject: mail.subject, htmlBody: mail.rawPayload.HtmlBody, textBody: mail.rawPayload.TextBody });
      if (!result.fields.addressText) {
        stillUnresolved++;
        return;
      }

      const canton = listing.canton ?? deriveCantonFromAddress(result.fields.addressText) ?? null;
      const extraction = (listing.extraction as Record<string, unknown>) ?? {};
      const fields = (extraction.fields as Record<string, unknown>) ?? {};

      const { error: updateError } = await supabase
        .from("listings")
        .update({
          address_text: result.fields.addressText,
          canton,
          extraction: { ...extraction, fields: { ...fields, addressText: result.fields.addressText, canton: canton ?? fields.canton } },
        })
        .eq("id", listing.id);
      if (updateError) {
        console.error("[admin/backfill-addresses] Update fehlgeschlagen", listing.id, updateError);
        stillUnresolved++;
        return;
      }
      updated++;
    }),
  );

  return NextResponse.json({ checked: candidates.length, updated, stillUnresolved });
}
