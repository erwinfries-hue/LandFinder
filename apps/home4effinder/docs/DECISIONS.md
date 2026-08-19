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

## Nachgezogen (2026-08-17/18): itemisierte Renovationspositionen

Beim Review aufgefallen: `wertvermehrendeRenovationChf` (erhöht den angenommenen
Immobilienwert im 15-Jahres-Modell beim Exit) wird ausschliesslich aus
`renovation.positionen` berechnet (`summarizeRenovationPositionen`, siehe
`packages/financial-engine/src/bestandsrenditeValueAdd.ts`) — der Gesamtbetrag
`initialRenovationCostChf` fliesst zwar korrekt in die Investitionssumme ein, hatte
aber ohne itemisierte Positionen **nie** einen Werteffekt beim Exit, selbst bei einer
eindeutig wertvermehrenden Renovation. Kein stiller Fehler (das Modell rechnet
dadurch konservativ, nicht falsch), aber ein unnötig unvollständiges Bild. Fix:
`BestandsrenditeVertiefungForm.tsx` erlaubt jetzt das Hinzufügen/Entfernen einzelner
Renovationspositionen (Betrag, Kategorie werterhaltend/wertvermehrend/energetisch,
Jahr, steuerliche Abzugsfähigkeit, optionale Beschreibung) — der Gesamtbetrag bleibt
zusätzlich als schneller Pflichtwert für die Investitionssumme erhalten, auch ohne
itemisierte Aufschlüsselung. Mit drei neuen Tests verifiziert, u.a. dass eine
wertvermehrende Position den Immobilienwert im Mehrjahresmodell tatsächlich erhöht,
eine werterhaltende nicht.

Bei derselben Gelegenheit auch die Renovation-ROI-Anzeige nachgezogen: zwei neue,
optionale Felder ("Miete vor Renovation" / "erzielbare Miete nach Renovation") im
selben Formularabschnitt füttern `calculateRenovationRoi`
(`packages/financial-engine`, existierte bereits, wurde aber nie aufgerufen) — die
Analyseansicht zeigt jetzt einen "Value-Add — Renovation"-Block analog zum
bestehenden Möblierungs-Block, sobald beide Mietwerte gesetzt sind.

## Nachgezogen (2026-08-18): Möblierung nach demselben Muster geprüft

Auf Rückfrage die Möblierung gezielt auf dieselbe Art Lücke untersucht wie zuvor bei
der Renovation (im Financial-Engine vorhandene, aber vom Formular nie erreichte
Berechnung). Zwei Funde:

- `moeblierungGeglaetteReserveChfPerJahr` (`bestandsrenditeValueAdd.ts`) — laut
  eigenem Modulkopf explizit für eine "informative, geglättete Zusatzansicht"
  gedacht, wurde aber nirgends in `apps/home4effinder` aufgerufen. Jetzt in
  `computeBestandsrenditeAnalysis` berechnet und im "Value-Add —
  Möblierung"-Block als zusätzliche, klar als informativ markierte Kennzahl
  angezeigt (die 15-Jahres-Cashflows selbst rechnen weiterhin mit dem
  tatsächlichen Ersatz-Cashout im Ersatzjahr, nicht mit dieser geglätteten Zahl
  — daran ändert sich nichts).
- `moeblierung.kostensteigerungPercentPerYear` war als einziges der drei
  Möblierungs-Lebenszyklus-Felder (neben Nutzungsdauer und Ersatzquote) nicht als
  Formularfeld erfasst — fiel still auf die allgemeine Kosteninflation zurück, ohne
  die sonst übliche `assumptionNotes`-Zeile. Jetzt als eigenes Feld ergänzt
  (konsistent mit seinen beiden Geschwisterfeldern), inkl. Notiz bei Nichterfassung.

