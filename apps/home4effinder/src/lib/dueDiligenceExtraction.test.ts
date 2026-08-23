import { describe, it, expect } from "vitest";
import { parseDocumentExtractionResponse, isSupportedDocumentFile, isPdfDocumentFile, buildExtractionToolSchema, resolveExtractionModel } from "./dueDiligenceExtraction";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";
import { CATEGORY_ORDER } from "./dueDiligenceCategories";

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

describe("parseDocumentExtractionResponse — basisdaten", () => {
  it("übernimmt eine vollständige, gültige basisdaten-Angabe", () => {
    const json = JSON.stringify({
      summary: "x",
      facts: {},
      findings: [],
      basisdaten: { adresseText: "Obere Haldenstrasse 42, 5610 Wohlen", kantonCode: "ag", kaufpreisChf: 690000, wohnflaecheM2: 78 },
    });

    const result = parseDocumentExtractionResponse(json, "EXPOSE_INSERAT");

    expect(result.basisdaten).toEqual({
      adresseText: "Obere Haldenstrasse 42, 5610 Wohlen",
      kantonCode: "AG", // wird normalisiert auf Grossbuchstaben
      kaufpreisChf: 690000,
      wohnflaecheM2: 78,
    });
  });

  it("fehlt basisdaten komplett im Ergebnis, wenn das Dokument keine Angaben enthält", () => {
    const result = parseDocumentExtractionResponse(JSON.stringify({ summary: "x", facts: {}, findings: [] }), "SONSTIGES");
    expect(result.basisdaten).toBeUndefined();
  });

  it("verwirft ein unbekanntes Kantonskürzel statt es zu übernehmen", () => {
    const json = JSON.stringify({ summary: "x", facts: {}, findings: [], basisdaten: { kantonCode: "XX", kaufpreisChf: 500000 } });
    const result = parseDocumentExtractionResponse(json, "EXPOSE_INSERAT");
    expect(result.basisdaten).toEqual({ kaufpreisChf: 500000 });
  });

  it("verwirft nicht-positive oder falsch typisierte Werte einzeln, statt basisdaten ganz zu verwerfen", () => {
    const json = JSON.stringify({
      summary: "x",
      facts: {},
      findings: [],
      basisdaten: { adresseText: "", kaufpreisChf: -1, wohnflaecheM2: "78", kantonCode: "ZH" },
    });
    const result = parseDocumentExtractionResponse(json, "EXPOSE_INSERAT");
    expect(result.basisdaten).toEqual({ kantonCode: "ZH" });
  });

  it("liefert basisdaten: undefined statt eines leeren Objekts, wenn kein Feld gültig ist", () => {
    const json = JSON.stringify({ summary: "x", facts: {}, findings: [], basisdaten: { kantonCode: "XX" } });
    const result = parseDocumentExtractionResponse(json, "EXPOSE_INSERAT");
    expect(result.basisdaten).toBeUndefined();
  });
});

describe("resolveExtractionModel", () => {
  it("verwendet Haiku für SONSTIGES-Dokumente", () => {
    expect(resolveExtractionModel("SONSTIGES")).toBe("claude-haiku-4-5-20251001");
  });

  it("verwendet Sonnet 5 für alle anderen Dokumenttypen", () => {
    expect(resolveExtractionModel("STWEG_PROTOKOLL")).toBe("claude-sonnet-5");
    expect(resolveExtractionModel("MIETVERTRAG")).toBe("claude-sonnet-5");
    expect(resolveExtractionModel("EXPOSE_INSERAT")).toBe("claude-sonnet-5");
  });
});

describe("isSupportedDocumentFile / isPdfDocumentFile", () => {
  it("akzeptiert ein PDF anhand des MIME-Typs", () => {
    const file = new File(["%PDF-1.4"], "expose.pdf", { type: "application/pdf" });
    expect(isSupportedDocumentFile(file)).toBe(true);
    expect(isPdfDocumentFile(file)).toBe(true);
  });

  it("akzeptiert ein PDF anhand der Dateiendung, wenn der MIME-Typ fehlt", () => {
    const file = new File(["%PDF-1.4"], "expose.pdf", { type: "" });
    expect(isSupportedDocumentFile(file)).toBe(true);
    expect(isPdfDocumentFile(file)).toBe(true);
  });

  it("akzeptiert eine Text-Datei (eingefügter Text) und erkennt sie NICHT als PDF", () => {
    const file = new File(["Hallo Welt"], "Eingefügter Text.txt", { type: "text/plain" });
    expect(isSupportedDocumentFile(file)).toBe(true);
    expect(isPdfDocumentFile(file)).toBe(false);
  });

  it("lehnt andere Dateitypen ab, z.B. Word-Dokumente", () => {
    const file = new File(["x"], "vertrag.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    expect(isSupportedDocumentFile(file)).toBe(false);
  });
});

describe("buildExtractionToolSchema", () => {
  it("listet exakt die bekannten Dokumenttypen/Kategorien/Severities als enum, damit das Tool-Schema nicht von der übrigen Validierung abweicht", () => {
    const schema = buildExtractionToolSchema();
    const properties = schema.properties as Record<string, unknown>;

    expect(properties.detectedDocumentType).toMatchObject({ enum: Object.keys(DOCUMENT_TYPE_CATALOG) });

    const findingsItems = (properties.findings as { items: { properties: Record<string, unknown> } }).items.properties;
    expect(findingsItems.category).toMatchObject({ enum: CATEGORY_ORDER });
    expect(findingsItems.severity).toMatchObject({ enum: ["OK", "KLAERUNGSBEDARF", "RISIKO"] });
  });

  it("verlangt die vier Pflichtfelder auf oberster Ebene, basisdaten bleibt optional", () => {
    const schema = buildExtractionToolSchema();
    expect(schema.required).toEqual(["detectedDocumentType", "summary", "facts", "findings"]);
  });

  it("das simulierte Tool-Ergebnis (Objekt statt Freitext-JSON) lässt sich unverändert über parseDocumentExtractionResponse validieren", () => {
    const toolInput = {
      detectedDocumentType: "MIETVERTRAG",
      summary: "Mietvertrag mit Nachtrag.",
      facts: { nettomieteChf: 1800 },
      findings: [{ category: "MIETVERHAELTNIS", severity: "OK", summary: "Standardkonditionen" }],
    };
    const result = parseDocumentExtractionResponse(JSON.stringify(toolInput), "MIETVERTRAG");
    expect(result.detectedDocumentType).toBe("MIETVERTRAG");
    expect(result.facts).toEqual({ nettomieteChf: 1800 });
    expect(result.findings).toHaveLength(1);
  });
});
