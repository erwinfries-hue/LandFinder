# comparison-engine

**Status:** Implementiert (Phase 1, Schritt 4 von 5 — siehe `docs/OPEN_DECISIONS.md`).

Rollender Vergleich aktiver Objekte je Kanton (Abschnitt 20). 12 Unit-Tests,
`npm test` von der Repo-Wurzel.

## Module

| Datei | Inhalt |
|---|---|
| `metrics.ts` | Leitet die acht Vergleichskennzahlen aus `financial-engine`/`scoring-engine`-Ergebnissen ab; `METRIC_DIRECTION` benennt explizit, ob "höher" oder "tiefer" besser ist (im Masterdokument nicht spezifiziert, hier als Modellannahme sichtbar) |
| `ranking.ts` | `rankAndCompare()` — Gesamtrang (alle aktiven Objekte), Kantonsrang/Perzentil (nur gleicher Kanton), Vergleich zum Kantons-Top-Objekt, grösster Vorteil/Nachteil pro Kennzahl |
| `change.ts` | `computeChange()` für Preis- und Scoreveränderung |

## Methodik grösster Vorteil/Nachteil

Für jede der acht Kennzahlen wird das Perzentil des Objekts innerhalb der
Kantons-Vergleichsgruppe berechnet (0–100, höher = besser, unabhängig von der
Richtung der Kennzahl). Die Kennzahl mit dem höchsten Perzentil ist der grösste
Vorteil, die mit dem tiefsten der grösste Nachteil. Auch dies ist eine explizite,
dokumentierte Modellannahme — das Masterdokument gibt keine Berechnungsvorschrift vor.

**Reale Anbindung steht** (2026-08-16): `apps/web/src/app/vergleich/page.tsx` +
`components/vergleich/VergleichTable.tsx` rechnen live über alle vertieften echten
Inserate (wie zuvor schon auf der Objekt-Detailseite, `ListingLiveAnalysis.tsx`,
aber jetzt als Gesamt-Rangliste statt nur Kantons-Peer-Vergleich einer Einzelseite).
Bewusst **keine** `comparisons`-Tabelle (Phase 2) — Ergebnisse werden wie bei
`analyses` (siehe `objektAnalysis.ts`) bei jedem Aufruf neu berechnet, nicht
persistiert; ändert sich das Suchprofil/die Annahmen, ist der Vergleich sofort
aktuell, ohne einen Neuberechnungs-Job anzustossen.
