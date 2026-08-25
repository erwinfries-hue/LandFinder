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

const PRIORITY_SORT_WEIGHT: Record<string, number> = { ZWINGEND: 0, EMPFOHLEN: 1, OPTIONAL: 2 };

/**
 * Harte Obergrenze für die Anzahl Dokumente im Stufe-2-Prompt — unabhängig davon, wie
 * viele der Nutzer hochlädt. Der SONSTIGES-Filter allein reicht bei sehr grossen
 * Dokumentensets (mehrjährige STWEG-Protokolle, lange Mietverträge etc.) nicht aus, um
 * verlässlich unter Vercels 60-Sekunden-Zeitlimit zu bleiben (per Live-Test wiederholt
 * beobachtet, siehe DECISIONS.md) — die Anzahl UND Grösse der übrig bleibenden Dokumente
 * variiert stark. Diese Obergrenze macht die Prompt-Grösse im Worst Case deterministisch
 * kalkulierbar, unabhängig von der Dokumentanzahl des Objekts.
 */
export const MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT = 8;

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
 *
 * Bleiben nach dem SONSTIGES-Filter immer noch mehr als `MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT`
 * Dokumente übrig, werden die wichtigsten nach Dokumenttyp-Priorität (ZWINGEND vor
 * EMPFOHLEN vor OPTIONAL, siehe DOCUMENT_TYPE_CATALOG) behalten — bei gleicher Priorität
 * bleibt die Upload-Reihenfolge erhalten. Die weggelassenen Dokumente bleiben unverändert
 * einzeln analysiert sichtbar und werden am Objekt gespeichert, tragen nur nicht zu dieser
 * Cross-Dokument-Synthese bei.
 */
export function selectSynthesisPromptDocuments(documents: SynthesisDocumentInput[]): SynthesisDocumentInput[] {
  const relevant = documents.filter((d) => d.documentType !== "SONSTIGES");
  const selected = relevant.length > 0 ? relevant : documents;
  if (selected.length <= MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT) return selected;

  const withIndex = selected.map((d, index) => ({ d, index }));
  withIndex.sort((a, b) => {
    const weightA = PRIORITY_SORT_WEIGHT[DOCUMENT_TYPE_CATALOG[a.d.documentType]?.priority ?? ""] ?? 3;
    const weightB = PRIORITY_SORT_WEIGHT[DOCUMENT_TYPE_CATALOG[b.d.documentType]?.priority ?? ""] ?? 3;
    return weightA !== weightB ? weightA - weightB : a.index - b.index;
  });
  return withIndex.slice(0, MAX_DOCUMENTS_IN_SYNTHESIS_PROMPT).map((w) => w.d);
}

export function computeOverallStatus(categories: DueDiligenceCategoryResult[]): DueDiligenceSeverity {
  if (categories.length === 0) return "KLAERUNGSBEDARF";
  if (categories.some((c) => c.status === "RISIKO")) return "RISIKO";
  if (categories.some((c) => c.status === "KLAERUNGSBEDARF")) return "KLAERUNGSBEDARF";
  return "OK";
}

/**
 * Batch-Grösse für die Stufe-2-Synthese — nach der Deckelung durch
 * `selectSynthesisPromptDocuments` (≤8 Dokumente) werden diese in Gruppen von je
 * `SYNTHESIS_BATCH_SIZE` aufgeteilt und einzeln (kurze, garantiert unter Vercels
 * 60-Sekunden-Limit bleibende) Claude-Aufrufe geschickt, statt alle gemeinsam in einem
 * einzigen, potenziell zu langen Request (siehe docs/DECISIONS.md). Bei den meisten
 * Objekten (≤3 Dokumente) ergibt sich dadurch weiterhin genau 1 Batch — unverändertes
 * Verhalten/Timing wie vor dieser Umstellung.
 */
export const SYNTHESIS_BATCH_SIZE = 3;

export function splitDocumentsIntoBatches(documents: SynthesisDocumentInput[]): SynthesisDocumentInput[][] {
  const batches: SynthesisDocumentInput[][] = [];
  for (let i = 0; i < documents.length; i += SYNTHESIS_BATCH_SIZE) {
    batches.push(documents.slice(i, i + SYNTHESIS_BATCH_SIZE));
  }
  return batches;
}

