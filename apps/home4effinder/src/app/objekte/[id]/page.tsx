import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { Metric } from "@/components/MetricPrimitives";
import { formatChf } from "@/lib/format";
import { getPropertyById, getPropertyDocuments, getPropertyDueDiligence, formatDateTime } from "@/lib/properties";
import { computeBestandsrenditeAnalysis, parseBestandsrenditeFacts } from "@/lib/bestandsrendite";
import { BestandsrenditeVertiefungForm } from "@/components/BestandsrenditeVertiefungForm";
import { BestandsrenditeAnalysisView } from "@/components/BestandsrenditeAnalysisView";
import { DueDiligencePanel, type DueDiligenceDocumentRow } from "@/components/DueDiligencePanel";
import { PropertyDeleteButton } from "@/components/PropertyDeleteButton";
import { PropertyEditForm } from "@/components/PropertyEditForm";

export const dynamic = "force-dynamic";

export default async function ObjektDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getPropertyById(id);
  if (property === null) notFound();

  if (property === undefined) {
    return (
      <div className="shell">
        <SideNav current="objekte" />
        <main className="main">
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              fehlen) — daher lässt sich dieses Objekt nicht anzeigen.
            </p>
          </Panel>
        </main>
      </div>
    );
  }

  const factsParsed = property.bestandsrendite ? parseBestandsrenditeFacts(property.bestandsrendite) : null;
  const facts = factsParsed && "facts" in factsParsed ? factsParsed.facts : null;

  const [documents, dueDiligence] = await Promise.all([getPropertyDocuments(property.id), getPropertyDueDiligence(property.id)]);

  const analysis = facts ? computeBestandsrenditeAnalysis({ kaufpreisChf: property.asking_price_chf, wohnflaecheM2: property.wohnflaeche_m2 }, facts) : null;

  return (
    <div className="shell">
      <SideNav current="objekte" />
      <main className="main">
        <Panel className="dethead">
          <div className="eyebrow">Bestandswohnung · Rendite-/Buy-to-let-Objekt</div>
          <div className="dethead-top">
            <div>
              <h1>{property.title || property.address_text}</h1>
            </div>
            <PropertyDeleteButton propertyId={property.id} propertyLabel={property.title || property.address_text} />
          </div>
          <div className="metricgrid">
            <Metric l="Kanton" v={property.canton} />
            <Metric l="Adresse" v={property.address_text} />
            <Metric l="Kaufpreis" v={`CHF ${formatChf(property.asking_price_chf)}`} />
            <Metric l="Wohnfläche" v={`${formatChf(property.wohnflaeche_m2)} m²`} />
            <Metric l="Erfasst" v={formatDateTime(property.created_at)} />
            {property.bestandsrendite_updated_at ? (
              <Metric l="Bestandsrendite zuletzt aktualisiert" v={formatDateTime(property.bestandsrendite_updated_at)} />
            ) : null}
          </div>
        </Panel>

        <details style={{ marginTop: "1.2rem" }}>
          <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--accent)" }}>Objekt-Basisdaten bearbeiten</summary>
          <PropertyEditForm property={property} />
        </details>

        {analysis ? <BestandsrenditeAnalysisView result={analysis} /> : null}
        <details style={{ marginTop: "1.2rem" }} open={!facts}>
          <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--accent)" }}>
            Bestandsrendite-Fakten {facts ? "bearbeiten" : "erfassen"}
          </summary>
          <BestandsrenditeVertiefungForm propertyId={property.id} existing={facts} />
        </details>

        <DueDiligencePanel
          propertyId={property.id}
          objectLabel={property.title || property.address_text}
          initialDocuments={(documents ?? []) as DueDiligenceDocumentRow[]}
          initialDueDiligence={dueDiligence}
        />

        <p style={{ marginTop: "1.2rem" }}>
          <Link href="/" className="maplink">
            ← Zurück zur Übersicht
          </Link>
        </p>
      </main>
    </div>
  );
}
