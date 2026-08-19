"use client";

import { BESTANDSRENDITE_PARAMETERS, type Vermietungsmodell, type RenovationPosition, type RenovationKategorie, type SteuerlicheAbzugsfaehigkeit } from "@landfinder/financial-engine";
import type { BestandsrenditeFacts } from "@/lib/bestandsrendite";
import { getCantonDefaults } from "@/lib/cantonDefaults";

export const RENOVATION_KATEGORIE_LABEL: Record<RenovationKategorie, string> = {
  WERTERHALTEND: "Werterhaltend",
  WERTVERMEHREND: "Wertvermehrend",
  ENERGETISCH: "Energetisch",
};
export const STEUERLICHE_ABZUGSFAEHIGKEIT_LABEL: Record<SteuerlicheAbzugsfaehigkeit, string> = { JA: "Ja", NEIN: "Nein", UNKLAR: "Unklar" };

export function emptyRenovationPosition(): RenovationPosition {
  return { betragChf: 0, kategorie: "WERTERHALTEND", jahr: new Date().getFullYear(), steuerlicheAbzugsfaehigkeit: "UNKLAR" };
}

/**
 * Die reinen Formularfelder der Bestandsrendite-Fakten — bewusst OHNE eigenes `<form>`
 * und Submit-Button, damit dieselbe Feldmenge sowohl auf der Objekt-Bearbeiten-Seite
 * (`BestandsrenditeVertiefungForm`, eigenes `<form>` PATCHt sofort) als auch im
 * kombinierten Neu-Erfassen-Flow (`PropertyCreateForm`, ein einziges `<form>` über
 * Objekt-Basisdaten UND diese Fakten hinweg) verwendet werden kann — HTML erlaubt keine
 * verschachtelten `<form>`-Elemente.
 *
 * `docProposals` (Feldpfad → Wert, exakt die Pfade aus `ALLOWED_UPDATE_FIELDS` in
 * bestandsrendite.ts) überschreibt den kantonalen/allgemeinen Engine-Default als
 * Vorschlagswert, wenn ein Wert aus einem hochgeladenen Dokument abgeleitet werden
 * konnte — mit eigenem Label-Hinweis "aus Dokument" statt "Standard: X", damit die
 * Herkunft transparent bleibt ("nichts wird erfunden").
 */
