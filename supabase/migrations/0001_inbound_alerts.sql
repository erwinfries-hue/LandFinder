-- Speichert jede vom Postmark-Inbound-Webhook empfangene Suchabo-Mail dauerhaft
-- (siehe apps/web/src/app/api/inbound/portal-alerts/route.ts, docs/OPEN_DECISIONS.md
-- Punkt A/C). Bisher wurden Treffer nur in den Vercel-Function-Logs geloggt — ohne
-- Persistenz gehen sie nach Ablauf der Log-Aufbewahrung verloren.
--
-- Bewusst nicht Teil der eigentlichen `listings`-Tabelle (Abschnitt 24, noch nicht
-- angelegt): das ist die Rohdaten-Ablage der Discovery-Stufe, bevor eine
-- Stufe-2-Vertiefung (Einzelseiten-Abruf + LLM-Extraktion) die Links in echte
-- Listing-Einträge überführt.

create table if not exists inbound_alerts (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  from_address text not null,
  subject text not null,
  portal_message_date text,
  listing_links text[] not null default '{}',
  raw_payload jsonb not null,
  processed boolean not null default false
);

create index if not exists inbound_alerts_received_at_idx on inbound_alerts (received_at desc);
create index if not exists inbound_alerts_processed_idx on inbound_alerts (processed) where not processed;

-- RLS aktiv, aber ohne Policies: nur der service_role-Key (serverseitig, im
-- Webhook verwendet) darf schreiben/lesen. Kein Client-seitiger Zugriff, bis das
-- explizit gebraucht und eine passende Policy ergänzt wird.
alter table inbound_alerts enable row level security;
