"use client";

import type { BestandsrenditeFacts } from "@/lib/bestandsrendite";

/**
 * Kaufpreis-Aufteilung für die drei Nebenkategorien Garage/Aussenparkplatz/Hobbyraum —
 * je Kaufpreis + "im Kaufpreis oben bereits enthalten"-Checkbox. Bewusst OHNE eigenes
 * `<form>` (wie `BestandsrenditeFactsFields`), damit dieselbe Feldmenge sowohl direkt
 * unter "Kaufpreis (Wohnung)" im kombinierten Neu-Erfassen-Flow (`PropertyCreateForm`)
 * als auch im späteren Deep-Dive-Bearbeiten-Formular (`BestandsrenditeVertiefungForm`)
 * verwendet werden kann — dieselben `id`/`name`-Attribute wie zuvor, damit
 * `buildBestandsrenditeFactsFromFormData` unverändert funktioniert. Beide Verwendungen
 * sind eigenständige `<form>`-Elemente, die nie gleichzeitig gemountet sind — kein
 * HTML-`id`/FormData-Konflikt.
 *
 * Rückmeldung: "unter dem Feld Kaufpreis noch [...] Felder Kaufpreis ergänzen — das
 * erste für die Wohnung, das zweite/dritte für Garage/Aussenparkplatz und vierte für
 * Hobbyraum" — Wohnung selbst ist bereits das bestehende `askingPriceChf`-Feld
 * (Objekt-Basisdaten), diese Komponente ergänzt nur die drei übrigen.
 */
export function KaufpreisAufteilungFields({
  existing,
  docProposals,
}: {
  existing: BestandsrenditeFacts | null;
  docProposals?: Record<string, string | number>;
}) {
  function resolved(field: string): { value: number; fromDoc: boolean } {
    const docValue = docProposals?.[field];
    if (typeof docValue === "number") return { value: docValue, fromDoc: true };
    return { value: 0, fromDoc: false };
  }

  const garagenplatzKaufpreisChf = resolved("garagenplatzKaufpreisChf");
  const parkplatzKaufpreisChf = resolved("parkplatzKaufpreisChf");
  const hobbyraumKaufpreisChf = resolved("hobbyraumKaufpreisChf");

  return (
    <>
      <div className="field">
        <label htmlFor="garagenplatzKaufpreisChf">
          Kaufpreis Garage (CHF, {garagenplatzKaufpreisChf.fromDoc ? `aus Dokument: ${garagenplatzKaufpreisChf.value}` : "0 falls keine"})
        </label>
        <input
          id="garagenplatzKaufpreisChf"
          name="garagenplatzKaufpreisChf"
          type="number"
          step="1000"
          defaultValue={existing?.garagenplatzKaufpreisChf ?? garagenplatzKaufpreisChf.value}
        />
      </div>
      <div className="field">
        <label htmlFor="parkplatzKaufpreisChf">
          Kaufpreis Aussenparkplatz (CHF, {parkplatzKaufpreisChf.fromDoc ? `aus Dokument: ${parkplatzKaufpreisChf.value}` : "0 falls keiner"})
        </label>
        <input id="parkplatzKaufpreisChf" name="parkplatzKaufpreisChf" type="number" step="1000" defaultValue={existing?.parkplatzKaufpreisChf ?? parkplatzKaufpreisChf.value} />
      </div>
      <div className="field">
        <label htmlFor="hobbyraumKaufpreisChf">
          Kaufpreis Hobbyraum (CHF, {hobbyraumKaufpreisChf.fromDoc ? `aus Dokument: ${hobbyraumKaufpreisChf.value}` : "0 falls keiner"})
        </label>
        <input id="hobbyraumKaufpreisChf" name="hobbyraumKaufpreisChf" type="number" step="1000" defaultValue={existing?.hobbyraumKaufpreisChf ?? hobbyraumKaufpreisChf.value} />
      </div>
      <div className="field" style={{ gridColumn: "1 / -1", marginTop: existing || docProposals ? 0 : ".2rem" }}>
        <div className="checkbox-row">
          <input id="garagenplatzImKaufpreisEnthalten" name="garagenplatzImKaufpreisEnthalten" type="checkbox" defaultChecked={existing?.garagenplatzImKaufpreisEnthalten ?? false} />
          <label htmlFor="garagenplatzImKaufpreisEnthalten" style={{ marginBottom: 0 }}>
            Garage bereits im Kaufpreis (Wohnung) oben enthalten — sonst wird sie zusätzlich addiert
          </label>
        </div>
        <div className="checkbox-row" style={{ marginTop: ".3rem" }}>
          <input id="parkplatzImKaufpreisEnthalten" name="parkplatzImKaufpreisEnthalten" type="checkbox" defaultChecked={existing?.parkplatzImKaufpreisEnthalten ?? false} />
          <label htmlFor="parkplatzImKaufpreisEnthalten" style={{ marginBottom: 0 }}>
            Aussenparkplatz bereits im Kaufpreis (Wohnung) oben enthalten — sonst wird er zusätzlich addiert
          </label>
        </div>
        <div className="checkbox-row" style={{ marginTop: ".3rem" }}>
          <input id="hobbyraumImKaufpreisEnthalten" name="hobbyraumImKaufpreisEnthalten" type="checkbox" defaultChecked={existing?.hobbyraumImKaufpreisEnthalten ?? false} />
          <label htmlFor="hobbyraumImKaufpreisEnthalten" style={{ marginBottom: 0 }}>
            Hobbyraum bereits im Kaufpreis (Wohnung) oben enthalten — sonst wird er zusätzlich addiert
          </label>
        </div>
      </div>
    </>
  );
}
