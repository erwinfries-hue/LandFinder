# domain

**Status:** Grundtypen implementiert (Phase 1, Schritt 1 von 5 — siehe `docs/OPEN_DECISIONS.md`).

Reine TypeScript-Typen, keine Business-Logik. Von LandFinder (`apps/web`) genutzt:

- `provenance.ts` — Datenherkunft (`DataPointSource`), `DataPoint<T>`, Datenvertrauens-Klassifikation
- `geography.ts` — Kantonscode (offen, editierbar via `config/regions.json`), ÖV-Güteklasse, Koordinaten
- `listing.ts` — `Listing`, `ExtractedField`, Ingestion-/Listing-Status (Abschnitt 24 / 26)
- `searchProfile.ts` — `SearchProfile` mit allen zwölf Wizard-Bereichen (Abschnitt 6)
- `analysis.ts` — `Empfehlung`, `HardGateReason`, Score-/Vertrauens-Breakdown, `Analysis` (Abschnitt 15–19, 24)

Von HOME4efFINDER (`apps/home4effinder`) genutzt, unabhängig von den obigen Typen:

- `stweg.ts` — `StwegFacts`: reine Datenfelder (Wertquote, Erneuerungsfonds-Saldo/-Zielwert, geplante Sanierungen, offene Beschlüsse) — keine Bewertungslogik
- `dueDiligence.ts` — Typen für die Dokumenten-KI/Due-Diligence-Prüfung: Dokumenttypen-Katalog, Kategorien, Befunde mit Seiten-/Zitat-Beleg, fehlende Dokumente, Verkäuferfragen, Feldwert-Übernahmevorschläge

Noch offen: `decisions`, `notifications`, `audit_log`, `crawl_runs` als eigene Typen — werden ergänzt, sobald `packages/financial-engine` und `packages/scoring-engine` sie benötigen.
