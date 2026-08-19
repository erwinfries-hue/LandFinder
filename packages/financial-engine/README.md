# financial-engine

**Status:** Implementiert (Phase 1, Schritt 2 von 5 — siehe `docs/OPEN_DECISIONS.md`).

Reine, testbare Funktionen für Baupotenzial, Eigennutzung, Projektkosten, Ertrag,
Finanzierung, Residualwert (inkl. Break-even-Werte) und Base/Stress-Szenarien
(Abschnitte 9–14 des Masterdokuments). 41 Unit-Tests, `npm test` von der Repo-Wurzel.

## Transparenz-Prinzip

Kein Zahlenwert steckt versteckt in einer Formel. Jeder Faktor/jede Annahme ist in
`src/parameters.ts` als `ParameterDescriptor` erfasst — mit Bezeichnung, Beschreibung,
Einheit, Default-Wert und Herkunfts-Abschnitt im Masterdokument:

- `BAUPOTENZIAL_PARAMETERS` — Korrekturfaktoren für die Flächenschätzung (Abschnitt 9)
- `STRESS_CASE_PARAMETERS` — Default-Startwerte für den Stress-Case (Abschnitt 14)

Alle übrigen Annahmen (Marktannahmen, Baukosten, Finanzierung, Renditeziele) sind
bereits als benannte, typisierte Felder im `SearchProfile` aus `packages/domain`
vorhanden und werden von den Formeln immer als expliziter Parameter entgegengenommen,
nie intern vorbelegt.

Diese Registry ist als Datengrundlage für ein eigenes "Annahmen"-Register in der UI
gedacht (eigener Reiter, in dem jeder Wert einsehbar und überschreibbar ist) —
UI-Teil folgt mit dem Suchprofil-Wizard (Schritt 5).

## Module

| Datei | Abschnitt | Inhalt |
|---|---|---|
| `parameters.ts` | 9, 14 | Parameter-Registry mit Metadaten |
| `baupotenzial.ts` | 9 | Ausnützungs-/Baumassen-/Überbauungsziffer-Methoden, Korrekturfaktoren |
| `eigennutzung.ts` | 10 | Trennung Miet-/Eigennutzungsfläche, kalkulatorischer Wohnnutzen |
| `projektkosten.ts` | 11 | Baukosten (GFA/NRA-Basis), Gesamtprojektkosten |
| `ertragFinanzierung.ts` | 12 | NOI, Fremdkapital, DSCR, Cash-on-Cash |
| `residualwert.ts` | 13 | Verkehrswert, Residualwert, Break-even-Miete/-Baukosten |
| `szenarien.ts` | 14 | Orchestrierung Base-Case, Ableitung Stress-Case |

Diese sieben Module gehören zu LandFinder (Bauland/Development, `apps/web`).

### Bestandsrendite — Buy-to-let auf Eigentumswohnungen (`apps/home4effinder`)

Ein zweiter, unabhängiger Rechenkern für bestehende Eigentumswohnungen als
Rendite-/Buy-to-let-Investment — nutzt keine der obigen Bauland-Module, teilt sich nur
`numeric.ts` (Bisektion für Break-even-Werte/IRR).

| Datei | Inhalt |
|---|---|
| `numeric.ts` | `bisectRoot`, `netPresentValue`, `internalRateOfReturn` — Bisektion statt Newton-Raphson (keine Ableitungen nötig) |
| `bestandsrendite.ts` | Ebene A (Schnellcheck: Brutto-/Nettorendite) und Ebene B (Investment Case: 5-stufige Cashflow-Kaskade, Break-even-Werte) |
| `bestandsrenditeValueAdd.ts` | Möblierung/Renovation als eigene Module mit eigenem ROI (Furniture-/Renovation-ROI, Payback-Periode) |
| `bestandsrenditeMehrjahresmodell.ts` | Ebene C (15-Jahres-Modell: Jahr-für-Jahr-Simulation, Levered/Unlevered IRR, Equity Multiple, Exit inkl. optionaler Grundstückgewinnsteuer-Näherung), mechanische Investment-Treiber-Attribution |

Bewusst **kein** DCF/WACC/NPV/Monte-Carlo — die Tiefe endet bei
Brutto→Netto→Cashflow→Cash-on-Cash→15-Jahres-IRR, siehe
`apps/home4effinder/docs/DECISIONS.md`.

Offen (Bauland-Seite): Anbindung an `packages/scoring-engine` und die reale Verwendung
im Suchprofil-Wizard/der Objekt-Detailseite.
