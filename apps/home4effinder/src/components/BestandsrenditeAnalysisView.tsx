import { Panel, Chip, InfoHint } from "@landfinder/ui";
import { Metric } from "@/components/MetricPrimitives";
import { formatChf } from "@/lib/format";
import { renditeAmpelColor } from "@/lib/investmentScore";
import { strengsteZielgroesse, verhandlungskorridorRelation } from "@/lib/bestandsrendite";
import type { BestandsrenditeAnalysisResult, Verhandlungskorridor, PreisStufe, MoeblierungsAlternative, VermietungsstrategienVergleich } from "@/lib/bestandsrendite";
import { computePriceZones, classifyPriceZone, priceZoneTone, computeValueCreation } from "@/lib/priceStrategy";
import type { MarketValueRange, CashOnCashBreakdown, PriceZoneBand, OpeningBidSuggestion } from "@/lib/priceStrategy";
import { isReturnMateriallyRateDependent } from "@/lib/scenarioEngine";
import type { ScenarioResult, InterestRateStressTestRow } from "@/lib/scenarioEngine";

const PRICE_ZONE_TONE_BG: Record<"good" | "warn" | "bad", string> = { good: "var(--good-bg)", warn: "var(--warn-bg)", bad: "var(--bad-bg)" };

const VERHANDLUNGSKORRIDOR_BAR_TONE: Record<string, string> = {
  eroeffnung: "var(--ink-faint)",
  ziel: "var(--accent)",
  marktMedian: "var(--neutral-ink)",
  inserat: "var(--warn)",
  maximum: "var(--bad)",
};

/**
 * Einfache Punkt-auf-Linie-Visualisierung des Verhandlungskorridors (Rückmeldung:
 * "muss noch aussagekräftiger, griffiger [...] gemacht werden") — eine Zeile mit vier
 * Zahlen ist auf einen Blick schwer einzuordnen, eine Linie mit Positionsmarkern zeigt
 * sofort, wo Eröffnung/Ziel/Inseratpreis/Maximum zueinander liegen. Bewusst schlicht
 * gehalten (farbige Punkte + Legende darunter statt positionierter Text-Labels direkt
 * an den Punkten) — bei eng beieinanderliegenden Werten würden sich Text-Labels
 * überlappen; die Legende bleibt davon unabhängig lesbar. Kein Live-Browser-Test in
 * dieser Umgebung möglich (siehe DECISIONS.md), daher bewusst diese robustere Variante.
 */