Danach den kompletten Rechenkern (`packages/financial-engine`) systematisch auf
weitere Fälle desselben Musters durchsucht (jede exportierte Funktion einzeln
gegenprüft) — kein weiterer Fund. Alle übrigen Funktionen sind bereits korrekt
intern verdrahtet (z.B. `calculateJahresertrag`/`calculateBetriebskosten`/
`calculateCashflowWasserfall` als Bausteine von `calculateInvestmentCase` und
`runMehrjahresmodell`, nicht als eigenständige App-seitige Aufrufe gedacht).

## Nachgezogen (2026-08-18): dasselbe Muster auf der Dokumenten-KI-Seite geprüft

Auf Wunsch dieselbe Prüfung auf `dueDiligenceExtraction.ts`/`dueDiligenceSynthesis.ts`/
`documentTypes.ts` angewendet. Drei Funde:

- **Pro-Dokument-Zusammenfassung nie angezeigt:** Stufe 1 liefert für jedes
  hochgeladene Dokument eine 2-4-Satz-Zusammenfassung (`DocumentExtractionResult
  .summary`), gespeichert in `property_documents.extraction` — die Dokumentenliste
  im Panel zeigte bisher nur Status-Chip/Dateiname/Datum, nie diese Zusammenfassung.
  Ohne "Due-Diligence aktualisieren" (Stufe 2) bekam der Nutzer dadurch nach dem
  Hochladen praktisch kein inhaltliches Feedback. Jetzt wird die Zusammenfassung
  direkt unter jedem Dokument angezeigt, sobald sie vorliegt.
- **`sellerQuestions[].relatedFindingSummary` nie angezeigt:** das LLM liefert pro
  Rückfrage optional einen kurzen Bezug, welcher Befund die Frage ausgelöst hat
  (laut Domain-Typ-Kommentar explizit "für die spätere E-Mail-Vorlage" gedacht) —
  wurde geparst und gespeichert, aber weder in der UI-Liste noch im E-Mail-Entwurf
  verwendet. Jetzt als kursiver "Grund: …"-Hinweis unter jeder Rückfrage in der
  UI sichtbar (bewusst nicht im E-Mail-Text an Verkäufer/Makler — das ist eine
  interne Erklärung für den Nutzer, keine für den externen Empfänger gedachte
  Formulierung).
- `documentTypesByPriority()`/`requiredAndRecommendedDocumentTypes()`
  (`documentTypes.ts`) sind tatsächlich unbenutzt, aber kein Fall desselben Musters
  (keine verlorene Information) — `computeMissingDocuments()` erreicht dieselbe
  Filterung bereits direkt inline. Bewusst nicht entfernt, um den Scope dieser
  Review-Runde nicht auf reines Aufräumen auszudehnen.

**Beim Beheben ein Selbstverschulden gefunden und korrigiert:** die Doku-Korrektur
in `packages/domain/src/dueDiligence.ts` enthielt versehentlich die Zeichenfolge
`apps/*/src/lib` in einem JSDoc-Kommentar — das darin enthaltene `*/` beendete den
Kommentar vorzeitig und brach den TypeScript-Build für beide Apps. Vor dem Commit
über `npm run build` in beiden Apps aufgefallen und behoben (`apps/<name>/src/lib`
statt `apps/*/src/lib`).

Beide Funde mit Tests abgesichert (`bestandsrendite.test.ts`).

## Nachgezogen (2026-08-18): STWEG-Fakten — Erfassung unvollständig, Anzeige fehlte komplett

Weiter mit demselben Muster, diesmal bei `StwegFacts` (`packages/domain/src/stweg.ts`,
9 Felder). Zwei Funde, beide grösser als die vorherigen:

- **Drei von neun Feldern fehlten komplett im Formular:** `offeneBeschluesseCount`,
  `beschlussrisikenNotes`, `quelle` liessen sich bisher überhaupt nicht erfassen,
  obwohl der Domain-Typ sie vorsieht und der Due-Diligence-Prompt explizit danach
  fragen könnte. Jetzt als eigene Formularfelder ergänzt.
