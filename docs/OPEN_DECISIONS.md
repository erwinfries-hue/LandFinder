# Offene Entscheidungen

Gebündelte Fragen, die kostenrelevant, rechtlich heikel oder scope-verändernd sind und daher nicht ohne Rückmeldung des Auftraggebers entschieden werden (siehe Masterprompt, Abschnitt 30, „Arbeitsweise“). Diese Liste wird laufend aktualisiert.

## A. Portal-Scraping (Homegate, ImmoScout24, newhome) — Discovery + Persistenz live
Entscheid (2026-08-06): **Tier 1 — Suchabo-/Alert-E-Mails**, kein HTML-Scraping und kein systematisches Crawling der Portale. Basis: `docs/PORTAL_ACCESS_REVIEW.md`. Zustellweg: **Postmark-Inbound-Webhook** (push statt poll). Vollständige Kette Ende-zu-Ende mit echtem Traffic verifiziert: Portal-Suchabo → Postmark (`docs/`-Server "LandFinder") → `apps/web/src/app/api/inbound/portal-alerts/route.ts` (parst Payload, filtert Inserat-Links via `apps/web/src/lib/inboundMail.ts` auf `homegate.ch`/`immoscout24.ch`/`newhome.ch`) → Supabase-Tabelle `inbound_alerts` (Migration `supabase/migrations/0001_inbound_alerts.sql`, RLS aktiv ohne Policies, nur `service_role` schreibt/liest). Erste echte Zeile am 2026-08-06 im Table Editor bestätigt. Optionaler Schutz per HTTP-Basic-Auth über `INBOUND_WEBHOOK_SECRET`. Bei Datenbank-Fehlern liefert die Route bewusst HTTP 500, damit Postmarks Retry-Mechanismus greift statt Treffer stillschweigend zu verlieren. **Kein Scraping-Code der Portale selbst läuft vor expliziter Freigabe.**

**Stufe 2 ist jetzt gebaut** (2026-08-06, mit deiner Freigabe): `apps/web/src/lib/fetchListingPage.ts` ruft gezielt genau die eine Inserat-URL ab, die uns die Suchabo-Mail bereits genannt hat (kein Crawlen/Suchen). `apps/web/src/lib/listingExtraction.ts` extrahiert daraus Felder — läuft im Mock-Modus (regelbasierte Heuristik, Konfidenz 25, Methode `MOCK_HEURISTIC`) bis `ANTHROPIC_API_KEY` gesetzt ist (Punkt B), danach automatisch mit echter Claude-Extraktion (Methode `ANTHROPIC`), ohne Code-Änderung. Ergebnis landet in der neuen Tabelle `listings` (Migration `0004_listings.sql`). Läuft über Next.js' `after()`, damit Postmark sofort eine Antwort bekommt statt auf externe Abrufe zu warten. Bewusst auf 2 Links pro Mail begrenzt (Vercel-Hobby-Zeitbudget: 10 Sekunden hartes Limit) — weitere Links bleiben unverarbeitet, aber sichtbar in `inbound_alerts.listing_links`. **Noch nicht in dieser Session getestet:** ob die Portale den Abruf durchlassen oder blockieren (aus der Sandbox heraus nicht prüfbar, nur in Produktion) — bei Blockade landet der Link mit `ingestion_status: 'BLOCKED'` in `listings`, kein Absturz.

**newhome blockiert den Abruf in Produktion (2026-08-07, real beobachtet):** die ersten 4 echten newhome-Links landeten mit `BLOCKED`/`NOT_AVAILABLE` in `listings` — genau das im Portal-Zugriffs-Review (`docs/PORTAL_ACCESS_REVIEW.md`) erwartete Szenario. Migration `0004_listings_fetch_diagnostics.sql` ergänzt `last_fetch_http_status`/`last_fetch_at`, damit künftige Blockaden nachvollziehbar sind (z.B. 403 vs. 429 vs. Timeout), sichtbar auf der `/quellen/[id]`-Detailseite. **Entscheid (2026-08-07, explizit angefragt und von dir freigegeben):** `fetchListingPage.ts` gibt sich jetzt als gewöhnlicher Browser aus (Chrome-User-Agent, `Accept`/`Accept-Language`-Header) statt sich als Bot zu identifizieren — der vorherige, selbstauskunftgebende User-Agent (`LandFinderBot/1.0`) wurde von newhome blockiert. Wichtig: das wirkt nur gegen einfache Header-/UA-basierte Bot-Erkennung, nicht gegen JS-Challenges (Cloudflare-artig) — ob es bei newhome tatsächlich hilft, ist unverifiziert (aus der Sandbox nicht gegen die echten Portale testbar), erst der nächste echte Suchabo-Durchlauf zeigt es (`last_fetch_http_status` auf der Quellen-Detailseite). Bewusst weiterhin nur ein Abruf der einen, bereits per Suchabo-Mail bekannten URL — kein Crawlen/Durchsuchen des Portal-Katalogs, das bleibt ausgeschlossen. Stufe 1 (Suchabo-Mail mit Original-Link) funktioniert für newhome ohnehin unabhängig von diesem Fetch-Erfolg.

**Sichtbar in der App (2026-08-06):** `inbound_alerts` und `listings` waren bisher nur über das Supabase-Dashboard einsehbar. Die Seite `/quellen` zeigt jetzt beides direkt in LandFinder: eine Übersichtstabelle aller extrahierten Inserate (mit Kanton, Typ, Preis, Fläche, Status) sowie eine `/quellen/[id]`-Detailseite je Inserat (alle Felder inkl. Extraktionsmethode/-konfidenz). In Übersicht und Detail führt ein aktiver Link (`ListingLink`, `packages/ui/src/ListingLink.tsx`) direkt zum Original-Inserat beim Portal. Darunter eine Tabelle der eingehenden Suchabo-Mails mit den darin gefundenen Links, ebenfalls aktiv verlinkt. `apps/web/src/lib/processListingLinks.ts` hat jetzt Tests (`processListingLinks.test.ts`, 8 Fälle: Erfolg/Heuristik, Erfolg/Anthropic, alle Fehlerfälle, Quellenerkennung, `MAX_LINKS_PER_RUN`-Begrenzung, Fehler-Logging ohne Abbruch).

**Bug behoben (2026-08-07): `/quellen` zeigte veraltete Daten.** Next.js hatte die Übersichtsseite als statische Seite gebaut (kein für Next.js erkennbarer Request-abhängiger Code), eingefroren auf den Datenstand des jeweils letzten Deploys, statt bei jedem Aufruf neu aus Supabase zu lesen — sichtbar geworden, weil die Seite „0 Mails" zeigte, obwohl `inbound_alerts` bereits 22 echte Zeilen enthielt (Postmark hatte in der Woche zuvor 29 Suchabo-Mails erfolgreich geparst). Fix: `export const dynamic = "force-dynamic"` auf `/quellen/page.tsx` und `/quellen/[id]/page.tsx` erzwingt serverseitiges Rendering pro Aufruf. Bei der Gelegenheit auch bestätigt: der browserähnliche User-Agent (siehe oben) hat die newhome-Blockade **nicht** behoben — ein Abrufversuch von heute 10:40 Uhr (nach dem Fix) zeigte weiterhin `BLOCKIERT`. newhome nutzt vermutlich eine stärkere Bot-Erkennung als reine Header-/UA-Prüfung (z.B. JS-Challenge), die ein einfacher Seitenabruf grundsätzlich nicht umgehen kann.

**Homegate-Inserate blieben leer trotz "erfolgreichem" Abruf (2026-08-08, Ursache gefunden und behoben):** Nach dem `/quellen`-Fix zeigten Homegate-Einträge durchgehend „Ohne Titel" mit leeren Feldern, obwohl der Seitenabruf nicht blockiert war. Ursache, gemeinsam mit dir am echten Beispiel nachvollzogen: Homegate-Suchabo-Mails enthalten in ihrem HTML zwar Links auf `homegate.ch`-Subdomains, aber das sind ausschliesslich Logo-/Vorschaubilder (`media.homegate.ch`, `media2.homegate.ch`) — der echte "Anbieter kontaktieren"-Button läuft über einen SendGrid-Klick-Tracking-Link (`ct.sendgrid.net`), den unser Domain-Filter (bewusst) nicht erkennt. Stufe 2 rief also brav ein Bild statt der Inserat-Seite ab — kein Fehler, aber auch nichts Extrahierbares.

