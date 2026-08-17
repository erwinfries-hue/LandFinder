# domain

**Status:** Grundtypen implementiert (Phase 1, Schritt 1 von 5 — siehe `docs/OPEN_DECISIONS.md`).

Reine TypeScript-Typen, keine Business-Logik:

- `provenance.ts` — Datenherkunft (`DataPointSource`), `DataPoint<T>`, Datenvertrauens-Klassifikation
- `geography.ts` — Kantonscode (offen, editierbar via `config/regions.json`), ÖV-Güteklasse, Koordinaten
- `listing.ts` — `Listing`, `ExtractedField`, Ingestion-/Listing-Status (Abschnitt 24 / 26)
- `searchProfile.ts` — `SearchProfile` mit allen zwölf Wizard-Bereichen (Abschnitt 6)
- `analysis.ts` — `Empfehlung`, `HardGateReason`, Score-/Vertrauens-Breakdown, `Analysis` (Abschnitt 15–19, 24)
- `stweg.ts` — `StwegFacts` (Stockwerkeigentümergemeinschaft): reine Datenhaltung für "Bestandsrendite auf Eigentumswohnungen" (docs/OPEN_DECISIONS.md, Punkt M), bewusst ohne Scoring — welche STWEG-Kennzahlen als "riskant" gelten, ist eine noch offene Investitionskriterien-Frage. Zielstruktur auch für eine künftige STWEG-Protokoll-Analyse per LLM.

Noch offen: `decisions`, `notifications`, `audit_log`, `documents`, `crawl_runs` als eigene Typen — werden ergänzt, sobald `packages/financial-engine` und `packages/scoring-engine` sie benötigen. `Objektart` (`listing.ts`) ist weiterhin bewusst nur `"BAULAND" | "ABBRUCHOBJEKT"` — die Erweiterung um eine Bestandswohnungs-Objektart berührt die reale Ingestion-Pipeline (Extraktion, Hard Gates, Vorprüfung) und ist bewusst nicht Teil dieses Schritts, siehe Punkt M.
