import { Panel, Chip, InfoHint } from "@landfinder/ui";
import { Metric } from "@/components/MetricPrimitives";
import { formatChf } from "@/lib/format";
import { renditeAmpelColor } from "@/lib/investmentScore";
import type { BestandsrenditeAnalysisResult, Verhandlungskorridor, MoeblierungsAlternative } from "@/lib/bestandsrendite";

/**
 * Reine Anzeige der drei Ebenen — die Berechnung selbst
 * (`computeBestandsrenditeAnalysis`) ist eine reine Funktion ohne externe
 * Abhängigkeit, läuft deshalb serverseitig in der Detailseite, kein
 * Client-Live-Recompute nötig.
 */
export function BestandsrenditeAnalysisView({
  result,
  verhandlungskorridor,
  moeblierungsAlternative,
  bruttoRenditeZielPercent,
  nettoRenditeZielPercent,
}: {
  result: BestandsrenditeAnalysisResult;
  /** `undefined`/`null`, wenn `computeVerhandlungskorridor` keine Bisektionslösung fand (Objekt trägt sich unter keinen Umständen). */
  verhandlungskorridor?: Verhandlungskorridor | null;
  /**
   * Für die "Schattenrechnung" (Rückmeldung: "wo dieser Vergleich überall durchschlägt")
   * — das jeweils andere Szenario (möbliert/unmöbliert), komplett durchgerechnet.
   * `null`, wenn kein Alternativszenario existiert (SHORT_STAY oder keine Möblierungsdaten
   * erfasst), siehe `computeMoeblierungsAlternative`.
   */
  moeblierungsAlternative?: MoeblierungsAlternative | null;
  /**
   * Referenzwerte aus dem "Annahmen"-Reiter (`BESTANDSRENDITE_PARAMETERS.bruttoRenditeZielPercent`/
   * `nettoRenditeZielPercent`) — Rückmeldung: "die ampel [...] überall dort [einbauen], wo werte
   * und/oder informationen vom soll abweichen". Färbt die Rendite-Kennzahlen unten grün/gelb/rot
   * relativ zum Ziel (siehe `renditeAmpelColor`), rein informativ, ohne die Werte selbst zu ändern.
   */
  bruttoRenditeZielPercent: number;
  nettoRenditeZielPercent: number;
}) {
  const {
    schnellcheck,
    investmentCase,
    noiBreakdown,
    parkierung,
    mehrjahresmodell,
    investmentTreiber,
    furnitureRoi,
    moeblierungReserveChfPerJahr,
    moeblierungsVergleich,
    renovationRoi,
    renovationSummary,
    breakEven,
    stweg,
    hypothek,
  } = result;
  const lastYear = mehrjahresmodell.years[mehrjahresmodell.years.length - 1];
  const alt = moeblierungsAlternative;
  const altLabel = alt ? `Alternative (${alt.label})` : "";

  // Nur die Parkierungsarten nennen, die tatsächlich zusätzlich zum Basis-Kaufpreis
  // dazugerechnet wurden (nicht die, die bereits im Basis-Kaufpreis enthalten sind).
  const parkierungTeile = [
    parkierung.parkplatzZusatzChf > 0 ? `Parkplatz CHF ${formatChf(parkierung.parkplatzZusatzChf)}` : null,
    parkierung.garagenplatzZusatzChf > 0 ? `Garage CHF ${formatChf(parkierung.garagenplatzZusatzChf)}` : null,
  ].filter((t): t is string => t !== null);
  const parkierungSub = parkierungTeile.length > 0 ? `davon zusätzlich: ${parkierungTeile.join(", ")}` : undefined;

  // Für die Herleitungs-Sub-Texte unter Eigenkapitalbedarf/Eigenkapital unten — beide
  // Grössen stecken bereits fertig verrechnet im Ergebnis, hier nur zur Anzeige wieder in
  // ihre Bestandteile zerlegt (Rückmeldung: "in kleiner Schrift ergänzend [...] herleiten,
  // was alles inkl. ist im Total").
  const hypothekTotalChf = hypothek.ersteHypothekChf + hypothek.zweiteHypothekChf;
  const kaufnebenkostenChf = schnellcheck.eigenkapitalbedarfChf - schnellcheck.kaufpreisChf + hypothekTotalChf;

  return (
    <>
      <Panel id="schnellcheck" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
        <div className="sectionhead">
          <h2>Ebene A — Schnellcheck</h2>
        </div>
        <div className="metricgrid">
          <Metric
            l="Kaufpreis (Wohnung + Parkplatz/Garage)"
            v={`CHF ${formatChf(schnellcheck.kaufpreisChf)}`}
            sub={parkierungSub}
            hint="= Basis-Kaufpreis (Objekt-Basisdaten) + separater Parkplatz-/Garagenkaufpreis (0, falls dieser bereits im Basis-Kaufpreis enthalten ist)."
          />
          <Metric l="Preis/m²" v={`CHF ${formatChf(Math.round(schnellcheck.preisProM2Chf))}`} hint="= Kaufpreis ÷ Wohnfläche (m²)." />
          <Metric l="Jahresnettomiete" v={`CHF ${formatChf(schnellcheck.jahresnettomieteChf)}`} hint="= (Nettomiete Wohnung + Miete Parkplatz) × 12." />
          <Metric
            l="Bruttorendite (Kaufpreis)"
            v={`${schnellcheck.bruttoRenditePercent.toFixed(2)}%`}
            valueColor={renditeAmpelColor(schnellcheck.bruttoRenditePercent, bruttoRenditeZielPercent)}
            sub={alt ? `${altLabel}: ${alt.analysis.schnellcheck.bruttoRenditePercent.toFixed(2)}% · Ziel: ${bruttoRenditeZielPercent}%` : `Ziel: ${bruttoRenditeZielPercent}%`}
            hint="= Jahresnettomiete ÷ Kaufpreis × 100. Farbe relativ zum Bruttorendite-Ziel (Annahmen-Reiter)."
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
            Maximum ist der Kaufpreis, bei dem der nachhaltige Cashflow gerade CHF 0 erreicht. Zielpreis ist der
            Kaufpreis, bei dem die Bruttorendite das gespeicherte Renditeziel erreicht (Annahmen-Reiter). Eröffnungsangebot
            ist deine eigene, per Marktrecherche bestimmte Einschätzung (Bestandsrendite-Fakten, Abschnitt
            &quot;Verhandlung&quot;) — kein Rechenwert.
          </p>
          <div className="metricgrid">
            <Metric
              l="Eröffnungsangebot"
              v={verhandlungskorridor.eroeffnungChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.eroeffnungChf))}` : "—"}
              sub={verhandlungskorridor.eroeffnungChf === undefined ? "eigene Markteinschätzung noch nicht erfasst" : undefined}
              hint="Eigene Markteinschätzung, siehe Bestandsrendite-Fakten, Abschnitt „Verhandlung“ — kein Rechenwert."
            />
            <Metric
              l="Zielpreis"
              v={verhandlungskorridor.zielChf !== undefined ? `CHF ${formatChf(Math.round(verhandlungskorridor.zielChf))}` : "—"}
              sub={verhandlungskorridor.zielChf === undefined ? "kein Renditeziel gesetzt (Annahmen-Reiter)" : undefined}
              hint="= Kaufpreis, bei dem die Bruttorendite (Kaufpreis) das Renditeziel erreicht (Annahmen-Reiter), gedeckelt auf das Maximum."
            />
            <Metric
              l="Maximum"
              v={`CHF ${formatChf(Math.round(verhandlungskorridor.maximumChf))}`}
              sub={alt?.verhandlungskorridor.maximumChf !== undefined ? `${altLabel}: CHF ${formatChf(Math.round(alt.verhandlungskorridor.maximumChf))}` : undefined}
              hint="Kaufpreis, bei dem der nachhaltige Cashflow (nach Zins, Amortisation, Steuer, Reparatur-/Leerstandsreserve) gerade CHF 0 erreicht — mehr zu zahlen ist unter den aktuellen Annahmen rechnerisch nicht mehr cashflow-tragfähig."
            />
          </div>
        </Panel>
      ) : null}

      <Panel id="investment-case" className="anchor-target" style={{ padding: "0.9rem 1.1rem", marginTop: "1rem" }}>
        <div className="sectionhead">
          <h2>Ebene B — Investment Case</h2>
        </div>
        <div className="metricgrid">
          <Metric l="All-in-Investition" v={`CHF ${formatChf(Math.round(result.allInInvestitionChf))}`} sub="Kaufpreis + Nebenkosten + Renovation + Möblierung" />
          <Metric
            l="Bruttorendite auf Kaufpreis"
            v={`${investmentCase.bruttoRenditeKaufpreisPercent.toFixed(2)}%`}
            valueColor={renditeAmpelColor(investmentCase.bruttoRenditeKaufpreisPercent, bruttoRenditeZielPercent)}
            sub={
              alt
                ? `${altLabel}: ${alt.analysis.investmentCase.bruttoRenditeKaufpreisPercent.toFixed(2)}% · Ziel: ${bruttoRenditeZielPercent}%`
                : `Ziel: ${bruttoRenditeZielPercent}%`
            }
            hint="= potenzieller Jahresertrag (Mieten × 12 + sonstige Einnahmen, OHNE Leerstand-/Auslastungsabzug) ÷ Kaufpreis × 100. Farbe relativ zum Bruttorendite-Ziel (Annahmen-Reiter)."
          />
          <Metric
            l="Bruttorendite auf All-in"
            v={`${investmentCase.bruttoRenditeAllInPercent.toFixed(2)}%`}
            hint="= potenzieller Jahresertrag ÷ All-in-Investition × 100."
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
            v={`${investmentCase.cashOnCashPercent.toFixed(2)}%`}
            sub={alt ? `${altLabel}: ${alt.analysis.investmentCase.cashOnCashPercent.toFixed(2)}%` : undefined}
            hint="= nachhaltiger Cashflow Jahr 1 (nach Zins, Amortisation, Steuer, Reparatur-/Leerstandsreserve) ÷ eingesetztes Eigenkapital × 100."
          />
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
                        <td>− STWEG-Akontobeitrag</td>
                        <td className="num mono">CHF {formatChf(Math.round(noiBreakdown.stwegAkontobeitragChfPerYear))}</td>
                      </tr>
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
            v={breakEven.mieteChfPerMonth !== undefined ? `CHF ${formatChf(Math.round(breakEven.mieteChfPerMonth))}/Monat` : "—"}
            hint="Monatsmiete Wohnung, bei der der nachhaltige Cashflow (Jahr 1) genau 0 erreicht — alle anderen Annahmen bleiben unverändert. Numerisch ermittelt (Bisektion), keine geschlossene Formel."
          />
          <Metric
            l="Break-even-Zins"
            v={breakEven.zinsPercent !== undefined ? `${breakEven.zinsPercent.toFixed(2)}%` : "—"}
            hint="Hypothekarzins, bei dem der nachhaltige Cashflow (Jahr 1) genau 0 erreicht — alle anderen Annahmen bleiben unverändert."
          />
          {breakEven.auslastungPercent !== undefined ? (
            <Metric
              l="Break-even-Auslastung"
              v={`${breakEven.auslastungPercent.toFixed(1)}%`}
              hint="Auslastung (nur bei Short-Stay), bei der der nachhaltige Cashflow (Jahr 1) genau 0 erreicht."
            />
          ) : null}
        </div>
      </Panel>

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
                  Bruttorendite <InfoHint text="= effektiver Jahresertrag ÷ Kaufpreis × 100." />
                </td>
                <td className="num mono">{moeblierungsVergleich.unmoebliert.bruttoRenditePercent.toFixed(2)}%</td>
                <td className="num mono">{moeblierungsVergleich.moebliert.bruttoRenditePercent.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {furnitureRoi ? (
          <div className="metricgrid" style={{ marginTop: "1rem" }}>
            <Metric
              l="Zusätzlicher Jahresertrag"
              v={`CHF ${formatChf(Math.round(furnitureRoi.zusaetzlicherJahresertragChf))}`}
              hint="= Mietaufschlag möbliert ggü. unmöbliert (CHF/Monat) × 12."
            />
            <Metric l="Furniture ROI" v={`${furnitureRoi.roiPercent.toFixed(1)}%`} hint="= zusätzlicher Jahresertrag ÷ Möblierungsinvestition × 100." />
            <Metric
              l="Payback"
              v={furnitureRoi.paybackYears !== undefined ? `${furnitureRoi.paybackYears.toFixed(1)} Jahre` : "—"}
              hint="= Möblierungsinvestition ÷ zusätzlicher Jahresertrag; ohne Wert, wenn kein Mehrertrag entsteht (Payback wäre unendlich)."
            />
            {moeblierungReserveChfPerJahr !== undefined ? (
              <Metric
                l="Geglättete Ersatzreserve"
                v={`CHF ${formatChf(Math.round(moeblierungReserveChfPerJahr))} p.a.`}
                hint="Rein informativ — die 15-Jahres-Cashflows rechnen mit dem tatsächlichen Ersatz-Cashout im Ersatzjahr, nicht mit dieser geglätteten Reserve."
              />
            ) : null}
          </div>
        ) : null}
      </Panel>

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
