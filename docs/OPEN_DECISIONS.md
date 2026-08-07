# Offene Entscheidungen

Gebündelte Fragen, die kostenrelevant, rechtlich heikel oder scope-verändernd sind und daher nicht ohne Rückmeldung des Auftraggebers entschieden werden (siehe Masterprompt, Abschnitt 30, „Arbeitsweise“). Diese Liste wird laufend aktualisiert.

## A. Portal-Scraping (Homegate, ImmoScout24, newhome) — Discovery + Persistenz live
Entscheid (2026-08-06): **Tier 1 — Suchabo-/Alert-E-Mails**, kein HTML-Scraping und kein systematisches Crawling der Portale. Basis: `docs/PORTAL_ACCESS_REVIEW.md`. Zustellweg: **Postmark-Inbound-Webhook** (push statt poll). Vollständige Kette Ende-zu-Ende mit echtem Traffic verifiziert: Portal-Suchabo → Postmark (`docs/`-Server "LandFinder") → `apps/web/src/app/api/inbound/portal-alerts/route.ts` (parst Payload, filtert Inserat-Links via `apps/web/src/lib/inboundMail.ts` auf `homegate.ch`/`immoscout24.ch`/`newhome.ch`) → Supabase-Tabelle `inbound_alerts` (Migration `supabase/migrations/0001_inbound_alerts.sql`, RLS aktiv ohne Policies, nur `service_role` schreibt/liest). Erste echte Zeile am 2026-08-06 im Table Editor bestätigt. Optionaler Schutz per HTTP-Basic-Auth über `INBOUND_WEBHOOK_SECRET`. Bei Datenbank-Fehlern liefert die Route bewusst HTTP 500, damit Postmarks Retry-Mechanismus greift statt Treffer stillschweigend zu verlieren. **Kein Scraping-Code der Portale selbst läuft vor expliziter Freigabe.**

**Stufe 2 ist jetzt gebaut** (2026-08-06, mit deiner Freigabe): `apps/web/src/lib/fetchListingPage.ts` ruft gezielt genau die eine Inserat-URL ab, die uns die Suchabo-Mail bereits genannt hat (kein Crawlen/Suchen). `apps/web/src/lib/listingExtraction.ts` extrahiert daraus Felder — läuft im Mock-Modus (regelbasierte Heuristik, Konfidenz 25, Methode `MOCK_HEURISTIC`) bis `ANTHROPIC_API_KEY` gesetzt ist (Punkt B), danach automatisch mit echter Claude-Extraktion (Methode `ANTHROPIC`), ohne Code-Änderung. Ergebnis landet in der neuen Tabelle `listings` (Migration `0004_listings.sql`). Läuft über Next.js' `after()`, damit Postmark sofort eine Antwort bekommt statt auf externe Abrufe zu warten. Bewusst auf 2 Links pro Mail begrenzt (Vercel-Hobby-Zeitbudget: 10 Sekunden hartes Limit) — weitere Links bleiben unverarbeitet, aber sichtbar in `inbound_alerts.listing_links`. **Noch nicht in dieser Session getestet:** ob die Portale den Abruf durchlassen oder blockieren (aus der Sandbox heraus nicht prüfbar, nur in Produktion) — bei Blockade landet der Link mit `ingestion_status: 'BLOCKED'` in `listings`, kein Absturz.

**newhome blockiert den Abruf in Produktion (2026-08-07, real beobachtet):** die ersten 4 echten newhome-Links landeten mit `BLOCKED`/`NOT_AVAILABLE` in `listings` — genau das im Portal-Zugriffs-Review (`docs/PORTAL_ACCESS_REVIEW.md`) erwartete Szenario. Migration `0004_listings_fetch_diagnostics.sql` ergänzt `last_fetch_http_status`/`last_fetch_at`, damit künftige Blockaden nachvollziehbar sind (z.B. 403 vs. 429 vs. Timeout), sichtbar auf der `/quellen/[id]`-Detailseite. **Entscheid (2026-08-07, explizit angefragt und von dir freigegeben):** `fetchListingPage.ts` gibt sich jetzt als gewöhnlicher Browser aus (Chrome-User-Agent, `Accept`/`Accept-Language`-Header) statt sich als Bot zu identifizieren — der vorherige, selbstauskunftgebende User-Agent (`LandFinderBot/1.0`) wurde von newhome blockiert. Wichtig: das wirkt nur gegen einfache Header-/UA-basierte Bot-Erkennung, nicht gegen JS-Challenges (Cloudflare-artig) — ob es bei newhome tatsächlich hilft, ist unverifiziert (aus der Sandbox nicht gegen die echten Portale testbar), erst der nächste echte Suchabo-Durchlauf zeigt es (`last_fetch_http_status` auf der Quellen-Detailseite). Bewusst weiterhin nur ein Abruf der einen, bereits per Suchabo-Mail bekannten URL — kein Crawlen/Durchsuchen des Portal-Katalogs, das bleibt ausgeschlossen. Stufe 1 (Suchabo-Mail mit Original-Link) funktioniert für newhome ohnehin unabhängig von diesem Fetch-Erfolg.

