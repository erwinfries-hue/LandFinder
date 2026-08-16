# HOME4efFINDER — Bestandsaufnahme LandFinder & Gap-Analyse

Stand: 2026-08-16. Zweck dieses Dokuments: bevor irgendetwas für HOME4efFINDER
neu geplant oder gebaut wird, zeigt dieses Dokument, was LandFinder heute
bereits kann — Code-Fakt für Code-Fakt, nicht aus dem README, sondern aus
tatsächlicher Analyse des Repos. Darauf folgt eine Gap-Analyse gegen die
HOME4efFINDER-Vision (4efRENDITE + 4efHOME auf gemeinsamer Datenbasis, KI
optional statt fundamental). **Es wurden bewusst keine neuen SIPIS/HOME4ef-
Unterlagen oder Architektur-Entscheidungen erzeugt** — das folgt erst nach
Rückmeldung zu diesem Dokument.

---

## 1. Ist-Zustand: Was LandFinder heute bereits kann

LandFinder ("SIPIS LandFinder") ist ein privates Akquisitionstool für
**Schweizer Bauland und Grundstücke mit Abbruchobjekt** — also
Development-Sites, nicht Bestandsimmobilien. Das ist für die Gap-Analyse in
Abschnitt 3 zentral.

### 1.1 Datenerfassung (Ingestion) — schmal, aber produktiv im Einsatz

Der reale, funktionierende Pfad läuft **nicht** über die dafür vorgesehenen
Packages (`packages/data-sources`, `packages/ingestion`,
`packages/portal-adapters`, `packages/generic-url-import` sind alle leere
Platzhalter — nur README, kein Code), sondern direkt in `apps/web`:

