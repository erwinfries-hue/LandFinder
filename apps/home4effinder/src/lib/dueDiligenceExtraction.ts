import Anthropic from "@anthropic-ai/sdk";
import type { DocumentBasisdaten, DocumentExtractionResult, DueDiligenceDocumentType, DueDiligenceFinding } from "@landfinder/domain";
import { DOCUMENT_TYPE_CATALOG } from "./documentTypes";
import { AVAILABLE_CANTONS } from "./cantons";
import { extractFirstJsonObject } from "./extractJsonObject";

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

const CANTON_CODES = AVAILABLE_CANTONS.map((c) => c.code);

function buildSystemPrompt(documentType: DueDiligenceDocumentType): string {
  const config = DOCUMENT_TYPE_CATALOG[documentType];
  return `Du bist ein Due-Diligence-Assistent für den Kauf einer Schweizer Eigentumswohnung als Rendite-/Buy-to-let-Objekt. Du analysierst genau EIN hochgeladenes Dokument vom Typ "${config.label}".

Aufgabe für diesen Dokumenttyp: ${config.extractionGuidance}

Gib AUSSCHLIESSLICH ein JSON-Objekt zurück, ohne Erklärtext, mit genau dieser Struktur:
{
  "detectedDocumentType": string (einer von: ${Object.keys(DOCUMENT_TYPE_CATALOG).join(", ")} — welcher Typ das Dokument nach deiner Einschätzung tatsächlich ist; weicht er vom oben genannten Typ "${documentType}" ab, trotzdem einen Fund mit severity "KLAERUNGSBEDARF" dazu erzeugen),
  "summary": string (2-4 Sätze, sachliche Zusammenfassung),
  "facts": object (dokumenttypspezifische Fakten als flaches Objekt, z.B. Beträge, Daten, Namen — nur was im Dokument wirklich steht),
  "findings": [
    {
      "category": string (einer von: GRUNDBUCH_RECHTE, STWEG, ERNEUERUNGSFONDS, GEBAEUDE_SANIERUNGEN, MIETVERHAELTNIS, NEBENKOSTEN, HEIZUNG_ENERGIE, TECHNISCHE_UNTERLAGEN, DOKUMENTENVOLLSTAENDIGKEIT),
      "severity": string (OK, KLAERUNGSBEDARF, oder RISIKO),
      "summary": string (kurz, eine Aussage),
      "detail": string (optional, Begründung),
      "sourcePage": number (optional, Seitenzahl im Dokument),
      "sourceQuote": string (optional, wörtliches Zitat aus dem Dokument als Beleg)
    }
  ],
  "basisdaten": object, optional — nur mitgeben, wenn das Dokument Objekt-Basisdaten klar erkennbar enthält (typischerweise bei Exposé/Inserat, manchmal auch Grundriss/Grundbuchauszug):
  {
    "adresseText": string (optional, vollständige Adresse inkl. PLZ/Ort),
    "kantonCode": string (optional, zweistelliges Kürzel, einer von: ${CANTON_CODES.join(", ")}),
    "kaufpreisChf": number (optional),
    "wohnflaecheM2": number (optional)
  }

Wichtige Regeln:
- Erfinde NIE einen Wert, der nicht im Dokument steht — fehlt eine Information, lasse das Feld weg statt zu schätzen.
- Auch ein abgelehntes, vertagtes oder nur diskutiertes Vorhaben ist ein möglicher zukünftiger Risikofund, nicht nur bereits beschlossene Massnahmen.
- Jeder wichtige Fund braucht nach Möglichkeit sourcePage und sourceQuote, damit der Nutzer die Aussage im Original nachvollziehen kann.
- Bei rein positiven/unauffälligen Punkten ist severity "OK" — nicht alles muss ein Risiko sein.
- "basisdaten" komplett weglassen, wenn das Dokument keine dieser Angaben enthält.`;
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

export async function extractDocumentFields(
  pdfBase64: string,
  documentType: DueDiligenceDocumentType,
  filename: string,
): Promise<DocumentExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    // War bisher 4096 — bei mehrseitigen, fundreichen Dokumenten (z.B. STWEG-Protokolle
    // mit vielen Einzelfunden inkl. wörtlichem Zitat, Grundbuchauszüge, mehrjährige
    // Betriebskostenaufstellungen) reichte das nicht: die Antwort wurde mitten in der
    // JSON-Struktur abgeschnitten, was je nach Abbruchstelle als "keine Text-Antwort",
    // "keine JSON-Struktur gefunden" oder als JSON.parse-SyntaxError auffiel (echte
    // Produktionsfehler, anhand von Vercel-Logs diagnostiziert). 8192 entspricht dem
    // bereits für die Synthese verwendeten Wert (dueDiligenceSynthesis.ts).
    max_tokens: 8192,
    system: buildSystemPrompt(documentType),
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }, title: filename },
          { type: "text", text: "Analysiere dieses Dokument gemäss den Anweisungen im System-Prompt und gib ausschliesslich das beschriebene JSON zurück." },
        ],
      },
    ],
  });

  // Explizit prüfen statt nur am Parse-Fehler zu erkennen — liefert im Log sofort die
  // richtige Diagnose ("Dokument zu umfangreich") statt eines irreführenden
  // JSON-Parse-Fehlers, der wie ein Format-/Prompt-Problem aussieht.
  if (response.stop_reason === "max_tokens") {
    throw new Error(`Antwort von Claude wurde bei max_tokens abgeschnitten — "${filename}" ist vermutlich zu umfangreich für eine einzelne Analyse.`);
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Keine Text-Antwort von Anthropic erhalten");

  const json = extractFirstJsonObject(textBlock.text);
  if (!json) throw new Error("Keine JSON-Struktur in der Anthropic-Antwort gefunden");

  return parseDocumentExtractionResponse(json, documentType);
}
