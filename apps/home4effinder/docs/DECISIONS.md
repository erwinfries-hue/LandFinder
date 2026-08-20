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

## Nachgezogen (2026-08-19): seriöse, teils kantonsspezifische Default-Werte + sichtbar vorausgefüllte Formularfelder

Auftrag: "bei allen Feldern möglichst einen seriösen Default-Wert eintragen (und sollte
als Default sichtbar sein resp. wenn er überschrieben wird)". Dazu vorab zwei
Design-Entscheidungen mit dem Auftraggeber abgestimmt:

1. **Datenquelle für orts-/objektspezifische Werte**: eine jetzt (statt live pro Objekt)
   recherchierte, statische Tabelle — kein Live-Web-Lookup pro Objekt (Kosten/Latenz/
   Komplexität gegenüber Nutzen nicht gerechtfertigt für eine Ein-Personen-App). Muss
   künftig manuell aufgefrischt werden.
2. **Einstellungsort für die allgemeinen (nicht ortsbezogenen) Defaults**: bleibt Code —
   keine neue Einstellungen-Seite/DB-Tabelle/API. Änderungswunsch einfach mitteilen.

Umsetzung:

- Neue Datei `apps/home4effinder/src/lib/cantonDefaults.ts`: recherchierte
  Handänderungssteuer-Sätze für alle 26 Kantone (0% in acht Kantonen bis 3.3% in VD/NE;
  Quellen: ESTV-Steuermäppchen, mehrere Immobilien-Ratgeber, quergecheckt) sowie eine
  grobe dreistufige Einordnung (günstig/mittel/teuer, 18/24/29%) der kantonalen
  Einkommenssteuerbelastung als Grundlage für den "Kalkulatorischer Steuersatz"-Default.
  Bewusst KEINE scheinbar präzise Einzelzahl pro Kanton für den Steuersatz — hängt real zu
  stark von Einkommen/Zivilstand/Gemeinde ab, eine erfundene Präzision wäre irreführender
  als eine grobe, aber gut belegte Kategorisierung ("nichts wird erfunden").
- `computeBestandsrenditeAnalysis` erhält jetzt optional den Kanton des Objekts und nutzt
  bei bekanntem Kanton den kantonsspezifischen statt den schweizweiten Platzhalter-Default
  für Handänderungssteuer und kalkulatorischen Steuersatz — ein explizit erfasster Wert
  hat immer Vorrang.
- Alle 15 `BESTANDSRENDITE_PARAMETERS`-Einträge (packages/financial-engine/parameters.ts)
  von "Platzhalter — noch nicht mit Auftraggeber abgestimmt" auf eine echte, nachvollziehbare
  Begründung umgestellt (z.B. Referenz auf die schweizweite Leerwohnungsziffer, marktübliche
  Makler-/Notariatskosten-Bandbreiten, langjährige Mietpreis-/Teuerungsentwicklung).
- `BestandsrenditeVertiefungForm` zeigt jetzt bei rund einem Dutzend Feldern den
  tatsächlichen Zahlenwert des Defaults direkt im Feld UND im Label ("Standard: X") an,
  statt eines leeren Felds mit dem Text "leer = Default" — inkl. drei bisher im Formular
  gar nicht vorhandener Felder (Handänderungssteuer, Notariat/Grundbuch, Maklerprovision),
  die zwar schon lange von der Engine berechnet, aber nie erfassbar waren.
- Bewusste Vereinfachung: kein live nachverfolgter "wurde dieser Wert vom Nutzer
  überschrieben"-Badge — der vorausgefüllte Wert wird beim Speichern wie jeder andere
  Wert behandelt (fest gespeichert, kein "merkt sich, dass es noch der Default war" mehr).
  Vorteil: einfacher, vorhersehbares Verhalten. Nachteil: eine spätere Anpassung eines
  Default-Werts wirkt sich nicht rückwirkend auf bereits gespeicherte Objekte aus, die den
  alten Default unverändert übernommen hatten.

## Nachgezogen (2026-08-19): zwei echte Bugs aus dem ersten Live-Test der neuen Vorausfüll-Funktion

