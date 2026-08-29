-- Quellenverzeichnis: allgemeine Studien/Marktberichte/Referenzdokumente (z.B. UBS
-- Wohnattraktivitätsindikator) — anders als property_documents/region_documents NICHT
-- einem Objekt oder einer Gemeinde zugeordnet, sondern eine schlichte Liste mit Link
-- auf das Dokument (hochgeladene Datei ODER externe URL). Bewusst OHNE KI-Extraktion
-- (anders als region_documents) — reine Nachschlage-/Verlinkungsliste, siehe
-- src/lib/quellen.ts.

insert into storage.buckets (id, name, public)
values ('quellen-dokumente', 'quellen-dokumente', false)
on conflict (id) do nothing;

create table if not exists quellen (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Freitext mit Vorschlagswerten in der UI (Studie/Marktbericht/Gesetzestext/Sonstiges)
  -- statt starrem Enum — analog zum bestehenden Datalist-Muster in dieser App
  -- (BestandsrenditeFactsFields.tsx).
  category text not null default 'Sonstiges',
  publisher text,
  published_date date,
  notes text,
  -- Genau eine der beiden Verlinkungsarten muss gesetzt sein: entweder eine hochgeladene
  -- Datei (storage_path) ODER eine externe URL — nie beide, nie keine.
  external_url text,
  storage_path text,
  original_filename text,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quellen_exactly_one_link check (
    (external_url is not null and storage_path is null) or
    (external_url is null and storage_path is not null)
  )
);

-- Verhindert einen doppelten Eintrag für exakt dieselbe hochgeladene Datei.
create unique index if not exists quellen_content_hash_idx on quellen (content_hash) where content_hash is not null;

alter table quellen enable row level security;

create trigger quellen_set_updated_at
  before update on quellen
  for each row
  execute function set_updated_at();
