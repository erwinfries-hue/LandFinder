import { describe, it, expect } from "vitest";
import { buildBestandsrenditeFactsFromFormData } from "./bestandsrenditeFormParsing";
import { parseBestandsrenditeFacts } from "./bestandsrendite";

function formDataFrom(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

describe("buildBestandsrenditeFactsFromFormData", () => {
  it("baut die Pflichtfelder (req) auch ohne Eingabe als 0", () => {
    const facts = buildBestandsrenditeFactsFromFormData(formDataFrom({}), "LANGFRISTIG_UNMOEBLIERT", []);
    expect(facts.parkplatzKaufpreisChf).toBe(0);
    expect(facts.garagenplatzKaufpreisChf).toBe(0);
    expect(facts.hobbyraumKaufpreisChf).toBe(0);
    expect((facts.miete as Record<string, unknown>).wohnungsMieteChfPerMonth).toBe(0);
    expect((facts.miete as Record<string, unknown>).garagenplatzMieteChfPerMonth).toBe(0);
    expect((facts.miete as Record<string, unknown>).hobbyraumMieteChfPerMonth).toBe(0);
  });

  it("lässt optionale Zahlenfelder (num) bei leerer Eingabe undefined", () => {
    const facts = buildBestandsrenditeFactsFromFormData(formDataFrom({}), "LANGFRISTIG_UNMOEBLIERT", []);
    expect(facts.zimmerzahl).toBeUndefined();
    expect(facts.baujahr).toBeUndefined();
  });

  it("rechnet die im Formular als Paket-2-Absolutwert erfasste 'Miete möbliert' in den intern gespeicherten Mietaufschlag um", () => {
    const ohneMoeblierteMiete = buildBestandsrenditeFactsFromFormData(formDataFrom({ wohnungsMieteChfPerMonth: "1450" }), "LANGFRISTIG_UNMOEBLIERT", []);
    expect((ohneMoeblierteMiete.moeblierung as Record<string, unknown>).mietPremiumChfPerMonth).toBe(0); // kein Paket-2-Wert erfasst → kein Aufschlag

    const mitMoeblierterMiete = buildBestandsrenditeFactsFromFormData(
      formDataFrom({ wohnungsMieteChfPerMonth: "1450", moeblierteMieteChfPerMonth: "1750" }),
      "MITTELFRISTIG_MOEBLIERT",
      [],
    );
    expect((mitMoeblierterMiete.moeblierung as Record<string, unknown>).mietPremiumChfPerMonth).toBe(300);
    expect((mitMoeblierterMiete.miete as Record<string, unknown>).wohnungsMieteChfPerMonth).toBe(1450); // Paket 1 bleibt unverändert

    // Möblierte Miete unter der unmöblierten eingetragen (unplausibel) — kein negativer Aufschlag.
    const unterUnmoebliert = buildBestandsrenditeFactsFromFormData(
      formDataFrom({ wohnungsMieteChfPerMonth: "1450", moeblierteMieteChfPerMonth: "1000" }),
      "MITTELFRISTIG_MOEBLIERT",
      [],
    );
    expect((unterUnmoebliert.moeblierung as Record<string, unknown>).mietPremiumChfPerMonth).toBe(0);
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

  it(
    "das Ergebnis lässt sich unverändert über parseBestandsrenditeFacts speichern (Regressionstest: " +
      "amortisationModus war früher fälschlich flach erwartet, buildBestandsrenditeFactsFromFormData " +
      "sendet aber immer verschachtelt unter amortisation — beide Funktionen wurden bisher nur isoliert " +
      "getestet, nie zusammen, siehe DECISIONS.md)",
    () => {
      const facts = buildBestandsrenditeFactsFromFormData(
        formDataFrom({
          wohnungsMieteChfPerMonth: "1450",
          interestRatePercent: "2",
          ersteHypothekBelehnungPercent: "65",
          ersteHypothekAmortisationModus: "PROZENT_PRO_JAHR",
          ersteHypothekAmortisationProzentProJahr: "1",
          zweiteHypothekBelehnungPercent: "5",
          zweiteHypothekAmortisationModus: "DAUER_JAHRE",
          zweiteHypothekAmortisationDauerJahre: "15",
        }),
        "LANGFRISTIG_UNMOEBLIERT",
        [],
      );

      const result = parseBestandsrenditeFacts(facts);

      expect("facts" in result).toBe(true);
      if ("facts" in result) {
        expect(result.facts.hypothek.ersteHypothek.amortisation).toEqual({ modus: "PROZENT_PRO_JAHR", prozentProJahr: 1, dauerJahre: undefined });
        expect(result.facts.hypothek.zweiteHypothek.amortisation).toEqual({ modus: "DAUER_JAHRE", prozentProJahr: undefined, dauerJahre: 15 });
      }
    },
  );
});
