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

## Nachgezogen (2026-08-20): Fehlgeschlagene Dokumentenanalyse einzeln erneut anstossen

Auslöser: nach dem `max_tokens`-Fix traten weiterhin vereinzelte "Netzwerkfehler" beim
Hochladen auf (transiente Fetch-Fehler, keine Dauerursache) — bisher gab es keinen Weg,
nur das eine fehlgeschlagene Dokument erneut zu analysieren, ausser die ganze Datei neu
hochzuladen (Risiko versehentlicher Duplikate).

- **Neue erwarteter Objekte bereits gespeicherte Dokumente**: `POST
  /api/properties/[id]/documents/[documentId]/reanalyze` lädt die Datei erneut aus dem
  Supabase-Storage-Bucket herunter (`.download()`, erstmalige Verwendung dieser Methode
  im Projekt — bisher nur `.upload()`/`.remove()`) statt einen neuen Upload zu verlangen,
  und stösst Stage-1-Extraktion erneut an. `analysis_status` wird dabei kurz auf
  `PENDING` gesetzt und danach auf `DONE`/`FAILED` aktualisiert, `analysis_error` bei
  Erfolg geleert.
- **`DueDiligencePanel.tsx`**: neuer Button "Erneut analysieren", nur sichtbar bei
  `analysis_status === "FAILED"`, ruft die neue Route auf und aktualisiert die Ansicht
  per `router.refresh()`.
- **Neuanlage-Flow (`PropertyCreateForm.tsx`)**: die Analyse-Logik pro Datei wurde in
  eine wiederverwendbare `analyzeEntry(entry)`-Funktion ausgelagert (vom
  Batch-Analyse-Loop UND vom neuen Einzel-Retry `retryAnalyze(entry)` genutzt) — hier
  gibt es noch kein persistiertes Dokument, die bereits im Browser vorliegende Datei
  wird einfach erneut ans Extraktions-Endpoint geschickt. Nach dem Retry läuft die
  Stage-2-Synthese (`runSynthesisPrefill`) automatisch erneut, damit ein zuvor
  fehlendes Feld doch noch vorausgefüllt werden kann.

## Nachgezogen (2026-08-20): Text einfügen statt PDF-Upload

Auf Wunsch des Auftraggebers, im selben Zug wie das Retry-Feature: "beim Schritt Doku
hochladen soll auch die Möglichkeit bestehen, Texte einzukopieren" — z.B. Text aus einer
E-Mail oder einem Online-Inserat, für das keine PDF-Datei vorliegt.

- **Kein separater Codepfad**: eingefügter Text wird client-seitig sofort in eine
  `File`-Instanz verpackt (`new File([text], titel + ".txt", { type: "text/plain" })`)
  und ganz normal in denselben `stagedFiles`/Analyse-Ablauf eingespiesen wie eine
  hochgeladene PDF-Datei — Dokumenttyp-Auswahl, Analyse, Retry, Anhängen ans Objekt
  funktionieren dadurch identisch, ohne Duplikation.
- **`dueDiligenceExtraction.ts`**: `extractDocumentFields` nimmt jetzt eine
  `DocumentSourceInput` (`{kind:"pdf", pdfBase64}` oder `{kind:"text", text}`) statt nur
  `pdfBase64` entgegen. Beide laufen als Anthropic-"document"-Content-Block, nur mit
  unterschiedlichem `source.type` (`base64`/`application/pdf` vs. `text`/`text/plain`) —
  Prompt und Parsing bleiben unverändert. Neue Hilfsfunktionen
  `isSupportedDocumentFile`/`isPdfDocumentFile` ersetzen die bisherige reine
  PDF-Prüfung in allen drei betroffenen Routen (`prefill`, `documents`,
  `documents/attach`) sowie in `reanalyze` (dort anhand der Storage-Dateiendung erkannt).
- **Storage**: Text-"Dokumente" landen als `.txt`/`text/plain` im selben
  `property-documents`-Bucket wie PDFs (Storage-Key-Endung `.pdf`/`.txt` je nach Typ) —
  keine Schemaänderung nötig, die bestehende Lösch-/Reanalyse-Logik funktioniert
  unverändert für beide Typen.
- Länge des eingefügten Texts client-seitig auf 200'000 Zeichen begrenzt
  (`maxLength` auf der Textarea) — grosszügig genug für z.B. ein komplettes
  Exposé/eine E-Mail, verhindert aber einen versehentlich riesigen Paste.

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

## Nachgezogen (2026-08-20): Dokumenten-KI auf erzwungenen Tool-Aufruf statt Freitext-JSON umgestellt

Auslöser: frische Vercel-Logs (vom Auftraggeber kopiert) zeigten weiterhin Fehler beim
Hochladen — u.a. mehrere `Vercel Runtime Timeout Error: Task timed out after 60 seconds`
auf `/api/properties/prefill` (Screenshot zeigte entsprechend mehrere "Netzwerkfehler",
da `res.json()` auf der Timeout-Fehlerseite scheitert und im Catch-Block landet) sowie
ein `SyntaxError: Expected ',' or '}' after property value in JSON` bei einem
Erneuerungsfonds-Dokument — diesmal NICHT durch `max_tokens`-Abschneiden (das wird
separat geprüft und hätte eine eigene Fehlermeldung ausgelöst), sondern vermutlich durch
ein nicht korrekt escapetes Zeichen (z.B. ein eingebettetes Anführungszeichen) in einem
wörtlichen Zitat, das Claude beim Freitext-JSON gelegentlich nicht sauber escaped.

Fix (in `dueDiligenceExtraction.ts` UND `dueDiligenceSynthesis.ts`, dasselbe Muster):
- Beide Claude-Aufrufe verlangen jetzt einen **erzwungenen Tool-Aufruf**
  (`tool_choice: {type: "tool", name: ...}`) mit einem JSON-Schema statt eines
  Freitext-"gib JSON zurück"-Prompts. Die Anthropic-API validiert/parst das
  `tool_use`-`input` bereits serverseitig zu einem echten Objekt — die Fehlerklasse
  ungültigen JSONs ist damit strukturell ausgeschlossen, statt nur nachträglich am Text
  erkannt zu werden. `extractFirstJsonObject`/regelbasiertes Nachparsen entfällt für
  diese beiden Aufrufe komplett (die Hilfsfunktion selbst bleibt bestehen, falls künftig
  wieder gebraucht). Die vorhandene defensive Validierung (`parseDocumentExtractionResponse`/
  `parseSynthesisResponse`) bleibt unverändert bestehen — bekommt den Tool-Output nur
  via `JSON.stringify(toolUseBlock.input)` statt eines rohen Modelltexts.
- Bei der Synthese zusätzlich verbessert: `fieldUpdateProposals.field` ist jetzt direkt
  im Schema per `enum` auf die tatsächlich übergebenen `knownFields`-Pfade eingeschränkt
  (statt nur textuell im Prompt aufgelistet) — ein strukturelles statt nur ein
  nachträglich geprüftes Constraint.
- `sourceQuote` ist im Schema auf `maxLength: 280` begrenzt und im Prompt zusätzlich als
  "kurz halten" instruiert — reduziert die Antwortlänge bei fundreichen/zitatlastigen
  Dokumenten (z.B. mehrjährige Betriebskostenaufstellungen, Grundbuchauszüge), was das
  Risiko verringert, die harte 60-Sekunden-Obergrenze der Vercel-Hobby-Funktion zu
  reissen — behebt das Timeout-Risiko aber nicht vollständig (weiterhin eine bekannte
  Plattformgrenze, siehe unten). Der bereits vorhandene "Erneut versuchen"-Button pro
  Dokument bleibt das Sicherheitsnetz für den Fall, dass ein einzelnes Dokument trotzdem
  einmal über die Zeit läuft.
- Mit Tests abgesichert: `buildExtractionToolSchema`/`buildSynthesisToolSchema` prüfen,
  dass die Schema-`enum`s exakt mit dem Dokumenttyp-Katalog/den Kategorien/Severities
  bzw. den übergebenen bekannten Feldpfaden übereinstimmen, damit Schema und übrige
  Validierung nicht auseinanderlaufen können.

## Nachgezogen (2026-08-20): Synthese-Latenz, weitere Baujahr/Zimmerzahl-Fakten, automatisches Retry

Anhand vom Auftraggeber bereitgestellter echter Objekt-Unterlagen (Exposé, Grundbuchauszug,
AGV-Police, Grundriss, u.a.) konkret nachvollzogen: das Expose selbst enthielt Zimmerzahl (4)
und Baujahr (1967) sauber strukturiert (Tabelle "Eigenschaften") und Stufe 1 hatte es
korrekt analysiert ("ANALYSIERT") — trotzdem blieben die Formularfelder leer, weil direkt
darüber "Vorschläge aus den Dokumenten konnten nicht ermittelt werden (Netzwerkfehler)"
stand: Stufe 2 (Synthese) war fehlgeschlagen, wodurch GAR KEINE Feldvorschläge zustande
kamen — unabhängig davon, wie gut Stufe 1 extrahiert hatte. Zusätzlich beim Durchsehen der
mitgelieferten Dokumente zwei weitere reale Lücken gefunden: der Grundbuchauszug nennt die
Zimmerzahl oft direkt im Text ("4-Zimmerwohnung im 1. Obergeschoss"), die AGV-Gebäudeversicherung
nennt "Baujahr" als eigenes Feld — beides bisher nicht als strukturierter Fakt angefordert.

- **`documentTypes.ts`**: `GRUNDBUCHAUSZUG` fragt jetzt zusätzlich nach `facts.zimmerzahl`
  (aus der "Mit Sonderrecht an"-Angabe), `GEBAEUDEVERSICHERUNG` nach `facts.baujahr`,
  `GRUNDRISS` bekam eine explizite Anleitung, die Zimmerzahl durch Zählen der beschrifteten
  Räume (Wohnzimmer + Zimmer, ohne Küche/Bad/Gang) herzuleiten, wenn keine Zahl explizit auf
  dem Plan steht — Grundrisse nennen die Zimmerzahl fast nie als Zahl, nur als Raumliste.
- **`dueDiligenceSynthesis.ts` — Synthese-Antwortlänge reduziert**: der Prompt verlangte
  bisher zwingend einen Eintrag für JEDE der neun Kategorien, auch ganz ohne Bezug zu den
  hochgeladenen Dokumenten (reine Boilerplate-Funde) — das bläht die Antwort gerade bei
  wenigen Dokumenten (wie im gemeldeten Fall: nur ein Exposé) unnötig auf und erhöht das
  Risiko, die 60-Sekunden-Obergrenze der Vercel-Hobby-Funktion zu reissen. Das LLM nennt
  jetzt nur noch Kategorien, zu denen es tatsächlich etwas beizutragen hat;
  `parseSynthesisResponse` füllt die restlichen Kategorien deterministisch mit einem
  neutralen Platzhalter auf — unterscheidet dabei ehrlich zwischen "kein Dokument für diese
  Kategorie hochgeladen" (aus den Dokumenttypen ableitbar) und "Dokumente vorhanden, aber
  kein gesonderter Befund" (kein automatisches "unproblematisch", nur weil das LLM
  geschwiegen hat). `investmentScore.ts`s Annahme von exakt 9 Kategorien bleibt dadurch
  unverändert korrekt, jetzt aber strukturell statt nur durch Prompt-Befolgung garantiert.
- **`fetchJsonWithRetry.ts`** (neu, `src/lib`): ein einzelner automatischer
  Wiederholungsversuch für alle Dokumenten-KI-Endpunkte (Einzeldokument-Analyse, Upload,
  Reanalyse, Synthese) — retryt NUR, wenn `fetch()` wirft oder die Antwort kein valides JSON
  ist (typisch für eine Vercel-Timeout-Fehlerseite), NICHT bei einer erfolgreich geparsten
  inhaltlichen Fehlermeldung (das wäre kein transienter Fehler). Ein zweiter Versuch hat oft
  schlicht Glück mit der Anthropic-API-Latenz — kein Ersatz für die strukturellen Fixes oben,
  aber ein zusätzliches, günstiges Sicherheitsnetz gegen den weiterhin bestehenden
  60-Sekunden-Hobby-Plan-Ceiling, den wir serverseitig nicht weiter senken können.

## Nachgezogen (2026-08-20): Objekt-Detailseite kompakter dargestellt

Auf Wunsch des Auftraggebers: "die Seite der Daten sollte bedeutend komprimierter
dargestellt werden, ohne dass die Lesbarkeit verschlechtert wird" — die Objekt-Detailseite
(`/objekte/[id]`, kombiniert aus Kopfbereich, `BestandsrenditeAnalysisView` und
`DueDiligencePanel`) reiht viele Panels/Metric-Grids/Tabellen mit grosszügigem Weissraum
untereinander, was bei einem datenreichen Objekt viel Scrollen erfordert.

Bewusst NUR Innenabstände/Aussenabstände (Padding, Margin, Gap) reduziert — **keine**
Schriftgrössen, Zeilenhöhen oder Farben angefasst, damit die Lesbarkeit unverändert bleibt:

- `globals.css`: `.metric`-Zellen (`1rem 1.2rem` → `0.6rem 0.85rem`), `.metricgrid`
  margin-top, `.sectionhead` margin-bottom, `.dethead`-Padding, Tabellenzellen (`td`/`th`)
  sowie `.stresstable` (die Cashflow-/Exit-Tabellen) — alle spürbar enger, betrifft
  ausschliesslich die vier Dateien, die diese Klassen tatsächlich verwenden (`page.tsx`,
  `BestandsrenditeAnalysisView.tsx`, `DueDiligencePanel.tsx`, `MetricPrimitives.tsx`) —
  keine Nebenwirkung auf Login/Wizard/Vergleichsseite, die diese Klassen nicht nutzen.
- `BestandsrenditeAnalysisView.tsx`/`DueDiligencePanel.tsx`/`page.tsx`: die wiederkehrenden
  Panel-Abstände zwischen den ~8 gestapelten Panels (Schnellcheck, Investment Case,
  Value-Add-Blöcke, Mehrjahresmodell, STWEG-Fakten, Due-Diligence-Panel) von `1.4rem/1.6rem`
  auf `1rem/1.1rem` reduziert, ebenso interne Listen-/Kategorie-Box-Abstände.
- Verifiziert per statischem HTML-Mock (echtes `globals.css` + dieselben CSS-Klassen,
  realistische Beispielwerte) und Screenshot via Headless-Chromium, da diese Session ohne
  Supabase-Zugangsdaten läuft und die echte Seite daher nicht mit echten Objektdaten
  gerendert werden konnte — bittet um kurze Rückmeldung nach dem Deploy, ob die
  Live-Ansicht mit echten (teils längeren) Textinhalten ebenfalls stimmt.

## Nachgezogen (2026-08-22): STWEG-Akontobeitrag/Erneuerungsfonds-Saldo/Wertquote als strukturierte Fakten

Auf Bitte des Auftraggebers ("Prüfe zuerst die Dokumententypen") systematisch alle
mitgelieferten Dokumente eines realen Objekts (Kapital-/Zinsausweis, STWEG-Protokolle,
Betriebskostenabrechnungen, Jahresrechnung, Budget) gegen die jeweilige
`extractionGuidance` geprüft — drei weitere konkrete, belegte Lücken gefunden:

