import Anthropic from "@anthropic-ai/sdk";
import type {
  DueDiligenceCategory,
  DueDiligenceCategoryResult,
  DueDiligenceContradiction,
  DueDiligenceContradictionOption,
  DueDiligenceDocumentType,
  DueDiligenceFieldUpdateProposal,
  DueDiligenceFinding,
  DueDiligenceMissingDocument,
  DueDiligenceResult,
  DueDiligenceSellerQuestion,
  DueDiligenceSeverity,
} from "@landfinder/domain";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";
import { CATEGORY_ORDER } from "./dueDiligenceCategories";
import { AnthropicNotConfiguredError } from "./dueDiligenceExtraction";

/**
 * Stufe 2 der Dokumenten-KI (apps/home4effinder/docs/DECISIONS.md): Synthese über alle
 * bereits einzeln extrahierten Dokumente eines Objekts hinweg — Widersprüche
 * erkennen, Risiken/Kategorie-Status bilden, fehlende Dokumente auflisten,
 * Verkäufer-/Maklerfragen generieren, Feldwert-Übernahmevorschläge machen. Arbeitet
 * bewusst mit den bereits strukturierten Stufe-1-Extraktionen (JSON), nicht mit den
 * rohen PDFs erneut — güstiger und die einzelnen Dokument-Fakten sind bereits
 * vertrauenswürdig belegt (Seite/Zitat).
 *
 * "Missing Documents" wird bewusst NICHT vom LLM erraten, sondern deterministisch aus
 * dem Dokumenttyp-Katalog berechnet (`computeMissingDocuments`) — zuverlässiger als
 * eine Vermutung, und die Priorität (zwingend/empfohlen/optional) kommt direkt aus der
 * Produktvorgabe. Ebenso wird `overallStatus` deterministisch aus den
 * Kategorie-Status abgeleitet (`computeOverallStatus`), nicht vom LLM selbst
 * aggregiert.
 */

export interface SynthesisDocumentInput {
  id: string;
  filename: string;
  documentType: DueDiligenceDocumentType;
  summary: string;
  facts: Record<string, unknown>;
  findings: DueDiligenceFinding[];
}

/** Bereits bekannte Objekt-/Bestandsrendite-Fakten, gegen die das LLM Widersprüche prüfen kann — bewusst flach/generisch, damit dieses Modul nicht an die genaue Form von BestandsrenditeFacts gekoppelt ist. */
export interface SynthesisKnownFact {
  label: string;
  value: string | number;
}

/** Feldpfade, die das LLM für Feldwert-Übernahmevorschläge referenzieren darf — nur diese werden beim Parsen akzeptiert. */
export interface SynthesisKnownField {
  field: string;
  label: string;
  currentValue?: string | number;
}

export function computeMissingDocuments(uploadedTypes: DueDiligenceDocumentType[]): DueDiligenceMissingDocument[] {
  const uploaded = new Set(uploadedTypes);
  const missing: DueDiligenceMissingDocument[] = [];
  for (const config of Object.values(DOCUMENT_TYPE_CATALOG)) {
    if (config.type === "SONSTIGES" || uploaded.has(config.type)) continue;
    missing.push({ documentType: config.type, priority: config.priority, note: config.description });
  }
  return missing;
}

/**
 * Wählt die Dokumente aus, die dem LLM für die Synthese tatsächlich vorgelegt werden.
 * SONSTIGES-Dokumente (keiner bekannten Due-Diligence-Kategorie zugeordnet, z.B.
 * Kaufangebot/Finanzierungsbestätigung/Antrag/Katasterplan) tragen praktisch nie zu den
 * bekannten Bestandsrendite-Feldern oder Kategorien bei, blähen den Prompt bei vielen
 * hochgeladenen Dokumenten aber spürbar auf — wiederholt Ursache dafür, dass die Synthese
 * Vercels 60-Sekunden-Zeitlimit überschritt (siehe docs/DECISIONS.md). Zentral hier statt
 * nur beim Aufrufer gefiltert, damit sowohl die Prefill-Synthese im Neu-Erfassen-Flow als
 * auch "Due-Diligence aktualisieren" auf der Objektseite profitieren. Nur wirksam, wenn
 * mindestens ein anderes Dokument übrig bleibt — sonst lieber mit allen synthetisieren als
 * mit einer leeren Liste zu scheitern. Der AUFRUFER von `synthesizeDueDiligence` übergibt
 * weiterhin die volle Liste an `parseSynthesisResponse` (sourceDocumentId-Auflösung/
 * computeMissingDocuments) — nur dieser gefilterte Ausschnitt geht in den Prompt.
 */
