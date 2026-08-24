import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel, Chip, type ChipTone } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { Metric } from "@/components/MetricPrimitives";
import { formatChf } from "@/lib/format";
import { getPropertyById, getPropertyDocuments, getPropertyDueDiligence, formatDateTime } from "@/lib/properties";
import { computeBestandsrenditeAnalysis, computeVerhandlungskorridor, parseBestandsrenditeFacts } from "@/lib/bestandsrendite";
import { computeInvestmentScore } from "@/lib/investmentScore";
import { BestandsrenditeVertiefungForm } from "@/components/BestandsrenditeVertiefungForm";
import { BestandsrenditeAnalysisView } from "@/components/BestandsrenditeAnalysisView";
import { DueDiligencePanel, type DueDiligenceDocumentRow } from "@/components/DueDiligencePanel";
import { PropertyDeleteButton } from "@/components/PropertyDeleteButton";
import { PropertyEditForm } from "@/components/PropertyEditForm";

function scoreTone(totalScore: number): ChipTone {
  if (totalScore >= 70) return "good";
  if (totalScore >= 40) return "warn";
  return "bad";
}

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

  const analysis = facts
    ? computeBestandsrenditeAnalysis({ kaufpreisChf: property.asking_price_chf, wohnflaecheM2: property.wohnflaeche_m2, canton: property.canton }, facts)
    : null;
  const verhandlungskorridor = facts
    ? computeVerhandlungskorridor({ kaufpreisChf: property.asking_price_chf, wohnflaecheM2: property.wohnflaeche_m2, canton: property.canton }, facts)
    : null;

  const investmentScore =
    analysis && dueDiligence?.result
      ? computeInvestmentScore({
          categories: dueDiligence.result.categories,
          missingDocuments: dueDiligence.result.missingDocuments,
          bruttoRenditePercent: analysis.schnellcheck.bruttoRenditePercent,
          cashflowChf: analysis.schnellcheck.groberCashflowChf,
        })
      : undefined;

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
          {investmentScore ? (
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem", margin: ".6rem 0 0" }}>
              <Chip tone={scoreTone(investmentScore.totalScore)}>Investment-Score {investmentScore.totalScore}/100</Chip>
              <span style={{ color: "var(--ink-faint)", fontSize: ".76rem" }}>
                Due Diligence {investmentScore.dueDiligenceScore}/60 · Dokumentation {investmentScore.documentationScore}/15 · Rendite {investmentScore.renditeScore}/25 —
                errechnet, nicht von Claude geschätzt
              </span>
            </div>
          ) : null}
          <div className="metricgrid" style={{ marginTop: investmentScore ? ".8rem" : 0 }}>
            <Metric l="Kanton" v={property.canton} />
            <Metric l="Adresse" v={property.address_text} />
            <Metric
              l={analysis && analysis.parkierung.totalZusatzChf > 0 ? "Kaufpreis (inkl. Parkplatz/Garage)" : "Kaufpreis"}
              v={`CHF ${formatChf(analysis ? analysis.schnellcheck.kaufpreisChf : property.asking_price_chf)}`}
              sub={
                analysis && analysis.parkierung.totalZusatzChf > 0
                  ? `Basis CHF ${formatChf(property.asking_price_chf)} + Parkplatz/Garage CHF ${formatChf(analysis.parkierung.totalZusatzChf)}`
                  : undefined
              }
            />
            <Metric l="Wohnfläche" v={`${formatChf(property.wohnflaeche_m2)} m²`} />
            <Metric l="Erfasst" v={formatDateTime(property.created_at)} />
            {property.bestandsrendite_updated_at ? (
              <Metric l="Bestandsrendite zuletzt aktualisiert" v={formatDateTime(property.bestandsrendite_updated_at)} />
            ) : null}
          </div>
          {property.listing_url ? (
            <p style={{ marginTop: ".6rem" }}>
              <a href={property.listing_url} target="_blank" rel="noopener noreferrer" className="maplink">
                Zum Original-Inserat ↗
              </a>
            </p>
          ) : null}
          {property.market_reference_notes ? (
            <div style={{ marginTop: ".8rem" }}>
              <div className="eyebrow">Marktvergleich (manuell erfasst)</div>
              <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: ".3rem 0 0", whiteSpace: "pre-wrap" }}>{property.market_reference_notes}</p>
            </div>
          ) : null}
        </Panel>

        <details style={{ marginTop: "0.9rem" }}>
          <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--accent)" }}>Objekt-Basisdaten bearbeiten</summary>
          <PropertyEditForm property={property} />
        </details>

        {analysis ? <BestandsrenditeAnalysisView result={analysis} verhandlungskorridor={verhandlungskorridor} /> : null}
        <details style={{ marginTop: "0.9rem" }} open={!facts}>
          <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--accent)" }}>
            Bestandsrendite-Fakten {facts ? "bearbeiten" : "erfassen"}
          </summary>
          <BestandsrenditeVertiefungForm
            propertyId={property.id}
            existing={facts}
            canton={property.canton}
            bestandsrenditeUpdatedAt={property.bestandsrendite_updated_at}
          />
        </details>

        <DueDiligencePanel
          propertyId={property.id}
          objectLabel={property.title || property.address_text}
          initialDocuments={(documents ?? []) as DueDiligenceDocumentRow[]}
          initialDueDiligence={dueDiligence}
        />

        <p style={{ marginTop: "0.9rem" }}>
          <Link href="/" className="maplink">
            ← Zurück zur Übersicht
          </Link>
        </p>
      </main>
    </div>
  );
}
