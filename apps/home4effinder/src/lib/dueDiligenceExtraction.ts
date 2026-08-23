import Anthropic from "@anthropic-ai/sdk";
import type { DocumentBasisdaten, DocumentExtractionResult, DueDiligenceDocumentType, DueDiligenceFinding } from "@landfinder/domain";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";
import { AVAILABLE_CANTONS } from "./cantons";

/**
 * Stufe 1 der Dokumenten-KI: Extraktion aus einem einzelnen hochgeladenen Dokument.
 * Nutzt Claudes native PDF-Unterstützung (Dokument direkt als Base64 im
 * Message-Content, kein separater OCR-Dienst) — deckt damit auch gescannte/Bild-PDFs
 * ab (Claude liest zusätzlich die gerenderten Seiten als Bild).
 *
 * Es gibt bewusst **keinen** regelbasierten Fallback ohne LLM — ein PDF-Dokument
 * lässt sich nicht per Regex sinnvoll auf STWEG-Risiken/Widersprüche prüfen. Ohne
 * `ANTHROPIC_API_KEY` ist diese Funktion bewusst nicht nutzbar
 * (`AnthropicNotConfiguredError`), statt eine irreführende Pseudo-Analyse zu liefern.
 */

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY ist nicht gesetzt — Dokumentenanalyse benötigt zwingend ein LLM, kein heuristischer Fallback möglich.");
    this.name = "AnthropicNotConfiguredError";
  }
}

/** Anthropics Dokumenten-API akzeptiert PDFs bis zu dieser Grösse (Stand der SDK-Dokumentation) — grösere Dateien vorher ablehnen statt einen unklaren API-Fehler zu riskieren. */
export const MAX_DOCUMENT_SIZE_BYTES = 32 * 1024 * 1024;

/**
 * Eingabequelle für Stufe 1: entweder ein hochgeladenes PDF ODER eingefügter Text (z.B.
 * aus einer E-Mail oder einem Online-Inserat kopiert, ohne dafür erst eine PDF-Datei
 * erzeugen zu müssen). Beide laufen als Anthropic-"document"-Content-Block, nur mit
 * unterschiedlichem `source.type` — der Rest der Extraktion (Prompt, Parsing) ist
 * identisch.
 */
export type DocumentSourceInput = { kind: "pdf"; pdfBase64: string } | { kind: "text"; text: string };

/** Grosszügige, aber sinnvolle Obergrenze für eingefügten Text — verhindert, dass ein versehentlich riesiger Paste den LLM-Aufruf sprengt. */
export const MAX_PASTED_TEXT_LENGTH = 200_000;

function isPdfFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

/** PDF ODER Text-Datei — nach Vorgabe des Nutzers ("Möglichkeit bestehen, Texte einzukopieren") um Klartext-Uploads erweitert, weiterhin keine anderen Formate. */
export function isSupportedDocumentFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || isPdfFilename(name)) return true;
  if (file.type === "text/plain" || name.endsWith(".txt")) return true;
  return false;
}

export function isPdfDocumentFile(file: File): boolean {
  return file.type === "application/pdf" || (file.type !== "text/plain" && isPdfFilename(file.name));
}

const CANTON_CODES = AVAILABLE_CANTONS.map((c) => c.code);

