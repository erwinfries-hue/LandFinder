import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { DueDiligenceResult, DueDiligenceSeverity } from "@landfinder/domain";
import type { BestandsrenditeAnalysisResult, Verhandlungskorridor, MoeblierungsAlternative } from "./bestandsrendite";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "./dueDiligenceCategories";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";
import { formatChf } from "./format";
import { computeBewertungsAmpeln, type AmpelStatus } from "./bewertungsAmpel";

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
// Single Source of Truth für die drei Ampel-Hex-Farben im PDF (react-pdf kann keine CSS-
// Variablen auflösen) — SEVERITY_COLOR/scoreColor/renditeAmpelColorPdf/AMPEL_STATUS_COLOR
// leiten sich alle hiervon ab, statt dieselben drei Hex-Werte mehrfach zu duplizieren
// (Review-Fund: eine künftige Palettenänderung hätte sonst leicht eine Stelle vergessen können).
const STATUS_COLOR: Record<AmpelStatus, string> = { good: "#4f6e38", warn: "#93641a", bad: "#9b3b30" };
const SEVERITY_COLOR: Record<DueDiligenceSeverity, string> = { OK: STATUS_COLOR.good, KLAERUNGSBEDARF: STATUS_COLOR.warn, RISIKO: STATUS_COLOR.bad };

/**
 * Bewusst sehr kompakt (kleine Fonts/Abstände) — Rückmeldung: "es soll auf einer Seite
 * Platz haben, ohne dass du Inhalte weglässt". Bei variablem Inhalt (Anzahl offener
 * Fragen/fehlender Dokumente aus der Due-Diligence-Synthese, Länge der KI-generierten
 * `overallSummary`) ist eine harte Ein-Seiten-Garantie nicht möglich, ohne Inhalte zu
 * kürzen — die Kompaktheit hier ist so bemessen, dass ein normal umfangreiches Objekt
 * (siehe Fixture in managementSummaryPdf.test.ts) auf eine Seite passt, ohne
 * unleserlich zu werden.
 */
const styles = StyleSheet.create({
  page: { padding: 26, fontSize: 8.5, fontFamily: "Helvetica", color: "#12201b" },
  h1: { fontSize: 14.5, fontFamily: "Helvetica-Bold", marginBottom: 1.5 },
  subtitle: { fontSize: 8, color: "#4a574e", marginBottom: 8 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 7, marginBottom: 3, borderBottom: "1pt solid #cdd5cb", paddingBottom: 1.5 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  scoreBadge: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: "#f3faf8", borderRadius: 4, paddingVertical: 2.5, paddingHorizontal: 9 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap" },
  metric: { width: "33%", marginBottom: 5, paddingRight: 8 },
  metricLabel: { fontSize: 6.8, color: "#4a574e", textTransform: "uppercase", letterSpacing: 0.3 },
  metricValue: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 0.5 },
  metricSub: { fontSize: 6.3, color: "#7c8880", marginTop: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  categoryRow: { flexDirection: "row", marginBottom: 1.5, alignItems: "flex-start" },
  categoryDot: { width: 5.5, height: 5.5, borderRadius: 2.75, marginTop: 2, marginRight: 5 },
  categoryLabel: { width: 125, fontFamily: "Helvetica-Bold" },
  ampelRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  ampelItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  ampelDot: { width: 5.5, height: 5.5, borderRadius: 2.75 },
  listItem: { marginBottom: 1.5 },
  footer: { position: "absolute", bottom: 14, left: 26, right: 26, fontSize: 6.3, color: "#7c8880", borderTop: "0.5pt solid #cdd5cb", paddingTop: 3 },
});

function scoreColor(totalScore: number): string {
  if (totalScore >= 70) return STATUS_COLOR.good;
  if (totalScore >= 40) return STATUS_COLOR.warn;
  return STATUS_COLOR.bad;
}

/**
 * PDF-Variante von `renditeAmpelColor` (lib/investmentScore.ts) — react-pdf kann keine
 * CSS-Variablen auflösen, daher hier dieselben Schwellenwerte mit den bereits im PDF
 * verwendeten Hex-Farben (siehe STATUS_COLOR oben).
 */
function renditeAmpelColorPdf(istPercent: number, zielPercent: number): string {
  if (istPercent >= zielPercent) return STATUS_COLOR.good;
  if (istPercent >= zielPercent - 1) return STATUS_COLOR.warn;
  return STATUS_COLOR.bad;
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
  /** Vorformatierter Hinweistext aus ubsWohnattraktivitaet.ts, falls die Gemeinde dort genannt ist — sonst undefined (kein Platzhalter-Text). */
  ubsWohnattraktivitaetHinweis?: string;
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
  ubsWohnattraktivitaetHinweis,
}: ManagementSummaryInput) {
  const { schnellcheck, investmentCase, noiBreakdown, mehrjahresmodell, hypothek } = analysis;
  const missingZwingend = dueDiligence?.missingDocuments.filter((m) => m.priority === "ZWINGEND") ?? [];
  const topQuestions = dueDiligence?.sellerQuestions.slice(0, 5) ?? [];
  const alt = moeblierungsAlternative;
  const altLabel = alt ? `Alt. (${alt.label})` : "";
  const lastYear = mehrjahresmodell.years[mehrjahresmodell.years.length - 1];
  // Kein `regionMarkt` hier — der One-Pager bleibt bewusst kompakt und ohne den
  // zusätzlichen (asynchronen) Regionsreport-Datenzugriff, siehe DECISIONS.md. Auf der
  // Objektseite selbst (BewertungsuebersichtView) ist die Kaufpreis-vs-Markt-Ampel
  // zusätzlich vorhanden.
  const ampeln = computeBewertungsAmpeln({
    nettoRenditePercent: investmentCase.nettoRenditeVorFinanzierungPercent,
    nettoRenditeZielPercent,
    nachhaltigerCashflowChf: investmentCase.wasserfall.nachhaltigerCashflowChf,
    dueDiligenceOverallStatus: dueDiligence?.overallStatus,
    moeblierungFurnitureRoiPercent: analysis.furnitureRoi?.roiPercent,
  });

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

        {ampeln.length > 0 ? (
          <View style={styles.ampelRow}>
            {ampeln.map((a) => (
              <View key={a.key} style={styles.ampelItem}>
                <View style={[styles.ampelDot, { backgroundColor: STATUS_COLOR[a.status] }]} />
                <Text>
                  {a.label}: {a.detail}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {ubsWohnattraktivitaetHinweis ? <Text style={{ fontSize: 6.8, color: "#7c8880", marginBottom: 4 }}>{ubsWohnattraktivitaetHinweis}</Text> : null}

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
                <Text style={styles.metricLabel}>Preisobergrenze (Nettorendite)</Text>
                <Text style={styles.metricValue}>
                  {verhandlungskorridor.nettoZielChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.nettoZielChf))}` : "—"}
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