Anhand von Vercel-Server-Logs diagnostiziert (der Auftraggeber hat sie direkt kopiert):

- **JSON-Extraktion aus der Claude-Antwort war nicht robust:** `extractDocumentFields`
  und `synthesizeDueDiligence` matchten das JSON-Objekt bisher mit dem gierigen Regex
  `/\{[\s\S]*\}/` — der reicht bis zur LETZTEN `}` im gesamten Antworttext, nicht bis zur
  tatsächlich schliessenden Klammer des JSON-Objekts. Enthielt Claudes Antwort danach noch
  irgendeinen Text mit eigenen geschweiften Klammern (z.B. eine schliessende
  Markdown-Code-Fence mit Nachsatz), entstand ungültiges, zusammengeklebtes "JSON" —
  in Produktion beobachtet als `SyntaxError: Unexpected non-whitespace character after
  JSON`. Neue, gemeinsam genutzte Funktion `extractFirstJsonObject` (extractJsonObject.ts)
  zählt stattdessen die Klammertiefe ab der ersten `{` und ignoriert Klammern innerhalb
  von String-Literalen — liefert zuverlässig nur das erste vollständige JSON-Objekt.
- **Storage-Upload schlug bei bestimmten Dateinamen fehl:** der Storage-Key enthielt bisher
  den Original-Dateinamen direkt (`${propertyId}/${uuid}-${file.name}`) — Supabase Storage
  lehnt manche Zeichen darin mit `InvalidKey` ab (in Produktion beobachtet bei
  "PDF Exposé.pdf", wegen Leerzeichen/Akzent). Der Original-Dateiname wird ohnehin separat
  in der Spalte `original_filename` gespeichert, daher braucht der Storage-Key ihn gar
  nicht — jetzt nur noch `${propertyId}/${uuid}.pdf`. Betraf beide Upload-Routen
  (`documents/route.ts` und das neue `documents/attach/route.ts`).

## Nachgezogen (2026-08-19): Objekt-Erfassung, Bestandsrendite-Fakten und Due-Diligence in einem Flow zusammengefasst

Auftrag: "wenn beim Projekt anlegen schon möglichst viele Unterlagen hochgeladen werden
können, um dann alle folgenden Felder entsprechend aufgrund der Informationen automatisch
abgefüllt werden ... Sollten die Unterlagen für die Due Diligence ebenso vorhanden sein,
diese Information ebenso in diesem Schritt verarbeiten und die Due Diligence vorbereitet
zur Verfügung stellen." Vorab abgestimmt: fehlende Felder werden direkt im selben, grossen
Formular abgefragt (keine separate Dialog-Lösung nur für die Lücken).

Bisheriger Ablauf war dreistufig (Objekt anlegen → auf der Objektseite Bestandsrendite-
Fakten erfassen → dort separat Dokumente hochladen und "Due-Diligence aktualisieren"
klicken). Jetzt ein einziger Schritt auf `/neu`:

- **`BestandsrenditeFactsFields`** (neue Komponente) — die komplette Bestandsrendite-
  Fakten-Feldmenge aus `BestandsrenditeVertiefungForm` extrahiert, OHNE eigenes `<form>`
  und Submit-Button (HTML erlaubt keine verschachtelten Formulare), damit sie sowohl auf
  der Objekt-Bearbeiten-Seite als auch im neuen kombinierten Erfassen-Formular verwendet
  werden kann. `BestandsrenditeVertiefungForm` selbst ist jetzt nur noch ein dünner
  Wrapper (State + PATCH-Request), Verhalten für bestehende Objekte unverändert.
- **`buildBestandsrenditeFactsFromFormData`** (neue, gemeinsam genutzte Funktion,
  `bestandsrenditeFormParsing.ts`) — die FormData-Auswertungslogik war zuvor 1:1 im
  Bearbeiten-Formular dupliziert, jetzt eine Quelle für beide Flows.