- **Erneuerungsfonds: Gesamtsaldo vs. Wohnungs-Anteil.** Kapital-/Zinsausweise nennen
  fast immer ZWEI Beträge nebeneinander: den Gesamtsaldo des Erneuerungsfonds der
  ganzen STWEG (z.B. CHF 202'706) UND separat den nach Wertquote anteiligen Betrag nur
  der geprüften Wohnung (z.B. CHF 10'135, ca. 5% davon). Die bisherige Anleitung
  ("erfasse aktueller Saldo") liess offen, welcher der beiden gemeint ist — riskiert,
  dass der Fonds fälschlich als winzig statt gesund eingeschätzt wird, wenn der
  Wohnungs-Anteil statt des Gesamtsaldos erfasst wird. `ERNEUERUNGSFONDS.extractionGuidance`
  verlangt jetzt explizit den GESAMTSaldo als `facts.erneuerungsfondsSaldoChf`.
- **STWEG-Akontobeitrag der Wohnung fehlte als strukturierter Fakt.** Der tatsächliche
  Jahresbeitrag der geprüften Wohnung an die STWEG (Heizkosten- + Nebenkosten- +
  Erneuerungsfonds-Anteil nach Wertquote) taucht je nach hochgeladenem Dokument in
  einem von DREI verschiedenen Dokumenttypen auf: `JAHRESRECHNUNG` ("Kostenverteiler
  nach Eigentümer"), `BUDGET_STWEG` ("Budgetverteilung nach Eigentümer") oder einer
  eigentümerseitigen "Betriebskostenabrechnung" (siehe nächster Punkt) — keiner davon
  fragte bisher strukturiert danach, obwohl `betriebskosten.stwegAkontobeitragChfPerYear`
  ein bekanntes Übernahme-Feld ist. Alle drei Typen fragen jetzt zusätzlich nach
  `facts.stwegAkontobeitragChfPerYear`, wo der Betrag ersichtlich ist — ebenso nach
  `facts.wertquotePromille`, die in denselben Dokumenten praktisch immer mitsteht.
- **`NEBENKOSTENABRECHNUNG` deckte nur die Mieter-Variante ab.** Diese Kategorie war
  bisher ausschliesslich für die MIETER-Nebenkostenabrechnung formuliert (Vergleich zu
  Mietvertrag-Akonto). Eine reale, ähnlich benannte Datei
  ("Betriebskosten_Wohnung_[Jahr].pdf") stellte sich beim Lesen aber als
  EIGENTÜMER-seitige STWEG-Kostenanteilsabrechnung heraus (Heizkosten-/
  Nebenkosten-/Erneuerungsfonds-Anteil nach Wertquote, kein Mietvertragsbezug) — beide
  Varianten sehen vom Dateinamen her ähnlich aus, sind inhaltlich aber grundverschieden.
  Mit der alten Anleitung hätte Claude nach einem nicht vorhandenen
  Mietvertrags-Akonto-Vergleich gesucht. Die Anleitung unterscheidet jetzt explizit
  beide Varianten am Inhalt (nicht am Dateinamen) und fragt bei der Eigentümer-Variante
  ebenfalls nach `facts.stwegAkontobeitragChfPerYear`/`facts.wertquotePromille`.

## Nachgezogen (2026-08-22): Miete/Parkplatzpreis/Baujahr/Wertquote als Fakten in weiteren Dokumenttypen

Auf Rückfrage die restlichen Dokumenttypen systematisch gegen die bekannten
Übernahme-Felder (`bestandsrenditeKnownFields.ts`) geprüft — **anders als die
vorangehenden Einträge diesmal OHNE reale Beispieldokumente**, rein aus dem Abgleich
Dokumenttyp-Beschreibung ⟷ bekannte Felder, nach demselben Muster wie zuvor real
bestätigt. Sollte sich beim nächsten Live-Test etwas davon als unpassend erweisen,
bitte melden.

- **`MIETVERTRAG`** — die wichtigste Lücke: Nettomiete und Parkplatzmiete wurden bisher
  nur als Fliesstext verlangt ("Erfasse: Nettomiete Wohnung; Miete Garage/Parkplatz;
  ..."), obwohl `miete.wohnungsMieteChfPerMonth`/`miete.parkplatzMieteChfPerMonth`
  bekannte Übernahme-Felder sind, die direkt in die Renditeberechnung einfliessen —
  vermutlich der folgenreichste blinde Fleck von allen bisher gefundenen. Jetzt
  zusätzlich als `facts.wohnungsMieteChfPerMonth`/`facts.parkplatzMieteChfPerMonth`
  verlangt.
- **`PARKPLATZ_UNTERLAGEN`** — falls ein separater Parkplatz-Kaufpreis genannt wird
  (z.B. in einer Kaufabrechnung), jetzt zusätzlich als `facts.parkplatzKaufpreisChf`
  verlangt (bisher nur `EXPOSE_INSERAT` fragte danach, siehe Eintrag oben).
- **`BAUBESCHRIEB`** — nennt "Baujahr" schon in der Fliesstext-Anleitung, jetzt
  zusätzlich als `facts.baujahr` verlangt (dieselbe Lücke wie zuvor bei
  `GEBAEUDEVERSICHERUNG` gefunden). Bewusst NICHT bei `HEIZUNG_SERVICE` ergänzt, obwohl
  dort ebenfalls "Baujahr/Alter" erwähnt wird — das bezieht sich dort auf das Alter der
  Heizungsanlage, nicht des Gebäudes, ein `facts.baujahr` von dort wäre eine falsche
  Quelle.
- **`STWEG_BEGRUENDUNG`** — nennt "Wertquote der Wohnung" bereits in der
  Fliesstext-Anleitung, jetzt zusätzlich als `facts.wertquotePromille` verlangt.
- **`ERNEUERUNGSFONDS`** — zusätzlich zum bereits behobenen Gesamtsaldo/Wohnungsanteil-
  Problem (siehe oben) jetzt auch nach einem im Dokument/Reglement explizit genannten
  Ziel-/Sollwert des Fonds als `facts.erneuerungsfondsZielwertChf` gefragt, sofern
  vorhanden — ausdrücklich nur ein im Dokument genannter Wert, keine eigene
  Einschätzung.

## Nachgezogen (2026-08-22): Objekt löschen (Liste), Wertvorschläge, Parkplatz-Doppelzählung, Abbrechen/Ausschliessen, Mietschätzung

Auf Rückmeldung nach dem ersten Live-Test mit echten Dokumenten ("füllt jetzt viel
besser aus") fünf UX-Optimierungen umgesetzt:

- **Objekt löschen von der Objektliste aus.** `DELETE /api/properties/[id]` existierte
  bereits (per Objektseite erreichbar), aber nicht von `/` (Objektliste) aus — dort gab
  es gar keinen Löschweg. Neue Client-Komponente `DeletePropertyButton` pro Zeile, nutzt
  die bestehende Route unverändert.
- **Dropdown/Wertvorschläge für Felder mit fixen Wertsprüngen.** Bewusst als HTML
  `<datalist>` umgesetzt statt eines echten `<select>` — das Feld bleibt frei editierbar
  (Zahl exakt eingebbar), die Vorschläge erscheinen nur als Dropdown-Hilfe. Betrifft
  Zimmerzahl (0.5-Schritte), Hypothekar-Zinssatz (0.25%-Schritte), 1./2. Hypothek-
  Belehnung, Leerstand/Auslastung, 2. Hypothek-Amortisationsdauer (gesetzlich max. 15
  Jahre), Haltedauer. Kein Zwang, keine Erfindung — nur schnellere Eingabe üblicher
  Werte.
- **Parkplatz-Kaufpreis: manuell steuerbar, ob er bereits im Kaufpreis enthalten ist.**
  Bug-artige Lücke gefunden: `kaufpreisChf = property.kaufpreisChf +
  facts.parkplatzKaufpreisChf` addierte den Parkplatzpreis IMMER zusätzlich — auch wenn
  ein Inserat "Kaufpreis inkl. Einstellhallenplatz CHF X" bereits den Gesamtpreis nennt,
  was zu einer stillen Doppelzählung in Investitionssumme/Schnellcheck geführt hätte.
  Neue Checkbox `parkplatzImKaufpreisEnthalten` (Default: aus/nicht enthalten, wie
  bisheriges Verhalten) — wenn gesetzt, wird `parkplatzKaufpreisChf` weiterhin informativ
  erfasst, aber nicht mehr zusätzlich addiert.
- **Abbrechen während des Hochladens + dauerhafter Synthese-Ausschluss.** Zwei separate
  Mechanismen für "manche Dokumente dauern sehr lange": (1) ein "Abbrechen"-Button pro
  gerade hochladender Datei (AbortController) — bricht nur das Warten auf dem Client ab,
  der Server-Request läuft im Hintergrund zu Ende (kein Job-Abbruch, bewusst beibehaltene
  synchrone Ein-Dokument-pro-Request-Architektur, siehe oben); `fetchJsonWithRetry`
  wiederholt einen absichtlichen Abbruch NICHT (sonst würde "Abbrechen" den zweiten
  Versuch auslösen). (2) ein dauerhafter Ausschluss-Toggle
  (`excluded_from_synthesis`, Migration 0004) pro bereits hochgeladenem Dokument — für
  Dokumente, die die Stufe-2-Synthese wiederholt zum Timeout bringen: bleibt erhalten und
  analysiert, fliesst aber nicht mehr in die Synthese ein, bis wieder eingeschlossen.
- **Mietschätzung als klar markierte Annahme, wenn kein Dokument einen Wert liefert.**
  Bewusste Abweichung vom wörtlichen Wunsch ("mittels Recherche"): umgesetzt als
  Claude-Schätzung aus allgemeinem Marktwissen (Kanton + Zimmerzahl), OHNE Live-
  Websuche-Tool — in dieser Sandbox liess sich weder verifizieren, ob das Anthropic-
  Konto des Auftraggebers Zugriff auf das Websuche-Tool hat, noch das Verhalten gegen
  echte Daten testen (kein Internetzugriff/keine Produktions-Credentials hier). Eine an
  jeder Stelle mit echten Ergebnissen ungetestete Websuche-Integration in Produktion zu
  schicken schien riskanter als eine bewusst als grob gekennzeichnete Schätzung.
  Deshalb: Button "Marktschätzung vorschlagen" nur sichtbar, wenn kein Dokument-/
  Bestandswert vorliegt; das Ergebnis füllt das Feld UND zeigt dauerhaft eine
  hervorgehobene Zeile "Annahme (KI-Schätzung, keine Live-Marktdaten) — bitte prüfen"
  mit der von Claude selbst formulierten Einschränkung. Bei Bedarf lässt sich das später
  auf eine echte Websuche (Anthropic Web-Search-Tool) upgraden, ohne den Aufrufer
  (`/api/market-rent-estimate`) zu ändern.

## Nachgezogen (2026-08-22): Widersprüche als strukturierte Auswahl statt nur Fliesstext

Auf Rückmeldung: Widersprüche zwischen Quellen (bisher nur als einzelne Funde mit
`isContradiction: true` innerhalb einer Kategorie sichtbar, ohne erkennbaren
Zusammenhang zwischen den beiden widersprechenden Aussagen) sollen dem Nutzer als
Auswahl vorgelegt werden — mit Quelle je Option, damit er entscheiden kann, was stimmt.

- Neuer Domain-Typ `DueDiligenceContradiction` (`packages/domain/src/dueDiligence.ts`):
  `topic` (kurzer Sachverhalt, z.B. "Zimmerzahl"), `category`, optional `field` (nur
  gesetzt, wenn der Sachverhalt einem bekannten Bestandsrendite-Übernahme-Feld
  entspricht, siehe `ALLOWED_UPDATE_FIELDS`), und `options[]` — jede Option mit `value`
  UND vollem Quellenbeleg (`sourceDocumentName`/`sourcePage`/`sourceQuote`). Neues Feld
  `contradictions` auf `DueDiligenceResult`.
- Die bisherigen `isContradiction`-Funde in den Kategorien bleiben unverändert bestehen
  (weiterhin Teil der Fliesstext-Einschätzung je Kategorie) — der Prompt weist das LLM
  zusätzlich an, für JEDEN so markierten Fund einen entsprechenden Eintrag in
  `contradictions` zu erzeugen. Bewusst additiv statt ersetzend: geringeres Risiko, die
  bestehende Kategorien-Darstellung nicht zu verändern.
- Ein Widerspruch mit weniger als zwei Optionen wird beim Parsen verworfen (keine
  irreführende Ein-Options-"Auswahl") — ebenso ein `field`, das keinem der bekannten
  Feldpfade entspricht (wird nur weggelassen, der Widerspruch selbst bleibt informativ
  sichtbar, damit auch nicht-strukturierte Widersprüche — z.B. "Sanierung beschlossen
  oder abgelehnt?" — als Auswahl-Liste samt Quelle erscheinen, nur ohne
  Übernehmen-Button).
- UI (`DueDiligencePanel.tsx`): neue Sektion "Widersprüchliche Angaben — bitte
  entscheiden" direkt nach der Gesamteinschätzung, vor den Kategorien — pro Widerspruch
  eine Liste der konkurrierenden Werte inkl. Quelle; nur wenn `field` gesetzt ist, ein
  "Das stimmt — übernehmen"-Button je Option. Bewusst der bereits bestehende
  `handleApplyProposal`-Mechanismus (identisch zu den `fieldUpdateProposals`) statt
  einer neuen Route — dieselbe geschlossene Feld-Allowlist, dieselbe explizite
  Bestätigung, kein neuer Codepfad nötig.

## Nachgezogen (2026-08-22): "Netzwerkfehler" bei der Prefill-Synthese im Neu-Erfassen-Flow

Konkreter Fehlerfall gemeldet: beim Anlegen eines neuen Objekts mit ~9 hochgeladenen
Dokumenten (Exposé, zwei Kaufangebote, Katasterplan, Finanzierungsbestätigung, Antrag,
Grundriss, Betriebskostenabrechnungen) schlug die anschliessende Vorausfüll-Synthese
(`/api/properties/prefill-synthesis`) mit "Vorschläge aus den Dokumenten konnten nicht
ermittelt werden (Netzwerkfehler)." fehl — die einzelnen Dokumente waren zuvor alle
erfolgreich analysiert ("ANALYSIERT"), nur der zusammenfassende Stufe-2-Aufruf scheiterte.

Root Cause: derselbe bekannte Vercel-Hobby-Plan-60-Sekunden-Zeitlimit wie in früheren
Einträgen — bei so vielen Dokumenten in einem Zug überschreitet der Synthese-Prompt
(Zusammenfassung + Fakten + Einzelfunde JE Dokument) die verfügbare Zeit, Vercel liefert
eine Timeout-Fehlerseite statt JSON, `fetchJsonWithRetry` wiederholt einmal automatisch —
erfolglos, weil derselbe zu grosse Payload beim zweiten Versuch identisch lange dauert.

Gezielte Abhilfe statt allgemeiner Kürzung: von den 6 SONSTIGES-typisierten Dokumenten in
diesem Fall (Kaufangebote/Finanzierungsbestätigung/Antrag/Katasterplan — administrative/
transaktionsbezogene Unterlagen, keiner Due-Diligence-Kategorie zugeordnet) tragen praktisch
keine zu den bekannten Bestandsrendite-Feldern (Zimmerzahl/Miete/STWEG-Werte/…) bei, blähen
den Prompt aber erheblich auf. `PropertyCreateForm.tsx::runSynthesisPrefill` lässt sie jetzt
aus der Prefill-Synthese weg (sofern mindestens ein anderes Dokument übrig bleibt — bei
ausschliesslich SONSTIGES-Dokumenten wird weiterhin mit allen synthetisiert, damit nicht der
Sonderfall "keine Dokumente" entsteht). Die SONSTIGES-Dokumente werden trotzdem unverändert
ans neue Objekt angehängt und bleiben einzeln analysiert auf der Objektseite sichtbar — nur
nicht Teil dieser einen Cross-Dokument-Synthese.

Bewusst NICHT auf die reguläre, objektgebundene Synthese (`/api/properties/[id]/due-diligence`,
"Due-Diligence aktualisieren"-Button) übertragen — dort steht dem Nutzer bereits der
kürzlich gebaute manuelle Ausschluss-Toggle pro Dokument zur Verfügung (siehe Eintrag
"Abbrechen/Ausschliessen" oben), der flexibler ist als eine automatische Regel. Sollte
derselbe Timeout dort ebenfalls wiederholt auftreten, ist dieselbe SONSTIGES-Vorfilterung
ein naheliegender nächster Schritt.

## Nachgezogen (2026-08-22): "Netzwerkfehler" bei der Synthese trotz SONSTIGES-Filterung persistiert — Prompt zusätzlich kompaktiert

Rückmeldung mit Screenshot: derselbe "Vorschläge aus den Dokumenten konnten nicht
ermittelt werden (Netzwerkfehler)."-Fehler trat weiterhin auf — diesmal beim erneuten
Analysieren eines einzelnen zuvor fehlgeschlagenen Dokuments (löst laut
`PropertyCreateForm.tsx::retryAnalyze` eine neue Prefill-Synthese über ALLE Dokumente
aus), obwohl die vorherige, bereits erfolgreiche Synthese bereits eine ausführliche
Gesamteinschätzung geliefert hatte (sichtbar im Screenshot, weil `synthesisResult` bei
einem fehlgeschlagenen neuen Versuch nicht gelöscht wird — beide Zustände also
gleichzeitig sichtbar sind, kein Bug, nur verwirrend beim Lesen).

Die SONSTIGES-Filterung aus dem vorigen Eintrag griff (weniger Dokumente im Prompt),
reichte aber bei diesem realen Dokumentenset (u.a. mehrere STWEG-Protokolle über
mehrere Jahre, mehrere Heizkosten-Abrechnungen) offenbar nicht aus — die verbleibenden,
tatsächlich relevanten Dokumente allein sind bereits umfangreich genug, insbesondere
wegen der VOLLSTÄNDIGEN Stufe-1-Funde (inkl. `detail` und bis zu 280 Zeichen langem
`sourceQuote` JE Fund), die bisher 1:1 in den Stufe-2-Prompt kopiert wurden.

Zwei weitere, diesmal zentrale (statt nur aufruferseitige) Massnahmen in
`dueDiligenceSynthesis.ts`:

- **SONSTIGES-Filterung zentralisiert** (`selectSynthesisPromptDocuments`): bisher nur
  in `PropertyCreateForm.tsx` für die Prefill-Synthese angewendet — jetzt direkt in
  `synthesizeDueDiligence`, wirkt damit automatisch auch für "Due-Diligence
  aktualisieren" auf der Objektseite, die bisher ungeschützt war.
- **Kompaktere Stufe-1-Funde im Stufe-2-Prompt** (`compactFindingsForPrompt`): pro Fund
  werden nur noch `category`/`severity`/`summary`/`sourcePage`/`isContradiction` an
  Stufe 2 weitergereicht, NICHT mehr `detail` (oft die längste Freitext-Begründung) und
  `sourceQuote` (bis 280 Zeichen) — Stufe 2 generiert ihre eigenen Funde/Zitate ohnehin
  frisch mit eigenem `sourceDocumentId`/`sourcePage`, braucht das wörtliche Stufe-1-Zitat
  für die Quervergleichs-Logik nicht. Zusätzlich pro Dokument auf die (nach Schwere
  sortiert) wichtigsten 10 Funde gedeckelt, damit ein einzelnes findingsreiches Dokument
  (z.B. ein STWEG-Protokoll mit vielen vertagten Traktanden über mehrere Jahre) den
  Prompt nicht unverhältnismässig aufbläht. Die vollständigen Stufe-1-Funde bleiben
  unverändert pro Dokument gespeichert und in der UI sichtbar — nur der an Stufe 2
  weitergereichte Ausschnitt ist kompakter.

Weiterhin unverändert: die harte 60-Sekunden-Grenze selbst (Vercel-Hobby-Plan) lässt
sich im Code nicht anheben — diese beiden Massnahmen reduzieren das Risiko, beseitigen
es aber nicht für beliebig grosse Dokumentenmengen. Bei einem erneuten Auftreten trotz
dieser Änderungen wäre der nächste sinnvolle Schritt eine echte Batch-/Hintergrund-
Synthese statt eines einzelnen Aufrufs über alle Dokumente — bewusst nicht vorgezogen,
da architektonisch deutlich aufwendiger und ohne Live-Zugriff hier nicht token-genau
verifizierbar.

Zusätzlich ein zweiter, unabhängiger "Netzwerkfehler" im selben Testlauf gemeldet — diesmal
beim finalen Klick auf "Bestandsrendite speichern" (`PropertyCreateForm.tsx::handleSubmit`,
"Anlegen fehlgeschlagen (Netzwerkfehler)."). Geprüft: sowohl `POST /api/properties` als auch
`POST /api/properties/[id]/bestandsrendite` sind einfache, schnelle DB-Inserts/-Updates ohne
LLM-Aufruf — ein echter 60-Sekunden-Server-Timeout ist hier praktisch ausgeschlossen, ein
kurzer mobiler Verbindungsabbruch beim Abschluss-Klick dagegen plausibel. Auffällig: anders
als beim Dokumenten-Upload und der Synthese verwendeten genau diese beiden Aufrufe noch
einfaches `fetch` statt `fetchJsonWithRetry` — Inkonsistenz behoben, beide nutzen jetzt
denselben einen automatischen Wiederholungsversuch wie der Rest der App.

**Wichtige Anforderung dazu nachgereicht:** nach einem gescheiterten Speichern-Versuch darf
der Nutzer NIE gezwungen sein, Dateien erneut hochzuladen oder Daten erneut einzutippen.
Bereits vorher der Fall für Dokumenten-Upload/-Analyse (Zustand bleibt im Client-State
erhalten, `retryAnalyze` wiederholt gezielt nur das eine gescheiterte Dokument) — beim
finalen Submit selbst gab es aber eine reale Lücke: schlug ein SPÄTERER Schritt fehl,
nachdem `POST /api/properties` bereits erfolgreich ein Objekt angelegt hatte (z.B. weil
danach die Bestandsrendite-Fakten nicht gespeichert werden konnten), hätte ein erneuter
Klick auf "speichern" ein ZWEITES, dupliziertes Objekt angelegt (die Objekt-ID wurde
bislang nur in einer lokalen Variablen innerhalb des einen `handleSubmit`-Aufrufs
gehalten, nicht in State). Behoben mit neuem State `createdPropertyId`: einmal gesetzt,
überspringt ein erneuter "speichern"-Klick das erneute Anlegen und setzt direkt bei den
Folgeschritten (Fakten/Dokumente/Synthese) fort — kein Duplikat, keine erneute Eingabe
nötig. Die Fehlermeldung unterscheidet jetzt explizit zwischen "Anlegen selbst
fehlgeschlagen" (Eingaben bleiben erhalten, einfach nochmals versuchen) und "Objekt
existiert bereits, nur ein Folgeschritt scheiterte" (ausdrücklicher Hinweis: kein zweites
Objekt wird angelegt).

## Nachgezogen (2026-08-22): Abbrechen einzelner lange drehender Dokumente auch im Neu-Erfassen-Flow

Der "Abbrechen"-Button für einzelne, sehr lange analysierende Dokumente existierte bisher
nur auf der Objektseite (`DueDiligencePanel`, siehe früherer Eintrag) — im kombinierten
Neu-Erfassen-Flow (`/neu`, `PropertyCreateForm.tsx`) fehlte er. Dort ist die Lücke sogar
gravierender: `handleAnalyze` analysiert alle ausgewählten Dokumente SEQUENZIELL in einer
Schleife — ein einzelnes hängendes Dokument blockierte bisher nicht nur sich selbst,
sondern auch alle NACHFOLGENDEN Dokumente in der Warteschlange, die erst gar nicht zu
laufen begannen.

`PrefillFile` bekommt denselben `AbortController`/"CANCELLED"-Status wie `UploadState` in
`DueDiligencePanel`. Da `/api/properties/prefill` zustandslos ist (kein `property_id`,
also keine DB-Zeile/kein Storage-Objekt — das Objekt existiert zu diesem Zeitpunkt noch gar
nicht), ist der clientseitige Abbruch hier vollständig sauber: kein verwaister
Server-Zustand aufzuräumen, anders als beim Dokumenten-Upload auf der Objektseite.

Ausdrücklich klargestellt (auch per Hinweistext im UI): das Formular liess sich technisch
schon vorher jederzeit speichern, während noch analysiert wurde (`handleSubmit` hängt nur
von `saving` ab, nicht von `analyzing`; nur `status === "DONE"`-Dokumente werden ans neue
Objekt angehängt) — der Abbruch-Button macht das nur unmissverständlich und lässt die
übrigen Dokumente in der Warteschlange weiterlaufen, statt dass der Nutzer rätseln muss, ob
er warten oder einfach speichern soll.

## Nachgezogen (2026-08-23): Datenfelder (Erfassungsformulare) kompaktiert

Folgeauftrag zur bereits umgesetzten Kompaktierung der Anzeigeseiten (PR #18, Eintrag
weiter oben) — diesmal explizit die EINGABE-Formulare selbst (`BestandsrenditeFactsFields`,
das lange Fakten-Formular sowohl im Neu-Erfassen-Flow als auch beim Bearbeiten; die
einfacheren Objekt-Basisdaten-Formulare), die bislang unangetastet blieben. Gleiche
Methodik wie zuvor: NUR Padding/Margin/Gap reduziert, Schriftgrösse/Zeilenhöhe/Farben
unverändert gelassen, damit die Lesbarkeit nicht leidet.

Zentral in `globals.css` (wirkt automatisch auf alle Formulare app-weit, da `.field`/
`.fieldgrid` überall gleich verwendet werden — auch Login, Objekt-Bearbeiten):
- `.field` Abstand zwischen Feldern: 1.1rem → 0.8rem
- `.field label` Abstand Label→Eingabe: 0.35rem → 0.25rem
- `.field input/textarea/select` Innenabstand: 0.65rem 0.75rem → 0.5rem 0.65rem
- `.fieldgrid` Abstand zwischen Feldspalten/-zeilen: 1.1rem 1.6rem → 0.8rem 1.2rem
- `.field .fieldhelp` Abstand zur Eingabe: 0.35rem → 0.25rem

Zusätzlich die Abstände zwischen den ca. 10 Abschnittsüberschriften ("eyebrow", z.B.
"Miete & Vermietungsmodell", "STWEG", "Finanzierung & Steuer") im langen Fakten-Formular
von 1.4rem/.5rem auf 1rem/.4rem reduziert (`BestandsrenditeFactsFields.tsx`) sowie die
umgebenden Panel-Innenabstände in `BestandsrenditeVertiefungForm.tsx`/
`PropertyEditForm.tsx`/`PropertyCreateForm.tsx` entsprechend angepasst.

Visuell verifiziert über einen statischen HTML-Mock mit dem echten `globals.css`
(Screenshot via headless Chromium, wie schon bei der ersten Kompaktierung — kein
Supabase-/Anthropic-Zugriff in dieser Sandbox für eine echte Live-Vorschau) — Labels und
Eingaben bleiben klar unterscheidbar, die Abschnittsüberschriften weiterhin klar abgesetzt.

## Nachgezogen (2026-08-23): Zwei ernste Bugs beim Speichern gefunden und behoben

Zwei unabhängige, per Live-Test gemeldete Fehler in derselben Sitzung — beide betreffen
"stillschweigend nichts passiert" statt eines sichtbaren Fehlers, was sie besonders
tückisch machte.

**1. "Übernehmen"-Buttons bei Feldwert-Vorschlägen/Widersprüchen wirkungslos.** Zwei
zusammenwirkende Ursachen in `DueDiligencePanel.tsx`:
- `handleApplyProposal` prüfte die Antwort von `POST .../apply-proposal` gar nicht (kein
  `res.ok`/`body.saved`-Check) — ein serverseitiger Fehler wäre komplett unsichtbar
  geblieben. Jetzt geprüft, bei Fehlschlag `window.alert` statt stillem Nichtstun.
- Selbst bei erfolgreichem Schreiben in die DB zeigte das Bestandsrendite-Formular
  (`BestandsrenditeVertiefungForm` → `BestandsrenditeFactsFields`) den neuen Wert NICHT
  an: die Formularfelder sind bewusst unkontrollierte Inputs mit `defaultValue` (siehe
  Kommentar dort), und React ignoriert ein geändertes `defaultValue` auf einem bereits
  gemounteten Input — ein `router.refresh()` allein reicht nicht, die Komponente muss neu
  gemountet werden. `PropertyCreateForm` löste das bereits für den Neu-Erfassen-Flow
  (`key={factsFieldsVersion}`), `BestandsrenditeVertiefungForm` auf der Objektseite hatte
  diesen Mechanismus nie bekommen. Jetzt: neuer Prop `bestandsrenditeUpdatedAt` (aus
  `properties.bestandsrendite_updated_at`, ändert sich bei jedem erfolgreichen Schreiben)
  als `key` auf `BestandsrenditeFactsFields` — erzwingt einen frischen Mount mit den
  aktuellen Werten nach jedem `router.refresh()`. Zusätzlich sofortiges visuelles
  Feedback ohne auf den Refresh warten zu müssen: übernommene Felder zeigen direkt einen
  "Übernommen ✓"-Chip statt des Buttons (`appliedFields`-State).

**2. Nach dem Anlegen: 0 von 17 Dokumenten gespeichert, mehrere Fakten-Felder leer.**
Zwei separate Bugs in `PropertyCreateForm.tsx::handleSubmit`, beide durch denselben
Live-Test aufgedeckt:
- **Root Cause für die leeren Felder:** `new FormData(event.currentTarget)` wurde erst
  NACH dem ersten `await` (dem `POST /api/properties`-Aufruf zum Anlegen) gelesen. React
  setzt `event.currentTarget` auf `null`, sobald die synchrone Dispatch-Phase des Events
  endet — bei einem `async`-Handler ist das spätestens beim ersten `await` der Fall.
  `new FormData(null)` liefert ein leeres FormData-Objekt, `buildBestandsrenditeFactsFromFormData`
  las daraus praktisch nichts. Behoben: FormData wird jetzt GANZ AM ANFANG von
  `handleSubmit`, synchron vor jedem `await`, gelesen.
- **Root Cause für die 0 Dokumente:** der Anhänge-Loop
  (`POST .../documents/attach` pro Dokument) prüfte die Antwort ebenfalls nicht — ein
  Fehlschlag jedes einzelnen Requests wäre unsichtbar geblieben, das Objekt stand am Ende
  mit 0 Dokumenten da, ohne jede Fehlermeldung. Jetzt werden Fehlschläge gezählt und nach
  dem Speichern als `window.alert` mit Dateinamen gemeldet; dieselbe Prüfung/Meldung auch
  für das Mitspeichern der Due-Diligence-Synthese (`save-prefilled`) ergänzt.

Ob der zweite Bug (FormData) allein für "0 Dokumente" verantwortlich war, liess sich
nicht abschliessend klären (er betrifft nur die Fakten, nicht den davon unabhängigen
Dokumenten-Anhänge-Loop) — die zweite Ursache (ungeprüfte attach-Antwort) deckt diesen
Fall unabhängig ab. Beide Fixes sind in Kombination die robusteste verfügbare Erklärung
für das beobachtete Verhalten.

## Nachgezogen (2026-08-23): Netzwerkfehler bei der Synthese persistierte weiterhin — Analyse/Anhängen parallelisiert, Prompt weiter gedeckelt

Erneute Rückmeldung mit demselben grossen Dokumentenset (~15-20 Dateien, mehrheitlich
STWEG-Protokolle/Heizkosten über mehrere Jahre): die Prefill-Synthese scheiterte trotz
SONSTIGES-Filterung und Funde-Kompaktierung weiterhin mit "Netzwerkfehler", UND explizit
gemeldet: der gesamte Vorgang (Analysieren + Speichern) dauert "sehr sehr lange", und nach
dem Speichern waren wieder 0 Dokumente/leere Felder zu sehen.

**Wahrscheinlichste Ursache für "0 Dokumente" diesmal:** nicht mehr derselbe Bug wie zuvor
(der ist behoben, siehe voriger Eintrag), sondern schlicht die Dauer selbst — bei 15-20
Dokumenten lief `handleAnalyze` bisher komplett SEQUENZIELL (eine Claude-Analyse nach der
anderen), gefolgt von einem ebenso sequenziellen Anhängen-Loop beim Speichern (ein
Server-Request pro Dokument, nacheinander). Bei mehreren Minuten Gesamtdauer auf einem
mobilen Gerät steigt das Risiko einer unterbrochenen Verbindung oder eines ungeduldigen
Verlassens der Seite deutlich — mit potenziell nur teilweise abgeschlossenem Speichern.

Zwei weitere Massnahmen:

- **Parallelisierung statt strikter Sequenz** (`concurrency.ts`, neue Funktion
  `runWithConcurrency`): sowohl `handleAnalyze` (Stufe-1-Analyse, max. 3 gleichzeitig —
  bewusst moderat, jede Analyse ist ein eigener LLM-Aufruf, keine Anthropic-Rate-Limits
  strapazieren) als auch der Dokumenten-Anhänge-Loop beim Speichern (max. 5 gleichzeitig —
  reiner Storage-Upload + DB-Insert, kein LLM, höhere Nebenläufigkeit vertretbar) laufen
  jetzt parallel statt einzeln nacheinander. Jeder einzelne Server-Request bleibt
  unabhängig mit eigenem Zeitbudget — Parallelität ist rein clientseitig (mehrere Fetches
  gleichzeitig), erhöht also nicht das Risiko eines einzelnen Timeouts, senkt aber die
  Gesamtdauer spürbar und damit das Zeitfenster für eine unterbrochene Verbindung.
- **Weitere defensive Prompt-Obergrenzen** in `buildSynthesisPrompt`
  (`dueDiligenceSynthesis.ts`): `summary` auf 500 und die `facts`-JSON-Darstellung auf
  1000 Zeichen JE Dokument gedeckelt (zusätzlich zur bereits vorhandenen
  Funde-Deckelung/-Kompaktierung) — greift nur im Grenzfall ungewöhnlich langer
  Stufe-1-Ausgaben, wirkt aber in dieselbe Richtung.

Weiterhin unverändert: die harte 60-Sekunden-Grenze (Vercel-Hobby-Plan) selbst lässt sich
im Code nicht anheben. Sollte die Synthese bei sehr grossen Dokumentensets trotz all dieser
Massnahmen weiterhin scheitern, wäre der nächste, deutlich aufwendigere Schritt eine echte
Batch-/Hintergrund-Synthese (mehrere kleinere LLM-Aufrufe statt eines grossen) — bewusst
nicht vorgezogen, ohne Live-Zugriff hier nicht token-genau planbar/verifizierbar.

## Nachgezogen (2026-08-23): Weitere Optimierungen ohne Vercel-Upgrade

Auf Rückfrage geprüft, ob ein Wechsel zur OpenAI-API sinnvoll wäre (Auftraggeber hatte mit
ChatGPT schnellere Analysen erlebt) — Ergebnis mit dem Auftraggeber besprochen: ChatGPT Pro
umfasst keinen API-Zugang, der wahrgenommene Geschwindigkeitsunterschied liegt eher an der
Nutzungsart (ein Dokument interaktiv vs. viele Dokumente serverseitig in einem Rutsch) als
am Modell selbst, und ein zweiter KI-Anbieter würde Vercels 60-Sekunden-Grenze nicht
aufheben. Empfehlung: Vercel-Pro-Upgrade ($20/Monat, hebt die Grenze auf 300s) wäre der
direktere Hebel — vorerst aber zurückgestellt ("belassen wir für den Moment"), stattdessen
weitere Optimierungen innerhalb der bestehenden Grenzen angefordert.

Zwei weitere, bewusst risikoarme Massnahmen (siehe auch die Kette vorheriger Einträge zum
selben Thema):

- **Haiku 4.5 statt Sonnet 5 für SONSTIGES-Dokumente** (`resolveExtractionModel` in
  `dueDiligenceExtraction.ts`): diese Dokumente (Kaufangebot, Finanzierungsbestätigung,
  Antrag, Katasterplan o.ä. — bereits von der Stufe-2-Synthese ausgeschlossen, siehe
  `selectSynthesisPromptDocuments`) stellen geringere Anforderungen an die Extraktion
  (im Wesentlichen Objekt-Basisdaten/einfache Fakten, keine nuancierte Risikobewertung).
  Haiku ist für diese Fälle spürbar schneller und günstiger, ohne die Qualität bei den
  eigentlich due-diligence-relevanten Dokumenttypen (weiterhin Sonnet 5) zu berühren.
- **Prompt-Obergrenzen weiter verschärft**: `MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT` 10 → 6,
  `MAX_SUMMARY_LENGTH_IN_PROMPT` 500 → 350, `MAX_FACTS_JSON_LENGTH_IN_PROMPT` 1000 → 700
  Zeichen — weitere Verkleinerung des Stufe-2-Prompts on top der bereits vorhandenen
  Massnahmen (SONSTIGES-Filter, Funde-Kompaktierung).

**Bewusst NICHT umgesetzt:** eine echte Batch-/Mehrfach-Synthese (Dokumente in Gruppen
aufteilen, Teilergebnisse deterministisch zusammenführen) — das wäre der einzige Hebel, der
die 60-Sekunden-Grenze für BELIEBIG viele Dokumente vollständig auflösen würde, ohne ein
Vercel-Upgrade. Bewusst zurückgestellt: das ist eine substanzielle Änderung an der
Kernlogik der Synthese (Zusammenführen von Kategorien/Widersprüchen/Feldvorschlägen aus
mehreren Teilergebnissen), die sich in dieser Sandbox ohne Live-Zugriff auf echte Dokumente
nicht Ende-zu-Ende verifizieren lässt — ein unentdeckter Fehler in der Zusammenführungslogik
wäre schwerer zu bemerken als ein sichtbarer Timeout und würde die Kernanforderung
"nichts wird erfunden" gefährden. Empfehlung an den Auftraggeber: falls die Synthese trotz
aller bisherigen Massnahmen weiterhin an sehr grossen Dokumentensets scheitert, ist das der
nächste sinnvolle Schritt — dann aber mit Rückmeldung aus einem konkreten Fehlschlag als
Testfall, statt blind entwickelt.

## Nachgezogen (2026-08-23): Übernehmen-Race löschte Felder, doppelte "Übernommen ✓"-Anzeige

Live-Test-Meldung: "felder werden gelöscht und wenn dann übernehmen geklickt, zeigt es
beide an als angenommen" (bei einem Widerspruch mit zwei Optionen, z.B. zwei konkurrierende
Erneuerungsfonds-Saldo-Werte, wurden beide gleichzeitig als übernommen markiert). Zwei
zusammenwirkende Ursachen, beide in dieser Sitzung behoben:

**1. Echte Race Condition in `apply-proposal/route.ts` (Datenverlust).** Die Route las
`properties.bestandsrendite`, wendete das Feld-Update in-memory an und schrieb das ganze
Objekt zurück — klassisches Read-Modify-Write ohne Nebenläufigkeitsschutz. Klickt der
Nutzer kurz hintereinander zwei "Übernehmen"-Buttons (z.B. zwei Widerspruchsoptionen oder
zwei verschiedene Feldvorschläge), lesen beide Requests denselben alten Stand; der zuletzt
abgeschlossene Schreibvorgang überschreibt den anderen komplett, der zuerst übernommene
Wert geht dabei kommentarlos verloren — genau das beobachtete "Felder werden gelöscht".
Behoben mit optimistischer Nebenläufigkeitskontrolle: die Route liest jetzt zusätzlich
`bestandsrendite_updated_at`, und die UPDATE-Query bedingt sich per `.eq(...)`/`.is(...)`
auf genau diesen zuvor gelesenen Wert plus `.select("id")`, um zu erkennen, ob die Zeile
tatsächlich getroffen wurde. Kein betroffener Row (0 Treffer) bedeutet: zwischenzeitlich
hat ein anderer Request bereits geschrieben — dann wird NICHT überschrieben, sondern 409
zurückgegeben, statt den fremden Schreibvorgang stillschweigend zu verwerfen.

**2. Anzeige-Bug in `DueDiligencePanel.tsx` (doppeltes "Übernommen ✓").** Der
`appliedFields`-State (aus dem vorigen Fix, siehe Eintrag oben) war nur nach `field`
benannt/geschlüsselt. Ein Widerspruch hat aber mehrere `options`, die sich alle dasselbe
`field` teilen — das Markieren EINER Option als übernommen markierte optisch ALLE
Geschwister-Optionen desselben Feldes gleich mit, unabhängig vom tatsächlich übernommenen
Wert. Behoben mit einem zusammengesetzten Schlüssel `` `${field}::${value}` ``
(`appliedFieldKey`) für sowohl `applying` als auch `appliedFields` — betrifft beide
Render-Stellen (Widerspruchs-Optionen und einfache Feldvorschläge). Zusätzlich als erste
Verteidigungslinie gegen die Race Condition selbst: alle Übernehmen-Buttons sind jetzt
global deaktiviert (`disabled={applying !== null}`), solange IRGENDEIN Übernehmen-Request
läuft, statt nur den einzeln angeklickten Button zu sperren — verhindert, dass der Nutzer
die Race Condition über die UI überhaupt erst auslösen kann (die serverseitige
Versionsprüfung bleibt als zweite Verteidigungslinie, z.B. bei zwei offenen Tabs).

## Nachgezogen (2026-08-23): Synthese-Netzwerkfehler trotz aller Prompt-Kürzungen weiterhin reproduzierbar — Haiku-4.5-Rückfalloption bei Sonnet-5-Zeitüberschreitung

Live-Test: trotz aller bisherigen Massnahmen (SONSTIGES-Filter, Funde-Kompaktierung,
Prompt-Längenkappung, Parallelisierung, Haiku-Routing für Stufe-1-Extraktion — siehe die
vier vorherigen Einträge) trat "Vorschläge aus den Dokumenten konnten nicht ermittelt
werden (Netzwerkfehler)" beim Neu-Erfassen-Flow erneut auf, diesmal mit sichtbarer
Nebenwirkung: da die Synthese nie zurückkam, blieben `docFieldProposals` leer und die
Bestandsrendite-Felder zeigten nur die generischen kantonsbasierten Default-Werte statt
der tatsächlich aus den Dokumenten stammenden Werte ("Felder werden auf ursprüngliche
Default-Werte gestellt").

Root Cause bestätigt: die Stufe-2-Synthese lief weiterhin ausschliesslich mit Sonnet 5
(`maxDuration = 60` bei `/api/properties/prefill-synthesis`, Vercel-Hobby-Limit), das bei
umfangreicheren Dokumentensets die Zeitgrenze reisst — ein einzelner LLM-Aufruf, dessen
Dauer sich mit den bisherigen Prompt-Kürzungen zwar verringert, aber nicht verlässlich
unter 60s gedrückt werden kann.

Fix in `synthesizeDueDiligence` (`dueDiligenceSynthesis.ts`): Sonnet 5 bekommt ein
Zeitbudget von 25s. Läuft das ab, wird NICHT weiter gewartet (der Sonnet-Request wird
per `AbortController` abgebrochen), sondern sofort ein zweiter Aufruf mit Haiku 4.5 —
exakt derselbe Prompt, dieselbe Werkzeug-Definition — im verbleibenden Zeitbudget
gestartet. Damit bleibt insgesamt genug Zeitreserve unter der 60-Sekunden-Grenze für
Vercels Function-Timeout. "Nichts wird erfunden" bleibt unverändert die Vorgabe, da
beide Modelle exakt dieselben Dokumente/Instruktionen bekommen — nur das Modell wechselt
auf eines mit geringerer Antwortzeit, wenn das primäre zu langsam ist. Als bewusster
Kompromiss: Haiku könnte bei sehr subtilen Widersprüchen/Risikoeinschätzungen etwas
weniger nuanciert sein als Sonnet 5 — im Vergleich zu einem kompletten Fehlschlag ohne
jeden Feldvorschlag ist das die klar bessere Alternative. Mit Vitest-Fake-Timern
getestet (`dueDiligenceSynthesis.test.ts`): Sonnet-5-Ergebnis wird verwendet, wenn es
rechtzeitig antwortet; bei simuliertem Hängenbleiben wird zuverlässig auf Haiku
gewechselt.

Bewusst NICHT (nochmals) angegangen: die eigentliche Batch-/Mehrfach-Synthese-Architektur
(siehe vorheriger Eintrag) — dieser Fix ist die risikoärmere, sofort wirksame
Zwischenlösung für denselben Symptomkomplex; falls Netzwerkfehler trotzdem weiter
auftreten (z.B. weil auch Haiku 4.5 bei sehr grossen Dokumentensets nicht mehr rechtzeitig
antwortet), bleibt die Batch-Synthese oder das Vercel-Pro-Upgrade der nächste Schritt.

## Nachgezogen (2026-08-23): Netzwerkfehler bei der Synthese abermals reproduziert — harte Dokumenten-Obergrenze im Prompt, Sonnet-Zeitbudget weiter verkürzt

Live-Test: derselbe "Netzwerkfehler" bei der Prefill-Synthese trat noch einmal auf,
diesmal mit deutlich sichtbarem Muster: die JSON-Antwort-Prüfung (`res.json()` in
`fetchJsonWithRetry`) schlägt fehl statt eine strukturierte Fehlermeldung zu liefern —
typisch für eine reine Vercel-Timeout-Fehlerseite (kein valides JSON), nicht für einen
regulären Anwendungsfehler. Das bedeutet: selbst mit der Haiku-4.5-Rückfalloption
(vorheriger Eintrag) hat der GESAMTE Funktionsaufruf (Sonnet-Versuch bis zum Zeitbudget +
anschliessender Haiku-Versuch) offenbar weiterhin die 60-Sekunden-Grenze gerissen — bei
diesem Dokumentenset reichte das verbleibende Zeitbudget für Haiku 4.5 also nicht.

Zwei weitere, bewusst risikoarme Verschärfungen in `dueDiligenceSynthesis.ts`:

1. **Harte Obergrenze `MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT = 8`** in
   `selectSynthesisPromptDocuments`: der SONSTIGES-Filter allein begrenzt nur den
   Dokument-TYP, nicht die Anzahl — bei vielen ZWINGEND/EMPFOHLEN-Dokumenten (z.B.
   mehrere STWEG-Protokolle über mehrere Jahre, mehrere Mietverträge) blieb die
   Prompt-Grösse weiterhin unbeschränkt und damit nicht verlässlich unter dem
   Zeitlimit kalkulierbar. Jetzt werden bei einem Überschuss die wichtigsten Dokumente
   nach Priorität aus dem Dokumenttyp-Katalog behalten (ZWINGEND vor EMPFOHLEN vor
   OPTIONAL), bei gleicher Priorität in Upload-Reihenfolge — macht die maximale
   Prompt-Grösse deterministisch, unabhängig davon, wie viele Dokumente ein Nutzer
   hochlädt. Ausgeschlossene Dokumente bleiben unverändert einzeln analysiert
   sichtbar/gespeichert, tragen nur nicht zur Cross-Dokument-Synthese bei.
2. **`SYNTHESIS_PRIMARY_TIMEOUT_MS` 25s → 15s**: gibt der Haiku-4.5-Rückfalloption mehr
   vom verbleibenden 60-Sekunden-Budget (statt bisher ~35s jetzt ~45s), da Sonnet 5 bei
   grossen Prompts selbst regelmässig bereits deutlich mehr als 15s braucht und die
   zusätzlichen 10s Wartezeit auf Sonnet dem Nutzer ohnehin selten zum Erfolg verhalfen.

Das ist jetzt der VIERTE Fix-Versuch für denselben Symptomkomplex (siehe die drei
vorherigen Einträge) — ein klares Signal, dass reine Prompt-Kürzung/Modell-Rückfalloptionen
an ihre Grenze stossen, wenn der Nutzer weiterhin sehr grosse Dokumentensets hochlädt.
Dieser Fix ist eine sinnvolle zusätzliche Absicherung, aber KEINE Garantie mehr — dem
Auftraggeber wurde explizit mitgeteilt, dass bei weiterem Auftreten die zwei
verbleibenden echten Lösungen (Vercel-Pro-Upgrade für ein höheres Zeitlimit, oder die
grössere Batch-/Mehrfach-Synthese-Architektur) anstehen, und dass er zwischen diesen
beiden wählen soll, statt weitere Prompt-Mikrooptimierungen abzuwarten.

## Nachgezogen (2026-08-23): "Alle Daten wieder verschwunden" bei kleinem Dokumentenset — ungeprüfter Fetch beim Bestandsrendite-Speichern gefunden

Live-Test mit nur 3 Dokumenten (Exposé + 2 STWEG-Protokolle) — bewusst klein gewählt, um
die Synthese-Zeitproblematik der letzten Einträge auszuschliessen. Analyse und Synthese
liefen sauber durch, aber nach dem finalen Klick auf "Bestandsrendite speichern" waren
alle Daten weg. Da diesmal kein Netzwerkfehler-Text zu sehen war, lag der Fehler woanders
als in den letzten Einträgen vermutet.

Root Cause gefunden beim erneuten Durchgehen von `PropertyCreateForm.tsx::handleSubmit`:
der Aufruf `POST /api/properties/[id]/bestandsrendite` (schreibt die eigentlichen
Bestandsrendite-Fakten) prüfte die Antwort NIE — anders als alle anderen Schreibaufrufe
in derselben Funktion (Objekt anlegen, Dokumente anhängen, Due-Diligence mitspeichern),
die das bereits in einer früheren Runde bekamen (siehe Eintrag "Zwei ernste Bugs beim
Speichern..."). Schlägt dieser eine Aufruf fehl (serverseitige Validierung oder ein
DB-Fehler), bemerkte das der Client nicht: er hängte trotzdem die Dokumente an, speicherte
die Synthese und leitete auf die Objektseite weiter — die dann mit leerem
`bestandsrendite` dastand, weil der eigentliche Schreibvorgang nie durchkam. Exakt das
beobachtete "alle Daten wieder verschwunden".

Fix: Antwort jetzt geprüft (`factsSaveBody.saved`); bei einem Fehlschlag wird NICHT
weitergemacht, sondern auf der Seite geblieben und eine konkrete Fehlermeldung gezeigt
("Objekt wurde bereits angelegt, aber die Bestandsrendite-Fakten konnten nicht
gespeichert werden … bitte nochmals klicken") — kein Datenverlust mehr, der Nutzer sieht
sofort, wenn dieser Schritt fehlschlägt, statt eines scheinbar erfolgreichen, aber leeren
Ergebnisses.

## Nachgezogen (2026-08-23): Wahrscheinlicher Hauptverdächtiger für "Daten verschwinden" gefunden — Schema-Mismatch bei der Hypotheken-Amortisation

Der vorherige Fix (Antwort beim Bestandsrendite-Speichern prüfen) zeigte sofort Wirkung:
statt eines stillen Fehlschlags erschien jetzt eine konkrete Fehlermeldung —
"hypothek.ersteHypothek.belehnungPercent/amortisationModus fehlt". Damit liess sich die
eigentliche Ursache erstmals sehen statt nur vermuten.

Root Cause: `parseBestandsrenditeFacts` (`bestandsrendite.ts`, serverseitige Validierung
beim Speichern) erwartete ein FLACHES Feld `ersteHypothek.amortisationModus` (und ebenso
`amortisationProzentProJahr`/`amortisationDauerJahre`). `buildBestandsrenditeFactsFromFormData`
(`bestandsrenditeFormParsing.ts`, baut den Request-Body aus dem Formular) sendet diese
Werte aber immer VERSCHACHTELT unter `ersteHypothek.amortisation.modus` — exakt der
kanonische `HypothekTrancheFacts`/`AmortisationSpec`-Typ aus
`@landfinder/financial-engine`, der überall sonst im Code (Engine, Anzeige) so verwendet
wird. Ein reiner Schema-Mismatch zwischen den beiden Funktionen: `ersteHypothek.amortisationModus`
existierte im tatsächlich gesendeten Payload schlicht nie, jede Speicherung von
Bestandsrendite-Fakten (egal ob im Neu-Erfassen-Flow oder auf der Objekt-Bearbeiten-Seite,
beide nutzen dieselbe `buildBestandsrenditeFactsFromFormData`) schlug dadurch IMMER mit
einem 400 fehl. Unentdeckt, weil die Antwort clientseitig bis zum vorherigen Fix nirgends
geprüft wurde — sehr wahrscheinlich die eigentliche Ursache hinter mehreren der in dieser
Sitzung gemeldeten "Felder sind leer"/"Daten verschwinden nach dem Speichern"-Symptome,
nicht nur beim jüngsten Fund.

Fix in `parseBestandsrenditeFacts`: liest jetzt korrekt aus `ersteHypothek.amortisation.modus`
(und `.prozentProJahr`/`.dauerJahre`) statt aus dem nie existierenden flachen Feld. Neuer
Regressionstest in `bestandsrenditeFormParsing.test.ts`, der `buildBestandsrenditeFactsFromFormData`
UND `parseBestandsrenditeFacts` zusammen (nicht mehr nur isoliert) durchspielt — genau
diese Lücke (beide Funktionen einzeln getestet, nie im Zusammenspiel) liess den Fehler
bisher unbemerkt durch alle Testläufe rutschen.

## Nachgezogen (2026-08-23): "Due-Diligence aktualisieren" tat nach frischem Upload nichts + Formel-Hovertexte für alle berechneten Werte

**1. "Due-Diligence aktualisieren" reagierte nach dem Hochladen weiterer Dokumente nicht
auf Klicks.** Der Button war `disabled={synthesizing || initialDocuments.length === 0}` —
`initialDocuments` ist aber eine serverseitige Momentaufnahme vom letzten Seitenaufbau.
`handleUpload` ruft nach Abschluss zwar `router.refresh()` auf, das ist in Next.js aber
grundsätzlich asynchron/Hintergrund (kein awaitbares Promise) — bis die aktualisierten
Daten beim Client ankommen, blieb der Button für den Nutzer sichtbar (und tastbar)
deaktiviert, ein Klick hatte dadurch buchstäblich keine Wirkung. Fix: neue abgeleitete
Grösse `hasAnyDocuments = initialDocuments.length > 0 || uploads.some(u => u.status ===
"DONE")` — berücksichtigt zusätzlich den lokalen `uploads`-Stand, der sofort nach
Abschluss eines Uploads bekannt ist, ohne auf die Server-Rundreise warten zu müssen.

**2. Formel-Hovertexte für berechnete Werte ergänzt.** Die Infrastruktur dafür gab es
bereits (`Metric`-Komponente mit `hint`-Prop → `InfoHint`, touch-/tastaturfreundliches
"ⓘ"-Symbol statt native `title` — auf Mobilgeräten ohne Hover ohnehin unbrauchbar), aber
nur 2 von 39 `<Metric>`-Kacheln in `BestandsrenditeAnalysisView.tsx` nutzten sie. Jetzt
mit der exakten Formel aus dem jeweiligen `@landfinder/financial-engine`-Code ergänzt für
praktisch alle berechneten Kacheln (Ebene A/B/C, Hypotheken, Break-even, Möblierungs-/
Renovations-ROI) sowie einige zusätzliche Zeilen im Cashflow-Wasserfall. Reine
Formel-Dokumentation, keine Änderung an den Berechnungen selbst.

## Nachgezogen (2026-08-23): "read documents failed" nach Migration-0004 — fehlende manuelle Datenbank-Migration, kein Code-Fehler

Live-Test nach dem letzten Fix: "Due-Diligence aktualisieren" liess sich zwar klicken
(Button-Fix aus dem vorherigen Eintrag griff), aber die Synthese schlug mit
"read documents failed" fehl — gleichzeitig zeigte "Hochgeladene Dokumente (0)" trotz
mehrerer bereits erfolgreich analysierter Dokumente.

Root Cause: KEIN Code-Fehler, sondern eine noch nicht angewendete Datenbank-Migration.
`0004_document_excluded_from_synthesis.sql` (fügt `property_documents.excluded_from_synthesis`
hinzu, für das "Von Synthese ausschliessen"-Feature) wurde am 2026-08-22 zum Repo
hinzugefügt — Migrationen in diesem Projekt laufen aber nicht automatisch (siehe
README "Erstinbetriebnahme"), sie müssen manuell im Supabase-SQL-Editor nachgezogen
werden. Beim Auftraggeber fehlte dieser eine Schritt noch:
- `getPropertyDocuments()` selektiert die (fehlende) Spalte mit und fängt den
  resultierenden DB-Fehler bereits ab, fällt aber still auf eine leere Liste zurück —
  daher "Hochgeladene Dokumente (0)" trotz erfolgreicher Uploads.
- Die Due-Diligence-Route filtert zusätzlich `.eq("excluded_from_synthesis", false)` und
  fängt den Fehler NICHT ab, sondern gibt ihn direkt als "read documents failed" zurück.

Fix: keine Code-Änderung — der Auftraggeber hat die Migration nachträglich manuell im
Supabase SQL-Editor ausgeführt (`alter table property_documents add column if not exists
excluded_from_synthesis boolean not null default false;`), danach funktionierte beides.
Für künftige Migrationen bleibt das Risiko bestehen (kein automatisierter
Migrations-Check beim Deploy) — als mögliche spätere Verbesserung: den spezifischen
Postgres-Fehlercode für "Spalte existiert nicht" (42703) erkennen und eine gezieltere
Fehlermeldung ("Migration noch nicht ausgeführt") statt des generischen "read failed"
zeigen. Bewusst nicht jetzt umgesetzt, da kein wiederkehrendes Problem, sondern ein
einmaliger Einrichtungsschritt.

## Nachgezogen (2026-08-23): NOI-Drill-down im Cashflow-Wasserfall

Wunsch aus dem Live-Test: die NOI-Zeile ("NOI (vor Finanzierung)") im
Cashflow-Wasserfall (Ebene B) per Aufklappen in ihre Bestandteile zerlegen können, statt
nur die eine Endzahl zu sehen.

`computeBestandsrenditeAnalysis` liefert neu `noiBreakdown` (potenzieller Jahresertrag,
Leerstand-/Auslastungsabzug, effektiver Jahresertrag, die vier Betriebskosten-Posten
einzeln, Betriebskosten total, NOI) — reine zusätzliche Aufschlüsselung derselben bereits
berechneten Grössen (`calculateJahresertrag`/`calculateBetriebskosten` aus
`@landfinder/financial-engine`, beide schon vorher intern von `calculateInvestmentCase`
verwendet), keine neue Berechnung. In `BestandsrenditeAnalysisView.tsx` als
`<details>`-Aufklapper direkt unter der NOI-Zeile — gleiches Muster wie der bereits
bestehende "Jahr-für-Jahr-Details anzeigen"-Aufklapper beim 15-Jahres-Modell, damit sich
das Interaktionsmuster konsistent anfühlt.

## Nachgezogen (2026-08-23): Parkplatz und Tiefgaragenplatz/Garage getrennt erfassbar

Wunsch: beim Kaufpreis zwischen "1.1 Kaufpreis Wohnung", "1.2 Kaufpreis Wohnung und
Parkplatz/Garage im Kombi", "2.1 Kaufpreis Parkplatz" und "2.2 Kaufpreis
Tiefgaragenplatz/Garage" unterscheiden können. Rückfrage geklärt: beide Parkierungsarten
sollen gleichzeitig erfassbar sein (ein Objekt kann z.B. einen offenen Parkplatz UND
einen separaten Garagenplatz haben), rechnerisch aber identisch behandelt werden — reine
Kategorisierung/Beschriftung, keine unterschiedliche Formel.

Umsetzung: `garagenplatzKaufpreisChf`/`garagenplatzImKaufpreisEnthalten` als neue,
zum bestehenden `parkplatzKaufpreisChf`/`parkplatzImKaufpreisEnthalten` PARALLELE Felder
ergänzt (bewusst nicht umbenannt/verschachtelt — bestehende gespeicherte Daten bleiben
unverändert gültig, kein Migrationsrisiko). Beide addieren sich unabhängig voneinander
zum Basis-Kaufpreis, sofern nicht jeweils per eigener Checkbox als "bereits im Kaufpreis
enthalten" markiert — deckt alle vier genannten Szenarien durch Kombination von
Betrag+Checkbox pro Parkierungsart ab, ohne dass "1.1/1.2/2.1/2.2" als eigene Felder
nötig wären. Neues `parkierung`-Feld im Analyse-Ergebnis (`parkplatzZusatzChf`/
`garagenplatzZusatzChf`/`totalZusatzChf`) für die Anzeige der Aufschlüsselung.

Sichtbar integriert an drei Stellen (zweiter, mündlicher Nachtrag zum ursprünglichen
Wunsch — "beim kaufpreis bitte parkplatz noch sinnvoll integrieren in dieser ansicht"):
- Objekt-Detailseite, oberste Kennzahlen-Kachel: "Kaufpreis" zeigt bei vorhandenen
  Bestandsrendite-Fakten neu den TOTALEN Kaufpreis inkl. Parkplatz/Garage (statt nur den
  Basis-Kaufpreis der Objekt-Basisdaten) mit Aufschlüsselung als Sub-Zeile.
- Ebene-A-Schnellcheck-Kachel "Kaufpreis (Wohnung + Parkplatz/Garage)": ebenfalls mit
  Aufschlüsselungs-Sub-Zeile, wenn Parkplatz/Garage zusätzlich dazugerechnet werden.
- Basis-Kaufpreis-Feld (Objekt-Basisdaten, sowohl Neu-Erfassen-Flow als auch
  Bearbeiten-Formular) umbenannt zu "Kaufpreis (CHF, Wohnung — ggf. inkl.
  Parkplatz/Garage, falls im Preis enthalten)" zur Klarstellung.

Auch die Dokumenten-KI-Extraktionsanleitung (`documentTypes.ts`) und die
Feldwert-Übernahmevorschläge (`bestandsrenditeKnownFields.ts`/`ALLOWED_UPDATE_FIELDS`)
kennen jetzt beide Schlüssel — ein aus Dokumenten erkannter Garagenplatz-Kaufpreis kann
genauso automatisch vorgeschlagen werden wie bisher schon der Parkplatz-Kaufpreis.

## Nachgezogen (2026-08-24): Feldwert-Übernahmevorschläge ablehnbar, mit Quelle als Hovertext

Wunsch: "die werte kann ich nur stehen lassen oder übernehmen - baue noch die funktion
ablehnen ein." — bisher gab es bei "Erkannte Werte zur Übernahme" nur "Übernehmen" oder
Ignorieren; ein ignorierter Vorschlag tauchte nach der nächsten "Due-Diligence
aktualisieren"-Synthese (die `fieldUpdateProposals` komplett neu aus den Dokumenten
generiert) unverändert wieder auf, auch wenn bewusst verworfen.

Umsetzung: neue Spalte `dismissed_field_proposals` (jsonb, Migration 0005) auf
`property_due_diligence` — dauerhaft je Objekt gespeicherte Liste abgelehnter
(Feld, Wert)-Paare. Neue Route `POST .../due-diligence/dismiss-proposal` hängt ein Paar
an, idempotent bei Doppelklick. `DueDiligencePanel` filtert beim Rendern alle Vorschläge
heraus, deren (Feld, Wert) in dieser Liste steht — sowohl die initial vom Server
geladenen als auch neu in der Sitzung abgelehnte (`dismissedFields`-State, analog zu
`appliedFields`). "Übernehmen" und "Ablehnen" teilen sich eine Button-Sperre während
eines laufenden Requests, damit keine zwei Aktionen auf demselben Vorschlag gleichzeitig
laufen.

Zusatzfrage beantwortet: "sollte bei den werten jeweils mit hover text zb die quelle
angegeben werden?" — ja, umgesetzt als `title`-Attribut auf der Vorschlagszeile
("Quelle: Dateiname, Seite X"), zusätzlich zum bereits vorhandenen sichtbaren Text
("— laut ..."), da der Quellentext bei langen Dateinamen auf schmalen Handybildschirmen
umbricht und ein Hover die Quelle auch ohne Scrollen/Umbruch nochmals kompakt zeigt.

## Nachgezogen (2026-08-24): Erneuerungsfonds-Gesamtsaldo und Wohnungsanteil als getrennte Felder

Hintergrund: beim Vergleich der Bollmoosweg-18-Analyse mit einer unabhängig erstellten
ChatGPT-Analyse (gleiche Unterlagen) fiel ein Feldwert-Übernahmevorschlag auf, der den
Erneuerungsfonds-GESAMTsaldo der STWEG (CHF 238'701.66) durch den nach Wertquote
anteiligen Betrag NUR der geprüften Wohnung (CHF 10'135.30) ersetzen wollte — beide
Beträge stehen im selben Kapital-/Zinsausweis-Dokument, die Stufe-2-Synthese (Cross-
Dokument-Vorschläge) kannte anders als die Stufe-1-Extraktion keine Warnung vor dieser
Verwechslung. Hätte der Nutzer "Übernehmen" geklickt, wäre der Fonds fälschlich als
23x kleiner erschienen, als er ist — ein stiller Datenkorruptions-Bug, kein Rechenfehler.

Umsetzung (strukturelle statt nur textuelle Korrektur, analog zum
Parkplatz/Garage-Muster): neues, zu `erneuerungsfondsSaldoChf` PARALLELES Feld
`erneuerungsfondsWohnungsanteilChf` in `StwegFacts` (packages/domain/src/stweg.ts) statt
nur einer Prompt-Ermahnung — verhindert strukturell, dass ein Wert den anderen je
überschreiben kann, unabhängig davon, ob ein zukünftiger Prompt die Warnung befolgt.
Beide Felder jetzt in `ALLOWED_UPDATE_FIELDS`/`BESTANDSRENDITE_KNOWN_FIELD_LABELS` mit
explizit disambiguierenden Labels ("GESAMT der STWEG" bzw. "NUR Anteil der geprüften
Wohnung, NICHT der Gesamtsaldo") — diese Labels erscheinen wortwörtlich im
Synthese-Prompt (`dueDiligenceSynthesis.ts::fieldsBlock`), wo der eigentliche Bug
auftrat. `documentTypes.ts::ERNEUERUNGSFONDS`-Extraktionsanleitung ebenfalls verschärft:
beide Beträge müssen künftig in ZWEI getrennte strukturierte Fakten, nie in denselben
Schlüssel. Neues Formularfeld "Erneuerungsfonds-Wohnungsanteil" in
`BestandsrenditeFactsFields.tsx`, bestehendes Feld zu "... (CHF, GESAMT der STWEG)"
umbenannt.

## Nachgezogen (2026-08-24): Kalkulatorischer Zinssatz-Default auf 1.5% gesenkt

Auf Wunsch ("zins: 1,5% als kalkulatorisch annehmen. bitte so einbauen.") den
Vorschlagswert für "Zinssatz (%, für beide Hypotheken)" im Bestandsrendite-Erfassungs-
formular von 2% auf 1.5% gesenkt (nur der Default für neue/noch nicht erfasste Objekte —
bereits erfasste Werte bleiben unverändert). Label um "kalkulatorisch" ergänzt, um klar
zu machen, dass es sich um eine bewusste Modellannahme handelt, nicht um einen konkreten
Hypothekarofferten-Zins.

## Nachgezogen (2026-08-24): "Value-Add — Möblierung" als 2 vollständige Szenarien neu aufgebaut

Wunsch: "'Value-Add — Möblierung' dieses thema bitte grundsätzlich neu aufbauen: ich
möchte zwei szenarien sehen: 1. ohne möblierung vermieten und möbliert vermieten. hierzu
gehören die kosten und erwartete miete. bitte bei der eingabe diese 2 szenarien sauber
als paket darstellen". Vorher war die Eingabe unklar strukturiert: eine einzelne
"Nettomiete Wohnung" (deren Rolle als unmöbliert/möbliert nicht explizit war) plus ein
separates "Möblierungs-Mietpremium"-Delta-Feld — und dieses Delta floss in
`calculateJahresertrag` IMMER in den Hauptertrag ein, unabhängig vom gewählten
"Vermietungsmodell" (Bug/Unklarheit: kein echtes Umschalten zwischen zwei Szenarien,
sondern ein Premium, das bei gesetztem Wert stets mitgerechnet wurde).

Eingabe (Formular) neu strukturiert als 2 klar benannte Pakete:
- **Paket 1 — unmöbliert**: bestehendes Feld "Nettomiete Wohnung" umbenannt zu
  "... — Paket 1: unmöbliert (CHF/Monat)", Kosten CHF 0 (impliziert, keine eigenen Felder
  nötig).
- **Paket 2 — möbliert**: neues Feld "Erwartete Miete möbliert (CHF/Monat)"
  (`moeblierteMieteChfPerMonth`, ABSOLUTER Wert statt Delta — passender zum Wunsch
  "hierzu gehören die Kosten und erwartete Miete" je Paket) direkt neben den bereits
  bestehenden Möblierungskosten-Feldern (Initialkosten/Nutzungsdauer/Ersatzquote/
  Kosteninflation). `buildBestandsrenditeFactsFromFormData` rechnet daraus weiterhin den
  intern gespeicherten Mietaufschlag (`mietPremiumChfPerMonth = max(0, möbliert −
  unmöbliert)`) — keine Schema-/API-Änderung nötig, die Rechenformeln (`calculateJahresertrag`
  & Co. in financial-engine) bleiben unverändert. Bekannte Einschränkung: da beide Felder
  unabhängige, unkontrollierte Inputs sind (kein Live-JS-Sync), zeigt das Möbliert-Feld
  beim Bearbeiten eines bestehenden Objekts den zuletzt gespeicherten Absolutwert
  (Basis+Aufschlag) — ändert man nur die unmöblierte Miete ohne die möblierte
  nachzuführen, verschiebt sich der daraus abgeleitete Aufschlag entsprechend. Wie bei
  den bereits bestehenden Hypothek-Feldpaaren im selben Formular als akzeptabler
  Kompromiss bewertet (kein controlled-Form-Umbau für dieses eine Feldpaar).

Ausgabe (`BestandsrenditeAnalysisView.tsx`, Sektion "Value-Add — Möblierung"): neue
Vergleichstabelle zeigt jetzt IMMER (nicht mehr nur wenn Möblierungskosten > 0) beide
Pakete nebeneinander — erwartete Miete, Kosten, effektiver Jahresertrag, Bruttorendite.
Neues `moeblierungsVergleich`-Feld im Analyse-Ergebnis (`bestandsrendite.ts`) rechnet
beide Szenarien vollständig durch (`calculateJahresertrag` je einmal mit
Möblierungsaufschlag 0 bzw. dem erfassten Aufschlag), nutzt denselben Leerstand-/
Auslastungsfaktor des aktiv gewählten Vermietungsmodells — nur der Möblierungsaufschlag
unterscheidet die beiden Szenarien. Bisherige ROI/Payback/Ersatzreserve-Kennzahlen
(Furniture ROI) bleiben als ergänzende Metriken unterhalb der neuen Tabelle erhalten.

## Nachgezogen (2026-08-24): Belehnungs-Default gesenkt, STWEG-Protokoll-/Jahresrechnungs-Extraktion um Zahlungsrückstände erweitert

Zwei kleine, unabhängige Folgekorrekturen aus dem ChatGPT-Vergleich (Bollmoosweg 18):

**Belehnungs-Default**: die Kombination aus 1. Hypothek (65%, unverändert) + 2. Hypothek
(bisher 15%) ergab einen impliziten Gesamt-Default von 80% — auf Wunsch ("belehnung auf
75% default setzen") die 2. Hypothek auf 10% gesenkt, ergibt neu 75% Gesamt-Default. Nur
der Formular-Default für neue Objekte, bestehende Werte unverändert.

**Fehlender Fund "Zahlungsrückstände eines Eigentümers"**: ChatGPTs unabhängige Analyse
fand diesen Punkt, meine Extraktion nicht — Ursache identifiziert: die
Extraktionsanleitungen für STWEG_PROTOKOLL und JAHRESRECHNUNG (documentTypes.ts) fragten
nie explizit nach offenen Debitoren/Zahlungsausständen einzelner Eigentümer, nur allgemein
nach "Konflikten" bzw. Kostenzusammensetzung — ein reines Prompt-Lücken-Problem, kein
Bug in der Verarbeitung selbst. Beide Anleitungen jetzt um eine explizite,
eigenständige Prüfung ergänzt ("wird erwähnt, dass ein Eigentümer im Rückstand ist?").
Zusätzlich STWEG_PROTOKOLL präzisiert: "Leitungen/Wasser" → "Wasserleitungen,
Elektro-/Stromleitungen", inkl. Hinweis, dass eine über den Erneuerungsfonds geplante
(noch nicht ausgeführte) Sanierung ebenfalls ein Fund ist. Kann nicht rückwirkend auf
bereits hochgeladene Dokumente wirken, ohne diese neu zu analysieren — für Bollmoosweg
würde "Neu analysieren" (pro Dokument, DueDiligencePanel) die verbesserte Anleitung
anwenden.

## Nachgezogen (2026-08-24): Verhandlungskorridor (Eröffnung/Ziel/Maximum)

Wunsch aus dem ChatGPT-Vergleich: ChatGPTs Analyse lieferte einen Verhandlungskorridor
(Eröffnungsangebot/Zielbereich/Maximum), HOME4efFINDER bisher nicht — "6. einbauen".

Bewusst NICHT als frei gewählte Prozentsätze vom Inseratspreis umgesetzt (das wäre
"erfunden" und nicht nachvollziehbar), sondern rechnerisch hergeleitet: neue Funktion
`computeVerhandlungskorridor` (bestandsrendite.ts) findet per Bisektion (wie die
bestehenden `breakEvenMieteChfPerMonth`/`breakEvenZinsPercent`) den Kaufpreis, bei dem
der bereits vorhandene "nachhaltige Cashflow" (Cashflow-Wasserfall) gerade CHF 0
erreicht — das ist das "Maximum". Ziel/Eröffnung sind Sicherheitsmargen darunter (neue
Parameter `verhandlungsmargeZielPercent`/`verhandlungsmargeEroeffnungPercent` in
BESTANDSRENDITE_PARAMETERS, Default 3%/7% — wie alle anderen Annahmen im Register
einsehbar/überschreibbar, ehrlich als Platzhalter gekennzeichnet statt versteckt in der
Formel).

Technisch bewusst als SEPARATE, eigene Funktion statt als Teil von
`computeBestandsrenditeAnalysis` — sie ruft `computeBestandsrenditeAnalysis` selbst
wiederholt mit unterschiedlichen Kaufpreisen auf (Bisektion), eine Einbettung in deren
eigenes Ergebnis hätte eine Rekursion erzeugt. Wird auf der Objektseite separat
berechnet und der Analyse-Ansicht als zusätzliche Prop übergeben. Neues Panel
"Verhandlungskorridor" direkt nach dem Schnellcheck.

## Nachgezogen (2026-08-24): Dokumenten-Dubletten-Erkennung

Wunsch: "auch die Dokumente auf dubletten überprüfen und wenn vorhanden, löschvorschlag
machen".

Umsetzung per SHA-256-Content-Hash der rohen Datei-Bytes, bewusst NICHT per
Dateinamen-Heuristik (z.B. "-1"-Suffix) — ein ähnlicher/gleicher Dateiname beweist keine
Inhaltsgleichheit (unterschiedliche Dokumente können zufällig ähnlich heissen), und
umgekehrt könnten unterschiedlich benannte Dateien zufällig denselben Inhalt haben. Nur
byte-exakte Duplikate zählen — keine falsch-positiven Löschvorschläge möglich.

Neue Spalte `content_hash` (Migration 0006) auf `property_documents`. Wird bei jedem
neuen Upload sofort berechnet (beide Upload-Routen: documents/route.ts und
documents/attach/route.ts). Neue Route `POST .../documents/detect-duplicates`: holt alle
Dokumente eines Objekts, berechnet für bereits VOR Migration 0006 hochgeladene Dokumente
den Hash nachträglich (Backfill — Download aus Storage, Hash, in DB speichern), gruppiert
danach nach Hash und liefert nur Gruppen mit >1 Dokument zurück, ältestes Dokument je
Gruppe zuerst (= Löschvorschlag betrifft die jüngeren Kopien).

UI: neuer Button "Auf Dubletten prüfen" bei den hochgeladenen Dokumenten (nur sichtbar ab
2 Dokumenten). Gefundene Gruppen zeigen das zu behaltende Original und pro Dublette einen
"Löschvorschlag: Löschen"-Button, der den bereits bestehenden Lösch-Endpoint
(`DELETE .../documents/[documentId]`) wiederverwendet — keine automatische Löschung,
immer eine explizite Nutzerbestätigung (`window.confirm`, bereits vorhandenes Verhalten).

## Nachgezogen (2026-08-24): Sprungmarken-Navigation auf der Objektseite

Wunsch: "oben navigation einbauen, damit auf die abschnitte direkt gesprungen werden
kann" — die Objektseite ist mit Bestandsrendite, Verhandlungskorridor, Value-Add und
Due-Diligence-Funden sehr lang geworden, gerade auf dem Handy bedeutete das viel
manuelles Scrollen.

Neue Komponente `ObjectSectionNav.tsx` — sticky Pillen-Reihe direkt unter dem
(auf Mobile fixed) Burger-Menü, horizontal scrollbar statt umzubrechen. Anker zu:
Objekt, Bestandsrendite (Schnellcheck), Verhandlungskorridor, Investment Case, Value-Add,
15-Jahres-Modell, Due Diligence. Nur Links zu Abschnitten, die auf der aktuellen Seite
tatsächlich existieren (z.B. kein Verhandlungskorridor-Link, wenn dafür keine
Bisektionslösung gefunden wurde, kein Bestandsrendite-Link ohne erfasste Fakten).

CSS: `.anchor-target { scroll-margin-top: … }` auf allen Sprungzielen, damit sie beim
Anspringen nicht unter der sticky Nav (und auf Mobile zusätzlich unter dem fixed
Burger-Menü) verschwinden — zwei unterschiedliche Werte für Desktop/Mobile, da dort die
Fixed-Elemente unterschiedlich hoch sind.

## Nachgezogen (2026-08-24): Ampelsystem für die Objektliste

Rückmeldung: "überlege, wo du mit einem ergänzenden ampelsystem eine einfache uebersicht
der bewertung machen kannst".

Analyse: auf der Objekt-Detailseite gab es faktisch schon ein Ampelsystem — der
Investment-Score-Chip nutzt bereits `tone` good/warn/bad (grün ≥70, gelb ≥40, sonst rot).
Die eigentliche Lücke war die **Objektliste** (Startseite `/`): dort gab es bislang gar
keine Einschätzung, nur Rohdaten (Adresse/Kaufpreis/Fläche) — man musste jedes Objekt
einzeln öffnen, um zu sehen, ob es sich lohnt, genauer hinzuschauen. Das ist der Ort mit
dem grössten Nutzen für eine Ampel: mehrere Objekte auf einen Blick vergleichen, statt
nacheinander zu öffnen.

Umsetzung: `scoreTone` aus der Objekt-Detailseite in `investmentScore.ts` verschoben
(Single Source of Truth, beide Seiten nutzen jetzt dieselbe Funktion). Neue erste Spalte
"Ampel" in der Objektliste — pro Zeile derselbe deterministische Investment-Score wie auf
der Detailseite (`computeInvestmentScore`), kompakt als farbiger Chip mit der Zahl (volle
Aufschlüsselung bleibt der Detailseite vorbehalten, hier bewusst "einfache Übersicht" wie
gewünscht). Grauer "–"-Chip, solange Bestandsrendite-Fakten und/oder Due-Diligence-
Synthese fehlen — ein Score ohne jede Grundlage wäre irreführend präzise für "noch nicht
geprüft".

## Nachgezogen (2026-08-24): Management Summary als One-Pager-PDF-Download

Wunsch: "ein zusätzliches management summary als one pager pdf erstellen zum download.
dieses soll auch bei der objektsicht ergänzt und aktualisiert werden wenn vorhanden."

Technologiewahl: `@react-pdf/renderer` (reines JS, `renderToBuffer`) statt HTML→PDF via
Headless-Browser (Puppeteer/Playwright) — Letzteres bräuchte auf Vercel serverless eine
separate schlanke Chromium-Distribution (`@sparticuz/chromium`) und mehr Konfiguration,
Ersteres läuft ohne Sonderaufwand in derselben Node-Runtime wie die übrigen API-Routen.

Bewusst KEIN Ausdruck der ganzen (langen) Detailseite, sondern eine eigens kuratierte
Auswahl der wichtigsten Punkte — das ist der Sinn eines "Management Summary": Adresse,
Investment-Score, Kennzahlen (Kaufpreis, Bruttorendite, Cash-on-Cash, nachhaltiger
Cashflow), Verhandlungskorridor, Due-Diligence-Status je Kategorie, fehlende
Pflichtdokumente, die fünf wichtigsten offenen Verkäuferfragen.

"aktualisiert werden wenn vorhanden": bewusst OHNE Speicherung/Caching gelöst — das PDF
wird bei jedem Download frisch aus den aktuell gespeicherten Daten gerendert
(`GET /api/properties/[id]/management-summary`), dadurch per Definition nie veraltet.
Ein gespeichertes/gecachtes PDF hätte eine Invalidierungslogik gebraucht (wann neu
generieren? nach jeder Due-Diligence-Synthese? nach jedem Fakten-Update?) — das wäre
deutlich mehr Komplexität für denselben Nutzen gewesen. Download-Link auf der
Objekt-Detailseite oben rechts neben "Objekt löschen", nur sichtbar wenn
Bestandsrendite-Fakten erfasst sind (sonst kein sinnvoller Inhalt).

## Nachgezogen (2026-08-24): Sprungmarken-Navigation echt fixiert + ohne horizontales Scrollen, "write failed" beim Objekt-Basisdaten-Speichern diagnostizierbar gemacht

Zwei Live-Test-Rückmeldungen zur eben gebauten Sprungmarken-Navigation und ein neu
beobachteter Speicherfehler:

**Sprungmarken-Navigation**: `position: sticky` hat sich in einer kontrollierten
Nachstellung (Playwright, echtes Scrollen statt nur Anker-Klick) korrekt verhalten —
liess sich aber nicht mit Sicherheit als tatsächliche Ursache der Live-Beobachtung
ausschliessen. Da die Rückmeldung explizit "vertikal fixiert" verlangte, auf Mobile
(≤980px) jetzt echtes `position: fixed` statt `sticky` — robuster als sticky, unabhängig
von Sticky-Kontext-Eigenheiten (z.B. Browser-Adressleisten-Ein-/Ausblenden). `.main`
bekommt entsprechend mehr Abstand oben (Burger + Nav-Höhe statt nur Burger), da ein fixed
Element den normalen Fluss verlässt und keinen Platz mehr reserviert. Desktop bleibt
`sticky` (dort bereits nachweislich korrekt, keine Fixed-Positionierungs-Fallstricke mit
der Seitenleiste nötig).

Zusätzlich: Labels gekürzt (z.B. "Bestandsrendite" → "Rendite", "Verhandlungskorridor" →
"Verhandlung") und `flex-wrap: wrap` auf Mobile statt Pflicht-Scroll — bei 7 gleichzeitig
sichtbaren Abschnitten reichten gekürzte Labels allein auf 390px nicht für eine Zeile
(gemessen: 592px benötigt vs. 390px verfügbar), mit Umbruch auf zwei Zeilen passt es ohne
horizontales Scrollen (Rückmeldung: "möglichst ohne horizontales Scrollen"). `.main`
bekommt grosszügig Platz für den Zwei-Zeilen-Worst-Case statt einer exakt berechneten
Höhe — etwas Leerraum bei weniger Abschnitten ist der kleinere Fehler gegenüber
verdecktem Seiteninhalt.

**"write failed" beim Speichern der Objekt-Basisdaten**: liess sich anhand des Codes
nicht abschliessend reproduzieren (Schema/RLS/Trigger unauffällig, andere Schreibzugriffe
auf `properties` funktionieren nachweislich). Statt zu raten: die Route gibt jetzt die
echte Postgres-Fehlermeldung zurück (`updateError.message`/`.code`) statt des generischen
"write failed" — Single-User-Tool ohne Mandantentrennung, kein Informationsleck an
Dritte. Zeigt beim nächsten Auftreten die tatsächliche Ursache, statt dass nur Zugriff
auf Server-Logs weiterhelfen würde.

## Nachgezogen (2026-08-24): Möbliert/Unmöbliert-Inkonsistenz behoben, Schattenrechnung an allen Ebenen (A/B/C) + PDF

Rückmeldung zur Live-Beobachtung fragte, "wo dieser Vergleich [möbliert/unmöbliert]
überall durchschlägt" — dabei kam ein echter Bug zum Vorschein: `calculateJahresertrag`
(Ebene B/C) hat den Möblierungsaufschlag/-kosten IMMER eingerechnet, sobald erfasst,
unabhängig vom gewählten `Vermietungsmodell`; `calculateSchnellcheck` (Ebene A) hatte
dafür gar keinen Parameter und hat ihn IMMER ausgeschlossen. Ebene A und Ebene B/C
konnten dadurch gleichzeitig unterschiedliche, inkonsistente Szenarien zeigen.

Per Nachfrage (AskUserQuestion) bestätigt: Das bestehende Feld `Vermietungsmodell`
steuert jetzt als einzige Quelle der Wahrheit ALLE Berechnungsebenen (Schnellcheck,
Investment Case, 15-Jahres-Modell, Verhandlungskorridor) — nur bei
`MITTELFRISTIG_MOEBLIERT` fliessen Möblierungsaufschlag/-kosten ein, sonst nicht.
Bewusst UNGEGATED bleiben `moeblierungsVergleich` (Value-Add-Vergleichstabelle),
`furnitureRoi` und `moeblierungReserveChfPerJahr` — das sind explizit
szenario-unabhängige "was-wäre-wenn"-Kennzahlen, kein Teil der Hauptberechnung.

Zusätzlich, ebenfalls per Nachfrage bestätigt ("An allen Ebenen (A/B/C) + PDF"): eine
kompakte Schattenrechnung des jeweils anderen Szenarios (`computeMoeblierungsAlternative`)
wird als grauer `sub`-Hinweis unter 6 Kennzahlen angezeigt (Bruttorendite Schnellcheck,
Verhandlungskorridor-Maximum, Bruttorendite/Cash-on-Cash Investment Case, Levered IRR/
Equity Multiple 15-Jahres-Modell) sowie im PDF-Management-Summary (Bruttorendite,
Cash-on-Cash, Verhandlungskorridor-Maximum) — keine grosse zweite Vergleichsspalte, um
die Übersicht nicht zu überladen, aber das jeweilige Alternativ-Szenario bleibt auf einen
Blick sichtbar ("das andere Alternativszenario als Schattenrechnung auf dem High-Level-
Ergebnis anzeigen").

## Nachgezogen (2026-08-24): Paket 1/2 in der Erfassungsmaske strukturell symmetrisch gestaltet

Rückmeldung: Paket 2 (möbliert) sei "im Grundsatz gut", Paket 1 (unmöbliert) habe noch
"Verbesserungspotenzial betreffs Übersichtlichkeit und Logik" — bisher sass das Feld
"Nettomiete Wohnung — Paket 1: unmöbliert" oben im allgemeinen Abschnitt "Miete &amp;
Vermietungsmodell", während Paket 2 weiter unten einen eigenen, klar abgegrenzten Block
mit eigener Überschrift hatte. Paket 1 existierte optisch nur als Fussnote in einem
Erklärtext ("Miete siehe 'Nettomiete Wohnung' oben, Kosten CHF 0"), nicht als eigener
Block wie Paket 2.

Jetzt identisch strukturiert: "Miete &amp; Vermietungsmodell" enthält nur noch, was für
BEIDE Pakete gilt (Parkplatzmiete, sonstige Einnahmen, Vermietungsmodell-Auswahl,
Leerstand/Auslastung) — mit eigener Überschrift "gemeinsame Angaben (gelten für Paket 1
und 2)". Im Abschnitt "Value-Add — Möblierung" folgen jetzt zwei gleich aufgebaute
Blöcke: "Paket 1 — unmöbliert vermieten" (Nettomiete-Feld hierher verschoben, plus
"Zusatzkosten: CHF 0" als Pendant zu Paket 2s Kostenfeldern) und unverändert "Paket 2 —
möbliert vermieten". Feldname/-id von `wohnungsMieteChfPerMonth` unverändert — reine
Anordnung, kein Eingriff in Speicherformat oder Berechnung.

## Nachgezogen (2026-08-24): "Annahmen"-Reiter (globale, überschreibbare Parameter) + Ampel bei Soll-Abweichung

Rückmeldung: "einen Reiter machen, welcher alle Variablen enthält wie zB Belehnungshöhe,
Zins, Brutto- und Nettorenditeziele etc. — diese Werte sollen da auch anpassbar sein und
entsprechend für die Berechnungen gezogen werden." Genau das war bereits im Kommentar zu
`BESTANDSRENDITE_PARAMETERS` (parameters.ts) als künftiges Ziel angelegt — jetzt gebaut:

- Neue Migration 0007 (`app_settings`, `key text primary key, value numeric`) speichert
  Überschreibungen einzelner Registry-Parameter — global für alle Objekte. Fehlt ein
  Schlüssel, gilt unverändert der Registry-Default.
- `computeBestandsrenditeAnalysis`/`computeVerhandlungskorridor`/
  `computeMoeblierungsAlternative` (bestandsrendite.ts) nehmen jetzt einen optionalen
  dritten Parameter `parameterOverrides` entgegen und verwenden ihn statt der reinen
  Registry-Defaults für JEDE Berechnung — nicht nur für die Anzeige. Alle Aufrufstellen
  (Objektseite, Vergleich, Objektliste/Ampel, Management-Summary-PDF) laden die
  Überschreibungen serverseitig und reichen sie durch.
- Neu in der Registry (packages/financial-engine/src/parameters.ts): Belehnung-
  Vorschlagswerte für 1./2. Hypothek und Zinssatz-Vorschlagswert (bisher als feste
  Zahlen 65/10/1.5 direkt im Formular verdrahtet, jetzt zentral) sowie Brutto-/
  Nettorendite-Ziel (neu, reine Referenzwerte).
- Neuer Reiter `/annahmen` (`AnnahmenForm.tsx`) listet ALLE ~22 Registry-Parameter
  gruppiert nach Thema, mit aktuellem Wert (Standard oder Überschreibung), editierbar;
  leer gelassen + gespeichert setzt zurück auf den Registry-Default.

Zusätzlich, aus derselben Rückmeldung: "die ampel auch auf der objektdetailseite
einbauen, überall dort, wo werte und/oder informationen vom soll abweichen." Neue
Funktion `renditeAmpelColor` (investmentScore.ts) färbt Bruttorendite (Schnellcheck +
Investment Case) und Nettorendite (Investment Case) grün/gelb/rot relativ zum
gespeicherten Renditeziel — rein informativ per `valueColor`/`sub`-Hinweis auf den
bestehenden `Metric`-Komponenten, ohne die Werte selbst oder die (unveränderte)
Investment-Score-Formel zu beeinflussen (per Rückfrage bestätigt: reiner
Referenzwert-Vergleich, kein Eingriff in die Ampel-Score-Berechnung). Der
Gesamt-Investment-Score-Chip war bereits vorher auf der Objektdetailseite vorhanden
(sichtbar nur, sobald eine Due-Diligence-Synthese gelaufen ist).

## Nachgezogen (2026-08-24): Sammel-Fixes aus dem zweiten Live-Test-Durchgang

Sieben Rückmeldungen aus einem weiteren Live-Test-Durchgang, alle in einer PR gebündelt:

1. **"Miete vor Renovation" als Doppelerfassung**: fiel bisher als eigenes Pflichtfeld
   an, obwohl es in der Praxis fast immer identisch mit der bereits oben erfassten
   "Nettomiete Wohnung" ist. Fällt jetzt, wenn nicht explizit abweichend erfasst, auf
   diesen Wert zurück (`mieteVorRenovationChfPerMonth ?? wohnungsMieteChfPerMonth`) —
   weiterhin überschreibbar für den Sonderfall einer unter Marktniveau liegenden
   Altmiete.

2. **Verhandlungskorridor — Zielpreis/Eröffnung waren beide erfundene Sicherheitsmargen
   vom Maximum**: Rückmeldung "zielpreis soll mit der Zielrendite hergeleitet werden
   und der eröffnungspreis vom markt her (research) bestimmt". Zielpreis wird jetzt
   algebraisch aus dem gespeicherten Bruttorendite-Ziel (Annahmen-Reiter) hergeleitet
   (Kaufpreis, bei dem Jahresnettomiete ÷ Kaufpreis = Zielrendite), gedeckelt auf das
   Maximum. Eröffnungsangebot ist jetzt ein neues, rein manuelles Feld
   (`eroeffnungsangebotChf`, Abschnitt "Verhandlung" im Erfassungsformular) — die
   eigene, recherchierte Markteinschätzung statt einer erfundenen Prozentzahl. Die
   dadurch obsoleten Parameter `verhandlungsmargeZielPercent`/
   `verhandlungsmargeEroeffnungPercent` aus der Registry entfernt.

3. **Eigenkapitalbedarf/Eigenkapital ohne sichtbare Herleitung**: beide Metriken zeigen
   jetzt als kleine Sub-Zeile die tatsächlichen CHF-Bestandteile (z.B. "= CHF 425'000 −
   CHF 296'250 (Hypothek) + CHF 12'750 (Nebenkosten)") statt nur eine Formel im
   Hover-Hinweis, der auf dem Handy nicht sichtbar ist.

4. **CHF und Zahl brachen auf dem Handy in zwei Zeilen um**: `.metric .v` bekommt auf
   Mobile `white-space: nowrap` (mit `text-overflow: ellipsis` als Fallback für
   seltene, sehr lange Werte) plus `minmax(0, 1fr)` auf `.metricgrid`, damit die
   Spalten dabei nicht über den Bildschirmrand hinauswachsen (dieselbe Lehre wie beim
   Sprungmarken-Navigation-Fix: `1fr` allein reicht nicht, `minmax(0, 1fr)` schon).

5. **Widerspruchs-Optionen: "übernimmt beide"** und
6. **Übernommene Vorschläge erscheinen nach Reload wieder aktiv**: beide Symptome
   derselben Ursache — `appliedFields` war ein rein client-seitiger, nie
   persistierter React-Zustand, der bei jedem Neuladen leer startete. Neue Lösung:
   `isProposalAlreadyApplied` (bestandsrendite.ts) vergleicht den TATSÄCHLICH
   gespeicherten Feldwert mit dem Vorschlag — serverseitig auf der Objektseite für
   jeden Vorschlag/jede Widerspruchs-Option berechnet und als
   `alreadyAppliedProposalKeys` an `DueDiligencePanel` durchgereicht. Das behebt
   beides zugleich: bleibt über jeden Reload korrekt (da aus echten Daten
   hergeleitet, nicht aus flüchtigem State) und löst die Widerspruchs-Optionen
   sauber im Entweder-oder-Sinn auf (nur die Option, deren Wert wirklich im Feld
   steht, gilt als übernommen — stimmen zwei Quellen zufällig überein, gelten
   beide korrekterweise als erfüllt, das ist kein Bug).

7. **PDF-One-Pager mit zu wenig Finanzdetails**: neue Abschnitte "Investment Case
   (Ebene B)" (All-in-Investition, Bruttorendite All-in, Nettorendite vor
   Finanzierung, Eigenkapital, NOI, 1./2. Hypothek, Cashflow-Wasserfall-Zwischenschritte)
   und "15-Jahres-Modell (Ebene C)" (Levered/Unlevered IRR, Equity Multiple, Exit-Erlös,
   kumulierter Cashflow) ergänzt. Ausserdem Wohnfläche (m²) als Sub-Zeile bei Preis/m²
   ergänzt.

## Nachgezogen (2026-08-24): Veraltete "Übernommen ✓"-Markierung bei Widerspruchs-Optionen bereinigt

Selbst-Review des letzten Sammel-Fixes (PR #50) per Subagent fand einen echten, aber
schmalen Nachfolgebug in dessen eigener Lösung: `appliedFields` (der client-seitige,
optimistische Zustand für sofortiges "Übernommen ✓"-Feedback) wurde nur ERGÄNZT, nie
bereinigt. Wählt man bei einem Widerspruch zuerst Option A, dann später Option B
für DASSELBE Feld, blieb Option A optisch weiter als "Übernommen ✓" markiert — obwohl
der tatsächlich gespeicherte Wert (und der aus den echten Daten hergeleitete
`groundTruthAppliedKeys`, siehe letzter Eintrag) längst B ist. Erst ein vollständiges
Neuladen der Seite (nicht nur `router.refresh()`) korrigierte das wieder.

Fix: `handleApplyProposal` entfernt jetzt vor dem Hinzufügen des neuen Schlüssels alle
anderen optimistischen Einträge DESSELBEN Feldes aus `appliedFields`
(`!k.startsWith(\`${field}::\`)`) — pro Feld bleibt im optimistischen Zustand immer
höchstens ein "Übernommen ✓" gleichzeitig sichtbar, konsistent mit der
Entweder-oder-Semantik der eigentlichen Datenhaltung.

Zusätzlich, per Live-Test-Rückmeldung: "CHF 500/Jahr" wurde durch das neue
Mobile-`nowrap`+`ellipsis` (siehe vorheriger Eintrag) auf schmalen Bildschirmen zu
"CHF 500/Ja…" abgeschnitten. Statt die Kennzahlen-Box noch enger zu kürzen: die
Einheit selbst gekürzt — "/Jahr" → "p.a." an allen drei betroffenen Stellen
(Geglättete Ersatzreserve, Amortisation 1./2. Hypothek in `BestandsrenditeAnalysisView.tsx`).
Reine Anzeige, keine Formularlabels betroffen (die stehen in mehrzeiligen `<label>`s,
nicht im schmalen `.metric .v`, und sind von der Kürzung nicht betroffen).

## Nachgezogen (2026-08-24): Tiefe Review-Runde — 10 Punkte aus drei parallelen Subagent-Reviews

Auf explizite Anfrage ("überprüfe tief, was noch zu verbessern ist" → "alles bitte
umsetzen") liefen drei parallele Review-Subagenten je über einen Ausschnitt der App
(Finanz-Engine-Korrektheit / UI-UX-Konsistenz / Daten-API-Sicherheit), ohne
Live-Verifikation (keine Supabase-Credentials in dieser Remote-Session — Absicherung
ausschliesslich über `vitest`/`lint`/`build` sowie für das PDF zusätzlich per
temporärem `vitest`-Test → `pdftoppm` → Bildkontrolle). Alle 10 gefundenen Punkte
umgesetzt:

1. **`sonstigeEinnahmenChfPerYear` fehlte im Schnellcheck**: floss in Ebene B/C (via
   `JahresertragInput.sonstigeEinnahmenChfPerYear`) ein, aber nicht in Ebene A
   (`calculateSchnellcheck`) — dasselbe Objekt zeigte je nach Ebene unterschiedliche
   Bruttorendite-Zahlen. `SchnellcheckInput` um das Feld ergänzt, am App-seitigen
   Aufrufer verdrahtet, Regressionstest ergänzt (`bestandsrendite.test.ts`,
   Financial-Engine-Paket).
2. **Möblierungsvergleich nutzte einen einzigen Leerstand-Default für beide
   Szenarien**: `moeblierungsVergleich` (Schattenrechnung unmöbliert vs. möbliert)
   verwendete für BEIDE Szenarien denselben Leerstand-Prozentsatz des jeweils AKTIV
   gewählten Vermietungsmodells — obwohl `BESTANDSRENDITE_PARAMETERS` bewusst
   unterschiedliche Defaults für langfristig-unmöbliert (2%) und
   mittelfristig-möbliert (6%) vorsieht. Jetzt verwendet jedes Szenario seinen
   EIGENEN Default (nur wenn kein manueller Override erfasst ist; ohne Effekt bei
   SHORT_STAY).
3. **Belehnung > 100% ohne Warnung**: eine Eingabe, bei der 1./2. Hypothek zusammen
   über 100% Belehnung ergeben, liess Eigenkapitalbedarf rechnerisch negativ werden
   und Cash-on-Cash unauffällig auf 0.00% fallen — sah wie ein echtes Ergebnis aus,
   war aber ein Eingabefehler. Neue `assumptionNotes`-Warnung ab > 100%.
4. **Cash-on-Cash bei Eigenkapital ≤ 0 zeigte irreführend "0.00%"**: jetzt "n/a" mit
   erklärendem Sub-Text statt einer Zahl, die einen echten (schlechten, aber
   endlichen) Wert vortäuscht.
5. **`num()`-Parser akzeptierte `NaN`/`Infinity`**: `parseBestandsrenditeFacts` prüfte
   nur `typeof v === "number"`, nicht `Number.isFinite(v)` — ein durchgerutschter
   `NaN`/`Infinity`-Wert hätte sich unbemerkt durch alle Berechnungen gezogen. Jetzt
   mit `Number.isFinite`-Guard.
6. **Race Condition beim Vorschlag-Ablehnen**: `dismiss-proposal` hatte (anders als
   `apply-proposal`) keine optimistische Nebenläufigkeitskontrolle — bei zwei
   nahezu gleichzeitigen Schreibvorgängen konnte eine Ablehnung kommentarlos
   verloren gehen. Jetzt analog zu `apply-proposal`: bedingtes Update auf den
   gelesenen `dismissed_field_proposals`-Wert, 409 bei erkanntem Konflikt.
7. **`apply-proposal` akzeptierte nicht-numerische Strings ungeprüft**: `newValue`
   darf laut Tool-Schema `string | number` sein, alle aktuell erlaubten Zielfelder
   sind aber numerisch — ein nicht-numerischer String wäre unverändert in ein
   Zahlenfeld geschrieben worden und hätte jede nachgelagerte Berechnung
   stillschweigend zu `NaN` werden lassen. Jetzt mit `Number.isFinite`-Validierung
   vor dem Schreiben (400 bei ungültigem Wert).
8. **Generische `"write failed"`-Fehlermeldungen**: vier API-Routen
   (`bestandsrendite`, `due-diligence/save-prefilled`, `due-diligence/apply-proposal`,
   `due-diligence/dismiss-proposal`) gaben bei einem fehlgeschlagenen Schreibvorgang
   nur `"write failed"` zurück statt der echten Postgres-Fehlermeldung — ohne Zugriff
   auf die Server-Logs war ein fehlgeschlagenes Speichern nicht diagnostizierbar. Auf
   dasselbe Muster wie `properties/[id]/route.ts` vereinheitlicht (Single-User-Tool
   ohne Mandantentrennung, kein Informationsleck an Dritte).
9. **Objektliste/Vergleichsseite ohne Mobile-Absicherung**: die Objektliste
   (`app/page.tsx`) hatte ihre `<table>` nicht in `.twrap` (das bereits global
   existierende `overflow-x: auto`-Muster) gewrappt — auf schmalen Bildschirmen lief
   die Tabelle über den Viewport hinaus statt sauber zu scrollen. Die
   Vergleichsseite (`app/vergleich/page.tsx`) nutzte ein Inline-Grid
   (`gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1fr 1.3fr"`) ohne `minmax(0, ...)` —
   feste `fr`-Spalten ohne `minmax(0, ...)` können breiter werden als ihr Anteil,
   wenn der Inhalt (lange Adressen, "CHF 1'234'567") nicht umbricht, was zu
   horizontalem Überlaufen statt Zeilenumbruch führte. Beides behoben: Objektliste
   in `.twrap`; Vergleichszeile in neue CSS-Klasse `.compare-row-summary`
   extrahiert (mit `minmax(0, ...)` auf allen Spalten) plus Mobile-Media-Query
   (≤980px: zwei statt sechs Spalten).
10. **Weitere Metrik-Sub-Texte/Kürzungen für Mobile**: "Grober Cashflow" bekam
    (analog zu Eigenkapitalbedarf/Eigenkapital) einen Herleitungs-Sub-Text
    ("= Miete − Kosten − Zins", neues `schnellcheckKostenBreakdown`-Feld am
    Analyse-Ergebnis). "Break-even-Miete" von "/Monat" auf "/Mt." gekürzt
    (dieselbe Abschneide-Gefahr wie beim vorherigen "/Jahr"→"p.a."-Fix). Zusätzlich,
    da bereits am selben Renditeziel-Mechanismus gearbeitet wurde: der PDF-One-Pager
    zeigt jetzt dieselbe Ziel-Ampel (grün/gelb/rot relativ zum gespeicherten
    Renditeziel aus dem Annahmen-Reiter) wie die Objektseite bei Bruttorendite,
    Bruttorendite All-in und Nettorendite vor Finanzierung, inkl. "Ziel: X%"-Text
    (`ManagementSummaryInput` um `bruttoRenditeZielPercent`/`nettoRenditeZielPercent`
    ergänzt, von der Route aus `effectiveParams` befüllt — analog zum bestehenden
    Muster auf der Objektseite).

## Nachgezogen (2026-08-24): PDF-One-Pager lief auf 2 Seiten über — Layout verdichtet

Live-Test-Rückmeldung mit angehängtem PDF: "es soll auf einer Seite Platz haben, ohne
dass du Inhalte weglässt." Nach der letzten Erweiterung (7 zusätzliche
Investment-Case-/15-Jahres-Modell-Kennzahlen plus Ziel-Ampel, siehe vorherige zwei
Einträge) lief der One-Pager bei einem typischen, gut befüllten Objekt (9
Due-Diligence-Kategorien, mehrere fehlende Pflichtdokumente, 5 offene Fragen an
Verkäufer/Makler) auf eine zweite Seite über — praktisch nur mit der letzten
Fragen-Liste, der Rest der Seite blieb leer.

Fix: reine Layout-Verdichtung in `managementSummaryPdf.tsx`, keine Kürzung von
Inhalten — Seitenrand 32→26pt, Basis-Schriftgrösse 9→8.5pt, `sectionTitle`
marginTop 12→7pt/marginBottom 5→3pt, `metric`-Zeilen marginBottom 8→5pt,
`metricLabel`/`metricValue`/`metricSub` je ca. 1pt kleiner, `categoryRow`/`listItem`
marginBottom leicht reduziert, Fusszeile kompakter. Mit einer Fixture, die dieselbe
Grössenordnung an Inhalt wie das gemeldete Beispiel abbildet (9 Kategorien, 2 fehlende
Dokumente, 5 Fragen, mehrzeilige `overallSummary`), per temporärem `vitest`-Test →
`pdftoppm` → Bildkontrolle verifiziert: jetzt 1 Seite (vorher 2), noch mit spürbarem
Weissraum am unteren Rand als Puffer für etwas umfangreichere Objekte. Eine harte
Ein-Seiten-Garantie ist bei variabler Anzahl offener Fragen/fehlender Dokumente und
KI-generierter `overallSummary`-Länge nicht möglich, ohne echte Inhalte zu kürzen —
das war explizit nicht gewünscht.

## Neu (2026-08-24): Regionen-Marktdaten (Wüest-Partner-Standortreports) — Fundament (PR A)

Nutzer besitzt zusätzlich zu den objektspezifischen Dokumenten (STWEG-Protokoll,
Mietvertrag etc.) Marktreports auf Gemeinde-/Regionsebene (Beispiel: Wüest Partner
"Standortinformation" für Wohlen AG — Miet-/Kaufpreis-Quantile je Zimmerzahl,
Preisindizes, Bevölkerung, Mobilität, Steuern, Immobilienbestand, Bautätigkeit,
Leerstand/Marktliquidität, Makrolagenbeschreibung). Anders als Objektdokumente sind
diese Reports NICHT objektspezifisch, sondern für alle Objekte in derselben Gemeinde
relevant — sollen deshalb einmal pro Gemeinde hochgeladen und wiederverwendet werden,
nicht pro Objekt neu.

**Bewusste Zwei-PR-Sequenzierung**: dieser Eintrag deckt nur PR A (Fundament: Upload,
Extraktion, Anzeige) ab. Die Regionswerte fliessen NOCH NICHT in die
Finanzberechnung (Leerstand-/Wertsteigerungs-Defaults) ein — das ist bewusst
zurückgestellt (PR B), bis die Extraktionsqualität am echten Report bestätigt ist.
Fehlextraktion in dieser ersten Version bleibt damit rein informativ sichtbar, statt
still falsche Renditezahlen zu erzeugen.

Neues Datenmodell (Migration `0008_regions.sql`): `regions` (Kanton+Gemeinde,
`unique (canton, gemeinde_normalized)` — Kanton+Gemeinde als Composite-Key, weil
mehrere Schweizer Gemeinden denselben Namen in unterschiedlichen Kantonen tragen, z.B.
Wohlen AG vs. Wohlen bei Bern BE) + `region_documents` (Storage-Bucket
`region-documents`, `content_hash`-Unique-Index PRO Region — verhindert einen zweiten
Claude-Aufruf beim wiederholten Upload desselben Reports, PROAKTIV beim Upload geprüft
statt erst nachträglich wie bei Objektdokumenten, weil sich ein Regionsreport-Upload
in der Praxis tatsächlich wiederholt: mehrere Objekte in derselben Gemeinde, derselbe
Report erneut hochgeladen). `properties.gemeinde` NEU, aber bewusst OHNE
Fremdschlüssel zu `regions` — die Verknüpfung erfolgt zur Laufzeit über einen
Kanton+Gemeinde-Text-Match (`getRegionByCantonGemeinde`/`getRegionMarketData` in
regionMarketData.ts), damit sie robust bleibt, auch wenn eine Region erst nach dem
Objekt angelegt oder das Gemeinde-Feld später korrigiert wird.

`properties.gemeinde` wird beim Erfassen/Bearbeiten eines Objekts per Regex
(`guessGemeindeFromAddress`, PLZ+Ortsname am Ende der Adresse) aus `address_text`
vorbefüllt, sobald sich die Adresse ändert — SOLANGE der Nutzer das Gemeinde-Feld nicht
bereits selbst angefasst hat (kein stilles Überschreiben einer bewussten Korrektur).
`address_text` ist in dieser App bewusst unstrukturierter Freitext ohne Formatvorgabe
— die Regex ist deshalb nur ein Vorschlag, das Feld bleibt immer frei editierbar,
konsistent mit dem "nichts wird stillschweigend festgelegt"-Prinzip der App.

Neue Extraktion (`regionExtraction.ts`, `extractRegionReport`) spiegelt
`dueDiligenceExtraction.ts`, aber schlanker (ein einziger Report-"Typ", kein
Dokumenttyp-Katalog, kein Due-Diligence-Findings-Schema). Extrahiert bewusst NUR die
Gemeinde-Spalte, nicht die im Report zusätzlich vorhandenen MS-Region-/Kanton-/
Schweiz-Vergleichsspalten — die App vergleicht ein Objekt gegen seine eigene Gemeinde.
`maxDuration` für die Upload-Route auf 120s gesetzt (statt 60s wie bei
Objektdokumenten) — ein 90-seitiger Report kann bei der Extraktion länger brauchen als
ein typisches 5-20-seitiges STWEG-Protokoll; reicht das in der Praxis nicht, braucht es
einen asynchronen Job statt synchroner Extraktion beim Upload (nicht Teil dieses PRs).

Neues Markteinordnungs-Panel auf der Objektseite (`MarktEinordnungView.tsx`): zeigt,
wo die erfasste Nettomiete/m²/Jahr und der Kaufpreis/m² des Objekts innerhalb der
10/30/50/70/90%-Quantile seiner Gemeinde liegen (lineare Interpolation zwischen den
Quantilpunkten, `estimateQuantilePosition` in regionMarketData.ts — Werte ausserhalb
10-90% werden bewusst NICHT extrapoliert, sondern nur als "< 10%-Quantil"/
"> 90%-Quantil" gekennzeichnet, um keine unplausibel präzise Zahl vorzutäuschen), plus
Kontextkennzahlen (Leerstand, Preis-/Bevölkerungstrend). Rein informativ, nur
sichtbar, wenn eine Region mit erfolgreich analysiertem Report für die Gemeinde des
Objekts existiert.

**Update (2026-08-25, nach dem Upload-Fix unten)**: der Nutzer hat den echten
Wohlen-Report erfolgreich live hochgeladen und analysiert. Extraktion gegen das
Original gegengeprüft — alle Kennzahlen (Bevölkerung 17'816, Haushalte 7'490,
Leerstand MFH 1.8%, Angebotsquote 3.0%, Preis-/Mietveränderungen 3J, Steuerbelastung,
Bestandszahlen) UND die vollständigen Quantiltabellen (Mietwohnungen/
Eigentumswohnungen/Einfamilienhäuser je Zimmerzahl) stimmen exakt mit dem Original
überein. Die zuvor offene Einschränkung ("nicht live getestet, da kein
ANTHROPIC_API_KEY in dieser Remote-Session") ist damit erledigt — die Extraktion ist
verifiziert korrekt, PR B (Regionswerte in die Finanzberechnung) kann angegangen
werden, sobald gewünscht.

## Nachgezogen (2026-08-25): Regionsreport-Upload scheiterte an Vercels 4.5-MB-Payload-Limit

Live-Test direkt nach dem Merge des Regionen-Fundaments: Upload des echten
Wohlen-Reports (90 Seiten, 4.4 MB) schlug sofort (< 10 Sekunden) mit einem
generischen "Netzwerkfehler" fehl — die Region selbst wurde dabei erfolgreich
angelegt (kleiner JSON-Request), nur der nachfolgende Datei-Upload nicht. Diagnose:
Vercel-Serverless-Functions haben ein hartes, nicht konfigurierbares Payload-Limit
von 4.5 MB — die Plattform hat den Request bereits VOR dem Route-Handler-Code
abgelehnt, weshalb weder ein sinnvoller Fehlertext noch mein für die Analysedauer
gedachtes `maxDuration`-Handling je zum Zug kamen (das war ein separates, hier
NICHT ursächliches Risiko — die Analyse selbst hatte noch gar nicht begonnen).

Fix: der Upload läuft jetzt zweistufig statt über einen einzigen FormData-POST an
die Vercel-Function:
1. `POST /api/regions/[id]/documents/signed-upload-url` (neu) — mint serverseitig
   mit dem service_role-Key eine Supabase-Storage-Signed-Upload-URL (winziger
   Request/Response, kein Payload-Problem).
2. Der Browser lädt die Datei DIREKT zu Supabase Storage hoch
   (`uploadToSignedUrl`, siehe `src/lib/supabaseBrowser.ts`) — läuft komplett an der
   Vercel-Function vorbei, unterliegt nur noch Supabases eigenen (deutlich
   grosszügigeren) Limits.
3. `POST /api/regions/[id]/documents` (Vertrag geändert: nimmt jetzt
   `{storagePath, originalFilename}` als kleines JSON entgegen statt der Datei
   selbst) lädt die bereits hochgeladene Datei serverseitig aus dem Storage
   herunter und startet die Claude-Extraktion wie bisher.

Laut Supabase-SDK-Dokumentation (`storage-js`) benötigt `uploadToSignedUrl` EXPLIZIT
keine RLS-Policy-Berechtigung — passt damit zum bestehenden "RLS aktiv, keine
Policies"-Muster dieser App, ohne eine Ausnahme dafür einführen zu müssen. Die
Autorisierung steckt vollständig im serverseitig geminteten Token.

**Neuer Env-Var**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` — bisher lief jeglicher
Supabase-Zugriff ausschliesslich serverseitig über den service_role-Key; für den
Direct-Upload braucht der Browser-Client zwingend einen (öffentlichen) Anon-Key,
schon allein für den `apikey`-Header, unabhängig von RLS. Siehe README.md. Ohne
diese Variable bleibt der Regionsreport-Upload mit einer klaren Fehlermeldung
blockiert (kein stiller Fehlschlag) — alles andere in der App ist davon nicht
betroffen.

Dubletten-Bereinigung angepasst: da die Datei jetzt IMMER zuerst hochgeladen wird
(bevor der Server den Content-Hash kennt), löscht `POST /api/regions/[id]/documents`
bei einem erkannten Duplikat das soeben hochgeladene (jetzt überflüssige)
Storage-Objekt wieder, statt es verwaist liegen zu lassen — der Rest des
Dubletten-Verhaltens (kein zweiter Claude-Aufruf) bleibt unverändert.

**Zusätzlich, per Rückmeldung während desselben Tests**: eine angelegte Region
liess sich bisher nicht mehr löschen (nur einzelne Reports darin) — insbesondere
störend, weil ein fehlgeschlagener Upload-Versuch eine leere Region zurücklässt.
Neue `DELETE /api/regions/[id]/route.ts` (löscht Region + alle Reports, DB-Zeilen
und Storage-Dateien, mirrort `properties/[id]/route.ts`) + `DeleteRegionButton.tsx`,
sowohl in der Regionen-Liste als auch auf der Regions-Detailseite (dort mit
Redirect zurück zur Liste, analog zu `PropertyDeleteButton.tsx` auf der Objektseite).

**Nachtrag zur Inbetriebnahme**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` wurde vom Nutzer in
Vercel ergänzt (Supabase-Dashboard → Project Settings → API → "Publishable"-/
Default-Key). Dieser Commit ist bewusst ohne funktionale Änderung — er löst nur einen
neuen Vercel-Production-Build aus, damit der zur Build-Zeit fest eingebackene
`NEXT_PUBLIC_`-Wert tatsächlich im ausgelieferten Browser-Code landet (ein reines
Speichern des Env-Vars in Vercel wirkt sich erst auf den NÄCHSTEN Build aus, nicht auf
bereits laufende Deployments).

**Nachtrag, per Rückmeldung nach dem erfolgreichen Live-Test**: `RegionUploadForm.tsx`
zeigte während des Wartens (Direct-Upload + Claude-Analyse, kann bei einem
umfangreichen Report gut eine Minute dauern) nur Text ohne visuellen Lade-Indikator —
wirkte dadurch, als würde nichts passieren. Bestehendes `.spinner`-Muster ergänzt
(dasselbe, das schon in `PropertyCreateForm.tsx`/`DueDiligencePanel.tsx` für
lang-laufende Claude-Aufrufe verwendet wird), sowohl am Status-Text als auch am
Button.

## Nachgezogen (2026-08-25): Due-Diligence-Synthese batched statt ein einzelner Blocking-Call

Live-Test bei Objekt "Bollmoosweg 18" (mehrere hochgeladene Dokumente): "Due-Diligence
aktualisieren" schlug mit "Analyse fehlgeschlagen (Netzwerkfehler)" fehl. KEIN neuer
Bug — dieselbe, in diesem Dokument bereits mehrfach beschriebene Ursache: Vercels
harte, im Code nicht anhebbare 60-Sekunden-Ausführungsgrenze für Serverless-Functions
auf dem Hobby-Plan. Trotz bereits vorhandener Prompt-Verkleinerungen
(`MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT`, Funde-/Zusammenfassungs-/Fakten-Kürzung,
Sonnet-5→Haiku-4.5-Zeitbudget-Rennen) reisst ein EINZELNER Synthese-Call bei mehreren/
umfangreichen Dokumenten weiterhin gelegentlich die Grenze. Auf Nachfrage hat sich der
Nutzer explizit für die aufwendigste, aber strukturell wirksame Lösung entschieden
(statt "nochmal versuchen" oder Vercel-Plan-Upgrade): die Synthese in mehrere
garantiert-kurze Claude-Aufrufe aufteilen. Recherche bestätigt: Next.js' `after()` (ab
Next 15 stabil) verlängert die Function-Laufzeit NICHT — kein echtes
Hintergrund-Job-Primitive auf Vercel Hobby verfügbar. Die "Hintergrundverarbeitung"
ist deshalb client-getrieben: der Browser ruft den Server wiederholt für kurze,
unabhängige Schritte auf, statt eines langen serverseitigen Jobs.

**Batching-Design** (`dueDiligenceSynthesis.ts`):
- Nach der bestehenden ≤8-Dokumente-Deckelung (`selectSynthesisPromptDocuments`)
  Aufteilung in Batches von `SYNTHESIS_BATCH_SIZE = 3` Dokumenten
  (`splitDocumentsIntoBatches`) — bei ≤3 Dokumenten (die meisten Objekte) bleibt es bei
  genau 1 Batch, also unverändertes Verhalten/Timing wie zuvor.
- **Korrektheit der Widerspruchserkennung erhalten**: eine reine Aufteilung nach
  Dokumenten-Teilmengen hätte riskiert, einen Widerspruch zwischen zwei Dokumenten in
  unterschiedlichen Batches zu übersehen. Deshalb bekommt jeder Batch zusätzlich zu
  seinen eigenen Fokus-Dokumenten die **Fakten (nicht Funde/Zusammenfassung) ALLER
  übrigen Dokumente** als Quervergleichs-Kontext (`buildSynthesisPrompt`, neuer
  `otherDocuments`-Parameter, neuer Prompt-Abschnitt "WEITERE, BEREITS ANALYSIERTE
  DOKUMENTE") — analysiert im Detail nur die eigene Teilmenge, kann Widersprüche zu den
  übrigen Dokumenten aber weiterhin über deren Fakten erkennen. Das erhält den
  teuersten Vorteil (Quervergleich) bei deutlich reduzierten Prompt-Kosten (volle
  Funde/Zusammenfassung nur noch für die Fokus-Dokumente statt für alle).
- Jeder Batch-Call nutzt dieselbe Sonnet-5→Haiku-4.5-Zeitbudget-Renn-Logik wie zuvor
  (`callSynthesisModel`, aus dem bisherigen `synthesizeDueDiligence` extrahiert und
  jetzt von beidem — Einzel-Call UND Batch-Call — gemeinsam genutzt).
- Merge der Batch-Ergebnisse (`mergeDueDiligenceBatches`, reine Berechnung, KEIN
  weiterer Claude-Aufruf): Kategorien zusammenführen (kommt dieselbe Kategorie aus
  mehreren Batches, Funde zusammenlegen, schlechterer/schwerwiegenderer Status
  gewinnt), sellerQuestions/fieldUpdateProposals/contradictions aneinanderhängen,
  overallSummary-Texte der Batches mit Leerzeile verbunden, danach dieselbe
  deterministische Kategorie-Auffüllung wie zuvor (`fillMissingCategories`, aus
  `parseSynthesisResponse` extrahiert) + `computeOverallStatus` +
  `computeMissingDocuments` — alles unverändert wiederverwendet, nur jetzt über die
  gemergten Kategorien/die vollständige (nicht nur die batch-gedeckelte)
  Dokumentenliste statt direkt vom LLM.
- `synthesizeDueDiligence` (Einzel-Call) bleibt unverändert nutzbar — wird weiterhin
  vom Neu-Erfassen-Flow (`api/properties/prefill-synthesis/route.ts`) verwendet. Diese
  zweite Stelle hat dasselbe 60s-Risiko, war aber nicht Teil der aktuellen
  Nutzer-Meldung (typischerweise weniger/frisch hochgeladene Dokumente beim Neuanlegen)
  — bewusst NICHT Teil dieses PRs, als Folge-Kandidat vermerkt.

**Neue Routen**: `POST /api/properties/[id]/due-diligence` nimmt jetzt `{batchIndex}`
entgegen, führt NUR diesen einen Batch aus und gibt `{batchResult, batchIndex,
totalBatches}` zurück — persistiert dabei NICHTS in `property_due_diligence.result`
(nur Zwischenergebnis, kein Schema-Update nötig). Neue `POST
/api/properties/[id]/due-diligence/finalize` (`maxDuration = 10`, reine
Merge-Logik) nimmt die vom Client gesammelten Batch-Ergebnisse entgegen, ruft
`mergeDueDiligenceBatches` und persistiert erst hier `status = "DONE"`/`result`. Die
Dokumenten-Lade-/Zuordnungslogik (identisch zwischen beiden Routen gebraucht) liegt
jetzt gemeinsam in `due-diligence/documents.ts` (`loadSynthesisDocuments`).

`DueDiligencePanel.tsx`: `handleSynthesize` ruft `.../due-diligence` jetzt in einer
Schleife mit steigendem `batchIndex` (weiterhin über `fetchJsonWithRetry`, EIN
automatischer Retry PRO Batch statt fürs Ganze), sammelt die Zwischenergebnisse im
Speicher, ruft danach einmal `.../due-diligence/finalize`. Neuer
`synthesisProgress`-Zustand zeigt am Button "Analysiert… (2/3)" statt nur "Analysiert…"
— sichtbares Feedback, dass mehrere Schritte laufen, nicht nur ein einzelner hängender
Request.

Keine Live-Verifikation gegen das echte Anthropic-Modell möglich (kein
`ANTHROPIC_API_KEY` in dieser Remote-Session) — abgesichert über Unit-Tests der
Split-/Merge-/Parse-Logik (u.a. Quervergleichs-Kontext enthält nur Fakten, nicht
Zusammenfassung/Funde des anderen Dokuments; schlechterer Status gewinnt beim Merge;
Kategorie-Auffüllung bei genau einem Batch verhält sich identisch zum bisherigen
Einzel-Call). Echte Bestätigung erst durch den Nutzer live (erneuter Klick auf
"Due-Diligence aktualisieren" bei Bollmoosweg 18, demselben Objekt, das zuvor
fehlschlug).

## Nachgezogen (2026-08-25): "DD aktualisieren"-Knopf zusätzlich im Objektseiten-Header

Rückmeldung: der Auslöser für die Due-Diligence-Synthese sitzt bisher nur unten im
`DueDiligencePanel` — auf dem Handy erst nach viel Scrollen erreichbar, gewünscht war
ein zweiter, kompakter Knopf direkt oben im Header, unterhalb von "Objekt löschen"
(neben "Management Summary (PDF)").

Statt die Batch-Loop-Logik (siehe Eintrag oben) ein zweites Mal zu schreiben, wurde sie
aus `DueDiligencePanel.tsx` in einen gemeinsamen Hook `useDueDiligenceSynthesis.ts`
extrahiert (identisches Verhalten, nur als Hook statt inline). Neue, kompakte
`DueDiligenceRefreshButton.tsx` (Objektseiten-Header) und das bestehende
`DueDiligencePanel.tsx` nutzen beide denselben Hook — ein Klick oben löst exakt
denselben batchweisen Ablauf aus wie der Knopf weiter unten, `router.refresh()`
aktualisiert danach die ganze Seite inkl. Panel. Der Header-Knopf ist deaktiviert,
solange keine Dokumente hochgeladen sind (`documents.length === 0`), analog zum
bestehenden Knopf im Panel.

## Nachgezogen (2026-08-25): Kaufpreis-Aufteilung Wohnung/Garage/Aussenparkplatz/Hobbyraum + eigene Bruttorendite je Kategorie

Rückmeldung anhand eines Screenshots des Erfassungsformulars: unter "Kaufpreis" sollten
weitere Kaufpreis-Felder ergänzt werden — Garage, Aussenparkplatz, Hobbyraum —, damit
sich "die Renditen für die vier Kategorien sauber auseinanderhalten" lassen. Auf
Nachfrage bestätigt: (1) die bestehenden Parkplatz-/Garagenplatz-Kaufpreis-Felder
(bisher nur im Deep-Dive-Formular) sollen ins Erfassungsformular vorgezogen werden statt
doppelt zu existieren, (2) tatsächlich VIER getrennte Bruttorenditen sollen berechnet
werden, nicht nur eine gemeinsame Summe.

"Aussenparkplatz" existierte bereits als `parkplatzKaufpreisChf`, "Garage" als
`garagenplatzKaufpreisChf` — beide bereits eigene Kaufpreis-Felder, nur (a) noch im
Deep-Dive-Formular statt im Erfassungsformular, (b) ohne eigene Miete-Aufteilung (bisher
EIN gemeinsames `parkplatzMieteChfPerMonth` für beide), (c) ohne "Hobbyraum"-Pendant.
Kein DB-Schema-Update nötig — alles lebt in der bereits vorhandenen
`properties.bestandsrendite`-JSONB-Spalte, kein manueller SQL-Schritt diesmal.

**Kernentscheidung: additiv, nicht ersetzend.** Die bestehende Gesamtrechnung
(Schnellcheck/Investment Case/15-Jahres-Modell/IRR) bleibt unverändert auf dem
kombinierten Gesamt-Kaufpreis — eine Liegenschaft hat eine Hypothek/einen Cashflow,
nicht vier getrennte (eine einzelne Garage bekommt keine eigene Hypothek). Zusätzlich
NEU: eine reine Brutto-Rendite-Aufschlüsselung je Kategorie (`kategorienRenditen` in
`bestandsrendite.ts`: Kaufpreis, Jahresmiete, Bruttorendite = Jahresmiete ÷ Kaufpreis,
ohne Cashflow-/Hypotheken-/Steuerbezug). "Wohnung" nutzt bewusst NICHT "sonstige
Einnahmen" (keiner Raum-Kategorie zuordenbar). 0% Rendite statt Division-durch-0-Fehler,
wenn eine Kategorie keinen Kaufpreis hat.

**Datenmodell** (`BestandsrenditeFacts`): neu `hobbyraumKaufpreisChf`/
`hobbyraumImKaufpreisEnthalten` (Spiegelbild von Garage/Parkplatz), neu
`miete.garagenplatzMieteChfPerMonth`/`miete.hobbyraumMieteChfPerMonth` (bestehendes
`miete.parkplatzMieteChfPerMonth` gilt jetzt klar nur noch für den Aussenparkplatz). Die
kombinierte Nebenraum-Miete für die GESAMTRECHNUNG ist weiterhin die Summe aller drei —
sonst gingen Garage-/Hobbyraum-Mieteinnahmen aus Schnellcheck/Investment Case verloren.
`packages/financial-engine` bleibt unangetastet (reine App-Ebene-Erweiterung).

**Formulare**: neue geteilte Komponente `KaufpreisAufteilungFields.tsx` (reine
Formularfelder ohne eigenes `<form>`, analog `BestandsrenditeFactsFields.tsx`) für
Garage-/Aussenparkplatz-/Hobbyraum-Kaufpreis + "im Kaufpreis enthalten"-Checkboxen —
verschoben aus `BestandsrenditeFactsFields.tsx`s "Objekt"-Block, jetzt direkt unter dem
"Kaufpreis (Wohnung)"-Feld in `PropertyCreateForm.tsx` (funktioniert ohne Weiteres, da
`PropertyCreateForm` ohnehin EIN kombiniertes `<form>` über Objekt-Basisdaten UND
Bestandsrendite-Fakten ist) UND vor `BestandsrenditeFactsFields` in
`BestandsrenditeVertiefungForm.tsx` (damit die Aufteilung nach der Ersterfassung
weiterhin korrigierbar bleibt — analog zu `askingPriceChf` selbst, das ja auch sowohl im
Neu-Erfassen- als auch im späteren "Objekt-Basisdaten bearbeiten"-Formular editierbar
ist, keine "doppelte Ersterfassung"). Miete-Sektion in `BestandsrenditeFactsFields.tsx`
um "Miete Garage"/"Miete Hobbyraum" ergänzt, "Miete Parkplatz" zu "Miete Aussenparkplatz"
umbenannt (reine Label-Klarheit).

**Anzeige**: neue Tabelle "Rendite nach Kategorie" im Schnellcheck-Panel der Objektseite
— nur Kategorien mit erfasstem Kaufpreis > 0 (Wohnung immer, Pflichtfeld), nur
eingeblendet, wenn mindestens eine Nebenkategorie einen Kaufpreis hat (sonst wäre die
Tabelle nur eine Wiederholung der Kaufpreis-/Bruttorendite-Metriken darüber).

Keine Live-Verifikation mit echten Browser-Formularen möglich (Remote-Session) —
abgesichert über sorgfältige Feld-`id`/`name`-Konsistenz zwischen
`KaufpreisAufteilungFields`, `bestandsrenditeFormParsing.ts` und
`parseBestandsrenditeFacts`, plus neue Unit-Tests für `kategorienRenditen` (alle vier
Kategorien korrekt berechnet, 0-Kaufpreis-Fall, Gesamtsumme bleibt bei gesetzten
Garage-/Hobbyraum-Werten korrekt vollständig). Nutzer bestätigt nach dem Merge live.

## Nachgezogen (2026-08-25): Rendite-nach-Kategorie als Drill-down statt eigener Abschnitt

Rückmeldung direkt nach dem vorigen Merge: die neue "Rendite nach Kategorie"-Tabelle als
eigener Abschnitt unter dem Schnellcheck war zwar korrekt, aber ein Sprung weg von der
Kennzahl, die sie eigentlich aufschlüsselt. Sinnvoller: die "Bruttorendite
(Kaufpreis)"-Kachel selbst bekommt ein Drill-down.

Umsetzung: `Metric`s `sub`-Prop nimmt bereits `ReactNode` entgegen (nicht nur Text) —
daher kein Umbau von `MetricPrimitives.tsx` nötig. Die Kachel zeigt weiterhin den
bisherigen Ziel-/Alternativ-Vergleichstext, darunter jetzt zusätzlich ein natives
`<details>`/`<summary>` ("Nach Kategorie", gleiches Muster wie
"Objekt-Basisdaten bearbeiten" auf der Objektseite) — aufgeklappt erscheinen die vier
Kategorien als kompakte Liste (Kaufpreis · Jahresmiete · Bruttorendite je Zeile), nicht
als `<table>`: die Kachel ist nur eine von vier Spalten im `.metricgrid`
(`grid-template-columns: repeat(4, 1fr)`, auf Mobile `repeat(2, 1fr)`) — eine
mehrspaltige Tabelle wäre darin zu eng gewesen. Der bisherige eigenständige Abschnitt
samt Tabelle ist komplett entfernt, die Berechnung selbst (`kategorienRenditen`)
unverändert.

## Nachgezogen (2026-08-25): Initial-Renovationskosten und Reinigung/Service je Vermietungsmodell (Paket 1/2) getrennt erfassbar

Rückmeldung: die beiden Positionen "Initial-Renovationskosten" und "Reinigung/Service"
waren bisher je EIN gemeinsamer Wert, unabhängig davon, ob langfristig/unmöbliert
(Paket 1) oder mittelfristig/möbliert (Paket 2) vermietet wird — unrealistisch, da beide
Grössen typischerweise vom Vermietungsmodell abhängen (kurzfristig/möbliert braucht oft
eine andere Sanierungstiefe UND Reinigung zwischen Mietern, langfristig/unmöbliert meist
weniger von beidem).

**Gating exakt wie bei den Möblierungskosten**: `BestandsrenditeFacts.renovation` trägt
jetzt `initialRenovationCostUnmoebliertChf`/`initialRenovationCostMoebliertChf` statt
eines einzelnen Felds, `betriebskosten` entsprechend
`reinigungServiceUnmoebliertChfPerYear`/`reinigungServiceMoebliertChfPerYear`. In
`computeBestandsrenditeAnalysis` wird — dieselbe Regel wie
`moeblierungIstGewaehltesSzenario` — nur der Betrag des tatsächlich gewählten
Vermietungsmodells verwendet (SHORT_STAY nutzt denselben Wert wie unmöbliert, keine
eigene dritte Variante): fliesst in die Investitionssumme
(`calculateAllInInvestition`), den Renovation-ROI (`calculateRenovationRoi` nutzt jetzt
ebenfalls den effektiven Betrag statt eines einzelnen Felds) und — neu ein
`betriebskostenEffective`-Objekt statt `facts.betriebskosten` direkt — in NOI/Cashflow
(Investment Case) UND ins 15-Jahres-Modell (`betriebskostenJahr1`).

**Formular**: beide Felder sind aus den bisherigen Sektionen "Renovation"/
"Betriebskosten" in die bestehenden "Paket 1 — unmöbliert"/"Paket 2 — möbliert"-Blöcke
gewandert (dort, wo bereits die Miete/Möblierungskosten je Paket erfasst werden) —
Beschreibungstexte in den verbleibenden Sektionen entsprechend angepasst, damit sie
nicht mehr auf ein inzwischen woanders liegendes Feld verweisen. Die itemisierte
Renovationspositionen-Liste (Werterhaltend/Wertvermehrend/Energetisch fürs
15-Jahres-Modell) bleibt unverändert unabhängig vom Paket — ein eigenes, von der
Vermietungsart unabhängiges Konzept.

Neue Tests decken das Gating ab: All-in-Investition/NOI/Renovation-ROI verwenden je
Paket den korrekten Betrag; bestehender Regressionstest zum Möblierungs-Gating
entsprechend angepasst (Wechsel möbliert→unmöbliert lässt jetzt zusätzlich zur
Möblierung auch die paket-spezifische Renovationsdifferenz wegfallen).

## Nachgezogen (2026-08-25): Korrektur — Renovation zurück auf einen gemeinsamen Wert, stattdessen "Reparatur" je Paket

Direkte Korrektur des vorigen Eintrags: "renovation wieder zurück mutieren, und bei den
beiden Paketen anstelle Renovation den Posten Reparatur einfügen". Die
Paket-1/2-Aufteilung von Reinigung/Service bleibt unverändert bestehen (die war richtig)
— nur Renovation wird zurückgebaut, dafür ein neuer, eigenständiger Posten "Reparatur"
eingeführt.

- `BestandsrenditeFacts.renovation`: `initialRenovationCostUnmoebliertChf`/
  `initialRenovationCostMoebliertChf` zurück zu einem einzelnen
  `initialRenovationCostChf` — wieder EIN gemeinsamer Wert unabhängig vom
  Vermietungsmodell, wie ursprünglich. Feld + Beschreibungstext zurück in die
  "Renovation"-Sektion (Mietwirkung/Einzelpositionen fürs 15-Jahres-Modell waren dort
  ohnehin unverändert geblieben). Renovation-ROI (`calculateRenovationRoi`) nutzt wieder
  direkt diesen einzelnen Wert statt eines paketgegateten.
- Neue, eigenständige Facts-Gruppe `reparatur: { initialUnmoebliertChf,
  initialMoebliertChf }` — bewusst getrennt von `reserven.reparatur*` (das ist eine
  laufende JÄHRLICHE Reserve für künftige Reparaturen; hier geht es um bereits bekannte,
  einmalige Reparaturkosten beim Einstieg) und von der jetzt wieder ungegateten
  Renovation. Gleiches Gating wie zuvor bei Renovation/Reinigung
  (`moeblierungIstGewaehltesSzenario`) — nur der Betrag des gewählten Vermietungsmodells
  fliesst ein. Kein eigener Engine-Parameter nötig: nutzt den bereits vorhandenen,
  bisher immer auf 0 gesetzten `sonstigeInitialkostenChf`-Slot in
  `calculateAllInInvestition` — `packages/financial-engine` bleibt unangetastet.
- Formular: die Kaufpreis-Renovationsfelder in Paket 1/2 sind jetzt "Reparaturkosten
  (CHF, einmalig)" (`reparaturInitialUnmoebliertChf`/`reparaturInitialMoebliertChf`),
  Reinigung/Service bleibt daneben unverändert.

Tests entsprechend korrigiert: Renovation-Tests wieder auf den ungegateten Einzelwert,
neuer Test bestätigt, dass Renovation unverändert in beide Vermietungsmodelle einfliesst
(nur die Möblierungskosten fallen beim Wechsel weg), Gating-Test für
Reparatur/Reinigung ersetzt den vorigen Renovation/Reinigung-Test.

## Nachgezogen (2026-08-26): Verhandlungskorridor — Preisobergrenze (Nettorendite) ergänzt

Auslöser: kritischer Benchmark-Vergleich mit einer ChatGPT/SIPIS-Analyse für dasselbe
Objekt (Bollmoosweg 18) auf ausdrücklichen Wunsch des Auftraggebers ("finale Lauf […]
nimm dir zeit um aus sicht investor das beste analysetool zu entwickeln"). Kernbefund:
das bisherige `Verhandlungskorridor`-"Maximum" (Kaufpreis, bei dem der nachhaltige
Cashflow gerade CHF 0 erreicht) lag im Testfall rund CHF 270'000 über der von SIPIS
berechneten, an einem Nettorenditeziel ausgerichteten Preisobergrenze — bei tiefem Zins
und hoher Belehnung kauft billiges Fremdkapital sehr viel Preis-Spielraum, bevor der
Cashflow negativ wird, ohne dass das noch etwas über die Renditequalität des Deals
aussagt. HOME4efFINDER berechnete bereits eine "Nettorendite vor Finanzierung" samt
eigenem, gespeichertem Nettorenditeziel (`nettoRenditeZielPercent`, Annahmen-Reiter) —
dieses floss aber nirgends in den Verhandlungskorridor ein; der bisherige "Zielpreis"
basiert ausschliesslich auf der (grosszügigeren) Bruttorendite.

- `computeVerhandlungskorridor` (`bestandsrendite.ts`): neues Feld `nettoZielChf` —
  Kaufpreis, bei dem `investmentCase.nettoRenditeVorFinanzierungPercent` genau
  `nettoRenditeZielPercent` erreicht. Anders als beim bruttorenditebasierten `zielChf`
  lässt sich das nicht algebraisch auflösen (die All-in-Investition enthält
  kaufpreisabhängige Kaufnebenkosten-Prozentsätze) — daher per Bisektion, exakt wie
  beim bestehenden `maximumChf`. Nach oben weiterhin durch `maximumChf` gedeckelt.
- UI (`BestandsrenditeAnalysisView.tsx`) und Management-Summary-PDF
  (`managementSummaryPdf.tsx`): neue Kachel "Preisobergrenze (Nettorendite)" neben
  Zielpreis/Maximum; Erklärtext im Panel stellt jetzt klar, dass das Maximum eine reine
  Solvenzgrenze ("ab wann geht das Geld aus"), keine Kaufempfehlung ist.
- Bewusst NICHT geändert: welches Szenario (unmöbliert/möbliert) der Korridor
  standardmässig verwendet — das folgt weiterhin `facts.miete.vermietungsmodell`, dem
  tatsächlich für das Objekt hinterlegten Vermietungsmodell. Ein Vorschlag aus dem
  Benchmark-Vergleich war, den Korridor generell auf das konservativere unmöblierte
  Szenario umzustellen — das würde aber die explizite Objekteinstellung überschreiben,
  statt nur eine Darstellungsfrage zu sein; nicht umgesetzt.

Neue Tests: `nettoZielChf` trifft am gefundenen Preis exakt das Nettorenditeziel, liegt
nicht über `zielChf`/`maximumChf`, und reagiert wie erwartet auf ein strengeres
Nettorenditeziel (tieferer Preis).

## Nachgezogen (2026-08-26): STWEG-Kostenaufteilung (überwälzbar/nicht überwälzbar) + kleinere Politur aus dem Benchmark-Vergleich

Zweite Umsetzungsrunde aus demselben SIPIS/ChatGPT-Benchmark-Vergleich (siehe voriger
Eintrag) — Auftraggeber: "setzt alles um was du gefunden hast". Drei Punkte, alle
UI-/App-Ebene, `packages/financial-engine` bleibt unangetastet:

**1. STWEG-Akontobeitrag: überwälzbarer Anteil.** Bisher zählte der GESAMTE
STWEG-Akontobeitrag als Vermieterkosten in NOI/Schnellcheck/Mehrjahresmodell. SIPIS
trennt explizit: nur ein Teil (typischerweise Erneuerungsfonds-Einlage,
STWEG-Verwaltung) bleibt beim Eigentümer, der Rest ist bei korrektem Mietvertrag über
die Nebenkosten auf den Mieter überwälzbar (z.B. Heizkosten, allgemeiner Unterhalt) —
und bezeichnet diese Trennung ausdrücklich als "zentralen Sensitivitätspunkt".

- Neues Feld `BestandsrenditeFacts.betriebskosten.stwegAkontobeitragUeberwaelzbarChfPerYear`
  (Default 0 — unverändertes Verhalten, solange nicht erfasst: voller Betrag gilt weiter
  als nicht überwälzbar).
- `computeBestandsrenditeAnalysis`: neue Grösse
  `stwegAkontobeitragNichtUeberwaelzbarChfPerYear = max(0, gesamt − überwälzbar)`, ersetzt
  den bisherigen vollen Akontobeitrag in `betriebskostenEffective` (fliesst dadurch
  konsistent in Investment Case, Mehrjahresmodell UND Verhandlungskorridor — alle drei
  nutzen `betriebskostenEffective`/leiten sich davon ab) sowie in
  `schnellcheckLaufendeKostenChfPerYear` (Ebene A).
- `NoiBreakdown`: neues Feld `stwegAkontobeitragUeberwaelzbarChfPerYear` rein informativ
  für die Herleitungs-Anzeige — `stwegAkontobeitragChfPerYear` selbst ist jetzt bereits
  der bereinigte (nicht überwälzbare) Betrag.
- Formular (`BestandsrenditeFactsFields.tsx`): neues Feld "davon überwälzbar
  (Nebenkosten)" neben dem bestehenden STWEG-Akontobeitrag-Feld (jetzt "STWEG-
  Akontobeitrag (gesamt)" beschriftet); Feldwert-Übernahme-Vorschläge (Due-Diligence)
  unterstützen das neue Feld ebenso wie das bestehende.
- UI (`BestandsrenditeAnalysisView.tsx`, NOI-Aufschlüsselung): Zeile umbenannt zu "−
  STWEG-Akontobeitrag (nicht überwälzbar)", zusätzliche Info-Zeile zeigt den
  überwälzbaren (nicht in der Rechnung enthaltenen) Anteil, wenn erfasst.

Neue Tests: der überwälzbare Anteil entlastet NOI/Schnellcheck-Cashflow/Mehrjahresmodell
konsistent um denselben Betrag; ein überwälzbarer Anteil über dem Gesamtbeitrag wird auf
0 gedeckelt (kein negativer Eigentümerkosten-Anteil).

**2. Bruttorendite-Label-Konsistenz.** Dieselbe Bezeichnung "Bruttorendite" wurde an
zwei Stellen mit unterschiedlicher Formel verwendet — Schnellcheck/Investment Case auf
Basis der Sollmiete (ohne Leerstandsabzug), die Value-Add-Möblierung-Tabelle auf Basis
des effektiven (leerstandsbereinigten) Jahresertrags — ohne dass das ohne Hover/Tap auf
den Info-Hint ersichtlich war. Labels umbenannt: "Bruttorendite (Kaufpreis, Sollmiete)"/
"Bruttorendite auf Kaufpreis (Sollmiete)"/"Bruttorendite auf All-in (Sollmiete)" vs.
"Bruttorendite (effektiv)" in der Value-Add-Tabelle, mit gegenseitigem Verweis in den
Hint-Texten. Reine Beschriftungsänderung, keine Formeländerung.

**3. Zinssensitivität.** SIPIS zeigt explizit "+1 Prozentpunkt Zins = CHF X/Jahr
Cashflow" neben der reinen Break-even-Zins-Zahl. Neuer Sub-Text unter "Break-even-Zins"
("≈ CHF X/Jahr je 1 Prozentpunkt Zins" = 1% der aktuellen Gesamthypothekarsumme) — reine
Anzeige-Ergänzung, keine neue Berechnung im engeren Sinn (linear aus bereits
vorhandenen `hypothek.ersteHypothekChf`/`zweiteHypothekChf` hergeleitet).

**Bewusst weiterhin nicht umgesetzt** aus demselben Benchmark-Vergleich:
- Standardmässiger Wechsel des Verhandlungskorridors/Schnellchecks auf das unmöblierte
  Szenario — würde die tatsächlich am Objekt hinterlegte `vermietungsmodell`-Einstellung
  überschreiben, keine reine Darstellungsfrage (bereits im vorigen Eintrag begründet).
- Markt-Feedback-Loop direkt an den Mietfeldern (Quantil-Einordnung inline statt nur im
  separaten, bereits bestehenden Markteinordnung-Panel) — grössere UX-Änderung, die die
  Regionsreport-Daten in die Formularkomponenten verdrahten müsste; zurückgestellt statt
  überstürzt umgesetzt.
- Preis-Stufentabelle (Rendite/Cashflow/Urteil über mehrere Kaufpreis-Schritte) im
  Verhandlungskorridor — grössere UI-Ergänzung, aus Zeitgründen in dieser Runde nicht
  umgesetzt.
- Verlässlichere Cross-Dokument-Konflikterkennung für Attribute wie Baujahr — das ist
  eine Frage der Due-Diligence-Synthese-Prompt-Qualität (LLM-Verhalten), kein
  deterministischer Code-Fix; nicht angefasst, um nicht unverifiziert an einer
  produktiven Extraktion zu schrauben.

## Nachgezogen (2026-08-26): Preis-Stufentabelle im Verhandlungskorridor

Dritte Umsetzungsrunde aus dem SIPIS/ChatGPT-Benchmark-Vergleich — der im vorigen Eintrag
noch zurückgestellte Punkt "Preis-Stufentabelle" auf Auftraggeber-Wunsch nachgezogen. SIPIS
zeigt neben den drei Korridor-Eckwerten (Ideal/Grenze/Maximum) eine durchgehende Tabelle
mit Rendite/Cashflow über mehrere Kaufpreis-Schritte — für eine echte Verhandlung
brauchbarer als nur die Endpunkte, weil sichtbar wird, wie stark sich die Kennzahlen bei
kleinen Preiszugeständnissen bewegen.

- Neue Funktion `computePreisStufentabelle` (`bestandsrendite.ts`), Rückgabetyp
  `PreisStufe[]`. Spanne: von der strengsten gesetzten Zielgrösse
  (`verhandlungskorridor.nettoZielChf`, sonst `zielChf`) bis zum aktuellen Kaufpreis —
  bewusst NICHT bis `maximumChf`, das ist wie im vorigen Eintrag beschrieben eine reine
  Cashflow-Solvenzgrenze, die bei tiefen Zinsen weit ausserhalb jeder sinnvollen
  Verhandlungsspanne liegen und die Tabelle unbrauchbar strecken würde. Beide Enden auf
  CHF 5'000 gerundet für "runde" Stufenpreise; der tatsächliche aktuelle Kaufpreis wird der
  gerundeten Stufenliste zusätzlich exakt (ungerundet) hinzugefügt und als
  `istAktuellerKaufpreis: true` markiert, damit die UI ihn zuverlässig hervorheben kann,
  statt zu hoffen, dass eine gerundete Stufe zufällig genau trifft. `[]`, wenn kein
  Renditeziel gesetzt ist oder Ziel-Preis und aktueller Kaufpreis nach Rundung
  zusammenfallen (kein sinnvoller Bereich).
- Jede Zeile ist eine vollständige Neuberechnung (`computeBestandsrenditeAnalysis` bei
  diesem Kaufpreis) — keine separate, potenziell abweichende Formel, dieselbe Garantie wie
  bei `maximumChf`/`nettoZielChf`.
- Wiring: `objekte/[id]/page.tsx` berechnet die Tabelle serverseitig (wie
  `verhandlungskorridor` selbst) und reicht sie als neue Prop `preisStufentabelle` an
  `BestandsrenditeAnalysisView` durch. Bewusst NICHT ins Management-Summary-PDF
  übernommen — das PDF ist ein kompakter One-Pager, eine mehrzeilige Stufentabelle würde
  dort schlecht passen; die drei Korridor-Eckwerte bleiben dort ausreichend.
- UI: neue Tabelle innerhalb des bestehenden Verhandlungskorridor-Panels (`stresstable`,
  gleiches Muster wie die Value-Add-Möblierung-Tabelle) mit den Spalten Kaufpreis /
  Bruttorendite / Nettorendite / Nachhaltiger Cashflow. Farbcodierung wiederverwendet das
  bestehende `renditeAmpelColor` (dieselbe Ampel-Logik wie bei den übrigen Rendite-
  Kennzahlen), negativer Cashflow zusätzlich rot hervorgehoben. Aktuelle-Kaufpreis-Zeile
  fett markiert.

Neue Tests: Stufen aufsteigend sortiert, genau eine Zeile exakt als aktueller Kaufpreis
markiert, jede Zeile deckt sich mit einer direkten Neuberechnung bei diesem Kaufpreis,
leeres Ergebnis ohne Renditeziel bzw. bei zusammenfallendem Ziel-/Ist-Preis nach Rundung.

## Nachgezogen (2026-08-26): Ampelsystem ausgebaut — konsolidierte "Bewertungsübersicht"

Wunsch: "kannst du das ampelsystem noch ausbauen und optisch darstellen im summary und
objektdetailseite?" — inspiriert vom SIPIS-"Risiko-Radar" aus dem Benchmark-Vergleich
(mehrere Ampeln nebeneinander: Markt, Kaufpreis, Rendite, Cashflow,
Möblierungs-Upside, STWEG, Energie, Exit). HOME4efFINDER hatte bereits einzelne Ampeln
(Investment-Score-Chip, `renditeAmpelColor` je Kennzahl, Due-Diligence-Kategorie-Chips in
`DueDiligencePanel`, farbige Dots im PDF) — aber verstreut über die Seite statt an einer
Stelle auf einen Blick zusammengefasst.

- Neue Datei `bewertungsAmpel.ts`: `computeBewertungsAmpeln` — bewusst NUR aus bereits
  vorhandenen, selbst berechneten Werten (wie beim Investment-Score: "nichts wird
  erfunden", keine neue KI-Einschätzung). Fünf Dimensionen, jede nur gezeigt, wenn die
  zugrundeliegenden Daten tatsächlich vorliegen (kein Platzhalter-Rot ohne Datenbasis):
  - **Rendite** (Nettorendite vor Finanzierung vs. Nettorenditeziel) — dieselben
    Schwellen wie das bestehende `renditeAmpelColor`.
  - **Cashflow** (nachhaltiger Cashflow ≥0/<0) — bewusst zweistufig statt einer
    erfundenen "knapp positiv"-Schwelle.
  - **Kaufpreis vs. Markt** (Quantil-Position Kaufpreis/m² der Gemeinde, Regionsreport) —
    nur wenn ein Regionsreport für die Gemeinde vorliegt; ≤50%-Quantil grün, bis 75%
    gelb, darüber rot.
  - **Möblierungs-Upside** (`furnitureRoi.roiPercent`) — nur wenn Möblierungskosten
    erfasst sind; ≥50% ROI grün, ≥20% gelb, sonst rot.
  - **Due Diligence** (`dueDiligence.overallStatus`) — direkte Übernahme der bereits
    vorhandenen Severity (OK/KLAERUNGSBEDARF/RISIKO → good/warn/bad), hier zusätzlich in
    der Übersicht sichtbar statt nur weiter unten im Due-Diligence-Panel.
  - `AmpelStatus` nutzt bewusst dieselben drei Werte wie `ChipTone`
    ("good"/"warn"/"bad") statt eigener Begriffe, damit sich jede Dimension direkt als
    `<Chip tone={...}>` (Web) bzw. mit identischer Farbzuordnung im PDF darstellen lässt.
- Neue Komponente `BewertungsuebersichtView.tsx` — Panel mit einer Reihe farbiger Chips
  + Detailtext, direkt nach dem Objektdaten-Header auf der Objektseite (vor "Objekt-
  Basisdaten bearbeiten"), damit die Übersicht ohne Scrollen sichtbar ist.
- `managementSummaryPdf.tsx`: kompakte Ampel-Zeile (farbige Dots, `ampelRow`/`ampelItem`-
  Styles nach demselben Muster wie die bestehenden Due-Diligence-Kategorie-Dots) direkt
  unter dem Score-Badge. Bewusst OHNE die Kaufpreis-vs-Markt-Dimension — der One-Pager
  bleibt kompakt und bekommt keinen zusätzlichen (asynchronen) Regionsreport-Zugriff in
  der PDF-Route; auf der Objektseite selbst ist diese Dimension zusätzlich vorhanden.
- Objektseite (`objekte/[id]/page.tsx`): `computeBewertungsAmpeln` mit den bereits
  vorhandenen `analysis`/`dueDiligence`/`regionData`/`effectiveParams`-Werten aufgerufen,
  kein neuer Datenzugriff.

Neue Tests (`bewertungsAmpel.test.ts`): jede Dimension einzeln auf ihre Schwellenwerte
geprüft (Rendite/Cashflow immer vorhanden, Kaufpreis-vs-Markt/Möblierung/Due-Diligence
nur bei vorhandenen Daten), inkl. eines Falls mit allen fünf Dimensionen gleichzeitig.

## Nachgezogen (2026-08-26): Code-Review der PRs #65–#68 (Verhandlungskorridor/STWEG-Split/Preis-Stufentabelle/Ampelsystem) — drei Funde behoben

Nach Abschluss des ChatGPT/SIPIS-Benchmark-Vergleichs und dem Merge der vier daraus
resultierenden PRs wurde die kumulative Änderung nochmals mit einem eigenständigen
Code-Review-Durchgang geprüft (unabhängig vom Feature-Entwicklungspfad). Drei Funde,
alle behoben:

1. **`noiBreakdown.stwegAkontobeitragUeberwaelzbarChfPerYear` war ungedeckelt.** Die
   nicht-überwälzbare NOI-Abzugsgrösse selbst wurde bereits korrekt auf 0 gedeckelt
   (`Math.max(0, gesamt - überwälzbar)`, siehe PR #66), aber der rein informative
   "davon überwälzbar"-Ausweis in `noiBreakdown` übernahm ungeprüft den rohen
   Nutzereingabewert. Bei einem inkonsistent erfassten Wert (überwälzbar > Gesamtbeitrag,
   z.B. Tippfehler oder ein KI-Feldvorschlag ohne Cross-Feld-Validierung) zeigte die
   NOI-Aufschlüsselung dadurch z.B. "nicht überwälzbar: CHF 0" direkt über "davon
   überwälzbar: CHF 9'999" bei einem Gesamtbeitrag von nur CHF 4'800 — logisch
   unmöglich. Fix: `Math.min(überwälzbar, gesamt)` beim Aufbau von `noiBreakdown` in
   `bestandsrendite.ts`. Regressionstest ergänzt (`bestandsrendite.test.ts`).
2. **`computePreisStufentabelle`s unterer Tabellen-Anker bevorzugte `nettoZielChf`
   unconditional statt der tatsächlich strengeren (tieferen) der beiden Zielgrössen.**
   Die Funktion dokumentiert selbst "von der strengsten gesetzten Zielgrösse", und ein
   früherer DECISIONS.md-Eintrag hielt fest, dass `nettoZielChf` "in aller Regel deutlich
   unter `zielChf`" liegt — das gilt aber nur, solange `nettoRenditeZielPercent` nicht
   deutlich lockerer als `bruttoRenditeZielPercent` gesetzt wird (beide auf dem
   Annahmen-Reiter frei überschreibbar). In diesem Fall wäre `zielChf` die eigentlich
   strengere/tiefere Grenze gewesen und wurde bislang stillschweigend aus der
   Preis-Stufentabelle verdrängt. Fix: `zielAnker = Math.min(nettoZielChf, zielChf)`,
   wenn beide definiert sind (sonst weiterhin der jeweils einzeln definierte Wert).
   Zwei Regressionstests ergänzt (beide Richtungen: lockereres Netto- bzw.
   Bruttorenditeziel).
3. **Drei duplizierte Hex-Farb-Zuordnungen im PDF.** `managementSummaryPdf.tsx` (react-pdf
   kann keine CSS-Variablen auflösen) definierte dieselben drei Ampel-Hex-Farben
   (`#4f6e38`/`#93641a`/`#9b3b30`) viermal unabhängig — `SEVERITY_COLOR`, `scoreColor`,
   `renditeAmpelColorPdf`, `AMPEL_STATUS_COLOR`. Eine künftige Palettenänderung hätte
   leicht eine der vier Stellen vergessen können. Fix: eine einzige `STATUS_COLOR:
   Record<AmpelStatus, string>`-Konstante als Single Source of Truth, alle vier Stellen
   leiten sich jetzt davon ab (funktional unverändert, reines Code-Qualitäts-Nit).

Kein Verhalten ausserhalb der drei beschriebenen Korrekturfälle geändert — alle
bestehenden Tests bleiben unverändert grün.

## Nachgezogen (2026-08-26): Markt-Feedback-Loop direkt am Nettomiete-Feld

Wunsch: "mach den Markt-Feedback-Loop bei den Mietfeldern" — eine der drei ursprünglich
aus dem SIPIS/ChatGPT-Benchmark-Vergleich zurückgestellten Erweiterungen. Die
Quantil-Einordnung gegen den Regionsreport der Gemeinde (`regionMarketData.ts`,
`estimateQuantilePosition`/`findClosestQuantileRow`) existierte bereits, aber nur
gebündelt in einem separaten Panel weiter unten auf der Objektseite
(`MarktEinordnungView.tsx`) — nicht direkt dort, wo die Miete tatsächlich erfasst wird.

- **`regionMarketData.ts`**: `quantileLabel(position)` (Formatierung "< 10%-Quantil" /
  "≈ X%-Quantil" / "> 90%-Quantil") aus `MarktEinordnungView.tsx` extrahiert und exportiert
  — Single Source of Truth, jetzt von beiden Stellen verwendet statt dupliziert.
- **`BestandsrenditeFactsFields.tsx`**: neuer optionaler Prop `regionMarkt?: { regionData,
  wohnflaecheM2 }`. Direkt unter dem Feld "Nettomiete Wohnung unmöbliert" erscheint bei
  gesetzter Zimmerzahl ein Live-Hinweis ("Markteinordnung: ≈ 43%-Quantil der Gemeinde
  Wohlen (3.5-Zimmer, 50%: CHF 245/m²/Jahr)"), neu berechnet bei jeder Änderung von Miete
  ODER Zimmerzahl (`onChange`-Handler auf beiden bereits vorhandenen unkontrollierten
  Feldern, gleiches Ref-Muster wie beim bestehenden "Marktschätzung vorschlagen"-Button —
  der ruft den Hinweis nach dem Befüllen jetzt ebenfalls manuell nach, da er den Wert
  direkt per Ref statt per Nutzereingabe setzt und dadurch kein `onChange`-Event auslöst).
  Bewusst NUR am unmöblierten Nettomiete-Feld (Paket 1) — die Regionsreport-Quantile
  (`preise.mietwohnungen`) spiegeln reguläre unmöblierte Marktmiete; ein Vergleich der
  möblierten Miete (Paket 2, strukturell höher wegen Möblierungsaufschlag) gegen dieselbe
  Tabelle wäre systematisch irreführend. Aussenparkplatz-/Garage-/Hobbyraum-Miete bleiben
  ebenfalls ohne Hinweis — der Regionsreport deckt diese Kategorien gar nicht ab.
- **`BestandsrenditeVertiefungForm.tsx`** / **`objekte/[id]/page.tsx`**: `regionMarkt`
  durchgereicht, mit denselben bereits serverseitig geladenen `regionData`/`facts`-Werten,
  die auch `MarktEinordnungView` und das Ampelsystem verwenden — kein neuer Datenzugriff.
- **Bewusst NICHT im Neu-Erfassen-Flow (`PropertyCreateForm.tsx`) verdrahtet.** Dort ist
  beim Ausfüllen noch keine Region-Zuordnung vorhanden (Gemeinde wird live eingetippt,
  `regionData` wird bisher ausschliesslich serverseitig für ein bereits gespeichertes
  Objekt geladen) — das hätte eine neue client-seitige Region-Lookup-API-Route gebraucht,
  eine spürbar grössere Erweiterung als das hier angefragte Feedback an den bestehenden
  Feldern. Gleiche Begründungslinie wie beim PDF-Ampelsystem (siehe Eintrag oben): der
  Markt-Feedback-Loop gilt für bereits erfasste Objekte auf der Bearbeiten-Seite, nicht für
  die Ersterfassung.

Neue Tests (`regionMarketData.test.ts`): `quantileLabel` für alle drei `QuantilePosition`-
Ausprägungen. Kein Komponententest für `BestandsrenditeFactsFields.tsx` selbst — die App
hat bislang keine React-Komponententests etabliert (ausschliesslich Logik-Tests auf
lib-Ebene), dieses Feature bricht mit dieser Konvention bewusst nicht.

## Nachgezogen (2026-08-27): UBS Wohnattraktivitätsindikator 2026 als Standort-Kontexthinweis

Wunsch: eine aktuelle UBS-Medienmitteilung ("UBS Wohnattraktivitätsindikator 2026", 27.
August 2026) "entsprechend verwerten und einbauen". Die Mitteilung ist ein reiner
Fliesstext-Bericht (kein Datenexport) mit einer Livability-Rangliste (Infrastruktur,
Freizeit, Lebenshaltungskosten, Erreichbarkeit) über zehn schweizweite
Arbeitsmarktgrossregionen — konzeptionell etwas anderes als die bereits vorhandenen
`regionMarketData.ts`-Reports (dort: Miet-/Kaufpreis-Quantile je Gemeinde aus
hochgeladenen Marktreports).

Vor der Umsetzung versucht, die in der Mitteilung genannte vollständige Rangliste unter
`www.ubs.com/gemeinderanking` abzurufen (dort läge Abdeckung für alle ~2000 Gemeinden
statt nur der in der Mitteilung namentlich genannten) — die Domain ist in dieser
Umgebung per Netzwerk-Egress blockiert, ein Abruf war nicht möglich. Umsetzung daher
bewusst NUR auf Basis der im dreiseitigen Dokument selbst namentlich genannten
Gemeinden beschränkt ("nichts wird erfunden") — Rückfrage an den Nutzer ergab keine
Präferenz für ein zusätzliches manuelles Eingabefeld für weitere, nicht gelistete
Gemeinden; bewusst nicht gebaut, um die Komplexität nicht ohne konkreten Bedarf zu
erhöhen (bei Bedarf jederzeit nachrüstbar).

- Neue Datei `ubsWohnattraktivitaet.ts`: statische Liste `UBS_WOHNATTRAKTIVITAET_2026`
  mit allen ~48 in der Mitteilung namentlich genannten Gemeinden (30 Top-3-Platzierungen
  über die 10 Regionen + 19 weitere Beispielgemeinden aus vier qualitativen Gruppen:
  attraktive Agglomerationsgemeinden, attraktive Agglomerationsrand-/Landgemeinden,
  steuergünstige Gemeinden für hohe Einkommen, bezahlbare Kleinzentren für tiefere
  Einkommen), inkl. Kanton je Gemeinde (allgemein bekannte Schweizer Geografie, nicht
  aus dem UBS-Dokument selbst abgeleitet — nötig für einen eindeutigen Abgleich, da
  Gemeindenamen kantonsübergreifend nicht eindeutig sind). `findUbsWohnattraktivitaet
  (canton, gemeinde)` gleicht Kanton+Gemeinde-Name (normalisiert, inkl. Aliase wie "Wil"
  für "Wil (SG)") ab und liefert `undefined`, wenn die Gemeinde nicht genannt ist —
  KEIN geschätzter/interpolierter Wert für die übrigen ~98% der Gemeinden.
- **Objektseite** (`objekte/[id]/page.tsx`): eine informative Zeile im Objektdaten-Header
  (analog zum bestehenden "Marktvergleich (manuell erfasst)"-Hinweis), nur sichtbar wenn
  ein Treffer existiert, z.B. "UBS Wohnattraktivitätsindikator 2026: Platz 1 von 3 in der
  Region Zürich-Aarau-Schaffhausen (Haushalt mit zwei Kindern, Ø-Einkommen)." — rein
  informativ, ohne Einfluss auf irgendeine Berechnung oder das Ampelsystem (bewusst NICHT
  als zusätzliche Ampel-Dimension, da es sich um eine reine Standort-/Lebensqualitäts-
  einschätzung handelt statt um eine finanzielle Kennzahl wie die übrigen Dimensionen).
- **Management-Summary-PDF** (`managementSummaryPdf.tsx`): dieselbe Kontextzeile
  zusätzlich als kleine graue Fusszeile unter der Ampel-Reihe — anders als beim
  Kaufpreis-vs-Markt-Ampel-Fund kein zusätzlicher asynchroner Datenzugriff nötig (rein
  synchrone lokale Tabellensuche), daher hier bewusst OHNE die dortige
  Kompaktheits-Einschränkung übernommen.

Neue Tests (`ubsWohnattraktivitaet.test.ts`): Gross-/Kleinschreibung, Klammer-Suffix-
Aliase ("Wil (SG)" → "Wil"), Kanton-Pflicht (verhindert Fehltreffer bei
kantonsübergreifend gleichnamigen Gemeinden), `undefined` bei fehlenden Angaben und bei
nicht gelisteten Gemeinden, sowie ein Struktur-Check (genau 3 Ränge je der 10 Regionen).

## Nachgezogen (2026-08-29): Quellenverzeichnis (Studien/Marktberichte/Referenzdokumente)

Wunsch: "ein verzeichnis hinzufügen, welches die studien, dokumente etc auflistet mit
verlinkung auf das dokument" — direkter Anlass war die UBS-Wohnattraktivitätsindikator-
Mitteilung (siehe Eintrag oben), aber als eigenständige, allgemeine Ablage für
zukünftige Studien/Marktberichte gedacht, nicht auf diese eine Quelle beschränkt.

Bewusst als eigenständige, neue Entität konzipiert statt an `region_documents`
angehängt — konzeptionell verschieden: `region_documents` ist an eine Gemeinde
gebunden und wird per Claude strukturiert extrahiert (Miet-/Kaufpreis-Quantile), ein
Quellenverzeichnis-Eintrag ist unabhängig von Objekt/Region und braucht keine
KI-Auswertung, nur Metadaten + einen Link.

- **Migration `0009_quellen.sql`**: neue Tabelle `quellen` (Titel, Kategorie-Freitext
  mit Datalist-Vorschlägen "Studie"/"Marktbericht"/"Gesetzestext"/"Sonstiges",
  Herausgeber, Datum, Notizen) + neuer privater Storage-Bucket `quellen-dokumente`.
  Jeder Eintrag verlinkt auf GENAU eine von zwei Arten (Check-Constraint
  `quellen_exactly_one_link`): eine hochgeladene Datei (`storage_path`) ODER eine
  externe URL (`external_url`) — beide gleichzeitig oder keine sind ungültig. Manueller
  SQL-Schritt für den Nutzer nötig (wie bei jeder neuen Migration in dieser App).
- **`quellen.ts`**: dünne Supabase-Zugriffsschicht (`listQuellen`/`getQuelleById`),
  analog zu `regionMarketData.ts`s `listRegions`/`getRegionById` — bewusst ohne
  KI-Extraktionslogik.
- **API-Routen** (`api/quellen/…`): `POST /api/quellen` legt einen Eintrag an (validiert
  serverseitig, dass genau eine Link-Art gesetzt ist, dedupliziert hochgeladene Dateien
  über den bereits etablierten SHA-256-Content-Hash wie bei `region_documents`),
  `POST /api/quellen/signed-upload-url` mint eine Signed Upload URL für den Direkt-
  Upload zu Supabase Storage (Vercels 4.5-MB-Payload-Limit umgangen, gleiches Muster
  wie bei Regionsreports), `GET /api/quellen/[id]/download` liefert EIN uniformes
  Link-Ziel für die UI unabhängig von der Link-Art (leitet bei einer Datei kurzlebig auf
  eine frisch erzeugte Signed URL weiter, bei einer externen URL direkt dorthin — neu
  in dieser App: bisher gab es keine "Datei ansehen/herunterladen"-Route, nur
  Upload-Routen), `DELETE /api/quellen/[id]` löscht Zeile + ggf. Storage-Objekt.
- **UI**: neue Seite `/quellen` (SideNav-Eintrag "Quellen", Icon `doc`) — Formular zum
  Erfassen (Titel/Kategorie/Herausgeber/Datum/Notizen + Wahl zwischen Datei-Upload und
  externer URL) direkt über einer Tabelle aller bereits erfassten Quellen, mirrort
  strukturell `/regionen` (ein einziges Formular + eine Tabelle auf derselben Seite,
  kein mehrstufiger Wizard).

Bewusst NICHT umgesetzt: keine automatische Verknüpfung einzelner Objekte/Gemeinden mit
Quellenverzeichnis-Einträgen (z.B. "diese Quelle betrifft Gemeinde X") — die neue
UBS-Zuordnung (`ubsWohnattraktivitaet.ts`) bleibt bewusst als eigener, spezifisch
strukturierter Datensatz bestehen statt generisch ans Quellenverzeichnis gekoppelt zu
werden; das Quellenverzeichnis selbst ist eine reine, unstrukturierte Ablage/Bibliothek.
Keine KI-Extraktion der hochgeladenen Dateien (anders als bei Objekt-/Regionsdokumenten)
— bei Bedarf später nachrüstbar, aber für eine reine Verlinkungsliste nicht angefragt.

Keine neuen automatisierten Tests: `quellen.ts` besteht ausschliesslich aus dünnen
Supabase-Zugriffsfunktionen ohne eigene Logik — konsistent mit dem bestehenden Muster,
dass auch `regionMarketData.ts`s äquivalente `listRegions`/`getRegionById`-Funktionen
nicht separat unit-getestet sind (nur die reinen Rechenfunktionen wie
`estimateQuantilePosition` haben Tests).

## Bewusst weiterhin nicht gebaut

- Mehrbenutzer-Login (nur die eine bekannte E-Mail-Adresse des Auftraggebers).
- Automatisierter Abruf/Scraping von Inserat-Links (siehe oben — bewusste Entscheidung wegen
  Portal-Blockaden). Die Objekt-Grunderfassung selbst ist weiterhin ein manueller Schritt
  (Formular ausfüllen bzw. bestätigen), auch wenn er sich jetzt optional aus Dokumenten
  vorausfüllen lässt — es gibt kein Portal-Scraping/E-Mail-Ingestion wie bei LandFinder.