Lösung, Teil 1 (Mailinhalt direkt nutzen): `apps/web/src/lib/listingExtraction.ts` hat eine neue Funktion `extractFromEmailContent()` (Methode `EMAIL_HEURISTIC`, Konfidenz 30), die Preis, Adresse und Objektart direkt aus dem Text der Suchabo-Mail liest — viele Portale zeigen diese Angaben bereits im Mailtext (z.B. "CHF 2'970'000.–", "Friedhofweg 2, 4414 Füllinsdorf"). `processListingLinks.ts` nutzt das als Fallback, wenn der externe Seitenabruf nichts Brauchbares liefert (Bild-Link wie bei Homegate oder Blockade wie bei newhome). Bewusst **kein** Kanton-Raten aus dem Betreff — Suchabo-Mails listen dort oft alle abonnierten Kantone gleichzeitig auf (die Suchkriterien, nicht die Lage des konkreten Treffers), eine falsche Zuordnung wäre schlimmer als keine Angabe.

**Lösung, Teil 2 (2026-08-08, auf Wunsch nachgezogen): dem Tracking-Link folgen.** `apps/web/src/lib/inboundMail.ts` erkennt jetzt zusätzlich Klick-Tracking-Links (z.B. SendGrid) als Inserat-Link — aber nur, wenn der sichtbare Link-Text eindeutig auf eine Inserat-Aktion hindeutet ("kontaktieren", "inserat", "ansehen" etc.) und **nicht** auf Abmelden/Impressum/Datenschutz, da Marketing-Tools oft alle Links derselben Mail über denselben Tracking-Dienst schicken — sonst hätten wir riskiert, versehentlich den Abmelde-Link vom Suchabo aufzurufen. `fetchListingPage.ts` liefert jetzt zusätzlich `finalUrl` (die tatsächliche Ziel-URL nach der automatischen Weiterleitung, `res.url`); `processListingLinks.ts` verwendet diese als `canonical_url`, wenn sie zu einem der drei bekannten Portale gehört, und behandelt den Seiteninhalt nur dann als echte Inserat-Seite. Landet die Weiterleitung auf einer unbekannten Domain (unerwartet), bleibt es beim ursprünglichen Tracking-Link als `canonical_url`, und der Seiteninhalt wird **nicht** als Inserat-Daten interpretiert (Mail-Fallback aus Teil 1 greift stattdessen) — Sicherheitsnetz gegen eine überraschende Weiterleitung ins Leere.