function VerhandlungskorridorBar({
  eroeffnungChf,
  realistischesZielChf,
  marktMedianKaufpreisChf,
  inseratpreisChf,
  maximumChf,
  zoneBands,
}: {
  eroeffnungChf: number | undefined;
  realistischesZielChf: number | undefined;
  /** Markt-Median-Kaufpreis der Gemeinde (Regionsreport), `undefined` wenn keiner vorliegt — siehe Prop-Kommentar am Panel unten. */
  marktMedianKaufpreisChf: number | undefined;
  inseratpreisChf: number;
  maximumChf: number;
  /** 7-stufige Preisampel-Bänder (siehe priceStrategy.ts::computePriceZones) — als farbige Hintergrundsegmente hinter den Punkten, `undefined` wenn kein sinnvoller Zonenbereich existiert (Auftrag Abschnitt 12: "Visualisierung [...] als horizontaler Price Corridor"). */
  zoneBands?: PriceZoneBand[];
}) {
  const points: { key: string; label: string; value: number }[] = [];
  if (eroeffnungChf !== undefined) points.push({ key: "eroeffnung", label: "Eröffnung", value: eroeffnungChf });
  if (realistischesZielChf !== undefined) points.push({ key: "ziel", label: "Realistisches Ziel", value: realistischesZielChf });
  if (marktMedianKaufpreisChf !== undefined) points.push({ key: "marktMedian", label: "Markt-Median (Gemeinde)", value: marktMedianKaufpreisChf });
  points.push({ key: "inserat", label: "Inseratpreis", value: inseratpreisChf });
  points.push({ key: "maximum", label: "Maximum", value: maximumChf });

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Etwas Randabstand, damit Marker an den Enden nicht direkt auf dem Linienrand sitzen.
  const pad = Math.max((rawMax - rawMin) * 0.08, 1);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const percent = (v: number): number => ((v - min) / (max - min)) * 100;

  return (
    <div style={{ marginTop: ".9rem", marginBottom: "1.1rem" }}>
      <div style={{ position: "relative", height: "8px", background: "var(--line)", borderRadius: "4px", margin: "0 .4rem", overflow: "hidden" }}>
        {zoneBands
          ? zoneBands.map((band) => {
              const bandLowChf = band.lowChf ?? min;
              const bandHighChf = band.highChf ?? max;
              // Nur den innerhalb [min, max] sichtbaren Ausschnitt des Bands zeichnen — offene Randzonen (Exceptional/Reject) reichen sonst über den sichtbaren Bereich hinaus.
              const left = Math.max(0, percent(bandLowChf));
              const right = Math.min(100, percent(bandHighChf));
              if (right <= left) return null;
              return (
                <div
                  key={band.zone}
                  title={`${band.label}: ${band.lowChf !== undefined ? `ab CHF ${formatChf(Math.round(band.lowChf))}` : "offen"} bis ${band.highChf !== undefined ? `CHF ${formatChf(Math.round(band.highChf))}` : "offen"}`}
                  style={{ position: "absolute", left: `${left}%`, width: `${right - left}%`, top: 0, bottom: 0, background: PRICE_ZONE_TONE_BG[priceZoneTone(band.zone)] }}
                />
              );
            })
          : null}
        {points.map((p) => (
          <div
            key={p.key}
            title={`${p.label}: CHF ${formatChf(Math.round(p.value))}`}
            style={{
              position: "absolute",
              left: `${percent(p.value)}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: VERHANDLUNGSKORRIDOR_BAR_TONE[p.key],
              border: "2px solid var(--surface)",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem .9rem", fontSize: ".72rem", color: "var(--ink-soft)", marginTop: ".6rem" }}>
        {points.map((p) => (
          <span key={p.key} style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: VERHANDLUNGSKORRIDOR_BAR_TONE[p.key], display: "inline-block", flexShrink: 0 }} />
            {p.label}: CHF {formatChf(Math.round(p.value))}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Reine Anzeige der drei Ebenen — die Berechnung selbst
 * (`computeBestandsrenditeAnalysis`) ist eine reine Funktion ohne externe
 * Abhängigkeit, läuft deshalb serverseitig in der Detailseite, kein
 * Client-Live-Recompute nötig.
 */
export function BestandsrenditeAnalysisView({
  result,
  verhandlungskorridor,
  preisStufentabelle,
  moeblierungsAlternative,
  vermietungsstrategienVergleich,
  bruttoRenditeZielPercent,
  nettoRenditeZielPercent,
  inseratpreisChf,
  marktMedianKaufpreisChf,
  marketValueRange,
  cashOnCashBreakdown,
  scenarioResults,
  stressTestRows,
  openingBidSuggestion,
}: {
  result: BestandsrenditeAnalysisResult;
  /** `undefined`/`null`, wenn `computeVerhandlungskorridor` keine Bisektionslösung fand (Objekt trägt sich unter keinen Umständen). */
  verhandlungskorridor?: Verhandlungskorridor | null;
  /** Siehe `computePreisStufentabelle` — leer, wenn kein Renditeziel gesetzt ist oder Ziel-Preis und aktueller Kaufpreis nach Rundung zusammenfallen. Dann wird keine Tabelle gerendert. */
  preisStufentabelle?: PreisStufe[];
  /**
   * Für die "Schattenrechnung" (Rückmeldung: "wo dieser Vergleich überall durchschlägt")
   * — das jeweils andere Szenario (möbliert/unmöbliert), komplett durchgerechnet.
   * `null`, wenn kein Alternativszenario existiert (SHORT_STAY oder keine Möblierungsdaten
   * erfasst), siehe `computeMoeblierungsAlternative`.
   */
  moeblierungsAlternative?: MoeblierungsAlternative | null;
  /**
   * SIPIS Furnished-Rental-Modul (v1.1) — voller Vergleich aller vier Vermietungsmodelle
   * (Investment Value/Cash-on-Cash/Nettorendite/Value Creation je Modell, plus eine
   * Empfehlung), siehe `computeVermietungsstrategienVergleich`. `undefined`/`null`, wenn
   * keine Bestandsrendite-Fakten vorliegen.
   */
  vermietungsstrategienVergleich?: VermietungsstrategienVergleich | null;
  /**
   * Referenzwerte aus dem "Annahmen"-Reiter (`BESTANDSRENDITE_PARAMETERS.bruttoRenditeZielPercent`/
   * `nettoRenditeZielPercent`) — Rückmeldung: "die ampel [...] überall dort [einbauen], wo werte
   * und/oder informationen vom soll abweichen". Färbt die Rendite-Kennzahlen unten grün/gelb/rot
   * relativ zum Ziel (siehe `renditeAmpelColor`), rein informativ, ohne die Werte selbst zu ändern.
   */
  bruttoRenditeZielPercent: number;
  nettoRenditeZielPercent: number;
  /**
   * Aktueller Inseratpreis (`property.kaufpreisChf`, derselbe Basis-Kaufpreis Wohnung,
   * auf dem auch der Verhandlungskorridor selbst rechnet) — Rückmeldung: der
   * Verhandlungskorridor "muss noch aussagekräftiger, griffiger und realitätsnah
   * gemacht werden und zus. ins Verhältnis zum Inserate-Start-Verkäuferpreis gesetzt
   * werden". Setzt jeden Korridor-Punkt als CHF-/%-Differenz dazu in Bezug, siehe
   * `verhandlungskorridorRelation`.
   */
  inseratpreisChf: number;
  /**
   * Markt-Median-Kaufpreis der Gemeinde für die passende Zimmerzahl (Regionsreport,
   * q50-Quantil CHF/m² × Wohnfläche) — Rückmeldung: "könnte der zielpreis mit dem
   * marktpreis abgestimmt werden wenn daten vorhanden?". Bewusst NUR als zusätzlicher
   * Referenzpunkt neben dem Zielpreis angezeigt, ändert dessen Berechnung nicht.
   * `undefined`, wenn kein Regionsreport mit passender Zimmerzahl für die Gemeinde
   * vorliegt (dann entfällt der Vergleich, statt etwas zu erfinden).
   */
  marktMedianKaufpreisChf?: number;
  /** Marktwert-Bandbreite der Gemeinde (siehe priceStrategy.ts::computeMarketValueRange) — `undefined` unter denselben Bedingungen wie `marktMedianKaufpreisChf`. */
  marketValueRange?: MarketValueRange;
  /** Zwei zusätzliche, einfachere Cash-on-Cash-Kennzahlen vor Steuer/Reserven (siehe priceStrategy.ts::computeCashOnCashBreakdown) — `undefined`, wenn kein Eigenkapital eingesetzt wird. */
  cashOnCashBreakdown?: CashOnCashBreakdown;
  /** Conservative/Base/Upside (siehe scenarioEngine.ts::buildDefaultScenarios/computeScenarios) — `undefined`/leer, wenn keine Bestandsrendite-Fakten vorliegen. */
  scenarioResults?: ScenarioResult[];
  /** Zins-Stresstest (siehe scenarioEngine.ts::computeInterestRateStressTest) — `undefined`/leer unter derselben Bedingung. */
  stressTestRows?: InterestRateStressTestRow[];
  /** Taktischer Eröffnungsangebot-Vorschlag (siehe priceStrategy.ts::computeOpeningBidSuggestion) — `undefined`, wenn kein Faktor eingeschätzt wurde oder kein Economic Target vorliegt. Rein informativ, überschreibt nie das manuell erfasste Eröffnungsangebot. */
  openingBidSuggestion?: OpeningBidSuggestion;
}) {
  const {
    schnellcheck,
    investmentCase,
    noiBreakdown,
    parkierung,
    kategorienRenditen,
    mehrjahresmodell,
    investmentTreiber,
    furnishingRoi,
    incrementalFurnitureNoi,
    furnishedRentalDelta,
    furnishedOpexBreakdown,
    moeblierungReserveChfPerJahr,
    moeblierungsVergleich,
    renovationRoi,
    renovationSummary,
    breakEven,
    stweg,
    hypothek,
    schnellcheckKostenBreakdown,
  } = result;
  const lastYear = mehrjahresmodell.years[mehrjahresmodell.years.length - 1];
  const alt = moeblierungsAlternative;
  const altLabel = alt ? `Alternative (${alt.label})` : "";

  // Nur die Parkierungsarten nennen, die tatsächlich zusätzlich zum Basis-Kaufpreis
  // dazugerechnet wurden (nicht die, die bereits im Basis-Kaufpreis enthalten sind).
  const parkierungTeile = [
    parkierung.parkplatzZusatzChf > 0 ? `Aussenparkplatz CHF ${formatChf(parkierung.parkplatzZusatzChf)}` : null,
    parkierung.garagenplatzZusatzChf > 0 ? `Garage CHF ${formatChf(parkierung.garagenplatzZusatzChf)}` : null,
    parkierung.hobbyraumZusatzChf > 0 ? `Hobbyraum CHF ${formatChf(parkierung.hobbyraumZusatzChf)}` : null,
  ].filter((t): t is string => t !== null);
  const parkierungSub = parkierungTeile.length > 0 ? `davon zusätzlich: ${parkierungTeile.join(", ")}` : undefined;

  // Nur Kategorien mit tatsächlich erfasstem Kaufpreis zeigen — Wohnung ist Pflichtfeld,
  // daher immer dabei; Garage/Aussenparkplatz/Hobbyraum nur wenn > 0 (siehe
  // `KategorienRenditen` in bestandsrendite.ts).
  const kategorienRenditenRows: { label: string; rendite: (typeof kategorienRenditen)["wohnung"] }[] = [
    { label: "Wohnung", rendite: kategorienRenditen.wohnung },
    ...(kategorienRenditen.garage.kaufpreisChf > 0 ? [{ label: "Garage", rendite: kategorienRenditen.garage }] : []),
    ...(kategorienRenditen.aussenparkplatz.kaufpreisChf > 0 ? [{ label: "Aussenparkplatz", rendite: kategorienRenditen.aussenparkplatz }] : []),
    ...(kategorienRenditen.hobbyraum.kaufpreisChf > 0 ? [{ label: "Hobbyraum", rendite: kategorienRenditen.hobbyraum }] : []),
  ];

  // Für die Herleitungs-Sub-Texte unter Eigenkapitalbedarf/Eigenkapital unten — beide
  // Grössen stecken bereits fertig verrechnet im Ergebnis, hier nur zur Anzeige wieder in
  // ihre Bestandteile zerlegt (Rückmeldung: "in kleiner Schrift ergänzend [...] herleiten,
  // was alles inkl. ist im Total").
  const hypothekTotalChf = hypothek.ersteHypothekChf + hypothek.zweiteHypothekChf;
  const kaufnebenkostenChf = schnellcheck.eigenkapitalbedarfChf - schnellcheck.kaufpreisChf + hypothekTotalChf;

  // Verhandlungskorridor ins Verhältnis zum Inseratpreis gesetzt (Rückmeldung: "muss noch
  // aussagekräftiger, griffiger und realitätsnah gemacht werden und zus. ins Verhältnis
  // zum Inserate-Start-Verkäuferpreis gesetzt werden") — "realistisches Ziel" ist die
  // strengere der beiden gesetzten Zielgrössen, dieselbe Logik wie der untere Anker der
  // Preis-Stufentabelle (siehe strengsteZielgroesse).
  const realistischesZielChf = verhandlungskorridor ? strengsteZielgroesse(verhandlungskorridor) : undefined;
  // 7-stufige Preisampel (Auftrag Abschnitt 7) — ausschliesslich aus den beiden
  // finanziellen Ankerpunkten abgeleitet (realistisches Ziel/Economic Target und
  // Maximum/Walk-Away Price), NICHT aus dem Marktwert (siehe priceStrategy.ts-
  // Modulkommentar: "Strong Buy != günstiger als Markt"). `undefined`, wenn kein
  // sinnvoller Zonenbereich existiert (kein Renditeziel gesetzt, oder das Ziel erreicht
  // die Solvenzgrenze bereits).
  const priceZoneBands =
    realistischesZielChf !== undefined && verhandlungskorridor?.maximumChf !== undefined
      ? computePriceZones(realistischesZielChf, verhandlungskorridor.maximumChf)
      : undefined;
  const inseratpreisZone = priceZoneBands ? classifyPriceZone(inseratpreisChf, priceZoneBands) : undefined;
  // Value Creation (Auftrag Abschnitt 6) — übersetzt die NOI-Wirkung von Möblierung/
  // Renovation in einen impliziten Immobilienwert-Zuwachs, direkt vergleichbar mit dem
  // CHF-Verhandlungsspielraum oben. Möblierung nutzt bewusst den NOI-basierten
  // `incrementalFurnitureNoi` (Phase 1), nicht den rein umsatzbasierten `furnitureRoi` —
  // sonst würde hier genau der Guardrail-Fehler "höherer Umsatz = höherer Gewinn"
  // wiederholt, den `incrementalFurnitureNoi` extra dafür behebt.
  const furnitureValueCreation = incrementalFurnitureNoi ? computeValueCreation(incrementalFurnitureNoi.incrementalNoiChf, nettoRenditeZielPercent) : undefined;
  const renovationValueCreation = renovationRoi ? computeValueCreation(renovationRoi.zusaetzlicherJahresertragChf, nettoRenditeZielPercent) : undefined;
  const eroeffnungRelation = verhandlungskorridorRelation(verhandlungskorridor?.eroeffnungChf, inseratpreisChf);
  const zielRelation = verhandlungskorridorRelation(verhandlungskorridor?.zielChf, inseratpreisChf);
  const nettoZielRelation = verhandlungskorridorRelation(verhandlungskorridor?.nettoZielChf, inseratpreisChf);
  const maximumRelation = verhandlungskorridorRelation(verhandlungskorridor?.maximumChf, inseratpreisChf);
  const realistischesZielRelation = verhandlungskorridorRelation(realistischesZielChf, inseratpreisChf);
  // Zielpreis vs. Markt-Median — `verhandlungskorridorRelation` ist generisch (Punkt vs.
  // Basis), hier mit dem Markt-Median statt dem Inseratpreis als Basis wiederverwendet.
  const zielVsMarktMedianRelation =
    marktMedianKaufpreisChf !== undefined ? verhandlungskorridorRelation(verhandlungskorridor?.zielChf, marktMedianKaufpreisChf) : undefined;

  function formatRelation(relation: { diffChf: number; diffPercent: number } | undefined): string | undefined {
    if (!relation) return undefined;
    const vorzeichen = relation.diffChf > 0 ? "+" : relation.diffChf < 0 ? "−" : "±";
    const richtung = relation.diffChf < 0 ? "unter" : relation.diffChf > 0 ? "über" : "auf";
    return `${vorzeichen}CHF ${formatChf(Math.abs(Math.round(relation.diffChf)))} (${vorzeichen}${Math.abs(relation.diffPercent).toFixed(1)}%) ${richtung} Inseratpreis`;
  }

  // Preisstrategie-Panel: rein regelbasierte Interpretation aus den bereits berechneten
  // Schwellenwerten (Guardrail: "keine qualitative Kaufempfehlung ohne zugrunde liegende
  // Kennzahlen") — kein LLM, keine freie Formulierung, nur eine von vier festen
  // Kombinationen aus "im/über Marktwert-Band" × "unter/über Investment Value".
  function buildPreisstrategieInterpretation(): string | undefined {
    if (!marketValueRange || verhandlungskorridor?.nettoZielChf === undefined) return undefined;
    const ueberMarkt = inseratpreisChf > marketValueRange.highChf;
    const unterMarkt = inseratpreisChf < marketValueRange.lowChf;
    const marktLage = ueberMarkt ? "über dem Marktwert der Gemeinde" : unterMarkt ? "unter dem Marktwert der Gemeinde" : "marktgerecht angeboten";
    const ueberInvestmentValue = inseratpreisChf > verhandlungskorridor.nettoZielChf;

    if (!ueberMarkt && !ueberInvestmentValue) {
      return `Das Objekt ist ${marktLage} und erreicht das eigene Nettorenditeziel bereits zum Angebotspreis.`;
    }
    if (!ueberMarkt && ueberInvestmentValue) {
      return "Marktseitig plausibel, für die Renditestrategie jedoch zu teuer. Attraktiv erst bei deutlicher Preisreduktion oder nachweisbarer NOI-Steigerung.";
    }
    if (ueberMarkt && !ueberInvestmentValue) {
      return "Über dem Marktwert der Gemeinde, aber unterhalb des eigenen Investment Value — ungewöhnlich, ggf. Objektqualität/Ausstattung prüfen, die der reine Quantilvergleich nicht erfasst.";
    }
    return "Sowohl über dem Marktwert als auch über dem für die eigene Renditestrategie gerechtfertigten Preis — weder marktseitig noch wirtschaftlich derzeit attraktiv.";
  }

  function formatMarktMedianVergleich(): string | undefined {
    if (marktMedianKaufpreisChf === undefined) return undefined;
    const basis = `Markt-Median Gemeinde: CHF ${formatChf(Math.round(marktMedianKaufpreisChf))}`;
    if (!zielVsMarktMedianRelation) return basis;
    const richtung = zielVsMarktMedianRelation.diffChf < 0 ? "unter" : zielVsMarktMedianRelation.diffChf > 0 ? "über" : "auf";
    return `${basis} — Zielpreis ${Math.abs(zielVsMarktMedianRelation.diffPercent).toFixed(1)}% ${richtung} Markt-Median`;
  }

  return (
    <>
      <Panel id="schnellcheck" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
        <div className="sectionhead">
          <h2>Ebene A — Schnellcheck</h2>
        </div>
        <div className="metricgrid">
          <Metric
            l="Kaufpreis (Wohnung + Garage/Aussenparkplatz/Hobbyraum)"
            v={`CHF ${formatChf(schnellcheck.kaufpreisChf)}`}
            sub={parkierungSub}
            hint="= Basis-Kaufpreis (Objekt-Basisdaten) + separate Kaufpreise für Garage/Aussenparkplatz/Hobbyraum (0, falls diese bereits im Basis-Kaufpreis enthalten sind)."
          />
          <Metric l="Preis/m²" v={`CHF ${formatChf(Math.round(schnellcheck.preisProM2Chf))}`} hint="= Kaufpreis ÷ Wohnfläche (m²)." />
          <Metric l="Jahresnettomiete" v={`CHF ${formatChf(schnellcheck.jahresnettomieteChf)}`} hint="= (Nettomiete Wohnung + Miete Garage/Aussenparkplatz/Hobbyraum) × 12." />
          <Metric
            l="Bruttorendite (Kaufpreis, Sollmiete)"
            v={`${schnellcheck.bruttoRenditePercent.toFixed(2)}%`}
            valueColor={renditeAmpelColor(schnellcheck.bruttoRenditePercent, bruttoRenditeZielPercent)}
            sub={
              <>
                {alt ? `${altLabel}: ${alt.analysis.schnellcheck.bruttoRenditePercent.toFixed(2)}% · Ziel: ${bruttoRenditeZielPercent}%` : `Ziel: ${bruttoRenditeZielPercent}%`}
                {kategorienRenditenRows.length > 1 ? (
                  <details style={{ marginTop: ".25rem" }}>
                    <summary style={{ cursor: "pointer", color: "var(--accent)" }}>Nach Kategorie</summary>
                    <div style={{ marginTop: ".25rem", display: "flex", flexDirection: "column", gap: ".15rem" }}>
                      {kategorienRenditenRows.map((row) => (
                        <div key={row.label}>
                          {row.label}: CHF {formatChf(row.rendite.kaufpreisChf)} · CHF {formatChf(row.rendite.jahresmieteChf)}/Jahr · {row.rendite.bruttoRenditePercent.toFixed(2)}%
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            }
            hint="= Jahresnettomiete ÷ Kaufpreis × 100. Farbe relativ zum Bruttorendite-Ziel (Annahmen-Reiter). Aufklappbar: je Kategorie eigener Kaufpreis ÷ eigene Jahresmiete — Hypothek/Cashflow/Steuer bleiben unverändert auf dem Gesamt-Kaufpreis gerechnet (eine Liegenschaft hat eine Hypothek, nicht vier)."
          />
          <Metric
            l="Eigenkapitalbedarf"
            v={`CHF ${formatChf(Math.round(schnellcheck.eigenkapitalbedarfChf))}`}
            sub={`= CHF ${formatChf(Math.round(schnellcheck.kaufpreisChf))} − CHF ${formatChf(Math.round(hypothekTotalChf))} (Hypothek) + CHF ${formatChf(Math.round(kaufnebenkostenChf))} (Nebenkosten)`}
            hint="= Kaufpreis − Hypothek (Belehnung-% × Kaufpreis) + Kaufnebenkosten."
          />
          <Metric l="Belehnung" v={`${schnellcheck.belehnungPercent}%`} hint="= Belehnung-% der 1. Hypothek + Belehnung-% der 2. Hypothek, wie erfasst." />
          <Metric
            l="Grober Cashflow"
            v={`CHF ${formatChf(Math.round(schnellcheck.groberCashflowChf))}`}
            valueColor={schnellcheck.groberCashflowChf >= 0 ? "var(--good)" : "var(--bad)"}
            sub={`= CHF ${formatChf(Math.round(schnellcheck.jahresnettomieteChf))} (Miete) − CHF ${formatChf(Math.round(schnellcheckKostenBreakdown.laufendeKostenChfPerYear))} (Kosten) − CHF ${formatChf(Math.round(schnellcheckKostenBreakdown.zinsChf))} (Zins)`}
            hint="= Jahresnettomiete − pauschale laufende Kosten − Hypothekarzins. Grobe Schnellcheck-Schätzung ohne Amortisation/Steuer/Reserven — die volle Aufschlüsselung folgt in Ebene B."
          />
        </div>

        <div className="sectionhead" style={{ marginTop: "0.8rem" }}>
          <h2 style={{ fontSize: ".85rem" }}>1./2. Hypothek</h2>
        </div>
        <div className="metricgrid">
          <Metric
            l="1. Hypothek"
            v={`CHF ${formatChf(Math.round(hypothek.ersteHypothekChf))}`}
            sub={`Amortisation CHF ${formatChf(Math.round(hypothek.ersteAmortisationChfPerYear))} p.a.`}
            hint={'Betrag = Kaufpreis × Belehnung-% (1. Hypothek). Amortisation: bei „Prozent pro Jahr" = Betrag × Satz; bei „Dauer in Jahren" = Betrag ÷ Jahre.'}
          />
          <Metric
            l="2. Hypothek"
            v={`CHF ${formatChf(Math.round(hypothek.zweiteHypothekChf))}`}
            sub={`Amortisation CHF ${formatChf(Math.round(hypothek.zweiteAmortisationChfPerYear))} p.a.`}
            hint={'Betrag = Kaufpreis × Belehnung-% (2. Hypothek). Amortisation: bei „Prozent pro Jahr" = Betrag × Satz; bei „Dauer in Jahren" = Betrag ÷ Jahre.'}
          />
        </div>
      </Panel>

      {verhandlungskorridor?.maximumChf !== undefined ? (
        <Panel id="verhandlungskorridor" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
          <div className="sectionhead">
            <h2>Verhandlungskorridor</h2>
          </div>
          <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".6rem" }}>
            Realistisches Verhandlungsziel ist die strengere der beiden gesetzten Renditegrenzen (Zielpreis/
            Preisobergrenze Nettorendite) — die Zahl, an der sich ein Angebot orientieren sollte. Maximum ist
            dagegen eine reine Cashflow-Solvenzgrenze (nachhaltiger Cashflow = CHF 0), keine Kaufempfehlung: bei
            tiefen Zinsen kann sie weit über dem liegen, was unter dem eigenen Renditeziel noch lohnt. Alle Werte
            gelten für den Basis-Kaufpreis Wohnung, ohne Parkplatz/Garage/Hobbyraum.
            {marktMedianKaufpreisChf !== undefined
              ? " Zusätzlich zeigt der Markt-Median (Gemeinde, passende Zimmerzahl) an, ob das eigene Renditeziel auch marktüblich ist."
              : ""}
          </p>

          {realistischesZielRelation ? (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: ".5rem",
                flexWrap: "wrap",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: ".6rem .9rem",
                marginBottom: ".7rem",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "1.05rem", color: realistischesZielRelation.diffChf < 0 ? "var(--good)" : "var(--ink)" }}>
                {realistischesZielRelation.diffChf < 0
                  ? `Verhandlungsspielraum: CHF ${formatChf(Math.abs(Math.round(realistischesZielRelation.diffChf)))} (${Math.abs(realistischesZielRelation.diffPercent).toFixed(1)}%)`
                  : "Kein rechnerischer Verhandlungsspielraum"}
              </span>
              <span style={{ fontSize: ".78rem", color: "var(--ink-soft)" }}>
                {realistischesZielRelation.diffChf < 0
                  ? `unter dem Inseratpreis von CHF ${formatChf(Math.round(inseratpreisChf))} — realistisches Ziel CHF ${formatChf(Math.round(realistischesZielChf!))}`
                  : `— das realistische Ziel (CHF ${formatChf(Math.round(realistischesZielChf!))}) liegt bereits auf oder über dem Inseratpreis (CHF ${formatChf(Math.round(inseratpreisChf))}): der Deal erreicht das Renditeziel schon zum Inseratpreis.`}
              </span>
              {inseratpreisZone ? (
                <span style={{ marginLeft: "auto" }}>
                  <Chip tone={priceZoneTone(inseratpreisZone.zone)}>Preiszone: {inseratpreisZone.label}</Chip>
                </span>
              ) : null}
            </div>
          ) : null}

          <VerhandlungskorridorBar
            eroeffnungChf={verhandlungskorridor.eroeffnungChf}
            realistischesZielChf={realistischesZielChf}
            marktMedianKaufpreisChf={marktMedianKaufpreisChf}
            inseratpreisChf={inseratpreisChf}
            maximumChf={verhandlungskorridor.maximumChf}
            zoneBands={priceZoneBands}
          />

          <div className="metricgrid">
            <Metric
              l="Eröffnungsangebot"
              v={verhandlungskorridor.eroeffnungChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.eroeffnungChf))}` : "—"}
              sub={
                <>
                  {verhandlungskorridor.eroeffnungChf === undefined ? "eigene Markteinschätzung noch nicht erfasst" : formatRelation(eroeffnungRelation)}
                  {openingBidSuggestion ? (
                    <>
                      <br />
                      Taktischer Vorschlag: CHF {formatChf(Math.round(openingBidSuggestion.suggestedChf))} (
                      {openingBidSuggestion.totalDiskontPercent.toFixed(1)}% unter Economic Target) —{" "}
                      {openingBidSuggestion.beitraege.map((b) => b.label).join(", ")}
                    </>
                  ) : null}
                </>
              }
              hint="Eigene Markteinschätzung, siehe Bestandsrendite-Fakten, Abschnitt „Verhandlung“ — kein Rechenwert. Der taktische Vorschlag (falls Faktoren erfasst sind) ändert dieses Feld nie automatisch, siehe priceStrategy.ts::computeOpeningBidSuggestion."
            />
            <Metric
              l="Zielpreis"
              v={verhandlungskorridor.zielChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.zielChf))}` : "—"}
              sub={
                verhandlungskorridor.zielChf === undefined ? (
                  "kein Renditeziel gesetzt (Annahmen-Reiter)"
                ) : (
                  <>
                    {formatRelation(zielRelation)}
                    {marktMedianKaufpreisChf !== undefined ? (
                      <>
                        <br />
                        {formatMarktMedianVergleich()}
                      </>
                    ) : null}
                  </>
                )
              }
              hint="= Kaufpreis, bei dem die Bruttorendite (Kaufpreis) das Renditeziel erreicht (Annahmen-Reiter), gedeckelt auf das Maximum. Markt-Median-Vergleich (falls Regionsreport für die Gemeinde mit passender Zimmerzahl vorliegt): CHF/m²-Median × Wohnfläche, rein informativ — ändert die Zielpreis-Berechnung selbst nicht."
            />
            <Metric
              l="Preisobergrenze (Nettorendite)"
              v={verhandlungskorridor.nettoZielChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.nettoZielChf))}` : "—"}
              sub={
                verhandlungskorridor.nettoZielChf === undefined ? (
                  "kein Nettorenditeziel gesetzt (Annahmen-Reiter)"
                ) : (
                  <>
                    {formatRelation(nettoZielRelation)}
                    {alt?.verhandlungskorridor.nettoZielChf !== undefined ? (
                      <>
                        <br />
                        {altLabel}: CHF {formatChf(Math.round(alt.verhandlungskorridor.nettoZielChf))}
                      </>
                    ) : null}
                  </>
                )
              }
              hint="= Kaufpreis, bei dem die Nettorendite vor Finanzierung das Nettorenditeziel erreicht (Annahmen-Reiter), gedeckelt auf das Maximum — im Gegensatz zum Zielpreis inkl. Leerstand/Betriebskosten/Eigentümerkosten, meist die strengere Grenze."
            />
            <Metric
              l="Maximum"
              v={`CHF ${formatChf(Math.round(verhandlungskorridor.maximumChf))}`}
              valueColor={maximumRelation && maximumRelation.diffChf < 0 ? "var(--bad)" : undefined}
              sub={
                <>
                  {maximumRelation && maximumRelation.diffChf < 0 ? (
                    <span style={{ color: "var(--bad)" }}>Achtung: unter dem Inseratpreis — Objekt trägt sich zum Inseratpreis rechnerisch nicht.</span>
                  ) : (
                    formatRelation(maximumRelation)
                  )}
                  {alt?.verhandlungskorridor.maximumChf !== undefined ? (
                    <>
                      <br />
                      {altLabel}: CHF {formatChf(Math.round(alt.verhandlungskorridor.maximumChf))}
                    </>
                  ) : null}
                </>
              }
              hint="Kaufpreis, bei dem der nachhaltige Cashflow (nach Zins, Amortisation, Steuer, Reparatur-/Leerstandsreserve) gerade CHF 0 erreicht — reine Solvenzgrenze, keine Kaufempfehlung: mehr zu zahlen ist unter den aktuellen Annahmen rechnerisch nicht mehr cashflow-tragfähig, sagt aber nichts über die Renditequalität des Deals aus."
            />
          </div>

          {preisStufentabelle && preisStufentabelle.length > 0 ? (
            <div style={{ marginTop: "1rem" }}>
              <div className="eyebrow" style={{ marginBottom: ".4rem" }}>
                Preis-Stufentabelle
              </div>
              <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".5rem" }}>
                Wie sich Rendite und Cashflow zwischen der Preisobergrenze (Nettorendite) bzw. dem Zielpreis und dem
                aktuellen Kaufpreis entwickeln — für die Verhandlung selbst, nicht nur die drei Eckwerte oben.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="stresstable">
                  <thead>
                    <tr>
                      <th>Kaufpreis</th>
                      <th>Bruttorendite</th>
                      <th>Nettorendite</th>
                      <th>Total-Investition</th>
                      <th>Eigenkapital</th>
                      <th>Cashflow</th>
                      <th>Cash-on-Cash</th>
                      {priceZoneBands ? <th>Preiszone</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {preisStufentabelle.map((stufe) => {
                      const stufenZone = priceZoneBands ? classifyPriceZone(stufe.kaufpreisChf, priceZoneBands) : undefined;
                      return (
                        <tr key={stufe.kaufpreisChf} style={stufe.istAktuellerKaufpreis ? { fontWeight: 600 } : undefined}>
                          <td className="num mono">
                            CHF {formatChf(stufe.kaufpreisChf)}
                            {stufe.anchorLabel ? ` (${stufe.anchorLabel})` : ""}
                          </td>
                          <td className="num mono" style={{ color: renditeAmpelColor(stufe.bruttoRenditePercent, bruttoRenditeZielPercent) }}>
                            {stufe.bruttoRenditePercent.toFixed(2)}%
                          </td>
                          <td className="num mono" style={{ color: renditeAmpelColor(stufe.nettoRenditeVorFinanzierungPercent, nettoRenditeZielPercent) }}>
                            {stufe.nettoRenditeVorFinanzierungPercent.toFixed(2)}%
                          </td>
                          <td className="num mono">CHF {formatChf(Math.round(stufe.totalInvestitionChf))}</td>
                          <td className="num mono">CHF {formatChf(Math.round(stufe.eigenkapitalChf))}</td>
                          <td className="num mono" style={{ color: stufe.nachhaltigerCashflowChf < 0 ? "var(--bad)" : undefined }}>
                            CHF {formatChf(Math.round(stufe.nachhaltigerCashflowChf))}
                          </td>
                          <td className="num mono">{stufe.cashOnCashPercent.toFixed(2)}%</td>
                          {priceZoneBands ? (
                            <td>{stufenZone ? <Chip tone={priceZoneTone(stufenZone.zone)}>{stufenZone.label}</Chip> : null}</td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {marketValueRange || verhandlungskorridor?.nettoZielChf !== undefined ? (
        <Panel id="preisstrategie" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
          <div className="sectionhead">
            <h2>Preisstrategie — Market Value &amp; Investment Value</h2>
          </div>
          <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".6rem" }}>
            Zwei unterschiedliche Fragen, zwei unterschiedliche Zahlen: der Marktwert zeigt, was vergleichbare
            Objekte in der Gemeinde aktuell kosten — der Investment Value zeigt, welcher Kaufpreis bei der
            stabilisierten Nettomiete (NOI) noch das eigene Nettorenditeziel erreicht. Ein Objekt kann marktgerecht
            angeboten sein und trotzdem über dem für die eigene Renditestrategie gerechtfertigten Preis liegen.
          </p>
          <div className="metricgrid">
            {marketValueRange ? (
              <Metric
                l="Marktwert (Gemeinde)"
                v={`CHF ${formatChf(Math.round(marketValueRange.lowChf))}–${formatChf(Math.round(marketValueRange.highChf))}`}
                sub={
                  <>
                    Median: CHF {formatChf(Math.round(marketValueRange.baseChf))}
                    <br />
                    <Chip tone={marketValueRange.confidence === "HIGH" ? "good" : marketValueRange.confidence === "MEDIUM" ? "warn" : "bad"}>
                      Confidence: {marketValueRange.confidence}
                    </Chip>
                  </>
                }
                hint={`= 30%-/70%-Quantil Kaufpreis/m² (Regionsreport) × Wohnfläche, Median = 50%-Quantil. ${marketValueRange.confidenceReason}`}
              />
            ) : null}
            {verhandlungskorridor?.nettoZielChf !== undefined ? (
              <Metric
                l="Investment Value"
                v={`CHF ${formatChf(Math.round(verhandlungskorridor.nettoZielChf))}`}
                sub={formatRelation(nettoZielRelation)}
                hint="= Kaufpreis, den die stabilisierte Nettomiete (NOI) beim eigenen Nettorenditeziel noch rechtfertigt — identisch mit der „Preisobergrenze (Nettorendite)“ im Verhandlungskorridor oben, hier zusätzlich direkt dem Marktwert gegenübergestellt."
              />
            ) : null}
            <Metric l="Angebotspreis" v={`CHF ${formatChf(Math.round(inseratpreisChf))}`} />
          </div>
          {buildPreisstrategieInterpretation() ? (
            <p style={{ fontSize: ".8125rem", marginTop: ".8rem", marginBottom: 0, fontWeight: 600 }}>{buildPreisstrategieInterpretation()}</p>
          ) : null}
        </Panel>
      ) : null}

      <Panel id="investment-case" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
        <div className="sectionhead">
          <h2>Ebene B — Investment Case</h2>
        </div>
        <div className="metricgrid">
          <Metric l="All-in-Investition" v={`CHF ${formatChf(Math.round(result.allInInvestitionChf))}`} sub="Kaufpreis + Nebenkosten + Renovation + Reparatur + Möblierung" />
          <Metric
            l="Bruttorendite auf Kaufpreis (Sollmiete)"
            v={`${investmentCase.bruttoRenditeKaufpreisPercent.toFixed(2)}%`}
            valueColor={renditeAmpelColor(investmentCase.bruttoRenditeKaufpreisPercent, bruttoRenditeZielPercent)}
            sub={
              alt
                ? `${altLabel}: ${alt.analysis.investmentCase.bruttoRenditeKaufpreisPercent.toFixed(2)}% · Ziel: ${bruttoRenditeZielPercent}%`
                : `Ziel: ${bruttoRenditeZielPercent}%`
            }
            hint="= potenzieller Jahresertrag (Mieten × 12 + sonstige Einnahmen, OHNE Leerstand-/Auslastungsabzug — die Sollmiete) ÷ Kaufpreis × 100. Farbe relativ zum Bruttorendite-Ziel (Annahmen-Reiter). Nicht zu verwechseln mit der effektiv-basierten Bruttorendite im Value-Add-Möblierung-Panel unten (die zieht den Leerstand bereits ab)."
          />
          <Metric
            l="Bruttorendite auf All-in (Sollmiete)"
            v={`${investmentCase.bruttoRenditeAllInPercent.toFixed(2)}%`}
            hint="= potenzieller Jahresertrag (Sollmiete, OHNE Leerstandsabzug) ÷ All-in-Investition × 100."
          />
          <Metric
            l="Nettorendite vor Finanzierung"
            v={`${investmentCase.nettoRenditeVorFinanzierungPercent.toFixed(2)}%`}
            valueColor={renditeAmpelColor(investmentCase.nettoRenditeVorFinanzierungPercent, nettoRenditeZielPercent)}
            sub={`Ziel: ${nettoRenditeZielPercent}%`}
            hint="= NOI (effektiver Jahresertrag − Betriebskosten) ÷ All-in-Investition × 100. Farbe relativ zum Nettorendite-Ziel (Annahmen-Reiter)."
          />
          <Metric
            l="Cash-on-Cash"
            v={result.eigenkapitalChf > 0 ? `${investmentCase.cashOnCashPercent.toFixed(2)}%` : "n/a"}
            sub={
              result.eigenkapitalChf <= 0
                ? "Eigenkapital ≤ 0 (Belehnung insgesamt über 100%?) — nicht berechenbar"
                : alt
                  ? `${altLabel}: ${alt.analysis.investmentCase.cashOnCashPercent.toFixed(2)}%`
                  : undefined
            }
            hint="= nachhaltiger Cashflow Jahr 1 (nach Zins, Amortisation, Steuer, Reparatur-/Leerstandsreserve) ÷ eingesetztes Eigenkapital × 100."
          />
          {cashOnCashBreakdown ? (
            <>
              <Metric
                l="Cash-on-Cash (vor Amortisation)"
                v={`${cashOnCashBreakdown.preAmortizationPercent.toFixed(2)}%`}
                hint="= (NOI − Zins) ÷ eingesetztes Eigenkapital × 100 — vor Amortisation, Steuer und Reparatur-/Leerstandsreserve. Einfachere, weniger konservative Zusatzkennzahl neben dem obigen Cash-on-Cash (der zieht zusätzlich Steuer und Reserven ab)."
              />
              <Metric
                l="Cash-on-Cash (nach Amortisation)"
                v={`${cashOnCashBreakdown.postAmortizationPercent.toFixed(2)}%`}
                hint="= (NOI − Zins − Amortisation) ÷ eingesetztes Eigenkapital × 100 — nach Amortisation, weiterhin vor Steuer und Reparatur-/Leerstandsreserve."
              />
            </>
          ) : null}
          <Metric
            l="Eigenkapital"
            v={`CHF ${formatChf(Math.round(result.eigenkapitalChf))}`}
            sub={`= CHF ${formatChf(Math.round(result.allInInvestitionChf))} (All-in) − CHF ${formatChf(Math.round(hypothekTotalChf))} (Hypothek)`}
            hint="= All-in-Investition − Hypothek (1. + 2., je Kaufpreis × Belehnung-%)."
          />
        </div>

        <div className="sectionhead" style={{ marginTop: "0.8rem" }}>
          <h2 style={{ fontSize: ".85rem" }}>Cashflow-Wasserfall (Jahr 1)</h2>
        </div>
        <table className="stresstable">
          <tbody>
            <tr>
              <td>
                NOI (vor Finanzierung) <InfoHint text="= effektiver Jahresertrag (nach Leerstand/Auslastung) − Betriebskosten." />
              </td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.noiChf))}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ paddingTop: 0, paddingBottom: ".4rem" }}>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: ".78rem", color: "var(--accent)" }}>NOI aufschlüsseln</summary>
                  <table className="stresstable" style={{ marginTop: ".5rem" }}>
                    <tbody>
                      <tr>
                        <td>Potenzieller Jahresertrag</td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.potenziellerJahresertragChf))}</td>
                      </tr>
                      <tr>
                        <td>
                          − Leerstand/Auslastung <InfoHint text="Abzug wegen Leerstandsquote (Langfrist-/mittelfristige Vermietung) bzw. Nicht-Auslastung (Short-Stay)." />
                        </td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.leerstandAbzugChf))}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>= Effektiver Jahresertrag</strong>
                        </td>
                        <td className="num mono">
                          <strong>CHF {formatChf(Math.round(noiBreakdown.effektiverJahresertragChf))}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          − STWEG-Akontobeitrag (nicht überwälzbar){" "}
                          <InfoHint text="Nur der Anteil des STWEG-Akontobeitrags, der NICHT über die Nebenkosten auf den Mieter überwälzbar ist (z.B. Erneuerungsfonds-Einlage, STWEG-Verwaltung) — siehe Bestandsrendite-Fakten, Abschnitt „Betriebskosten“." />
                        </td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.stwegAkontobeitragChfPerYear))}</td>
                      </tr>
                      {noiBreakdown.stwegAkontobeitragUeberwaelzbarChfPerYear > 0 ? (
                        <tr>
                          <td style={{ color: "var(--ink-soft)", fontSize: ".78rem" }}>davon überwälzbar (Nebenkosten, nicht Teil dieser Rechnung)</td>
                          <td className="num mono" style={{ color: "var(--ink-soft)", fontSize: ".78rem" }}>
                            CHF {formatChf(Math.round(noiBreakdown.stwegAkontobeitragUeberwaelzbarChfPerYear))}
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td>− Sonstige Eigentümerkosten</td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.eigentuemerkostenChfPerYear))}</td>
                      </tr>
                      <tr>
                        <td>− Vermietungs-/Inseratskosten</td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.vermietungskostenChfPerYear))}</td>
                      </tr>
                      <tr>
                        <td>− Reinigung/Service</td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.reinigungServiceChfPerYear))}</td>
                      </tr>
                      <tr>
                        <td>
                          − Reparaturkosten (jährlich) <InfoHint text="Jährlich wiederkehrende Reparaturkosten — nicht zu verwechseln mit der Reparaturreserve, die als Sicherheitspuffer erst am Ende des Cashflow-Wasserfalls nach Steuer abgezogen wird." />
                        </td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.reparaturChfPerYear))}</td>
                      </tr>
                      {noiBreakdown.moebliertOpexChfPerYear > 0 ? (
                        <tr>
                          <td>
                            − Möblierte Betriebskosten (granular){" "}
                            <InfoHint text="Internet/Kabel/Streaming/Strom/Abfall, Mieterwechselkosten (Reinigung/Wäsche/Inserat), Verbrauchsmaterial/Kleinreparaturen/Versicherung/Schadenreserve, Verwaltungs-/Plattformgebühr — vollständige Aufschlüsselung im Value-Add-Möblierung-Panel." />
                          </td>
                          <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.moebliertOpexChfPerYear))}</td>
                        </tr>
                      ) : null}
                      <tr>
                        <td>= Betriebskosten total</td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.betriebskostenTotalChf))}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>= NOI (vor Finanzierung)</strong>
                        </td>
                        <td className="num mono">
                          <strong>CHF {formatChf(Math.round(noiBreakdown.noiChf))}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </details>
              </td>
            </tr>
            <tr>
              <td>
                nach Zins <InfoHint text="= NOI − Hypothekarzins (Zinssatz × Hypothekarbetrag)." />
              </td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachZinsChf))}</td>
            </tr>
            <tr>
              <td>
                nach Amortisation <InfoHint text="= Cashflow nach Zins − jährliche Amortisation (1. + 2. Hypothek)." />
              </td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachAmortisationChf))}</td>
            </tr>
            <tr>
              <td>
                nach kalkulatorischer Steuer{" "}
                <InfoHint text="= Cashflow nach Amortisation − (Cashflow nach Zins, mind. 0) × kalkulatorischer Steuersatz. Nur der Hypothekarzins ist steuerlich abzugsfähig, die Amortisation nicht — grobe persönliche Schätzung, kein Steuerberatungsersatz." />
              </td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachSteuerChf))}</td>
            </tr>
            <tr>
              <td>
                <strong>Nachhaltiger Cashflow</strong> (nach eigener Reparatur-/Leerstandsreserve){" "}
                <InfoHint text="= Cashflow nach Steuer − Reparaturreserve − Leerstandsreserve (je fixer CHF-Betrag oder % vom Kaufpreis, wie erfasst)." />
              </td>
              <td className="num mono" style={{ color: investmentCase.wasserfall.nachhaltigerCashflowChf >= 0 ? "var(--good)" : "var(--bad)" }}>
                <strong>CHF {formatChf(Math.round(investmentCase.wasserfall.nachhaltigerCashflowChf))}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="sectionhead" style={{ marginTop: "0.8rem" }}>
          <h2 style={{ fontSize: ".85rem" }}>Break-even</h2>
        </div>
        <div className="metricgrid">
          <Metric
            l="Break-even-Miete"
            v={breakEven.mieteChfPerMonth !== undefined ? `CHF ${formatChf(Math.round(breakEven.mieteChfPerMonth))}/Mt.` : "—"}
            hint="Monatsmiete Wohnung, bei der der nachhaltige Cashflow (Jahr 1) genau 0 erreicht — alle anderen Annahmen bleiben unverändert. Numerisch ermittelt (Bisektion), keine geschlossene Formel."
          />
          <Metric
            l="Break-even-Zins"
            v={breakEven.zinsPercent !== undefined ? `${breakEven.zinsPercent.toFixed(2)}%` : "—"}
            sub={`≈ CHF ${formatChf(Math.round((hypothek.ersteHypothekChf + hypothek.zweiteHypothekChf) * 0.01))}/Jahr je 1 Prozentpunkt Zins`}
            hint="Hypothekarzins, bei dem der nachhaltige Cashflow (Jahr 1) genau 0 erreicht — alle anderen Annahmen bleiben unverändert. Sub-Wert: wie stark sich der Cashflow bei unverändertem NOI durch einen Zinsanstieg/-rückgang um 1 Prozentpunkt auf der aktuellen Hypothekarsumme verändert (linear, unabhängig vom Break-even-Wert selbst)."
          />
          {breakEven.auslastungPercent !== undefined ? (
            <Metric
              l="Break-even-Auslastung"
              v={`${breakEven.auslastungPercent.toFixed(1)}%`}
              hint="Auslastung (nur bei Short-Stay), bei der der nachhaltige Cashflow (Jahr 1) genau 0 erreicht."
            />
          ) : null}
        </div>

        {stressTestRows && stressTestRows.length > 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <div className="sectionhead" style={{ marginTop: "0.8rem" }}>
              <h2 style={{ fontSize: ".85rem" }}>Zins-Stresstest</h2>
            </div>
            <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".5rem" }}>
              Wie sich Cashflow, Cash-on-Cash und Schuldendienstdeckung (DSCR) bei normalisierten Zinssätzen entwickeln —
              alle übrigen Annahmen bleiben unverändert.
            </p>
            {isReturnMateriallyRateDependent(stressTestRows) ? (
              <p style={{ fontSize: ".8125rem", color: "var(--bad)", fontWeight: 600, marginTop: 0, marginBottom: ".6rem" }}>
                Return materially dependent on low financing costs — der nachhaltige Cashflow wird bei normalisierten
                Zinssätzen negativ, obwohl er beim aktuellen Zins positiv ist.
              </p>
            ) : null}
            <div style={{ overflowX: "auto" }}>
              <table className="stresstable">
                <thead>
                  <tr>
                    <th>Zinssatz</th>
                    <th>Zins p.a.</th>
                    <th>Nachhaltiger Cashflow</th>
                    <th>Cash-on-Cash</th>
                    <th>DSCR</th>
                  </tr>
                </thead>
                <tbody>
                  {stressTestRows.map((row) => (
                    <tr key={row.interestRatePercent} style={row.isBaseRate ? { fontWeight: 600 } : undefined}>
                      <td className="num mono">
                        {row.interestRatePercent.toFixed(2)}%{row.isBaseRate ? " (aktuell)" : ""}
                      </td>
                      <td className="num mono">CHF {formatChf(Math.round(row.annualInterestChf))}</td>
                      <td className="num mono" style={{ color: row.nachhaltigerCashflowChf < 0 ? "var(--bad)" : undefined }}>
                        CHF {formatChf(Math.round(row.nachhaltigerCashflowChf))}
                      </td>
                      <td className="num mono">{row.cashOnCashPercent.toFixed(2)}%</td>
                      <td className="num mono">{row.dscr !== undefined ? row.dscr.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Panel>

      {scenarioResults && scenarioResults.length > 0 ? (
        <Panel id="szenarien" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
          <div className="sectionhead">
            <h2>Szenarien — Conservative / Base / Upside</h2>
          </div>
          <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".6rem" }}>
            Drei vollständig durchgerechnete Szenarien mit variierter Miete, Vacancy, Zins und Eigentümerkosten — „Base“
            entspricht exakt den oben gezeigten Ist-Werten, ohne separate Berechnung.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="stresstable">
              <thead>
                <tr>
                  <th>Szenario</th>
                  <th>Bruttorendite</th>
                  <th>Nettorendite</th>
                  <th>Nachhaltiger Cashflow</th>
                  <th>Cash-on-Cash</th>
                </tr>
              </thead>
              <tbody>
                {scenarioResults.map((s) => (
                  <tr key={s.key} style={s.key === "BASE" ? { fontWeight: 600 } : undefined}>
                    <td>{s.label}</td>
                    <td className="num mono" style={{ color: renditeAmpelColor(s.analysis.investmentCase.bruttoRenditeKaufpreisPercent, bruttoRenditeZielPercent) }}>
                      {s.analysis.investmentCase.bruttoRenditeKaufpreisPercent.toFixed(2)}%
                    </td>
                    <td className="num mono" style={{ color: renditeAmpelColor(s.analysis.investmentCase.nettoRenditeVorFinanzierungPercent, nettoRenditeZielPercent) }}>
                      {s.analysis.investmentCase.nettoRenditeVorFinanzierungPercent.toFixed(2)}%
                    </td>
                    <td className="num mono" style={{ color: s.analysis.investmentCase.wasserfall.nachhaltigerCashflowChf < 0 ? "var(--bad)" : undefined }}>
                      CHF {formatChf(Math.round(s.analysis.investmentCase.wasserfall.nachhaltigerCashflowChf))}
                    </td>
                    <td className="num mono">
                      {s.analysis.eigenkapitalChf > 0 ? `${s.analysis.investmentCase.cashOnCashPercent.toFixed(2)}%` : "n/a"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel id="value-add-moeblierung" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
        <div className="sectionhead">
          <h2>Value-Add — Möblierung</h2>
        </div>
        <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".6rem" }}>
          Zwei vollständige Szenarien im Vergleich — Paket 1 (unmöbliert) und Paket 2 (möbliert), siehe Eingabe oben.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="stresstable">
            <thead>
              <tr>
                <th></th>
                <th>Paket 1 — unmöbliert</th>
                <th>Paket 2 — möbliert</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Erwartete Miete</td>
                <td className="num mono">CHF {formatChf(Math.round(moeblierungsVergleich.unmoebliert.mieteChfPerMonth))}/Monat</td>
                <td className="num mono">CHF {formatChf(Math.round(moeblierungsVergleich.moebliert.mieteChfPerMonth))}/Monat</td>
              </tr>
              <tr>
                <td>Kosten (einmalig)</td>
                <td className="num mono">CHF {formatChf(moeblierungsVergleich.unmoebliert.kostenInitialChf)}</td>
                <td className="num mono">CHF {formatChf(Math.round(moeblierungsVergleich.moebliert.kostenInitialChf))}</td>
              </tr>
              <tr>
                <td>
                  Effektiver Jahresertrag <InfoHint text="= (Miete + Parkplatz + sonstige Einnahmen) × 12 nach Leerstand/Auslastung des oben gewählten Vermietungsmodells." />
                </td>
                <td className="num mono">CHF {formatChf(Math.round(moeblierungsVergleich.unmoebliert.effektiverJahresertragChf))}</td>
                <td className="num mono">CHF {formatChf(Math.round(moeblierungsVergleich.moebliert.effektiverJahresertragChf))}</td>
              </tr>
              <tr>
                <td>
                  Bruttorendite (effektiv){" "}
                  <InfoHint text="= effektiver Jahresertrag (nach Leerstand/Auslastung) ÷ Kaufpreis × 100 — anders als die Bruttorendite-Kennzahlen in Schnellcheck/Investment Case oben, die auf der Sollmiete (ohne Leerstandsabzug) basieren, daher nicht direkt vergleichbar." />
                </td>
                <td className="num mono">{moeblierungsVergleich.unmoebliert.bruttoRenditePercent.toFixed(2)}%</td>
                <td className="num mono">{moeblierungsVergleich.moebliert.bruttoRenditePercent.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {furnishingRoi ? (
          <div className="metricgrid" style={{ marginTop: "1rem" }}>
            <Metric
              l="Möblierungsaufschlag CHF/Mt."
              v={`CHF ${formatChf(Math.round(moeblierungsVergleich.moebliert.mieteChfPerMonth - moeblierungsVergleich.unmoebliert.mieteChfPerMonth))}`}
              hint="Mietaufschlag der aktuell gewählten (oder, falls unmöbliert gewählt ist, der Default-Strategie „Möbliert Mittelzeit“) möblierten Dauer-Variante ggü. unmöbliert."
            />
            {furnishedOpexBreakdown ? (
              <Metric
                l="Möbliert-spezifische Kosten CHF/Mt."
                v={`CHF ${formatChf(Math.round(furnishedOpexBreakdown.totalChfPerYear / 12))}`}
                hint="= granularer möblierter Betriebskosten-Block ÷ 12 (Internet/Kabel/Streaming/Strom/Abfall, Mieterwechselkosten, Verbrauchsmaterial/Kleinreparaturen/Versicherung/Schadenreserve, Verwaltungs-/Plattformgebühr)."
              />
            ) : null}
            {incrementalFurnitureNoi ? (
              <>
                <Metric
                  l="Netto-Mehrertrag CHF/Mt."
                  v={`CHF ${formatChf(Math.round(incrementalFurnitureNoi.incrementalNoiChf / 12))}`}
                  valueColor={incrementalFurnitureNoi.incrementalNoiChf <= 0 ? "var(--bad)" : "var(--good)"}
                  hint="= inkrementeller NOI ÷ 12."
                />
                <Metric
                  l="Netto-Mehrertrag CHF/Jahr (inkrementeller NOI)"
                  v={`CHF ${formatChf(Math.round(incrementalFurnitureNoi.incrementalNoiChf))}`}
                  valueColor={incrementalFurnitureNoi.incrementalNoiChf <= 0 ? "var(--bad)" : "var(--good)"}
                  sub={
                    incrementalFurnitureNoi.incrementalNoiChf <= 0
                      ? "Möblierung erhöht den Umsatz, aber nicht den operativen Gewinn."
                      : `= CHF ${formatChf(Math.round(incrementalFurnitureNoi.furnishedNoiChf))} (möbliert) − CHF ${formatChf(Math.round(incrementalFurnitureNoi.unfurnishedNoiChf))} (unmöbliert)`
                  }
                  hint="Beide Seiten NETTO ihrer jeweils eigenen vollständigen Betriebskosten (Paket 1: Reinigung + Reparatur; Paket 2: granularer Kostenblock + Möblierungs-/Inventar-Ersatzreserve) — Guardrail: höherer Umsatz durch Möblierung wird NICHT automatisch als höherer Gewinn interpretiert."
                />
              </>
            ) : null}
            {furnitureValueCreation ? (
              <Metric
                l="Value Creation"
                v={`CHF ${formatChf(Math.round(furnitureValueCreation.impliedValueIncreaseChf))}`}
                hint="= inkrementeller NOI ÷ Nettorendite-Ziel (Annahmen-Reiter) — theoretischer Immobilienwert-Zuwachs durch die Möblierung, direkt vergleichbar mit dem CHF-Verhandlungsspielraum im Verhandlungskorridor."
              />
            ) : null}
            <Metric
              l="Rendite auf Möblierungsinvestition (Furniture ROI)"
              v={`${furnishingRoi.roiPercent.toFixed(1)}%`}
              hint="= inkrementeller NOI ÷ (Möbel- + Haushaltsinventar-Initialkosten) × 100 — NETTO-basiert, nicht der rohe Mietaufschlag."
            />
            <Metric
              l="Payback-Dauer Möblierung"
              v={furnishingRoi.paybackYears !== undefined ? `${furnishingRoi.paybackYears.toFixed(1)} Jahre` : "—"}
              hint="= (Möbel- + Haushaltsinventar-Initialkosten) ÷ inkrementeller NOI; ohne Wert, wenn kein positiver Mehrertrag entsteht (Payback wäre unendlich)."
            />
            {furnishedRentalDelta ? (
              <>
                <Metric
                  l="Break-even-Möblierungszuschlag"
                  v={`CHF ${formatChf(Math.round(furnishedRentalDelta.breakEvenFurnishingPremiumChfPerMonth))}/Mt.`}
                  hint="Mindest-Mietaufschlag, der nötig ist, um die möblierungsbedingten Mehrkosten (granularer Kostenblock + Mehr-Leerstand ggü. unmöbliert) zu decken — noch OHNE Rendite auf die Möblierungsinvestition."
                />
                <Metric
                  l="Minimum wirtschaftlich sinnvoller Zuschlag"
                  v={`CHF ${formatChf(Math.round(furnishedRentalDelta.minimumEconomicFurnishingPremiumChfPerYear / 12))}/Mt.`}
                  hint="Break-even-Zuschlag zzgl. der geforderten Mindestrendite auf die Möblierungsinvestition (siehe „Mindestrendite Möblierungsinvestition“, Annahmen-Reiter)."
                />
                {furnishedRentalDelta.furnishingEfficiencyRatio !== undefined ? (
                  <Metric
                    l="Furnishing Efficiency Ratio"
                    v={`${(furnishedRentalDelta.furnishingEfficiencyRatio * 100).toFixed(0)}%`}
                    hint="= inkrementeller NOI ÷ zusätzlicher Bruttomietertrag — wie viel vom zusätzlichen Bruttoertrag tatsächlich als Mehrgewinn ankommt (100% = keine möblierungsspezifischen Zusatzkosten, <0% = Möblierung senkt den Gewinn trotz höherer Bruttomiete)."
                  />
                ) : null}
              </>
            ) : null}
            {moeblierungReserveChfPerJahr !== undefined ? (
              <Metric
                l="Geglättete Ersatzreserve (Möbel + Inventar)"
                v={`CHF ${formatChf(Math.round(moeblierungReserveChfPerJahr))} p.a.`}
                hint="Rein informativ — die 15-Jahres-Cashflows rechnen mit dem tatsächlichen Ersatz-Cashout im jeweiligen Ersatzjahr, nicht mit dieser geglätteten Reserve."
              />
            ) : null}
          </div>
        ) : null}
      </Panel>

      {vermietungsstrategienVergleich ? (
        <Panel id="vermietungsstrategie-vergleich" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
          <div className="sectionhead">
            <h2>Vermietungsstrategie-Vergleich</h2>
          </div>
          <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".6rem" }}>
            Alle vier Vermietungsmodelle im direkten Vergleich (SIPIS Furnished-Rental-Modul v1.1) — Investment
            Value = stabilisierter NOI ÷ Nettorendite-Ziel. Höchste Bruttomiete ist NICHT automatisch die beste
            Strategie: die Empfehlung stützt sich auf den NOI (bereits netto aller möblierungsspezifischen
            Zusatzkosten), nicht auf den Umsatz.
          </p>
          {vermietungsstrategienVergleich.empfehlung ? (
            <p style={{ fontSize: ".84rem", marginBottom: ".8rem" }}>
              <strong>Empfohlene Strategie: {vermietungsstrategienVergleich.strategien.find((s) => s.modell === vermietungsstrategienVergleich.empfehlung!.modell)?.label}.</strong>{" "}
              {vermietungsstrategienVergleich.empfehlung.begruendung}
            </p>
          ) : (
            <p style={{ fontSize: ".84rem", color: "var(--warn)", marginBottom: ".8rem" }}>
              Keine automatische Empfehlung möglich — für keine möblierte Variante ist ein Mietaufschlag erfasst
              (nichts wird erfunden).
            </p>
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="stresstable">
              <thead>
                <tr>
                  <th>Modell</th>
                  <th>Stabilisierter NOI</th>
                  <th>Nettorendite</th>
                  <th>Cash-on-Cash</th>
                  <th>Investment Value</th>
                  <th>Value Creation</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {vermietungsstrategienVergleich.strategien.map((s) => (
                  <tr key={s.modell} style={s.modell === vermietungsstrategienVergleich.empfehlung?.modell ? { fontWeight: 600 } : undefined}>
                    <td>{s.label}</td>
                    <td className="num mono">CHF {formatChf(Math.round(s.stabilisierterNoiChf))}</td>
                    <td className="num mono" style={{ color: renditeAmpelColor(s.nettoRenditeVorFinanzierungPercent, nettoRenditeZielPercent) }}>
                      {s.nettoRenditeVorFinanzierungPercent.toFixed(2)}%
                    </td>
                    <td className="num mono">{s.cashOnCashPercent.toFixed(2)}%</td>
                    <td className="num mono">CHF {formatChf(Math.round(s.investmentValueChf))}</td>
                    <td className="num mono" style={{ color: s.valueCreationChf > 0 ? "var(--good)" : s.valueCreationChf < 0 ? "var(--bad)" : undefined }}>
                      {s.modell === "LANGFRISTIG_UNMOEBLIERT" ? "—" : `CHF ${formatChf(Math.round(s.valueCreationChf))}`}
                    </td>
                    <td>
                      <Chip tone={s.confidence === "HIGH" ? "good" : s.confidence === "MEDIUM" ? "warn" : "bad"}>{s.confidence}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {renovationRoi || renovationSummary.totalChf > 0 ? (
        <Panel style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
          <div className="sectionhead">
            <h2>Value-Add — Renovation</h2>
          </div>
          {renovationSummary.totalChf > 0 ? (
            <div className="metricgrid" style={{ marginBottom: renovationRoi ? "1rem" : 0 }}>
              <Metric
                l="Werterhaltend"
                v={`CHF ${formatChf(Math.round(renovationSummary.totalByKategorie.WERTERHALTEND))}`}
                hint="Summe aller erfassten Renovationspositionen der Kategorie „Werterhaltend“ — fliesst NICHT in den angenommenen Immobilienwert beim Exit ein (anders als „Wertvermehrend“)."
              />
              <Metric
                l="Wertvermehrend"
                v={`CHF ${formatChf(Math.round(renovationSummary.totalByKategorie.WERTVERMEHREND))}`}
                hint="Erhöht den angenommenen Immobilienwert im 15-Jahres-Modell beim Exit — die beiden anderen Kategorien nicht."
              />
              <Metric
                l="Energetisch"
                v={`CHF ${formatChf(Math.round(renovationSummary.totalByKategorie.ENERGETISCH))}`}
                hint="Summe aller erfassten Renovationspositionen der Kategorie „Energetisch“ — fliesst NICHT in den angenommenen Immobilienwert beim Exit ein (anders als „Wertvermehrend“)."
              />
            </div>
          ) : null}
          {renovationRoi ? (
            <div className="metricgrid">
              <Metric
                l="Zusätzlicher Jahresertrag"
                v={`CHF ${formatChf(Math.round(renovationRoi.zusaetzlicherJahresertragChf))}`}
                hint="= (Miete nach Renovation − Miete vor Renovation) × 12."
              />
              <Metric l="Renovation ROI" v={`${renovationRoi.roiPercent.toFixed(1)}%`} hint="= zusätzlicher Jahresertrag ÷ Renovationskosten × 100." />
              {renovationValueCreation ? (
                <Metric
                  l="Value Creation"
                  v={`CHF ${formatChf(Math.round(renovationValueCreation.impliedValueIncreaseChf))}`}
                  hint="= zusätzlicher Jahresertrag ÷ Nettorendite-Ziel (Annahmen-Reiter) — theoretischer Immobilienwert-Zuwachs durch die Renovation, direkt vergleichbar mit dem CHF-Verhandlungsspielraum im Verhandlungskorridor."
                />
              ) : null}
              <Metric
                l="Payback"
                v={renovationRoi.paybackYears !== undefined ? `${renovationRoi.paybackYears.toFixed(1)} Jahre` : "—"}
                hint="= Renovationskosten ÷ zusätzlicher Jahresertrag; ohne Wert, wenn kein Mehrertrag entsteht (Payback wäre unendlich)."
              />
            </div>
          ) : null}
        </Panel>
      ) : null}

      <Panel id="mehrjahresmodell" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
        <div className="sectionhead">
          <h2>
            Ebene C — {mehrjahresmodell.years.length}-Jahres-Modell <InfoHint text="Default 15 Jahre, 5–30 wählbar über die Bestandsrendite-Fakten." />
          </h2>
        </div>
        <div className="metricgrid">
          <Metric
            l="Levered IRR"
            v={mehrjahresmodell.leveredIrrPercent !== undefined ? `${mehrjahresmodell.leveredIrrPercent.toFixed(1)}%` : "—"}
            sub={
              alt && alt.analysis.mehrjahresmodell.leveredIrrPercent !== undefined ? `${altLabel}: ${alt.analysis.mehrjahresmodell.leveredIrrPercent.toFixed(1)}%` : undefined
            }
            hint="Interner Zinsfuss auf die Eigenkapital-Cashflows: −Eigenkapital in Jahr 0, jährlicher nachhaltiger Cashflow, plus Exit-Erlös im letzten Jahr. Numerisch ermittelt, keine geschlossene Formel."
          />
          <Metric
            l="Unlevered IRR"
            v={mehrjahresmodell.unleveredIrrPercent !== undefined ? `${mehrjahresmodell.unleveredIrrPercent.toFixed(1)}%` : "—"}
            hint="Interner Zinsfuss, als wäre die gesamte All-in-Investition ohne Fremdkapital finanziert (Cashflows = NOI, Exit ohne Restschuldabzug) — zum Vergleich, wie viel des Levered IRR aus dem Finanzierungshebel stammt."
          />
          <Metric
            l="Equity Multiple"
            v={`${mehrjahresmodell.equityMultiple.toFixed(2)}×`}
            sub={alt ? `${altLabel}: ${alt.analysis.mehrjahresmodell.equityMultiple.toFixed(2)}×` : undefined}
            hint="= (Summe aller jährlichen nachhaltigen Cashflows + Exit-Erlös) ÷ eingesetztes Eigenkapital."
          />
          <Metric
            l="Exit-Erlös (netto)"
            v={`CHF ${formatChf(Math.round(mehrjahresmodell.exit.netProceedsChf))}`}
            hint="= angenommener Verkaufswert − Restschuld Hypothek − Verkaufskosten − Grundstückgewinnsteuer (falls erfasst). Details in der Tabelle unten."
          />
          <Metric
            l="Angenommener Verkaufswert"
            v={`CHF ${formatChf(Math.round(mehrjahresmodell.exit.assumedPropertyValueChf))}`}
            hint="= (Kaufpreis + wertvermehrende Renovation) × (1 + Wertsteigerung-%/Jahr) hoch Haltedauer in Jahren."
          />
          <Metric
            l="Kumulierter Cashflow"
            v={`CHF ${formatChf(Math.round(lastYear.kumulierterCashflowChf))}`}
            hint="Summe der nachhaltigen Cashflows aller Jahre bis zum Exit-Jahr (ohne Exit-Erlös)."
          />
        </div>

        <div className="sectionhead" style={{ marginTop: "0.8rem" }}>
          <h2 style={{ fontSize: ".85rem" }}>Exit-Berechnung (Jahr {mehrjahresmodell.years.length})</h2>
        </div>
        <table className="stresstable">
          <tbody>
            <tr>
              <td>Angenommener Verkaufswert</td>
              <td className="num mono">CHF {formatChf(Math.round(mehrjahresmodell.exit.assumedPropertyValueChf))}</td>
            </tr>
            <tr>
              <td>− Restschuld Hypothek</td>
              <td className="num mono">CHF {formatChf(Math.round(mehrjahresmodell.exit.remainingLoanChf))}</td>
            </tr>
            <tr>
              <td>− Verkaufskosten</td>
              <td className="num mono">CHF {formatChf(Math.round(mehrjahresmodell.exit.sellingCostsChf))}</td>
            </tr>
            {mehrjahresmodell.exit.grundstueckgewinnsteuerChf !== undefined ? (
              <tr>
                <td>
                  − Grundstückgewinnsteuer <InfoHint text="Grobe Näherung ohne Besitzdauerabzug oder sonstige kantonale Details, kein Steuerberatungsersatz." />
                </td>
                <td className="num mono">CHF {formatChf(Math.round(mehrjahresmodell.exit.grundstueckgewinnsteuerChf))}</td>
              </tr>
            ) : null}
            <tr>
              <td>
                <strong>= Exit-Erlös (netto)</strong>
              </td>
              <td className="num mono">
                <strong>CHF {formatChf(Math.round(mehrjahresmodell.exit.netProceedsChf))}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <details style={{ marginTop: "0.8rem" }}>
          <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--accent)" }}>Jahr-für-Jahr-Details anzeigen</summary>
          <div style={{ overflowX: "auto", marginTop: ".6rem" }}>
            <table className="stresstable">
              <thead>
                <tr>
                  <th>Jahr</th>
                  <th className="num">Jahresertrag (CHF)</th>
                  <th className="num">NOI (CHF)</th>
                  <th className="num">Nachh. Cashflow (CHF)</th>
                  <th className="num">Kumuliert (CHF)</th>
                  <th className="num">Immobilienwert (CHF)</th>
                  <th className="num">Restschuld (CHF)</th>
                  <th className="num">Belehnung</th>
                </tr>
              </thead>
              <tbody>
                {mehrjahresmodell.years.map((y) => (
                  <tr key={y.jahr}>
                    <td>
                      {y.jahr}
                      {y.moeblierungsErsatzChf > 0 ? <InfoHint text={`Enthält Möblierungsersatz von CHF ${formatChf(Math.round(y.moeblierungsErsatzChf))} in diesem Jahr.`} /> : null}
                    </td>
                    <td className="num mono">{formatChf(Math.round(y.effektiverJahresertragChf))}</td>
                    <td className="num mono">{formatChf(Math.round(y.noiChf))}</td>
                    <td className="num mono" style={{ color: y.nachhaltigerCashflowChf >= 0 ? "var(--good)" : "var(--bad)" }}>
                      {formatChf(Math.round(y.nachhaltigerCashflowChf))}
                    </td>
                    <td className="num mono">{formatChf(Math.round(y.kumulierterCashflowChf))}</td>
                    <td className="num mono">{formatChf(Math.round(y.immobilienwertChf))}</td>
                    <td className="num mono">{formatChf(Math.round(y.restschuldChf))}</td>
                    <td className="num mono">{y.belehnungPercent.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <div className="sectionhead" style={{ marginTop: "0.8rem" }}>
          <h2 style={{ fontSize: ".85rem" }}>Investment-Treiber — Wo entsteht die Rendite?</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {investmentTreiber.treiber.map((t) => (
            <div key={t.label} style={{ display: "flex", alignItems: "baseline", gap: ".7rem", flexWrap: "wrap" }}>
              <Chip tone={t.staerke === "+++" ? "good" : t.staerke === "++" ? "accent" : "neutral"}>{t.staerke}</Chip>
              <strong style={{ fontSize: ".8125rem" }}>{t.label}</strong>
              <span style={{ color: "var(--ink-faint)", fontSize: ".78rem" }}>{t.irrBeitragPercentPoints >= 0 ? "+" : ""}{t.irrBeitragPercentPoints.toFixed(1)} Pp. IRR</span>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--ink-faint)", fontSize: ".72rem", marginTop: ".8rem" }}>
          Mechanische Zerlegung per Vergleichsläufen, keine wissenschaftliche Attribution.
        </p>
      </Panel>

      {Object.values(stweg).some((v) => v !== undefined) ? (
        <Panel style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
          <div className="sectionhead">
            <h2>
              STWEG-Fakten <InfoHint text="Reine Datenhaltung ohne Bewertung — was als „gut“/„riskant“ gilt, ist noch nicht festgelegt." />
            </h2>
          </div>
          <div className="metricgrid">
            {stweg.wertquotePromille !== undefined ? <Metric l="Wertquote" v={`${stweg.wertquotePromille}‰`} /> : null}
            {stweg.erneuerungsfondsSaldoChf !== undefined ? <Metric l="Erneuerungsfonds-Saldo" v={`CHF ${formatChf(stweg.erneuerungsfondsSaldoChf)}`} /> : null}
            {stweg.erneuerungsfondsZielwertChf !== undefined ? <Metric l="Erneuerungsfonds-Zielwert" v={`CHF ${formatChf(stweg.erneuerungsfondsZielwertChf)}`} /> : null}
            {stweg.naechsteGrossaSanierungGeplant !== undefined ? (
              <Metric l="Grössere Sanierung geplant/diskutiert" v={stweg.naechsteGrossaSanierungGeplant ? "Ja" : "Nein"} />
            ) : null}
            {stweg.offeneBeschluesseCount !== undefined ? <Metric l="Offene/strittige Beschlüsse" v={String(stweg.offeneBeschluesseCount)} /> : null}
          </div>
          {stweg.naechsteGrossaSanierungNotes ? (
            <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: ".8rem" }}>
              <strong>Notizen Sanierung:</strong> {stweg.naechsteGrossaSanierungNotes}
            </p>
          ) : null}
          {stweg.sanierungsstauNotes ? (
            <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: ".5rem" }}>
              <strong>Sanierungsstau:</strong> {stweg.sanierungsstauNotes}
            </p>
          ) : null}
          {stweg.beschlussrisikenNotes ? (
            <p style={{ fontSize: ".8125rem", color: "var(--ink-soft)", marginTop: ".5rem" }}>
              <strong>Beschlussrisiken:</strong> {stweg.beschlussrisikenNotes}
            </p>
          ) : null}
          {stweg.quelle ? (
            <p style={{ fontSize: ".76rem", color: "var(--ink-faint)", marginTop: ".8rem", fontStyle: "italic" }}>Quelle: {stweg.quelle}</p>
          ) : null}
        </Panel>
      ) : null}

      <Panel style={{ padding: "0.8rem 1.1rem", marginTop: "1rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".4rem" }}>
          Verwendete Annahmen
        </div>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: ".8125rem", color: "var(--ink-soft)", display: "flex", flexDirection: "column", gap: ".3rem" }}>
          {result.assumptionNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
