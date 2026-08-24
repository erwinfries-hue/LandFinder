-- "Erkannte Werte zur Übernahme" liessen sich bisher nur übernehmen oder ignorieren — ein
-- bewusst abgelehnter Vorschlag tauchte nach der nächsten "Due-Diligence aktualisieren"-
-- Synthese (die fieldUpdateProposals komplett neu aus den Dokumenten generiert) unverändert
-- wieder auf. Diese Spalte merkt sich abgelehnte (Feld, Wert)-Paare dauerhaft je Objekt.
alter table property_due_diligence add column if not exists dismissed_field_proposals jsonb not null default '[]'::jsonb;
