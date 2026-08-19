-- Rein manuelles Freitextfeld für Marktvergleichsnotizen (z.B. Mietpreisvergleiche,
-- Preis/m²-Referenzen aus Immobilienportalen, die der Nutzer selbst recherchiert und
-- einträgt). Bewusst OHNE automatischen Abruf/Scraping — dieselbe Entscheidung wie beim
-- Inserat-Link (siehe docs/DECISIONS.md, Homegate-Blockade-Erfahrung aus LandFinder).

alter table properties add column if not exists market_reference_notes text;
