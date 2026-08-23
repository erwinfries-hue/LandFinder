import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeMissingDocuments,
  computeOverallStatus,
  parseSynthesisResponse,
  buildSynthesisToolSchema,
  compactFindingsForPrompt,
  selectSynthesisPromptDocuments,
  synthesizeDueDiligence,
  MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT,
  type SynthesisDocumentInput,
  type SynthesisKnownField,
} from "./dueDiligenceSynthesis";
import { CATEGORY_ORDER } from "./dueDiligenceCategories";
import type { DueDiligenceFinding } from "@landfinder/domain";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

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
const knownFields: SynthesisKnownField[] = [
  { field: "miete.wohnungsMieteChfPerMonth", label: "Nettomiete", currentValue: 1200 },
  { field: "zimmerzahl", label: "Zimmerzahl" },
];

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

describe("parseSynthesisResponse — contradictions", () => {
  it("parst einen vollständigen Widerspruch inkl. Auflösung von sourceDocumentId auf den echten Dateinamen", () => {
    const json = JSON.stringify({
      categories: [],
      sellerQuestions: [],
      fieldUpdateProposals: [],
      contradictions: [
        {
          topic: "Zimmerzahl",
          category: "DOKUMENTENVOLLSTAENDIGKEIT",
          field: "zimmerzahl",
          options: [
            { value: 3.5, sourceDocumentId: "doc-1", sourcePage: 1, sourceQuote: "3.5-Zimmerwohnung" },
            { value: 4, sourceDocumentId: "doc-2" },
          ],
        },
      ],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.contradictions).toHaveLength(1);
    expect(result.contradictions[0]).toMatchObject({ topic: "Zimmerzahl", field: "zimmerzahl" });
    expect(result.contradictions[0].options).toHaveLength(2);
    expect(result.contradictions[0].options[0]).toMatchObject({ value: 3.5, sourceDocumentName: "stweg-protokoll-2024.pdf", sourcePage: 1 });
    expect(result.contradictions[0].options[1]).toMatchObject({ value: 4, sourceDocumentName: "grundbuch.pdf" });
  });

  it("lässt field weg, wenn es keinem bekannten Feldpfad entspricht — bleibt informativ statt erfundenen Feldnamen zu tragen", () => {
    const json = JSON.stringify({
      categories: [],
      sellerQuestions: [],
      fieldUpdateProposals: [],
      contradictions: [{ topic: "Sanierungsstatus", category: "STWEG", field: "erfundenes.feld", options: [{ value: "beschlossen", sourceDocumentId: "doc-1" }, { value: "abgelehnt", sourceDocumentId: "doc-2" }] }],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.contradictions[0].field).toBeUndefined();
  });

  it("verwirft einen Widerspruch mit weniger als zwei Optionen", () => {
    const json = JSON.stringify({
      categories: [],
      sellerQuestions: [],
      fieldUpdateProposals: [],
      contradictions: [{ topic: "Zimmerzahl", category: "DOKUMENTENVOLLSTAENDIGKEIT", options: [{ value: 3.5, sourceDocumentId: "doc-1" }] }],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.contradictions).toHaveLength(0);
  });

  it("verwirft einen Widerspruch mit unbekannter category, statt eine erfundene Kategorie zu übernehmen", () => {
    const json = JSON.stringify({
      categories: [],
      sellerQuestions: [],
      fieldUpdateProposals: [],
      contradictions: [{ topic: "x", category: "ERFUNDENE_KATEGORIE", options: [{ value: 1, sourceDocumentId: "doc-1" }, { value: 2, sourceDocumentId: "doc-2" }] }],
    });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.contradictions).toHaveLength(0);
  });

  it("liefert eine leere contradictions-Liste, wenn das Feld im Antwort-JSON fehlt", () => {
    const json = JSON.stringify({ categories: [], sellerQuestions: [], fieldUpdateProposals: [] });
    const result = parseSynthesisResponse(json, documents, knownFields);
    expect(result.contradictions).toEqual([]);
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

  it("schränkt contradictions.field ebenfalls auf die übergebenen bekannten Feldpfade ein", () => {
    const fields: SynthesisKnownField[] = [{ field: "zimmerzahl", label: "Zimmerzahl" }];
    const schema = buildSynthesisToolSchema(fields);
    const properties = schema.properties as Record<string, unknown>;
    const contradictionItems = (properties.contradictions as { items: { properties: Record<string, unknown> } }).items.properties;
    expect(contradictionItems.field).toMatchObject({ enum: ["zimmerzahl"] });
    expect(contradictionItems.category).toMatchObject({ enum: CATEGORY_ORDER });
  });
});

describe("selectSynthesisPromptDocuments", () => {
  it("filtert SONSTIGES-Dokumente heraus, wenn andere Dokumente übrig bleiben", () => {
    const docs: SynthesisDocumentInput[] = [
      { id: "1", filename: "stweg.pdf", documentType: "STWEG_PROTOKOLL", summary: "x", facts: {}, findings: [] },
      { id: "2", filename: "kaufangebot.pdf", documentType: "SONSTIGES", summary: "x", facts: {}, findings: [] },
    ];
    const result = selectSynthesisPromptDocuments(docs);
    expect(result).toHaveLength(1);
    expect(result[0].documentType).toBe("STWEG_PROTOKOLL");
  });

  it("behält alle Dokumente, wenn ausschliesslich SONSTIGES hochgeladen wurde (kein leerer Prompt)", () => {
    const docs: SynthesisDocumentInput[] = [
      { id: "1", filename: "a.pdf", documentType: "SONSTIGES", summary: "x", facts: {}, findings: [] },
      { id: "2", filename: "b.pdf", documentType: "SONSTIGES", summary: "x", facts: {}, findings: [] },
    ];
    const result = selectSynthesisPromptDocuments(docs);
    expect(result).toHaveLength(2);
  });

  it("lässt eine Liste ohne SONSTIGES-Dokumente unverändert", () => {
    const docs: SynthesisDocumentInput[] = [{ id: "1", filename: "a.pdf", documentType: "GRUNDBUCHAUSZUG", summary: "x", facts: {}, findings: [] }];
    expect(selectSynthesisPromptDocuments(docs)).toEqual(docs);
  });
});

describe("compactFindingsForPrompt", () => {
  const baseFinding: DueDiligenceFinding = { category: "STWEG", severity: "OK", summary: "Basis" };

  it("entfernt detail/sourceQuote, behält category/severity/summary/sourcePage/isContradiction", () => {
    const findings: DueDiligenceFinding[] = [
      { ...baseFinding, detail: "Lange Begründung…", sourceQuote: "wörtliches Zitat", sourcePage: 3, isContradiction: true },
    ];
    const compact = compactFindingsForPrompt(findings) as Record<string, unknown>[];
    expect(compact[0]).toEqual({ category: "STWEG", severity: "OK", summary: "Basis", sourcePage: 3, isContradiction: true });
  });

  it("sortiert nach Schwere: RISIKO vor KLAERUNGSBEDARF vor OK", () => {
    const findings: DueDiligenceFinding[] = [
      { ...baseFinding, severity: "OK", summary: "ok" },
      { ...baseFinding, severity: "RISIKO", summary: "risiko" },
      { ...baseFinding, severity: "KLAERUNGSBEDARF", summary: "klaerung" },
    ];
    const compact = compactFindingsForPrompt(findings) as { summary: string }[];
    expect(compact.map((f) => f.summary)).toEqual(["risiko", "klaerung", "ok"]);
  });

  it(`deckelt auf die wichtigsten ${MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT} Funde, wenn mehr vorhanden sind`, () => {
    const findings: DueDiligenceFinding[] = Array.from({ length: MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT + 5 }, (_, i) => ({
      ...baseFinding,
      severity: i < 3 ? "RISIKO" : "OK",
      summary: `finding-${i}`,
    }));
    const compact = compactFindingsForPrompt(findings);
    expect(compact).toHaveLength(MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT);
    // die drei RISIKO-Funde müssen trotz Deckelung enthalten sein (nach Schwere sortiert)
    const summaries = (compact as { summary: string }[]).map((f) => f.summary);
    expect(summaries.slice(0, 3)).toEqual(["finding-0", "finding-1", "finding-2"]);
  });
});

describe("synthesizeDueDiligence — Sonnet-5-Zeitlimit mit Haiku-4.5-Rückfalloption", () => {
  const TOOL_NAME = "emit_due_diligence_synthesis";
  function toolUseResponse(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: TOOL_NAME, input: { categories: [], sellerQuestions: [], fieldUpdateProposals: [], contradictions: [], ...overrides } }],
    };
  }

  beforeEach(() => {
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("verwendet das Sonnet-5-Ergebnis, wenn es rechtzeitig antwortet — kein Haiku-Aufruf", async () => {
    createMock.mockResolvedValue(toolUseResponse({ overallSummary: "von Sonnet" }));

    const result = await synthesizeDueDiligence(documents, [], knownFields);

    expect(result.overallSummary).toBe("von Sonnet");
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({ model: "claude-sonnet-5" });
  });

  it("wechselt auf Haiku 4.5, wenn Sonnet 5 nicht innert des Zeitbudgets antwortet", async () => {
    vi.useFakeTimers();
    createMock.mockImplementation((params: { model: string }) => {
      if (params.model === "claude-sonnet-5") return new Promise(() => {}); // hängt absichtlich, wie ein zu langsamer Live-Aufruf
      return Promise.resolve(toolUseResponse({ overallSummary: "von Haiku" }));
    });

    const resultPromise = synthesizeDueDiligence(documents, [], knownFields);
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await resultPromise;

    expect(result.overallSummary).toBe("von Haiku");
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[1][0]).toMatchObject({ model: "claude-haiku-4-5-20251001" });
  });
});
