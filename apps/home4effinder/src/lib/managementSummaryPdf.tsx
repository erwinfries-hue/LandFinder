import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { DueDiligenceResult, DueDiligenceSeverity } from "@landfinder/domain";
import type { BestandsrenditeAnalysisResult, Verhandlungskorridor, MoeblierungsAlternative } from "./bestandsrendite";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "./dueDiligenceCategories";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";
import { formatChf } from "./format";

/**
 * Management-Summary als druckbarer One-Pager — Wunsch: "ein zusätzliches management
 * summary als one pager pdf erstellen zum download". Bewusst per `@react-pdf/renderer`
 * (reines JS, kein Headless-Browser/Puppeteer nötig — auf Vercel serverless ohne
 * Sonderkonfiguration lauffähig) statt HTML→PDF-Konvertierung der vollen Detailseite:
 * ein Management-Summary ist eine bewusst KURATIERTE Auswahl der wichtigsten Punkte,
 * kein Ausdruck der ganzen (sehr langen) Detailseite.
 *
 * Wird bei jedem Download frisch aus den bereits berechneten Werten gerendert (siehe
 * `GET .../management-summary.pdf`) — kein gespeichertes/gecachtes PDF, dadurch immer
 * automatisch aktuell ("soll auch bei der objektsicht ergänzt und aktualisiert werden
 * wenn vorhanden" — ohne Caching gibt es nichts, das veralten könnte).
 */

const SEVERITY_LABEL: Record<DueDiligenceSeverity, string> = { OK: "Unauffällig", KLAERUNGSBEDARF: "Klärungsbedarf", RISIKO: "Risiko" };
const SEVERITY_COLOR: Record<DueDiligenceSeverity, string> = { OK: "#4f6e38", KLAERUNGSBEDARF: "#93641a", RISIKO: "#9b3b30" };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#12201b" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#4a574e", marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 5, borderBottom: "1pt solid #cdd5cb", paddingBottom: 2 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  scoreBadge: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#f3faf8", borderRadius: 4, paddingVertical: 3, paddingHorizontal: 10 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap" },
  metric: { width: "33%", marginBottom: 8, paddingRight: 8 },
  metricLabel: { fontSize: 7.5, color: "#4a574e", textTransform: "uppercase", letterSpacing: 0.3 },
  metricValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 1 },
  metricSub: { fontSize: 7, color: "#7c8880", marginTop: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  categoryRow: { flexDirection: "row", marginBottom: 2, alignItems: "flex-start" },
  categoryDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2.5, marginRight: 5 },
  categoryLabel: { width: 130, fontFamily: "Helvetica-Bold" },
  listItem: { marginBottom: 2 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#7c8880", borderTop: "0.5pt solid #cdd5cb", paddingTop: 4 },
});

function scoreColor(totalScore: number): string {
  if (totalScore >= 70) return "#4f6e38";
  if (totalScore >= 40) return "#93641a";
  return "#9b3b30";
}

/**
 * PDF-Variante von `renditeAmpelColor` (lib/investmentScore.ts) — react-pdf kann keine
 * CSS-Variablen auflösen, daher hier dieselben Schwellenwerte mit den bereits im PDF
 * verwendeten Hex-Farben (siehe scoreColor/SEVERITY_COLOR oben).
 */
function renditeAmpelColorPdf(istPercent: number, zielPercent: number): string {
  if (istPercent >= zielPercent) return "#4f6e38";
  if (istPercent >= zielPercent - 1) return "#93641a";
  return "#9b3b30";
}

export interface ManagementSummaryInput {
  addressText: string;
  canton: string;
  wohnflaecheM2: number;
  generatedAt: Date;
  analysis: BestandsrenditeAnalysisResult;
  verhandlungskorridor: Verhandlungskorridor | null;
  dueDiligence: DueDiligenceResult | null;
  investmentScore: number | undefined;
  /** Schattenrechnung des jeweils anderen Szenarios (möbliert/unmöbliert) — siehe computeMoeblierungsAlternative. */
  moeblierungsAlternative: MoeblierungsAlternative | null;
  /** Referenzwerte aus dem "Annahmen"-Reiter, wie bereits auf der Objektseite (BestandsrenditeAnalysisView) verwendet — färbt die Rendite-Kennzahlen unten relativ zum Ziel (Review-Fund: PDF hatte bisher keine Ampel/Ziel-Anzeige, obwohl die Objektseite selbst schon eine hat). */
  bruttoRenditeZielPercent: number;
  nettoRenditeZielPercent: number;
}

