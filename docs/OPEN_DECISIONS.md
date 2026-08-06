# Offene Entscheidungen

Gebündelte Fragen, die kostenrelevant, rechtlich heikel oder scope-verändernd sind und daher nicht ohne Rückmeldung des Auftraggebers entschieden werden (siehe Masterprompt, Abschnitt 30, „Arbeitsweise“). Diese Liste wird laufend aktualisiert.

## A. Portal-Scraping (Homegate, ImmoScout24, newhome) — Discovery live, Persistenz offen
Entscheid (2026-08-06): **Tier 1 — Suchabo-/Alert-E-Mails**, kein HTML-Scraping und kein systematisches Crawling der Portale. Basis: `docs/PORTAL_ACCESS_REVIEW.md`. Zustellweg: **Postmark-Inbound-Webhook** (push statt poll). Empfängerseite gebaut und Ende-zu-Ende verifiziert: `apps/web/src/app/api/inbound/portal-alerts/route.ts` (Postmark-Payload) + `apps/web/src/lib/inboundMail.ts` (filtert Inserat-Links auf `homegate.ch`/`immoscout24.ch`/`newhome.ch`). **Alle drei Suchabos sind seit 2026-08-06 live** (Zieladresse: die Postmark-Inbound-Adresse des Servers "LandFinder"), bestätigt per echtem Test-Traffic in den Vercel-Logs (`POST /api/inbound/portal-alerts`, Status 200). Optionaler Schutz per HTTP-Basic-Auth über `INBOUND_WEBHOOK_SECRET`. **Offen:** ohne Supabase (Punkt C) werden ankommende Treffer nur in den Vercel-Function-Logs sichtbar, nicht dauerhaft gespeichert — Logs haben begrenzte Aufbewahrung, echte Treffer könnten so verloren gehen, bis Persistenz steht. **Kein Scraping-Code der Portale selbst läuft vor expliziter Freigabe.**

## B. LLM-Provider — offen
Empfehlung: Anthropic API (Claude), da bereits im Ökosystem vorhanden. Benötigt: Anthropic-API-Key als Secret. Bis zur Klärung läuft alles im Demo-Modus gegen die Mock-LLM-Implementierung.

## C. Infrastruktur-Accounts — Hosting erledigt, Rest offen
- ~~Hosting für `apps/web`~~ **erledigt**: Vercel-Projekt `land-finder-web` unter deinem bestehenden Account (Team AXIA4) eingerichtet, Production Branch `claude/landfinder-mvp-projekt-l9baa1`, feste URL `land-finder-web.vercel.app`, automatisches Deployment bei jedem Push.
- Supabase-Projekt (EU-Region), Free Tier für den MVP ausreichend — **offen, jetzt dringend** (siehe Punkt A: ohne Persistenz gehen ankommende Suchabo-Treffer nach Log-Ablauf verloren)
- ~~E-Mail-Zustellweg für Suchabo-Mails~~ **erledigt** (siehe Punkt A): Postmark-Inbound-Webhook live, alle drei Suchabos registriert
- SMTP/Versanddienst für ausgehende Alerts (Empfehlung: Resend) — offen

## D. Nutzerkreis — offen
Private Web-App mit Login, aber einem globalen Suchprofil. Annahme bis auf Widerruf: 2–5 bekannte Nutzer mit gleichberechtigtem Zugriff, Einladung nur manuell durch den Auftraggeber (kein Self-Signup).

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
klar als solche im UI gekennzeichnet), lokal im Browser gespeichert (noch keine
Datenbank). Zusätzlich gibt es einen 13. Reiter "Annahmen & Formeln", der alle
Parameter-Registries aus `financial-engine`/`scoring-engine` (71 Werte) direkt
editierbar macht. Die Startwerte wurden inzwischen gegen die echten Wüest-Partner-Daten
kalibriert (Budget, Preis/m², Leerstand, Yield-on-Cost) und die Eigennutzungs-
Detailwerte ergänzt. Der zuvor fehlende Hard Gate für den Preis/m²-Deckel im
Grundstück-Bereich (`PRICE_PER_M2_ABOVE_MAXIMUM`) ist implementiert. Weiterhin offen:
Dashboard und Objekt-Detailseite rechnen noch mit statischen Demo-Daten
(`apps/web/src/lib/demo-data.ts`), nicht mit den echten Engines — die eigentliche
Verdrahtung fehlt noch (siehe Vorschlag für die nächste Session).

## G. Domain / Deployment-Ziel — Vercel-Subdomain aktiv
Wie angenommen: `land-finder-web.vercel.app` ist die aktive MVP-Adresse (siehe Punkt C). Echte Domain erst auf Wunsch.

## H. Design-Sprache — entschieden
"Vermessung/Kataster": kühles Vermessungspapier-Blau-Grün statt warmem Creme-Ton, Petrol-Akzent (`#0E6E68` / `#4FC2B4` dunkel), Newsreader (Display-Serife) + Public Sans (UI) + IBM Plex Mono (Zahlen/Daten). Umgesetzt in `packages/ui` und `apps/web`. Referenz-Mockups wurden iterativ abgenommen (Login, Dashboard, Objekt-Detail).
