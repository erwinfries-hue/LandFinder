-- Bestandsrendite auf Eigentumswohnungen (docs/OPEN_DECISIONS.md, Punkt N/O) —
-- ergänzt `listings` um die Felder, die für BESTANDSWOHNUNG-Objekte gebraucht werden,
-- aber bei Bauland/Abbruchobjekt keinen Sinn ergeben. `wohnflaeche_m2` bewusst als
-- eigene Spalte statt `parcel_area_m2` wiederzuverwenden — semantisch etwas anderes
-- (Wohnfläche einer Wohnung vs. Parzellenfläche eines Grundstücks), Verwechslung wäre
-- sonst leicht möglich. `bestandsrendite` als jsonb-Blob analog zu `vertiefung`
-- (Migration 0007) für alles, was nur Bestandswohnungen betrifft (Zimmerzahl,
-- Baujahr, STWEG-Fakten, Vermietungs-/Kostenannahmen für das 3-Ebenen-Rechenmodell)
-- statt weitere Einzelspalten anzulegen.

alter table listings
  add column if not exists wohnflaeche_m2 numeric,
  add column if not exists bestandsrendite jsonb,
  add column if not exists bestandsrendite_updated_at timestamptz;