- **`BESTANDSRENDITE_KNOWN_FIELD_LABELS`** (neue, gemeinsam genutzte Liste,
  `bestandsrenditeKnownFields.ts`) — die Feldpfade/Labels für Feldwert-Übernahmevorschläge
  waren bisher nur serverseitig in der objektgebundenen Due-Diligence-Route dupliziert;
  jetzt dieselbe Liste auch client-seitig im neuen Erfassen-Flow nutzbar, mit Test, der
  Drift zu `ALLOWED_UPDATE_FIELDS` verhindert.
- **Neue, zustandslose Route `POST /api/properties/prefill-synthesis`** — ruft dieselbe
  reine Funktion `synthesizeDueDiligence` (Stufe 2) auf wie die reguläre, objektgebundene
  Route, aber mit Dokumenten, die noch nicht in der DB liegen (jeweils schon einzeln über
  `/api/properties/prefill` analysiert). Läuft im neuen Formular automatisch nach jeder
  Dokumenten-Analyse — die zurückgegebenen `fieldUpdateProposals` füllen die
  Bestandsrendite-Fakten-Felder vor (mit Label-Hinweis "aus Dokument: …", damit die
  Herkunft transparent bleibt).
- **Neue Route `POST /api/properties/[id]/due-diligence/save-prefilled`** — persistiert
  das bereits vor dem Anlegen berechnete Synthese-Ergebnis beim tatsächlichen Speichern,
  ohne Claude ein zweites Mal aufzurufen (läuft durch denselben defensiven Parser wie eine
  frische Antwort, analog zu `documents/attach/route.ts`). Die Due-Diligence-Prüfung steht
  damit auf der Objektseite sofort bereit, wenn beim Anlegen Dokumente hochgeladen wurden.
- **Bewusste Vereinfachung:** die Bestandsrendite-Felder bleiben unkontrollierte Inputs
  (`defaultValue`, wie im gesamten Formular). Trifft eine neue Dokumenten-Analyse ein,
  wird `BestandsrenditeFactsFields` per `key` neu gemountet, damit die aktualisierten
  Vorschlagswerte sichtbar werden — das setzt auch bereits manuell eingetippte Werte in
  diesen Feldern zurück. Empfohlene Reihenfolge daher: zuerst alle Dokumente hochladen,
  danach die restlichen Lücken von Hand ergänzen, nicht umgekehrt. Ein sauberer nächster
  Ausbauschritt wäre ein Live-"überschrieben"-Badge (wie schon beim vorigen Nachtrag
  vermerkt), das dieses Risiko eliminieren würde.

## Nachgezogen (2026-08-19): Dokumenttyp-Erkennung aus Dateiname, kategorisierte Dokumentenanzeige, Gesamteinschätzung

Auslöser: der Auftraggeber hat anhand einer eigenen ChatGPT-Analyse eines realen Objekts
(mit vollständiger Unterlagenmappe: STWEG-Protokolle, Betriebskosten-/Heizkostenabrechnungen,
Budget, Kapital-/Zinsausweis, Grundbuchauszug, Exposé, …) zwei konkrete Anforderungen
formuliert: (1) die App soll mindestens dieselbe Aussagekraft wie eine manuelle
ChatGPT-Auswertung erreichen, (2) nach einem Mass-Upload soll eine übersichtliche
Kategorisierung der Dokumente vorgeschlagen werden, wenn möglich automatisch anhand des
Dateinamens.

- **`documentTypeGuess.ts`** (neu) — `guessDocumentType(filename)` errät den
  Dokumenttyp aus dem Dateinamen per Schlüsselwort-Regeln (z.B. "Protokoll"/"GV" →
  STWEG-Protokoll, "Betriebskosten"+"Wohnung" → Nebenkostenabrechnung der Wohnung,
  "Betriebskosten" allein → Jahresrechnung der STWEG, "Kapital"+"Zins" →
  Erneuerungsfonds-Nachweis, …), Präfixvergleich statt Exaktvergleich wegen deutscher
  Flexionsformen (Sanierung/Sanierungen). Liefert bewusst `undefined` statt zu raten, wenn
  keine Regel passt (z.B. "Katasterplan.pdf", "Kaufangebot.pdf") — der Aufrufer fällt dann
  auf "Sonstiges" zurück, der Nutzer sieht den Vorschlag immer als editierbares Feld, nie
  als automatische Festlegung. Mit Tests anhand realer, vom Auftraggeber hochgeladener
  Dateinamen.
