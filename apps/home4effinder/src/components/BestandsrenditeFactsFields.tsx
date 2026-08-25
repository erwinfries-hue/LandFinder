"use client";

import { useRef, useState } from "react";
import {
  BESTANDSRENDITE_PARAMETERS,
  defaultsOf,
  type BestandsrenditeParameterKey,
  type Vermietungsmodell,
  type RenovationPosition,
  type RenovationKategorie,
  type SteuerlicheAbzugsfaehigkeit,
  type AmortisationModus,
} from "@landfinder/financial-engine";
import type { BestandsrenditeFacts, ParameterOverrides } from "@/lib/bestandsrendite";
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
 * Wertvorschläge (HTML-`<datalist>`, keine erzwungene Auswahl — das Feld bleibt frei
 * editierbar, "nichts wird erfunden") für Felder, bei denen in der Praxis nur wenige,
 * feste Werte üblich sind statt eines Kontinuums (z.B. Zimmerzahl in 0.5-Schritten,
 * Hypothekar-Zinssätze in 0.25%-Schritten, 2. Hypothek gesetzlich binnen 15 Jahren zu
 * amortisieren).
 */
const ZIMMERZAHL_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];
const ZINSSATZ_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 4];
const ERSTE_BELEHNUNG_OPTIONS = [50, 60, 65];
const ZWEITE_BELEHNUNG_OPTIONS = [0, 5, 10, 15, 20];
const LEERSTAND_OPTIONS = [0, 1, 2, 3, 5, 7, 10];
const AUSLASTUNG_OPTIONS = [100, 95, 90, 85, 80, 75, 70, 60];
const AMORTISATIONSDAUER_OPTIONS = [10, 15];
const HOLDING_PERIOD_OPTIONS = [5, 10, 15, 20, 25, 30];

