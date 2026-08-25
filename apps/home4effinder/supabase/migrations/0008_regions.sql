-- Regionen-Marktdaten (Gemeinde-/Regions-Standortreports, z.B. Wüest Partner
-- "Standortinformation") — anders als property_documents NICHT einem einzelnen Objekt
-- zugeordnet, sondern wiederverwendbar für alle Objekte in derselben Gemeinde. Siehe
-- src/lib/regionExtraction.ts / src/lib/regionMarketData.ts.

create table if not exists regions (
  id uuid primary key default gen_random_uuid(),
  canton text not null,
  gemeinde text not null,
  -- lower(trim(gemeinde)) für stabiles Matching unabhängig von Gross-/Kleinschreibung
  -- und Leerzeichen — die Anzeige-Schreibweise bleibt unverändert in `gemeinde`.
  gemeinde_normalized text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Kanton+Gemeinde als Composite-Key, nicht nur Gemeinde: mehrere Schweizer Gemeinden
  -- teilen denselben Namen in unterschiedlichen Kantonen (z.B. Wohlen AG vs. Wohlen
  -- bei Bern BE).
  unique (canton, gemeinde_normalized)
);

alter table regions enable row level security;

create trigger regions_set_updated_at
  before update on regions
  for each row
  execute function set_updated_at();

insert into storage.buckets (id, name, public)
values ('region-documents', 'region-documents', false)
on conflict (id) do nothing;

create table if not exists region_documents (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  -- PENDING (hochgeladen, Analyse noch nicht gelaufen) | DONE | FAILED — die Analyse
  -- läuft synchron im Upload-Request, analog zu property_documents.
  analysis_status text not null default 'PENDING',
  analysis_error text,
  -- Strukturierte Extraktion (RegionExtractionResult aus src/lib/regionExtraction.ts):
  -- Gemeinde-Kennzahlen + Miet-/Kaufpreis-Quantiltabellen je Zimmerzahl.
  extraction jsonb,
  analyzed_at timestamptz,
  content_hash text not null,
  -- "Abfragedatum" aus dem Report, falls extrahiert — für die Sortierung "neuester
  -- Report zuerst", wenn mehrere Reports zu derselben Region hochgeladen wurden.
  report_date date
);

create index if not exists region_documents_region_id_idx on region_documents (region_id);

-- Verhindert einen zweiten Claude-Aufruf beim wiederholten Upload exakt derselben
-- Datei in dieselbe Region (proaktiv beim Upload geprüft, siehe api/regions/[id]/documents).
create unique index if not exists region_documents_content_hash_idx
  on region_documents (region_id, content_hash);

alter table region_documents enable row level security;

-- Best-effort aus der Adresse abgeleitet, aber immer manuell korrigierbar (siehe
-- src/lib/gemeindeParsing.ts) — keine Fremdschlüsselbeziehung zu `regions`: die
-- Verknüpfung erfolgt zur Laufzeit über einen Kanton+Gemeinde-Text-Match, damit sie
-- robust bleibt, auch wenn eine Region erst nach dem Objekt angelegt wird.
alter table properties add column if not exists gemeinde text;
