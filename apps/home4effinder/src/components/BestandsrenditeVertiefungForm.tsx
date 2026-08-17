"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel } from "@landfinder/ui";
import type { Vermietungsmodell } from "@landfinder/financial-engine";
import type { BestandsrenditeFacts } from "@/lib/bestandsrendite";

/**
 * Erfassungsmaske für die Bestandsrendite-Fakten (`properties.bestandsrendite`,
 * Migration 0001). Jedes optionale Feld leer gelassen fällt beim Berechnen auf den
 * transparent ausgewiesenen Platzhalter-Default zurück (siehe
 * `computeBestandsrenditeAnalysis`).
 */
export function BestandsrenditeVertiefungForm({ propertyId, existing }: { propertyId: string; existing: BestandsrenditeFacts | null }) {
  const router = useRouter();
  const [vermietungsmodell, setVermietungsmodell] = useState<Vermietungsmodell>(existing?.miete.vermietungsmodell ?? "LANGFRISTIG_UNMOEBLIERT");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const num = (key: string): number | undefined => {
      const raw = form.get(key);
      if (typeof raw !== "string" || raw === "") return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const req = (key: string): number => num(key) ?? 0;

    const facts = {
      zimmerzahl: num("zimmerzahl"),
      baujahr: num("baujahr"),
      parkplatzKaufpreisChf: req("parkplatzKaufpreisChf"),
      stweg: {
        wertquotePromille: num("wertquotePromille"),
        erneuerungsfondsSaldoChf: num("erneuerungsfondsSaldoChf"),
        erneuerungsfondsZielwertChf: num("erneuerungsfondsZielwertChf"),
        naechsteGrossaSanierungGeplant: form.get("naechsteGrossaSanierungGeplant") === "on",
        naechsteGrossaSanierungNotes: String(form.get("naechsteGrossaSanierungNotes") ?? "") || undefined,
        sanierungsstauNotes: String(form.get("sanierungsstauNotes") ?? "") || undefined,
      },
      nebenkosten: {
        handaenderungssteuerPercent: num("handaenderungssteuerPercent"),
        notariatGrundbuchPercent: num("notariatGrundbuchPercent"),
        maklerprovisionPercent: num("maklerprovisionPercent"),
      },
      renovation: { initialRenovationCostChf: req("initialRenovationCostChf"), positionen: existing?.renovation.positionen ?? [] },
      moeblierung: {
        initialCostChf: req("moeblierungInitialCostChf"),
        mietPremiumChfPerMonth: req("mietPremiumChfPerMonth"),
        jaehrlicherErsatzsatzPercent: num("jaehrlicherErsatzsatzPercent"),
        nutzungsdauerJahre: num("moeblierungNutzungsdauerJahre"),
      },
      miete: {
        wohnungsMieteChfPerMonth: req("wohnungsMieteChfPerMonth"),
        parkplatzMieteChfPerMonth: req("parkplatzMieteChfPerMonth"),
        sonstigeEinnahmenChfPerYear: req("sonstigeEinnahmenChfPerYear"),
        vermietungsmodell,
        leerstandPercent: vermietungsmodell !== "SHORT_STAY" ? num("leerstandPercent") : undefined,
        auslastungPercent: vermietungsmodell === "SHORT_STAY" ? num("auslastungPercent") : undefined,
      },
      betriebskosten: {
        stwegAkontobeitragChfPerYear: req("stwegAkontobeitragChfPerYear"),
        eigentuemerkostenChfPerYear: req("eigentuemerkostenChfPerYear"),
        vermietungskostenChfPerYear: req("vermietungskostenChfPerYear"),
        reinigungServiceChfPerYear: req("reinigungServiceChfPerYear"),
      },
      reserven: {
        reparaturChfPerYear: num("reparaturChfPerYear"),
        reparaturPercentOfKaufpreis: num("reparaturPercentOfKaufpreis"),
        leerstandChfPerYear: num("leerstandReserveChfPerYear"),
        leerstandPercentOfKaufpreis: num("leerstandReservePercentOfKaufpreis"),
      },
      hypothek: {
        loanToValuePercent: req("loanToValuePercent"),
        interestRatePercent: req("interestRatePercent"),
        amortisationChfPerYear: req("amortisationChfPerYear"),
      },
      kalkulatorischerSteuersatzPercent: num("kalkulatorischerSteuersatzPercent"),
      mehrjahresmodell: {
        holdingPeriodYears: num("holdingPeriodYears"),
        mietsteigerungPercentPerYear: num("mietsteigerungPercentPerYear"),
        kosteninflationPercentPerYear: num("kosteninflationPercentPerYear"),
        wertsteigerungPercentPerYear: num("wertsteigerungPercentPerYear"),
        sellingCostPercent: num("sellingCostPercent"),
        grundstueckgewinnsteuerPercent: num("grundstueckgewinnsteuerPercent"),
      },
      notes: String(form.get("notes") ?? "") || undefined,
    };

    try {
      const res = await fetch(`/api/properties/${propertyId}/bestandsrendite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facts),
      });
      const body = (await res.json()) as { saved?: boolean; error?: string };
      if (!res.ok || !body.saved) {
        setError(body.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen (Netzwerkfehler).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel style={{ padding: "1.4rem 1.6rem", marginTop: "1.6rem" }}>
      <div className="eyebrow">Bestandsrendite-Fakten{existing ? " — bearbeiten" : " erfassen"}</div>
      <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.4rem 0 1.1rem" }}>
        Nur Miete, Hypothek-Eckwerte und Vermietungsmodell sind Pflicht — alles andere fällt beim Berechnen transparent
        auf einen ausgewiesenen Platzhalter-Wert zurück.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="eyebrow" style={{ marginBottom: ".5rem" }}>
          Objekt
        </div>
        <div className="fieldgrid">
          <div className="field">
            <label htmlFor="zimmerzahl">Zimmerzahl</label>
            <input id="zimmerzahl" name="zimmerzahl" type="number" step="0.5" defaultValue={existing?.zimmerzahl} />
          </div>
          <div className="field">
            <label htmlFor="baujahr">Baujahr</label>
            <input id="baujahr" name="baujahr" type="number" step="1" defaultValue={existing?.baujahr} />
          </div>
          <div className="field">
            <label htmlFor="parkplatzKaufpreisChf">Parkplatz-Kaufpreis (CHF, 0 falls keiner)</label>
            <input id="parkplatzKaufpreisChf" name="parkplatzKaufpreisChf" type="number" step="1000" defaultValue={existing?.parkplatzKaufpreisChf ?? 0} />
          </div>
        </div>

        <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
          Miete &amp; Vermietungsmodell
        </div>
        <div className="fieldgrid">
          <div className="field">
            <label htmlFor="wohnungsMieteChfPerMonth">Nettomiete Wohnung (CHF/Monat)</label>
            <input id="wohnungsMieteChfPerMonth" name="wohnungsMieteChfPerMonth" type="number" step="10" required defaultValue={existing?.miete.wohnungsMieteChfPerMonth} />
          </div>
          <div className="field">
            <label htmlFor="parkplatzMieteChfPerMonth">Miete Parkplatz (CHF/Monat)</label>
            <input id="parkplatzMieteChfPerMonth" name="parkplatzMieteChfPerMonth" type="number" step="10" defaultValue={existing?.miete.parkplatzMieteChfPerMonth ?? 0} />
          </div>
          <div className="field">
            <label htmlFor="sonstigeEinnahmenChfPerYear">Sonstige Einnahmen (CHF/Jahr)</label>
            <input id="sonstigeEinnahmenChfPerYear" name="sonstigeEinnahmenChfPerYear" type="number" step="100" defaultValue={existing?.miete.sonstigeEinnahmenChfPerYear ?? 0} />
          </div>
          <div className="field">
            <label htmlFor="vermietungsmodell">Vermietungsmodell</label>
            <select id="vermietungsmodell" name="vermietungsmodell" value={vermietungsmodell} onChange={(e) => setVermietungsmodell(e.target.value as Vermietungsmodell)}>
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
              <label htmlFor="leerstandPercent">Leerstand (%, leer = Default)</label>
              <input id="leerstandPercent" name="leerstandPercent" type="number" step="0.5" defaultValue={existing?.miete.leerstandPercent} />
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
            <label htmlFor="moeblierungNutzungsdauerJahre">Nutzungsdauer (Jahre, leer = Default)</label>
            <input id="moeblierungNutzungsdauerJahre" name="moeblierungNutzungsdauerJahre" type="number" step="1" defaultValue={existing?.moeblierung.nutzungsdauerJahre} />
          </div>
          <div className="field">
            <label htmlFor="jaehrlicherErsatzsatzPercent">Jährliche Ersatzquote (%, leer = Default)</label>
            <input id="jaehrlicherErsatzsatzPercent" name="jaehrlicherErsatzsatzPercent" type="number" step="1" defaultValue={existing?.moeblierung.jaehrlicherErsatzsatzPercent} />
          </div>
        </div>

        <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
          Renovation
        </div>
        <div className="fieldgrid">
          <div className="field">
            <label htmlFor="initialRenovationCostChf">Initial-Renovationskosten (CHF, 0 falls bereits saniert)</label>
            <input id="initialRenovationCostChf" name="initialRenovationCostChf" type="number" step="500" defaultValue={existing?.renovation.initialRenovationCostChf ?? 0} />
          </div>
        </div>

        <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
          Betriebskosten (CHF/Jahr)
        </div>
        <div className="fieldgrid">
          <div className="field">
            <label htmlFor="stwegAkontobeitragChfPerYear">STWEG-Akontobeitrag</label>
            <input id="stwegAkontobeitragChfPerYear" name="stwegAkontobeitragChfPerYear" type="number" step="100" defaultValue={existing?.betriebskosten.stwegAkontobeitragChfPerYear ?? 0} />
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
            <label htmlFor="reparaturPercentOfKaufpreis">Reparaturreserve (% Kaufpreis)</label>
            <input id="reparaturPercentOfKaufpreis" name="reparaturPercentOfKaufpreis" type="number" step="0.05" defaultValue={existing?.reserven.reparaturPercentOfKaufpreis} />
          </div>
          <div className="field">
            <label htmlFor="leerstandReserveChfPerYear">Leerstandsreserve (CHF/Jahr)</label>
            <input id="leerstandReserveChfPerYear" name="leerstandReserveChfPerYear" type="number" step="100" defaultValue={existing?.reserven.leerstandChfPerYear} />
          </div>
          <div className="field">
            <label htmlFor="leerstandReservePercentOfKaufpreis">Leerstandsreserve (% Kaufpreis)</label>
            <input id="leerstandReservePercentOfKaufpreis" name="leerstandReservePercentOfKaufpreis" type="number" step="0.05" defaultValue={existing?.reserven.leerstandPercentOfKaufpreis} />
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
            <label htmlFor="kalkulatorischerSteuersatzPercent">Kalkulatorischer Steuersatz (%, leer = Default)</label>
            <input id="kalkulatorischerSteuersatzPercent" name="kalkulatorischerSteuersatzPercent" type="number" step="1" defaultValue={existing?.kalkulatorischerSteuersatzPercent} />
          </div>
        </div>

        <div className="eyebrow" style={{ marginTop: "1.4rem", marginBottom: ".5rem" }}>
          15-Jahres-Modell (leer = Default)
        </div>
        <div className="fieldgrid">
          <div className="field">
            <label htmlFor="holdingPeriodYears">Haltedauer (5–30 Jahre)</label>
            <input id="holdingPeriodYears" name="holdingPeriodYears" type="number" step="1" min="5" max="30" defaultValue={existing?.mehrjahresmodell.holdingPeriodYears} />
          </div>
          <div className="field">
            <label htmlFor="mietsteigerungPercentPerYear">Mietsteigerung (%/Jahr)</label>
            <input id="mietsteigerungPercentPerYear" name="mietsteigerungPercentPerYear" type="number" step="0.1" defaultValue={existing?.mehrjahresmodell.mietsteigerungPercentPerYear} />
          </div>
          <div className="field">
            <label htmlFor="kosteninflationPercentPerYear">Kosteninflation (%/Jahr)</label>
            <input id="kosteninflationPercentPerYear" name="kosteninflationPercentPerYear" type="number" step="0.1" defaultValue={existing?.mehrjahresmodell.kosteninflationPercentPerYear} />
          </div>
          <div className="field">
            <label htmlFor="wertsteigerungPercentPerYear">Wertsteigerung (%/Jahr)</label>
            <input id="wertsteigerungPercentPerYear" name="wertsteigerungPercentPerYear" type="number" step="0.1" defaultValue={existing?.mehrjahresmodell.wertsteigerungPercentPerYear} />
          </div>
          <div className="field">
            <label htmlFor="sellingCostPercent">Verkaufskosten Exit (%)</label>
            <input id="sellingCostPercent" name="sellingCostPercent" type="number" step="0.1" defaultValue={existing?.mehrjahresmodell.sellingCostPercent} />
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
            <label htmlFor="wertquotePromille">Wertquote (‰)</label>
            <input id="wertquotePromille" name="wertquotePromille" type="number" step="1" defaultValue={existing?.stweg.wertquotePromille} />
          </div>
          <div className="field">
            <label htmlFor="erneuerungsfondsSaldoChf">Erneuerungsfonds-Saldo (CHF)</label>
            <input id="erneuerungsfondsSaldoChf" name="erneuerungsfondsSaldoChf" type="number" step="1000" defaultValue={existing?.stweg.erneuerungsfondsSaldoChf} />
          </div>
          <div className="field">
            <label htmlFor="erneuerungsfondsZielwertChf">Erneuerungsfonds-Zielwert (CHF, falls bekannt)</label>
            <input id="erneuerungsfondsZielwertChf" name="erneuerungsfondsZielwertChf" type="number" step="1000" defaultValue={existing?.stweg.erneuerungsfondsZielwertChf} />
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

        <div className="field" style={{ marginTop: "1rem" }}>
          <label htmlFor="notes">Weitere Notizen</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={existing?.notes} style={{ width: "100%" }} />
        </div>

        {error ? <p style={{ color: "var(--bad)", fontSize: ".8125rem", marginTop: "1rem" }}>{error}</p> : null}

        <div className="wizard-actions">
          <button type="submit" className="btn" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Speichert…" : existing ? "Änderungen speichern" : "Bestandsrendite speichern"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