export function selectSynthesisPromptDocuments(documents: SynthesisDocumentInput[]): SynthesisDocumentInput[] {
  const relevant = documents.filter((d) => d.documentType !== "SONSTIGES");
  return relevant.length > 0 ? relevant : documents;
}

export function computeOverallStatus(categories: DueDiligenceCategoryResult[]): DueDiligenceSeverity {
  if (categories.length === 0) return "KLAERUNGSBEDARF";
  if (categories.some((c) => c.status === "RISIKO")) return "RISIKO";
  if (categories.some((c) => c.status === "KLAERUNGSBEDARF")) return "KLAERUNGSBEDARF";
  return "OK";
}

const KNOWN_CATEGORIES = new Set(CATEGORY_ORDER);
const KNOWN_SEVERITIES = new Set<DueDiligenceSeverity>(["OK", "KLAERUNGSBEDARF", "RISIKO"]);

const SEVERITY_SORT_WEIGHT: Record<DueDiligenceSeverity, number> = { RISIKO: 0, KLAERUNGSBEDARF: 1, OK: 2 };
/** Deckelt die pro Dokument in den Stufe-2-Prompt übernommenen Stufe-1-Funde — wichtig bei findingsreichen Dokumenten (z.B. mehrjährige STWEG-Protokolle), siehe compactFindingsForPrompt. */
export const MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT = 10;

/**
 * Der grösste Prompt-Kostentreiber bei findingsreichen Dokumenten waren die vollständigen
 * `detail`/`sourceQuote`-Felder JEDES Stufe-1-Funds im Stufe-2-Prompt — Stufe 2 generiert
 * ihre eigenen Funde/Zitate ohnehin frisch (mit eigenem sourceDocumentId/sourcePage) und
 * braucht das wörtliche Stufe-1-Zitat für die Quervergleichs-Logik nicht, nur Kategorie/
 * Schwere/Kurzfassung/Seite. Zusätzlich pro Dokument auf die (nach Schwere sortiert)
 * wichtigsten `MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT` Funde gedeckelt. Beides zusammen wirkt
 * gezielt gegen das wiederholt beobachtete Überschreiten von Vercels 60-Sekunden-Limit bei
 * vielen bzw. findingsreichen Dokumenten (siehe docs/DECISIONS.md) — die vollständigen
 * Stufe-1-Funde bleiben unverändert pro Dokument gespeichert/sichtbar, nur der an Stufe 2
 * weitergereichte Ausschnitt ist kompakter.
 */
export function compactFindingsForPrompt(findings: DueDiligenceFinding[]): unknown[] {
  return [...findings]
    .sort((a, b) => SEVERITY_SORT_WEIGHT[a.severity] - SEVERITY_SORT_WEIGHT[b.severity])
    .slice(0, MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT)
    .map((f) => ({ category: f.category, severity: f.severity, summary: f.summary, sourcePage: f.sourcePage, isContradiction: f.isContradiction }));
}

