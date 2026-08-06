-- Stufe 2 (docs/OPEN_DECISIONS.md, Punkt A/B): strukturierte Inserate, gefüllt durch
-- den Einzelseiten-Abruf + Extraktion (apps/web/src/lib/listingExtraction.ts), aus den
-- Links, die inbound_alerts (Migration 0001) aus den Suchabo-Mails gesammelt hat.
-- Spalten orientieren sich an packages/domain/src/listing.ts (`Listing`-Interface).

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique,
  source text not null,
  title text,
  description text,
  object_type text,
  address_text text,
  canton text,
  municipality text,
  asking_price_chf numeric,
  parcel_area_m2 numeric,
  existing_building boolean,
  known_zone text,
  -- Rohe Extraktion inkl. Konfidenz/Methode je Feld — nichts wird "glattgezogen",
  -- die Herkunft jedes Werts bleibt nachvollziehbar (Abschnitt 8).
  extraction jsonb not null default '{}'::jsonb,
  ingestion_status text not null default 'NEW',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists listings_last_seen_idx on listings (last_seen_at desc);

alter table listings enable row level security;
-- Keine Policies: nur der service_role-Key darf lesen/schreiben.