const KNOWN_CATEGORIES = new Set(CATEGORY_ORDER);
const KNOWN_SEVERITIES = new Set<DueDiligenceSeverity>(["OK", "KLAERUNGSBEDARF", "RISIKO"]);

const SEVERITY_SORT_WEIGHT: Record<DueDiligenceSeverity, number> = { RISIKO: 0, KLAERUNGSBEDARF: 1, OK: 2 };
/** Deckelt die pro Dokument in den Stufe-2-Prompt übernommenen Stufe-1-Funde — wichtig bei findingsreichen Dokumenten (z.B. mehrjährige STWEG-Protokolle), siehe compactFindingsForPrompt. */
export const MAX_FINDINGS_PER_DOCUMENT_IN_PROMPT = 6;

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

/** Weitere, defensive Obergrenzen gegen den Prompt-Kostentreiber — greifen nur im seltenen Fall einer ungewöhnlich langen Stufe-1-Zusammenfassung/Fakten-Struktur, wirken aber zusätzlich zur Funde-Deckelung oben in dieselbe Richtung (Vercel-60s-Limit, siehe docs/DECISIONS.md). */
const MAX_SUMMARY_LENGTH_IN_PROMPT = 350;
const MAX_FACTS_JSON_LENGTH_IN_PROMPT = 700;

