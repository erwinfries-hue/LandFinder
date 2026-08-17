# HOME4efFINDER — Architektur- und MVP-Entscheidungen

## Wie diese App entstanden ist

HOME4efFINDER wurde zunächst versehentlich **innerhalb** von LandFinder gebaut — als
zweite Objektart (`BESTANDSWOHNUNG`) auf derselben `listings`-Tabelle, demselben Login,
derselben Codebasis. Rückmeldung des Auftraggebers (2026-08-17): das war ein
Missverständnis — die Absicht war, LandFinders bereits gebaute *Expertise*
(Rechenkern-Muster, Dokumenten-KI-Architektur, Design-Sprache) als Ausgangspunkt zu
nutzen, nicht die beiden Produkte zu einer Applikation zu verschmelzen. HOME4efFINDER
ist ein eigenständiges Produkt mit eigener Zielgruppe (Bestandsrendite/Buy-to-let statt
Bauland/Development) und sollte auch technisch eigenständig sein.

Der PR, der die Vermischung eingeführt hätte, wurde **nicht gemerged**
(erwinfries-hue/LandFinder#1, geschlossen ohne Merge). LandFinder blieb dadurch
unverändert reiner Bauland-/Development-Deal-Finder.

## Trennungsgrad: Monorepo, aber vollständig getrennte Applikationen

Zwei Optionen standen zur Wahl (dem Auftraggeber vorgelegt, seine Entscheidung):

1. **Ganz eigenes Repo** — maximale Trennung, auch git-historisch, aber der bereits
   gebaute Code hätte kopiert statt wiederverwendet werden müssen.
2. **Gleiches Monorepo, komplett getrennte Applikationen** (gewählt) — eigenes
   Vercel-Projekt, eigene Datenbank, eigene Domain, eigener Login pro App;
   wiederverwendbarer Code (Rechenkern, Domain-Typen, Design-System) liegt einmal als
   gemeinsames Package, statt dupliziert zu werden.

Für den Nutzer/Betrieb macht das keinen Unterschied — eigene URL, eigene Daten, eigener
Login, nichts geteilt, was sichtbar wäre. Der Unterschied ist rein intern: weniger
Code-Duplikation, ein Fix in `packages/financial-engine` kommt (nach erneutem Deploy)
beiden Apps zugute, falls je gewünscht.

## Was geteilt wird — und warum das sicher ist

Geteilt werden ausschliesslich Module, die **keine** LandFinder-spezifische Kopplung
haben (keine Abhängigkeit von `Listing`/`listings`-Tabelle/Portal-Ingestion):

- `packages/financial-engine`: `numeric.ts`, `bestandsrendite.ts`,
  `bestandsrenditeValueAdd.ts`, `bestandsrenditeMehrjahresmodell.ts` — reine Funktionen,
  nehmen Kaufpreis/Wohnfläche als einfache Zahlen entgegen, kein Bezug zu LandFinders
  Datenmodell.
- `packages/domain`: `stweg.ts`, `dueDiligence.ts` — reine Typen ohne Import von
  `listing.ts`.
- `packages/ui` + `globals.css`-Design-Sprache — dieselbe visuelle Identität
  ("Vermessung/Kataster"-Look, Teal-Akzent `#0e6e68`/`#4fc2b4`), die zufällig fast
  exakt der Teal-Farbe im HOME4efFINDER-Logo entspricht.

**Nicht geteilt** (bewusst dupliziert statt abstrahiert, da jeweils App-spezifisch):
Datenbankzugriff (`properties.ts` statt `listings.ts`), Auth (eigener
`SESSION_SIGNING_SECRET`, eigene erlaubte E-Mail-Adresse), alle API-Routen, alle
Seiten/Formulare — jede App hat ihre eigene, einfache Version, keine erzwungene
Abstraktion über zwei sehr unterschiedliche Datenmodelle hinweg.

## Eigene Infrastruktur (Kostenentscheidung, mit dem Auftraggeber abgestimmt)

- **Supabase:** neues, separates Free-Tier-Projekt (CHF 0) — derselbe Grund wie bei
  LandFinders eigenem Supabase-Account: die bestehenden Accounts hatten ihr
  Free-Projekt-Limit bereits erreicht, ein weiterer kostenloser Account war die
  gewählte Variante gegenüber einem kostenpflichtigen Pro-Tier-Upgrade (~$25/Monat).
- **Vercel:** zweites Projekt im selben Account, Hobby-Plan, weiterhin kostenlos.
- **Anthropic/Postmark:** nutzungsbasiert bzw. bereits geteilter Account, keine
  zusätzliche Fixkostenstruktur.

**Noch offen, da ausserhalb der Reichweite dieser Session** (kein Zugriff auf die
Accounts des Auftraggebers): das eigentliche Anlegen des Supabase-Projekts, das
Ausführen der Migration dort, das Anlegen des Vercel-Projekts und das Setzen der
Umgebungsvariablen — siehe README.md, Abschnitt "Erstinbetriebnahme". Der Code ist
vollständig deploy-bereit, sobald diese vier Schritte erledigt sind.

## MVP-Entscheidungen (unilateral getroffen, wie vom Auftraggeber delegiert)

Alle inhaltlichen MVP-Entscheidungen (3-stufiges Renditemodell, Möblierung/Renovation
als eigene Module, 17 Dokumenttypen, Propose-not-overwrite bei Feldwert-Übernahmen,
bewusst kein DCF/WACC/Monte-Carlo) wurden bereits während der ursprünglichen
Umsetzung innerhalb von LandFinder getroffen und sind unverändert gültig — nur der
Ort, an dem der Code lebt, hat sich geändert. Der komplette Entscheidungsverlauf dazu
liegt (historisch, nicht mehr aktiv gepflegt für diese App) in LandFinders
`docs/OPEN_DECISIONS.md`, Punkte N/O.

Bei der Portierung zusätzlich entschieden:

- **Kantonsliste:** LandFinders `config/regions.json` ist auf 7 Zielregionen für
  Bauland eingeschränkt. HOME4efFINDER hat keine a-priori-Regionsbeschränkung — eigene
  Liste aller 26 Kantone (`src/lib/cantons.ts`), nicht die LandFinder-Datei.
  Automatisch alles nachgezogen, ohne dass es explizit erfragt wurde.
- **Datenbankschema:** eigene, schlanke Tabellen `properties` /
  `property_documents` / `property_due_diligence` statt LandFinders polymorpher
  `listings`-Tabelle (die auch Bauland-Felder wie `parcel_area_m2`/`known_zone`
  trägt, die hier nie gebraucht werden).
- **Session-Secret-Name:** `SESSION_SIGNING_SECRET` statt `APP_PASSWORD` — der Name
  `APP_PASSWORD` war bei LandFinder ein historischer Rest aus der Zeit, als es
  tatsächlich ein vom Nutzer eingegebenes Passwort war; für eine neue App ohne diese
  Geschichte ist der ehrliche Name direkt gewählt.

## Bewusst weiterhin nicht gebaut

- Scoring/Hard-Gates auf Basis der Due-Diligence-Ergebnisse.
- Mehrbenutzer-Login (nur die eine bekannte E-Mail-Adresse des Auftraggebers).
- Automatisierte Objekt-Erfassung (kein Portal-Scraping/E-Mail-Ingestion wie bei
  LandFinder) — Objekte werden ausschliesslich manuell erfasst.
- Itemisierte Renovationspositionen im Formular (Datenmodell unterstützt es
  bereits, das Formular fragt aktuell nur einen Gesamtbetrag ab).
