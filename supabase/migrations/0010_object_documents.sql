-- Dokumenten-KI / Due-Diligence für Bestandswohnungen (docs/OPEN_DECISIONS.md,
-- Punkt O). Privater Storage-Bucket + Tabelle für hochgeladene Dokumente, jeweils mit
-- Stufe-1-Extraktion (siehe apps/web/src/lib/dueDiligenceExtraction.ts). Wie bei allen
-- anderen Tabellen in diesem Projekt: RLS aktiv, keine Policies — nur der
-- service_role-Key (server-seitig) liest/schreibt, kein Client-seitiger Zugriff.

insert into storage.buckets (id, name, public)
values ('object-documents', 'object-documents', false)
on conflict (id) do nothing;

create table if not exists object_documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  -- PENDING (hochgeladen, Analyse noch nicht gelaufen) | DONE | FAILED — die
  -- Stufe-1-Analyse läuft synchron im Upload-Request (kein Zwischenzustand
  -- "ANALYZING" über mehrere Requests hinweg nötig, siehe dueDiligenceExtraction.ts).
  analysis_status text not null default 'PENDING',
  analysis_error text,
  -- Strukturierte Extraktion (DocumentExtractionResult aus @landfinder/domain):
  -- erkannter Dokumenttyp, Zusammenfassung, Fakten, Befunde mit Seiten-/Zitat-Beleg.
  extraction jsonb,
  analyzed_at timestamptz
);

create index if not exists object_documents_listing_id_idx on object_documents (listing_id);

alter table object_documents enable row level security;

-- Cross-Dokument-Due-Diligence-Synthese je Objekt (Stufe 2) — bewusst NICHT bei jedem
-- Seitenaufruf neu berechnet (anders als analyses/comparisons an anderer Stelle im
-- Projekt): liest potenziell viele Dokument-Extraktionen auf einmal, ein teurer,
-- nicht-deterministischer LLM-Aufruf statt einer günstigen reinen Formel. Explizit
-- angestossen ("Due-Diligence aktualisieren"), Ergebnis persistiert bis zum nächsten
-- Anstoss.
create table if not exists object_due_diligence (
  listing_id uuid primary key references listings(id) on delete cascade,
  status text not null default 'PENDING',
  error_message text,
  -- DueDiligenceResult aus @landfinder/domain: Gesamtstatus, Kategorien mit Befunden,
  -- fehlende Dokumente, Verkäufer-/Maklerfragen, Feldwert-Übernahmevorschläge.
  result jsonb,
  generated_at timestamptz
);

alter table object_due_diligence enable row level security;
