# SIPIS LandFinder

Privates, internes Akquisitions- und Investmenttool für Schweizer Bauland und
Grundstücke mit Abbruchobjekt. Siehe `docs/OPEN_DECISIONS.md` für den aktuellen
Stand der offenen, kostenrelevanten oder rechtlich heiklen Entscheidungen.

**Dieses Monorepo enthält zwei unabhängige Applikationen** — LandFinder
(`apps/web`, Bauland/Development) und HOME4efFINDER (`apps/home4effinder`,
Bestandsrendite/Buy-to-let auf Eigentumswohnungen). Beide haben eigenes Hosting,
eigene Datenbank, eigenen Login — geteilt wird nur wiederverwendbarer Code über
gemeinsame `packages/*`. Details zur Trennung: `apps/home4effinder/docs/DECISIONS.md`.

## Struktur

```
apps/web/                Next.js-App LandFinder (App Router, TypeScript strict, Tailwind)
apps/home4effinder/      Next.js-App HOME4efFINDER — eigene Datenbank, eigenes Hosting
packages/ui/              Design-System-Komponenten ("Vermessung/Kataster"), von beiden Apps genutzt
packages/*                Domänen-, Finanz-, Scoring- und weitere Engines (Phase 1+)
workers/*                 Hintergrundjobs (Scheduler, IMAP-Poller, Analyse, Digest) — nur LandFinder
supabase/migrations/      Datenbankschema LandFinder (benötigt LandFinders Supabase-Projekt)
config/                   Editierbare Konfiguration (z.B. Kantonsliste) — nur LandFinder
docs/                     Spezifikationen und offene Entscheidungen — nur LandFinder
```

Jedes noch nicht implementierte Package/Worker-Verzeichnis enthält ein
`README.md` mit Status und geplanter Phase.

## Entwicklung

```bash
npm install
npm run dev     # startet apps/web auf http://localhost:3000
npm run build
npm run lint
npm test        # vitest über alle packages/*
```

Die App läuft aktuell im **Demo-Modus** mit statischen Beispieldaten
(`apps/web/src/lib/demo-data.ts`) — ohne Supabase, ohne echte Portal-Adapter,
ohne LLM-Anbindung. Diese Anbindungen folgen in Phase 1–2, siehe
`docs/OPEN_DECISIONS.md`.

Verfügbare Seiten: `/login`, `/` (Dashboard), `/objekte/[slug]` (Objekt-Detail),
`/suchprofil` (Wizard mit allen zwölf Bereichen aus Abschnitt 6 + einem
"Annahmen & Formeln"-Register, das die Parameter-Registries aus
`financial-engine`/`scoring-engine` editierbar macht — lokal im Browser
gespeichert, noch ohne Datenbank).
