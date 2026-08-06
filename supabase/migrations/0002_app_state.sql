-- Generischer Key-Value-Speicher für globalen (nicht nutzerspezifischen) App-Zustand,
-- der bisher nur in localStorage lag: das Suchprofil (apps/web/src/lib/searchProfile.ts,
-- id 'search-profile') und die Annahmen-Register-Overrides (apps/web/src/lib/
-- annahmen.ts, id 'annahmen-overrides'). Ein Schema für beides statt zwei fast
-- identischer Tabellen — beide sind "ein globaler JSON-Blob unter einer festen id",
-- kein Multi-Tenancy im MVP (Abschnitt 6/Punkt D der offenen Entscheidungen).

create table if not exists app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;
-- Keine Policies: nur der service_role-Key (serverseitig, in den API-Routes
-- verwendet) darf lesen/schreiben, wie bei inbound_alerts.