function buildSystemPrompt(documentType: DueDiligenceDocumentType): string {
  const config = DOCUMENT_TYPE_CATALOG[documentType];
  return `Du bist ein Due-Diligence-Assistent für den Kauf einer Schweizer Eigentumswohnung als Rendite-/Buy-to-let-Objekt. Du analysierst genau EIN hochgeladenes Dokument vom Typ "${config.label}".

Aufgabe für diesen Dokumenttyp: ${config.extractionGuidance}

Rufe AUSSCHLIESSLICH das Tool "${EXTRACTION_TOOL_NAME}" mit den extrahierten Daten auf, ohne zusätzlichen Erklärtext. Weicht der tatsächliche Dokumenttyp erkennbar vom oben genannten Typ "${documentType}" ab, trotzdem einen Fund mit severity "KLAERUNGSBEDARF" dazu erzeugen.

Wichtige Regeln:
- Erfinde NIE einen Wert, der nicht im Dokument steht — fehlt eine Information, lasse das Feld weg statt zu schätzen.
- Auch ein abgelehntes, vertagtes oder nur diskutiertes Vorhaben ist ein möglicher zukünftiger Risikofund, nicht nur bereits beschlossene Massnahmen.
- Jeder wichtige Fund braucht nach Möglichkeit sourcePage und sourceQuote, damit der Nutzer die Aussage im Original nachvollziehen kann.
- sourceQuote kurz halten (nur der für den Fund entscheidende Ausschnitt, nicht ganze Absätze/Sätze) — das hält die Antwort handhabbar, gerade bei umfangreichen Dokumenten mit vielen Funden.
- Bei rein positiven/unauffälligen Punkten ist severity "OK" — nicht alles muss ein Risiko sein.
- "basisdaten" komplett weglassen, wenn das Dokument keine dieser Angaben enthält.`;
}

const EXTRACTION_TOOL_NAME = "emit_document_extraction";

/**
 * JSON-Schema für erzwungenen Tool-Aufruf statt Freitext-JSON-in-Prosa — die Anthropic-API
 * validiert/parst `input` serverseitig, wodurch die früher beobachtete Fehlerklasse
 * "SyntaxError: Expected ',' or '}' after property value in JSON" (vermutlich ein nicht
 * korrekt escapetes Zeichen in einem wörtlichen Zitat) strukturell ausgeschlossen ist,
 * statt sie nur nachträglich am Text zu reparieren.
 */
export function buildExtractionToolSchema(): { type: "object"; properties: Record<string, unknown>; required: string[] } {
  return {
    type: "object",
    properties: {
      detectedDocumentType: {
        type: "string",
        enum: Object.keys(DOCUMENT_TYPE_CATALOG),
        description: "Welcher Dokumenttyp das Dokument nach deiner Einschätzung tatsächlich ist.",
      },
      summary: { type: "string", description: "2-4 Sätze, sachliche Zusammenfassung." },
      facts: {
        type: "object",
        description: "Dokumenttypspezifische Fakten als flaches Objekt, z.B. Beträge, Daten, Namen — nur was im Dokument wirklich steht.",
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string", enum: [...KNOWN_CATEGORIES] },
            severity: { type: "string", enum: [...KNOWN_SEVERITIES] },
            summary: { type: "string", description: "Kurz, eine Aussage." },
            detail: { type: "string", description: "Optional, Begründung." },
            sourcePage: { type: "number", description: "Optional, Seitenzahl im Dokument." },
            sourceQuote: { type: "string", maxLength: 280, description: "Optional, kurzes wörtliches Zitat als Beleg — max. ca. 280 Zeichen." },
          },
          required: ["category", "severity", "summary"],
        },
      },
      basisdaten: {
        type: "object",
        description: "Nur mitgeben, wenn das Dokument Objekt-Basisdaten klar erkennbar enthält (typischerweise Exposé/Inserat, manchmal Grundriss/Grundbuchauszug).",
        properties: {
          adresseText: { type: "string", description: "Vollständige Adresse inkl. PLZ/Ort." },
          kantonCode: { type: "string", enum: CANTON_CODES, description: "Zweistelliges Kürzel." },
          kaufpreisChf: { type: "number" },
          wohnflaecheM2: { type: "number" },
        },
      },
    },
    required: ["detectedDocumentType", "summary", "facts", "findings"],
  };
}