**Sichtbar in der App (2026-08-06):** `inbound_alerts` und `listings` waren bisher nur über das Supabase-Dashboard einsehbar. Die Seite `/quellen` zeigt jetzt beides direkt in LandFinder: eine Übersichtstabelle aller extrahierten Inserate (mit Kanton, Typ, Preis, Fläche, Status) sowie eine `/quellen/[id]`-Detailseite je Inserat (alle Felder inkl. Extraktionsmethode/-konfidenz). In Übersicht und Detail führt ein aktiver Link (`ListingLink`, `packages/ui/src/ListingLink.tsx`) direkt zum Original-Inserat beim Portal. Darunter eine Tabelle der eingehenden Suchabo-Mails mit den darin gefundenen Links, ebenfalls aktiv verlinkt. `apps/web/src/lib/processListingLinks.ts` hat jetzt Tests (`processListingLinks.test.ts`, 8 Fälle: Erfolg/Heuristik, Erfolg/Anthropic, alle Fehlerfälle, Quellenerkennung, `MAX_LINKS_PER_RUN`-Begrenzung, Fehler-Logging ohne Abbruch).

## B. LLM-Provider — offen, Code bereit
Empfehlung: Anthropic API (Claude), da bereits im Ökosystem vorhanden. Benötigt: Anthropic-API-Key als Secret (`ANTHROPIC_API_KEY` in Vercel). Die Extraktion (Punkt A, Stufe 2) ist bereits vollständig dagegen gebaut — bis der Key gesetzt ist, läuft alles im Demo-Modus gegen die Mock-LLM-Implementierung (Heuristik statt echtem LLM).

