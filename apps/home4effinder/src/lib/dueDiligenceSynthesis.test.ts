import { describe, it, expect } from "vitest";
import {
  computeMissingDocuments,
  computeOverallStatus,
  parseSynthesisResponse,
  buildSynthesisToolSchema,
  type SynthesisDocumentInput,
  type SynthesisKnownField,
} from "./dueDiligenceSynthesis";
import { CATEGORY_ORDER } from "./dueDiligenceCategories";

describe("computeMissingDocuments", () => {
  it("listet alle 18 Prio-A/B-Typen als fehlend, wenn nichts hochgeladen ist", () => {
    const missing = computeMissingDocuments([]);
    expect(missing).toHaveLength(18);
    expect(missing.some((m) => m.documentType === "SONSTIGES")).toBe(false);
  });

  it("entfernt bereits hochgeladene Typen aus der fehlenden Liste", () => {
    const missing = computeMissingDocuments(["STWEG_PROTOKOLL", "GRUNDBUCHAUSZUG"]);
    expect(missing).toHaveLength(16);
    expect(missing.some((m) => m.documentType === "STWEG_PROTOKOLL")).toBe(false);
    expect(missing.some((m) => m.documentType === "GRUNDBUCHAUSZUG")).toBe(false);
  });

  it("übernimmt die Priorität direkt aus dem Dokumenttyp-Katalog", () => {
    const missing = computeMissingDocuments([]);
    const stwegProtokoll = missing.find((m) => m.documentType === "STWEG_PROTOKOLL")!;
    const sina = missing.find((m) => m.documentType === "SINA")!;
    expect(stwegProtokoll.priority).toBe("ZWINGEND");
    expect(sina.priority).toBe("EMPFOHLEN");
  });
});

describe("computeOverallStatus", () => {
  it("RISIKO gewinnt, wenn irgendeine Kategorie RISIKO ist", () => {
    expect(computeOverallStatus([{ category: "STWEG", status: "OK", findings: [] }, { category: "MIETVERHAELTNIS", status: "RISIKO", findings: [] }])).toBe("RISIKO");
  });

  it("KLAERUNGSBEDARF, wenn keine RISIKO aber mindestens eine KLAERUNGSBEDARF ist", () => {
    expect(computeOverallStatus([{ category: "STWEG", status: "OK", findings: [] }, { category: "MIETVERHAELTNIS", status: "KLAERUNGSBEDARF", findings: [] }])).toBe("KLAERUNGSBEDARF");
  });

  it("OK, wenn alle Kategorien OK sind", () => {
    expect(computeOverallStatus([{ category: "STWEG", status: "OK", findings: [] }])).toBe("OK");
  });

  it("KLAERUNGSBEDARF bei leerer Kategorienliste (nichts geprüft ist kein 'OK')", () => {
    expect(computeOverallStatus([])).toBe("KLAERUNGSBEDARF");
  });
});

const documents: SynthesisDocumentInput[] = [
  { id: "doc-1", filename: "stweg-protokoll-2024.pdf", documentType: "STWEG_PROTOKOLL", summary: "x", facts: {}, findings: [] },
  { id: "doc-2", filename: "grundbuch.pdf", documentType: "GRUNDBUCHAUSZUG", summary: "x", facts: {}, findings: [] },
];
const knownFields: SynthesisKnownField[] = [{ field: "miete.wohnungsMieteChfPerMonth", label: "Nettomiete", currentValue: 1200 }];