function buildSynthesisPrompt(documents: SynthesisDocumentInput[], knownFacts: SynthesisKnownFact[], knownFields: SynthesisKnownField[]): string {
  const documentsBlock = documents
    .map(
      (d, i) =>
        `Dokument ${i + 1} (documentId="${d.id}", Dateiname="${d.filename}", Typ=${DOCUMENT_TYPE_CATALOG[d.documentType].label}):\nZusammenfassung: ${d.summary}\nFakten: ${JSON.stringify(d.facts)}\nBereits erkannte Einzelfunde: ${JSON.stringify(compactFindingsForPrompt(d.findings))}`,
    )
    .join("\n\n");

  const factsBlock = knownFacts.length > 0 ? knownFacts.map((f) => `- ${f.label}: ${f.value}`).join("\n") : "(keine)";
  const fieldsBlock = knownFields.length > 0 ? knownFields.map((f) => `- field="${f.field}" (${f.label}), aktueller Wert: ${f.currentValue ?? "nicht erfasst"}`).join("\n") : "(keine)";

  return `Du bist ein Due-Diligence-Assistent für den Kauf einer Schweizer Eigentumswohnung als Rendite-/Buy-to-let-Objekt. Du hast bereits die folgenden Dokumente einzeln analysiert und sollst sie jetzt GEMEINSAM auswerten — insbesondere Widersprüche zwischen Dokumenten und zu bereits erfassten Daten finden.

BEREITS ERFASSTE OBJEKT-DATEN (aus Inserat/manueller Erfassung):
${factsBlock}

HOCHGELADENE DOKUMENTE:
${documentsBlock}

Beispiele für Widersprüche, auf die du besonders achten sollst: abweichende Flächenangaben zwischen Inserat und Grundriss/Grundbuch; ein im Inserat behauptetes Renovationsjahr ohne passenden Beleg in Rechnungen; ein angeblich inkludierter Parkplatz, der grundbuchlich nicht oder anders zugeordnet ist; ein in einem STWEG-Protokoll diskutiertes, aber abgelehntes/vertagtes Vorhaben (das trotzdem ein zukünftiges Risiko ist, nicht ignorieren).

Bevor du eine zahlenmässige Abweichung zwischen zwei Dokumenten als ungeklärten Widerspruch meldest: prüfe zuerst, ob sich die Differenz rechnerisch erklären lässt — z.B. weil ein Dokument die Summe mehrerer Konten/Positionen nennt, die ein anderes Dokument einzeln ausweist, oder weil ein späterer Kontostand sich aus einem früheren plus bekannten, regelmässigen Beiträgen ergibt (Fondssaldo + jährliche Einlage laut Budget). Findest du eine schlüssige Erklärung, ist das ein gelöster Punkt (severity "OK"), nicht mehr Klärungsbedarf — nenne die Rechnung im "detail"-Feld, damit sie nachvollziehbar bleibt. Nur eine tatsächlich unerklärliche Differenz bleibt ein Widerspruch mit "isContradiction": true.

Für JEDEN so markierten Widerspruch (isContradiction: true) zusätzlich einen Eintrag in "contradictions" erstellen — ein kurzes "topic" (z.B. "Zimmerzahl", "Baujahr", "Wohnfläche"), die betroffene "category", und "options" mit JEDEM konkurrierenden Wert (mindestens 2), jeweils mit dem exakten Wert, "sourceDocumentId" aus der Dokumentenliste oben sowie optional sourcePage/sourceQuote als Beleg. Der Nutzer soll daraus im UI auswählen können, welcher Wert stimmt. Entspricht der Sachverhalt einem der bekannten Felder unten, zusätzlich "field" mit dessen exaktem Feldnamen setzen — sonst "field" weglassen.

Rufe AUSSCHLIESSLICH das Tool "${SYNTHESIS_TOOL_NAME}" mit dem Ergebnis auf, ohne zusätzlichen Erklärtext.

Für "categories": nenne NUR Kategorien, zu denen die hochgeladenen Dokumente tatsächlich etwas ergeben (ein Fund oder eine klare Einschätzung "unproblematisch"). Kategorien ohne jeglichen Bezug zu den vorliegenden Dokumenten weglassen — die App ergänzt sie automatisch mit einem neutralen Platzhalter, das muss nicht Teil deiner Antwort sein. Das hält die Antwort kurz und auf das Wesentliche fokussiert.

Für "fieldUpdateProposals": nur Werte vorschlagen, die eindeutig aus einem Dokument hervorgehen UND einem der folgenden bekannten Felder entsprechen — erfinde nie einen neuen Feldnamen:
${fieldsBlock}

sourceQuote-Felder kurz halten (nur der entscheidende Ausschnitt, nicht ganze Absätze). Erfinde nie einen Wert, der nicht in den Dokumenten/Daten oben steht.`;
}

const SYNTHESIS_TOOL_NAME = "emit_due_diligence_synthesis";

