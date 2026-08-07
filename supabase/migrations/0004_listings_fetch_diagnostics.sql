-- Ergänzt Diagnosedaten zum letzten Stufe-2-Abrufversuch (siehe
-- apps/web/src/lib/fetchListingPage.ts, apps/web/src/lib/processListingLinks.ts).
-- Anlass: newhome.ch blockiert den Abruf in Produktion (docs/OPEN_DECISIONS.md,
-- Punkt A) — bisher landete nur der grobe Status (BLOCKED/TIMEOUT/NOT_AVAILABLE)
-- in `listings`, ohne den tatsächlichen HTTP-Code oder Zeitpunkt. Das macht es
-- unnötig schwer, spätere Änderungen (z.B. andere Header) zu beurteilen.

alter table listings
  add column if not exists last_fetch_http_status integer,
  add column if not exists last_fetch_at timestamptz;