- **Upload-Flows umgebaut** (`PropertyCreateForm`, `DueDiligencePanel`): vorher ein
  einziger Dokumenttyp-Dropdown, der für den gesamten ausgewählten Dateistapel galt — jetzt
  ein Zwischenschritt ("Staging"): Dateien auswählen, jede Zeile bekommt sofort einen aus
  dem Dateinamen vorgeschlagenen, aber editierbaren Dokumenttyp (Chip "erkannt" bei
  Treffer), erst nach Bestätigen/Korrigieren wird tatsächlich hochgeladen bzw. analysiert.
- **Kategorisierte Dokumentenanzeige**: sowohl die bereits hochgeladenen/analysierten
  Dokumente auf der Objektseite als auch im Erfassen-Formular werden jetzt nach
  `DueDiligenceCategory` gruppiert dargestellt (dieselben neun Kategorien wie im
  Due-Diligence-Ergebnis) statt als flache Liste — nutzt dafür `defaultCategory`, das
  jeder Dokumenttyp im Katalog (`documentTypes.ts`) bereits trägt.
  **`dueDiligenceCategories.ts`** (neu) — einzige Quelle für Kategorie-Reihenfolge und
  -Label, vorher an drei Stellen dupliziert (Synthese-Prompt, `DueDiligencePanel`).
- **`overallSummary`** (neuer Pflicht-String auf `DueDiligenceResult`, `@landfinder/domain`)
  — 2-4 Sätze Gesamteinschätzung als Fliesstext, vom Synthese-Prompt explizit angefordert
  ("Kernaussage zuerst, dann wichtigste Einschränkung, dann grösstes Risiko"), direkt an
  der Objektseite und im Erfassen-Formular über den Kategorien angezeigt. Zielt auf genau
  die Lücke zur ChatGPT-Analyse, die zuvor am deutlichsten war: ein Gesamturteil in
  Prosa statt nur Kategorien-Ampeln.
- **Zahlen-Abgleich zwischen Dokumenten als explizite Prompt-Anweisung**: der
  Synthese-Prompt fordert jetzt ausdrücklich, eine zahlenmässige Abweichung zwischen zwei
  Dokumenten zuerst rechnerisch zu erklären (Summe mehrerer Konten, Fondssaldo + bekannte
  Jahreseinlage), bevor sie als ungeklärter Widerspruch gemeldet wird — findet sich eine
  Erklärung, wird der Fund als gelöst (OK) mit der Rechnung im Detail-Feld markiert, nicht
  weiter als Klärungsbedarf offengehalten. Ausgelöst durch ein konkretes Beispiel aus der
  Unterlagenmappe des Auftraggebers (Erneuerungsfonds-Wert im Exposé liess sich als Summe
  zweier STWEG-Bankkonten aus dem Kapital-/Zinsausweis erklären, keine echte Diskrepanz).

## Nachgezogen (2026-08-19): Investment-Score + manuelles Marktvergleich-Feld

