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
| `bestandsrendite.ts` | — | Kostenrechnung für "Bestandsrendite auf Eigentumswohnungen" (Kauf + Nebenkosten + Renovation + Möblierung → Rendite), siehe unten |

Offen: Anbindung an `packages/scoring-engine` (Schritt 3) und die reale Verwendung im
Suchprofil-Wizard/der Objekt-Detailseite.

## Bestandsrendite (docs/OPEN_DECISIONS.md, Punkt M)

`bestandsrendite.ts` ist eine zweite, unabhängige Rechnung — kein Baupotenzial, kein
Residualwert, keine Ausnützungsziffer, stattdessen ein Kaufpreis-plus-Nebenkosten-Stack
für den Kauf einer bestehenden Eigentumswohnung zur reinen Vermietung. Reicht
`calculateErtrag`/`calculateFinanzierung` aus `ertragFinanzierung.ts` unverändert
durch (bereits objektart-neutral). Modell laut Rückmeldung des Auftraggebers
(2026-08-16): unmöbliert ist die einzige Mietbasis (CHF/m²/Monat); Möblierung und
Renovation sind reine Kosten-Zusätze (Initialkosten + ein laufender Jahressatz),
keine eigene Ertragsformel. Weist immer Brutto- **und** Nettorendite gemeinsam aus.

**Bewusst kein Score/keine Empfehlung** (anders als `packages/scoring-engine` für
Development) — welche Rendite/DSCR/STWEG-Kennzahlen als "gut genug" gelten, ist eine
Investitionskriterien-Frage, noch nicht mit dem Auftraggeber abgestimmt.
`BESTANDSRENDITE_PARAMETERS` in `parameters.ts` markiert jeden Kostensatz ehrlich als
"Platzhalter — noch nicht mit Auftraggeber abgestimmt" statt eine
Masterdokument-Abschnittsnummer zu erfinden (den gibt es für diese Objektart noch
nicht). Ebenfalls noch offen: Anbindung an eine echte Objektart im Ingestion-Pfad
(`Objektart` in `packages/domain` bewusst unverändert), Suchprofil-UI, Persistenz.