/** JSON-Schema für erzwungenen Tool-Aufruf — siehe Begründung bei `buildExtractionToolSchema` in dueDiligenceExtraction.ts, hier zusätzlich mit `knownFields`-Feldpfaden strukturell statt nur textuell auf gültige Werte eingeschränkt. */
export function buildSynthesisToolSchema(knownFields: SynthesisKnownField[]): { type: "object"; properties: Record<string, unknown>; required: string[] } {
  const findingProperties = {
    summary: { type: "string" },
    detail: { type: "string", description: "Optional, Begründung." },
    sourceDocumentId: { type: "string", description: "Optional, exakt eine der genannten documentId." },
    sourcePage: { type: "number" },
    sourceQuote: { type: "string", maxLength: 280, description: "Optional, kurz halten." },
    isContradiction: { type: "boolean", description: "true, wenn dies ein Widerspruch zwischen Quellen ist." },
  };
  return {
    type: "object",
    properties: {
      overallSummary: {
        type: "string",
        description:
          "2-4 Sätze Fliesstext: Gesamteinschätzung des Objekts als Rendite-/Buy-to-let-Investment — Kernaussage zuerst, dann die wichtigste Bedingung/Einschränkung, dann das grösste Risiko.",
      },
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: [...CATEGORY_ORDER] },
            status: { type: "string", enum: [...KNOWN_SEVERITIES] },
            findings: { type: "array", items: { type: "object", properties: findingProperties, required: ["summary"] } },
          },
          required: ["category", "status", "findings"],
        },
      },
      sellerQuestions: {
        type: "array",
        items: {
          type: "object",
          properties: { question: { type: "string" }, relatedFindingSummary: { type: "string" } },
          required: ["question"],
        },
      },
      fieldUpdateProposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string", enum: knownFields.map((f) => f.field) },
            newValue: { type: ["string", "number"] },
            sourceDocumentId: { type: "string" },
            sourcePage: { type: "number" },
          },
          required: ["field", "newValue", "sourceDocumentId"],
        },
      },
      contradictions: {
        type: "array",
        description: "Strukturierte Widersprüche (siehe Systemprompt) — für JEDEN als isContradiction markierten Fund ein Eintrag, damit der Nutzer im UI zwischen den konkurrierenden Werten wählen kann.",
        items: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Kurzer Sachverhalt, z.B. 'Zimmerzahl'." },
            category: { type: "string", enum: [...CATEGORY_ORDER] },
            field: { type: "string", enum: knownFields.map((f) => f.field), description: "Nur setzen, wenn der Sachverhalt einem bekannten Übernahme-Feld entspricht." },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  value: { type: ["string", "number"] },
                  sourceDocumentId: { type: "string" },
                  sourcePage: { type: "number" },
                  sourceQuote: { type: "string", maxLength: 280 },
                },
                required: ["value", "sourceDocumentId"],
              },
            },
          },
          required: ["topic", "category", "options"],
        },
      },
    },
    required: ["overallSummary", "categories", "sellerQuestions", "fieldUpdateProposals", "contradictions"],
  };
}

/** `category`/`severity` kommen vom Aufrufer (Kategorie-Kontext bzw. Fallback auf den Kategorie-Status, falls das Finding selbst keine eigene Severity nennt). */
function parseFinding(
  raw: unknown,
  category: DueDiligenceCategory,
  fallbackSeverity: DueDiligenceSeverity,
  knownDocumentIds: Set<string>,
  documentNameById: Map<string, string>,
): DueDiligenceFinding | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const f = raw as Record<string, unknown>;
  if (typeof f.summary !== "string" || !f.summary) return undefined;
  const sourceDocumentId = typeof f.sourceDocumentId === "string" && knownDocumentIds.has(f.sourceDocumentId) ? f.sourceDocumentId : undefined;
  const severity = typeof f.severity === "string" && KNOWN_SEVERITIES.has(f.severity as DueDiligenceSeverity) ? (f.severity as DueDiligenceSeverity) : fallbackSeverity;
  return {
    category,
    severity,
    summary: f.summary,
    detail: typeof f.detail === "string" ? f.detail : undefined,
    sourceDocumentId,
    sourceDocumentName: sourceDocumentId ? documentNameById.get(sourceDocumentId) : undefined,
    sourcePage: typeof f.sourcePage === "number" ? f.sourcePage : undefined,
    sourceQuote: typeof f.sourceQuote === "string" ? f.sourceQuote : undefined,
    isContradiction: typeof f.isContradiction === "boolean" ? f.isContradiction : undefined,
  };
}

