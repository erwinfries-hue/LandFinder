-- Einmalige Datenbereinigung (kein Schema-Wechsel) für drei Bugs, die am 2026-08-11
-- anhand echter Produktionsdaten gefunden und im Code bereits behoben wurden (siehe
-- docs/OPEN_DECISIONS.md, Punkt A) — dieses Skript räumt nur die VORHER entstandenen
-- Altlasten auf, die der Code-Fix nicht rückwirkend korrigiert:
--   1. Doppelte Zeilen: mehrere Links derselben Mail (z.B. Logo- + Tracking-Link zum
--      selben Treffer) hatten alle denselben Mailinhalt-Fallback gespeichert.
--   2. Unplausible Preise (z.B. "CHF 1'150"): bei Mails mit mehreren Treffern griff
--      die Preis-Regex den ersten "CHF ..."-Betrag im ganzen Mailtext.
--   3. HTML-Entity-Müll (z.B. wiederholtes "&#847;") in Titel/Beschreibung.
-- Reihenfolge bewusst so: zuerst Duplikate anhand der ORIGINAL-Werte entfernen, erst
-- danach Preise/Text bereinigen — sonst würden mehrere unterschiedliche unplausible
-- Preise nach dem Nullen fälschlich als "gleiche" Gruppe erscheinen.

-- 1. Doppelte Zeilen aus demselben Mailinhalt-Fallback: pro identischer Kombination
-- aus Quelle/Titel/Adresse/Preis nur die älteste Zeile behalten. Bewusst auf
-- EMAIL_HEURISTIC beschränkt (der betroffene Code-Pfad) — echte Seiten-Extraktionen
-- (MOCK_HEURISTIC/ANTHROPIC) bleiben unangetastet, auch wenn sie zufällig gleiche
-- Werte hätten.
with duplicates as (
  select
    id,
    row_number() over (
      partition by source, title, address_text, asking_price_chf
      order by first_seen_at asc, id asc
    ) as rn
  from listings
  where extraction ->> 'method' = 'EMAIL_HEURISTIC'
)
delete from listings
where id in (select id from duplicates where rn > 1);

-- 2. Unplausible Preise unterhalb der neuen Mindestschwelle (siehe
-- MIN_PLAUSIBLE_PRICE_CHF in apps/web/src/lib/listingExtraction.ts) auf beiden Ebenen
-- entfernen statt einen falschen Wert stehen zu lassen ("nichts wird erfunden").
update listings
set
  asking_price_chf = null,
  extraction = extraction #- '{fields,askingPriceChf}'
where asking_price_chf is not null
  and asking_price_chf < 50000;

-- 3. Wiederholte numerische HTML-Entities aus Titel/Beschreibung entfernen (waren als
-- unsichtbarer Anti-Spam-Füllstoff in manchen Suchabo-Mails enthalten).
update listings
set
  title = trim(regexp_replace(regexp_replace(title, '&#x?[0-9a-fA-F]+;', ' ', 'g'), '\s+', ' ', 'g')),
  description = trim(regexp_replace(regexp_replace(description, '&#x?[0-9a-fA-F]+;', ' ', 'g'), '\s+', ' ', 'g'))
where title ~ '&#x?[0-9a-fA-F]+;' or description ~ '&#x?[0-9a-fA-F]+;';
