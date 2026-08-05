# domain

**Status:** Grundtypen implementiert (Phase 1, Schritt 1 von 5 — siehe `docs/OPEN_DECISIONS.md`).

Reine TypeScript-Typen, keine Business-Logik:

- `provenance.ts` — Datenherkunft (`DataPointSource`), `DataPoint<T>`, Datenvertrauens-Klassifikation
- `geography.ts` — Kantonscode (offen, editierbar via `config/regions.json`), ÖV-Güteklasse, Koordinaten
- `listing.ts` — `Listing`, `ExtractedField`, Ingestion-/Listing-Status (Abschnitt 24 / 26)
- `searchProfile.ts` — `SearchProfile` mit allen zwölf Wizard-Bereichen (Abschnitt 6)
- `analysis.ts` — `Empfehlung`, `HardGateReason`, Score-/Vertrauens-Breakdown, `Analysis` (Abschnitt 15–19, 24)

Noch offen: `decisions`, `notifications`, `audit_log`, `documents`, `crawl_runs` als eigene Typen — werden ergänzt, sobald `packages/financial-engine` und `packages/scoring-engine` sie benötigen.
