# SIPIS LandFinder

Privates, internes Akquisitions- und Investmenttool für Schweizer Bauland und
Grundstücke mit Abbruchobjekt. Siehe `docs/OPEN_DECISIONS.md` für den aktuellen
Stand der offenen, kostenrelevanten oder rechtlich heiklen Entscheidungen.

## Struktur

```
apps/web/          Next.js-App (App Router, TypeScript strict, Tailwind)
packages/ui/        Design-System-Komponenten ("Vermessung/Kataster")
packages/*          Domänen-, Finanz-, Scoring- und weitere Engines (Phase 1+)
workers/*           Hintergrundjobs (Scheduler, IMAP-Poller, Analyse, Digest)
supabase/migrations/ Datenbankschema (Phase 1, benötigt Supabase-Projekt)
config/              Editierbare Konfiguration (z.B. Kantonsliste)
docs/                Spezifikationen und offene Entscheidungen
```

Jedes noch nicht implementierte Package/Worker-Verzeichnis enthält ein
`README.md` mit Status und geplanter Phase.

## Entwicklung

```bash
npm install
npm run dev     # startet apps/web auf http://localhost:3000
npm run build
npm run lint
```

Die App läuft aktuell im **Demo-Modus** mit statischen Beispieldaten
(`apps/web/src/lib/demo-data.ts`) — ohne Supabase, ohne echte Portal-Adapter,
ohne LLM-Anbindung. Diese Anbindungen folgen in Phase 1–2, siehe
`docs/OPEN_DECISIONS.md`.

Verfügbare Seiten: `/login`, `/` (Dashboard), `/objekte/[slug]` (Objekt-Detail).
