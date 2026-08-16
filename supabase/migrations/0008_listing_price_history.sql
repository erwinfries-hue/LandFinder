-- Preis-Historie je Inserat (Abschnitt 20, "Preis-/Statusänderungen über Zeit") —
-- `listings.asking_price_chf` selbst kennt nur den aktuellen Wert, keinen Verlauf.
-- Ein Eintrag entsteht bei jeder Stufe-2-Verarbeitung, deren extrahierter Preis vom
-- zuletzt gespeicherten abweicht (inkl. des allerersten Preises je Inserat) — siehe
-- `apps/web/src/lib/processListingLinks.ts`. Grundlage für die "Preisänderung"-Spalte
-- auf /vergleich und die "Preisreduktion"-Dashboard-Kennzahl.

create table if not exists listing_price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  price_chf numeric not null,
  observed_at timestamptz not null default now()
);

create index if not exists listing_price_history_listing_id_idx
  on listing_price_history (listing_id, observed_at);

alter table listing_price_history enable row level security;