- **Keines der neun Felder wurde je angezeigt:** `stweg` wurde zwar gespeichert und
  drei seiner Felder (`wertquotePromille`, `erneuerungsfondsSaldoChf`,
  `erneuerungsfondsZielwertChf`) sind sogar als Due-Diligence-Feldwert-Übernahmeziel
  zugelassen — aber nirgends liess sich der aktuelle Stand einsehen, ausser durch
  erneutes Öffnen des Bearbeitungsformulars. Insbesondere nach einer automatischen
  Feldwert-Übernahme aus einem Dokument gab es keine sichtbare Bestätigung in der
  Analyseansicht. Jetzt ein eigener "STWEG-Fakten"-Block in
  `BestandsrenditeAnalysisView.tsx`, der alle gesetzten Felder anzeigt (nur wenn
  mindestens eines gesetzt ist) — bewusst ohne jede Bewertung/Ampel, konsistent mit
  dem Domain-Typ-Kommentar ("bewusst OHNE Scoring/Formel").

Mit einem neuen Test abgesichert (STWEG-Fakten werden unverändert durchgereicht).

## Nachgezogen (2026-08-18): grösster Fund bisher — Jahr-für-Jahr-Daten des 15-Jahres-Modells nie angezeigt

Weiter mit demselben Muster: `runMehrjahresmodell` berechnet für jedes einzelne Jahr
(5–30 Jahre) einen vollständigen `MehrjahresmodellJahrResult` mit 17 Feldern
(Jahresertrag, NOI, Zins/Amortisation, Restschuld, Cashflow-Kaskade,
Möblierungsersatz, kumulierter Cashflow, Immobilien-/Eigenkapitalwert, Belehnung).
Die Analyseansicht griff bisher aber ausschliesslich auf `years[years.length - 1]`
zu (fürs Exit-Jahr) sowie auf `years.length` (für die Panel-Überschrift) — alle
Zwischenjahre waren vollständig unsichtbar. Der grösste Einzelfund dieser
Review-Serie: nicht ein einzelner Wert, sondern praktisch der gesamte
Jahr-für-Jahr-Verlauf des namensgebenden "15-Jahres-Modells".

Fix: eine ein-/ausklappbare Tabelle ("Jahr-für-Jahr-Details anzeigen", `<details>`,
standardmässig eingeklappt wegen bis zu 30 Zeilen) mit Jahresertrag, NOI,
nachhaltigem Cashflow, kumuliertem Cashflow, Immobilienwert, Restschuld und
Belehnung pro Jahr — plus einem Hinweis-Icon in Jahren mit fälligem
Möblierungsersatz-Cashout.

## Nachgezogen (2026-08-18): Renovation-Kategorien-Summe und Exit-Berechnung ergänzt

Zwei weitere Funde beim Weiterarbeiten:

- `renovationSummary` (Kategorien-Summe der neu itemisierbaren
  Renovationspositionen, siehe oben) wurde berechnet, aber nie angezeigt — und das
  "Value-Add — Renovation"-Panel war zusätzlich fälschlich an `renovationRoi`
  gekoppelt (nur sichtbar, wenn zusätzlich Miete vor/nach Renovation gesetzt war).
  Wer nur Positionen itemisiert, aber keine Mietangaben macht, sah dadurch gar
  nichts. Jetzt zeigt das Panel die Kategorien-Summe unabhängig vom ROI an.
- Die Exit-Berechnung im 15-Jahres-Modell (`MehrjahresmodellExitResult`) hatte
  denselben Blindspot wie die Jahr-1-Cashflow-Kaskade vorher: nur Verkaufswert und
  Netto-Erlös waren sichtbar, die Abzüge dazwischen (Restschuld, Verkaufskosten,
  optionale Grundstückgewinnsteuer-Näherung) nicht. Jetzt eine Breakdown-Tabelle
  analog zur Cashflow-Wasserfall-Tabelle aus Ebene B.

