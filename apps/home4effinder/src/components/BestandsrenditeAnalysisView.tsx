import { Panel, Chip, InfoHint } from "@landfinder/ui";
import { Metric } from "@/components/MetricPrimitives";
import { formatChf } from "@/lib/format";
import type { BestandsrenditeAnalysisResult } from "@/lib/bestandsrendite";

/**
 * Reine Anzeige der drei Ebenen — die Berechnung selbst
 * (`computeBestandsrenditeAnalysis`) ist eine reine Funktion ohne externe
 * Abhängigkeit, läuft deshalb serverseitig in der Detailseite, kein
 * Client-Live-Recompute nötig.
 */
export function BestandsrenditeAnalysisView({ result }: { result: BestandsrenditeAnalysisResult }) {
  const { schnellcheck, investmentCase, mehrjahresmodell, investmentTreiber, furnitureRoi, moeblierungReserveChfPerJahr, renovationRoi, breakEven, stweg } = result;
  const lastYear = mehrjahresmodell.years[mehrjahresmodell.years.length - 1];

  return (
    <>
      <Panel style={{ padding: "1.2rem 1.3rem", marginTop: "1.4rem" }}>
        <div className="sectionhead">
          <h2>Ebene A — Schnellcheck</h2>
        </div>
        <div className="metricgrid">
          <Metric l="Kaufpreis (Wohnung + Parkplatz)" v={`CHF ${formatChf(schnellcheck.kaufpreisChf)}`} />
          <Metric l="Preis/m²" v={`CHF ${formatChf(Math.round(schnellcheck.preisProM2Chf))}`} />
          <Metric l="Jahresnettomiete" v={`CHF ${formatChf(schnellcheck.jahresnettomieteChf)}`} />
          <Metric l="Bruttorendite (Kaufpreis)" v={`${schnellcheck.bruttoRenditePercent.toFixed(2)}%`} />
          <Metric l="Eigenkapitalbedarf" v={`CHF ${formatChf(Math.round(schnellcheck.eigenkapitalbedarfChf))}`} sub="inkl. Kaufnebenkosten" />
          <Metric l="Belehnung" v={`${schnellcheck.belehnungPercent}%`} />
          <Metric
            l="Grober Cashflow"
            v={`CHF ${formatChf(Math.round(schnellcheck.groberCashflowChf))}`}
            valueColor={schnellcheck.groberCashflowChf >= 0 ? "var(--good)" : "var(--bad)"}
          />
        </div>
      </Panel>

      <Panel style={{ padding: "1.2rem 1.3rem", marginTop: "1.4rem" }}>
        <div className="sectionhead">
          <h2>Ebene B — Investment Case</h2>
        </div>
        <div className="metricgrid">
          <Metric l="All-in-Investition" v={`CHF ${formatChf(Math.round(result.allInInvestitionChf))}`} sub="Kaufpreis + Nebenkosten + Renovation + Möblierung" />
          <Metric l="Bruttorendite auf Kaufpreis" v={`${investmentCase.bruttoRenditeKaufpreisPercent.toFixed(2)}%`} />
          <Metric l="Bruttorendite auf All-in" v={`${investmentCase.bruttoRenditeAllInPercent.toFixed(2)}%`} />
          <Metric l="Nettorendite vor Finanzierung" v={`${investmentCase.nettoRenditeVorFinanzierungPercent.toFixed(2)}%`} />
          <Metric l="Cash-on-Cash" v={`${investmentCase.cashOnCashPercent.toFixed(2)}%`} />
          <Metric l="Eigenkapital" v={`CHF ${formatChf(Math.round(result.eigenkapitalChf))}`} />
        </div>

        <div className="sectionhead" style={{ marginTop: "1.2rem" }}>
          <h2 style={{ fontSize: ".85rem" }}>Cashflow-Wasserfall (Jahr 1)</h2>
        </div>
        <table className="stresstable">
          <tbody>
            <tr>
              <td>NOI (vor Finanzierung)</td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.noiChf))}</td>
            </tr>
            <tr>
              <td>nach Zins</td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachZinsChf))}</td>
            </tr>
            <tr>
              <td>nach Amortisation</td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachAmortisationChf))}</td>
            </tr>
            <tr>
              <td>nach kalkulatorischer Steuer</td>
              <td className="num mono">CHF {formatChf(Math.round(investmentCase.wasserfall.cashflowNachSteuerChf))}</td>
            </tr>
            <tr>
              <td>
                <strong>Nachhaltiger Cashflow</strong> (nach eigener Reparatur-/Leerstandsreserve)
              </td>
              <td className="num mono" style={{ color: investmentCase.wasserfall.nachhaltigerCashflowChf >= 0 ? "var(--good)" : "var(--bad)" }}>
                <strong>CHF {formatChf(Math.round(investmentCase.wasserfall.nachhaltigerCashflowChf))}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="sectionhead" style={{ marginTop: "1.2rem" }}>
          <h2 style={{ fontSize: ".85rem" }}>Break-even</h2>
        </div>
        <div className="metricgrid">
          <Metric l="Break-even-Miete" v={breakEven.mieteChfPerMonth !== undefined ? `CHF ${formatChf(Math.round(breakEven.mieteChfPerMonth))}/Monat` : "—"} />
          <Metric l="Break-even-Zins" v={breakEven.zinsPercent !== undefined ? `${breakEven.zinsPercent.toFixed(2)}%` : "—"} />
          {breakEven.auslastungPercent !== undefined ? <Metric l="Break-even-Auslastung" v={`${breakEven.auslastungPercent.toFixed(1)}%`} /> : null}
        </div>
      </Panel>

      {furnitureRoi ? (
        <Panel style={{ padding: "1.2rem 1.3rem", marginTop: "1.4rem" }}>
          <div className="sectionhead">
            <h2>Value-Add — Möblierung</h2>
          </div>
          <div className="metricgrid">
            <Metric l="Zusätzlicher Jahresertrag" v={`CHF ${formatChf(Math.round(furnitureRoi.zusaetzlicherJahresertragChf))}`} />
            <Metric l="Furniture ROI" v={`${furnitureRoi.roiPercent.toFixed(1)}%`} />
            <Metric l="Payback" v={furnitureRoi.paybackYears !== undefined ? `${furnitureRoi.paybackYears.toFixed(1)} Jahre` : "—"} />
            {moeblierungReserveChfPerJahr !== undefined ? (
              <Metric
                l="Geglättete Ersatzreserve"
                v={`CHF ${formatChf(Math.round(moeblierungReserveChfPerJahr))}/Jahr`}
                hint="Rein informativ — die 15-Jahres-Cashflows rechnen mit dem tatsächlichen Ersatz-Cashout im Ersatzjahr, nicht mit dieser geglätteten Reserve."
              />
            ) : null}
          </div>
        </Panel>
      ) : null}

      {renovationRoi ? (
        <Panel style={{ padding: "1.2rem 1.3rem", marginTop: "1.4rem" }}>
          <div className="sectionhead">
            <h2>Value-Add — Renovation</h2>
          </div>
          <div className="metricgrid">
            <Metric l="Zusätzlicher Jahresertrag" v={`CHF ${formatChf(Math.round(renovationRoi.zusaetzlicherJahresertragChf))}`} />
            <Metric l="Renovation ROI" v={`${renovationRoi.roiPercent.toFixed(1)}%`} />
            <Metric l="Payback" v={renovationRoi.paybackYears !== undefined ? `${renovationRoi.paybackYears.toFixed(1)} Jahre` : "—"} />
          </div>
        </Panel>
      ) : null}

      <Panel style={{ padding: "1.2rem 1.3rem", marginTop: "1.4rem" }}>
        <div className="sectionhead">
          <h2>
            Ebene C — {mehrjahresmodell.years.length}-Jahres-Modell <InfoHint text="Default 15 Jahre, 5–30 wählbar über die Bestandsrendite-Fakten." />
          </h2>
        </div>
        <div className="metricgrid">
          <Metric l="Levered IRR" v={mehrjahresmodell.leveredIrrPercent !== undefined ? `${mehrjahresmodell.leveredIrrPercent.toFixed(1)}%` : "—"} />
          <Metric l="Unlevered IRR" v={mehrjahresmodell.unleveredIrrPercent !== undefined ? `${mehrjahresmodell.unleveredIrrPercent.toFixed(1)}%` : "—"} />
          <Metric l="Equity Multiple" v={`${mehrjahresmodell.equityMultiple.toFixed(2)}×`} />
          <Metric l="Exit-Erlös (netto)" v={`CHF ${formatChf(Math.round(mehrjahresmodell.exit.netProceedsChf))}`} />
          <Metric l="Angenommener Verkaufswert" v={`CHF ${formatChf(Math.round(mehrjahresmodell.exit.assumedPropertyValueChf))}`} />
          <Metric l="Kumulierter Cashflow" v={`CHF ${formatChf(Math.round(lastYear.kumulierterCashflowChf))}`} />
        </div>

        <div className="sectionhead" style={{ marginTop: "1.2rem" }}>
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
        <Panel style={{ padding: "1.2rem 1.3rem", marginTop: "1.4rem" }}>
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

      <Panel style={{ padding: "1rem 1.3rem", marginTop: "1.4rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
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
