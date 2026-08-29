import { describe, it, expect } from "vitest";
import { findUbsWohnattraktivitaet, formatUbsWohnattraktivitaetHinweis, UBS_WOHNATTRAKTIVITAET_2026 } from "./ubsWohnattraktivitaet";

describe("findUbsWohnattraktivitaet", () => {
  it("findet eine TOP3-Gemeinde unabhängig von Gross-/Kleinschreibung", () => {
    const eintrag = findUbsWohnattraktivitaet("AG", "aarau");
    expect(eintrag).toBeDefined();
    expect(eintrag?.kategorie).toBe("TOP3");
    expect(eintrag?.rangInRegion).toBe(1);
    expect(eintrag?.region).toBe("Zürich-Aarau-Schaffhausen");
  });

  it("findet eine Gemeinde mit Klammer-Suffix im UBS-Anzeigenamen über den bereinigten Namen", () => {
    expect(findUbsWohnattraktivitaet("SG", "Wil")?.rangInRegion).toBe(2);
    expect(findUbsWohnattraktivitaet("AR", "Teufen")?.rangInRegion).toBe(3);
  });

  it("findet eine Gemeinde aus den qualitativen Beispielgruppen (ohne Rang)", () => {
    const eintrag = findUbsWohnattraktivitaet("ZH", "Zollikon");
    expect(eintrag?.kategorie).toBe("AGGLOMERATION");
    expect(eintrag?.rangInRegion).toBeUndefined();
  });

  it("liefert undefined bei fehlendem Kanton oder fehlender Gemeinde", () => {
    expect(findUbsWohnattraktivitaet(null, "Aarau")).toBeUndefined();
    expect(findUbsWohnattraktivitaet("AG", null)).toBeUndefined();
    expect(findUbsWohnattraktivitaet(undefined, undefined)).toBeUndefined();
  });

  it("liefert undefined für eine nicht genannte Gemeinde (kein erfundener Wert)", () => {
    expect(findUbsWohnattraktivitaet("ZH", "Zürich")).toBeUndefined();
    expect(findUbsWohnattraktivitaet("BE", "Thun")).toBeUndefined();
  });

  it("verlangt eine Kanton-Übereinstimmung, damit gleichnamige Gemeinden in anderen Kantonen nicht fälschlich matchen", () => {
    expect(findUbsWohnattraktivitaet("VD", "Aarau")).toBeUndefined();
  });
});

describe("formatUbsWohnattraktivitaetHinweis", () => {
  it("formatiert einen TOP3-Eintrag mit Rang und Region", () => {
    const eintrag = findUbsWohnattraktivitaet("AG", "Aarau")!;
    expect(formatUbsWohnattraktivitaetHinweis(eintrag)).toBe(
      "UBS Wohnattraktivitätsindikator 2026: Platz 1 von 3 in der Region Zürich-Aarau-Schaffhausen (Haushalt mit zwei Kindern, Ø-Einkommen).",
    );
  });

  it("formatiert jede Kategorie ohne zu werfen", () => {
    for (const eintrag of UBS_WOHNATTRAKTIVITAET_2026) {
      expect(() => formatUbsWohnattraktivitaetHinweis(eintrag)).not.toThrow();
      expect(formatUbsWohnattraktivitaetHinweis(eintrag).length).toBeGreaterThan(0);
    }
  });
});

describe("UBS_WOHNATTRAKTIVITAET_2026", () => {
  it("enthält genau 3 Ränge je der 10 Regionen (30 TOP3-Einträge)", () => {
    const top3 = UBS_WOHNATTRAKTIVITAET_2026.filter((e) => e.kategorie === "TOP3");
    expect(top3).toHaveLength(30);
    const byRegion = new Map<string, number[]>();
    for (const e of top3) byRegion.set(e.region!, [...(byRegion.get(e.region!) ?? []), e.rangInRegion!]);
    expect(byRegion.size).toBe(10);
    for (const [, raenge] of byRegion) expect(raenge.sort()).toEqual([1, 2, 3]);
  });
});