- **Suchabo-E-Mails** von Homegate, ImmoScout24.ch und newhome.ch werden an
  einen Postmark-Inbound-Webhook weitergeleitet
  (`api/inbound/portal-alerts/route.ts`) → Ablage in `inbound_alerts`.
  Bewusste Entscheidung laut `docs/PORTAL_ACCESS_REVIEW.md`: **kein**
  Scraping, **kein** systematisches Crawling — die ToS der Portale (SMG
  Swiss Marketplace Group für Homegate/ImmoScout24, newhome mit
  Vertragsstrafe CHF 5'000 für unautorisierte Nutzung) verbieten das.
- Aus der Alert-Mail wird die eine genannte Inserat-URL abgerufen
  (`fetchListingPage.ts`) und per Regex-Heuristik oder — sobald ein
  `ANTHROPIC_API_KEY` gesetzt ist — per Claude strukturiert extrahiert
  (`listingExtraction.ts`). Aktuell läuft **ausschliesslich die
  Heuristik**, da kein Key hinterlegt ist.
- Ergebnis landet dedupliziert (`canonical_url` UNIQUE) in der Tabelle
  `listings`, mit voller Provenienz (Extraktionsmethode + Konfidenz pro
  Feld), Status (NEW/PARTIAL/MANUAL_INPUT_REQUIRED/BLOCKED/TIMEOUT), Kanton
  (aus PLZ dedultion, 3'376 Schweizer PLZ hinterlegt), Zonen-Erkennung
  (Wohn-/Kern-/Gewerbezone etc. aus Fliesstext), Fläche.
- **Bekannte reale Einschränkung:** newhome blockiert automatisierte Abrufe
  aktiv (vermutlich JS-Challenge) — dokumentiert, nicht gelöst.
- Eine Admin-Route (`/api/admin/backfill-addresses`) füllt nachträglich
  fehlende Felder auf, wiederholt aufrufbar — kein Wegwerf-Skript, sondern
  Dauerfeature. Über zehn dokumentierte Bugfixes seit dem 6.8. zeigen: das
  ist gegen **echte Produktionsdaten** gehärtet, nicht nur gegen Testfälle.
- **Nicht vorhanden:** IMAP-Polling (nur Push-Webhook), generischer
  URL-Import (Button auf dem Dashboard existiert visuell, ist aber nicht
  verdrahtet), jede Form von Behörden-/Geodaten-Anbindung (GeoAdmin, ÖREB,
  BFS, ARE — alles nur als Plan in `packages/data-sources/README.md`),
  Wüest-CSV-Import (Schema in `docs/WUEST_CSV_SCHEMA.md` definiert, zwei
  echte Reports manuell in `data/wuest/` übertragen, aber kein Importer-Code).

### 1.2 Analyse-Engine (Scoring + Finanzen) — vollständig, aber
**Development-spezifisch**

`packages/scoring-engine` und `packages/financial-engine` sind fertig,
getestet (≈90 Unit-Tests laut READMEs) und vollständig parametrisiert (jeder
Faktor als benannter `ParameterDescriptor`, nichts hartcodiert):

- **13 Hard Gates** (nicht kompensierbar durch Score): Lage erkennbar,
  Region-Match, Objektart, Baurecht-Ausschluss, Bauzone, Wohnnutzung
  zulässig, Altlasten, Naturgefahren, Zufahrt/Erschliessung, Preis-Max,
  Preis/m²-Max, Projektvolumen-Max, Eigenkapital-Max, Mindest-NRA.
- **100-Punkte-Score** aus 5 Kategorien: Wirtschaftlichkeit (40),
  Baupotenzial (25), Markt (15), Lage (10), Risiko (10, Abzugsbasis).
- **Finanz-Engine**: Baupotenzial-Schätzung (Ausnützungs-/Baumassen-/
  Überbauungsziffer), Projektkostenstack (Grundstück, Abbruch, Sanierung,
  Bau, Baunebenkosten), Ertrags-/Finanzierungsrechnung (NOI, DSCR,
  Cash-on-Cash), **Residualwertrechnung** (Verkehrswert − Kosten − Zielgewinn
  = Grundstücks-Residualwert), Basis-/Stress-Szenarien.
- Alle Gewichte/Bandbreiten sind über die `/suchprofil`-Wizard-UI
  ("Annahmen & Formeln"-Tab, 71 editierbare Werte) live veränderbar und
  fliessen tatsächlich in die Berechnung ein — nicht dekorativ.
- **Zentraler Befund:** Diese gesamte Engine ist auf **Grundstücks-/
  Development-Unterwriting** zugeschnitten — Ausnützungsziffer,
  Residualwert, Baukosten, Baupotenzial. Es gibt **keine** Logik für den
  Kauf einer bestehenden Eigentumswohnung (Kaufpreisfaktor, Mietrendite auf
  Bestand, STWEG-Zustand, Sanierungsstau, Erneuerungsfonds) — das ist eine
  andere Rechenlogik, nicht nur ein anderes Suchprofil (siehe Abschnitt 3).

### 1.3 Vergleich & Historie

`packages/comparison-engine` ist fertig (Rang/Perzentil je Kanton,
Preis-/Score-Delta über Zeit via `computeChange()`), wird aber **nirgends
persistiert** (keine `comparisons`-Tabelle) und auf der `/vergleich`-Seite
nur als Platzhalter angezeigt — die Logik existiert, die Seite nicht.
Preis-Historie pro Inserat ist im Datenmodell nicht vorgesehen (nur
`first_seen_at`/`last_seen_at`, kein Preisverlauf).

### 1.4 Suchprofil-Konfiguration — vollständig, aber **ein einziges globales
Profil**

Die `/suchprofil`-Wizard-UI deckt alle 12 fachlichen Bereiche ab (Region,
Budget, Objektart, Grundstück, Projektziel, Eigennutzung, Marktannahmen,
Baukosten, Finanzierung, Renditeziele, Risiken, Alerts) plus Annahmen-Register,
persistiert in Supabase (`app_state`-Tabelle) mit `localStorage`-Fallback.
**Es gibt nur ein Suchprofil pro Deployment** (Singleton-Key), keine
Mehrfach-Profile — relevant für die 4efRENDITE/4efHOME-Trennung, siehe unten.

### 1.5 UI / Frontend

- `/quellen` + `/quellen/[id]`: real, live gegen Supabase — die einzige
  Seite, die tatsächlich mit echten Inseraten arbeitet. Inkl. manueller
  "Objekt vertiefen"-Erfassung (Zone, Ausnützung, ÖV-Güteklasse,
  Koordinaten, Risikoflags) und darauf aufbauender Live-Score-Berechnung.
- Dashboard (`/`), Objektliste (`/objekte`), 5 von 6 Objekt-Detailseiten,
  `/vergleich`: **Demo-Daten oder Platzhalter**, nicht an echte Daten
  angebunden. Nur ein einziges Demo-Objekt ("Cham") rechnet live durch die
  echte Engine.
- Design-System `packages/ui` ("Vermessung/Kataster"-Optik): klein (11
  Komponenten), aber real und konsistent durchgängig genutzt — kein
  Drittanbieter-Framework, komplett handgebaut.
- **Keine Karte** — nur ein Link zu Google Maps (`MapLink.tsx`), kein
  eingebettetes Kartenmodul.

### 1.6 Automatisierung

**Es existiert kein Scheduler/Cron irgendwo im Repo.** Alle fünf
`workers/*`-Verzeichnisse (analysis, digest, email-poller, enrichment,
portal-crawler) enthalten nur ein README ("Noch nicht implementiert").
Der einzige reale Trigger-Mechanismus ist ereignisgesteuert: eingehende
E-Mail → Webhook → sofortige asynchrone Verarbeitung. Ein täglicher Digest
oder ein wiederkehrender Scan bräuchte einen neuen Vercel-Cron-Job — das ist
laut `docs/OPEN_DECISIONS.md` explizit als offene Infrastruktur-Entscheidung
vermerkt, nicht nur als fehlender Code.

### 1.7 Benachrichtigungen

Sofort-Alert-E-Mail-Code ist fertig (`sendAlertEmail.ts`, Resend-API via
`fetch`, Dedup, Tageslimit) aber **inaktiv**, da kein `RESEND_API_KEY`
gesetzt ist. Digest-Modus nicht gebaut. Kein Push, kein SMS.

### 1.8 KI-Einsatz heute — bereits optional und randständig, nicht fundamental

Das ist eine wichtige Übereinstimmung mit der HOME4efFINDER-Prämisse:
LandFinder ist **bereits so gebaut**, dass KI nur an einer einzigen, klar
abgegrenzten Stelle zum Einsatz kommt — der Text-Extraktion aus
Inserats-Seiten/E-Mails (`listingExtraction.ts`, `@anthropic-ai/sdk`,
schaltet sich automatisch scharf, sobald `ANTHROPIC_API_KEY` gesetzt ist,
sonst sauberer Fallback auf Regex-Heuristik). Score- und
Finanzberechnungen laufen **nie** über ein LLM — reine, deterministische,
parametrisierte Formeln. `SearchProfileQuellen.llmEnabled` ist im Suchprofil
sogar explizit togglebar und defaultet auf `false`. Für STWEG-Protokolle,
Verkaufsdokumentationen oder qualitative Risikobewertung — also den
KI-Anwendungsfall, den du für HOME4efFINDER vorsiehst — gibt es aktuell
**keinerlei** Code (`packages/llm` ist ein leerer Platzhalter für die
allgemeine Provider-Abstraktion, keine Dokumentenanalyse irgendwo).

### 1.9 Sicherheit / Zugriff

Passwortschutz (ein geteiltes `APP_PASSWORD`, HMAC-signiertes Cookie,
fail-closed) für 2–5 bekannte Nutzer, kein Self-Signup, kein Einzelkonten-
Login. Für den privaten Rahmen von HOME4efFINDER vermutlich ausreichend.

### Reifegrad auf einen Blick

| Bereich | Status |
|---|---|
| E-Mail-Intake (Postmark-Webhook, 3 Portale) | **Fertig, produktiv** |
| Einzel-Seiten-Abruf + Extraktion (Heuristik) | **Fertig, produktiv** |
| Extraktion via LLM (Anthropic) | Code fertig, **inaktiv** (kein Key) |
| Dedup, Kanton-/Zonen-Ableitung, Backfill-Wartung | **Fertig, produktiv** |
| Scoring-Engine (Hard Gates + 100-Pkt-Score) | **Fertig**, Development-spezifisch |
| Financial-Engine (Baupotenzial, Residualwert, Szenarien) | **Fertig**, Development-spezifisch |
| Comparison-Engine (Rang/Perzentil/Delta) | Fertig als Logik, **nicht persistiert, keine UI** |
| Suchprofil-Wizard inkl. Annahmen-Register | **Fertig**, aber nur 1 globales Profil |
| `/quellen`-Seite (reale Inserate, Vertiefung, Live-Score) | **Fertig, produktiv** |
| Dashboard/Objektliste/Objekt-Details (bis auf 1 Demo) | **Demo-Daten, nicht live** |
| `/vergleich` | **Platzhalter** |
| Automatisierung/Scheduler/Digest | **Nicht vorhanden** |
| Alert-E-Mails | Code fertig, **inaktiv** (kein Key) |
| Karten/Gemeindedaten (GeoAdmin, ÖREB, BFS) | **Nicht vorhanden** — nur Google-Maps-Link |
| Dokumenten-KI (STWEG, Verkaufsdoku) | **Nicht vorhanden** |
| Generischer URL-Import | **Nicht vorhanden** (Button ohne Funktion) |

---

## 2. Wichtigster Befund für die Architektur-Entscheidung

Deine zwei Prämissen aus dem Master-Briefing:

> Erstens: 4efRENDITE und 4efHOME sollten keine zwei getrennten Apps werden
> ... Getrennt werden nur Suchprofil, Scoring, Dealbreaker und
> Entscheidungslogik.

LandFinder bestätigt das teilweise, widerlegt es teilweise:

- **Bestätigt:** Die Ingestion-Schicht (E-Mail-Intake, Extraktion, Dedup,
  Kanton-Ableitung, Quellen-UI) ist tatsächlich objektartunabhängig gebaut
  und liesse sich für Bestandsimmobilien (Eigentumswohnungen, Häuser) sehr
  wahrscheinlich **wiederverwenden** — die Portale (Homegate, ImmoScout24,
  newhome) listen ohnehin beide Objektarten, der Intake-Mechanismus
  unterscheidet nicht danach.
- **Nicht bestätigt:** Die "teure Infrastruktur", die du als gemeinsam
  ansiehst — "Dokumente, Gemeindedaten, Karten, Historie, Vergleich" —
  **existiert grösstenteils noch gar nicht**. Dokumente (STWEG-Protokolle):
  0 Code. Gemeindedaten/Karten: 0 Code (nur eine PLZ→Kanton-Tabelle und ein
  externer Maps-Link). Vergleich: Logik ja, Persistenz/UI nein. Historie:
  Datenmodell sieht das nicht vor. Das ist also nicht "vorhanden und
  wiederverwendbar", sondern in weiten Teilen **komplett neu zu bauen** —
  und zwar so, dass es für beide Objektarten gleichzeitig funktioniert.
- **Wichtigste Differenzierung, die über "nur Suchprofil/Scoring/
  Dealbreaker trennen" hinausgeht:** Financial-Engine und Scoring-Engine
  sind nicht nur unterschiedlich *parametrisiert* für Development vs.
  Bestand — sie brauchen **strukturell andere Berechnungsmodelle**.
  4efRENDITE (Bauland/Development, wie heute) rechnet mit
  Residualwert/Baupotenzial/Baukostenstack. 4efHOME (Bestandskauf, vermutlich
  Eigennutzung oder Bestandsrendite) bräuchte z. B. Kaufpreisfaktor,
  Vergleichswertverfahren, Sanierungsstau-Bewertung, STWEG-Kennzahlen
  (Erneuerungsfonds-Deckungsgrad, Beschlusshistorie). Das ist keine zweite
  Parameter-Tabelle im selben Modell, sondern eine **zweite Rechenlogik** —
  strukturell näher an "zwei Engines mit gemeinsamer Datenschicht" als an
  "eine Engine, zwei Konfigurationen".

Das heisst nicht, dass die Grundidee falsch ist — die geteilte
Ingestion/Datenbasis ist weiterhin sinnvoll und der grösste Hebel. Es
bedeutet nur: der Aufwand liegt weniger im "Trennen" von Suchprofil/Scoring
(das ist mit der bestehenden Architektur relativ leicht ergänzbar, siehe
Gap-Analyse) und mehr im **Neubau** der geteilten Infrastruktur, die im
Master-Briefing implizit als "schon vorhanden" mitgedacht wird.

---

## 3. Gap-Analyse gegen die HOME4efFINDER-Vision

### 3.1 Damit die "geteilte Infrastruktur"-Idee überhaupt zutrifft

| Baustein | Ist-Zustand | Aufwand-Einschätzung |
|---|---|---|
| Mehrere Suchprofile (statt 1 globales) | Singleton-Key in `app_state`; Datenmodell/UI müsste auf profilgebundene Keys umgestellt werden | Mittel — Datenmodell-Änderung, aber kein Neuland |
| Zwei Scoring-/Dealbreaker-Sets parallel | Heute 1 Satz Hard Gates + 1 Score-Formel-Satz, beide fest auf Development ausgelegt | Hoch — echte zweite Rechenlogik nötig, nicht nur Parameter |
| Preis-/Status-Historie je Inserat | Nicht im Datenmodell (`listings` hat nur first/last_seen) | Mittel |
| Vergleich (persistiert, mit UI) | Logik fertig, Persistenz + UI fehlen | Niedrig-Mittel |
| Dokumente (Upload, Ablage, Verknüpfung mit Objekt) | Nicht vorhanden | Hoch — komplett neu (Storage, Typen, UI) |
| Gemeindedaten (Steuerfuss, Bauzonenplan, Lärm, Gefahrenkarte) | Nicht vorhanden, nur als Plan in `packages/data-sources/README.md` | Hoch — mehrere Behörden-APIs, teils mit Zugriffsklärung |
| Karte (eingebettet, nicht nur Link) | Nicht vorhanden | Mittel — Kartenbibliothek + Geokoordinaten fehlen komplett |
| Automatisierter, wiederkehrender Scan/Digest | Kein Scheduler im System | Mittel — Vercel Cron ist die naheliegende Lösung, aber neue Infra-Entscheidung |

### 3.2 Speziell für 4efHOME (Bestandsimmobilien)

- **Objektart-Unterstützung fehlt strukturell:** `object_type` im
  Datenmodell ist offen (string), aber die gesamte Scoring-/Financial-Logik
  kennt nur Development-Kennzahlen. Für 4efHOME bräuchte es entweder eine
  zweite Engine oder eine grundlegende Erweiterung der bestehenden.
- **STWEG-Protokolle/Verkaufsdokumentation/qualitative Risiken** — laut
  deinem Briefing der Hauptanwendungsfall für KI bei 4efHOME — existieren
  im Code überhaupt nicht: kein Dokumenten-Upload, kein Parser, keine
  KI-gestützte Auswertung. Das ist vollständiger Neubau, auch wenn die
  Anthropic-Anbindung als Muster (Fallback-Pattern: Heuristik ohne Key,
  echtes LLM mit Key) direkt wiederverwendbar ist.
- **Vergleichswert-/Marktdaten für Bestand** (nicht Development): Die
  vorhandenen Wüest-Partner-Daten (`data/wuest/`) enthalten laut Schema
  Miet-/Preis-Mediane, Transaktionsindizes — das ist eher für Bestandskauf
  relevant als für Development und bisher komplett ungenutzt (kein
  Importer-Code). Hier liegt ungenutztes Potenzial, das für 4efHOME
  wahrscheinlich wichtiger ist als für 4efRENDITE.

### 3.3 Für 4efRENDITE (im Wesentlichen die heutige LandFinder-Ausrichtung)

Weitgehend inkrementell erweiterbar auf Basis des Bestehenden:
- Mehr Portale/Quellen (aktuell nur 3, plus kein genereller URL-Import)
- Automatisierung/Digest (Scheduler fehlt)
- Persistierter Vergleich, Preis-Historie
- Karten-/Gemeindedaten-Anreicherung (auch für 4efRENDITE relevant:
  Bauzonenplan, Gefahrenkarte, Lärm — alles heute manuell in "Objekt
  vertiefen" statt automatisch angereichert)

### 3.4 KI-Optionalität — Vision ist bereits eingelöst, nicht neu zu erfinden

Das architektonische Muster, das du für HOME4efFINDER forderst ("80–90 %
auch ohne KI"), ist in LandFinder bereits vorhanden und bewährt: die
Extraktions-Pipeline läuft standardmässig auf Heuristik, schaltet bei
vorhandenem API-Key transparent auf echtes LLM um, und die eigentliche
Bewertungslogik (Score, Finanzen) berührt nie ein LLM. Dieses Muster sollte
für die STWEG-/Dokumenten-KI von 4efHOME 1:1 übernommen werden, statt neu
entworfen zu werden.

---

## 4. Bereits vom Projekt dokumentierte offene Punkte (aus `docs/OPEN_DECISIONS.md`)

Zur Vollständigkeit — diese Entscheidungen sind für dich als Auftraggeber
bereits im Repo protokolliert und teils noch offen:

- **B — LLM-Provider:** Anthropic empfohlen, Code bereit, Key fehlt noch.
- **C — Infrastruktur:** Hosting (Vercel) + Supabase + Postmark-Inbound
  stehen; Resend (Alert-Mails) und Anthropic-Key fehlen noch; Digest-Modus
  bräuchte zusätzlich einen Cron-Job (offene Infra-Entscheidung).
- **D — Nutzerkreis:** entschieden — geteiltes Passwort für 2–5 Nutzer,
  kein Einzelaccount-System.
- **E — Wüest Partner:** Lizenz vorhanden, 2 Reports manuell übertragen,
  automatischer PDF-Import bewusst nicht im Scope; ob Wüest-Werte in
  Alert-Mails an Dritte weitergegeben werden dürfen, bleibt ungeklärt
  (Wüest antwortet laut Notiz vom 10.8. nicht zeitnah) — für internen
  Gebrauch unproblematisch.
- **F — Geschäftsannahmen:** Wizard steht, aber real noch **null** echte
  Inserate vollständig "vertieft" (Stand des Dokuments) — die
  Rangliste/Dashboard zeigt deshalb weiterhin nur Demo-Objekte.
- **A — Portal-Scraping:** ausführlich dokumentierte Historie von zehn+
  Bugfixes gegen echte Produktionsdaten — zeigt, wie viel Detailarbeit
  allein in einer robusten Drei-Portale-Ingestion steckt. Wichtig als
  Erwartungswert für den Aufwand weiterer Quellen.

---

## 5. Offene Fragen zur Klärung (keine Entscheidung, nur Diskussionspunkte)

Bevor konkret geplant wird, wären für mich folgende Punkte klärend:

1. **Wie unterschiedlich ist die Zielgruppe von 4efHOME wirklich?**
   Eigennutzung (Kauf für sich selbst) vs. Bestandsrendite (Kauf zur
   Vermietung) sind selbst schon zwei verschiedene Bewertungslogiken — comparable
   zur bestehenden `eigennutzung.ts`-Trennung im Financial-Engine, nur für
   Bestand statt Development. Welche der beiden (oder beide) sind gemeint?
2. **Soll 4efRENDITE weiterhin nur Development/Bauland abdecken, oder auch
   Bestandsrenditeobjekte** (z. B. ein Mehrfamilienhaus zum Kauf, ohne
   Abbruch/Neubau)? Das würde die Scoring-/Financial-Trennung nochmal anders
   schneiden als "Development vs. Bestand".
3. **Prioritäten für die gemeinsame Infrastruktur:** Da vieles (Dokumente,
   Gemeindedaten, Karte, Vergleich-UI, Historie) faktisch neu gebaut werden
   muss statt wiederverwendet zu werden — was zuerst? Meine Einschätzung:
   Vergleich-Persistenz + Preis-Historie zuerst (kleinster Aufwand, nutzt
   bereits fertige Logik), Karten/Gemeindedaten als grösserer, aber isolierter
   nächster Block, Dokumenten-KI erst wenn 4efHOME-Scope steht.
4. **Automatisierung (Scheduler/Digest):** jetzt mit angehen (kleine,
   klar abgegrenzte Vercel-Cron-Entscheidung) oder zurückstellen?

Auf Basis deiner Antworten kann daraus ein konkreter Bauplan (Datenmodell-
Erweiterung, Architektur für zwei Scoring-Engines, Reihenfolge) entstehen —
bewusst noch nicht in diesem Dokument vorweggenommen.
