# Portal-Zugriffs-Review (Homegate, ImmoScout24.ch, newhome)

Vorbereitende Recherche zu Punkt A in `docs/OPEN_DECISIONS.md`. Ziel: pro Portal
einschätzen, ob automatisiertes Auslesen zulässig/riskant ist, und die risikoärmste
Zugriffsvariante identifizieren — **ohne** dass dafür Scraping-Code geschrieben oder
ausgeführt wurde (weiterhin gemäss Vorgabe: kein Scraping-Code vor expliziter Freigabe).

**Wichtiger Hinweis zur Methodik:** Alle drei Portale haben ihre Rechtstexte und sogar
`robots.txt` gegenüber automatisierten Abrufen (auch reinem Lesen) mit HTTP 403 bzw.
DNS-Blockaden abgeriegelt — ich konnte keine Original-Klauseln 1:1 zitieren, sondern
stütze mich auf Suchmaschinen-Snippets und öffentlich indexierte Sekundärquellen (Links
unten). Das ist selbst ein Befund: Wenn schon ein einzelner harmloser Lesezugriff auf eine
öffentliche Rechtstext-Seite blockiert wird, ist mit aggressiver Bot-Erkennung (Akamai/
Cloudflare-artig) auf den eigentlichen Inserate-Seiten zu rechnen. **Vor einer
endgültigen Entscheidung sollten die drei AGB-Seiten einmal manuell (im normalen
Browser) gelesen werden** — die folgenden Einschätzungen sind eine gute Grundlage, aber
kein Ersatz für die Lektüre der Originaltexte.

## Kurzfassung / Empfehlung

**Risikoarmste Variante zuerst umsetzen: Suchabo-/Alert-E-Mails per IMAP** (wie im
Masterprompt und in Punkt A bereits favorisiert). Das deckt sich mit der ohnehin
geplanten IMAP-Anbindung (Punkt C) und benötigt keine Sonderfreigabe der Portale.
Offizielle APIs (Tier 2) sind eine sinnvolle Erweiterung für später, brauchen aber
Vertragsabschluss/Freigabe durch dich. **HTML-Scraping der Inseratsseiten (Tier 3) wird
nicht empfohlen** — weder rechtlich noch technisch.

| Tier | Variante | Risiko | Aufwand | Status |
|---|---|---|---|---|
| 1 | Suchabo-/Alert-E-Mail + IMAP-Parsing | Niedrig | Mittel (Parser pro Portal) | Empfohlener Start |
| 2 | Offizielle Partner-API (ImmoScout24 WebAPI, newhome Business Connector) | Niedrig, aber vertraglich | Mittel–Hoch (Freigabe/Kosten) | Prüfen, nicht dringend |
| 3 | HTML-Scraping der Inserate direkt | Hoch (ToS + technisch fragil) | — | Nicht empfohlen |

## Homegate.ch

- Gehört wie ImmoScout24.ch zur **SMG Swiss Marketplace Group AG** — beide teilen
  offenbar dieselben "General Terms and Conditions of our online marketplaces".
- Ein indexierter Auszug der AGB erwähnt explizit, dass SMG gegen "unauthorised usage of
  personal data" vorgehen kann, **namentlich genannt: "unlawful crawling"** sowie
  unerwünschte Veröffentlichung von Inseratsdaten auf Drittportalen. Das deutet stark
  darauf hin, dass automatisiertes Auslesen in den AGB ausdrücklich als unzulässig
  benannt ist — Originaltext konnte ich nicht verifizieren (s. Methodik-Hinweis oben).
- Kein Hinweis auf eine öffentliche Self-Service-API für Homegate selbst gefunden.
- Es existieren zahlreiche kommerzielle Dritt-Scraper (Apify, Scrapfly, Scrapingdog u.a.)
  — diese verweisen selbst darauf, dass die *Nutzer* für ToS-Konformität verantwortlich
  sind, und warnen vor Bot-Blocking nach wenigen Requests. Kein Argument für Zulässigkeit,
  eher ein Beleg für aktive Gegenmassnahmen.
- **Alert-E-Mails ("Suchagent")**: Homegate bietet — wie praktisch jedes grosse
  Immobilienportal — ein kostenloses E-Mail-Alert-Feature für gespeicherte Suchen an
  (aus allgemeinem Marktwissen, nicht heute frisch verifiziert — bitte bei Gelegenheit
  im eigenen Konto bestätigen).

