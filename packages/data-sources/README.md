# data-sources

**Status:** Noch nicht implementiert — geplant für Phase 3.

Adapter für GeoAdmin/swisstopo, geodienste.ch, ÖREB, BFS PxWeb, ARE sowie Wüest-Excel/CSV-Import.

Der Ziel-Schema für den Wüest-Import ist bereits definiert: `docs/WUEST_CSV_SCHEMA.md`,
mit zwei echten Referenzdatensätzen in `data/wuest/` (Baden AG, Wohlen AG). Der
Importer hier muss dieses Format lesen, gegen `DataPoint<T>` aus `packages/domain`
mappen und eine Bestätigungsmaske anzeigen (Abschnitt 7).
