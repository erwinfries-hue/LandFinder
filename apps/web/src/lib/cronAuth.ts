/**
 * Schutz für Cron-ausgelöste Routen (`apps/web/vercel.json`) — Vercel hängt bei
 * konfiguriertem `CRON_SECRET` automatisch den Header `Authorization: Bearer
 * <CRON_SECRET>` an jeden Cron-Aufruf an (offizielles Vercel-Muster, kein eigener
 * Code auf Vercel-Seite nötig). Bewusst dieselbe Fail-closed-Logik wie
 * `hasValidSession`/`APP_PASSWORD` (Punkt D, docs/OPEN_DECISIONS.md): fehlt
 * `CRON_SECRET`, bleibt die Route gesperrt statt offen erreichbar.
 */
export function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