export function BestandsrenditeFactsFields({
  existing,
  canton,
  docProposals,
  vermietungsmodell,
  onVermietungsmodellChange,
  renovationPositionen,
  onAddRenovationPosition,
  onUpdateRenovationPosition,
  onRemoveRenovationPosition,
}: {
  existing: BestandsrenditeFacts | null;
  canton?: string;
  docProposals?: Record<string, string | number>;
  vermietungsmodell: Vermietungsmodell;
  onVermietungsmodellChange: (v: Vermietungsmodell) => void;
  renovationPositionen: RenovationPosition[];
  onAddRenovationPosition: () => void;
  onUpdateRenovationPosition: (index: number, patch: Partial<RenovationPosition>) => void;
  onRemoveRenovationPosition: (index: number) => void;
}) {
  const P = BESTANDSRENDITE_PARAMETERS;
  const cantonDefaults = getCantonDefaults(canton);
  const defaultHandaenderungssteuerPercent = cantonDefaults?.handaenderungssteuerPercent ?? P.handaenderungssteuerPercent.defaultValue;
  const defaultKalkulatorischerSteuersatzPercent = cantonDefaults?.kalkulatorischerSteuersatzPercent ?? P.kalkulatorischerSteuersatzPercent.defaultValue;
  const defaultLeerstandPercent = vermietungsmodell === "MITTELFRISTIG_MOEBLIERT" ? P.leerstandMoebliertPercent.defaultValue : P.leerstandLangfristigPercent.defaultValue;

  // Liefert für ein Feld aus ALLOWED_UPDATE_FIELDS den effektiven Vorschlagswert
  // (Dokument sticht Engine-/Kanton-Default) plus, ob er aus einem Dokument stammt.
  function resolved(field: string, engineDefault: number | undefined): { value: number | undefined; fromDoc: boolean } {
    const docValue = docProposals?.[field];
    if (typeof docValue === "number") return { value: docValue, fromDoc: true };
    return { value: engineDefault, fromDoc: false };
  }
  function standardLabel(field: string, engineDefault: number): string {
    const r = resolved(field, engineDefault);
    return r.fromDoc ? `aus Dokument: ${r.value}` : `Standard: ${r.value}`;
  }

  const zimmerzahl = resolved("zimmerzahl", undefined);
  const baujahr = resolved("baujahr", undefined);
  const parkplatzKaufpreisChf = resolved("parkplatzKaufpreisChf", 0);
  const wohnungsMiete = resolved("miete.wohnungsMieteChfPerMonth", undefined);
  const parkplatzMiete = resolved("miete.parkplatzMieteChfPerMonth", 0);
  const sonstigeEinnahmen = resolved("miete.sonstigeEinnahmenChfPerYear", 0);
  const leerstand = resolved("miete.leerstandPercent", defaultLeerstandPercent);
  const stwegAkonto = resolved("betriebskosten.stwegAkontobeitragChfPerYear", 0);
  const erneuerungsfondsSaldo = resolved("stweg.erneuerungsfondsSaldoChf", undefined);
  const erneuerungsfondsZielwert = resolved("stweg.erneuerungsfondsZielwertChf", undefined);
  const wertquote = resolved("stweg.wertquotePromille", undefined);

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
        Objekt
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="zimmerzahl">Zimmerzahl{zimmerzahl.fromDoc ? ` (aus Dokument: ${zimmerzahl.value})` : ""}</label>
          <input id="zimmerzahl" name="zimmerzahl" type="number" step="0.5" defaultValue={existing?.zimmerzahl ?? zimmerzahl.value} />
        </div>
        <div className="field">
          <label htmlFor="baujahr">Baujahr{baujahr.fromDoc ? ` (aus Dokument: ${baujahr.value})` : ""}</label>
          <input id="baujahr" name="baujahr" type="number" step="1" defaultValue={existing?.baujahr ?? baujahr.value} />
        </div>
        <div className="field">
          <label htmlFor="parkplatzKaufpreisChf">
            Parkplatz-Kaufpreis (CHF, {parkplatzKaufpreisChf.fromDoc ? `aus Dokument: ${parkplatzKaufpreisChf.value}` : "0 falls keiner"})
          </label>
          <input id="parkplatzKaufpreisChf" name="parkplatzKaufpreisChf" type="number" step="1000" defaultValue={existing?.parkplatzKaufpreisChf ?? parkplatzKaufpreisChf.value} />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        Kaufnebenkosten
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: "0 0 .6rem" }}>
        Vorausgefüllt mit einem Vorschlagswert{canton ? ` für Kanton ${canton}` : ""} — bei Bedarf einfach überschreiben.
      </p>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="handaenderungssteuerPercent">Handänderungssteuer (%, Standard: {defaultHandaenderungssteuerPercent})</label>
          <input
            id="handaenderungssteuerPercent"
            name="handaenderungssteuerPercent"
            type="number"
            step="0.1"
            defaultValue={existing?.nebenkosten.handaenderungssteuerPercent ?? defaultHandaenderungssteuerPercent}
          />
        </div>
        <div className="field">
          <label htmlFor="notariatGrundbuchPercent">Notariat/Grundbuch (%, Standard: {P.notariatGrundbuchPercent.defaultValue})</label>
          <input
            id="notariatGrundbuchPercent"
            name="notariatGrundbuchPercent"
            type="number"
            step="0.1"
            defaultValue={existing?.nebenkosten.notariatGrundbuchPercent ?? P.notariatGrundbuchPercent.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="maklerprovisionPercent">Maklerprovision (%, Standard: {P.maklerprovisionPercent.defaultValue})</label>
          <input
            id="maklerprovisionPercent"
            name="maklerprovisionPercent"
            type="number"
            step="0.1"
            defaultValue={existing?.nebenkosten.maklerprovisionPercent ?? P.maklerprovisionPercent.defaultValue}
          />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        Miete &amp; Vermietungsmodell
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="wohnungsMieteChfPerMonth">Nettomiete Wohnung (CHF/Monat){wohnungsMiete.fromDoc ? ` (aus Dokument: ${wohnungsMiete.value})` : ""}</label>
          <input
            id="wohnungsMieteChfPerMonth"
            name="wohnungsMieteChfPerMonth"
            type="number"
            step="10"
            required
            defaultValue={existing?.miete.wohnungsMieteChfPerMonth ?? wohnungsMiete.value}
          />
        </div>
        <div className="field">
          <label htmlFor="parkplatzMieteChfPerMonth">Miete Parkplatz (CHF/Monat){parkplatzMiete.fromDoc ? ` (aus Dokument: ${parkplatzMiete.value})` : ""}</label>
          <input
            id="parkplatzMieteChfPerMonth"
            name="parkplatzMieteChfPerMonth"
            type="number"
            step="10"
            defaultValue={existing?.miete.parkplatzMieteChfPerMonth ?? parkplatzMiete.value}
          />
        </div>
        <div className="field">
          <label htmlFor="sonstigeEinnahmenChfPerYear">Sonstige Einnahmen (CHF/Jahr){sonstigeEinnahmen.fromDoc ? ` (aus Dokument: ${sonstigeEinnahmen.value})` : ""}</label>
          <input
            id="sonstigeEinnahmenChfPerYear"
            name="sonstigeEinnahmenChfPerYear"
            type="number"
            step="100"
            defaultValue={existing?.miete.sonstigeEinnahmenChfPerYear ?? sonstigeEinnahmen.value}
          />
        </div>
        <div className="field">
          <label htmlFor="vermietungsmodell">Vermietungsmodell</label>
          <select id="vermietungsmodell" name="vermietungsmodell" value={vermietungsmodell} onChange={(e) => onVermietungsmodellChange(e.target.value as Vermietungsmodell)}>
            <option value="LANGFRISTIG_UNMOEBLIERT">Langfristig, unmöbliert</option>
            <option value="MITTELFRISTIG_MOEBLIERT">Mittelfristig, möbliert</option>
            <option value="SHORT_STAY">Short Stay (Auslastung statt Leerstand)</option>
          </select>
        </div>
        {vermietungsmodell === "SHORT_STAY" ? (
          <div className="field">
            <label htmlFor="auslastungPercent">Auslastung (%, leer = Default)</label>
            <input id="auslastungPercent" name="auslastungPercent" type="number" step="1" defaultValue={existing?.miete.auslastungPercent} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="leerstandPercent">Leerstand (%, {standardLabel("miete.leerstandPercent", defaultLeerstandPercent)})</label>
            <input id="leerstandPercent" name="leerstandPercent" type="number" step="0.5" defaultValue={existing?.miete.leerstandPercent ?? leerstand.value} />
          </div>
        )}
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        Möblierung (0, falls unmöbliert)
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="moeblierungInitialCostChf">Möblierung — Initialkosten (CHF)</label>
          <input id="moeblierungInitialCostChf" name="moeblierungInitialCostChf" type="number" step="500" defaultValue={existing?.moeblierung.initialCostChf ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="mietPremiumChfPerMonth">Möblierungs-Mietpremium (CHF/Monat)</label>
          <input id="mietPremiumChfPerMonth" name="mietPremiumChfPerMonth" type="number" step="10" defaultValue={existing?.moeblierung.mietPremiumChfPerMonth ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="moeblierungNutzungsdauerJahre">Nutzungsdauer (Jahre, Standard: {P.moeblierungNutzungsdauerJahre.defaultValue})</label>
          <input
            id="moeblierungNutzungsdauerJahre"
            name="moeblierungNutzungsdauerJahre"
            type="number"
            step="1"
            defaultValue={existing?.moeblierung.nutzungsdauerJahre ?? P.moeblierungNutzungsdauerJahre.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="jaehrlicherErsatzsatzPercent">Jährliche Ersatzquote (%, Standard: {P.moeblierungErsatzquotePercent.defaultValue})</label>
          <input
            id="jaehrlicherErsatzsatzPercent"
            name="jaehrlicherErsatzsatzPercent"
            type="number"
            step="1"
            defaultValue={existing?.moeblierung.jaehrlicherErsatzsatzPercent ?? P.moeblierungErsatzquotePercent.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="moeblierungKostensteigerungPercentPerYear">Kosteninflation Möblierung (%/Jahr, leer = allgemeine Kosteninflation)</label>
          <input
            id="moeblierungKostensteigerungPercentPerYear"
            name="moeblierungKostensteigerungPercentPerYear"
            type="number"
            step="0.1"
            defaultValue={existing?.moeblierung.kostensteigerungPercentPerYear}
          />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        Renovation
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="initialRenovationCostChf">Initial-Renovationskosten gesamt (CHF, 0 falls bereits saniert)</label>
          <input id="initialRenovationCostChf" name="initialRenovationCostChf" type="number" step="500" defaultValue={existing?.renovation.initialRenovationCostChf ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="mieteVorRenovationChfPerMonth">Miete vor Renovation (CHF/Monat, für Renovation-ROI)</label>
          <input
            id="mieteVorRenovationChfPerMonth"
            name="mieteVorRenovationChfPerMonth"
            type="number"
            step="10"
            defaultValue={existing?.renovation.mieteVorRenovationChfPerMonth}
          />
        </div>
        <div className="field">
          <label htmlFor="mieteNachRenovationChfPerMonth">Erzielbare Miete nach Renovation (CHF/Monat)</label>
          <input
            id="mieteNachRenovationChfPerMonth"
            name="mieteNachRenovationChfPerMonth"
            type="number"
            step="10"
            defaultValue={existing?.renovation.mieteNachRenovationChfPerMonth}
          />
        </div>
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: ".5rem 0" }}>
        Nur wertvermehrende Positionen unten erhöhen den angenommenen Immobilienwert im 15-Jahres-Modell — ohne
        Positionen bleibt der Gesamtbetrag oben nur Teil der Investitionssumme, ohne Werteffekt beim Exit.
      </p>
      {renovationPositionen.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem", marginBottom: ".8rem" }}>
          {renovationPositionen.map((p, i) => (
            <div key={i} className="fieldgrid" style={{ alignItems: "end", border: "1px solid var(--line)", borderRadius: "6px", padding: ".6rem" }}>
              <div className="field">
                <label htmlFor={`renovation-betrag-${i}`}>Betrag (CHF)</label>
                <input
                  id={`renovation-betrag-${i}`}
                  type="number"
                  step="100"
                  value={p.betragChf}
                  onChange={(e) => onUpdateRenovationPosition(i, { betragChf: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="field">
                <label htmlFor={`renovation-kategorie-${i}`}>Kategorie</label>
                <select
                  id={`renovation-kategorie-${i}`}
                  value={p.kategorie}
                  onChange={(e) => onUpdateRenovationPosition(i, { kategorie: e.target.value as RenovationKategorie })}
                >
                  {(Object.keys(RENOVATION_KATEGORIE_LABEL) as RenovationKategorie[]).map((k) => (
                    <option key={k} value={k}>
                      {RENOVATION_KATEGORIE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`renovation-jahr-${i}`}>Jahr</label>
                <input
                  id={`renovation-jahr-${i}`}
                  type="number"
                  step="1"
                  value={p.jahr}
                  onChange={(e) => onUpdateRenovationPosition(i, { jahr: Number(e.target.value) || new Date().getFullYear() })}
                />
              </div>
              <div className="field">
                <label htmlFor={`renovation-abzugsfaehigkeit-${i}`}>Steuerlich abzugsfähig</label>
                <select
                  id={`renovation-abzugsfaehigkeit-${i}`}
                  value={p.steuerlicheAbzugsfaehigkeit}
                  onChange={(e) => onUpdateRenovationPosition(i, { steuerlicheAbzugsfaehigkeit: e.target.value as SteuerlicheAbzugsfaehigkeit })}
                >
                  {(Object.keys(STEUERLICHE_ABZUGSFAEHIGKEIT_LABEL) as SteuerlicheAbzugsfaehigkeit[]).map((k) => (
                    <option key={k} value={k}>
                      {STEUERLICHE_ABZUGSFAEHIGKEIT_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label htmlFor={`renovation-beschreibung-${i}`}>Beschreibung (optional)</label>
                <input
                  id={`renovation-beschreibung-${i}`}
                  type="text"
                  value={p.beschreibung ?? ""}
                  onChange={(e) => onUpdateRenovationPosition(i, { beschreibung: e.target.value || undefined })}
                />
              </div>
              <button type="button" className="btn" style={{ width: "auto", padding: ".2rem .6rem", fontSize: ".76rem" }} onClick={() => onRemoveRenovationPosition(i)}>
                Position entfernen
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className="btn" style={{ width: "auto", padding: ".3rem .8rem", fontSize: ".78rem", marginBottom: "1rem" }} onClick={onAddRenovationPosition}>
        + Renovationsposition hinzufügen
      </button>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        Betriebskosten (CHF/Jahr)
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="stwegAkontobeitragChfPerYear">STWEG-Akontobeitrag{stwegAkonto.fromDoc ? ` (aus Dokument: ${stwegAkonto.value})` : ""}</label>
          <input
            id="stwegAkontobeitragChfPerYear"
            name="stwegAkontobeitragChfPerYear"
            type="number"
            step="100"
            defaultValue={existing?.betriebskosten.stwegAkontobeitragChfPerYear ?? stwegAkonto.value}
          />
        </div>
        <div className="field">
          <label htmlFor="eigentuemerkostenChfPerYear">Sonstige Eigentümerkosten</label>
          <input id="eigentuemerkostenChfPerYear" name="eigentuemerkostenChfPerYear" type="number" step="50" defaultValue={existing?.betriebskosten.eigentuemerkostenChfPerYear ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="vermietungskostenChfPerYear">Vermietungs-/Inseratskosten</label>
          <input id="vermietungskostenChfPerYear" name="vermietungskostenChfPerYear" type="number" step="50" defaultValue={existing?.betriebskosten.vermietungskostenChfPerYear ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="reinigungServiceChfPerYear">Reinigung/Service</label>
          <input id="reinigungServiceChfPerYear" name="reinigungServiceChfPerYear" type="number" step="50" defaultValue={existing?.betriebskosten.reinigungServiceChfPerYear ?? 0} />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        Eigene Reserven (je CHF/Jahr ODER % vom Kaufpreis — CHF hat Vorrang, leer = Default ~0.30%)
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="reparaturChfPerYear">Reparaturreserve (CHF/Jahr)</label>
          <input id="reparaturChfPerYear" name="reparaturChfPerYear" type="number" step="100" defaultValue={existing?.reserven.reparaturChfPerYear} />
        </div>
        <div className="field">
          <label htmlFor="reparaturPercentOfKaufpreis">Reparaturreserve (% Kaufpreis, Standard: {P.reparaturreservePercentOfKaufpreis.defaultValue})</label>
          <input
            id="reparaturPercentOfKaufpreis"
            name="reparaturPercentOfKaufpreis"
            type="number"
            step="0.05"
            defaultValue={existing?.reserven.reparaturPercentOfKaufpreis ?? (existing?.reserven.reparaturChfPerYear ? undefined : P.reparaturreservePercentOfKaufpreis.defaultValue)}
          />
        </div>
        <div className="field">
          <label htmlFor="leerstandReserveChfPerYear">Leerstandsreserve (CHF/Jahr)</label>
          <input id="leerstandReserveChfPerYear" name="leerstandReserveChfPerYear" type="number" step="100" defaultValue={existing?.reserven.leerstandChfPerYear} />
        </div>
        <div className="field">
          <label htmlFor="leerstandReservePercentOfKaufpreis">Leerstandsreserve (% Kaufpreis, Standard: {P.leerstandsreservePercentOfKaufpreis.defaultValue})</label>
          <input
            id="leerstandReservePercentOfKaufpreis"
            name="leerstandReservePercentOfKaufpreis"
            type="number"
            step="0.05"
            defaultValue={existing?.reserven.leerstandPercentOfKaufpreis ?? (existing?.reserven.leerstandChfPerYear ? undefined : P.leerstandsreservePercentOfKaufpreis.defaultValue)}
          />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        Finanzierung &amp; Steuer
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="loanToValuePercent">Belehnung (%)</label>
          <input id="loanToValuePercent" name="loanToValuePercent" type="number" step="1" required defaultValue={existing?.hypothek.loanToValuePercent ?? 70} />
        </div>
        <div className="field">
          <label htmlFor="interestRatePercent">Zinssatz (%)</label>
          <input id="interestRatePercent" name="interestRatePercent" type="number" step="0.1" required defaultValue={existing?.hypothek.interestRatePercent ?? 2} />
        </div>
        <div className="field">
          <label htmlFor="amortisationChfPerYear">Amortisation (CHF/Jahr)</label>
          <input id="amortisationChfPerYear" name="amortisationChfPerYear" type="number" step="500" required defaultValue={existing?.hypothek.amortisationChfPerYear ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="kalkulatorischerSteuersatzPercent">
            Kalkulatorischer Steuersatz (%, {defaultKalkulatorischerSteuersatzPercent}
            {canton ? ` für ${canton}` : ""})
          </label>
          <input
            id="kalkulatorischerSteuersatzPercent"
            name="kalkulatorischerSteuersatzPercent"
            type="number"
            step="1"
            defaultValue={existing?.kalkulatorischerSteuersatzPercent ?? defaultKalkulatorischerSteuersatzPercent}
          />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        15-Jahres-Modell (vorausgefüllt mit Standardwerten, bei Bedarf überschreiben)
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="holdingPeriodYears">Haltedauer (5–30 Jahre, Standard: {P.holdingPeriodYearsDefault.defaultValue})</label>
          <input
            id="holdingPeriodYears"
            name="holdingPeriodYears"
            type="number"
            step="1"
            min="5"
            max="30"
            defaultValue={existing?.mehrjahresmodell.holdingPeriodYears ?? P.holdingPeriodYearsDefault.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="mietsteigerungPercentPerYear">Mietsteigerung (%/Jahr, Standard: {P.mietsteigerungPercentPerYear.defaultValue})</label>
          <input
            id="mietsteigerungPercentPerYear"
            name="mietsteigerungPercentPerYear"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.mietsteigerungPercentPerYear ?? P.mietsteigerungPercentPerYear.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="kosteninflationPercentPerYear">Kosteninflation (%/Jahr, Standard: {P.kosteninflationPercentPerYear.defaultValue})</label>
          <input
            id="kosteninflationPercentPerYear"
            name="kosteninflationPercentPerYear"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.kosteninflationPercentPerYear ?? P.kosteninflationPercentPerYear.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="wertsteigerungPercentPerYear">Wertsteigerung (%/Jahr, Standard: {P.wertsteigerungPercentPerYear.defaultValue})</label>
          <input
            id="wertsteigerungPercentPerYear"
            name="wertsteigerungPercentPerYear"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.wertsteigerungPercentPerYear ?? P.wertsteigerungPercentPerYear.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="sellingCostPercent">Verkaufskosten Exit (%, Standard: {P.sellingCostPercent.defaultValue})</label>
          <input
            id="sellingCostPercent"
            name="sellingCostPercent"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.sellingCostPercent ?? P.sellingCostPercent.defaultValue}
          />
        </div>
        <div className="field">
          <label htmlFor="grundstueckgewinnsteuerPercent">Grundstückgewinnsteuer (%, optional, grobe Näherung)</label>
          <input id="grundstueckgewinnsteuerPercent" name="grundstueckgewinnsteuerPercent" type="number" step="1" defaultValue={existing?.mehrjahresmodell.grundstueckgewinnsteuerPercent} />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
        STWEG
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="wertquotePromille">Wertquote (‰){wertquote.fromDoc ? ` (aus Dokument: ${wertquote.value})` : ""}</label>
          <input id="wertquotePromille" name="wertquotePromille" type="number" step="1" defaultValue={existing?.stweg.wertquotePromille ?? wertquote.value} />
        </div>
        <div className="field">
          <label htmlFor="erneuerungsfondsSaldoChf">
            Erneuerungsfonds-Saldo (CHF){erneuerungsfondsSaldo.fromDoc ? ` (aus Dokument: ${erneuerungsfondsSaldo.value})` : ""}
          </label>
          <input
            id="erneuerungsfondsSaldoChf"
            name="erneuerungsfondsSaldoChf"
            type="number"
            step="1000"
            defaultValue={existing?.stweg.erneuerungsfondsSaldoChf ?? erneuerungsfondsSaldo.value}
          />
        </div>
        <div className="field">
          <label htmlFor="erneuerungsfondsZielwertChf">
            Erneuerungsfonds-Zielwert (CHF, falls bekannt){erneuerungsfondsZielwert.fromDoc ? ` (aus Dokument: ${erneuerungsfondsZielwert.value})` : ""}
          </label>
          <input
            id="erneuerungsfondsZielwertChf"
            name="erneuerungsfondsZielwertChf"
            type="number"
            step="1000"
            defaultValue={existing?.stweg.erneuerungsfondsZielwertChf ?? erneuerungsfondsZielwert.value}
          />
        </div>
      </div>
      <div className="field" style={{ marginTop: ".6rem" }}>
        <div className="checkbox-row">
          <input id="naechsteGrossaSanierungGeplant" name="naechsteGrossaSanierungGeplant" type="checkbox" defaultChecked={existing?.stweg.naechsteGrossaSanierungGeplant ?? false} />
          <label htmlFor="naechsteGrossaSanierungGeplant" style={{ marginBottom: 0 }}>
            Grössere Sanierung geplant/diskutiert (auch vertagte/abgelehnte Vorhaben zählen)
          </label>
        </div>
      </div>
      <div className="field" style={{ marginTop: ".6rem" }}>
        <label htmlFor="naechsteGrossaSanierungNotes">Notizen dazu</label>
        <textarea id="naechsteGrossaSanierungNotes" name="naechsteGrossaSanierungNotes" rows={2} defaultValue={existing?.stweg.naechsteGrossaSanierungNotes} style={{ width: "100%" }} />
      </div>
      <div className="field" style={{ marginTop: ".6rem" }}>
        <label htmlFor="sanierungsstauNotes">Sanierungsstau-Hinweise</label>
        <textarea id="sanierungsstauNotes" name="sanierungsstauNotes" rows={2} defaultValue={existing?.stweg.sanierungsstauNotes} style={{ width: "100%" }} />
      </div>
      <div className="fieldgrid" style={{ marginTop: ".6rem" }}>
        <div className="field">
          <label htmlFor="offeneBeschluesseCount">Offene/strittige Beschlüsse (Anzahl, falls bekannt)</label>
          <input id="offeneBeschluesseCount" name="offeneBeschluesseCount" type="number" step="1" min="0" defaultValue={existing?.stweg.offeneBeschluesseCount} />
        </div>
        <div className="field">
          <label htmlFor="quelle">Quelle (z.B. &quot;Protokoll ordentliche Versammlung 2026-03-12&quot;)</label>
          <input id="quelle" name="quelle" type="text" defaultValue={existing?.stweg.quelle} />
        </div>
      </div>
      <div className="field" style={{ marginTop: ".6rem" }}>
        <label htmlFor="beschlussrisikenNotes">Beschlussrisiken (z.B. Rechtsstreitigkeiten zwischen Eigentümern)</label>
        <textarea id="beschlussrisikenNotes" name="beschlussrisikenNotes" rows={2} defaultValue={existing?.stweg.beschlussrisikenNotes} style={{ width: "100%" }} />
      </div>

      <div className="field" style={{ marginTop: "1rem" }}>
        <label htmlFor="notes">Weitere Notizen</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={existing?.notes} style={{ width: "100%" }} />
      </div>
    </>
  );
}