Damit sind jetzt alle Felder von `BestandsrenditeAnalysisResult` mindestens einmal
in der Analyseansicht verwendet.

## Nachgezogen (2026-08-18): fehlende Grundfunktionen ausserhalb des Rendite-Rechenkerns

Auf Wunsch die Prüfung über die reine Bestandsrendite-/Dokumenten-KI-Logik hinaus auf
die restliche App ausgeweitet ("alle Module"). Vier Funde, dieses Mal keine
unsichtbaren Werte, sondern fehlende Grundfunktionen:

- **`properties.updated_at` war unmöglich korrekt:** Spalte mit `default now()`,
  aber ohne Trigger — Postgres aktualisiert ein `timestamptz`-Feld nie von selbst
  bei einem `UPDATE`. Die Spalte wäre für immer auf den Erstellungszeitpunkt
  eingefroren geblieben und hätte fälschlich "zuletzt bearbeitet" vorgetäuscht.
  Migration um einen Standard-Trigger (`set_updated_at()`) ergänzt. Auf der
  Objektliste/-Detailseite zusätzlich `bestandsrendite_updated_at` sichtbar gemacht
  (aussagekräftiger als das generische `updated_at`, das noch nirgends angezeigt
  wird, da bisher nichts ausser der Bestandsrendite editierbar war).
- **Kein Logout:** `/api/auth/logout` existierte, aber keine UI rief es je auf —
  einzige Möglichkeit zum Abmelden war, Cookies manuell zu löschen oder 30 Tage zu
  warten. Neuer `LogoutButton` in der Seitennavigation.
- **Objekt konnte nie gelöscht werden:** kein `DELETE`-Endpunkt, kein Button —
  einmal angelegt, für immer da (auch Testdaten/Fehleingaben). Neue Route
  `DELETE /api/properties/[id]` (räumt zusätzlich zu den per `on delete cascade`
  automatisch gelöschten DB-Zeilen auch die zugehörigen Storage-Dateien auf, die
  sonst verwaist wären) + Bestätigungsdialog auf der Objektseite.
- **Objekt-Basisdaten (Adresse/Kanton/Kaufpreis/Wohnfläche) waren nach dem Anlegen
  unveränderlich:** ein Tippfehler in der Adresse liess sich nur durch Löschen und
  Neuanlegen korrigieren — was alle bereits erfassten Bestandsrendite-Fakten,
  Dokumente und die Due-Diligence-Synthese mit sich gerissen hätte. Neue Route
  `PATCH /api/properties/[id]` + ein-/ausklappbares Bearbeiten-Formular.

## Nachgezogen (2026-08-19): Objekt-Erfassung aus Dokumenten vorausfüllen + Inserat-Link

Erster Fund aus dem echten Live-Betrieb (nach erfolgreicher Erstinbetriebnahme durch den
Auftraggeber): beim Anlegen eines neuen Objekts mussten Adresse/Kanton/Kaufpreis/Wohnfläche
komplett manuell abgetippt werden, obwohl diese Angaben meist schon in einem Exposé/Inserat
stehen, das ohnehin für die Due-Diligence hochgeladen wird.

- **Neuer Dokumenttyp `EXPOSE_INSERAT`** im Katalog (Priorität EMPFOHLEN) — Extraktionsanleitung
  gezielt auf Adresse/Kaufpreis/Wohnfläche (plus als Fund: Zimmerzahl, Baujahr, Widerspruch zu
  Grundriss-Fläche).
- **Neues, generisches `basisdaten`-Feld** im Stufe-1-Extraktionsergebnis (nicht nur für
  `EXPOSE_INSERAT` — jedes Dokumenttyp-Prompt fragt danach, z.B. kann auch ein Grundbuchauszug
  die Adresse bestätigen) — defensiv geparst, jedes Einzelfeld nur übernommen bei korrektem Typ
  (Kantonscode gegen die bekannte 26er-Liste geprüft, Beträge/Flächen müssen positiv sein).