const KNOWN_DOCUMENT_TYPES = new Set(Object.keys(DOCUMENT_TYPE_CATALOG));
const KNOWN_CATEGORIES = new Set([
  "GRUNDBUCH_RECHTE",
  "STWEG",
  "ERNEUERUNGSFONDS",
  "GEBAEUDE_SANIERUNGEN",
  "MIETVERHAELTNIS",
  "NEBENKOSTEN",
  "HEIZUNG_ENERGIE",
  "TECHNISCHE_UNTERLAGEN",
  "DOKUMENTENVOLLSTAENDIGKEIT",
]);
const KNOWN_SEVERITIES = new Set(["OK", "KLAERUNGSBEDARF", "RISIKO"]);
const KNOWN_CANTON_CODES = new Set(CANTON_CODES);

/** Defensiv geparst — jedes einzelne Feld wird nur übernommen, wenn Typ und (bei kantonCode) Wertebereich stimmen; alles andere wird stillschweigend weggelassen statt zu raten. */
function parseBasisdaten(raw: unknown): DocumentBasisdaten | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const b = raw as Record<string, unknown>;

  const basisdaten: DocumentBasisdaten = {};
  if (typeof b.adresseText === "string" && b.adresseText.trim()) basisdaten.adresseText = b.adresseText.trim();
  if (typeof b.kantonCode === "string" && KNOWN_CANTON_CODES.has(b.kantonCode.toUpperCase())) basisdaten.kantonCode = b.kantonCode.toUpperCase();
  if (typeof b.kaufpreisChf === "number" && b.kaufpreisChf > 0) basisdaten.kaufpreisChf = b.kaufpreisChf;
  if (typeof b.wohnflaecheM2 === "number" && b.wohnflaecheM2 > 0) basisdaten.wohnflaecheM2 = b.wohnflaecheM2;

  return Object.keys(basisdaten).length > 0 ? basisdaten : undefined;
}

/**
 * Defensiv geparst — jede unerwartete Struktur führt dazu, dass der betroffene Fund
 * (nicht das ganze Ergebnis) übersprungen wird, statt eine falsche Kategorie/Severity
 * zu erfinden ("nichts wird erfunden", konsistent mit dem Rest der Extraktion im
 * Projekt).
 */
export function parseDocumentExtractionResponse(jsonText: string, fallbackDocumentType: DueDiligenceDocumentType): DocumentExtractionResult {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;

  const detectedDocumentType =
    typeof parsed.detectedDocumentType === "string" && KNOWN_DOCUMENT_TYPES.has(parsed.detectedDocumentType)
      ? (parsed.detectedDocumentType as DueDiligenceDocumentType)
      : fallbackDocumentType;

  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const facts = typeof parsed.facts === "object" && parsed.facts !== null ? (parsed.facts as Record<string, unknown>) : {};

  const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
  const findings: DueDiligenceFinding[] = [];
  for (const raw of rawFindings) {
    if (typeof raw !== "object" || raw === null) continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.category !== "string" || !KNOWN_CATEGORIES.has(f.category)) continue;
    if (typeof f.severity !== "string" || !KNOWN_SEVERITIES.has(f.severity)) continue;
    if (typeof f.summary !== "string" || !f.summary) continue;
    findings.push({
      category: f.category as DueDiligenceFinding["category"],
      severity: f.severity as DueDiligenceFinding["severity"],
      summary: f.summary,
      detail: typeof f.detail === "string" ? f.detail : undefined,
      sourcePage: typeof f.sourcePage === "number" ? f.sourcePage : undefined,
      sourceQuote: typeof f.sourceQuote === "string" ? f.sourceQuote : undefined,
    });
  }

  const basisdaten = parseBasisdaten(parsed.basisdaten);

  return { detectedDocumentType, summary, facts, findings, ...(basisdaten ? { basisdaten } : {}) };
}

