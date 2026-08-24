-- Globale, überschreibbare Annahmen ("Annahmen"-Reiter) — jede Zeile überschreibt genau
-- einen Parameter aus BESTANDSRENDITE_PARAMETERS (packages/financial-engine/src/
-- parameters.ts) mit einem eigenen Wert. Fehlt eine Zeile für einen Schlüssel, gilt der
-- Registry-Default unverändert — nichts wird stillschweigend erfunden. Single-User-Tool,
-- kein Mandantenbezug nötig, daher wie die übrigen Tabellen hier ohne RLS-Policies
-- (Zugriff ausschliesslich serverseitig über den service_role-Key).
create table if not exists app_settings (
  key text primary key,
  value numeric not null,
  updated_at timestamptz not null default now()
);
