import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidCronSecret } from "@/lib/cronAuth";
import { runBackfillAddresses } from "@/app/api/admin/backfill-addresses/route";
import { runCleanupSearchResultListings } from "@/app/api/admin/cleanup-search-result-listings/route";

export const maxDuration = 30;

/**
 * Täglicher Wartungslauf (docs/OPEN_DECISIONS.md, Punkt I.4 — "Automatisierung jetzt
 * angehen"): führt dieselben zwei Wartungsroutinen aus, die bisher nur manuell per
 * Aufruf im Browser (eingeloggt) angestossen wurden — `runBackfillAddresses` und
 * `runCleanupSearchResultListings`. Ausgelöst von Vercel Cron (`apps/web/vercel.json`),
 * nicht vom Passwort-Login geschützt (ein Cron-Job hat keine Session), sondern über
 * `CRON_SECRET` (siehe cronAuth.ts) — von Vercel automatisch als
 * `Authorization: Bearer <CRON_SECRET>`-Header mitgeschickt, sobald die Umgebungsvariable
 * gesetzt ist. Bewusst (noch) kein Digest-Versand hier: mit aktuell so gut wie keinen
 * vertieften echten Inseraten (siehe Punkt F) wäre ein "neue B-Treffer/Top-10"-Digest
 * heute fast leer — eigener, noch zu klärender Umfang (workers/digest), kein Nebeneffekt
 * dieses Wartungslaufs.
 */
export async function GET(request: Request): Promise<Response> {
  if (!hasValidCronSecret(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const [backfill, cleanup] = await Promise.all([runBackfillAddresses(supabase), runCleanupSearchResultListings(supabase)]);

  return NextResponse.json({ ranAt: new Date().toISOString(), backfillAddresses: backfill, cleanupSearchResultListings: cleanup });
}
