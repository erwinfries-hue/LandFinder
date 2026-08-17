import Link from "next/link";
import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { Metric } from "@/components/objekte/MetricPrimitives";
import { formatChf } from "@/lib/demo-data";
import { getObjectDocuments, getObjectDueDiligence, formatDateTime, type ListingRow } from "@/lib/listings";
import { computeBestandsrenditeAnalysis, parseBestandsrenditeFacts } from "@/lib/bestandsrenditeVertiefung";
import { BestandsrenditeVertiefungForm } from "./BestandsrenditeVertiefungForm";
import { BestandsrenditeAnalysisView } from "./BestandsrenditeAnalysisView";
import { DueDiligencePanel, type DueDiligenceDocumentRow } from "./DueDiligencePanel";

/**
 * Detailseite für BESTANDSWOHNUNG-Objekte (docs/OPEN_DECISIONS.md, Punkt N/O) —
 * eigener Komponentenbaum statt weiterer Verzweigungen in der Bauland-lastigen
 * `/quellen/[id]/page.tsx`: andere Metriken (Wohnfläche statt Parzelle), andere
 * Vertiefung (Bestandsrendite statt Baupotenzial/Residualwert), zusätzlich die
 * Dokumenten-Due-Diligence, die es für Bauland nicht gibt.
 */
export async function BestandswohnungDetail({ listing }: { listing: ListingRow }) {
  const canCompute = listing.asking_price_chf != null && listing.wohnflaeche_m2 != null;
  const factsParsed = listing.bestandsrendite ? parseBestandsrenditeFacts(listing.bestandsrendite) : null;
  const facts = factsParsed && "facts" in factsParsed ? factsParsed.facts : null;

  const [documents, dueDiligence] = await Promise.all([getObjectDocuments(listing.id), getObjectDueDiligence(listing.id)]);

  const analysis = canCompute && facts ? computeBestandsrenditeAnalysis({ kaufpreisChf: listing.asking_price_chf!, wohnflaecheM2: listing.wohnflaeche_m2! }, facts) : null;

  return (
    <div className="shell">
      <SideNav current="quellen" />
      <main className="main">
        <Panel className="dethead">
          <div className="eyebrow">Bestandswohnung · Rendite-/Buy-to-let-Objekt · {listing.source}</div>
          <div className="dethead-top">
            <div>
              <h1>{listing.title || listing.address_text || "Ohne Titel"}</h1>
              {listing.description ? <p className="lede lede-line">{listing.description}</p> : null}
            </div>
          </div>
          <div className="metricgrid">
            <Metric l="Kanton" v={listing.canton ?? "—"} />
            <Metric l="Adresse" v={listing.address_text ?? "—"} />
            <Metric l="Kaufpreis" v={listing.asking_price_chf != null ? `CHF ${formatChf(listing.asking_price_chf)}` : "—"} />
            <Metric l="Wohnfläche" v={listing.wohnflaeche_m2 != null ? `${formatChf(listing.wohnflaeche_m2)} m²` : "—"} />
            <Metric l="Erstmals erfasst" v={formatDateTime(listing.first_seen_at)} />
          </div>
        </Panel>

        {!canCompute ? (
          <Panel style={{ padding: "1.3rem 1.4rem", marginTop: "1.6rem" }}>
            <div className="eyebrow">Bestandsrendite berechnen</div>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: "0.4rem 0 0" }}>
              Kaufpreis und Wohnfläche müssen zuerst vorhanden sein.
            </p>
          </Panel>
        ) : (
          <>
            {analysis ? <BestandsrenditeAnalysisView result={analysis} /> : null}
            <details style={{ marginTop: "1.2rem" }} open={!facts}>
              <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--accent)" }}>
                Bestandsrendite-Fakten {facts ? "bearbeiten" : "erfassen"}
              </summary>
              <BestandsrenditeVertiefungForm listingId={listing.id} existing={facts} />
            </details>
          </>
        )}

        <DueDiligencePanel
          listingId={listing.id}
          objectLabel={listing.title || listing.address_text || "diesem Objekt"}
          initialDocuments={(documents ?? []) as DueDiligenceDocumentRow[]}
          initialDueDiligence={dueDiligence}
        />

        <p style={{ marginTop: "1.2rem" }}>
          <Link href="/quellen" className="maplink">
            ← Zurück zur Übersicht
          </Link>
        </p>
      </main>
    </div>
  );
}
