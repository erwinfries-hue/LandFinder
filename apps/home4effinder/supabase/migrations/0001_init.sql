-- HOME4efFINDER — eigene, von LandFinder unabhängige Datenbank. Schlankes Schema nur
-- für das, was diese App tatsächlich braucht: bestehende Eigentumswohnungen als
-- Buy-to-let-Investment (manuell erfasst, keine Portal-Ingestion), das 3-stufige
-- Bestandsrendite-Modell (Schnellcheck/Investment Case/15-Jahres-Modell) und die
-- Dokumenten-KI/Due-Diligence-Prüfung. RLS aktiv, keine Policies — wie im gesamten
-- Projekt üblich liest/schreibt ausschliesslich der service_role-Key serverseitig,
-- kein Client-seitiger Zugriff.

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  title text,
  address_text text not null,
  canton text not null,
  asking_price_chf numeric not null,
  wohnflaeche_m2 numeric not null,
  -- Alle Bestandsrendite-Fakten (Zimmerzahl, Baujahr, STWEG, Vermietungs-/
  -- Kostenannahmen für das 3-Ebenen-Rechenmodell) als jsonb-Blob statt vieler
  -- Einzelspalten — siehe src/lib/bestandsrendite.ts::BestandsrenditeFacts.
  bestandsrendite jsonb,
  bestandsrendite_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table properties enable row level security;

-- Ohne Trigger bliebe `updated_at` für immer auf dem Erstellungszeitpunkt stehen
-- (Postgres aktualisiert es nicht von selbst) und würde fälschlich "zuletzt
-- bearbeitet" vortäuschen, obwohl es das nie wäre.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger properties_set_updated_at
  before update on properties
  for each row
  execute function set_updated_at();

insert into storage.buckets (id, name, public)
values ('property-documents', 'property-documents', false)
on conflict (id) do nothing;

create table if not exists property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  -- PENDING (hochgeladen, Analyse noch nicht gelaufen) | DONE | FAILED — die
  -- Stufe-1-Analyse läuft synchron im Upload-Request.
  analysis_status text not null default 'PENDING',
  analysis_error text,
  -- Strukturierte Extraktion (DocumentExtractionResult aus @landfinder/domain):
  -- erkannter Dokumenttyp, Zusammenfassung, Fakten, Befunde mit Seiten-/Zitat-Beleg.
  extraction jsonb,
  analyzed_at timestamptz
);

create index if not exists property_documents_property_id_idx on property_documents (property_id);

alter table property_documents enable row level security;

-- Cross-Dokument-Due-Diligence-Synthese je Objekt (Stufe 2) — bewusst NICHT bei jedem
-- Seitenaufruf neu berechnet: liest potenziell viele Dokument-Extraktionen auf einmal,
-- ein teurer, nicht-deterministischer LLM-Aufruf statt einer günstigen reinen Formel.
-- Explizit angestossen ("Due-Diligence aktualisieren"), Ergebnis persistiert bis zum
-- nächsten Anstoss.
create table if not exists property_due_diligence (
  property_id uuid primary key references properties(id) on delete cascade,
  status text not null default 'PENDING',
  error_message text,
  -- DueDiligenceResult aus @landfinder/domain: Gesamtstatus, Kategorien mit Befunden,
  -- fehlende Dokumente, Verkäufer-/Maklerfragen, Feldwert-Übernahmevorschläge.
  result jsonb,
  generated_at timestamptz
);

alter table property_due_diligence enable row level security;
