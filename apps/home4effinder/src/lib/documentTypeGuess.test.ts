import { describe, expect, it } from "vitest";
import { guessDocumentType } from "./documentTypeGuess";

describe("guessDocumentType", () => {
  it("erkennt reale Dateinamen aus einer echten Objekt-Unterlagenmappe", () => {
    expect(guessDocumentType("AGVPolice_biff_.pdf")).toBe("GEBAEUDEVERSICHERUNG");
    expect(guessDocumentType("Betriebskosten_Wohnung_2024_biff_.pdf")).toBe("NEBENKOSTENABRECHNUNG");
    expect(guessDocumentType("Betriebskosten_Wohnung_2025_2_biff_.pdf")).toBe("NEBENKOSTENABRECHNUNG");
    expect(guessDocumentType("Budget_2026_1_biff_.pdf")).toBe("BUDGET_STWEG");
    expect(guessDocumentType("Grundbuchauszug.pdf")).toBe("GRUNDBUCHAUSZUG");
    expect(guessDocumentType("Grundrisse.pdf")).toBe("GRUNDRISS");
    expect(guessDocumentType("Heiz_und_Betriebskosten_2023_biff_.pdf")).toBe("JAHRESRECHNUNG");
    expect(guessDocumentType("Kapital_und_Zinsausweis_2025_1_biff_.pdf")).toBe("ERNEUERUNGSFONDS");
    expect(guessDocumentType("PDF_Exposé_.pdf")).toBe("EXPOSE_INSERAT");
    expect(guessDocumentType("Protokoll_GV_2024_biff_.pdf")).toBe("STWEG_PROTOKOLL");
    expect(guessDocumentType("Sanierungen_gesamt_1.pdf")).toBe("RENOVATIONSNACHWEIS");
  });

  it("liefert undefined für Dateinamen ohne erkennbaren Bezug statt zu raten", () => {
    expect(guessDocumentType("Katasterplan.pdf")).toBeUndefined();
    expect(guessDocumentType("Kaufangebot.pdf")).toBeUndefined();
    expect(guessDocumentType("scan0042.pdf")).toBeUndefined();
    expect(guessDocumentType("IMG_20260819.pdf")).toBeUndefined();
  });

  it("ist gross-/kleinschreibungs- und akzent-unabhängig", () => {
    expect(guessDocumentType("MIETVERTRAG.PDF")).toBe("MIETVERTRAG");
    expect(guessDocumentType("mietvertrag.pdf")).toBe("MIETVERTRAG");
    expect(guessDocumentType("expose.pdf")).toBe("EXPOSE_INSERAT");
    expect(guessDocumentType("exposé.pdf")).toBe("EXPOSE_INSERAT");
  });

  it("unterscheidet Betriebskosten der Wohnung von der STWEG-Jahresrechnung", () => {
    // "Wohnung" im Namen => individuelle Nebenkostenabrechnung, nicht die STWEG-weite Jahresrechnung.
    expect(guessDocumentType("Betriebskostenabrechnung_Wohnung.pdf")).toBe("NEBENKOSTENABRECHNUNG");
    expect(guessDocumentType("Betriebskostenabrechnung_STWEG.pdf")).toBe("JAHRESRECHNUNG");
  });

  it("erkennt deutsche Flexionsformen über Präfixvergleich", () => {
    expect(guessDocumentType("Sanierung_Fassade.pdf")).toBe("RENOVATIONSNACHWEIS");
    expect(guessDocumentType("Sanierungen_gesamt.pdf")).toBe("RENOVATIONSNACHWEIS");
    expect(guessDocumentType("Versicherungspolice.pdf")).toBe("GEBAEUDEVERSICHERUNG");
  });
});
