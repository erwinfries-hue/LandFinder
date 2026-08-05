# Wüest-Partner-Referenzdaten

Manuell (assistiert) transkribierte Wüest-Partner-Standortinformationen. Schema:
`docs/WUEST_CSV_SCHEMA.md`. Es findet **keine automatische PDF-Extraktion im Produkt**
statt (Abschnitt 1.6/7 — bewusst nicht im MVP) — diese CSVs sind Handarbeit, einmalig
erstellt beim Import der jeweiligen PDF-Reports, nicht Ergebnis einer laufenden Pipeline.

| Gemeinde | Kanton | Abfragedatum | PDF | CSV |
|---|---|---|---|---|
| Baden | AG | 31.07.2026 | `baden-ag-standortinformation-2026-07-31.pdf` | `baden-ag-2026-07-31.csv` |
| Wohlen | AG | 05.08.2026 | `wohlen-ag-standortinformation-2026-08-05.pdf` | `wohlen-ag-2026-08-05.csv` |

Jede CSV enthält 170 Datenpunkte über acht Kategorien (Preise, Transaktionspreisindex,
Nachfrage, Mobilität, Steuern, Immobilienbestand, Leerstand, Baulandpreise) je
Vergleichsregion (Gemeinde / MS-Region / Kanton / Schweiz).

## Weitere Reports hinzufügen

1. PDF hier ablegen, Dateiname `<gemeinde>-<kanton>-standortinformation-<datum>.pdf`.
2. Die Tabellen aus "Zusammenfassung" (Kennziffern Wohnen) und "Baulandpreise Wohnen"
   gemäss `docs/WUEST_CSV_SCHEMA.md` in eine neue CSV übertragen.
3. Diese Tabelle hier ergänzen.

## Lizenz

Siehe Disclaimer im jeweiligen PDF sowie `docs/WUEST_CSV_SCHEMA.md` Abschnitt
"Lizenzhinweis". Diese Daten sind für die interne Vorprüfung bestimmt — vor
Weitergabe (z.B. in Alert-E-Mails) den Lizenzvertrag mit Wüest Partner AG prüfen.