## C. Infrastruktur-Accounts — Hosting erledigt, Rest offen
- ~~Hosting für `apps/web`~~ **erledigt**: Vercel-Projekt `land-finder-web` unter deinem bestehenden Account (Team AXIA4) eingerichtet, Production Branch `claude/landfinder-mvp-projekt-l9baa1`, feste URL `land-finder-web.vercel.app`, automatisches Deployment bei jedem Push.
- ~~Supabase-Projekt~~ **erledigt**: Projekt "LandFinder" (Region Zürich) unter einem separaten, neu angelegten Account (Free Tier), da die bestehenden tekmesis-/ponderio-Projekte das Account-Limit von 2 Free-Projekten bereits ausschöpften — bewusst getrennter Account, da LandFinder als eher kurzlebiges Projekt eingeschätzt wird. Zugangsdaten als Vercel-Environment-Variablen hinterlegt (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- ~~E-Mail-Zustellweg für Suchabo-Mails~~ **erledigt** (siehe Punkt A): Postmark-Inbound-Webhook live, alle drei Suchabos registriert
- SMTP/Versanddienst für ausgehende Alerts (Empfehlung: Resend) — offen
- ~~Anthropic-API-Key~~ siehe Punkt B — Code ist bereit, Key fehlt noch

## D. Nutzerkreis — Passwort-Schutz live
Private Web-App mit Login, aber einem globalen Suchprofil. Annahme bis auf Widerruf: 2–5 bekannte Nutzer mit gleichberechtigtem Zugriff, Einladung nur manuell durch den Auftraggeber (kein Self-Signup).

**Umgesetzt (2026-08-06):** ein geteiltes Passwort (Umgebungsvariable `APP_PASSWORD` in Vercel) schützt jetzt die ganze App inkl. `/api/state/*` — das bisher **ganz ohne Zugriffsschutz** erreichbar war (Suchprofil/Annahmen-Register liess sich ohne Login lesen und überschreiben). `apps/web/src/middleware.ts` prüft ein signiertes Session-Cookie (`lf_session`, HMAC-SHA256 über `apps/web/src/lib/authSession.ts`, Web-Crypto-API, 30 Tage gültig) vor jeder Seite/API-Route; `/login` und der Postmark-Webhook (`/api/inbound/*`, eigene Basic-Auth) bleiben ausgenommen. `/api/state/[id]` prüft das Cookie zusätzlich selbst (defense in depth). **Fail closed:** ist `APP_PASSWORD` nicht gesetzt, bleibt der Zugriff gesperrt statt offen. Bewusst kein volles Multi-User-Login (einzelne Konten, Passwort-Reset) — das wäre für 2-5 bekannte Nutzer unverhältnismässiger Aufwand; E-Mail-/Remember-me-Felder im Login-Formular sind aktuell nur kosmetisch (aus dem abgenommenen Mockup übernommen), geprüft wird ausschliesslich das gemeinsame Passwort. Der konkrete `APP_PASSWORD`-Wert wurde dir separat mitgeteilt und muss in Vercel gesetzt werden, sonst bleibt die App für alle gesperrt.

## E. Wüest Partner — teilweise geklärt
Es besteht eine Wüest-Partner-Lizenz; zwei echte "Standortinformation"-Reports (Baden AG,
Wohlen AG) liegen vor. Diese wurden manuell in das dokumentierte CSV-Schema
(`docs/WUEST_CSV_SCHEMA.md`) übertragen und in `data/wuest/` abgelegt — inkl. Original-PDFs
als Provenienz-Nachweis. Weiterhin offen: automatische PDF-Extraktion bleibt bewusst
ausserhalb des MVP-Scopes (Abschnitt 1.6/7); ob das E-Mail-Sharing-Flag für diese Lizenz
gesetzt werden darf, ist ungeklärt (Lizenzvertrag prüfen, bevor Wüest-Werte in Alert-Mails
erscheinen).

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

**Echte Inserate aus `/quellen` — Vorprüfung statt vollem Score (2026-08-07):** Eingehende, per Stufe-2 extrahierte Inserate lagen bisher komplett unbewertet in der Quellen-Ansicht. Eine volle Score/Empfehlung wie bei Cham scheitert strukturell an fehlenden Daten — Ausnützungsziffer, Zonenverifikation und Koordinaten stehen in keinem Inserate-Text, das wäre Raten statt Rechnen. Stattdessen prüft `apps/web/src/lib/listingPrescreen.ts` automatisch die vier Kriterien, die sich ehrlich aus den extrahierten Feldern beurteilen lassen (Kanton, Objektart, Preis-Obergrenze, Preis/m²-Obergrenze) gegen das echte, gespeicherte Suchprofil (`getPersistedSearchProfile()`) — jedes einzeln sichtbar, mit "zu wenig Daten" statt Vermutung bei fehlenden Feldern. Sichtbar als Spalte in der Quellen-Übersicht und als volle Aufschlüsselung auf der Detailseite. Ein voller Score für echte Inserate bräuchte entweder eine manuelle "Objekt vertiefen"-Eingabe pro Kandidat oder eine echte Zonendaten-Quelle pro Parzelle (z.B. via Wüest/kantonale API) — beides nicht Teil dieser Änderung.

## G. Domain / Deployment-Ziel — Vercel-Subdomain aktiv
Wie angenommen: `land-finder-web.vercel.app` ist die aktive MVP-Adresse (siehe Punkt C). Echte Domain erst auf Wunsch.

## H. Design-Sprache — entschieden
"Vermessung/Kataster": kühles Vermessungspapier-Blau-Grün statt warmem Creme-Ton, Petrol-Akzent (`#0E6E68` / `#4FC2B4` dunkel), Newsreader (Display-Serife) + Public Sans (UI) + IBM Plex Mono (Zahlen/Daten). Umgesetzt in `packages/ui` und `apps/web`. Referenz-Mockups wurden iterativ abgenommen (Login, Dashboard, Objekt-Detail).
