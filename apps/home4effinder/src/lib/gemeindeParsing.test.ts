import { describe, it, expect } from "vitest";
import { guessGemeindeFromAddress, normalizeGemeinde } from "./gemeindeParsing";

describe("guessGemeindeFromAddress", () => {
  it("extrahiert die Gemeinde aus einer vollständigen Schweizer Adresse (Strasse, PLZ Ort)", () => {
    expect(guessGemeindeFromAddress("Obere Haldenstrasse 42, 5610 Wohlen")).toBe("Wohlen");
  });

  it("extrahiert einen mehrteiligen Ortsnamen", () => {
    expect(guessGemeindeFromAddress("Dorfstrasse 1, 3800 Interlaken-Ost")).toBe("Interlaken-Ost");
  });

  it("liefert undefined ohne PLZ (unvollständige Adresse)", () => {
    expect(guessGemeindeFromAddress("Musterstrasse 1")).toBeUndefined();
  });

  it("liefert undefined bei leerem String", () => {
    expect(guessGemeindeFromAddress("")).toBeUndefined();
  });

  it("nutzt die LETZTE Zahlenfolge im Text als PLZ, falls mehrere Zahlen vorkommen (z.B. Hausnummer davor)", () => {
    expect(guessGemeindeFromAddress("Bollmoosweg 18, 5610 Wohlen")).toBe("Wohlen");
  });

  it("schneidet führende/nachgestellte Leerzeichen weg", () => {
    expect(guessGemeindeFromAddress("  Teststrasse 3, 8000   Zürich  ")).toBe("Zürich");
  });
});

describe("normalizeGemeinde", () => {
  it("macht Gross-/Kleinschreibung und Leerzeichen-Varianten vergleichbar", () => {
    expect(normalizeGemeinde("Wohlen")).toBe(normalizeGemeinde("  wohlen  "));
    expect(normalizeGemeinde("Interlaken-Ost")).toBe(normalizeGemeinde("INTERLAKEN-OST"));
  });

  it("kollabiert mehrfache innere Leerzeichen", () => {
    expect(normalizeGemeinde("Sankt   Gallen")).toBe(normalizeGemeinde("Sankt Gallen"));
  });
});
