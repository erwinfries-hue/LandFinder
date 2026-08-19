# HOME4efFINDER

Privates Due-Diligence- und Renditeinstrument für **bestehende Eigentumswohnungen**
in der Schweiz, ausschliesslich als Rendite-/Buy-to-let-Investment (kein
Eigennutzungs-Anwendungsfall — das wäre "4efHOME", nicht Teil dieser App). Eigene,
von LandFinder (`apps/web`) unabhängige Applikation — eigenes Hosting, eigene
Datenbank, eigener Login. Details zur Trennung und den getroffenen MVP-Entscheidungen:
[`docs/DECISIONS.md`](./docs/DECISIONS.md).

## Was die App kann

1. **Objekt + Bestandsrendite-Fakten in einem Schritt erfassen** (`/neu`) — optional
   zuerst Exposé/Inserat UND/ODER Due-Diligence-Unterlagen (STWEG-Protokoll, Mietvertrag,
   Grundbuchauszug, …) hochladen: Objekt-Basisdaten (Adresse/Kanton/Kaufpreis/Wohnfläche)
   UND möglichst viele Bestandsrendite-Fakten (Miete, STWEG-Werte, …) werden daraus
   automatisch vorausgefüllt, was sich nicht ableiten liess bleibt ein normales, leeres
   Feld im selben Formular. Zusätzlich ein rein informativer, nie automatisch abgerufener
   Inserat-Link.
2. **Automatische Renditeanalyse** in drei Ebenen: Schnellcheck (Brutto-/Nettorendite),
   Investment Case (5-stufige Cashflow-Kaskade, Break-even-Werte), 15-Jahres-Modell
   (Levered/Unlevered IRR, Equity Multiple, Investment-Treiber-Attribution).
3. **Dokumenten-KI / Due-Diligence** — PDF-Upload (STWEG-Protokolle, Jahresrechnung,
   Mietverträge, Grundbuchauszug, …) mit Dokumenttyp-Vorschlag aus dem Dateinamen
   (editierbar, nie automatisch festgelegt) und nach Kategorie gruppierter Anzeige,
   automatische Extraktion je Dokument via Claude, Cross-Dokument-Synthese (Gesamtein-
   schätzung in Fliesstext, Kategorien-Ampel, Widersprüche — inkl. Versuch einer
   rechnerischen Erklärung, bevor eine Zahlenabweichung als ungeklärt gilt —, fehlende
   Dokumente, Rückfragen an Verkäufer/Makler inkl. E-Mail-Export, Feldwert-
   Übernahmevorschläge) — läuft, wenn beim Anlegen schon Dokumente hochgeladen wurden,
   direkt mit und steht auf der Objektseite sofort bereit, statt manuell angestossen
   werden zu müssen.
4. **Investment-Score (0-100)** auf der Objektseite — deterministisch aus Due-Diligence-
   Status, Dokumentenvollständigkeit und Rendite/Cashflow berechnet, nicht von Claude
   geschätzt, mit sichtbarer Aufschlüsselung statt nur einer nackten Zahl. Zusätzlich ein
   optionales, rein manuell erfassbares Marktvergleich-Freitextfeld (nie automatisch
   abgerufen, analog zum Inserat-Link).

## Struktur

```
src/lib/                 Reine Logik: Bestandsrendite-Fakten, Dokumenttypen-Katalog,
                          Dokumenten-KI (Extraktion + Synthese), E-Mail-Export
src/components/           UI-Komponenten (Formulare, Analyseansicht, Due-Diligence-Panel)
src/app/                  Next.js App Router: Login, Objektliste, Objekt-Erfassung, Objekt-Detail
supabase/migrations/       Eigenes, schlankes Datenbankschema (properties/property_documents/
                          property_due_diligence) — NICHT dasselbe Projekt wie LandFinder
```

Wiederverwendet aus LandFinder (als gemeinsame Packages, siehe
`docs/DECISIONS.md`): den Bestandsrendite-Rechenkern (`@landfinder/financial-engine`),
die Due-Diligence-/STWEG-Domain-Typen (`@landfinder/domain`) und das Design-System
(`@landfinder/ui` + `globals.css`, gleicher Teal-Akzent wie im HOME4efFINDER-Logo).

## Entwicklung

```bash
npm install                        # von der Repo-Wurzel aus
npm run dev:home4effinder          # startet diese App auf http://localhost:3000
npm run build:home4effinder
npm run lint:home4effinder
npm test                           # vitest über alle packages/* + beide Apps
```

## Benötigte Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Eigenes** Supabase-Projekt — NICHT dasselbe wie LandFinders `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key desselben eigenen Projekts |
| `ANTHROPIC_API_KEY` | Für die Dokumenten-KI (Extraktion + Synthese) — kann derselbe Key wie bei LandFinder sein, reine Nutzungskosten |
| `SESSION_SIGNING_SECRET` | Beliebiger langer Zufallsstring — signiert das Session-Cookie. Ohne diese Variable bleibt die App komplett gesperrt (fail closed) |

Ohne `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` läuft die App, zeigt aber
überall "Supabase ist nicht konfiguriert" statt echter Daten — kein Absturz.

## Erstinbetriebnahme (siehe `docs/DECISIONS.md` für Details)

1. Neues, separates Supabase-Projekt anlegen (Free-Tier reicht für den Start).
2. Alle Migrationen aus `supabase/migrations/` dort der Reihe nach ausführen (z.B. via
   Supabase SQL-Editor — dieses Projekt hat noch keine Supabase-CLI-Anbindung
   eingerichtet).
3. Neues Vercel-Projekt anlegen, dieses Repo verbinden, **Root Directory**
   `apps/home4effinder` setzen (wichtig — sonst versucht Vercel, `apps/web` zu bauen).
4. Die vier Umgebungsvariablen oben in den Vercel-Projekteinstellungen setzen.
5. Einloggen mit der E-Mail-Adresse, die in
   `src/app/api/auth/login/route.ts::ALLOWED_EMAIL` hinterlegt ist.
