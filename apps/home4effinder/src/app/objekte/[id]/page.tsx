import Link from "next/link";
import { notFound } from "next/navigation";
import type { DueDiligenceResult, DueDiligenceFieldUpdateProposal, DueDiligenceContradiction } from "@landfinder/domain";
import { Panel, Chip } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { Metric } from "@/components/MetricPrimitives";
import { formatChf } from "@/lib/format";
import { getPropertyById, getPropertyDocuments, getPropertyDueDiligence, formatDateTime } from "@/lib/properties";
import { BESTANDSRENDITE_PARAMETERS, defaultsOf } from "@landfinder/financial-engine";
import {
  computeBestandsrenditeAnalysis,
  computeVerhandlungskorridor,
  computeMoeblierungsAlternative,
  parseBestandsrenditeFacts,
  isAllowedUpdateField,
  isProposalAlreadyApplied,
} from "@/lib/bestandsrendite";
import { computeInvestmentScore, scoreTone } from "@/lib/investmentScore";
import { getParameterOverrides } from "@/lib/parameterOverrides";
import { BestandsrenditeVertiefungForm } from "@/components/BestandsrenditeVertiefungForm";
import { BestandsrenditeAnalysisView } from "@/components/BestandsrenditeAnalysisView";
import { DueDiligencePanel, type DueDiligenceDocumentRow } from "@/components/DueDiligencePanel";
import { PropertyDeleteButton } from "@/components/PropertyDeleteButton";
import { DueDiligenceRefreshButton } from "@/components/DueDiligenceRefreshButton";
import { PropertyEditForm } from "@/components/PropertyEditForm";
import { ObjectSectionNav } from "@/components/ObjectSectionNav";
import { MarktEinordnungView } from "@/components/MarktEinordnungView";
import { getRegionByCantonGemeinde, getRegionMarketData } from "@/lib/regionMarketData";

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

  const [documents, dueDiligence, parameterOverrides, region, regionData] = await Promise.all([
    getPropertyDocuments(property.id),
    getPropertyDueDiligence(property.id),
    getParameterOverrides(),
    property.gemeinde ? getRegionByCantonGemeinde(property.canton, property.gemeinde) : Promise.resolve(null),
    property.gemeinde ? getRegionMarketData(property.canton, property.gemeinde) : Promise.resolve(null),
  ]);

  const propertyInput = { kaufpreisChf: property.asking_price_chf, wohnflaecheM2: property.wohnflaeche_m2, canton: property.canton };
  const analysis = facts ? computeBestandsrenditeAnalysis(propertyInput, facts, parameterOverrides) : null;
  const verhandlungskorridor = facts ? computeVerhandlungskorridor(propertyInput, facts, parameterOverrides) : null;
  const moeblierungsAlternative = facts ? computeMoeblierungsAlternative(propertyInput, facts, parameterOverrides) : null;
  const effectiveParams = { ...defaultsOf(BESTANDSRENDITE_PARAMETERS), ...parameterOverrides };

  const investmentScore =
    analysis && dueDiligence?.result
      ? computeInvestmentScore({
          categories: dueDiligence.result.categories,
          missingDocuments: dueDiligence.result.missingDocuments,
          bruttoRenditePercent: analysis.schnellcheck.bruttoRenditePercent,
          cashflowChf: analysis.schnellcheck.groberCashflowChf,
        })
      : undefined;

  // Nur Anker zu Abschnitten, die auf dieser Seite tatsächlich gerendert werden (z.B. kein
  // "Verhandlungskorridor"-Link, wenn dafür keine Bisektionslösung gefunden wurde) — siehe
  // ObjectSectionNav.tsx.
  // Labels bewusst kurz (statt z.B. "Bestandsrendite"/"Verhandlungskorridor" voll
  // ausgeschrieben) — Rückmeldung: auf dem Handy möglichst ohne horizontales Scrollen
  // sichtbar, siehe ObjectSectionNav.tsx/.section-nav in globals.css.
  const sectionLinks = [
    { href: "#objektdaten", label: "Objekt" },
    ...(analysis ? [{ href: "#schnellcheck", label: "Rendite" }] : []),
    ...(verhandlungskorridor?.maximumChf !== undefined ? [{ href: "#verhandlungskorridor", label: "Verhandlung" }] : []),
    ...(analysis ? [{ href: "#investment-case", label: "Investment" }] : []),
    ...(analysis ? [{ href: "#value-add-moeblierung", label: "Value-Add" }] : []),
    ...(analysis ? [{ href: "#mehrjahresmodell", label: "15 Jahre" }] : []),
    ...(regionData ? [{ href: "#markteinordnung", label: "Markt" }] : []),
    { href: "#due-diligence", label: "Due Diligence" },
  ];

  return (
    <div className="shell">
      <SideNav current="objekte" />
      <main className="main">
        <ObjectSectionNav links={sectionLinks} />
        <Panel id="objektdaten" className="dethead anchor-target">
          <div className="eyebrow">Bestandswohnung · Rendite-/Buy-to-let-Objekt</div>
          <div className="dethead-top">
            <div>
              <h1>{property.title || property.address_text}</h1>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", alignItems: "flex-end" }}>
              <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
                {analysis ? (
                  <a href={`/api/properties/${property.id}/management-summary`} className="btn" style={{ width: "auto" }}>
                    Management Summary (PDF)
                  </a>
                ) : null}
                <PropertyDeleteButton propertyId={property.id} propertyLabel={property.title || property.address_text} />
              </div>
              <DueDiligenceRefreshButton propertyId={property.id} disabled={(documents ?? []).length === 0} />
            </div>
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
              l={analysis && analysis.parkierung.totalZusatzChf > 0 ? "Kaufpreis (inkl. Garage/Aussenparkplatz/Hobbyraum)" : "Kaufpreis"}
              v={`CHF ${formatChf(analysis ? analysis.schnellcheck.kaufpreisChf : property.asking_price_chf)}`}
              sub={
                analysis && analysis.parkierung.totalZusatzChf > 0
                  ? `Basis CHF ${formatChf(property.asking_price_chf)} + Garage/Aussenparkplatz/Hobbyraum CHF ${formatChf(analysis.parkierung.totalZusatzChf)}`
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

        {analysis ? (
          <BestandsrenditeAnalysisView
            result={analysis}
            verhandlungskorridor={verhandlungskorridor}
            moeblierungsAlternative={moeblierungsAlternative}
            bruttoRenditeZielPercent={effectiveParams.bruttoRenditeZielPercent}
            nettoRenditeZielPercent={effectiveParams.nettoRenditeZielPercent}
          />
        ) : null}

        {regionData && region && analysis && facts && property.wohnflaeche_m2 > 0 ? (
          <MarktEinordnungView
            regionId={region.id}
            regionData={regionData}
            zimmerzahl={facts.zimmerzahl}
            mieteChfPerM2PerYear={(facts.miete.wohnungsMieteChfPerMonth * 12) / property.wohnflaeche_m2}
            kaufpreisChfPerM2={analysis.schnellcheck.preisProM2Chf}
          />
        ) : null}
        <details style={{ marginTop: "0.9rem" }} open={!facts}>
          <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--accent)" }}>
            Bestandsrendite-Fakten {facts ? "bearbeiten" : "erfassen"}
          </summary>
          <BestandsrenditeVertiefungForm
            propertyId={property.id}
            existing={facts}
            canton={property.canton}
            bestandsrenditeUpdatedAt={property.bestandsrendite_updated_at}
            parameterOverrides={parameterOverrides}
          />
        </details>

        {(() => {
          // Ergänzung, siehe DueDiligencePanel.tsx: "übernommen ✓" darf nicht nur ein
          // client-seitiger, ephemerer Zustand sein — nach einem Neuladen zeigte der
          // Vorschlag sonst wieder einen aktiven "Übernehmen"-Button, obwohl der Wert
          // längst gespeichert war (per Live-Test beobachtet). Stattdessen hier serverseitig
          // aus dem TATSÄCHLICH gespeicherten Wert hergeleitet — bleibt über jeden Reload
          // hinweg korrekt und löst nebenbei auch die Widerspruchs-Optionen sauber im
          // Entweder-oder-Sinn auf: nur die Option, deren Wert wirklich im Feld steht, gilt
          // als übernommen.
          const rawFacts = (property.bestandsrendite as Record<string, unknown>) ?? {};
          const ddResult = (dueDiligence?.result ?? null) as DueDiligenceResult | null;
          const candidates: { field: string; value: string | number }[] = [
            ...(ddResult?.fieldUpdateProposals ?? []).map((p: DueDiligenceFieldUpdateProposal) => ({ field: p.field, value: p.newValue })),
            ...(ddResult?.contradictions ?? []).flatMap((c: DueDiligenceContradiction) =>
              c.field ? c.options.map((o) => ({ field: c.field!, value: o.value })) : [],
            ),
          ];
          const alreadyAppliedProposalKeys = candidates
            .filter((c) => isAllowedUpdateField(c.field) && isProposalAlreadyApplied(rawFacts, c.field, c.value))
            .map((c) => `${c.field}::${c.value}`);

          return (
            <div id="due-diligence" className="anchor-target">
              <DueDiligencePanel
                propertyId={property.id}
                objectLabel={property.title || property.address_text}
                initialDocuments={(documents ?? []) as DueDiligenceDocumentRow[]}
                initialDueDiligence={dueDiligence}
                alreadyAppliedProposalKeys={alreadyAppliedProposalKeys}
              />
            </div>
          );
        })()}

        <p style={{ marginTop: "0.9rem" }}>
          <Link href="/" className="maplink">
            ← Zurück zur Übersicht
          </Link>
        </p>
      </main>
    </div>
  );
}