function ManagementSummaryDocument({
  addressText,
  canton,
  wohnflaecheM2,
  generatedAt,
  analysis,
  verhandlungskorridor,
  dueDiligence,
  investmentScore,
  moeblierungsAlternative,
  bruttoRenditeZielPercent,
  nettoRenditeZielPercent,
}: ManagementSummaryInput) {
  const { schnellcheck, investmentCase, noiBreakdown, mehrjahresmodell, hypothek } = analysis;
  const missingZwingend = dueDiligence?.missingDocuments.filter((m) => m.priority === "ZWINGEND") ?? [];
  const topQuestions = dueDiligence?.sellerQuestions.slice(0, 5) ?? [];
  const alt = moeblierungsAlternative;
  const altLabel = alt ? `Alt. (${alt.label})` : "";
  const lastYear = mehrjahresmodell.years[mehrjahresmodell.years.length - 1];

  return (
    <Document title={`Management Summary — ${addressText}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{addressText}</Text>
        <Text style={styles.subtitle}>
          {canton} · Management Summary · erstellt {generatedAt.toLocaleDateString("de-CH")} · HOME4efFINDER
        </Text>

        <View style={styles.scoreRow}>
          {investmentScore !== undefined ? (
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor(investmentScore) }]}>
              <Text>{investmentScore}/100</Text>
            </View>
          ) : (
            <Text style={{ color: "#7c8880" }}>Investment-Score: noch nicht bewertet (Due-Diligence-Synthese fehlt)</Text>
          )}
          {dueDiligence?.overallSummary ? <Text style={{ flex: 1 }}>{dueDiligence.overallSummary}</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>Kennzahlen</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Kaufpreis</Text>
            <Text style={styles.metricValue}>CHF {formatChf(schnellcheck.kaufpreisChf)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Preis/m²</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(schnellcheck.preisProM2Chf))}</Text>
            <Text style={styles.metricSub}>{formatChf(wohnflaecheM2)} m²</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Bruttorendite</Text>
            <Text style={[styles.metricValue, { color: renditeAmpelColorPdf(schnellcheck.bruttoRenditePercent, bruttoRenditeZielPercent) }]}>
              {schnellcheck.bruttoRenditePercent.toFixed(2)}%
            </Text>
            <Text style={styles.metricSub}>
              {alt ? `${altLabel}: ${alt.analysis.schnellcheck.bruttoRenditePercent.toFixed(2)}% · ` : ""}Ziel: {bruttoRenditeZielPercent}%
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Eigenkapitalbedarf</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(schnellcheck.eigenkapitalbedarfChf))}</Text>
            <Text style={styles.metricSub}>inkl. Kaufnebenkosten, Belehnung {schnellcheck.belehnungPercent}%</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Cash-on-Cash</Text>
            <Text style={styles.metricValue}>{investmentCase.cashOnCashPercent.toFixed(2)}%</Text>
            {alt ? <Text style={styles.metricSub}>{altLabel}: {alt.analysis.investmentCase.cashOnCashPercent.toFixed(2)}%</Text> : null}
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Nachhaltiger Cashflow p.a.</Text>
            <Text style={[styles.metricValue, { color: investmentCase.wasserfall.nachhaltigerCashflowChf >= 0 ? "#4f6e38" : "#9b3b30" }]}>
              CHF {formatChf(Math.round(investmentCase.wasserfall.nachhaltigerCashflowChf))}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Jahresnettomiete</Text>
            <Text style={styles.metricValue}>CHF {formatChf(schnellcheck.jahresnettomieteChf)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Investment Case (Ebene B)</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>All-in-Investition</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(analysis.allInInvestitionChf))}</Text>
            <Text style={styles.metricSub}>Kaufpreis + Nebenkosten + Renovation + Möblierung</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Bruttorendite All-in</Text>
            <Text style={[styles.metricValue, { color: renditeAmpelColorPdf(investmentCase.bruttoRenditeAllInPercent, bruttoRenditeZielPercent) }]}>
              {investmentCase.bruttoRenditeAllInPercent.toFixed(2)}%
            </Text>
            <Text style={styles.metricSub}>Ziel: {bruttoRenditeZielPercent}%</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Nettorendite vor Finanzierung</Text>
            <Text style={[styles.metricValue, { color: renditeAmpelColorPdf(investmentCase.nettoRenditeVorFinanzierungPercent, nettoRenditeZielPercent) }]}>
              {investmentCase.nettoRenditeVorFinanzierungPercent.toFixed(2)}%
            </Text>
            <Text style={styles.metricSub}>Ziel: {nettoRenditeZielPercent}%</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Eigenkapital</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(analysis.eigenkapitalChf))}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>NOI (vor Finanzierung)</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(noiBreakdown.noiChf))}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>1./2. Hypothek</Text>
            <Text style={styles.metricValue}>
              CHF {formatChf(Math.round(hypothek.ersteHypothekChf))} / {formatChf(Math.round(hypothek.zweiteHypothekChf))}
            </Text>
          </View>
        </View>
        <View style={styles.metricsGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Cashflow nach Zins</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachZinsChf))}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Cashflow nach Amortisation</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachAmortisationChf))}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Cashflow nach kalk. Steuer</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachSteuerChf))}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{mehrjahresmodell.years.length}-Jahres-Modell (Ebene C)</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Levered IRR</Text>
            <Text style={styles.metricValue}>{mehrjahresmodell.leveredIrrPercent !== undefined ? `${mehrjahresmodell.leveredIrrPercent.toFixed(1)}%` : "—"}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Unlevered IRR</Text>
            <Text style={styles.metricValue}>{mehrjahresmodell.unleveredIrrPercent !== undefined ? `${mehrjahresmodell.unleveredIrrPercent.toFixed(1)}%` : "—"}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Equity Multiple</Text>
            <Text style={styles.metricValue}>{mehrjahresmodell.equityMultiple.toFixed(2)}×</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Exit-Erlös (netto)</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(mehrjahresmodell.exit.netProceedsChf))}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Kumulierter Cashflow</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(lastYear.kumulierterCashflowChf))}</Text>
          </View>
        </View>

        {verhandlungskorridor?.maximumChf !== undefined ? (
          <>
            <Text style={styles.sectionTitle}>Verhandlungskorridor</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Eröffnungsangebot</Text>
                <Text style={styles.metricValue}>
                  {verhandlungskorridor.eroeffnungChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.eroeffnungChf))}` : "—"}
                </Text>
                {verhandlungskorridor.eroeffnungChf === undefined ? <Text style={styles.metricSub}>eigene Markteinschätzung nicht erfasst</Text> : null}
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Zielpreis</Text>
                <Text style={styles.metricValue}>
                  {verhandlungskorridor.zielChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.zielChf))}` : "—"}
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Maximum</Text>
                <Text style={styles.metricValue}>CHF {formatChf(Math.round(verhandlungskorridor.maximumChf))}</Text>
                {alt && alt.verhandlungskorridor.maximumChf !== undefined ? (
                  <Text style={styles.metricSub}>{altLabel}: CHF {formatChf(Math.round(alt.verhandlungskorridor.maximumChf))}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : null}

        {dueDiligence ? (
          <>
            <Text style={styles.sectionTitle}>Due-Diligence-Status je Kategorie</Text>
            {CATEGORY_ORDER.map((cat) => {
              const found = dueDiligence.categories.find((c) => c.category === cat);
              const status = found?.status ?? "OK";
              return (
                <View key={cat} style={styles.categoryRow}>
                  <View style={[styles.categoryDot, { backgroundColor: SEVERITY_COLOR[status] }]} />
                  <Text style={styles.categoryLabel}>{CATEGORY_LABEL[cat]}</Text>
                  <Text style={{ color: SEVERITY_COLOR[status] }}>{SEVERITY_LABEL[status]}</Text>
                </View>
              );
            })}
          </>
        ) : null}

        {missingZwingend.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Fehlende Pflichtdokumente</Text>
            {missingZwingend.map((m) => (
              <Text key={m.documentType} style={styles.listItem}>
                • {DOCUMENT_TYPE_CATALOG[m.documentType]?.label ?? m.documentType}
              </Text>
            ))}
          </>
        ) : null}

        {topQuestions.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Wichtigste offene Fragen an Verkäufer/Makler</Text>
            {topQuestions.map((q, i) => (
              <Text key={i} style={styles.listItem}>
                • {q.question}
              </Text>
            ))}
          </>
        ) : null}

        <Text style={styles.footer}>
          Automatisch generiert von HOME4efFINDER, kein Ersatz für eine juristische/steuerliche Beratung. Alle Zahlen basieren auf manuell erfassten Annahmen —
          siehe Objektseite für die vollständige Herleitung.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderManagementSummaryPdf(input: ManagementSummaryInput): Promise<Buffer> {
  return renderToBuffer(<ManagementSummaryDocument {...input} />);
}
