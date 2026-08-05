# Offene Entscheidungen

Gebündelte Fragen, die kostenrelevant, rechtlich heikel oder scope-verändernd sind und daher nicht ohne Rückmeldung des Auftraggebers entschieden werden (siehe Masterprompt, Abschnitt 30, „Arbeitsweise“). Diese Liste wird laufend aktualisiert.

## A. Portal-Scraping (Homegate, ImmoScout24, newhome) — offen
Automatisiertes Auslesen dieser drei Portale kann unabhängig von der Technik gegen deren AGB verstossen. Vor Beginn von Phase 2 (Portaladapter) wird ein `PORTAL_ACCESS_REVIEW.md` mit einer Einschätzung pro Portal erstellt (offizielle API/Feed? RSS? ToS-Lage?) und die risikoärmste Variante vorgeschlagen — bevorzugt Suchabo-E-Mails/RSS statt HTML-Scraping. **Kein Scraping-Code läuft vor expliziter Freigabe.**

## B. LLM-Provider — offen
Empfehlung: Anthropic API (Claude), da bereits im Ökosystem vorhanden. Benötigt: Anthropic-API-Key als Secret. Bis zur Klärung läuft alles im Demo-Modus gegen die Mock-LLM-Implementierung.

## C. Infrastruktur-Accounts — offen
Benötigt vom Auftraggeber (keine kostenpflichtigen Dienste werden ohne Zustimmung angelegt):
- Supabase-Projekt (EU-Region), Free Tier für den MVP ausreichend
- Hosting für `apps/web` (Empfehlung: Vercel Free Tier)
- E-Mail-Konto für IMAP-Polling (Suchabo-Mails, weitergeleitete Inserate)
- SMTP/Versanddienst für ausgehende Alerts (Empfehlung: Resend)

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
editierbar macht. Weiterhin offen: die eigentlichen Zahlenwerte sind
unternehmerische Entscheidungen und noch nicht von dir bestätigt — bitte im Wizard
durchgehen und anpassen, bevor damit echte Empfehlungen berechnet werden.

## G. Domain / Deployment-Ziel — offen
Annahme bis auf Widerruf: Vercel-Subdomain für den MVP, echte Domain erst auf Wunsch.

## H. Design-Sprache — entschieden
"Vermessung/Kataster": kühles Vermessungspapier-Blau-Grün statt warmem Creme-Ton, Petrol-Akzent (`#0E6E68` / `#4FC2B4` dunkel), Newsreader (Display-Serife) + Public Sans (UI) + IBM Plex Mono (Zahlen/Daten). Umgesetzt in `packages/ui` und `apps/web`. Referenz-Mockups wurden iterativ abgenommen (Login, Dashboard, Objekt-Detail).
