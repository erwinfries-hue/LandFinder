-- SHA-256-Hash der rohen Datei-Bytes je Dokument — Grundlage für die Dubletten-Erkennung
-- (exakte Byte-Duplikate, keine Dateinamen-Heuristik). Bei neuen Uploads sofort gesetzt;
-- für bereits hochgeladene Dokumente füllt die detect-duplicates-Route den Wert nach.
alter table property_documents add column if not exists content_hash text;
create index if not exists property_documents_content_hash_idx on property_documents (property_id, content_hash);
