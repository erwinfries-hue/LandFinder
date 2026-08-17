import { describe, it, expect } from "vitest";
import { parseDocumentExtractionResponse } from "./dueDiligenceExtraction";

describe("parseDocumentExtractionResponse", () => {
  it("parst eine vollständige, gültige Antwort", () => {
    const json = JSON.stringify({
      detectedDocumentType: "STWEG_PROTOKOLL",
      summary: "Protokoll der ordentlichen Versammlung 2026.",
      facts: { versammlungsdatum: "2026-03-12" },
      findings: [
        { category: "STWEG", severity: "RISIKO", summary: "Liftrevision vertagt", detail: "CHF 7'310, auf Ausführung verzichtet", sourcePage: 2, sourceQuote: "Revision der Antriebswelle … auf Ausführung verzichtet." },
      ],
    });

    const result = parseDocumentExtractionResponse(json, "SONSTIGES");

    expect(result.detectedDocumentType).toBe("STWEG_PROTOKOLL");
    expect(result.summary).toBe("Protokoll der ordentlichen Versammlung 2026.");
    expect(result.facts).toEqual({ versammlungsdatum: "2026-03-12" });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ category: "STWEG", severity: "RISIKO", sourcePage: 2 });
  });

  it("fällt auf den beim Upload gewählten Typ zurück, wenn detectedDocumentType fehlt oder unbekannt ist", () => {
    const result1 = parseDocumentExtractionResponse(JSON.stringify({ summary: "x", facts: {}, findings: [] }), "MIETVERTRAG");
    expect(result1.detectedDocumentType).toBe("MIETVERTRAG");

    const result2 = parseDocumentExtractionResponse(JSON.stringify({ detectedDocumentType: "UNBEKANNTER_TYP", summary: "x", facts: {}, findings: [] }), "MIETVERTRAG");
    expect(result2.detectedDocumentType).toBe("MIETVERTRAG");
  });

  it("überspringt einzelne Findings mit unbekannter Kategorie/Severity statt das ganze Ergebnis zu verwerfen", () => {
    const json = JSON.stringify({
      detectedDocumentType: "MIETVERTRAG",
      summary: "x",
      facts: {},
      findings: [
        { category: "MIETVERHAELTNIS", severity: "OK", summary: "Gültiger Fund" },
        { category: "ERFUNDENE_KATEGORIE", severity: "OK", summary: "Sollte übersprungen werden" },
        { category: "STWEG", severity: "ERFUNDENE_SEVERITY", summary: "Sollte auch übersprungen werden" },
        { category: "STWEG", severity: "RISIKO" }, // fehlendes summary
      ],
    });

    const result = parseDocumentExtractionResponse(json, "SONSTIGES");

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].summary).toBe("Gültiger Fund");
  });

  it("liefert leere summary/facts/findings statt zu werfen, wenn diese Felder fehlen", () => {
    const result = parseDocumentExtractionResponse(JSON.stringify({}), "SONSTIGES");
    expect(result.summary).toBe("");
    expect(result.facts).toEqual({});
    expect(result.findings).toEqual([]);
    expect(result.detectedDocumentType).toBe("SONSTIGES");
  });

  it("wirft, wenn der Text kein gültiges JSON ist (Fehlerbehandlung obliegt dem Aufrufer)", () => {
    expect(() => parseDocumentExtractionResponse("kein json", "SONSTIGES")).toThrow();
  });
});