function truncateForPrompt(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function buildSynthesisPrompt(
  documents: SynthesisDocumentInput[],
  knownFacts: SynthesisKnownFact[],
  knownFields: SynthesisKnownField[],
  otherDocuments: SynthesisDocumentInput[] = [],
): string {
  const documentsBlock = documents
    .map((d, i) => {
      const summary = truncateForPrompt(d.summary, MAX_SUMMARY_LENGTH_IN_PROMPT);
      const factsJson = truncateForPrompt(JSON.stringify(d.facts), MAX_FACTS_JSON_LENGTH_IN_PROMPT);
      return `Dokument ${i + 1} (documentId="${d.id}", Dateiname="${d.filename}", Typ=${DOCUMENT_TYPE_CATALOG[d.documentType].label}):\nZusammenfassung: ${summary}\nFakten: ${factsJson}\nBereits erkannte Einzelfunde: ${JSON.stringify(compactFindingsForPrompt(d.findings))}`;
    })
    .join("\n\n");

  // Nur Fakten (kein summary/findings) — Quervergleichs-Kontext für die Batch-Synthese,
  // damit ein Widerspruch zwischen dem hier fokussierten Dokument und einem in einem
  // ANDEREN Batch bereits/noch analysierten Dokument trotzdem erkannt wird, ohne dass
  // diese anderen Dokumente hier erneut voll ausgewertet werden (siehe SYNTHESIS_BATCH_SIZE).
  const otherDocumentsBlock =
    otherDocuments.length > 0
      ? `\n\nWEITERE, BEREITS ANALYSIERTE DOKUMENTE (nur Fakten, nur zum Quervergleich — dafür KEINE eigenen categories/findings erstellen):\n${otherDocuments
          .map((d) => {
            const factsJson = truncateForPrompt(JSON.stringify(d.facts), MAX_FACTS_JSON_LENGTH_IN_PROMPT);
            return `Dokument (documentId="${d.id}", Dateiname="${d.filename}", Typ=${DOCUMENT_TYPE_CATALOG[d.documentType].label}):\nFakten: ${factsJson}`;
          })
          .join("\n\n")}`
      : "";

  const factsBlock = knownFacts.length > 0 ? knownFacts.map((f) => `- ${f.label}: ${f.value}`).join("\n") : "(keine)";
  const fieldsBlock = knownFields.length > 0 ? knownFields.map((f) => `- field="${f.field}" (${f.label}), aktueller Wert: ${f.currentValue ?? "nicht erfasst"}`).join("\n") : "(keine)";

  return `Du bist ein Due-Diligence-Assistent für den Kauf einer Schweizer Eigentumswohnung als Rendite-/Buy-to-let-Objekt. Du hast bereits die folgenden Dokumente einzeln analysiert und sollst sie jetzt GEMEINSAM auswerten — insbesondere Widersprüche zwischen Dokumenten und zu bereits erfassten Daten finden.

BEREITS ERFASSTE OBJEKT-DATEN (aus Inserat/manueller Erfassung):
${factsBlock}

HOCHGELADENE DOKUMENTE:
${documentsBlock}${otherDocumentsBlock}

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

/**
 * Füllt Kategorien, zu denen (in DIESEM Aufruf) nichts zurückkam, deterministisch mit
 * einem neutralen Platzhalter auf (siehe `buildDefaultCategoryResult`) — aus
 * `parseSynthesisResponse` extrahiert, damit sowohl der Einzel-Call-Pfad
 * (`synthesizeDueDiligence`) als auch der Batch-Merge (`mergeDueDiligenceBatches`)
 * dieselbe Logik verwenden. `documents` bestimmt dabei, für welche Kategorien
 * überhaupt ein Dokument vorliegt (unterscheidet "kein Dokument" von "Dokument
 * vorhanden, aber kein gesonderter Befund").
 */
function fillMissingCategories(categories: DueDiligenceCategoryResult[], documents: SynthesisDocumentInput[]): DueDiligenceCategoryResult[] {
  const filled = [...categories];
  const returnedCategories = new Set(categories.map((c) => c.category));
  const uploadedCategories = new Set(documents.map((d) => DOCUMENT_TYPE_CATALOG[d.documentType].defaultCategory));
  for (const category of CATEGORY_ORDER) {
    if (returnedCategories.has(category)) continue;
    filled.push(buildDefaultCategoryResult(category, uploadedCategories.has(category)));
  }
  return filled;
}

/** Zwischenergebnis eines einzelnen Batch-Aufrufs (`synthesizeDueDiligenceBatch`) — noch OHNE Kategorie-Auffüllung/`overallStatus`/`missingDocuments`, die erst nach dem Merge ALLER Batches über die vollständige Dokumentenliste berechnet werden (siehe `mergeDueDiligenceBatches`). */
export interface PartialSynthesisResult {
  overallSummary: string;
  categories: DueDiligenceCategoryResult[];
  sellerQuestions: DueDiligenceSellerQuestion[];
  fieldUpdateProposals: DueDiligenceFieldUpdateProposal[];
  contradictions: DueDiligenceContradiction[];
}

/** Gemeinsamer Parser-Kern für `parseSynthesisResponse` und `parseSynthesisBatchResponse` — unterscheidet sich nur darin, ob danach noch Kategorien aufgefüllt/`overallStatus`/`missingDocuments` berechnet werden. Defensiv geparst wie `parseDocumentExtractionResponse` — unbekannte/fehlerhafte Einträge werden übersprungen statt das ganze Ergebnis zu verwerfen. */
function parseSynthesisResponseCore(jsonText: string, documents: SynthesisDocumentInput[], knownFields: SynthesisKnownField[]): PartialSynthesisResult {
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

  return { overallSummary, categories, sellerQuestions, fieldUpdateProposals, contradictions };
}

/** Vollständiges Ergebnis eines EINZELNEN, alle Dokumente umfassenden Synthese-Aufrufs (`synthesizeDueDiligence`) — Kategorien vollständig aufgefüllt, `overallStatus`/`missingDocuments` bereits berechnet. */
export function parseSynthesisResponse(jsonText: string, documents: SynthesisDocumentInput[], knownFields: SynthesisKnownField[]): DueDiligenceResult {
  const core = parseSynthesisResponseCore(jsonText, documents, knownFields);
  const categories = fillMissingCategories(core.categories, documents);
  return {
    overallStatus: computeOverallStatus(categories),
    overallSummary: core.overallSummary,
    categories,
    missingDocuments: computeMissingDocuments(documents.map((d) => d.documentType)),
    sellerQuestions: core.sellerQuestions,
    fieldUpdateProposals: core.fieldUpdateProposals,
    contradictions: core.contradictions,
  };
}

/**
 * Ergebnis eines einzelnen Batch-Aufrufs (`synthesizeDueDiligenceBatch`) — bewusst OHNE
 * Kategorie-Auffüllung/`overallStatus`/`missingDocuments`, da diese erst nach dem Merge
 * ALLER Batches über die vollständige Dokumentenliste sinnvoll sind (siehe
 * `mergeDueDiligenceBatches`). `allDocuments` (Fokus- + Quervergleichs-Dokumente dieses
 * Batch-Aufrufs) dient hier nur der sourceDocumentId/Namens-Auflösung.
 */
export function parseSynthesisBatchResponse(jsonText: string, allDocuments: SynthesisDocumentInput[], knownFields: SynthesisKnownField[]): PartialSynthesisResult {
  return parseSynthesisResponseCore(jsonText, allDocuments, knownFields);
}

const SYNTHESIS_MODEL_PRIMARY = "claude-sonnet-5";
const SYNTHESIS_MODEL_FALLBACK = "claude-haiku-4-5-20251001";

/**
 * Sonnet 5 braucht bei umfangreichen Dokumentensets trotz aller Prompt-Kürzungen
 * (siehe DECISIONS.md) manchmal länger, als Vercels Serverless-Zeitlimit erlaubt — dann
 * kommt beim Nutzer nur ein "Netzwerkfehler" an, OHNE jeden Feldvorschlag (per Live-Test
 * wiederholt beobachtet, auch nach SONSTIGES-Filter/Prompt-Kürzung/Parallelisierung).
 * Daher: Sonnet 5 bekommt ein knappes Zeitbudget; läuft es ab, wird NICHT abgewartet,
 * sondern sofort mit Haiku 4.5 (schneller, gleicher Prompt) im verbleibenden
 * Zeitbudget nochmals versucht — lieber ein etwas weniger nuanciertes Ergebnis als gar
 * keines. Beide Modelle bekommen exakt denselben Prompt/dieselbe Werkzeug-Definition,
 * "nichts wird erfunden" bleibt also unverändert die Vorgabe, nur das Modell wechselt.
 */
const SYNTHESIS_PRIMARY_TIMEOUT_MS = 15_000;

class SynthesisTimeoutError extends Error {}

/**
 * Modell-Rennen-/Timeout-Logik (Sonnet 5 mit Haiku-4.5-Rückfalloption, siehe
 * `SYNTHESIS_PRIMARY_TIMEOUT_MS`) — gemeinsam genutzt vom Einzel-Call-Pfad
 * (`synthesizeDueDiligence`) und vom Batch-Pfad (`synthesizeDueDiligenceBatch`), da
 * jeder einzelne Claude-Aufruf (ob für alle Dokumente auf einmal oder nur einen Batch)
 * demselben Zeitdruck unterliegt. Gibt den rohen Tool-Input als JSON-Text zurück, der
 * ANSCHLIESSEND unterschiedlich geparst wird (`parseSynthesisResponse` vs.
 * `parseSynthesisBatchResponse`).
 */
async function callSynthesisModel(system: string, knownFields: SynthesisKnownField[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  const tools = [{ name: SYNTHESIS_TOOL_NAME, description: "Nimmt das Due-Diligence-Syntheseergebnis entgegen.", input_schema: buildSynthesisToolSchema(knownFields) }];

  const client = new Anthropic({ apiKey });
  const callModel = (model: string, signal?: AbortSignal) =>
    client.messages.create(
      {
        model,
        max_tokens: 8192,
        system,
        tools,
        tool_choice: { type: "tool", name: SYNTHESIS_TOOL_NAME },
        messages: [{ role: "user", content: "Erstelle die Due-Diligence-Synthese gemäss den Anweisungen im System-Prompt und rufe das Tool mit dem Ergebnis auf." }],
      },
      { signal },
    );

  const primaryController = new AbortController();
  let response;
  try {
    response = await Promise.race([
      callModel(SYNTHESIS_MODEL_PRIMARY, primaryController.signal),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new SynthesisTimeoutError()), SYNTHESIS_PRIMARY_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    if (!(err instanceof SynthesisTimeoutError)) throw err;
    primaryController.abort();
    response = await callModel(SYNTHESIS_MODEL_FALLBACK);
  }

  if (response.stop_reason === "max_tokens") {
    throw new Error("Antwort von Claude wurde bei max_tokens abgeschnitten — vermutlich zu viele/umfangreiche Dokumente für eine einzelne Synthese.");
  }

  // Erzwungener Tool-Aufruf statt Freitext-JSON — siehe Begründung in dueDiligenceExtraction.ts.
  const toolUseBlock = response.content.find((block) => block.type === "tool_use" && block.name === SYNTHESIS_TOOL_NAME);
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") throw new Error("Keine strukturierte Antwort (Tool-Aufruf) von Anthropic erhalten");

  return JSON.stringify(toolUseBlock.input);
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
  const system = buildSynthesisPrompt(promptDocuments, knownFacts, knownFields);
  const jsonText = await callSynthesisModel(system, knownFields);
  return parseSynthesisResponse(jsonText, documents, knownFields);
}

/**
 * Synthetisiert EINEN Batch (siehe `splitDocumentsIntoBatches`) — `focusDocuments`
 * werden vollständig ausgewertet (eigene categories/findings), `otherDocuments` gehen
 * nur als Fakten-Quervergleichskontext in den Prompt (siehe `buildSynthesisPrompt`).
 * Das Ergebnis ist absichtlich ein `PartialSynthesisResult`, kein vollständiges
 * `DueDiligenceResult` — Kategorie-Auffüllung/`overallStatus`/`missingDocuments`
 * passieren erst einmalig nach dem Merge ALLER Batches (`mergeDueDiligenceBatches`).
 */
export async function synthesizeDueDiligenceBatch(
  focusDocuments: SynthesisDocumentInput[],
  otherDocuments: SynthesisDocumentInput[],
  knownFacts: SynthesisKnownFact[],
  knownFields: SynthesisKnownField[],
): Promise<PartialSynthesisResult> {
  const system = buildSynthesisPrompt(focusDocuments, knownFacts, knownFields, otherDocuments);
  const jsonText = await callSynthesisModel(system, knownFields);
  return parseSynthesisBatchResponse(jsonText, [...focusDocuments, ...otherDocuments], knownFields);
}

/**
 * Führt die Ergebnisse aller Batches zu einem vollständigen `DueDiligenceResult`
 * zusammen — reine Berechnung, KEIN weiterer Claude-Aufruf (siehe Plan/DECISIONS.md).
 * Kommt dieselbe Kategorie aus mehreren Batches (kann bei >1 Batch vorkommen, wenn zwei
 * Fokus-Dokumente verschiedener Batches derselben Kategorie zugeordnet sind), werden
 * die Funde zusammengelegt und der schlechtere (schwerwiegendere) Status gewinnt —
 * ein einzelner "unauffällig"-Befund aus einem Batch darf ein "Risiko" aus einem
 * anderen Batch nicht überdecken. `allDocuments` sollte die VOLLSTÄNDIGE, nicht nur die
 * batch-gedeckelte Dokumentenliste sein (für korrektes `missingDocuments`).
 */
export function mergeDueDiligenceBatches(batchResults: PartialSynthesisResult[], allDocuments: SynthesisDocumentInput[]): DueDiligenceResult {
  const categoryByName = new Map<DueDiligenceCategory, DueDiligenceCategoryResult>();
  for (const batch of batchResults) {
    for (const c of batch.categories) {
      const existing = categoryByName.get(c.category);
      if (!existing) {
        categoryByName.set(c.category, { category: c.category, status: c.status, findings: [...c.findings] });
        continue;
      }
      existing.findings.push(...c.findings);
      if (SEVERITY_SORT_WEIGHT[c.status] < SEVERITY_SORT_WEIGHT[existing.status]) existing.status = c.status;
    }
  }
  const categories = fillMissingCategories([...categoryByName.values()], allDocuments);

  return {
    overallStatus: computeOverallStatus(categories),
    overallSummary: batchResults
      .map((b) => b.overallSummary)
      .filter((s) => s.trim().length > 0)
      .join("\n\n"),
    categories,
    missingDocuments: computeMissingDocuments(allDocuments.map((d) => d.documentType)),
    sellerQuestions: batchResults.flatMap((b) => b.sellerQuestions),
    fieldUpdateProposals: batchResults.flatMap((b) => b.fieldUpdateProposals),
    contradictions: batchResults.flatMap((b) => b.contradictions),
  };
}
