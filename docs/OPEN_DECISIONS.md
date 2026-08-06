# Offene Entscheidungen

Gebündelte Fragen, die kostenrelevant, rechtlich heikel oder scope-verändernd sind und daher nicht ohne Rückmeldung des Auftraggebers entschieden werden (siehe Masterprompt, Abschnitt 30, „Arbeitsweise“). Diese Liste wird laufend aktualisiert.

## A. Portal-Scraping (Homegate, ImmoScout24, newhome) — entschieden
Entscheid (2026-08-06): **Tier 1 — Suchabo-/Alert-E-Mails per IMAP** als alleinige Datenquelle für den MVP, kein HTML-Scraping. Basis: `docs/PORTAL_ACCESS_REVIEW.md` (Homegate/ImmoScout24-AGB deuten auf ein explizites Crawling-Verbot hin; newhome bestätigt ein kostenloses Suchabo per E-Mail). Konto für die drei Suchabos und das IMAP-Polling: `erwin.fries@gmx.ch` (siehe Punkt C). Nächster Schritt: die drei Suchabos für das Suchprofil (Kantone ZH/ZG/SZ/AG/LU/OW/NW) manuell auf den Portalen anlegen, danach IMAP-Zugang für dieses Postfach einrichten (App-Passwort o.ä.). **Kein Scraping-Code läuft vor expliziter Freigabe** — bleibt so, unabhängig von diesem Entscheid.

## B. LLM-Provider — offen
Empfehlung: Anthropic API (Claude), da bereits im Ökosystem vorhanden. Benötigt: Anthropic-API-Key als Secret. Bis zur Klärung läuft alles im Demo-Modus gegen die Mock-LLM-Implementierung.

## C. Infrastruktur-Accounts — Hosting erledigt, Rest offen
- ~~Hosting für `apps/web`~~ **erledigt**: Vercel-Projekt `land-finder-web` unter deinem bestehenden Account (Team AXIA4) eingerichtet, Production Branch `claude/landfinder-mvp-projekt-l9baa1`, feste URL `land-finder-web.vercel.app`, automatisches Deployment bei jedem Push.
- Supabase-Projekt (EU-Region), Free Tier für den MVP ausreichend — offen
- ~~E-Mail-Konto für IMAP-Polling~~ **entschieden** (siehe Punkt A): `erwin.fries@gmx.ch`, IMAP-Zugang (App-Passwort) steht noch aus
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
