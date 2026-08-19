import { describe, it, expect } from "vitest";
import { buildBestandsrenditeFactsFromFormData } from "./bestandsrenditeFormParsing";

function formDataFrom(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

describe("buildBestandsrenditeFactsFromFormData", () => {
  it("baut die Pflichtfelder (req) auch ohne Eingabe als 0", () => {
    const facts = buildBestandsrenditeFactsFromFormData(formDataFrom({}), "LANGFRISTIG_UNMOEBLIERT", []);
    expect(facts.parkplatzKaufpreisChf).toBe(0);
    expect((facts.miete as Record<string, unknown>).wohnungsMieteChfPerMonth).toBe(0);
  });

  it("lässt optionale Zahlenfelder (num) bei leerer Eingabe undefined", () => {
    const facts = buildBestandsrenditeFactsFromFormData(formDataFrom({}), "LANGFRISTIG_UNMOEBLIERT", []);
    expect(facts.zimmerzahl).toBeUndefined();
    expect(facts.baujahr).toBeUndefined();
  });

  it("übernimmt gesetzte Werte korrekt", () => {
    const facts = buildBestandsrenditeFactsFromFormData(
      formDataFrom({ zimmerzahl: "3.5", baujahr: "1998", wohnungsMieteChfPerMonth: "1450" }),
      "LANGFRISTIG_UNMOEBLIERT",
      [],
    );
    expect(facts.zimmerzahl).toBe(3.5);
    expect(facts.baujahr).toBe(1998);
    expect((facts.miete as Record<string, unknown>).wohnungsMieteChfPerMonth).toBe(1450);
  });

  it("setzt leerstandPercent nur bei Nicht-SHORT_STAY, auslastungPercent nur bei SHORT_STAY", () => {
    const langfristig = buildBestandsrenditeFactsFromFormData(formDataFrom({ leerstandPercent: "3", auslastungPercent: "80" }), "LANGFRISTIG_UNMOEBLIERT", []);
    expect((langfristig.miete as Record<string, unknown>).leerstandPercent).toBe(3);
    expect((langfristig.miete as Record<string, unknown>).auslastungPercent).toBeUndefined();

    const shortStay = buildBestandsrenditeFactsFromFormData(formDataFrom({ leerstandPercent: "3", auslastungPercent: "80" }), "SHORT_STAY", []);
    expect((shortStay.miete as Record<string, unknown>).leerstandPercent).toBeUndefined();
    expect((shortStay.miete as Record<string, unknown>).auslastungPercent).toBe(80);
  });

  it("übernimmt die übergebenen Renovationspositionen unverändert", () => {
    const positionen = [{ betragChf: 5000, kategorie: "WERTVERMEHREND" as const, jahr: 2024, steuerlicheAbzugsfaehigkeit: "NEIN" as const }];
    const facts = buildBestandsrenditeFactsFromFormData(formDataFrom({}), "LANGFRISTIG_UNMOEBLIERT", positionen);
    expect((facts.renovation as Record<string, unknown>).positionen).toEqual(positionen);
  });

  it("wandelt die STWEG-Checkbox 'on' korrekt in true um, sonst false", () => {
    const geplant = buildBestandsrenditeFactsFromFormData(formDataFrom({ naechsteGrossaSanierungGeplant: "on" }), "LANGFRISTIG_UNMOEBLIERT", []);
    expect((geplant.stweg as Record<string, unknown>).naechsteGrossaSanierungGeplant).toBe(true);

    const nichtGeplant = buildBestandsrenditeFactsFromFormData(formDataFrom({}), "LANGFRISTIG_UNMOEBLIERT", []);
    expect((nichtGeplant.stweg as Record<string, unknown>).naechsteGrossaSanierungGeplant).toBe(false);
  });
});
