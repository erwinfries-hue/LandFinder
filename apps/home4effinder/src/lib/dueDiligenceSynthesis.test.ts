import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeMissingDocuments,
  computeOverallStatus,
  parseSynthesisResponse,
  parseSynthesisBatchResponse,
  buildSynthesisToolSchema,
  compactFindingsForPrompt,
  selectSynthesisPromptDocuments,
  splitDocumentsIntoBatches,
  mergeDueDiligenceBatches,
  synthesizeDueDiligence,
  synthesizeDueDiligenceBatch,
  MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT,
  MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT,
  SYNTHESIS_BATCH_SIZE,
  type SynthesisDocumentInput,
  type SynthesisKnownField,
  type PartialSynthesisResult,
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

  it(`deckelt auf höchstens ${MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT} Dokumente, ZWINGEND vor EMPFOHLEN, Upload-Reihenfolge bei gleicher Priorität`, () => {
    const zwingend: SynthesisDocumentInput[] = ["STWEG_PROTOKOLL", "JAHRESRECHNUNG", "BUDGET_STWEG", "ERNEUERUNGSFONDS", "STWEG_REGLEMENT"].map((t, i) => ({
      id: `z${i}`,
      filename: `${t}.pdf`,
      documentType: t as SynthesisDocumentInput["documentType"],
      summary: "x",
      facts: {},
      findings: [],
    }));
    const empfohlen: SynthesisDocumentInput[] = ["GEBAEUDEVERSICHERUNG", "HEIZUNG_SERVICE", "ENERGIEAUSWEIS", "SINA", "RENOVATIONSNACHWEIS"].map((t, i) => ({
      id: `e${i}`,
      filename: `${t}.pdf`,
      documentType: t as SynthesisDocumentInput["documentType"],
      summary: "x",
      facts: {},
      findings: [],
    }));
    const result = selectSynthesisPromptDocuments([...zwingend, ...empfohlen]);

    expect(result).toHaveLength(MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT);
    expect(result.slice(0, 5).map((d) => d.id)).toEqual(["z0", "z1", "z2", "z3", "z4"]);
    expect(result.slice(5).map((d) => d.id)).toEqual(["e0", "e1", "e2"]);
  });

  it("wendet die Obergrenze NICHT an, wenn genau so viele oder weniger Dokumente übrig bleiben", () => {
    const docs: SynthesisDocumentInput[] = Array.from({ length: MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT }, (_, i) => ({
      id: `d${i}`,
      filename: `d${i}.pdf`,
      documentType: "GRUNDBUCHAUSZUG",
      summary: "x",
      facts: {},
      findings: [],
    }));
    expect(selectSynthesisPromptDocuments(docs)).toHaveLength(MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT);
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

describe("splitDocumentsIntoBatches", () => {
  function makeDocs(n: number): SynthesisDocumentInput[] {
    return Array.from({ length: n }, (_, i) => ({ id: `d${i}`, filename: `d${i}.pdf`, documentType: "GRUNDBUCHAUSZUG", summary: "x", facts: {}, findings: [] }));
  }

  it("liefert eine leere Liste bei 0 Dokumenten", () => {
    expect(splitDocumentsIntoBatches([])).toEqual([]);
  });

  it(`bildet genau einen Batch bei ≤${SYNTHESIS_BATCH_SIZE} Dokumenten (unverändertes Verhalten für die meisten Objekte)`, () => {
    expect(splitDocumentsIntoBatches(makeDocs(1))).toHaveLength(1);
    expect(splitDocumentsIntoBatches(makeDocs(SYNTHESIS_BATCH_SIZE))).toHaveLength(1);
  });

  it(`bildet mehrere Batches zu je höchstens ${SYNTHESIS_BATCH_SIZE} Dokumenten, letzter Batch kleiner`, () => {
    const batches = splitDocumentsIntoBatches(makeDocs(4));
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(SYNTHESIS_BATCH_SIZE);
    expect(batches[1]).toHaveLength(1);
  });

  it(`bildet 3 Batches bei ${MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT} Dokumenten (nach der Deckelung durch selectSynthesisPromptDocuments)`, () => {
    const batches = splitDocumentsIntoBatches(makeDocs(MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT));
    expect(batches.map((b) => b.length)).toEqual([3, 3, 2]);
  });
});

describe("parseSynthesisBatchResponse", () => {
  it("gibt NUR die vom LLM genannten Kategorien zurück, ohne deterministische Auffüllung (passiert erst beim Merge)", () => {
    const json = JSON.stringify({ categories: [{ category: "STWEG", status: "OK", findings: [] }], sellerQuestions: [], fieldUpdateProposals: [], contradictions: [] });
    const result = parseSynthesisBatchResponse(json, documents, knownFields);
    expect(result.categories).toHaveLength(1);
  });

  it("löst sourceDocumentId auch für ein Dokument auf, das nur als Quervergleichs-Kontext (nicht als Fokus) übergeben wurde", () => {
    const json = JSON.stringify({
      categories: [{ category: "STWEG", status: "OK", findings: [{ summary: "x", sourceDocumentId: "doc-2" }] }],
      sellerQuestions: [],
      fieldUpdateProposals: [],
      contradictions: [],
    });
    const result = parseSynthesisBatchResponse(json, documents, knownFields);
    const stweg = result.categories.find((c) => c.category === "STWEG")!;
    expect(stweg.findings[0]).toMatchObject({ sourceDocumentId: "doc-2", sourceDocumentName: "grundbuch.pdf" });
  });

  it("liefert kein overallStatus/missingDocuments (Teilergebnis, kein vollständiges DueDiligenceResult)", () => {
    const json = JSON.stringify({ categories: [], sellerQuestions: [], fieldUpdateProposals: [], contradictions: [] });
    const result = parseSynthesisBatchResponse(json, documents, knownFields);
    expect(result).not.toHaveProperty("overallStatus");
    expect(result).not.toHaveProperty("missingDocuments");
  });
});

describe("mergeDueDiligenceBatches", () => {
  const docA: SynthesisDocumentInput = { id: "a", filename: "a.pdf", documentType: "STWEG_PROTOKOLL", summary: "x", facts: {}, findings: [] };
  const docB: SynthesisDocumentInput = { id: "b", filename: "b.pdf", documentType: "MIETVERTRAG", summary: "x", facts: {}, findings: [] };

  function partial(overrides: Partial<PartialSynthesisResult> = {}): PartialSynthesisResult {
    return { overallSummary: "", categories: [], sellerQuestions: [], fieldUpdateProposals: [], contradictions: [], ...overrides };
  }

  it("legt Funde derselben Kategorie aus mehreren Batches zusammen", () => {
    const batch1 = partial({ categories: [{ category: "STWEG", status: "OK", findings: [{ category: "STWEG", severity: "OK", summary: "Fund 1" }] }] });
    const batch2 = partial({ categories: [{ category: "STWEG", status: "OK", findings: [{ category: "STWEG", severity: "OK", summary: "Fund 2" }] }] });
    const result = mergeDueDiligenceBatches([batch1, batch2], [docA, docB]);
    const stweg = result.categories.find((c) => c.category === "STWEG")!;
    expect(stweg.findings.map((f) => f.summary)).toEqual(["Fund 1", "Fund 2"]);
  });

  it("lässt den schlechteren (schwerwiegenderen) Status gewinnen, wenn zwei Batches für dieselbe Kategorie unterschiedliche Status liefern", () => {
    const batch1 = partial({ categories: [{ category: "STWEG", status: "OK", findings: [] }] });
    const batch2 = partial({ categories: [{ category: "STWEG", status: "RISIKO", findings: [] }] });
    const result = mergeDueDiligenceBatches([batch1, batch2], [docA, docB]);
    expect(result.categories.find((c) => c.category === "STWEG")!.status).toBe("RISIKO");
  });

  it("behält verschiedene Kategorien aus verschiedenen Batches jeweils vollständig", () => {
    const batch1 = partial({ categories: [{ category: "STWEG", status: "OK", findings: [] }] });
    const batch2 = partial({ categories: [{ category: "MIETVERHAELTNIS", status: "KLAERUNGSBEDARF", findings: [] }] });
    const result = mergeDueDiligenceBatches([batch1, batch2], [docA, docB]);
    expect(result.categories.find((c) => c.category === "STWEG")).toMatchObject({ status: "OK" });
    expect(result.categories.find((c) => c.category === "MIETVERHAELTNIS")).toMatchObject({ status: "KLAERUNGSBEDARF" });
  });

  it("füllt Kategorien, zu denen kein Batch etwas beitrug, deterministisch auf — wie beim bisherigen Einzel-Call", () => {
    const result = mergeDueDiligenceBatches([partial()], [docA, docB]);
    expect(result.categories).toHaveLength(CATEGORY_ORDER.length);
  });

  it("hängt sellerQuestions/fieldUpdateProposals/contradictions aus allen Batches aneinander", () => {
    const batch1 = partial({ sellerQuestions: [{ question: "Frage 1" }] });
    const batch2 = partial({ sellerQuestions: [{ question: "Frage 2" }] });
    const result = mergeDueDiligenceBatches([batch1, batch2], [docA, docB]);
    expect(result.sellerQuestions.map((q) => q.question)).toEqual(["Frage 1", "Frage 2"]);
  });

  it("verbindet nicht-leere overallSummary-Texte der Batches mit einer Leerzeile, lässt leere weg", () => {
    const batch1 = partial({ overallSummary: "Erster Teil." });
    const batch2 = partial({ overallSummary: "" });
    const batch3 = partial({ overallSummary: "Dritter Teil." });
    const result = mergeDueDiligenceBatches([batch1, batch2, batch3], [docA, docB]);
    expect(result.overallSummary).toBe("Erster Teil.\n\nDritter Teil.");
  });

  it("berechnet missingDocuments aus der VOLLSTÄNDIGEN Dokumentenliste, nicht nur den in Batches enthaltenen", () => {
    const result = mergeDueDiligenceBatches([partial()], [docA, docB]);
    expect(result.missingDocuments.some((m) => m.documentType === "STWEG_PROTOKOLL")).toBe(false);
    expect(result.missingDocuments.some((m) => m.documentType === "MIETVERTRAG")).toBe(false);
    expect(result.missingDocuments.some((m) => m.documentType === "GRUNDBUCHAUSZUG")).toBe(true);
  });

  it("verhält sich bei genau einem Batch wie das bisherige Einzel-Call-Auffüllverhalten", () => {
    const batch = partial({ overallSummary: "Zusammenfassung", categories: [{ category: "STWEG", status: "RISIKO", findings: [] }] });
    const result = mergeDueDiligenceBatches([batch], [docA, docB]);
    expect(result.overallStatus).toBe("RISIKO");
    expect(result.overallSummary).toBe("Zusammenfassung");
    expect(result.categories).toHaveLength(CATEGORY_ORDER.length);
  });
});

describe("synthesizeDueDiligenceBatch — otherDocuments als reiner Fakten-Quervergleichskontext", () => {
  function toolUseResponse(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: "emit_due_diligence_synthesis", input: { overallSummary: "", categories: [], sellerQuestions: [], fieldUpdateProposals: [], contradictions: [], ...overrides } }],
    };
  }

  beforeEach(() => {
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("übergibt otherDocuments nur mit Fakten — nicht mit summary/findings — als Quervergleichs-Kontext im Prompt", async () => {
    createMock.mockResolvedValue(toolUseResponse());
    const focus: SynthesisDocumentInput = { id: "focus-1", filename: "focus.pdf", documentType: "STWEG_PROTOKOLL", summary: "Fokus-Zusammenfassung", facts: { baujahr: 1990 }, findings: [] };
    const other: SynthesisDocumentInput = {
      id: "other-1",
      filename: "other.pdf",
      documentType: "GRUNDBUCHAUSZUG",
      summary: "GEHEIME Zusammenfassung des anderen Dokuments",
      facts: { flaeche: 80 },
      findings: [],
    };

    await synthesizeDueDiligenceBatch([focus], [other], [], []);

    const system = createMock.mock.calls[0][0].system as string;
    expect(system).toContain("WEITERE, BEREITS ANALYSIERTE DOKUMENTE");
    expect(system).toContain('"flaeche":80');
    expect(system).not.toContain("GEHEIME Zusammenfassung");
  });

  it("lässt den Quervergleichs-Abschnitt ganz weg, wenn keine otherDocuments übergeben werden", async () => {
    createMock.mockResolvedValue(toolUseResponse());
    await synthesizeDueDiligenceBatch(documents, [], [], knownFields);
    const system = createMock.mock.calls[0][0].system as string;
    expect(system).not.toContain("WEITERE, BEREITS ANALYSIERTE DOKUMENTE");
  });

  it("löst sourceDocumentId aus einem otherDocuments-Fund korrekt auf den Dateinamen auf", async () => {
    const other: SynthesisDocumentInput = { id: "other-1", filename: "grundbuch-other.pdf", documentType: "GRUNDBUCHAUSZUG", summary: "x", facts: {}, findings: [] };
    createMock.mockResolvedValue(
      toolUseResponse({ categories: [{ category: "STWEG", status: "OK", findings: [{ summary: "Quervergleich", sourceDocumentId: "other-1" }] }] }),
    );
    const focus: SynthesisDocumentInput = { id: "focus-1", filename: "focus.pdf", documentType: "STWEG_PROTOKOLL", summary: "x", facts: {}, findings: [] };

    const result = await synthesizeDueDiligenceBatch([focus], [other], [], []);

    const stweg = result.categories.find((c) => c.category === "STWEG")!;
    expect(stweg.findings[0]).toMatchObject({ sourceDocumentId: "other-1", sourceDocumentName: "grundbuch-other.pdf" });
  });
});
