import type { Metadata } from "next";
import Link from "next/link";
import { Panel, Chip } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { DeletePropertyButton } from "@/components/DeletePropertyButton";
import { getProperties, getPropertyDueDiligence, formatDateTime, type PropertyRow } from "@/lib/properties";
import { formatChf } from "@/lib/format";
import { computeBestandsrenditeAnalysis, parseBestandsrenditeFacts, type ParameterOverrides } from "@/lib/bestandsrendite";
import { computeInvestmentScore, scoreTone } from "@/lib/investmentScore";
import { getParameterOverrides } from "@/lib/parameterOverrides";

export const metadata: Metadata = { title: "Objekte — HOME4efFINDER" };

/** Zeigt live den aktuellen Datenbankstand statt eines beim letzten Deploy eingefrorenen Snapshots. */
export const dynamic = "force-dynamic";

/**
 * Ampel-Übersicht für die Objektliste — Rückmeldung: "überlege, wo du mit einem
 * ergänzenden ampelsystem eine einfache uebersicht der bewertung machen kannst". Die
 * Liste zeigte bisher nur Rohdaten (Adresse/Preis/Fläche), keinerlei Einschätzung — man
 * musste jedes Objekt einzeln öffnen, um zu sehen, ob es sich überhaupt lohnt,
 * genauer hinzuschauen. Derselbe deterministische Investment-Score wie auf der
 * Objekt-Detailseite (computeInvestmentScore), hier nur kompakt als farbiger Chip statt
 * mit Aufschlüsselung — die volle Aufschlüsselung bleibt der Detailseite vorbehalten.
 * `undefined` (graue "–"-Chip), solange Bestandsrendite-Fakten und/oder Due-Diligence-
 * Synthese fehlen — ein Score ohne jede Grundlage wäre irreführend präzise.
 */
async function computeAmpelScore(property: PropertyRow, parameterOverrides: ParameterOverrides): Promise<number | undefined> {
  const factsParsed = property.bestandsrendite ? parseBestandsrenditeFacts(property.bestandsrendite) : null;
  const facts = factsParsed && "facts" in factsParsed ? factsParsed.facts : null;
  if (!facts) return undefined;

  const analysis = computeBestandsrenditeAnalysis(
    { kaufpreisChf: property.asking_price_chf, wohnflaecheM2: property.wohnflaeche_m2, canton: property.canton },
    facts,
    parameterOverrides,
  );
  const dueDiligence = await getPropertyDueDiligence(property.id);
  if (!dueDiligence?.result) return undefined;

  const score = computeInvestmentScore({
    categories: dueDiligence.result.categories,
    missingDocuments: dueDiligence.result.missingDocuments,
    bruttoRenditePercent: analysis.schnellcheck.bruttoRenditePercent,
    cashflowChf: analysis.schnellcheck.groberCashflowChf,
  });
  return score?.totalScore;
}

export default async function HomePage() {
  const properties = await getProperties();
  const configured = properties !== null;
  const parameterOverrides = configured ? await getParameterOverrides() : {};
  const ampelScores = configured ? await Promise.all(properties.map((p) => computeAmpelScore(p, parameterOverrides))) : [];

  return (
    <div className="shell">
      <SideNav current="objekte" />
      <main className="main">
        <div className="pagehead">
          <h1>Objekte</h1>
        </div>

        {!configured ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              fehlen) — daher lassen sich hier noch keine Objekte anzeigen.
            </p>
          </Panel>
        ) : properties.length === 0 ? (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem", margin: 0 }}>
              Noch keine Objekte erfasst.{" "}
              <Link href="/neu" className="maplink">
                Erste Bestandswohnung erfassen →
              </Link>
            </p>
          </Panel>
        ) : (
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <div className="eyebrow">
              {properties.length} Objekt{properties.length === 1 ? "" : "e"}
            </div>
            <div className="twrap">
              <table style={{ marginTop: "1rem" }}>
                <thead>
                  <tr>
                    <th title="Investment-Score (0-100) — Due Diligence, Dokumentation, Rendite. Grau, solange Bestandsrendite-Fakten und/oder Due-Diligence-Synthese fehlen.">
                      Ampel
                    </th>
                    <th>Adresse</th>
                    <th>Kanton</th>
                    <th className="num">Kaufpreis</th>
                    <th className="num">Wohnfläche</th>
                    <th>Erfasst</th>
                    <th>Bestandsrendite</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p, i) => (
                    <tr key={p.id}>
                      <td>
                        {ampelScores[i] !== undefined ? (
                          <Chip tone={scoreTone(ampelScores[i]!)} title={`Investment-Score ${ampelScores[i]}/100`}>
                            {ampelScores[i]}
                          </Chip>
                        ) : (
                          <Chip tone="neutral" title="Noch nicht bewertet — Bestandsrendite-Fakten und/oder Due-Diligence-Synthese fehlen.">
                            –
                          </Chip>
                        )}
                      </td>
                      <td>
                        <Link href={`/objekte/${p.id}`} className="maplink">
                          {p.title || p.address_text}
                        </Link>
                      </td>
                      <td>{p.canton}</td>
                      <td className="num mono">CHF {formatChf(p.asking_price_chf)}</td>
                      <td className="num mono">{formatChf(p.wohnflaeche_m2)} m²</td>
                      <td>{formatDateTime(p.created_at)}</td>
                      <td>{p.bestandsrendite_updated_at ? `erfasst (${formatDateTime(p.bestandsrendite_updated_at)})` : "—"}</td>
                      <td>
                        <DeletePropertyButton propertyId={p.id} label={p.title || p.address_text} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}