- **Zustandslose Vorab-Analyse** (`POST /api/properties/prefill`): läuft, BEVOR das Objekt
  existiert (kein `property_id` verfügbar) — analysiert das Dokument, schreibt aber nichts in
  DB/Storage. Das Ergebnis füllt nur die Formularfelder vor (bleiben editierbar, nichts wird
  automatisch als Fakt übernommen — konsistent mit dem bestehenden
  Feldwert-Übernahmevorschlag-Muster für bereits erfasste Objekte).
- **Keine doppelte Analyse:** Beim tatsächlichen "Objekt anlegen" wird das schon berechnete
  Extraktionsergebnis über `POST /api/properties/[id]/documents/attach` ans neu erstellte
  Objekt angehängt, statt Claude ein zweites Mal für dasselbe Dokument aufzurufen.
- **Bewusst KEIN automatischer Abruf eines Inserat-Links:** LandFinder hat gezeigt, dass
  grosse Schweizer Portale (v.a. Homegate) automatisierte Abrufe aktiv blockieren, auch von
  Vercel-Servern aus. Der neue `listing_url`-Spalte/-Feld ist rein informativ — wird
  gespeichert und auf der Objektseite verlinkt, aber nie serverseitig abgerufen. Diese
  Einschränkung wurde dem Auftraggeber explizit zur Wahl gestellt, bevor gebaut wurde.
- Migration `0002_listing_url.sql` — additiv (`alter table ... add column if not exists`),
  da `0001_init.sql` bereits gegen die produktive Datenbank gelaufen war.

## Nachgezogen (2026-08-19): Ladespinner + Feldwert-Übernahmevorschläge auf mehr Felder ausgeweitet

Zwei weitere Funde aus dem echten Live-Betrieb:

- **Kein visuelles Feedback bei laufender Analyse:** ein Dokument, das noch von Claude
  analysiert wird, zeigte nur einen statischen Text ("Analysiert…") ohne jede Animation —
  sah aus wie ein hängender/fehlgeschlagener Request, obwohl eine Analyse legitim bis zu
  einer Minute dauern kann. Reiner CSS-Spinner ergänzt, auf allen Buttons/Status-Chips, die
  einen laufenden Claude-Aufruf abbilden.
- **Feldwert-Übernahmevorschläge deckten nur 6 von 11 sinnvollen Feldern ab:** die
  bestehende "Erkannte Werte zur Übernahme"-Funktion (Due-Diligence-Synthese →
  `fieldUpdateProposals`) kannte Zimmerzahl, Baujahr, Parkplatz-Kaufpreis, sonstige
  Einnahmen und Leerstand nicht — obwohl diese Werte oft aus Exposé/Mietvertrag/Grundriss
  hervorgehen. `ALLOWED_UPDATE_FIELDS` (bestandsrendite.ts) und `buildKnownFields`
  (due-diligence/route.ts) um diese fünf Felder erweitert. Dabei `applyFieldUpdate` so
  angepasst, dass es neben `gruppe.feld`-Pfaden (verschachtelt) auch Feldpfade ohne Punkt
  (`zimmerzahl`, `baujahr`, `parkplatzKaufpreisChf` — liegen direkt auf der Wurzel von
  `BestandsrenditeFacts`) korrekt setzt.

## Bewusst weiterhin nicht gebaut

- Scoring/Hard-Gates auf Basis der Due-Diligence-Ergebnisse.
- Mehrbenutzer-Login (nur die eine bekannte E-Mail-Adresse des Auftraggebers).
- Automatisierter Abruf/Scraping von Inserat-Links (siehe oben — bewusste Entscheidung wegen
  Portal-Blockaden). Die Objekt-Grunderfassung selbst ist weiterhin ein manueller Schritt
  (Formular ausfüllen bzw. bestätigen), auch wenn er sich jetzt optional aus Dokumenten
  vorausfüllen lässt — es gibt kein Portal-Scraping/E-Mail-Ingestion wie bei LandFinder.
