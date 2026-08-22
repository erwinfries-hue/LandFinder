-- Manuell umschaltbarer, dauerhafter Ausschluss eines einzelnen Dokuments aus der
-- Due-Diligence-Synthese (Stufe 2) — ohne es zu löschen. Gedacht für Dokumente, deren
-- Stufe-1-Analyse besonders lange dauert oder wiederholt an Vercels 60-Sekunden-Limit
-- scheitert: statt bei jeder Synthese erneut zu riskieren, dass die gesamte Anfrage
-- timeoutet, kann der Nutzer ein einzelnes Dokument temporär ausschliessen und später
-- wieder einschliessen. Default false, damit bestehende Dokumente unverändert in die
-- Synthese einfliessen.

alter table property_documents add column if not exists excluded_from_synthesis boolean not null default false;