/**
 * SONSTIGES-Dokumente (keiner Due-Diligence-Kategorie zugeordnet, z.B. Kaufangebot/
 * Finanzierungsbestätigung/Antrag/Katasterplan — bereits von der Stufe-2-Synthese
 * ausgeschlossen, siehe `selectSynthesisPromptDocuments` in dueDiligenceSynthesis.ts)
 * stellen geringere Anforderungen an die Extraktion: im Wesentlichen Objekt-Basisdaten
 * und einfache Fakten, keine nuancierte Risikobewertung wie bei STWEG-Protokollen/
 * Mietverträgen. Dafür reicht das deutlich schnellere und günstigere Haiku-Modell —
 * eine von mehreren Massnahmen gegen die insgesamt lange Wartezeit bei vielen
 * hochgeladenen Dokumenten (siehe docs/DECISIONS.md). Für alle anderen Dokumenttypen
 * bleibt Sonnet 5, wo Qualität/Nuance stärker zählt.
 */
export function resolveExtractionModel(documentType: DueDiligenceDocumentType): string {
  return documentType === "SONSTIGES" ? "claude-haiku-4-5-20251001" : "claude-sonnet-5";
}

export async function extractDocumentFields(
  source: DocumentSourceInput,
  documentType: DueDiligenceDocumentType,
  filename: string,
): Promise<DocumentExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  const client = new Anthropic({ apiKey });

  const documentBlock =
    source.kind === "pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: source.pdfBase64 }, title: filename } as const)
      : ({ type: "document", source: { type: "text", media_type: "text/plain", data: source.text }, title: filename } as const);

  const response = await client.messages.create({
    model: resolveExtractionModel(documentType),
    // War bisher 4096 — bei mehrseitigen, fundreichen Dokumenten (z.B. STWEG-Protokolle
    // mit vielen Einzelfunden inkl. wörtlichem Zitat, Grundbuchauszüge, mehrjährige
    // Betriebskostenaufstellungen) reichte das nicht: die Antwort wurde mitten in der
    // JSON-Struktur abgeschnitten, was je nach Abbruchstelle als "keine Text-Antwort",
    // "keine JSON-Struktur gefunden" oder als JSON.parse-SyntaxError auffiel (echte
    // Produktionsfehler, anhand von Vercel-Logs diagnostiziert). 8192 entspricht dem
    // bereits für die Synthese verwendeten Wert (dueDiligenceSynthesis.ts).
    max_tokens: 8192,
    system: buildSystemPrompt(documentType),
    tools: [{ name: EXTRACTION_TOOL_NAME, description: "Nimmt die Extraktionsdaten für das analysierte Dokument entgegen.", input_schema: buildExtractionToolSchema() }],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [documentBlock, { type: "text", text: "Analysiere dieses Dokument gemäss den Anweisungen im System-Prompt und rufe das Tool mit den extrahierten Daten auf." }],
      },
    ],
  });

  // Explizit prüfen statt nur am fehlenden Tool-Aufruf zu erkennen — liefert im Log sofort
  // die richtige Diagnose ("Dokument zu umfangreich") statt eines irreführenden generischen
  // Fehlers, der wie ein Format-/Prompt-Problem aussieht.
  if (response.stop_reason === "max_tokens") {
    throw new Error(`Antwort von Claude wurde bei max_tokens abgeschnitten — "${filename}" ist vermutlich zu umfangreich für eine einzelne Analyse.`);
  }

  // Erzwungener Tool-Aufruf statt Freitext-JSON: die Anthropic-API liefert `input` bereits
  // als geparstes, valides Objekt — kein `extractFirstJsonObject`/JSON.parse auf rohem
  // Modelltext mehr nötig, und die früher beobachtete Fehlerklasse ungültigen JSONs
  // (vermutlich nicht korrekt escapete Zeichen in einem wörtlichen Zitat) ist damit
  // strukturell ausgeschlossen.
  const toolUseBlock = response.content.find((block) => block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME);
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") throw new Error("Keine strukturierte Antwort (Tool-Aufruf) von Anthropic erhalten");

  return parseDocumentExtractionResponse(JSON.stringify(toolUseBlock.input), documentType);
}
