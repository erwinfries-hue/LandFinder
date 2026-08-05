# Wüest-CSV-Schema

Zielschema für den manuellen/CSV-Import von Wüest-Partner-Kennzahlen (Abschnitt 7,
1.6: "Wüest nur Excel, CSV und manuell — keine PDF-Automatik"). `packages/data-sources`
wird in Phase 3 einen Importer bauen, der genau dieses Format liest, mit
Mapping-Vorschau und Nutzerbestätigung. Bis dahin werden Reports manuell (assistiert)
in dieses Format übertragen — siehe `data/wuest/`.

## Format

Tidy/Long-Format: eine Zeile pro (Kennzahl × Vergleichsregion × Periode).

| Spalte | Beschreibung |
|---|---|
| `metric_key` | Stabiler, maschinenlesbarer Schlüssel (siehe Vokabular unten) |
| `metric_label` | Menschenlesbare Bezeichnung, wie im Wüest-Report |
| `category` | `PREISE`, `TRANSAKTIONSPREISINDEX`, `NACHFRAGE`, `MOBILITAET`, `STEUERN`, `IMMOBILIENBESTAND`, `LEERSTAND`, `BAULANDPREISE` |
| `period` | Zeitraum wie im Report (z.B. `2026/2`, `2024`, `2025/2`) |
| `region_scope` | `GEMEINDE`, `MS_REGION`, `KANTON`, `SCHWEIZ` |
| `region_name` | Name der Region gemäss Report |
| `value` | Zahlenwert |
| `unit` | `CHF_M2_JAHR`, `CHF_M2`, `CHF`, `PCT`, `INDEX_2000_100`, `COUNT` |
| `source_type` | Entspricht `DataPointSource` aus `packages/domain` — hier immer `LICENSED_WUEST` |
| `source_document` | Dateiname des Original-PDF in `data/wuest/` |
| `retrieval_date` | Abfragedatum gemäss Report-Fusszeile |

Mapping auf `DataPoint<T>` (`packages/domain/src/provenance.ts`): `value`→`value`,
`unit`→`unit`, `region_scope`→`geographicLevel` (GEMEINDE→PARCEL/MUNICIPALITY je nach
Kontext, KANTON→CANTON, SCHWEIZ→NATIONAL), `source_type`→`source`,
`source_document`→`sourceReference`, `period`→`observationDate`,
`retrieval_date`→`fetchedAt`.

## Metric-Vokabular (aktuell verwendet)

**PREISE** — `rent_median_chf_m2_year`, `rent_p90_chf_m2_year`,
`condo_price_median_chf_m2`, `condo_price_p90_chf_m2`, `house_price_median_chf_m2`,
`house_price_p90_chf_m2`, `rent_price_change_3y_pct`, `condo_price_change_3y_pct`,
`house_price_change_3y_pct`

**TRANSAKTIONSPREISINDEX** — `condo_transaction_index`, `condo_transaction_index_qoq_pct`,
`condo_transaction_index_yoy_pct`, `condo_transaction_index_3y_pct`,
`house_transaction_index`, `house_transaction_index_qoq_pct`,
`house_transaction_index_yoy_pct`, `house_transaction_index_3y_pct`

**NACHFRAGE** — `population`, `population_growth_3y_pct`, `households`,
`share_1p_households_pct`, `share_2p_households_pct`, `share_3plus_households_pct`

**MOBILITAET** — `pt_reachable_residents_30min`, `pt_reachable_jobs_30min`,
`car_reachable_residents_30min`, `car_reachable_jobs_30min`

**STEUERN** — `tax_burden_single_60k_pct`, `tax_burden_couple_120k_pct`,
`taxpayers_above_75k_income`

**IMMOBILIENBESTAND** — `rental_unit_stock`, `condo_unit_stock`, `house_stock`,
`new_units_per_year_avg3y`, `new_houses_per_year_avg3y`

**LEERSTAND** — `vacancy_mfh_pct`, `vacancy_efh_pct`, `listing_ratio_rent_pct`,
`listing_ratio_condo_pct`, `listing_ratio_house_pct`

**BAULANDPREISE** (nach Residualmethode modelliert) —
`land_price_mfh_high_density_p10_chf_m2`, `..._p50_chf_m2`, `..._p90_chf_m2`,
`land_price_efh_low_density_p10_chf_m2`, `..._p50_chf_m2`, `..._p90_chf_m2`

Neue Kennzahlen aus künftigen Reports: nach demselben Muster ergänzen
(`kategorie_beschreibung_einheit`), nicht umbenennen, damit Zeitreihen über mehrere
Abfragen hinweg vergleichbar bleiben.

## Lizenzhinweis

Wüest-Partner-Daten unterliegen dem Lizenzvertrag des Auftraggebers mit Wüest Partner
AG (Disclaimer im Report: "Der Nutzer... trägt das Risiko für deren weitere
Verwendung"). Diese Daten sind nur für die interne Vorprüfung bestimmt. Ob sie per
E-Mail-Alert an Mitinvestoren weitergegeben werden dürfen, hängt vom individuellen
Lizenzvertrag ab — deshalb sieht Abschnitt 7 ein separates "E-Mail-Sharing-Flag" pro
Wüest-Datensatz vor, das in Phase 3 beim Import gesetzt wird. Bis dahin: nicht ungeprüft
per Alert-Mail versenden.
