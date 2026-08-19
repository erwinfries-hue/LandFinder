-- Ergänzt einen rein informativen Referenz-Link zum Original-Inserat. Bewusst OHNE
-- automatischen Abruf/Scraping der URL (siehe docs/DECISIONS.md) — LandFinder hat
-- gezeigt, dass grosse Schweizer Portale (v.a. Homegate) automatisierte Abrufe aktiv
-- blockieren, auch von Vercel-Servern aus. Der Link wird nur gespeichert und verlinkt.

alter table properties add column if not exists listing_url text;
