-- Trägt fest, wann für ein Inserat zuletzt eine Alert-Mail ausgelöst wurde (siehe
-- apps/web/src/lib/listingAlerts.ts). Dient als Dedup-Schutz (nie zweimal für
-- dieselbe URL alarmieren) und als Basis für das Tageslimit aus dem Suchprofil
-- (`alerts.maxImmediateEmailsPerDay`).

alter table listings
  add column if not exists alert_sent_at timestamptz;
