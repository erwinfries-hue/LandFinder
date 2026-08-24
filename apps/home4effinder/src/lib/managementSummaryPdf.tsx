import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { DueDiligenceResult, DueDiligenceSeverity } from "@landfinder/domain";
import type { BestandsrenditeAnalysisResult, Verhandlungskorridor } from "./bestandsrendite";
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

export interface ManagementSummaryInput {
  addressText: string;
  canton: string;
  generatedAt: Date;
  analysis: BestandsrenditeAnalysisResult;
  verhandlungskorridor: Verhandlungskorridor | null;
  dueDiligence: DueDiligenceResult | null;
  investmentScore: number | undefined;
}

function ManagementSummaryDocument({ addressText, canton, generatedAt, analysis, verhandlungskorridor, dueDiligence, investmentScore }: ManagementSummaryInput) {
  const { schnellcheck, investmentCase } = analysis;
  const missingZwingend = dueDiligence?.missingDocuments.filter((m) => m.priority === "ZWINGEND") ?? [];
  const topQuestions = dueDiligence?.sellerQuestions.slice(0, 5) ?? [];

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
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Bruttorendite</Text>
            <Text style={styles.metricValue}>{schnellcheck.bruttoRenditePercent.toFixed(2)}%</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Eigenkapitalbedarf</Text>
            <Text style={styles.metricValue}>CHF {formatChf(Math.round(schnellcheck.eigenkapitalbedarfChf))}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Cash-on-Cash</Text>
            <Text style={styles.metricValue}>{investmentCase.cashOnCashPercent.toFixed(2)}%</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Nachhaltiger Cashflow p.a.</Text>
            <Text style={[styles.metricValue, { color: investmentCase.wasserfall.nachhaltigerCashflowChf >= 0 ? "#4f6e38" : "#9b3b30" }]}>
              CHF {formatChf(Math.round(investmentCase.wasserfall.nachhaltigerCashflowChf))}
            </Text>
          </View>
        </View>

        {verhandlungskorridor?.maximumChf !== undefined ? (
          <>
            <Text style={styles.sectionTitle}>Verhandlungskorridor</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Eröffnungsangebot</Text>
                <Text style={styles.metricValue}>CHF {formatChf(Math.round(verhandlungskorridor.eroeffnungChf!))}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Zielpreis</Text>
                <Text style={styles.metricValue}>CHF {formatChf(Math.round(verhandlungskorridor.zielChf!))}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Maximum</Text>
                <Text style={styles.metricValue}>CHF {formatChf(Math.round(verhandlungskorridor.maximumChf))}</Text>
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