## ImmoScout24.ch

- Gleiche Konzernmutter wie Homegate (SMG Swiss Marketplace Group), mutmasslich gleiche
  AGB-Klausel zu "unlawful crawling" (s. oben).
- **Wichtiger Fund:** Es gibt ein offizielles **Scout24 WebAPI-Dokumentationsportal**
  (`apidocs.immoscout24.ch`), das öffentlich über Suchmaschinen indexiert ist. Das legt
  nahe, dass ein offizieller, vertraglich geregelter API-Zugang existiert (typischerweise
  für Makler-/Softwarepartner, mit Freigabeprozess). Ich konnte die Seite selbst nicht
  öffnen (DNS-Fehler in dieser Umgebung) — müsste manuell geprüft werden, ob/wie ein
  Zugang für uns als Nutzer (nicht Makler) möglich wäre.
- **Alert-E-Mails ("Suchagent")**: ebenfalls Standard-Feature, analog Homegate.

## newhome.ch

- Betrieben von Immobilien- und Bankenpartnern (u.a. Kantonalbanken) — anderes
  Geschäftsmodell als die SMG-Portale.
- **Suchabo bestätigt vorhanden**: laut Hilfe-/FAQ-Seiten ein kostenloser Dienst für
  sofortige Benachrichtigung per E-Mail bei neuen, zum Suchprofil passenden Inseraten —
  genau der Tier-1-Zugang, den wir wollen.
- **Wichtiger Fund:** newhome bietet einen **"Business Connector"** ("Intelligente
  Schnittstelle") als eigenes Produkt an — dem Namen und der Positionierung nach ein
  B2B-Datenfeed/API für Makler/Software-Anbieter. Seite war für mich nicht abrufbar
  (403) — Zugangsvoraussetzungen, Kosten und ob er für uns (kein Makler, sondern
  Käuferseite) überhaupt nutzbar wäre, müssten direkt bei newhome erfragt werden.
- **Kommerzielle Nutzung explizit geregelt**: laut den "Insertions- und
  Nutzungsrichtlinien" kann newhome von gewerblichen Nutzern einen schriftlichen
  Nachweis der Eigentümerzustimmung verlangen; ohne diesen Nachweis droht eine
  Konventionalstrafe von CHF 5'000 zzgl. MWST. Das betrifft primär das *Wiederver-
  öffentlichen* von Inseraten, ist aber ein Hinweis auf die generelle Durchsetzungshärte.
  Automatisierte Account-Erstellung ist ausdrücklich untersagt.

## Offene Punkte für dich (nicht von mir allein entscheidbar)

1. Bitte einmal die drei AGB-Seiten im eigenen Browser (eingeloggt, aus der Schweiz)
   öffnen und die Original-Klauseln zu Crawling/automatisiertem Zugriff lesen — meine
   Einschätzung basiert auf Sekundärquellen, nicht auf dem Originaltext.
2. Falls Tier 2 (offizielle API/Business Connector) interessant erscheint: das sind
   Vertragsprodukte, vermutlich mit Kosten und Prüfprozess (Maklerstatus?) — das kann
   ich nicht ohne dich anfragen/verhandeln.
3. Entscheidung, ob wir mit Tier 1 (Suchabo-E-Mails, alle drei Portale) als alleinige
   Datenquelle für den MVP starten — das wäre mein Vorschlag für morgen.

## Quellen

- [General conditions of business – homegate.ch](https://www.homegate.ch/c/en/about-us/legal-issues/gbc)
- [General Terms and Conditions of our online marketplaces – ImmoScout24.ch](https://www.immoscout24.ch/c/en/about-us/gtc)
- [Scout24 WebAPI Documentation](https://apidocs.immoscout24.ch/)
- [Insertions- und Nutzungsrichtlinien – newhome.ch (PDF, gültig ab 6.10.2017)](https://www.newhome.ch/de/mediaserve/1691/02-Insertions-und_Nutzungsrichtlinien_07-2017_DE_FINAL.pdf)
- [Business Connector – newhome.ch](https://www.newhome.ch/de/services/business_connector)
- [Hilfe zu newhome.ch (Suchabo)](https://www.newhome.ch/blog/de/hilfe-zu-newhome-ch/)
- [Mailings abbestellen – newhome.ch](https://www.newhome.ch/blog/de/mailings-abbestellen/)