function NumberOptions({ id, values }: { id: string; values: number[] }) {
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
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
  parameterOverrides,
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
  /** Überschreibungen aus dem "Annahmen"-Reiter (`app_settings`, Migration 0007) — fehlt ein Schlüssel, gilt der Registry-Default aus BESTANDSRENDITE_PARAMETERS. */
  parameterOverrides?: ParameterOverrides;
}) {
  const P: Record<BestandsrenditeParameterKey, number> = { ...defaultsOf(BESTANDSRENDITE_PARAMETERS), ...parameterOverrides };
  const [ersteAmortisationModus, setErsteAmortisationModus] = useState<AmortisationModus>(existing?.hypothek.ersteHypothek.amortisation.modus ?? "PROZENT_PRO_JAHR");
  const [zweiteAmortisationModus, setZweiteAmortisationModus] = useState<AmortisationModus>(existing?.hypothek.zweiteHypothek.amortisation.modus ?? "DAUER_JAHRE");
  const zimmerzahlInputRef = useRef<HTMLInputElement>(null);
  const wohnungsMieteInputRef = useRef<HTMLInputElement>(null);
  const [rentEstimate, setRentEstimate] = useState<{ value: number; rationale: string } | null>(null);
  const [estimatingRent, setEstimatingRent] = useState(false);
  const [rentEstimateError, setRentEstimateError] = useState<string | null>(null);

  /**
   * Mietschätzung via Claudes allgemeinem Marktwissen (KEINE Live-Recherche, siehe
   * marketRentEstimate.ts) — nur für den Fall, dass kein Dokument einen Mietwert
   * liefert. Trägt den Wert direkt ins (unkontrollierte) Feld ein und markiert ihn
   * separat als Annahme, statt ihn unmarkiert als "echten" Wert erscheinen zu lassen.
   */
  async function handleEstimateRent() {
    if (!canton) {
      setRentEstimateError("Kanton fehlt — bitte zuerst oben bei den Objekt-Basisdaten auswählen.");
      return;
    }
    setEstimatingRent(true);
    setRentEstimateError(null);
    try {
      const zimmerzahlRaw = zimmerzahlInputRef.current?.value;
      const zimmerzahlValue = zimmerzahlRaw ? Number(zimmerzahlRaw) : undefined;
      const res = await fetch("/api/market-rent-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canton, zimmerzahl: Number.isFinite(zimmerzahlValue) ? zimmerzahlValue : undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { estimated?: boolean; wohnungsMieteChfPerMonth?: number; rationale?: string; error?: string };
      if (!res.ok || !body.estimated || typeof body.wohnungsMieteChfPerMonth !== "number") {
        setRentEstimateError(body.error ?? "Schätzung fehlgeschlagen.");
        return;
      }
      if (wohnungsMieteInputRef.current) wohnungsMieteInputRef.current.value = String(body.wohnungsMieteChfPerMonth);
      setRentEstimate({ value: body.wohnungsMieteChfPerMonth, rationale: body.rationale ?? "" });
    } catch {
      setRentEstimateError("Schätzung fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setEstimatingRent(false);
    }
  }

  const cantonDefaults = getCantonDefaults(canton);
  const defaultHandaenderungssteuerPercent = cantonDefaults?.handaenderungssteuerPercent ?? P.handaenderungssteuerPercent;
  const defaultKalkulatorischerSteuersatzPercent = cantonDefaults?.kalkulatorischerSteuersatzPercent ?? P.kalkulatorischerSteuersatzPercent;
  const defaultLeerstandPercent = vermietungsmodell === "MITTELFRISTIG_MOEBLIERT" ? P.leerstandMoebliertPercent : P.leerstandLangfristigPercent;

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
  const wohnungsMiete = resolved("miete.wohnungsMieteChfPerMonth", undefined);
  const parkplatzMiete = resolved("miete.parkplatzMieteChfPerMonth", 0);
  const garagenplatzMiete = resolved("miete.garagenplatzMieteChfPerMonth", 0);
  const hobbyraumMiete = resolved("miete.hobbyraumMieteChfPerMonth", 0);
  const sonstigeEinnahmen = resolved("miete.sonstigeEinnahmenChfPerYear", 0);
  const leerstand = resolved("miete.leerstandPercent", defaultLeerstandPercent);
  const stwegAkonto = resolved("betriebskosten.stwegAkontobeitragChfPerYear", 0);
  const erneuerungsfondsSaldo = resolved("stweg.erneuerungsfondsSaldoChf", undefined);
  const erneuerungsfondsWohnungsanteil = resolved("stweg.erneuerungsfondsWohnungsanteilChf", undefined);
  const erneuerungsfondsZielwert = resolved("stweg.erneuerungsfondsZielwertChf", undefined);
  const wertquote = resolved("stweg.wertquotePromille", undefined);

  return (
    <>
      <NumberOptions id="dl-zimmerzahl" values={ZIMMERZAHL_OPTIONS} />
      <NumberOptions id="dl-zinssatz" values={ZINSSATZ_OPTIONS} />
      <NumberOptions id="dl-erste-belehnung" values={ERSTE_BELEHNUNG_OPTIONS} />
      <NumberOptions id="dl-zweite-belehnung" values={ZWEITE_BELEHNUNG_OPTIONS} />
      <NumberOptions id="dl-leerstand" values={LEERSTAND_OPTIONS} />
      <NumberOptions id="dl-auslastung" values={AUSLASTUNG_OPTIONS} />
      <NumberOptions id="dl-amortisationsdauer" values={AMORTISATIONSDAUER_OPTIONS} />
      <NumberOptions id="dl-holding-period" values={HOLDING_PERIOD_OPTIONS} />

      <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
        Objekt
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="zimmerzahl">Zimmerzahl{zimmerzahl.fromDoc ? ` (aus Dokument: ${zimmerzahl.value})` : ""}</label>
          <input id="zimmerzahl" name="zimmerzahl" type="number" step="0.5" list="dl-zimmerzahl" ref={zimmerzahlInputRef} defaultValue={existing?.zimmerzahl ?? zimmerzahl.value} />
        </div>
        <div className="field">
          <label htmlFor="baujahr">Baujahr{baujahr.fromDoc ? ` (aus Dokument: ${baujahr.value})` : ""}</label>
          <input id="baujahr" name="baujahr" type="number" step="1" defaultValue={existing?.baujahr ?? baujahr.value} />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Kaufnebenkosten
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: "0 0 .45rem" }}>
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
          <label htmlFor="notariatGrundbuchPercent">Notariat/Grundbuch (%, Standard: {P.notariatGrundbuchPercent})</label>
          <input
            id="notariatGrundbuchPercent"
            name="notariatGrundbuchPercent"
            type="number"
            step="0.1"
            defaultValue={existing?.nebenkosten.notariatGrundbuchPercent ?? P.notariatGrundbuchPercent}
          />
        </div>
        <div className="field">
          <label htmlFor="maklerprovisionPercent">Maklerprovision (%, Standard: {P.maklerprovisionPercent})</label>
          <input
            id="maklerprovisionPercent"
            name="maklerprovisionPercent"
            type="number"
            step="0.1"
            defaultValue={existing?.nebenkosten.maklerprovisionPercent ?? P.maklerprovisionPercent}
          />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Miete &amp; Vermietungsmodell — gemeinsame Angaben (gelten für Paket 1 und 2)
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="parkplatzMieteChfPerMonth">Miete Aussenparkplatz (CHF/Monat){parkplatzMiete.fromDoc ? ` (aus Dokument: ${parkplatzMiete.value})` : ""}</label>
          <input
            id="parkplatzMieteChfPerMonth"
            name="parkplatzMieteChfPerMonth"
            type="number"
            step="10"
            defaultValue={existing?.miete.parkplatzMieteChfPerMonth ?? parkplatzMiete.value}
          />
        </div>
        <div className="field">
          <label htmlFor="garagenplatzMieteChfPerMonth">Miete Garage (CHF/Monat){garagenplatzMiete.fromDoc ? ` (aus Dokument: ${garagenplatzMiete.value})` : ""}</label>
          <input
            id="garagenplatzMieteChfPerMonth"
            name="garagenplatzMieteChfPerMonth"
            type="number"
            step="10"
            defaultValue={existing?.miete.garagenplatzMieteChfPerMonth ?? garagenplatzMiete.value}
          />
        </div>
        <div className="field">
          <label htmlFor="hobbyraumMieteChfPerMonth">Miete Hobbyraum (CHF/Monat){hobbyraumMiete.fromDoc ? ` (aus Dokument: ${hobbyraumMiete.value})` : ""}</label>
          <input
            id="hobbyraumMieteChfPerMonth"
            name="hobbyraumMieteChfPerMonth"
            type="number"
            step="10"
            defaultValue={existing?.miete.hobbyraumMieteChfPerMonth ?? hobbyraumMiete.value}
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
            <input id="auslastungPercent" name="auslastungPercent" type="number" step="1" list="dl-auslastung" defaultValue={existing?.miete.auslastungPercent} />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="leerstandPercent">Leerstand (%, {standardLabel("miete.leerstandPercent", defaultLeerstandPercent)})</label>
            <input id="leerstandPercent" name="leerstandPercent" type="number" step="0.5" list="dl-leerstand" defaultValue={existing?.miete.leerstandPercent ?? leerstand.value} />
          </div>
        )}
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Value-Add — Möblierung: 2 Szenarien im Vergleich
      </div>
      <p style={{ fontSize: ".78rem", color: "var(--ink-soft)", marginTop: 0, marginBottom: ".7rem" }}>
        Jedes Paket komplett für sich erfasst — Paket 1 hat schlicht keine eigenen Zusatzkosten, Paket 2 zusätzlich
        einmalige Möblierungskosten. Das oben gewählte Vermietungsmodell legt fest, welches Paket in
        Schnellcheck/Rendite/15-Jahres-Modell tatsächlich gerechnet wird — das Ergebnis beider Pakete im direkten
        Vergleich zeigt die Analyse weiter unten unter &quot;Value-Add — Möblierung&quot;.
      </p>
      <div style={{ fontWeight: 600, fontSize: ".82rem", marginBottom: ".4rem" }}>Paket 1 — unmöbliert vermieten</div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="wohnungsMieteChfPerMonth">
            Nettomiete Wohnung unmöbliert (CHF/Monat){wohnungsMiete.fromDoc ? ` (aus Dokument: ${wohnungsMiete.value})` : ""}
          </label>
          <input
            id="wohnungsMieteChfPerMonth"
            name="wohnungsMieteChfPerMonth"
            type="number"
            step="10"
            required
            ref={wohnungsMieteInputRef}
            defaultValue={existing?.miete.wohnungsMieteChfPerMonth ?? wohnungsMiete.value}
          />
          {!wohnungsMiete.fromDoc && !existing?.miete.wohnungsMieteChfPerMonth ? (
            <div style={{ marginTop: ".3rem" }}>
              <button
                type="button"
                className="btn"
                style={{ width: "auto", padding: ".15rem .5rem", fontSize: ".72rem" }}
                disabled={estimatingRent}
                onClick={handleEstimateRent}
              >
                {estimatingRent ? "Schätzt…" : "Marktschätzung vorschlagen (kein Dokumentwert)"}
              </button>
              {rentEstimateError ? <div style={{ color: "var(--bad)", fontSize: ".74rem", marginTop: ".25rem" }}>{rentEstimateError}</div> : null}
              {rentEstimate ? (
                <div style={{ color: "var(--warn)", fontSize: ".74rem", marginTop: ".25rem" }}>
                  Annahme (KI-Schätzung, keine Live-Marktdaten) — bitte prüfen: {rentEstimate.rationale}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="initialRenovationCostUnmoebliertChf">Initial-Renovationskosten (CHF, 0 falls bereits saniert)</label>
          <input
            id="initialRenovationCostUnmoebliertChf"
            name="initialRenovationCostUnmoebliertChf"
            type="number"
            step="500"
            defaultValue={existing?.renovation.initialRenovationCostUnmoebliertChf ?? 0}
          />
        </div>
        <div className="field">
          <label htmlFor="reinigungServiceUnmoebliertChfPerYear">Reinigung/Service (CHF/Jahr)</label>
          <input
            id="reinigungServiceUnmoebliertChfPerYear"
            name="reinigungServiceUnmoebliertChfPerYear"
            type="number"
            step="50"
            defaultValue={existing?.betriebskosten.reinigungServiceUnmoebliertChfPerYear ?? 0}
          />
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: ".82rem", margin: ".9rem 0 .4rem" }}>Paket 2 — möbliert vermieten</div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="moeblierteMieteChfPerMonth">Erwartete Miete möbliert (CHF/Monat)</label>
          <input
            id="moeblierteMieteChfPerMonth"
            name="moeblierteMieteChfPerMonth"
            type="number"
            step="10"
            defaultValue={existing ? existing.miete.wohnungsMieteChfPerMonth + existing.moeblierung.mietPremiumChfPerMonth : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="moeblierungInitialCostChf">Möblierung — Initialkosten (CHF)</label>
          <input id="moeblierungInitialCostChf" name="moeblierungInitialCostChf" type="number" step="500" defaultValue={existing?.moeblierung.initialCostChf ?? 0} />
        </div>
        <div className="field">
          <label htmlFor="moeblierungNutzungsdauerJahre">Nutzungsdauer (Jahre, Standard: {P.moeblierungNutzungsdauerJahre})</label>
          <input
            id="moeblierungNutzungsdauerJahre"
            name="moeblierungNutzungsdauerJahre"
            type="number"
            step="1"
            defaultValue={existing?.moeblierung.nutzungsdauerJahre ?? P.moeblierungNutzungsdauerJahre}
          />
        </div>
        <div className="field">
          <label htmlFor="jaehrlicherErsatzsatzPercent">Jährliche Ersatzquote (%, Standard: {P.moeblierungErsatzquotePercent})</label>
          <input
            id="jaehrlicherErsatzsatzPercent"
            name="jaehrlicherErsatzsatzPercent"
            type="number"
            step="1"
            defaultValue={existing?.moeblierung.jaehrlicherErsatzsatzPercent ?? P.moeblierungErsatzquotePercent}
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
        <div className="field">
          <label htmlFor="initialRenovationCostMoebliertChf">Initial-Renovationskosten (CHF, 0 falls bereits saniert)</label>
          <input
            id="initialRenovationCostMoebliertChf"
            name="initialRenovationCostMoebliertChf"
            type="number"
            step="500"
            defaultValue={existing?.renovation.initialRenovationCostMoebliertChf ?? 0}
          />
        </div>
        <div className="field">
          <label htmlFor="reinigungServiceMoebliertChfPerYear">Reinigung/Service (CHF/Jahr)</label>
          <input
            id="reinigungServiceMoebliertChfPerYear"
            name="reinigungServiceMoebliertChfPerYear"
            type="number"
            step="50"
            defaultValue={existing?.betriebskosten.reinigungServiceMoebliertChfPerYear ?? 0}
          />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Renovation
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: "0 0 .45rem" }}>
        Initial-Renovationskosten werden je Paket oben erfasst (Paket 1/Paket 2, kurzfristig/möbliert braucht
        oft eine andere Sanierungstiefe als langfristig/unmöbliert) — hier nur noch die Mietwirkung und
        Einzelpositionen fürs 15-Jahres-Modell.
      </p>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="mieteVorRenovationChfPerMonth">
            Miete vor Renovation (CHF/Monat, für Renovation-ROI — leer = Nettomiete Wohnung oben)
          </label>
          <input
            id="mieteVorRenovationChfPerMonth"
            name="mieteVorRenovationChfPerMonth"
            type="number"
            step="10"
            placeholder={String(existing?.miete.wohnungsMieteChfPerMonth ?? wohnungsMiete.value ?? "")}
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
      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: ".4rem 0" }}>
        Nur wertvermehrende Positionen unten erhöhen den angenommenen Immobilienwert im 15-Jahres-Modell — die
        Initial-Renovationskosten je Paket oben fliessen unabhängig davon immer in die Investitionssumme ein, ohne
        Positionen aber ohne Werteffekt beim Exit.
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

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Betriebskosten (CHF/Jahr)
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: "0 0 .45rem" }}>
        Reinigung/Service wird je Paket oben erfasst (Paket 1/Paket 2) — kurzfristig/möbliert braucht typischerweise
        Reinigung zwischen Mietern, langfristig/unmöbliert meist nicht.
      </p>
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
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Eigene Reserven (je CHF/Jahr ODER % vom Kaufpreis — CHF hat Vorrang, leer = Default ~0.30%)
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="reparaturChfPerYear">Reparaturreserve (CHF/Jahr)</label>
          <input id="reparaturChfPerYear" name="reparaturChfPerYear" type="number" step="100" defaultValue={existing?.reserven.reparaturChfPerYear} />
        </div>
        <div className="field">
          <label htmlFor="reparaturPercentOfKaufpreis">Reparaturreserve (% Kaufpreis, Standard: {P.reparaturreservePercentOfKaufpreis})</label>
          <input
            id="reparaturPercentOfKaufpreis"
            name="reparaturPercentOfKaufpreis"
            type="number"
            step="0.05"
            defaultValue={existing?.reserven.reparaturPercentOfKaufpreis ?? (existing?.reserven.reparaturChfPerYear ? undefined : P.reparaturreservePercentOfKaufpreis)}
          />
        </div>
        <div className="field">
          <label htmlFor="leerstandReserveChfPerYear">Leerstandsreserve (CHF/Jahr)</label>
          <input id="leerstandReserveChfPerYear" name="leerstandReserveChfPerYear" type="number" step="100" defaultValue={existing?.reserven.leerstandChfPerYear} />
        </div>
        <div className="field">
          <label htmlFor="leerstandReservePercentOfKaufpreis">Leerstandsreserve (% Kaufpreis, Standard: {P.leerstandsreservePercentOfKaufpreis})</label>
          <input
            id="leerstandReservePercentOfKaufpreis"
            name="leerstandReservePercentOfKaufpreis"
            type="number"
            step="0.05"
            defaultValue={existing?.reserven.leerstandPercentOfKaufpreis ?? (existing?.reserven.leerstandChfPerYear ? undefined : P.leerstandsreservePercentOfKaufpreis)}
          />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Finanzierung &amp; Steuer
      </div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".76rem", margin: "0 0 .45rem" }}>
        1. und 2. Hypothek getrennt erfasst (übliche Schweizer Struktur) — je mit eigener Amortisation, wahlweise als
        Prozentsatz vom ursprünglichen Betrag pro Jahr oder als Zieldauer in Jahren (linear bis 0). Die 1. Hypothek
        bleibt oft unamortisiert, die 2. wird meist über eine feste Dauer getilgt — beide Felder sind aber frei
        wählbar.
      </p>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="ersteHypothekBelehnungPercent">1. Hypothek — Belehnung (%, Standard: {P.ersteHypothekBelehnungPercentDefault})</label>
          <input
            id="ersteHypothekBelehnungPercent"
            name="ersteHypothekBelehnungPercent"
            type="number"
            step="1"
            list="dl-erste-belehnung"
            required
            defaultValue={existing?.hypothek.ersteHypothek.belehnungPercent ?? P.ersteHypothekBelehnungPercentDefault}
          />
        </div>
        <div className="field">
          <label htmlFor="ersteHypothekAmortisationModus">1. Hypothek — Amortisation</label>
          <select
            id="ersteHypothekAmortisationModus"
            name="ersteHypothekAmortisationModus"
            value={ersteAmortisationModus}
            onChange={(e) => setErsteAmortisationModus(e.target.value as AmortisationModus)}
          >
            <option value="PROZENT_PRO_JAHR">Prozentsatz pro Jahr</option>
            <option value="DAUER_JAHRE">Dauer in Jahren</option>
          </select>
        </div>
        {ersteAmortisationModus === "PROZENT_PRO_JAHR" ? (
          <div className="field">
            <label htmlFor="ersteHypothekAmortisationProzentProJahr">1. Hypothek — Amortisation (% p.a.)</label>
            <input
              id="ersteHypothekAmortisationProzentProJahr"
              name="ersteHypothekAmortisationProzentProJahr"
              type="number"
              step="0.1"
              defaultValue={existing?.hypothek.ersteHypothek.amortisation.prozentProJahr ?? 0}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="ersteHypothekAmortisationDauerJahre">1. Hypothek — Amortisationsdauer (Jahre)</label>
            <input
              id="ersteHypothekAmortisationDauerJahre"
              name="ersteHypothekAmortisationDauerJahre"
              type="number"
              step="1"
              defaultValue={existing?.hypothek.ersteHypothek.amortisation.dauerJahre ?? 0}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="zweiteHypothekBelehnungPercent">2. Hypothek — Belehnung (%, Standard: {P.zweiteHypothekBelehnungPercentDefault})</label>
          <input
            id="zweiteHypothekBelehnungPercent"
            name="zweiteHypothekBelehnungPercent"
            type="number"
            step="1"
            list="dl-zweite-belehnung"
            required
            defaultValue={existing?.hypothek.zweiteHypothek.belehnungPercent ?? P.zweiteHypothekBelehnungPercentDefault}
          />
        </div>
        <div className="field">
          <label htmlFor="zweiteHypothekAmortisationModus">2. Hypothek — Amortisation</label>
          <select
            id="zweiteHypothekAmortisationModus"
            name="zweiteHypothekAmortisationModus"
            value={zweiteAmortisationModus}
            onChange={(e) => setZweiteAmortisationModus(e.target.value as AmortisationModus)}
          >
            <option value="PROZENT_PRO_JAHR">Prozentsatz pro Jahr</option>
            <option value="DAUER_JAHRE">Dauer in Jahren</option>
          </select>
        </div>
        {zweiteAmortisationModus === "PROZENT_PRO_JAHR" ? (
          <div className="field">
            <label htmlFor="zweiteHypothekAmortisationProzentProJahr">2. Hypothek — Amortisation (% p.a.)</label>
            <input
              id="zweiteHypothekAmortisationProzentProJahr"
              name="zweiteHypothekAmortisationProzentProJahr"
              type="number"
              step="0.1"
              defaultValue={existing?.hypothek.zweiteHypothek.amortisation.prozentProJahr ?? 0}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="zweiteHypothekAmortisationDauerJahre">2. Hypothek — Amortisationsdauer (Jahre)</label>
            <input
              id="zweiteHypothekAmortisationDauerJahre"
              name="zweiteHypothekAmortisationDauerJahre"
              type="number"
              step="1"
              list="dl-amortisationsdauer"
              defaultValue={existing?.hypothek.zweiteHypothek.amortisation.dauerJahre ?? 15}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="interestRatePercent">Zinssatz (%, für beide Hypotheken, kalkulatorisch, Standard: {P.zinsPercentDefault})</label>
          <input
            id="interestRatePercent"
            name="interestRatePercent"
            type="number"
            step="0.1"
            list="dl-zinssatz"
            required
            defaultValue={existing?.hypothek.interestRatePercent ?? P.zinsPercentDefault}
          />
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

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        15-Jahres-Modell (vorausgefüllt mit Standardwerten, bei Bedarf überschreiben)
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="holdingPeriodYears">Haltedauer (5–30 Jahre, Standard: {P.holdingPeriodYearsDefault})</label>
          <input
            id="holdingPeriodYears"
            name="holdingPeriodYears"
            type="number"
            step="1"
            min="5"
            max="30"
            list="dl-holding-period"
            defaultValue={existing?.mehrjahresmodell.holdingPeriodYears ?? P.holdingPeriodYearsDefault}
          />
        </div>
        <div className="field">
          <label htmlFor="mietsteigerungPercentPerYear">Mietsteigerung (%/Jahr, Standard: {P.mietsteigerungPercentPerYear})</label>
          <input
            id="mietsteigerungPercentPerYear"
            name="mietsteigerungPercentPerYear"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.mietsteigerungPercentPerYear ?? P.mietsteigerungPercentPerYear}
          />
        </div>
        <div className="field">
          <label htmlFor="kosteninflationPercentPerYear">Kosteninflation (%/Jahr, Standard: {P.kosteninflationPercentPerYear})</label>
          <input
            id="kosteninflationPercentPerYear"
            name="kosteninflationPercentPerYear"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.kosteninflationPercentPerYear ?? P.kosteninflationPercentPerYear}
          />
        </div>
        <div className="field">
          <label htmlFor="wertsteigerungPercentPerYear">Wertsteigerung (%/Jahr, Standard: {P.wertsteigerungPercentPerYear})</label>
          <input
            id="wertsteigerungPercentPerYear"
            name="wertsteigerungPercentPerYear"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.wertsteigerungPercentPerYear ?? P.wertsteigerungPercentPerYear}
          />
        </div>
        <div className="field">
          <label htmlFor="sellingCostPercent">Verkaufskosten Exit (%, Standard: {P.sellingCostPercent})</label>
          <input
            id="sellingCostPercent"
            name="sellingCostPercent"
            type="number"
            step="0.1"
            defaultValue={existing?.mehrjahresmodell.sellingCostPercent ?? P.sellingCostPercent}
          />
        </div>
        <div className="field">
          <label htmlFor="grundstueckgewinnsteuerPercent">Grundstückgewinnsteuer (%, optional, grobe Näherung)</label>
          <input id="grundstueckgewinnsteuerPercent" name="grundstueckgewinnsteuerPercent" type="number" step="1" defaultValue={existing?.mehrjahresmodell.grundstueckgewinnsteuerPercent} />
        </div>
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        STWEG
      </div>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="wertquotePromille">Wertquote (‰){wertquote.fromDoc ? ` (aus Dokument: ${wertquote.value})` : ""}</label>
          <input id="wertquotePromille" name="wertquotePromille" type="number" step="1" defaultValue={existing?.stweg.wertquotePromille ?? wertquote.value} />
        </div>
        <div className="field">
          <label htmlFor="erneuerungsfondsSaldoChf">
            Erneuerungsfonds-Saldo (CHF, GESAMT der STWEG){erneuerungsfondsSaldo.fromDoc ? ` (aus Dokument: ${erneuerungsfondsSaldo.value})` : ""}
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
          <label htmlFor="erneuerungsfondsWohnungsanteilChf">
            Erneuerungsfonds-Wohnungsanteil (CHF, nur diese Wohnung, falls bekannt){erneuerungsfondsWohnungsanteil.fromDoc ? ` (aus Dokument: ${erneuerungsfondsWohnungsanteil.value})` : ""}
          </label>
          <input
            id="erneuerungsfondsWohnungsanteilChf"
            name="erneuerungsfondsWohnungsanteilChf"
            type="number"
            step="100"
            defaultValue={existing?.stweg.erneuerungsfondsWohnungsanteilChf ?? erneuerungsfondsWohnungsanteil.value}
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
      <div className="field" style={{ marginTop: ".45rem" }}>
        <div className="checkbox-row">
          <input id="naechsteGrossaSanierungGeplant" name="naechsteGrossaSanierungGeplant" type="checkbox" defaultChecked={existing?.stweg.naechsteGrossaSanierungGeplant ?? false} />
          <label htmlFor="naechsteGrossaSanierungGeplant" style={{ marginBottom: 0 }}>
            Grössere Sanierung geplant/diskutiert (auch vertagte/abgelehnte Vorhaben zählen)
          </label>
        </div>
      </div>
      <div className="field" style={{ marginTop: ".45rem" }}>
        <label htmlFor="naechsteGrossaSanierungNotes">Notizen dazu</label>
        <textarea id="naechsteGrossaSanierungNotes" name="naechsteGrossaSanierungNotes" rows={2} defaultValue={existing?.stweg.naechsteGrossaSanierungNotes} style={{ width: "100%" }} />
      </div>
      <div className="field" style={{ marginTop: ".45rem" }}>
        <label htmlFor="sanierungsstauNotes">Sanierungsstau-Hinweise</label>
        <textarea id="sanierungsstauNotes" name="sanierungsstauNotes" rows={2} defaultValue={existing?.stweg.sanierungsstauNotes} style={{ width: "100%" }} />
      </div>
      <div className="fieldgrid" style={{ marginTop: ".45rem" }}>
        <div className="field">
          <label htmlFor="offeneBeschluesseCount">Offene/strittige Beschlüsse (Anzahl, falls bekannt)</label>
          <input id="offeneBeschluesseCount" name="offeneBeschluesseCount" type="number" step="1" min="0" defaultValue={existing?.stweg.offeneBeschluesseCount} />
        </div>
        <div className="field">
          <label htmlFor="quelle">Quelle (z.B. &quot;Protokoll ordentliche Versammlung 2026-03-12&quot;)</label>
          <input id="quelle" name="quelle" type="text" defaultValue={existing?.stweg.quelle} />
        </div>
      </div>
      <div className="field" style={{ marginTop: ".45rem" }}>
        <label htmlFor="beschlussrisikenNotes">Beschlussrisiken (z.B. Rechtsstreitigkeiten zwischen Eigentümern)</label>
        <textarea id="beschlussrisikenNotes" name="beschlussrisikenNotes" rows={2} defaultValue={existing?.stweg.beschlussrisikenNotes} style={{ width: "100%" }} />
      </div>

      <div className="eyebrow" style={{ marginTop: "1rem", marginBottom: ".4rem" }}>
        Verhandlung
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: ".76rem", margin: "0 0 .45rem" }}>
        Maximum und Zielpreis im Verhandlungskorridor werden rechnerisch hergeleitet (Cashflow-Nullpunkt bzw.
        Renditeziel). Das Eröffnungsangebot dagegen nicht — hier deine eigene, per Marktrecherche bestimmte
        Einschätzung eintragen (z.B. Vergleichsobjekte, Verhandlungsspielraum laut Makler). Leer = wird nicht
        angezeigt.
      </p>
      <div className="fieldgrid">
        <div className="field">
          <label htmlFor="eroeffnungsangebotChf">Eröffnungsangebot — eigene Markteinschätzung (CHF, optional)</label>
          <input id="eroeffnungsangebotChf" name="eroeffnungsangebotChf" type="number" step="1000" defaultValue={existing?.eroeffnungsangebotChf} />
        </div>
      </div>

      <div className="field" style={{ marginTop: "1rem" }}>
        <label htmlFor="notes">Weitere Notizen</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={existing?.notes} style={{ width: "100%" }} />
      </div>
    </>
  );
}