/**
 * Kategorien, zu denen das LLM nichts zurückgegeben hat (siehe Prompt — bewusst NICHT
 * mehr verlangt, um die Antwortlänge/-latenz gerade bei wenigen hochgeladenen
 * Dokumenten klein zu halten), werden deterministisch mit einem neutralen Platzhalter
 * aufgefüllt statt einfach zu fehlen — unterscheidet dabei ehrlich zwischen "für diese
 * Kategorie liegt gar kein Dokument vor" (aus den hochgeladenen Dokumenttypen ableitbar)
 * und "Dokumente vorhanden, aber kein gesonderter Befund" (die Kategorie ist nicht
 * automatisch als unproblematisch anzunehmen, nur weil das LLM sie ausgelassen hat).
 */
function buildDefaultCategoryResult(category: DueDiligenceCategory, hasUploadedDocumentForCategory: boolean): DueDiligenceCategoryResult {
  const summary = hasUploadedDocumentForCategory
    ? "Die automatische Auswertung der hochgeladenen Dokumente ergab keinen gesonderten Befund für diese Kategorie."
    : "Für diese Kategorie liegt noch kein Dokument vor.";
  return { category, status: "KLAERUNGSBEDARF", findings: [{ category, severity: "KLAERUNGSBEDARF", summary }] };
}

/** Defensiv geparst wie `parseDocumentExtractionResponse` — unbekannte/fehlerhafte Einträge werden übersprungen statt das ganze Ergebnis zu verwerfen. */
export function parseSynthesisResponse(jsonText: string, documents: SynthesisDocumentInput[], knownFields: SynthesisKnownField[]): DueDiligenceResult {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const overallSummary = typeof parsed.overallSummary === "string" ? parsed.overallSummary : "";
  const knownDocumentIds = new Set(documents.map((d) => d.id));
  const documentNameById = new Map(documents.map((d) => [d.id, d.filename]));
  const knownFieldPaths = new Set(knownFields.map((f) => f.field));

  const categories: DueDiligenceCategoryResult[] = [];
  const rawCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
  for (const raw of rawCategories) {
    if (typeof raw !== "object" || raw === null) continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.category !== "string" || !KNOWN_CATEGORIES.has(c.category as DueDiligenceCategory)) continue;
    if (typeof c.status !== "string" || !KNOWN_SEVERITIES.has(c.status as DueDiligenceSeverity)) continue;
    const rawFindings = Array.isArray(c.findings) ? c.findings : [];
    const findings: DueDiligenceFinding[] = [];
    for (const rf of rawFindings) {
      const parsedFinding = parseFinding(rf, c.category as DueDiligenceCategory, c.status as DueDiligenceSeverity, knownDocumentIds, documentNameById);
      if (parsedFinding) findings.push(parsedFinding);
    }
    categories.push({ category: c.category as DueDiligenceCategory, status: c.status as DueDiligenceSeverity, findings });
  }

  const returnedCategories = new Set(categories.map((c) => c.category));
  const uploadedCategories = new Set(documents.map((d) => DOCUMENT_TYPE_CATALOG[d.documentType].defaultCategory));
  for (const category of CATEGORY_ORDER) {
    if (returnedCategories.has(category)) continue;
    categories.push(buildDefaultCategoryResult(category, uploadedCategories.has(category)));
  }

  const sellerQuestions: DueDiligenceSellerQuestion[] = [];
  for (const raw of Array.isArray(parsed.sellerQuestions) ? parsed.sellerQuestions : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const q = raw as Record<string, unknown>;
    if (typeof q.question !== "string" || !q.question) continue;
    sellerQuestions.push({ question: q.question, relatedFindingSummary: typeof q.relatedFindingSummary === "string" ? q.relatedFindingSummary : undefined });
  }

  const fieldUpdateProposals: DueDiligenceFieldUpdateProposal[] = [];
  for (const raw of Array.isArray(parsed.fieldUpdateProposals) ? parsed.fieldUpdateProposals : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.field !== "string" || !knownFieldPaths.has(p.field)) continue;
    if (typeof p.newValue !== "string" && typeof p.newValue !== "number") continue;
    if (typeof p.sourceDocumentId !== "string" || !knownDocumentIds.has(p.sourceDocumentId)) continue;
    const knownField = knownFields.find((f) => f.field === p.field)!;
    fieldUpdateProposals.push({
      field: p.field,
      label: knownField.label,
      newValue: p.newValue,
      currentValue: knownField.currentValue ?? null,
      sourceDocumentId: p.sourceDocumentId,
      sourceDocumentName: documentNameById.get(p.sourceDocumentId) ?? "",
      sourcePage: typeof p.sourcePage === "number" ? p.sourcePage : undefined,
    });
  }

  const contradictions: DueDiligenceContradiction[] = [];
  for (const raw of Array.isArray(parsed.contradictions) ? parsed.contradictions : []) {
    if (typeof raw !== "object" || raw === null) continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.topic !== "string" || !c.topic) continue;
    if (typeof c.category !== "string" || !KNOWN_CATEGORIES.has(c.category as DueDiligenceCategory)) continue;
    const field = typeof c.field === "string" && knownFieldPaths.has(c.field) ? c.field : undefined;

    const options: DueDiligenceContradictionOption[] = [];
    for (const rawOption of Array.isArray(c.options) ? c.options : []) {
      if (typeof rawOption !== "object" || rawOption === null) continue;
      const o = rawOption as Record<string, unknown>;
      if (typeof o.value !== "string" && typeof o.value !== "number") continue;
      const sourceDocumentId = typeof o.sourceDocumentId === "string" && knownDocumentIds.has(o.sourceDocumentId) ? o.sourceDocumentId : undefined;
      options.push({
        value: o.value,
        sourceDocumentId,
        sourceDocumentName: sourceDocumentId ? (documentNameById.get(sourceDocumentId) ?? "") : "",
        sourcePage: typeof o.sourcePage === "number" ? o.sourcePage : undefined,
        sourceQuote: typeof o.sourceQuote === "string" ? o.sourceQuote : undefined,
      });
    }
    // Ein "Widerspruch" mit weniger als zwei Optionen ist keiner — dann lieber
    // weglassen statt eine irreführende Ein-Options-"Auswahl" anzuzeigen.
    if (options.length < 2) continue;

    contradictions.push({ topic: c.topic, category: c.category as DueDiligenceCategory, field, options });
  }

  return {
    overallStatus: computeOverallStatus(categories),
    overallSummary,
    categories,
    missingDocuments: computeMissingDocuments(documents.map((d) => d.documentType)),
    sellerQuestions,
    fieldUpdateProposals,
    contradictions,
  };
}

