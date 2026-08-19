import Anthropic from "@anthropic-ai/sdk";
import type {
  DueDiligenceCategory,
  DueDiligenceCategoryResult,
  DueDiligenceDocumentType,
  DueDiligenceFieldUpdateProposal,
  DueDiligenceFinding,
  DueDiligenceMissingDocument,
  DueDiligenceResult,
  DueDiligenceSellerQuestion,
  DueDiligenceSeverity,
} from "@landfinder/domain";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";
import { AnthropicNotConfiguredError } from "./dueDiligenceExtraction";
import { extractFirstJsonObject } from "./extractJsonObject";

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

export function computeOverallStatus(categories: DueDiligenceCategoryResult[]): DueDiligenceSeverity {
  if (categories.length === 0) return "KLAERUNGSBEDARF";
  if (categories.some((c) => c.status === "RISIKO")) return "RISIKO";
  if (categories.some((c) => c.status === "KLAERUNGSBEDARF")) return "KLAERUNGSBEDARF";
  return "OK";
}

const ALL_CATEGORIES: DueDiligenceCategory[] = [
  "GRUNDBUCH_RECHTE",
  "STWEG",
  "ERNEUERUNGSFONDS",
  "GEBAEUDE_SANIERUNGEN",
  "MIETVERHAELTNIS",
  "NEBENKOSTEN",
  "HEIZUNG_ENERGIE",
  "TECHNISCHE_UNTERLAGEN",
  "DOKUMENTENVOLLSTAENDIGKEIT",
];
const KNOWN_CATEGORIES = new Set(ALL_CATEGORIES);
const KNOWN_SEVERITIES = new Set<DueDiligenceSeverity>(["OK", "KLAERUNGSBEDARF", "RISIKO"]);

function buildSynthesisPrompt(documents: SynthesisDocumentInput[], knownFacts: SynthesisKnownFact[], knownFields: SynthesisKnownField[]): string {
  const documentsBlock = documents
    .map(
      (d, i) =>
        `Dokument ${i + 1} (documentId="${d.id}", Dateiname="${d.filename}", Typ=${DOCUMENT_TYPE_CATALOG[d.documentType].label}):\nZusammenfassung: ${d.summary}\nFakten: ${JSON.stringify(d.facts)}\nBereits erkannte Einzelfunde: ${JSON.stringify(d.findings)}`,
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

Gib AUSSCHLIESSLICH ein JSON-Objekt zurück, ohne Erklärtext, mit genau dieser Struktur:
{
  "categories": [
    {
      "category": string (einer von: ${ALL_CATEGORIES.join(", ")}),
      "status": string (OK, KLAERUNGSBEDARF, oder RISIKO),
      "findings": [
        {
          "summary": string,
          "detail": string (optional),
          "sourceDocumentId": string (optional, exakt eine der oben genannten documentId, wenn der Fund einem bestimmten Dokument zuzuordnen ist),
          "sourcePage": number (optional),
          "sourceQuote": string (optional),
          "isContradiction": boolean (optional, true wenn dies ein Widerspruch zwischen Quellen ist)
        }
      ]
    }
  ],
  "sellerQuestions": [
    { "question": string, "relatedFindingSummary": string (optional) }
  ],
  "fieldUpdateProposals": [
    { "field": string (exakt einer der unten gelisteten Feldpfade), "newValue": string oder number, "sourceDocumentId": string, "sourcePage": number (optional) }
  ]
}

Für "categories": erzeuge für JEDE der neun Kategorien einen Eintrag, auch wenn dazu (noch) keine Dokumente vorliegen (dann status "KLAERUNGSBEDARF" mit einem Fund, der die fehlende Grundlage nennt, oder "OK" wenn diese Kategorie hier ersichtlich unproblematisch ist).

Für "fieldUpdateProposals": nur Werte vorschlagen, die eindeutig aus einem Dokument hervorgehen UND einem der folgenden bekannten Felder entsprechen — erfinde nie einen neuen Feldnamen:
${fieldsBlock}

Erfinde nie einen Wert, der nicht in den Dokumenten/Daten oben steht.`;
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

/** Defensiv geparst wie `parseDocumentExtractionResponse` — unbekannte/fehlerhafte Einträge werden übersprungen statt das ganze Ergebnis zu verwerfen. */
export function parseSynthesisResponse(jsonText: string, documents: SynthesisDocumentInput[], knownFields: SynthesisKnownField[]): DueDiligenceResult {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
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

  return { overallStatus: computeOverallStatus(categories), categories, missingDocuments: computeMissingDocuments(documents.map((d) => d.documentType)), sellerQuestions, fieldUpdateProposals };
}

export async function synthesizeDueDiligence(
  documents: SynthesisDocumentInput[],
  knownFacts: SynthesisKnownFact[],
  knownFields: SynthesisKnownField[],
): Promise<DueDiligenceResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  if (documents.length === 0) {
    return { overallStatus: "KLAERUNGSBEDARF", categories: [], missingDocuments: computeMissingDocuments([]), sellerQuestions: [], fieldUpdateProposals: [] };
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: buildSynthesisPrompt(documents, knownFacts, knownFields),
    messages: [{ role: "user", content: "Erstelle die Due-Diligence-Synthese gemäss den Anweisungen im System-Prompt und gib ausschliesslich das beschriebene JSON zurück." }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Keine Text-Antwort von Anthropic erhalten");

  const json = extractFirstJsonObject(textBlock.text);
  if (!json) throw new Error("Keine JSON-Struktur in der Anthropic-Antwort gefunden");

  return parseSynthesisResponse(json, documents, knownFields);
}
