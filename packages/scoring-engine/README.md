# scoring-engine

**Status:** Implementiert (Phase 1, Schritt 3 von 5 — siehe `docs/OPEN_DECISIONS.md`).

Attraktivitäts-Score, Datenvertrauens-Score, Hard-Gate-Logik und Empfehlungsableitung
(Abschnitte 15–18 des Masterdokuments). 50 Unit-Tests, `npm test` von der Repo-Wurzel.

## Transparenz-Prinzip

Wie in `packages/financial-engine`: jede Gewichtung und jede Schwelle ist in
`src/parameters.ts` als benanntes `ParameterDescriptor` erfasst — mit Bezeichnung,
Beschreibung, Einheit, Default-Wert und Quelle:

- `SCORE_WEIGHTS` — die Punktegewichte pro Teilkriterium (im Masterdokument exakt
  vorgegeben, Abschnitt 15)
- `SCORE_BANDS` — Umrechnung Rohwert → Punkte (z.B. ab welchem Yield-on-Cost die volle
  Punktzahl erreicht ist). Das Masterdokument gibt hierfür **keine** Formel vor; jede
  Bandgrenze ist deshalb explizit als Modellannahme benannt, nicht stillschweigend
  gewählt.
- `RISK_DEDUCTIONS` — Punktabzüge pro Risikofaktor (Abschnitt 15 nennt die Faktoren
  ohne Punktwerte — auch hier: benannt statt erfunden-versteckt)
- `CONFIDENCE_WEIGHTS` — Datenvertrauens-Gewichte (Abschnitt 16, exakt vorgegeben)
- `EMPFEHLUNG_PARAMETERS` — zusätzliche Schwellen für die Empfehlungsableitung, die im
  Masterdokument nicht beziffert sind (z.B. die Bandbreite für "Beobachten/Verhandeln")

Jede Score-Funktion nimmt Gewichte/Bänder als **optionalen** Parameter entgegen
(Default = aktuelle Registry-Werte) — beliebig überschreibbar, ohne den Rest der
Berechnung anzufassen. Das ist die Grundlage für ein eigenes "Annahmen"-Register in
der UI, gemeinsam mit `financial-engine`s Parameter-Registry.

## Module

| Datei | Abschnitt | Inhalt |
|---|---|---|
| `parameters.ts` | 15, 16, 18 | Parameter-Registry mit Metadaten |
| `scoreHelpers.ts` | — | Generische Bewertungsfunktionen (linear, Bereich, diskrete Stufen) |
| `wirtschaftlichkeit.ts` | 15 | Yield on Cost, Residualwertdifferenz, Entwicklungsmarge, DSCR, Budgetfit — max. 40 |
| `baupotenzial.ts` | 15 | Zone, Projektgrösse, Form/Topografie, Erschliessung/Zufahrt, Verifikation — max. 25 |
| `markt.ts` | 15 | Leerstand, Bevölkerung/Haushalte, Mietniveau, Bautätigkeit — max. 15 |
| `lage.ts` | 15 | ÖV, Erreichbarkeit, Zielmieter-Fit — max. 10 |
| `risiko.ts` | 15 | Risikoabzüge — max. 10, startet bei 10 und wird pro Faktor reduziert |
| `score.ts` | 15 | Kombiniert alle Kategorien zu `ScoreBreakdown` (Gesamt 100) |
| `datenvertrauen.ts` | 16 | `ConfidenceBreakdown` aus den `confidence`-Werten der zugeordneten `DataPoint`s |
| `hardGates.ts` | 17 | Alle 13 Hard-Gate-Regeln, erste zutreffende gewinnt, mit manueller Übersteuerung |
| `empfehlung.ts` | 18 | Leitet eine der sechs Empfehlungen aus Hard Gate + Score + Vertrauen + Alert-Schwellen ab |

## Bekannte Vereinfachungen (bewusst benannt, nicht versteckt)

- **Zielmieter-Fit** (Lage, max. 3 Punkte) kommt als externer/manueller Fit-Anteil
  (0–1) herein — das Masterdokument gibt hierfür keine Formel vor.
- **Mietniveau** und **Bautätigkeit** (Markt) erwarten vorberechnete Verhältniswerte
  (lokale vs. kantonale Miete; Neubauten/Bestand) — Quelle: `data/wuest/`.

Offen: Anbindung an `packages/comparison-engine` (Schritt 4) und reale Verwendung in
Suchprofil-Wizard/Objekt-Detailseite (Schritt 5).