describe("parseSynthesisResponse", () => {
  it("parst eine vollständige, gültige Antwort inkl. Auflösung von sourceDocumentId auf den echten Dateinamen", () => {
    const json = JSON.stringify({
      categories: [
        {
          category: "STWEG",
          status: "RISIKO",
          findings: [{ summary: "Liftrevision vertagt", sourceDocumentId: "doc-1", sourcePage: 2, sourceQuote: "…", isContradiction: false }],
        },
      ],
      sellerQuestions: [{ question: "Bitte bestätigen Sie den Sanierungsstand des Lifts." }],
      fieldUpdateProposals: [{ field: "miete.wohnungsMieteChfPerMonth", newValue: 1220, sourceDocumentId: "doc-2", sourcePage: 1 }],
    });

    const result = parseSynthesisResponse(json, documents, knownFields);

    expect(result.overallStatus).toBe("RISIKO");
    expect(result.categories).toHaveLength(CATEGORY_ORDER.length); // die 8 nicht genannten Kategorien werden deterministisch aufgefüllt
    const stweg = result.categories.find((c) => c.category === "STWEG")!;
    expect(stweg.findings[0]).toMatchObject({ sourceDocumentId: "doc-1", sourceDocumentName: "stweg-protokoll-2024.pdf" });
    expect(result.sellerQuestions).toHaveLength(1);
    expect(result.fieldUpdateProposals).toHaveLength(1);
    expect(result.fieldUpdateProposals[0]).toMatchObject({ field: "miete.wohnungsMieteChfPerMonth", newValue: 1220, currentValue: 1200, sourceDocumentName: "grundbuch.pdf" });
    expect(result.missingDocuments.some((m) => m.documentType === "STWEG_PROTOKOLL")).toBe(false); // hochgeladen
    expect(result.missingDocuments.some((m) => m.documentType === "MIETVERTRAG")).toBe(true); // nicht hochgeladen
  });

  it("verwirft ein fieldUpdateProposal mit unbekanntem Feldpfad, statt einen neuen Feldnamen zu erfinden", () => {
    const json = JSON.stringify({
      categories: [],
      sellerQuestions: [],
      fieldUpdateProposals: [{ field: "erfundenes.feld", newValue: 100, sourceDocumentId: "doc-1" }],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.fieldUpdateProposals).toHaveLength(0);
  });

  it("verwirft ein fieldUpdateProposal mit unbekannter sourceDocumentId", () => {
    const json = JSON.stringify({
      categories: [],
      sellerQuestions: [],
      fieldUpdateProposals: [{ field: "miete.wohnungsMieteChfPerMonth", newValue: 100, sourceDocumentId: "unbekannt" }],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.fieldUpdateProposals).toHaveLength(0);
  });

  it("überspringt Findings mit unbekannter sourceDocumentId (kein Beleg statt falschem Beleg)", () => {
    const json = JSON.stringify({
      categories: [{ category: "STWEG", status: "OK", findings: [{ summary: "x", sourceDocumentId: "erfunden" }] }],
      sellerQuestions: [],
      fieldUpdateProposals: [],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    const stweg = result.categories.find((c) => c.category === "STWEG")!;
    expect(stweg.findings[0].sourceDocumentId).toBeUndefined();
  });

  it("überspringt eine Kategorie mit unbekanntem category- oder status-Wert, füllt sie aber deterministisch nach", () => {
    const json = JSON.stringify({
      categories: [
        { category: "ERFUNDENE_KATEGORIE", status: "OK", findings: [] },
        { category: "STWEG", status: "ERFUNDENER_STATUS", findings: [] },
        { category: "MIETVERHAELTNIS", status: "OK", findings: [] },
      ],
      sellerQuestions: [],
      fieldUpdateProposals: [],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.categories).toHaveLength(CATEGORY_ORDER.length);
    expect(result.categories.find((c) => c.category === "MIETVERHAELTNIS")).toMatchObject({ status: "OK" });
    // STWEG wurde wegen ungültigem status verworfen, aber deterministisch nachgefüllt (Dokument dieser Kategorie liegt vor)
    const stweg = result.categories.find((c) => c.category === "STWEG")!;
    expect(stweg.status).toBe("KLAERUNGSBEDARF");
    expect(stweg.findings[0].summary).toContain("keinen gesonderten Befund");
  });
});

describe("parseSynthesisResponse — deterministisches Auffüllen nicht genannter Kategorien", () => {
  it("füllt eine vom LLM ausgelassene Kategorie mit einem 'kein Dokument'-Platzhalter, wenn dafür wirklich nichts hochgeladen wurde", () => {
    const json = JSON.stringify({ categories: [], sellerQuestions: [], fieldUpdateProposals: [] });
    const result = parseSynthesisResponse(json, documents, knownFields);
    // documents enthält weder MIETVERTRAG noch NEBENKOSTENABRECHNUNG → MIETVERHAELTNIS-Kategorie ohne Dokument
    const miete = result.categories.find((c) => c.category === "MIETVERHAELTNIS")!;
    expect(miete.status).toBe("KLAERUNGSBEDARF");
    expect(miete.findings[0].summary).toBe("Für diese Kategorie liegt noch kein Dokument vor.");
  });

  it("verwendet einen anderen Platzhalter, wenn zwar ein Dokument der Kategorie vorliegt, das LLM sie aber ausgelassen hat", () => {
    const json = JSON.stringify({ categories: [], sellerQuestions: [], fieldUpdateProposals: [] });
    const result = parseSynthesisResponse(json, documents, knownFields);
    // documents enthält ein GRUNDBUCHAUSZUG-Dokument → GRUNDBUCH_RECHTE-Kategorie hat ein Dokument, aber keinen Befund vom LLM
    const grundbuch = result.categories.find((c) => c.category === "GRUNDBUCH_RECHTE")!;
    expect(grundbuch.status).toBe("KLAERUNGSBEDARF");
    expect(grundbuch.findings[0].summary).toContain("keinen gesonderten Befund");
  });

  it("füllt alle neun Kategorien auf, wenn das LLM gar keine zurückgibt", () => {
    const json = JSON.stringify({ categories: [], sellerQuestions: [], fieldUpdateProposals: [] });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.categories).toHaveLength(CATEGORY_ORDER.length);
    expect(new Set(result.categories.map((c) => c.category))).toEqual(new Set(CATEGORY_ORDER));
  });
});

describe("buildSynthesisToolSchema", () => {
  it("schränkt fieldUpdateProposals.field strukturell auf die übergebenen bekannten Feldpfade ein", () => {
    const fields: SynthesisKnownField[] = [
      { field: "zimmerzahl", label: "Zimmerzahl" },
      { field: "baujahr", label: "Baujahr" },
    ];
    const schema = buildSynthesisToolSchema(fields);
    const properties = schema.properties as Record<string, unknown>;
    const fieldUpdateProposalsField = (properties.fieldUpdateProposals as { items: { properties: Record<string, unknown> } }).items.properties.field;
    expect(fieldUpdateProposalsField).toMatchObject({ enum: ["zimmerzahl", "baujahr"] });
  });

  it("erlaubt eine leere enum für fieldUpdateProposals.field, wenn keine bekannten Felder übergeben werden", () => {
    const schema = buildSynthesisToolSchema([]);
    const properties = schema.properties as Record<string, unknown>;
    const fieldUpdateProposalsField = (properties.fieldUpdateProposals as { items: { properties: Record<string, unknown> } }).items.properties.field;
    expect(fieldUpdateProposalsField).toMatchObject({ enum: [] });
  });

  it("listet exakt die bekannten Kategorien/Severities als enum", () => {
    const schema = buildSynthesisToolSchema([]);
    const properties = schema.properties as Record<string, unknown>;
    const categoryItems = (properties.categories as { items: { properties: Record<string, unknown> } }).items.properties;
    expect(categoryItems.category).toMatchObject({ enum: CATEGORY_ORDER });
    expect(categoryItems.status).toMatchObject({ enum: ["OK", "KLAERUNGSBEDARF", "RISIKO"] });
  });
});
