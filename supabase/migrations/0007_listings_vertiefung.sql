-- Manuelle Vertiefungsdaten für echte Inserate (Objekt vertiefen, Phase 1) — das
-- Pendant zur automatischen Stufe-2-Extraktion (`extraction`, Migration 0003): dort
-- landet, was sich automatisch aus Inserat/Mail lesen lässt, hier landet, was der
-- Nutzer manuell nachträgt (Zone, Ausnützungsziffer, ÖV-Güteklasse, Risiken etc.),
-- weil diese Angaben nie aus einer Suchabo-Mail extrahierbar sind. Erst mit diesen
-- Daten lässt sich für ein echtes Inserat ein Score/Empfehlung berechnen (siehe
-- apps/web/src/lib/listingVertiefung.ts, apps/web/src/lib/objektAnalysis.ts).

alter table listings
  add column if not exists vertiefung jsonb,
  add column if not exists vertiefung_updated_at timestamptz;