**Drei Bugs behoben (2026-08-11), gefunden anhand eines echten `/quellen`-Datenauszugs, den du geteilt hast:**
1. *Doppelte Zeilen:* Wenn eine Mail mehrere Links enthielt (z.B. Logo- + Tracking-Link zum selben Treffer) und beide keine brauchbare Seiten-Extraktion lieferten, wurde für **jeden** Link derselben Mailinhalt-Fallback gespeichert — zwei fast identische Zeilen mit unterschiedlicher `canonical_url`. Fix: `processListingLinks.ts` verwendet den Mailinhalt-Fallback jetzt nur noch für den ersten Link, der ihn braucht; weitere Links derselben Mail bleiben beim eigenen (Fehler-)Status, ohne den Inhalt zu duplizieren.
2. *Unplausibler Preis:* Bei Mails mit mehreren Treffern ("3 neue Treffer") griff die Preis-Regex den ersten "CHF …"-Betrag im gesamten Mailtext — bei einer solchen Mail wurde so `CHF 1'150` (offensichtlich kein Kaufpreis) als `asking_price_chf` übernommen. Fix, zwei Ebenen: (a) `extractFromEmailContent()` extrahiert bei erkannten Mehrfach-Treffer-Mails jetzt bewusst **keinen** Preis/Adresse/Fläche mehr, da nicht zuordenbar, welchem der Treffer die Angabe gehört; (b) neue Plausibilitätsschwelle `MIN_PLAUSIBLE_PRICE_CHF` (50'000) in `listingExtraction.ts`, angewendet in beiden Extraktionspfaden (Heuristik und Mailinhalt) — ein Betrag darunter wird verworfen statt gespeichert, konsistent mit "nichts wird erfunden".
3. *HTML-Entity-Müll in der Beschreibung:* `stripHtml()` dekodierte/entfernte numerische HTML-Entities (z.B. `&#847;`) nicht, die manche Suchabo-Mails wiederholt als unsichtbaren Anti-Spam-Füllstoff enthalten — sichtbar als literaler `&#847; &#847; …`-Text im `description`-Feld der Detailseite. Fix: solche Entities werden jetzt vor der Textanalyse entfernt.
Alle drei mit neuen Tests abgedeckt (`listingExtraction.test.ts`, `processListingLinks.test.ts`); volle Test-/Lint-/Build-Kette grün.

**Datenbereinigung nachgezogen (2026-08-11)** — **erledigt**: der Code-Fix oben verhindert nur künftige Fälle — die schon vorher entstandenen Altlasten (Duplikate, `CHF 1'150`, `&#847;`-Müll) blieben in der Datenbank stehen, sichtbar in einem Auszug, den du geteilt hast. `supabase/migrations/0006_cleanup_bad_listings_data.sql` (kein Schema-Wechsel) räumte genau diese drei Fälle auf: entfernt Duplikate aus dem Mailinhalt-Fallback (pro Quelle/Titel/Adresse/Preis nur die älteste Zeile), nullt unplausible Preise unter `CHF 50'000`, bereinigt HTML-Entity-Müll in Titel/Beschreibung. Bewusst auf `EMAIL_HEURISTIC`-Zeilen beschränkt, um echte Seiten-Extraktionen nicht anzufassen. Von dir im Supabase SQL-Editor ausgeführt und bestätigt.

**Quellen-Tabelle: Standort/Kanton/Sortierung (2026-08-16)**, ausgelöst durch einen konkreten Treffer, bei dem Kanton leer blieb, obwohl die Adresse ("8545 Rickenbach Sulz") ihn eindeutig hergibt:
1. *Neue Spalte "Standort"* ersetzt die bisherige "Typ"-Spalte (zeigt jetzt `address_text`); der bisherige Typ-Inhalt (Objektart) steht neu in der Inserat-Zelle, zweite Zeile, hinter der Plattform mit Bindestrich getrennt (z.B. "HOMEGATE - Bauland").
2. *Kanton aus PLZ ableiten:* `apps/web/src/lib/plzKanton.ts` + `config/plz-kanton.json` — eine deterministische PLZ→Kanton-Zuordnung für rund 3'376 Schweizer Postleitzahlen (Quelle: Swiss-Post-PLZ-Verzeichnis via github.com/gamba/swiss-geolocation, Stand 2015; PLZ→Kanton-Zuordnungen ändern sich praktisch nie, da Gemeinden nie den Kanton wechseln). Rund 16 von 3'392 PLZ liegen genau auf einer Kantonsgrenze (z.B. 1410 FR/VD) — für diese bewusst **kein** Kanton hinterlegt statt zu raten. `listings.ts` ergänzt einen fehlenden `canton` beim Lesen anhand dieser Zuordnung (rein in der Anwendungsschicht, kein Rückschreiben in die Datenbank) — profitieren automatisch auch Vorprüfung und "Objekt vertiefen".
3. *Sortierbare Spalten:* beide Quellen-Tabellen nutzen jetzt `SortableTable` (`@landfinder/ui`, bisher nur in der Rangliste) über neue Client-Komponenten `QuellenListingsTable`/`QuellenMailsTable` statt einer statischen `<table>`. `SortableTable` bekam dafür ein neues optionales `wrapClassName`-Prop, damit der fixierte Header der Inserate-Tabelle (`scroll-y`) erhalten bleibt.

**Nachgezogen (2026-08-16), derselbe Treffer:** Standort blieb bei diesem Treffer trotzdem leer — Ursache war keine fehlende Kanton-Ableitung, sondern dass die Adresse selbst nie extrahiert wurde. Der Mailtext nennt aus Datenschutz-/Lead-Gen-Gründen nur PLZ + Ort ("8545 Rickenbach Sulz"), keine Strasse — die bisherige Adress-Regex in `listingExtraction.ts` verlangte zwingend eine Strasse davor. Fix: `matchAddress()` fällt jetzt auf reines PLZ + Ort zurück, wenn keine Strasse gefunden wird. Für den mehrwortigen Ortsnamen ("Rickenbach Sulz") reicht eine simple Gross-/Kleinschreibungs-Heuristik nicht sicher aus (hätte z.B. bei "... Füllinsdorf Anbieter kontaktieren" fälschlich "Anbieter" mit einbezogen, da im Fliesstext keine Satzzeichen zwischen Ort und folgendem Link-Text stehen) — deshalb neue Datei `config/plz-ort-multiword.json` (dieselbe Quelle wie `plz-kanton.json`) mit den bekannten echten, mehrwortigen Ortsnamen je PLZ; nur wenn der Text exakt mit einem davon beginnt, wird er komplett übernommen, sonst bleibt es beim sicheren einzelnen Wort.

**Bereinigung für bereits gespeicherte Zeilen** — **ausgeführt (2026-08-16)**: anders als bei der SQL-Migration vom 2026-08-11 lässt sich dieser Fix nicht als reines SQL-Skript nachziehen, da er echte Extraktionslogik (Regex + Ortsnamen-Lookup) braucht. Stattdessen neue Route `GET /api/admin/backfill-addresses` (hinter Login) — bewusst als **Dauerfeature** angelegt, nicht als Einmal-Wegwerf-Route: verarbeitet bei jedem Aufruf nur, was zu diesem Zeitpunkt noch fehlt (`address_text IS NULL`, Methode `EMAIL_HEURISTIC`), lädt dazu die passende Original-Mail aus `inbound_alerts` und lässt sie erneut durch die aktuelle `extractFromEmailContent()` laufen. Gefahrlos wiederholt aufrufbar — auch bei künftigen Extraktions-Fixes, nicht nur für diesen einen Anlass. Erster Lauf durch den Auftraggeber: `{"checked":14,"updated":11,"stillUnresolved":3}` — 11 von 14 lückenhaften Inseraten nachträglich ergänzt.

**Zuordnungs-Bug behoben (2026-08-16), anhand der 3 unaufgelösten Fälle:** alle drei scheiterten nicht an der Adress-Erkennung, sondern schon an der Mail-Zuordnung selbst — `listings.canonical_url` und der passende Link in `inbound_alerts.listing_links` zeigen zwar auf dasselbe Inserat, unterscheiden sich aber in den Tracking-Query-Parametern (z.B. unterschiedlich kodierte `utm_campaign=(...)`-Werte je nachdem, ob/wie der Link zwischenzeitlich aufgelöst wurde). Der bisherige exakte String-Vergleich fand deshalb nie eine Übereinstimmung. Fix: Zuordnung jetzt über Domain + Pfad ohne Query-String (`pathKey()`) — der Pfad allein identifiziert ein Inserat auf einem Portal bereits eindeutig.

**Zusatz-Normalisierung (2026-08-16, im Nachhinein unbestätigt geblieben):** trotz obigem Fix meldete der Auftraggeber, die erste Zeile sei weiterhin nicht ergänzt und neu betreffe es auch die zweite Zeile. Als naheliegende, aber zu diesem Zeitpunkt unbestätigte Zusatz-Fehlerquelle ergänzt: `pathKey()` normalisiert seither auch `www.`-Präfix, Gross-/Kleinschreibung im Hostnamen und einen abschliessenden Slash im Pfad. Frische Diagnosedaten (nächster Absatz) zeigten danach: das war nicht die eigentliche Ursache, blieb aber als harmlose Zusatz-Normalisierung im Code.

**Eigentliche Ursache gefunden (2026-08-16), anhand des frischen `unresolved`-Arrays der 3 verbliebenen Fälle:** alle drei `canonicalUrl` sind `homegate.ch/kaufen/<ID>`-Links mit vollem Tracking-Query (`utm_source`, `subscriptionId`, `utm_campaign=(...)`). Das erklärt den echten Bug: `processListingLinks.ts` speichert als `canonical_url` `fetchResult.finalUrl` — die von `fetch()` automatisch aufgelöste Ziel-URL, falls der ursprüngliche Mail-Link ein Klick-Tracking-Link war (z.B. SendGrid, siehe `inboundMail.ts`). `inbound_alerts.listing_links` enthält dagegen weiterhin den *rohen, nicht aufgelösten* Tracking-Link aus der Mail. Bei diesen drei Homegate-Mails ist genau das der Fall: der Tracking-Link löst per Redirect zur echten `homegate.ch`-URL auf, aber sein eigener Pfad (z.B. eine SendGrid-Tracking-ID) hat mit `/kaufen/<ID>` nichts gemeinsam — Domain+Pfad-Abgleich versagt hier strukturell, unabhängig von jeder Normalisierung. Fix (Fallback, noch nicht mit echten Daten bestätigt): zusätzliche Suche, die die numerische Inserat-ID aus dem Pfad von `canonical_url` (z.B. "4003380223") extrahiert und als Teilstring in den *rohen* `listing_links`-Strings aller Alerts sucht (`listingIdFromUrl()` in `backfill-addresses/route.ts`). Das setzt voraus, dass die ID im Tracking-Link überhaupt als Klartext vorkommt (z.B. in einem Query-Parameter) — bei manchen Tracking-Diensten (opake Hash-Tokens statt lesbarer IDs) könnte das ins Leere laufen. **Bestätigt (2026-08-16):** ID-Fallback erfolgreich — erneuter Lauf ergab `{"checked":3,"updated":3,"stillUnresolved":0,"unresolved":[]}`, alle drei Fälle aufgelöst.

**Zweite, strukturell andere Lücke gefunden (2026-08-16), anhand eines weiteren Beispiels ("Ohne Titel", Status BLK, Standort leer, obwohl das Original-Inserat "4434 Hölstein" zeigt):** dieser Fall lag nicht an der Mail-Zuordnung, sondern daran, dass die Zeile den Backfill-Kandidaten-Filter nie erreichte. Bei blockiertem Seitenabruf (`ingestion_status` BLOCKED/TIMEOUT/NOT_AVAILABLE) speichert `processListingLinks.ts` (Fehlerfall-Zweig) gar kein `extraction`-Feld — der bisherige Filter `extraction.method === "EMAIL_HEURISTIC"` schloss solche Zeilen also fälschlich aus, obwohl der Mailinhalt-Fallback (`extractFromEmailContent()`) durchaus etwas hätte finden können. Fix: Kandidaten werden jetzt einzig über `address_text IS NULL` bestimmt, ohne Einschränkung auf `extraction.method`.

**Bestätigt (2026-08-16):** erneuter Lauf mit dem erweiterten Filter ergab `{"checked":34,"updated":31,"stillUnresolved":3}` — die "4434 Hölstein"-Zeile war darunter erfolgreich ergänzt (Standort/Kanton BL sichtbar in der Tabelle). Von den verbleibenden 3 unresolved-Fällen waren dieses Mal drei **unterschiedliche, jeweils erklärbare** Ursachen dabei, keine gemeinsame:

1. **Trefferlisten-Link fälschlich als Inserat verarbeitet** (`homegate.ch/kaufen/bauland/kanton-zug/trefferliste?...`, ein "Alle Treffer ansehen"-Link am Ende einer Suchabo-Mail): kein Extraktionsfehler, sondern eine falsche Einordnung der URL-Art selbst — `extractPortalListingLinks()` (`inboundMail.ts`) filterte bisher nur Bild-/Tracking-Links, nicht aber Such-/Trefferlisten-Seiten. Fix: `isSearchResultsUrl()` erkennt und verwirft solche Links jetzt vollständig, bevor eine `listings`-Zeile dafür entsteht. Die bereits gespeicherte leere Zeile lässt sich nicht per Backfill nachträglich befüllen (keine Adresse auf einer Trefferliste) — Backfill-Route meldet sie jetzt explizit mit dem Grund "kein einzelnes Inserat, sondern eine Trefferlisten-/Such-URL — sollte gelöscht statt ergänzt werden". Löschen selbst nicht automatisiert (destruktive Aktion, bewusst nicht ohne Rückfrage).
2. **Zwei Zeilen aus derselben Digest-Mail** ("2 neue Treffer für 'Bauland zum Kaufen in Kanton Zug, ...'"): laut Code-Kommentar in `extractFromEmailContent()` bewusst so gebaut — bei mehreren gebündelten Treffern lässt sich Preis/Adresse im Fliesstext keinem der Treffer sicher zuordnen, deshalb bleibt die Adresse absichtlich leer statt zu raten (Bug-Fund vom 2026-08-11, dort bereits dokumentiert). Kein neuer Bug, aber die Backfill-Diagnose nannte bisher fälschlich denselben Grund wie bei einer echten Erkennungslücke — jetzt unterschieden: "Mail bündelt mehrere Treffer — Adresse lässt sich keinem einzelnen Inserat sicher zuordnen (bewusst, siehe extractFromEmailContent)".

Für diese beiden Digest-Zeilen bliebe als einzige Möglichkeit ein erneuter Seitenabruf der individuellen Inserat-URL (nicht Teil der Backfill-Route, die bewusst ohne externe Netzwerkaufrufe arbeitet) — bewusst nicht automatisch nachgezogen, da unklar, ob der ursprüngliche Blockade-Grund inzwischen behoben ist.

Ausserdem auf Wunsch: Status-/Suchprofil-Chips in der Tabelle zeigen jetzt Kurz-Labels mit **maximal 4 Zeichen** ("Prüf", "Blk", "Zeit", "Ja"/"Nein"/"?" usw.) mit dem vollen Begriff als Hover-Text (`Chip` in `@landfinder/ui` hat dafür ein neues optionales `title`-Prop) — die Detailseite zeigt weiterhin den vollen Begriff.

**Zonen-Erkennung nachgerüstet, Backfill auf Fläche/Zone erweitert (2026-08-16):** der Auftraggeber teilte eine echte Inseratsbeschreibung (Rickenbach Sulz, "* Grundstück mit 1'706 m²", "* Kernzone: Überkommunal"), bei der weder Fläche noch Zone in der Tabelle auftauchten. Ursache für die Zone: `known_zone` wurde bis dahin von **keiner** regelbasierten Extraktionsmethode überhaupt befüllt — das Feld existierte im Typ (`ExtractedListingFields.knownZone`) und wurde in `processListingLinks.ts` brav in die Datenbank geschrieben, aber weder `extractWithHeuristic()` noch `extractFromEmailContent()` setzten je einen Wert dafür; nur die (mangels `ANTHROPIC_API_KEY` meist inaktive) Anthropic-Extraktion hätte es theoretisch gekonnt. Neue Funktion `matchKnownZone()` erkennt bekannte Schweizer Zonenbezeichnungen (Wohn-/Kern-/Gewerbe-/Industrie-/Landwirtschafts-/Misch-/Dorf-/Zentrums-/Erholungs-/Bauzone) und optional einen einzelnen Wert danach — bewusst nur ein Wort nach dem Doppelpunkt (dieselbe "known-first, safe-single-word"-Vorsicht wie bei der Ortsnamen-Erkennung), da ein Fliesstext nach `stripHtml()` keine Zeilenumbrüche mehr hat und ein zweites erlaubtes Wort sonst leicht den nächsten Aufzählungspunkt mit einschliessen würde.

Für die Fläche war die Regex bereits korrekt (mit dem exakten Beispieltext als Test bestätigt) — dass sie bei dieser konkreten Zeile leer blieb, deutet darauf hin, dass der gespeicherte Mailinhalt diese ausführliche Beschreibung gar nicht enthielt (vermutlich nur auf der Portal-Seite selbst sichtbar, deren Abruf blockiert war) und nicht auf einen Regex-Fehler — **nicht abschliessend verifiziert**, da kein direkter Datenbankzugriff aus der Sandbox möglich ist.

Die Backfill-Route (`/api/admin/backfill-addresses`) berücksichtigt jetzt zusätzlich zu Adresse/Kanton auch Fläche und Zone: Kandidaten sind alle Zeilen, bei denen mindestens eines der drei Felder noch NULL ist; pro Zeile wird nur befüllt, was dort tatsächlich fehlt und was die erneute Extraktion liefert — nie ein bereits gesetztes Feld überschrieben. Noch offen: Route nach Deploy erneut aufrufen und prüfen, ob die Rickenbach-Sulz-Zeile jetzt eine Zone bekommt (Fläche vermutlich weiterhin nicht, siehe oben).

## B. LLM-Provider — offen, Code bereit
Empfehlung: Anthropic API (Claude), da bereits im Ökosystem vorhanden. Benötigt: Anthropic-API-Key als Secret (`ANTHROPIC_API_KEY` in Vercel). Die Extraktion (Punkt A, Stufe 2) ist bereits vollständig dagegen gebaut — bis der Key gesetzt ist, läuft alles im Demo-Modus gegen die Mock-LLM-Implementierung (Heuristik statt echtem LLM).

## C. Infrastruktur-Accounts — Hosting erledigt, Rest offen
- ~~Hosting für `apps/web`~~ **erledigt**: Vercel-Projekt `land-finder-web` unter deinem bestehenden Account (Team AXIA4) eingerichtet, Production Branch `claude/landfinder-mvp-projekt-l9baa1`, feste URL `land-finder-web.vercel.app`, automatisches Deployment bei jedem Push.
- ~~Supabase-Projekt~~ **erledigt**: Projekt "LandFinder" (Region Zürich) unter einem separaten, neu angelegten Account (Free Tier), da die bestehenden tekmesis-/ponderio-Projekte das Account-Limit von 2 Free-Projekten bereits ausschöpften — bewusst getrennter Account, da LandFinder als eher kurzlebiges Projekt eingeschätzt wird. Zugangsdaten als Vercel-Environment-Variablen hinterlegt (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- ~~E-Mail-Zustellweg für Suchabo-Mails~~ **erledigt** (siehe Punkt A): Postmark-Inbound-Webhook live, alle drei Suchabos registriert
- SMTP/Versanddienst für ausgehende Alerts (Empfehlung: Resend) — **Code bereit** (2026-08-07): `apps/web/src/lib/listingAlerts.ts` löst nach jeder erfolgreichen Stufe-2-Extraktion eine Alert-Mail aus, wenn das Inserat die Vorprüfung (Punkt F) besteht — an die im Suchprofil hinterlegten Empfänger (`alerts.recipients`), unter dem dort gesetzten Tageslimit (`alerts.maxImmediateEmailsPerDay`). Dedup per `alert_sent_at`-Spalte (Migration `0005_listings_alert_sent_at.sql`) mit atomarem "Claim" (kein Doppelversand bei wiederholter Verarbeitung derselben URL). Versand über `apps/web/src/lib/sendAlertEmail.ts` (einfacher `fetch` gegen die Resend-HTTP-API, keine SDK-Abhängigkeit). Läuft im Demo-Modus (No-op, kein Fehler) bis `RESEND_API_KEY` **und** `RESEND_FROM_ADDRESS` (verifizierte Absenderdomain in deinem Resend-Account) in Vercel gesetzt sind — analog zu `ANTHROPIC_API_KEY`. **Nicht umgesetzt:** der Digest-Modus (`alerts.digestTime`, gebündelter Tagesüberblick statt Sofort-Mail) und die Score-basierten Schwellen `thresholdA`/`thresholdB`/`potentialAEnabled` — die gibt es für echte Inserate nicht, da kein voller Score existiert (Punkt F). Ein Digest bräuchte zusätzlich einen Vercel-Cron-Job, eine neue Infrastruktur-Entscheidung.
- ~~Anthropic-API-Key~~ siehe Punkt B — Code ist bereit, Key fehlt noch

## D. Nutzerkreis — Passwort-Schutz live
Private Web-App mit Login, aber einem globalen Suchprofil. Annahme bis auf Widerruf: 2–5 bekannte Nutzer mit gleichberechtigtem Zugriff, Einladung nur manuell durch den Auftraggeber (kein Self-Signup).

**Umgesetzt (2026-08-06):** ein geteiltes Passwort (Umgebungsvariable `APP_PASSWORD` in Vercel) schützt jetzt die ganze App inkl. `/api/state/*` — das bisher **ganz ohne Zugriffsschutz** erreichbar war (Suchprofil/Annahmen-Register liess sich ohne Login lesen und überschreiben). `apps/web/src/middleware.ts` prüft ein signiertes Session-Cookie (`lf_session`, HMAC-SHA256 über `apps/web/src/lib/authSession.ts`, Web-Crypto-API, 30 Tage gültig) vor jeder Seite/API-Route; `/login` und der Postmark-Webhook (`/api/inbound/*`, eigene Basic-Auth) bleiben ausgenommen. `/api/state/[id]` prüft das Cookie zusätzlich selbst (defense in depth). **Fail closed:** ist `APP_PASSWORD` nicht gesetzt, bleibt der Zugriff gesperrt statt offen. Bewusst kein volles Multi-User-Login (einzelne Konten, Passwort-Reset) — das wäre für 2-5 bekannte Nutzer unverhältnismässiger Aufwand; E-Mail-/Remember-me-Felder im Login-Formular sind aktuell nur kosmetisch (aus dem abgenommenen Mockup übernommen), geprüft wird ausschliesslich das gemeinsame Passwort. Der konkrete `APP_PASSWORD`-Wert wurde dir separat mitgeteilt und muss in Vercel gesetzt werden, sonst bleibt die App für alle gesperrt.

## E. Wüest Partner — teilweise geklärt, Rest langfristig blockiert
Es besteht eine Wüest-Partner-Lizenz; zwei echte "Standortinformation"-Reports (Baden AG,
Wohlen AG) liegen vor. Diese wurden manuell in das dokumentierte CSV-Schema
(`docs/WUEST_CSV_SCHEMA.md`) übertragen und in `data/wuest/` abgelegt — inkl. Original-PDFs
als Provenienz-Nachweis. Weiterhin offen: automatische PDF-Extraktion bleibt bewusst
ausserhalb des MVP-Scopes (Abschnitt 1.6/7); ob das E-Mail-Sharing-Flag für diese Lizenz
gesetzt werden darf, ist ungeklärt (Lizenzvertrag prüfen, bevor Wüest-Werte in Alert-Mails
erscheinen).

**Update (2026-08-10):** Laut Telefonat mit Wüest Partner ist mit einer Klärung nicht in
nützlicher Frist zu rechnen — bleibt also auf unbestimmte Zeit offen, nicht aktiv verfolgen,
bis von aussen etwas kommt. Betrifft nur den Versand von Wüest-Werten in Alert-Mails an
Dritte; die interne Nutzung (Suchprofil-Kalibrierung, Cham-Analyse) ist davon nicht
berührt und bleibt wie bisher.

## F. Echte Geschäftsannahmen im Suchprofil — Wizard steht, Werte offen
Der Suchprofil-Wizard (`/suchprofil`) ist implementiert: alle zwölf Bereiche aus
Abschnitt 6, vorbelegt mit Schweizer Marktannahmen (`apps/web/src/lib/searchProfile.ts`,
klar als solche im UI gekennzeichnet). **Jetzt geräteübergreifend persistiert**
(2026-08-06): Suchprofil und Annahmen-Register-Overrides liegen in der
Supabase-Tabelle `app_state` (Migration `0002_app_state.sql`, über
`/api/state/[id]`), `localStorage` bleibt als schnelle lokale Kopie/Fallback,
falls Supabase kurz nicht erreichbar ist (siehe `apps/web/src/lib/remoteStore.ts`).
Kein Login/Nutzerkontext (Punkt D) — ein einziges globales Suchprofil, wie im
Masterdokument vorgesehen. Zusätzlich gibt es einen 13. Reiter "Annahmen & Formeln", der alle
Parameter-Registries aus `financial-engine`/`scoring-engine` (71 Werte) direkt
editierbar macht. Die Startwerte wurden inzwischen gegen die echten Wüest-Partner-Daten
kalibriert (Budget, Preis/m², Leerstand, Yield-on-Cost) und die Eigennutzungs-
Detailwerte ergänzt. Der zuvor fehlende Hard Gate für den Preis/m²-Deckel im
Grundstück-Bereich (`PRICE_PER_M2_ABOVE_MAXIMUM`) ist implementiert.

**Reale Verdrahtung — erster Schritt gemacht:** die Objekt-Detailseite von
"Chamerstrasse, Cham ZG" rechnet jetzt live mit financial-engine/scoring-engine
(`apps/web/src/lib/objektAnalysis.ts`), reagiert auf jede Änderung im Suchprofil
oder Annahmen-Register. Bewusst nur dieses eine Objekt — die anderen 5
Demo-Objekte haben keine strukturierten Rohdaten und blieben unverändert
statischer Text, statt erfundene Eingaben zu bekommen. Die "Warum
attraktiv/riskant"-Stichpunkte für Cham wurden bereinigt (keine durch die
Live-Werte widerlegten Zahlen mehr). Weiterhin offen: Dashboard und die
anderen 5 Objekte rechnen weiterhin mit `apps/web/src/lib/demo-data.ts`.

**Echte Inserate aus `/quellen` — Vorprüfung statt vollem Score (2026-08-07):** Eingehende, per Stufe-2 extrahierte Inserate lagen bisher komplett unbewertet in der Quellen-Ansicht. Eine volle Score/Empfehlung wie bei Cham scheitert strukturell an fehlenden Daten — Ausnützungsziffer, Zonenverifikation und Koordinaten stehen in keinem Inserate-Text, das wäre Raten statt Rechnen. Stattdessen prüft `apps/web/src/lib/listingPrescreen.ts` automatisch die fünf Kriterien, die sich ehrlich aus den extrahierten Feldern beurteilen lassen (Kanton, Objektart, Preis-Obergrenze, Preis/m²-Obergrenze, Flächen-Spanne) gegen das echte, gespeicherte Suchprofil (`getPersistedSearchProfile()`) — jedes einzeln sichtbar, mit "zu wenig Daten" statt Vermutung bei fehlenden Feldern. Sichtbar als Spalte in der Quellen-Übersicht und als volle Aufschlüsselung auf der Detailseite. Ein voller Score für echte Inserate bräuchte entweder eine manuelle "Objekt vertiefen"-Eingabe pro Kandidat oder eine echte Zonendaten-Quelle pro Parzelle (z.B. via Wüest/kantonale API) — beides nicht Teil dieser Änderung. Besteht ein Inserat die Vorprüfung, löst das automatisch eine Alert-Mail aus (siehe Punkt C).

**"Objekt vertiefen" — Phase 1 gebaut (2026-08-12):** genau die oben offen gelassene manuelle Eingabe ist jetzt da, zweistufiges Modell wie besprochen — Stufe 1 "oberflächlich interessant" bleibt die bestehende Vorprüfung (Absatz oben), Stufe 2 "vertieft mit vollem Scoring" ist neu. `apps/web/src/lib/objektAnalysis.ts` wurde generalisiert: `computeChamAnalysis()` (nur Cham) ist jetzt ein dünner Wrapper um die neue `computeListingAnalysis(profile, overrides, listing, facts)`, die dieselbe financial-/scoring-engine-Kette für ein **beliebiges** Objekt durchrechnet (Cham-Verhalten unverändert, siehe die 5 bestehenden + 10 neuen Tests in `objektAnalysis.test.ts`). Die manuell zu erfassenden Fakten (Zone, Ausnützungs-/Baumassen-/Überbauungsziffer, Verifikationsstufen, ÖV-Güteklasse, Koordinaten, Risiko-Flags, optionale Markt-Annahmen mit neutralen Defaults) sind in `apps/web/src/lib/listingVertiefung.ts` typisiert und landen in der neuen Spalte `listings.vertiefung` (Migration `0007_listings_vertiefung.sql`, jsonb — das manuelle Gegenstück zur automatischen `extraction`; **von dir im Supabase SQL-Editor ausgeführt und bestätigt**). Neue Route `POST /api/listings/[id]/vertiefung` speichert sie (nur möglich, wenn Preis/Fläche/Kanton/Objektart bereits vorhanden sind). Auf `/quellen/[id]` erscheint danach dieselbe Art Live-Analyse wie bei Cham (Score/Vertrauen/Empfehlung, Base/Stress, Baupotenzial, Kantonsvergleich, Annahmen-Transparenz) — der Kantonsvergleich läuft bewusst nur unter anderen vertieften **echten** Inseraten, nicht gegen die statischen Demo-Objekte (unterschiedliche Berechnungsgrundlage, sonst irreführend). **Bewusst nicht Teil dieser Phase:** die Homepage-Rangliste bleibt unverändert Demo-Objekte — ergibt erst Sinn, sobald mindestens ein echtes Inserat tatsächlich vertieft wurde (aktuell: keines), das ist der logische nächste Schritt.

## G. Domain / Deployment-Ziel — Vercel-Subdomain aktiv
Wie angenommen: `land-finder-web.vercel.app` ist die aktive MVP-Adresse (siehe Punkt C). Echte Domain erst auf Wunsch.

## H. Design-Sprache — entschieden
"Vermessung/Kataster": kühles Vermessungspapier-Blau-Grün statt warmem Creme-Ton, Petrol-Akzent (`#0E6E68` / `#4FC2B4` dunkel), Newsreader (Display-Serife) + Public Sans (UI) + IBM Plex Mono (Zahlen/Daten). Umgesetzt in `packages/ui` und `apps/web`. Referenz-Mockups wurden iterativ abgenommen (Login, Dashboard, Objekt-Detail).

## I. HOME4efFINDER-Scope & Priorisierung (2026-08-16)

Ausgangspunkt: `docs/HOME4EFFINDER_BESTANDSAUFNAHME.md` (Ist-Zustand-Analyse von
LandFinder + Gap-Analyse gegen die HOME4efFINDER-Vision). Auf Rückfrage vier
Entscheidungen getroffen:

1. **4efHOME-Zweck:** ausschliesslich Eigennutzung (Kauf zum Selberwohnen) — nicht
   Bestandsrendite. Niedrigere Priorität als der Punkt 2 unten.
2. **Neue, priorisierte Objektart — "Bestandsrendite auf Eigentumswohnungen":** nicht
   Teil von 4efHOME, sondern eine Erweiterung des Rendite-Zwecks (bisher nur
   Bauland/Development). Konkret: bestehende Eigentumswohnungen (keine
   Mehrfamilienhäuser zum Start), renovierbar oder bereits saniert, ausschliesslich
   zur Vermietung — möbliert als Business Apartment oder unmöbliert langfristig,
   nie zur Eigennutzung. Das ist die im Bestandsaufnahme-Dokument (Abschnitt 3.2)
   beschriebene dritte Rechenlogik (Kaufpreisfaktor/Bestandsrendite statt
   Residualwert/Baupotenzial) — noch nicht gebaut, siehe Punkt 4 unten für die
   Priorisierung.
3. **Priorität der gemeinsamen Infrastruktur:** dem in der Bestandsaufnahme
   vorgeschlagenen Vorschlag gefolgt — zuerst Vergleich-Persistenz + Preis-Historie
   (**umgesetzt**, siehe unten), danach Karten/Gemeindedaten, Dokumenten-KI (inkl.
   STWEG, relevant auch für die Bestandsrendite-Objektart aus Punkt 2) erst wenn der
   Scope dafür steht.
4. **Automatisierung:** jetzt angehen (nicht zurückstellen) — nächster Baustein nach
   Vergleich/Preis-Historie.

## J. Vergleich-Persistenz + Preis-Historie — umgesetzt (2026-08-16)

Erster Baustein aus Punkt I.3. `/vergleich` war bis dahin ein reiner Platzhalter,
obwohl `comparison-engine` (Rang/Perzentil/Vor-Nachteil je Kanton) seit Phase 1
fertig war. Analog zu `computeListingAnalysis`/`analyses` (Punkt F) bewusst **keine**
neue `comparisons`-Tabelle — der Vergleich wird bei jedem Seitenaufruf live über alle
vertieften echten Inserate berechnet (`apps/web/src/components/vergleich/
VergleichTable.tsx`, Client-Komponente wie `ListingLiveAnalysis.tsx`), reagiert also
sofort auf Suchprofil-/Annahmen-Änderungen statt auf einen Neuberechnungs-Job zu
warten. Zeigt Gesamt-/Kantonsrang, Score, Vertrauen, Empfehlung, Yield on Cost,
CHF/m² Land, Eigenkapitalbedarf und Preisänderung.

Für die Preisänderung gab es bisher keine Grundlage — `listings.asking_price_chf`
kennt nur den aktuellen Wert. Neue Tabelle `listing_price_history` (Migration
`0008_listing_price_history.sql`): `apps/web/src/lib/processListingLinks.ts` schreibt
bei jeder Stufe-2-Verarbeitung einen Eintrag, wenn der extrahierte Preis vom zuletzt
gespeicherten abweicht (inkl. des allerersten Preises je Inserat, damit ein
Startpunkt existiert). Bewusst nur bei echtem Preiswechsel, nicht bei jeder
Verarbeitung — sonst würde jeder erneute Abruf desselben Inserats einen
Historien-Eintrag erzeugen, obwohl sich nichts geändert hat.

## K. Automatisierung (Vercel Cron) — Wartungslauf umgesetzt (2026-08-16)

Zweiter Baustein aus Punkt I.4 ("jetzt angehen"). Löst den in Punkt C genannten
fehlenden Baustein teilweise: `apps/web/vercel.json` registriert einen täglichen
Vercel-Cron-Job (`0 5 * * *`, einmal täglich — passend zum Hobby-Plan-Limit) auf die
neue Route `GET /api/cron/maintenance`. Diese führt automatisch aus, was bisher nur
manuell per eingeloggtem Aufruf im Browser angestossen wurde:
`runBackfillAddresses()` und `runCleanupSearchResultListings()` — beide Funktionen aus
den bestehenden Admin-Routen (`api/admin/backfill-addresses`,
`api/admin/cleanup-search-result-listings`) extrahiert, damit Cron-Route und
Session-geschützte manuelle Route dieselbe Logik nutzen, statt sich per HTTP
gegenseitig aufzurufen (Verhalten der manuellen Routen unverändert).

Zugriffsschutz über `CRON_SECRET` (neue Umgebungsvariable, `apps/web/src/lib/
cronAuth.ts`) statt Login-Session — ein Cron-Job hat keine — nach demselben
Fail-closed-Muster wie `APP_PASSWORD` (Punkt D): fehlt `CRON_SECRET`, bleibt die Route
gesperrt. Vercel schickt bei gesetztem `CRON_SECRET` automatisch den Header
`Authorization: Bearer <CRON_SECRET>` mit (offizielles Vercel-Cron-Muster, kein
zusätzlicher Code nötig). **Noch zu setzen:** `CRON_SECRET` in den
Vercel-Projekteinstellungen, sonst bleibt auch dieser Cron-Job wirkungslos (wie
`RESEND_API_KEY`/`ANTHROPIC_API_KEY`, Punkt C).

**Bewusst nicht Teil dieses Bausteins:** der eigentliche Digest-Versand (neue
B-Treffer, Preisänderungen, Statusänderungen, Top-10 — `workers/digest`). Mit aktuell
so gut wie keinen vertieften echten Inseraten (Punkt F) wäre ein Score-basierter
Digest heute fast leer; Inhalt/Format sind ein eigener, noch zu klärender Umfang statt
ein Nebeneffekt der Cron-Infrastruktur.

## L. Karten/Gemeindedaten — erster Baustein umgesetzt (2026-08-16)

Dritter Baustein aus Punkt I.3. Bewusst klein gehalten (Ganzes ÖREB/BFS/ARE bleibt
"Hoch"-Aufwand mit teils offener Zugriffsklärung, siehe
`docs/HOME4EFFINDER_BESTANDSAUFNAHME.md`, Abschnitt 3.1) — dieser Schritt deckt nur
die zwei Teile ab, die ohne neuen Account/Vertrag sofort nutzbar sind:

1. **Eingebettete Karte** (`apps/web/src/components/map/SwissMap.tsx`): swisstopo-
   WMTS-Kacheln (`wmts.geo.admin.ch`, EPSG:3857, kein API-Key, Pflichtvermerk
   "© swisstopo"), Leaflet als einzige neue Laufzeit-Abhängigkeit (keine weiteren
   Pakete, kein API-Key). Ersetzt nicht den bisherigen `MapLink`
   (Google-Maps-Link, funktioniert auch ohne Koordinaten), ergänzt ihn dort, wo
   echte Koordinaten vorliegen: "Objekt vertiefen"-Live-Analyse
   (`ListingLiveAnalysis.tsx`) und die Cham-Demo (`LiveChamAnalysis.tsx`).
   Bewusst `L.circleMarker` statt Standard-Pin-Icon — vermeidet den bekannten
   Leaflet-Marker-Icon-Pfad-Bug unter Bundlern.
2. **Adress-Suche beim Erfassen von Koordinaten** (`apps/web/src/lib/geoAdmin.ts` +
   `GET /api/geo/search`): ersetzt das bisherige manuelle "Rechtsklick auf Google
   Maps" in `ListingVertiefungForm.tsx` durch ein Suchfeld über dieselbe
   swisstopo-API — ausgewählter Treffer füllt Breiten-/Längengrad automatisch,
   manuelle Eingabe bleibt weiterhin möglich (Fallback bei keinem Treffer).

**Nicht gegen echten Traffic verifiziert** (wie schon bei `fetchListingPage.ts`s
newhome-Verhalten): ausgehender Netzwerkzugriff auf `geo.admin.ch` ist aus dieser
Sandbox blockiert (nur `npm install` gegen die npm-Registry ist freigegeben) — die
eingebettete Karte wurde per Screenshot bestätigt (Kartencontainer, Zoom-Controls,
Marker, "© swisstopo"-Vermerk rendern korrekt; Kachel-Bilder selbst bleiben in der
Sandbox grau, da deren Abruf am Proxy scheitert — erwartet, kein Rendering-Fehler).
Die Adress-Suche (`geoAdmin.ts`) ist defensiv geparst (fehlendes/unerwartetes Feld →
Ergebnis wird übersprungen statt eine Koordinate zu erfinden) und mit Unit-Tests
gegen die öffentlich dokumentierte Antwortstruktur abgedeckt, aber die exakte
Feldbenennung erst beim ersten echten Suchlauf in Produktion zu bestätigen.

**Bewusst nicht Teil dieses Bausteins:** ÖREB (öffentlich-rechtliche
Eigentumsbeschränkungen), BFS-Gemeindedaten (Steuerfuss, Bevölkerung),
ARE-Erreichbarkeitsdaten, geodienste.ch — bleiben offen in
`packages/data-sources/README.md`, jeweils grösserer Aufwand mit teils zu klärendem
Zugriff.

## M. Bestandsrendite auf Eigentumswohnungen — Rechenkern vorbereitet (2026-08-16)

Vorarbeit zu Punkt I.2 ("Bestandsrendite auf Eigentumswohnungen": bestehende,
renovierbare oder bereits sanierte Wohnungen, ausschliesslich Vermietung — möbliert
als Business Apartment oder unmöbliert langfristig, nie Eigennutzung), ohne
Rückfrage möglich, da reine Berechnungslogik ohne Berührung der laufenden
Ingestion-/Alert-Pipeline.

**Gebaut:** `packages/financial-engine/src/bestandsrendite.ts` — Kaufpreis +
Nebenkosten (Handänderungssteuer/Notariat/Maklerprovision) + Renovation + Möblierung
→ Gesamtinvestition → Ertrag/Finanzierung (Wiederverwendung von `calculateErtrag`/
`calculateFinanzierung`, bereits objektart-neutral) → Brutto- **und** Nettorendite
(immer gemeinsam ausgewiesen, wie gewünscht). Modell auf Rückmeldung angepasst:
unmöbliert ist die einzige Mietbasis-Formel (CHF/m²/Monat); Möblierung und
Renovation sind reine Kosten-Zusätze — je eine einmalige Initialkosten-Variable plus
ein laufender Jahressatz (Möblierung: % der Möblierungskosten; Renovation: % des
Kaufpreises, nicht der Renovationskosten) —, keine eigene Ertragsformel. 14
Unit-Tests. Dazu `packages/domain/src/stweg.ts` (`StwegFacts`): reine
Datenstruktur für STWEG-Kennzahlen (Erneuerungsfonds, Sanierungsstau,
Beschlussrisiken), noch ohne Bewertung — auch die Zielstruktur für eine künftige
STWEG-Protokoll-Analyse per LLM.

**Bewusst NICHT gebaut** (in dieser Reihenfolge die nächsten Schritte, sobald diese
Fragen geklärt sind):

1. **Scoring/Hard Gates/Empfehlung für Bestandsrendite.** Anders als beim
   Development-Underwriting (`packages/scoring-engine`) gibt es dafür keinen
   abgenommenen Masterdokument-Abschnitt. Braucht deine Antwort auf: Welche
   Brutto-/Nettorendite ist für dich das Minimum? Welche DSCR/Belehnung? Wie stark
   soll ein ungünstiger STWEG-Befund (z.B. niedriger Erneuerungsfonds-Deckungsgrad,
   anstehende Grosssanierung) den Score drücken — ähnlich den bestehenden
   `RISK_DEDUCTIONS` bei Bauland, aber mit anderen Kriterien?
2. **`Objektart` in `packages/domain` erweitern** (aktuell bewusst nur `"BAULAND" |
   "ABBRUCHOBJEKT"`). Berührt die reale Ingestion-Pipeline: Extraktions-Prompt
   (`listingExtraction.ts`), Hard Gates (`objektart.baulandEnabled`/
   `abbruchobjektEnabled` im Suchprofil), Vorprüfung (`listingPrescreen.ts`) —
   bewusst nicht unilateral an der Live-Pipeline geändert, ohne dass du das siehst.
3. **Suchprofil-UI/Persistenz.** Wie sollen die `BESTANDSRENDITE_PARAMETERS`
   editierbar werden — als neuer Tab im bestehenden Wizard, oder (näher an deiner
   ursprünglichen Überlegung, 4efRENDITE/4efHOME als getrennte Such-/Scoring-Profile
   auf gemeinsamer Datenbasis) als eigenes zweites Suchprofil? Aktuell gibt es nur
   ein globales Suchprofil (Punkt 3.1 der Bestandsaufnahme).
4. **Kostensätze real kalibrieren.** `BESTANDSRENDITE_PARAMETERS`
   (`parameters.ts`) sind grobe, ehrlich als Platzhalter markierte Schweizer
   Richtwerte (Handänderungssteuer 2%, laufende Renovationsrückstellung 1% vom
   Kaufpreis, Möblierungs-Ersatzrate 14%/Jahr) — keine mit dir abgestimmten Werte.

## N. Objektart-Scope + 3-stufiges Bestandsrendite-Modell (2026-08-16)

Zwei Rückmeldungen am selben Tag, in dieser Reihenfolge umgesetzt.

**Objektart-Scope für den Dokumenten-KI-MVP:** `Objektart` (`packages/domain/src/
listing.ts`) um `"BESTANDSWOHNUNG"` erweitert — damit ist Punkt M.2 (oben) für den
Zweck der Dokumenten-KI beantwortet, aber bewusst NUR additiv: bestehende
Eigentumswohnungen als reines Rendite-/Buy-to-let-Objekt, bereits vermietet oder mit
Vermietungsabsicht leerstehend, Einstellhallen-/Aussenparkplätze können Teil des
Investments sein, Fokus 2–3.5 Zimmer aber technisch nicht darauf beschränkt.
Ausdrücklich NICHT Teil davon: Mehrfamilienhäuser, Einfamilienhäuser, Gewerbeobjekte,
Bauland, Neubauprojekte, Ferienimmobilien; Baurecht ist ein Dealbreaker (Hard Gate
folgt erst mit dem Scoring, siehe unten). Bewusst weiterhin NICHT angefasst: die
automatische Alert-Mail-Pipeline (Extraktions-Prompt, Hard-Gate-Toggles im
Suchprofil, Vorprüfung) — `BESTANDSWOHNUNG`-Objekte entstehen aktuell ausschliesslich
über manuelle Erfassung.

**Bestandsrendite-Rechenmodell — vollständig neu aufgebaut, ersetzt den einfachen
Ansatz aus Punkt M.** Ausführliche Rückmeldung mit konkreter 3-Ebenen-Architektur
(Schnellcheck → Investment Case → Value-Add → 15-Jahres-Modell → Exit), bewusst NICHT
auf institutionellem Niveau (kein DCF/WACC/NPV/Monte-Carlo). Details siehe
`packages/financial-engine/README.md`, Abschnitt "Bestandsrendite" — Kurzfassung:

- **Ebene A/B** (`bestandsrendite.ts`): Schnellcheck zum Aussortieren; Investment
  Case mit All-in-Investition (statt nur Kaufpreis), Brutto auf Kaufpreis **und**
  All-in getrennt, 5-stufigem Cashflow-Wasserfall bis zum "nachhaltigen Cashflow",
  Cash-on-Cash, Break-even-Miete/-Zins/-Auslastung (numerisch per Bisektion).
- **Value-Add** (`bestandsrenditeValueAdd.ts`, eigenes Modul wie gewünscht):
  Furniture-/Renovation-ROI mit Payback, Möblierungs-Lebenszyklus (Cash-Abfluss im
  Ersatzjahr, nicht geglättet), Renovationspositionen mit drei steuerlichen
  Kategorien (KI schlägt vor, Nutzer bestätigt).
- **Ebene C** (`bestandsrenditeMehrjahresmodell.ts`): 15 Jahre Default, 5–30 wählbar,
  Miet-/Kosteneskalation, Restschuld-Entwicklung, Exit mit optionaler (grob
  genäherter) Grundstückgewinnsteuer, Levered-/Unlevered-IRR, Equity Multiple,
  mechanische Investment-Treiber-Attribution ("Wo entsteht die Rendite?").

91 Unit-Tests (zuvor 14) für das gesamte Modul. `BESTANDSRENDITE_PARAMETERS`
entsprechend erweitert (Reserven, Leerstandsquoten je Vermietungsmodell,
Möblierungs-Lebenszyklus, Steuersatz, Eskalationsraten, Verkaufskosten,
Default-Haltedauer) — weiterhin durchgehend ehrlich als "Platzhalter — noch nicht mit
Auftraggeber abgestimmt" markiert, keine erfundene Abschnittsnummer.

**Bewusst weiterhin offen** (unverändert ggü. Punkt M.1/M.3, jetzt mit mehr
verfügbaren Kennzahlen als Grundlage): Scoring/Hard-Gates/Empfehlung, Suchprofil-UI/
Persistenz für die neuen Parameter. "Risiko STWEG"/"CapEx-Risiko" aus dem
Investment-Treiber-Beispiel des Auftraggebers kommen aus der Dokumenten-
Due-Diligence (in Arbeit, siehe nächster Punkt), nicht aus dem rein finanziellen
Modell.

## O. Dokumenten-KI / Due-Diligence-Prüfung — umgesetzt (2026-08-16/17)

Ausführliche Produktvorgabe (13 Abschnitte: Objektart-Scope, Ziel, 17 Dokumenttypen
in zwei Prioritäten, Extraktionsanleitung je Typ, Widerspruchserkennung, Ampel-Status
je Kategorie, Missing-Documents-Liste, Verkäuferfragen, Quellenbezug, Verbindung zur
Finanzanalyse, MVP-Prinzip). Mit dem expliziten Auftrag, bei technischen
Detailentscheidungen selbst sinnvolle MVP-Entscheidungen zu treffen und nur bei
Produktlogik-/Kostenstruktur-/Architektur-relevanten Fragen nachzufragen — deshalb
komplett ohne Zwischen-Rückfrage umgesetzt, alle Entscheidungen hier dokumentiert statt
vorab gestellt.

**Gebaut, End-to-End:**

1. **Upload + Stufe-1-Extraktion** (`apps/web/src/lib/dueDiligenceExtraction.ts`,
   `POST /api/listings/[id]/documents`): nutzt Claudes native PDF-Dokument-Unterstützung
   (Base64 direkt im Message-Content) statt eines separaten OCR-Diensts — deckt auch
   gescannte/Bild-PDFs ab, wie gefordert. Prompt je Dokumenttyp aus dem zentralen
   Katalog (`documentTypes.ts`, 9 Priorität-A- + 8 Priorität-B-Typen + Sonstiges,
   Extraktionsanleitung für die vier vom Auftraggeber im Detail beschriebenen Typen
   — STWEG-Protokoll, Erneuerungsfonds, Mietvertrag, Grundbuch — wörtlich aus der
   Produktvorgabe übernommen). Defensiv geparste JSON-Antwort mit Fund je Kategorie/
   Severity/Seite/Zitat.
2. **Stufe-2-Synthese** (`dueDiligenceSynthesis.ts`,
   `POST /api/listings/[id]/due-diligence`): wertet alle bereits extrahierten
   Dokumente gemeinsam aus — Kategorie-Status mit Befunden (inkl. Widerspruchs-
   Markierung), Verkäufer-/Maklerfragen, Feldwert-Übernahmevorschläge. "Missing
   Documents" und der Gesamtstatus werden bewusst **deterministisch** berechnet
   (Soll-Katalog minus Hochgeladenes bzw. schlechtester Kategorie-Status), nicht vom
   LLM geraten — zuverlässiger.
3. **Feldwert-Übernahme** (`applyFieldUpdate`, `POST /api/listings/[id]/
   due-diligence/apply-proposal`): "Neuer Wert erkannt … → übernehmen?", nie
   automatisch, geschlossene Allow-Liste an Feldpfaden.
4. **UI** (`BestandswohnungDetail.tsx`, `DueDiligencePanel.tsx`,
   `BestandsrenditeVertiefungForm.tsx`, `BestandsrenditeAnalysisView.tsx`): eigener
   Objekt-Detailseiten-Zweig für BESTANDSWOHNUNG, Mehrfach-Upload mit
   Dokumenttyp-Auswahl, Ampel je Kategorie mit Quellenbeleg, fehlende Unterlagen nach
   Priorität (zwingend/empfehlenswert/optional), Rückfragen-Liste,
   Übernahme-Buttons. Per Browser-Screenshot verifiziert (Formular-Rendering,
   Absenden) — dabei einen echten HTML5-Validierungs-Bug gefunden und behoben
   (`min="1"` + `step="1000"` liess keine runden Tausender wie CHF 450'000 zu).

**MVP-Entscheidungen, selbst getroffen (technisch, keine Rückfrage nötig):**

- **Ein Dokument pro Upload-Request, synchron abgearbeitet** — kein Job-Queue/
  Polling-Zwischenstatus. Mehrere PDFs gleichzeitig hochladen heisst: der Browser
  schickt mehrere Requests (die UI zeigt Fortschritt pro Datei), nicht ein
  gebündelter Multi-File-Request — sonst würde ein einzelner Request potenziell
  mehrere Minuten-lange LLM-Aufrufe bündeln und das Vercel-Zeitbudget riskieren
  (`maxDuration = 60`, gleiches Muster wie `MAX_LINKS_PER_RUN` bei
  `processListingLinks.ts`). Bewusst die einfachste Lösung ("keine unnötig komplexe
  Dokumentenverwaltung"), auch wenn das den Browser-Tab beim Hochladen mehrerer
  grosser Dateien offen halten muss.
- **Storage:** privater Supabase-Storage-Bucket `object-documents` (Migration 0010)
  statt eines separaten Dateidiensts — nutzt die bereits vorhandene
  Supabase-Infrastruktur, keine neue Kostenstelle/kein neuer Vendor.
- **Kein heuristischer Fallback ohne `ANTHROPIC_API_KEY`** (anders als bei der
  Inserats-Extraktion) — ein PDF lässt sich nicht sinnvoll per Regex auf
  STWEG-Risiken prüfen; `AnthropicNotConfiguredError` statt einer irreführenden
  Pseudo-Analyse. Die Funktion ist bis zum Setzen des Keys komplett inaktiv,
  konsistent mit dem bereits etablierten Muster (Punkt B).
- **Synthese-Ergebnis wird persistiert** (`object_due_diligence`), nicht bei jedem
  Seitenaufruf neu berechnet — bewusste Abweichung vom sonst üblichen
  "live berechnen statt speichern"-Muster (`analyses`/`comparisons`), weil ein
  LLM-Aufruf über mehrere Dokumente teuer und nicht-deterministisch ist, anders als
  eine günstige reine Formel.
- **Zwei getrennte, wiederverwendbare LLM-Aufrufe statt einem grossen**: Stufe 2
  arbeitet mit den bereits strukturierten Stufe-1-Extraktionen (JSON), nicht mit den
  rohen PDFs erneut — reduziert Kosten und lässt einzelne Dokumente unabhängig
  nachträglich ergänzen, ohne bereits analysierte neu zu verarbeiten.

**Nachgezogen (2026-08-17), auf Rückmeldung "ja bitte weiter machen":**

- **Dokumenten-Löschen**: `DELETE /api/listings/[id]/documents/[documentId]`
  entfernt Datei aus dem Storage-Bucket + die `object_documents`-Zeile, "Löschen"-
  Button pro Dokument in der Liste. Ein bereits gespeichertes
  `object_due_diligence`-Ergebnis, das das gelöschte Dokument referenziert, wird
  bewusst nicht automatisch neu berechnet — bleibt bis zum nächsten
  "Due-Diligence aktualisieren" als Snapshot stehen.
- **E-Mail-Export der Verkäuferfragen** (Produktvorgabe, Punkt 8):
  `sellerQuestionsEmail.ts` baut Betreff + nummerierten Fliesstext aus den
  Rückfragen; in der UI ein `mailto:`-Link ("In E-Mail-Programm öffnen") und ein
  "Text kopieren"-Button samt Vorschau-Textarea. Bewusst kein eigener
  Mail-Versand (kein neuer Vendor/keine neue Kostenstelle) — nutzt nur, was der
  Browser/das lokale Mailprogramm bereits kann.

**Nachgezogen (2026-08-17), Code-Review statt Live-Test (Rückmeldung: Sandbox hat
keine Supabase-/Anthropic-Zugangsdaten, daher "Nur Code-Review, kein Live-Test" —
den ersten echten Praxistest mit einer realen Bestandeswohnung übernimmt der
Auftraggeber selbst):**

- **Absturz bei `holdingPeriodYears <= 0` behoben**: `runMehrjahresmodell`
  (`packages/financial-engine/src/bestandsrenditeMehrjahresmodell.ts`) griff nach
  der Jahres-Schleife ungeschützt auf `years[years.length - 1]` zu. Bei
  `holdingPeriodYears` `0` oder negativ (im UI durch `min="5"` verhindert, aber via
  direktem API-Aufruf erreichbar — `?? P.holdingPeriodYearsDefault.defaultValue`
  greift nur bei `null`/`undefined`, nicht bei `0`) blieb `years` leer und die
  Funktion wäre mit einem `TypeError` abgestürzt. Fix: Haltedauer wird intern auf
  mindestens 1 Jahr geklemmt (`Math.max(1, Math.floor(...))`), analog zum
  bestehenden Defensiv-Muster in `calculateRendite`. Zwei neue Tests in
  `bestandsrenditeMehrjahresmodell.test.ts`.
- Weitere Prüfpunkte ohne Befund: Formularfelder (`BestandsrenditeVertiefungForm`)
  gegen `parseBestandsrenditeFacts` feldweise abgeglichen — keine Mismatches;
  `buildKnownFields` (Due-Diligence-Route) gegen `ALLOWED_UPDATE_FIELDS` verglichen
  — identische Feldlisten.
- **Bewusste, unveränderte Scope-Reduktionen** (kein Bug, nur notiert): Das
  Renovation-Formularfeld erfasst aktuell nur einen Gesamtbetrag
  (`initialRenovationCostChf`), keine itemisierten `RenovationPosition[]` mit
  Kategorie/Jahr/Steuerbehandlung, obwohl Domain/Financial-Engine das bereits
  unterstützen — bereits erfasste Positionen werden beim Speichern aber
  unverändert durchgereicht, nicht verworfen. `moeblierung.kostensteigerungPercentPerYear`
  ist kein eigenes Formularfeld und fällt still auf den allgemeinen
  Kosteninflations-Default zurück (ohne eigene `assumptionNotes`-Zeile, anders als
  bei den übrigen Defaults) — vertretbar für den MVP, da kein Formularfeld dafür
  existiert, das der Nutzer hätte ausfüllen können.

**Bewusst weiterhin NICHT gebaut / offen:**

- **Scoring/Hard-Gates auf Basis der Due-Diligence** (z.B. "RISIKO in Kategorie
  STWEG senkt den Score um X Punkte") — bleibt wie in Punkt M/N offen, dieselbe
  Investitionskriterien-Frage.
- **Kalkulatorischer Steuersatz und Grundstückgewinnsteuer-Näherung** (bereits in
  Punkt N erwähnt) sind bewusst grobe Vereinfachungen, kein Steuerberatungsersatz.
