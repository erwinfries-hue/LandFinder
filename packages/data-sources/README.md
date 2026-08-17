# data-sources

**Status:** Noch nicht implementiert — geplant für Phase 3.

Adapter für GeoAdmin/swisstopo, geodienste.ch, ÖREB, BFS PxWeb, ARE sowie Wüest-Excel/CSV-Import.

**Ein erster, kleiner GeoAdmin-Baustein existiert bereits ausserhalb dieses Pakets**
(2026-08-16, docs/OPEN_DECISIONS.md Punkt L): `apps/web/src/lib/geoAdmin.ts` (Adress-Suche
über die öffentliche SearchServer-API) und `apps/web/src/components/map/SwissMap.tsx`
(eingebettete Karte auf swisstopo-WMTS-Kacheln). Bewusst nicht hier in
`packages/data-sources` gebaut — analog zur Ingestion (siehe `packages/ingestion`s
README): pragmatisch direkt in `apps/web` statt in der noch leeren Paket-Struktur. Die
grösseren, noch offenen Bausteine dieses Pakets (ÖREB, BFS PxWeb, ARE, Wüest-Import)
bleiben unverändert offen.

Der Ziel-Schema für den Wüest-Import ist bereits definiert: `docs/WUEST_CSV_SCHEMA.md`,
mit zwei echten Referenzdatensätzen in `data/wuest/` (Baden AG, Wohlen AG). Der
Importer hier muss dieses Format lesen, gegen `DataPoint<T>` aus `packages/domain`
mappen und eine Bestätigungsmaske anzeigen (Abschnitt 7).