Auf explizite Rückfrage zur Objekt-Deep-Dive-Vorschau: beide vorgeschlagenen offenen
Punkte vom Auftraggeber bestätigt ("numerischer Score ja und ein manuelles
Marktvergleich-Feld ja").

- **`computeInvestmentScore` (`investmentScore.ts`, neu)** — ein Score von 0-100, bewusst
  **deterministisch berechnet, nicht von Claude geschätzt** (konsistent mit "nichts wird
  erfunden" — ein LLM soll sich keine Gesamtpunktzahl ausdenken). Drei Komponenten:
  Due-Diligence-Status (0-60, pro Kategorie gleich gewichtet, OK=voll/KLAERUNGSBEDARF=halb/
  RISIKO=null), Dokumentenvollständigkeit (0-15, Anteil vorhandener "ZWINGEND"-Dokument-
  typen), Rendite/Cashflow (0-25, Bruttorendite linear zwischen 2%/6% skaliert plus Bonus
  bei nicht-negativem Cashflow). Liefert bewusst `undefined`, solange keine
  Due-Diligence-Synthese gelaufen ist — sonst würde ein frisch angelegtes Objekt ohne jede
  Prüfung fälschlich einen tiefen Score zeigen, statt "noch nicht geprüft". Auf der
  Objektseite als Chip mit Aufschlüsselung angezeigt (nicht nur die Gesamtzahl — dieselbe
  Transparenz-Haltung wie bei den "Standard: X"/"aus Dokument: X"-Labels).
- **`market_reference_notes`** (Migration 0003, neue Spalte auf `properties`) — reines
  Freitextfeld für selbst recherchierte Marktvergleiche (Vergleichsmieten, Preis/m² aus
  Inseraten in der Umgebung), analog zu `listing_url` bewusst **ohne** automatischen
  Abruf/Scraping. Über `PropertyEditForm`/`PATCH /api/properties/[id]` editierbar, auf der
  Objektseite direkt unter den Basisdaten angezeigt. Bewusst **nicht** im
  Neu-Erfassen-Formular (anders als `listing_url`) — Marktvergleiche entstehen typischerweise
  erst als Rechercheschritt nach dem Anlegen, nicht beim ersten Erfassen; das ohnehin schon
  dichte Formular bleibt dadurch unverändert.

## Nachgezogen (2026-08-19): Objektvergleich (`/vergleich`)

Der Auftraggeber hatte bereits bei der ursprünglichen Deep-Dive-Vorschau angekündigt,
dass Objekte im Tool auch verglichen werden sollen — jetzt als eigene Seite umgesetzt,
direkt im Anschluss an Score und Marktvergleich-Feld ("ja mergen bitte und dann direkt
zu Punkt 2").

- **`/vergleich`** (neue Route, `SideNav`-Eintrag mit dem bereits für LandFinder
  reservierten "scale"-Icon) — eine Zeile pro Objekt (Adresse/Kanton/Wohnfläche,
  Kaufpreis, CHF/m², Bruttorendite, DD-Gesamtstatus-Ampel, Investment-Score), per Klick
  (natives `<details>`, kein Client-JS nötig) aufklappbar zur Gesamteinschätzung in Prosa
  und zum Link auf die vollständige Objektseite — dasselbe Kennzahlenzeile-zuerst-
  Detail-auf-Klick-Muster wie in der ursprünglichen Deep-Dive-Vorschau skizziert, nur
  jetzt über mehrere Objekte statt innerhalb eines einzelnen.
- Sortierung: bester Investment-Score zuerst; Objekte ohne Score (keine
  Due-Diligence-Synthese gelaufen) danach, untereinander nach Erfassungsdatum. Objekte
  ohne Bestandsrendite-Fakten erscheinen trotzdem mit den verfügbaren Basisdaten, Rest
  als „—" statt sie auszublenden.
- Bewusst keine Auswahl/Filterung eingebaut (immer alle Objekte) — für ein privates
  Instrument mit überschaubarer Objektzahl reicht das; würde die Liste grösser, wäre ein
  Filter der naheliegende nächste Ausbauschritt.

## Nachgezogen (2026-08-20): Dokumentenanalyse schlug bei mehrseitigen/fundreichen PDFs fehl

Anhand echter Vercel-Server-Logs diagnostiziert (Auftraggeber hat sie kopiert, wie beim
letzten Mal) — beim Hochladen mehrerer realer Objekt-Unterlagen (Grundbuchauszug,
mehrjährige Heiz-/Betriebskostenaufstellungen, mehrere STWEG-Protokolle) schlug die
Stufe-1-Extraktion regelmässig fehl, mit drei unterschiedlich aussehenden, aber
zusammenhängenden Fehlern: "Keine Text-Antwort von Anthropic erhalten", "Keine
JSON-Struktur in der Anthropic-Antwort gefunden" und ein `JSON.parse`-`SyntaxError`
mitten im Text. Ursache in allen drei Fällen dieselbe: `extractDocumentFields`
(`dueDiligenceExtraction.ts`) rief Claude mit `max_tokens: 4096` auf — bei
mehrseitigen, fundreichen Dokumenten (viele Einzelfunde inkl. wörtlichem Zitat, mehrere
Jahre Kostenaufstellung) reichte das nicht, die Antwort wurde mitten in der JSON-Struktur
abgeschnitten. Je nachdem, WO genau abgeschnitten wurde, sah das wie drei verschiedene
Bugs aus, war aber ein einziger. → `max_tokens` auf 8192 angehoben (entspricht dem
bereits für die Synthese verwendeten Wert) und zusätzlich `stop_reason === "max_tokens"`
explizit geprüft, damit ein künftiger Abbruch im Log sofort als "Dokument zu umfangreich"
erkennbar ist statt wie ein Parsing-/Prompt-Problem auszusehen.

Zwei separate, kleinere Beobachtungen aus denselben Logs, bewusst nicht behoben:
- Ein einzelner `Vercel Runtime Timeout Error` (60s) auf `/api/properties/prefill-synthesis`
  bei einem Objekt mit sehr vielen hochgeladenen Dokumenten. 60s ist die harte Obergrenze
  des Vercel-Hobby-Plans — im Code nicht weiter erhöhbar. Da nur ein einziges Vorkommnis,
  aktuell keine Änderung; würde es häufiger auftreten, wäre eine Straffung des
  Synthese-Prompts (kürzere Zitate/Fakten pro Dokument) oder ein Wechsel auf einen
  bezahlten Vercel-Plan der nächste Schritt.
- Ein einzelnes `PGRST303 "JWT issued at future"` beim Lesen der Objektliste — wurde
  bereits von der bestehenden Fehlerbehandlung abgefangen (leere Liste statt Absturz,
  Response blieb 200). Sieht nach einer transienten Uhrzeit-Toleranzabweichung auf
  Supabase-Seite aus, kein wiederkehrendes Muster in den Logs — nicht weiter verfolgt,
  ausser es tritt erneut auf.

## Nachgezogen (2026-08-20): 1./2. Hypothek getrennt mit je eigener Amortisation

Auf Wunsch des Auftraggebers: "bei der Belehnung bitte eine 1. Hypothek und eine 2.
Hypothek einbauen mit entsprechender Amortisation. Die 2. Amortisation bei der 1. und
2. einen Prozentsatz oder Dauer in Jahren als Variable einbauen" — übliche Schweizer
Finanzierungsstruktur (1. Hypothek oft ohne Pflichtamortisation, 2. Hypothek meist
über eine feste Dauer getilgt), bisher war "Belehnung" nur ein einziger Blockwert ohne
Tranchentrennung.

- **`resolveAmortisationChfPerYear` + `AmortisationSpec`/`AmortisationModus`**
  (`bestandsrendite.ts`, financial-engine) — leitet den fixen jährlichen
  Amortisationsbetrag einer Tranche aus deren ursprünglichem Betrag her, wahlweise über
  `PROZENT_PRO_JAHR` (Prozentsatz vom ursprünglichen Betrag) oder `DAUER_JAHRE`
  (linear bis 0 über eine Zieldauer) — exakt dieselbe zweite-Eingabemethode-Struktur wie
  bei `ReserveInput`/`resolveReserveChf`.
- **Ebene C (`bestandsrenditeMehrjahresmodell.ts`) trackt jetzt zwei Restschulden**
  (`ersteHypothek`/`zweiteHypothek`) statt einer — jede Tranche amortisiert unabhängig
  und wird bei Erreichen von 0 dort gedeckelt, während die andere ggf. weiterläuft. Ein
  gemeinsamer Zinssatz für beide Tranchen (kein abgestimmter Bedarf für getrennte
  Zinssätze). Ebene A (Schnellcheck, kennt ohnehin keine Amortisation) und Ebene B
  (Investment Case, nur Jahr 1) bekommen weiterhin blendete Summen von der
  aufrufenden App-Schicht — kein Grund, deren Signaturen aufzubrechen.
- **UI** (`BestandsrenditeFactsFields.tsx`): "1. Hypothek"/"2. Hypothek" je mit
  Belehnung (%), einem Modus-Dropdown (Prozentsatz pro Jahr / Dauer in Jahren) und dem
  zum gewählten Modus passenden Eingabefeld (lokal per `useState` umgeschaltet, kein
  Formular-Zustand nötig). Zinssatz bleibt ein gemeinsames Feld für beide Tranchen.
  Die Objekt-/Mehrjahres-Analyseansicht zeigt zusätzlich die aufgeschlüsselten
  Tranchenbeträge und deren Amortisation/Jahr, nicht nur die kombinierte Belehnung.

## Nachgezogen (2026-08-20): Exposé-Extraktion für Zimmerzahl/Baujahr/Parkplatz-Kaufpreis unzuverlässig

Vom Auftraggeber gemeldet (mit Screenshot): nach Upload eines Exposés blieben die
Felder Zimmerzahl, Baujahr und Parkplatz-Kaufpreis im Bestandsrendite-Formular leer,
obwohl das Exposé diese Angaben enthielt — trotz "Prüfe die Qualität"-Auftrag.

Ursache gefunden: `EXPOSE_INSERAT.extractionGuidance` (`documentTypes.ts`) verlangte
diese drei Werte bisher nur als unstrukturierten Fund-Fliesstext ("Erfasse zusätzlich
als Fund, falls ersichtlich: Zimmerzahl, Baujahr, …"), NICHT als strukturierte
`facts`-Schlüssel. Der einzige Weg, wie Zimmerzahl/Baujahr/Parkplatz-Kaufpreis
überhaupt automatisch ins Formular gelangen, ist über die Stufe-2-Synthese
(`fieldUpdateProposals`, siehe `dueDiligenceSynthesis.ts`) — und die bekommt von jedem
Dokument nur dessen bereits strukturiertes `facts`-Objekt roh als JSON in den Prompt
gereicht (`Fakten: ${JSON.stringify(d.facts)}`), nicht die Fund-Fliesstexte im Detail.
Ohne exakten, vorhersehbaren Schlüsselnamen musste Stufe 2 also selbst aus Prosa
zurückschliessen, welcher der drei bekannten Feldpfade (`zimmerzahl`, `baujahr`,
`parkplatzKaufpreisChf` — siehe `bestandsrenditeKnownFields.ts`) gemeint war, was
unzuverlässig ist.

Fix: `EXPOSE_INSERAT.extractionGuidance` verlangt jetzt explizit diese drei Werte als
strukturierte `facts`-Schlüssel mit GENAU den Namen `zimmerzahl`/`baujahr`/
`parkplatzKaufpreisChf` (als Zahl), zusätzlich weiterhin auch als lesbarer Fund im
Fliesstext. Dadurch sieht Stufe 2 direkt `facts.zimmerzahl` etc. und kann das 1:1 auf
den identisch benannten bekannten Feldpfad abbilden, statt es aus Prosa zu erraten.
Bewusst nur an `EXPOSE_INSERAT` geändert (der gemeldete Fall), nicht an allen
Dokumenttypen, die diese Felder am Rande erwähnen könnten — kein Anlass, den Prompt
über den gemeldeten Fall hinaus aufzublähen.

## Bewusst weiterhin nicht gebaut

- Mehrbenutzer-Login (nur die eine bekannte E-Mail-Adresse des Auftraggebers).
- Automatisierter Abruf/Scraping von Inserat-Links (siehe oben — bewusste Entscheidung wegen
  Portal-Blockaden). Die Objekt-Grunderfassung selbst ist weiterhin ein manueller Schritt
  (Formular ausfüllen bzw. bestätigen), auch wenn er sich jetzt optional aus Dokumenten
  vorausfüllen lässt — es gibt kein Portal-Scraping/E-Mail-Ingestion wie bei LandFinder.