export async function synthesizeDueDiligence(
  documents: SynthesisDocumentInput[],
  knownFacts: SynthesisKnownFact[],
  knownFields: SynthesisKnownField[],
): Promise<DueDiligenceResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  if (documents.length === 0) {
    return { overallStatus: "KLAERUNGSBEDARF", overallSummary: "", categories: [], missingDocuments: computeMissingDocuments([]), sellerQuestions: [], fieldUpdateProposals: [], contradictions: [] };
  }

  const promptDocuments = selectSynthesisPromptDocuments(documents);

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: buildSynthesisPrompt(promptDocuments, knownFacts, knownFields),
    tools: [{ name: SYNTHESIS_TOOL_NAME, description: "Nimmt das Due-Diligence-Syntheseergebnis entgegen.", input_schema: buildSynthesisToolSchema(knownFields) }],
    tool_choice: { type: "tool", name: SYNTHESIS_TOOL_NAME },
    messages: [{ role: "user", content: "Erstelle die Due-Diligence-Synthese gemäss den Anweisungen im System-Prompt und rufe das Tool mit dem Ergebnis auf." }],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Antwort von Claude wurde bei max_tokens abgeschnitten — vermutlich zu viele/umfangreiche Dokumente für eine einzelne Synthese.");
  }

  // Erzwungener Tool-Aufruf statt Freitext-JSON — siehe Begründung in dueDiligenceExtraction.ts.
  const toolUseBlock = response.content.find((block) => block.type === "tool_use" && block.name === SYNTHESIS_TOOL_NAME);
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") throw new Error("Keine strukturierte Antwort (Tool-Aufruf) von Anthropic erhalten");

  return parseSynthesisResponse(JSON.stringify(toolUseBlock.input), documents, knownFields);
}
