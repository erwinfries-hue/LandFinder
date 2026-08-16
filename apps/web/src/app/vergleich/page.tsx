import type { Metadata } from "next";
import type { Objektart } from "@landfinder/domain";
import { computeChange } from "@landfinder/comparison-engine";
import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { getVertiefteListings, getPriceHistory } from "@/lib/listings";
import { parseListingVertiefungFacts } from "@/lib/listingVertiefung";
import { VergleichTable, type VergleichEntry } from "@/components/vergleich/VergleichTable";

export const metadata: Metadata = { title: "Vergleich — SIPIS LandFinder" };

/**
 * `force-dynamic`: wie /quellen — sonst friert Next.js die Seite auf den Datenstand
 * des letzten Deploys ein (Bug gefunden 2026-08-07, siehe docs/OPEN_DECISIONS.md).
 */
export const dynamic = "force-dynamic";

/**
 * Rollender Vergleich (Abschnitt 20) — löst den bisherigen Platzhalter ab. Nur unter
 * Inseraten mit "Objekt vertiefen"-Daten vergleichbar, aus demselben Grund wie auf
 * /quellen/[id]: ohne Zone/Ausnützung/Koordinaten lässt sich kein echter Score
 * berechnen (nur die Vorprüfung, siehe listingPrescreen.ts).
 */
export default async function VergleichPage() {
  const listings = await getVertiefteListings();

  if (listings === null) {
    return (
      <div className="shell">
        <SideNav current="vergleich" />
        <main className="main">
          <div className="pagehead">
            <h1>Vergleich</h1>
          </div>
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> fehlen).
            </p>
          </Panel>
        </main>
      </div>
    );
  }

  const priceHistory = await getPriceHistory(listings.map((l) => l.id));

  const entries: VergleichEntry[] = listings.flatMap((l) => {
    const parsed = l.vertiefung ? parseListingVertiefungFacts(l.vertiefung) : null;
    if (!parsed || !("facts" in parsed) || l.asking_price_chf == null || l.parcel_area_m2 == null || !l.canton || !l.object_type) return [];

    const history = priceHistory[l.id] ?? [];
    const priceChange = history.length >= 2 ? computeChange(history[0].price_chf, history[history.length - 1].price_chf) : null;

    return [
      {
        id: l.id,
        title: l.title || l.address_text || "Ohne Titel",
        addressText: l.address_text,
        source: l.source,
        canton: l.canton,
        listing: {
          canton: l.canton,
          objectType: l.object_type as Objektart,
          askingPriceChf: l.asking_price_chf,
          parcelAreaM2: l.parcel_area_m2,
        },
        facts: parsed.facts,
        priceChange,
      },
    ];
  });

  return (
    <div className="shell">
      <SideNav current="vergleich" />
      <main className="main">
        <div className="pagehead">
          <h1>Vergleich</h1>
        </div>
        <Panel style={{ padding: "1.4rem 1.6rem" }}>
          <div className="eyebrow">
            Rollender Vergleich · {entries.length} vertiefte{entries.length === 1 ? "s" : ""} Objekt{entries.length === 1 ? "" : "e"}
          </div>
          <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: "0.4rem 0 1.1rem" }}>
            Rang, Score und Empfehlung nur unter Inseraten mit &quot;Objekt vertiefen&quot;-Daten — ohne Zone,
            Ausnützung und Koordinaten lässt sich kein echter Score berechnen (siehe Vorprüfung auf /quellen).
            Rechnet live mit dem aktuellen Suchprofil und den Annahmen-Register-Werten.
          </p>
          {entries.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: ".8125rem" }}>
              Noch kein Inserat vertieft — sobald mindestens eines &quot;Objekt vertiefen&quot;-Daten hat, erscheint
              es hier im Vergleich.
            </p>
          ) : (
            <VergleichTable entries={entries} />
          )}
        </Panel>
      </main>
    </div>
  );
}
