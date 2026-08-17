# financial-engine

**Status:** Implementiert (Phase 1, Schritt 2 von 5 — siehe `docs/OPEN_DECISIONS.md`).

Reine, testbare Funktionen für Baupotenzial, Eigennutzung, Projektkosten, Ertrag,
Finanzierung, Residualwert (inkl. Break-even-Werte) und Base/Stress-Szenarien
(Abschnitte 9–14 des Masterdokuments), sowie das komplett unabhängige
Bestandsrendite-Rechenmodell (siehe unten). 91 Unit-Tests, `npm test` von der
Repo-Wurzel.

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
| `numeric.ts` | — | Generischer Bisektions-Root-Finder + IRR/NPV, Basis für Break-even-Werte und die Mehrjahresrechnung |
| `bestandsrendite.ts` | — | Bestandsrendite Ebene A (Schnellcheck) + Ebene B (Investment Case: All-in-Investition, 5-stufiger Cashflow-Wasserfall, Cash-on-Cash, Break-even-Werte), siehe unten |
| `bestandsrenditeValueAdd.ts` | — | Furniture-/Renovation-ROI, Möblierungs-Lebenszyklus, Renovationspositionen |
| `bestandsrenditeMehrjahresmodell.ts` | — | Bestandsrendite Ebene C: 15-Jahres-Modell, Exit, Levered/Unlevered IRR, Equity Multiple, Investment-Treiber-Attribution |

Offen: Anbindung an `packages/scoring-engine` (Schritt 3) und die reale Verwendung im
Suchprofil-Wizard/der Objekt-Detailseite.

## Bestandsrendite (docs/OPEN_DECISIONS.md, Punkt N)

Komplett unabhängige zweite Rechnung — kein Baupotenzial, kein Residualwert, keine
Ausnützungsziffer, stattdessen der Kauf einer bestehenden Eigentumswohnung zur reinen
Vermietung. Struktur laut ausführlicher Rückmeldung des Auftraggebers (2026-08-16),
bewusst dreistufig und NICHT auf institutionellem Niveau (kein DCF/WACC/NPV/
Monte-Carlo):

- **Ebene A — Schnellcheck** (`calculateSchnellcheck`): Kaufpreis, Preis/m²,
  Bruttorendite, Eigenkapitalbedarf, Belehnung, grober Cashflow — zum Aussortieren in
  Sekunden.
- **Ebene B — Investment Case** (`bestandsrendite.ts`): All-in-Investition statt nur
  Kaufpreis (`calculateAllInInvestition`), Bruttorendite auf Kaufpreis **und** auf
  All-in getrennt ausgewiesen, ein 5-stufiger Cashflow-Wasserfall (NOI → nach Zins →
  nach Amortisation → nach kalkulatorischer Steuer → nachhaltiger Cashflow nach
  eigener Reparatur-/Leerstandsreserve — `calculateCashflowWasserfall`), Cash-on-Cash,
  Break-even-Miete/-Zins/-Auslastung (`breakEvenMieteChfPerMonth` u.a., numerisch per
  Bisektion aus `numeric.ts`).
- **Value-Add** (`bestandsrenditeValueAdd.ts`, bewusst eigenes Modul): Furniture ROI
  und Renovation ROI (Mehrertrag ÷ Investition, Payback-Zeit), Möblierungs-Lebenszyklus
  (konkreter Cash-Abfluss im Ersatzjahr statt geglätteter Jahresbetrag), Renovations-
  positionen mit drei Kategorien (werterhaltend/wertvermehrend/energetisch) — die KI
  kann eine steuerliche Einstufung vorschlagen, entscheiden muss der Nutzer.
- **Ebene C — 15-Jahres-Modell** (`bestandsrenditeMehrjahresmodell.ts`): Default 15,
  wählbar 5–30 Jahre. Pro Jahr Miet-/Kosteneskalation, Restschuld-Entwicklung,
  derselbe Cashflow-Wasserfall wie Ebene B (keine Formel-Duplikation), Möblierungs-
  Ersatz-Cashouts im jeweiligen Jahr. Exit mit Verkaufspreis-Annahme, Restschuld,
  Verkaufskosten, optionaler (grob genäherter) Grundstückgewinnsteuer. Levered- und
  Unlevered-IRR sowie Equity Multiple. Dazu `computeInvestmentTreiber()` — eine rein
  mechanische Zerlegung ("Wo entsteht die Rendite?": Mietertrag/Finanzierungshebel/
  Mietsteigerung/Möblierung/Wertsteigerung als IRR-Beitrag in Prozentpunkten,
  keine wissenschaftliche Attribution). "Risiko STWEG"/"CapEx-Risiko" aus dem
  Beispiel des Auftraggebers kommen aus der Dokumenten-Due-Diligence, nicht aus
  diesem rein finanziellen Modell — Zusammenführung erst in der UI.

**Bewusst kein Score/keine Empfehlung** (anders als `packages/scoring-engine` für
Development) — welche Rendite/DSCR/STWEG-Kennzahlen als "gut genug" gelten, ist eine
Investitionskriterien-Frage, noch nicht mit dem Auftraggeber abgestimmt.
`BESTANDSRENDITE_PARAMETERS` in `parameters.ts` markiert jeden Kostensatz/jede Rate
ehrlich als "Platzhalter — noch nicht mit Auftraggeber abgestimmt" statt eine
Masterdokument-Abschnittsnummer zu erfinden (den gibt es für diese Objektart noch
nicht). Ebenfalls noch offen: Suchprofil-UI, Persistenz, kalkulatorische Steuer ist
eine grobe Schätzung ohne Steuerberatungsanspruch.
