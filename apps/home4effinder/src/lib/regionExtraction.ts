import Anthropic from "@anthropic-ai/sdk";
import { AnthropicNotConfiguredError, MAX_DOCUMENT_SIZE_BYTES } from "./dueDiligenceExtraction";
import { AVAILABLE_CANTONS } from "./cantons";

/**
 * Stufe-1-Extraktion für Regionen-/Gemeinde-Marktreports (z.B. Wüest Partner
 * "Standortinformation") — spiegelt `dueDiligenceExtraction.ts::extractDocumentFields`,
 * aber schlanker: es gibt nur EINEN Report-"Typ", kein Dokumenttyp-Katalog nötig, und
 * kein Due-Diligence-Findings-Schema (Regionsdaten sind reine Marktkennzahlen, keine
 * Risikoprüfung eines konkreten Objekts).
 *
 * Extrahiert primär die GEMEINDE-Spalte (die App vergleicht ein Objekt gegen seine
 * eigene Gemeinde, siehe regionMarketData.ts) — zusätzlich, in derselben Kennziffern-
 * Tabelle, auch die KANTON-Vergleichsspalte (`kantonKennzahlen`), als grobe Einordnung
 * "Stadt vs. Kanton" auf der Regionsseite. Die MS-Region-/Schweiz-Vergleichsspalten,
 * die solche Reports zusätzlich enthalten, bleiben bewusst unextrahiert (kein
 * konkreter Bedarf dafür bislang).
 */

export { MAX_DOCUMENT_SIZE_BYTES };

export interface RegionQuantileRow {
  zimmerzahl: number;
  q10: number;
  q30: number;
  q50: number;
  q70: number;
  q90: number;
}

export interface RegionPreisTabelle {
  /** Nettomiete in CHF/m²/Jahr, je Zimmerzahl. */
  mietwohnungen: RegionQuantileRow[];
  /** Kaufpreis in CHF/m², je Zimmerzahl. */
  eigentumswohnungen: RegionQuantileRow[];
  /** Kaufpreis in CHF/m², je Zimmerzahl. */
  einfamilienhaeuser: RegionQuantileRow[];
}

export interface RegionKennzahlen {
  mietePreisVeraenderung3JahrePercent?: number;
  eigentumswohnungPreisVeraenderung3JahrePercent?: number;
  einfamilienhausPreisVeraenderung3JahrePercent?: number;
  bevoelkerungAnzahl?: number;
  bevoelkerungsentwicklung3JahrePercent?: number;
  anzahlHaushalte?: number;
  steuerbelastungSingle60kPercent?: number;
  steuerbelastungPaar120kPercent?: number;
  mietwohnungsbestand?: number;
  eigentumswohnungsbestand?: number;
  einfamilienhausbestand?: number;
  neuErstellteWohnungenProJahr?: number;
  /** "Wohnungsleerstände im Verhältnis zum Bestand" für Mehrfamilienhäuser. */
  leerstandMehrfamilienhaeuserPercent?: number;
  angebotsquoteMietwohnungenPercent?: number;
}

export interface RegionExtractionResult {
  gemeinde: string;
  canton: string;
  /** "Abfragedatum" aus dem Report, ISO (YYYY-MM-DD), falls erkennbar. */
  reportDatum?: string;
  kennzahlen: RegionKennzahlen;
  /** Dieselben Kennzahlen, aber für die Kanton-Vergleichsspalte derselben Tabelle — für die Gemeinde/Kanton-Umschaltung auf der Regionsseite. */
  kantonKennzahlen?: RegionKennzahlen;
  preise: RegionPreisTabelle;
  /** Kurze Fliesstext-Zusammenfassung der Makrolagenbeschreibung, falls im Report vorhanden. */
  makrolagenbeschreibung?: string;
}

const CANTON_CODES = AVAILABLE_CANTONS.map((c) => c.code);
const EXTRACTION_TOOL_NAME = "emit_region_extraction";

function quantileRowSchema() {
  return {
    type: "object",
    properties: {
      zimmerzahl: { type: "number", description: "Zimmerzahl, z.B. 3, 4, 4.5." },
      q10: { type: "number", description: "10%-Quantil." },
      q30: { type: "number", description: "30%-Quantil." },
      q50: { type: "number", description: "50%-Quantil (Median)." },
      q70: { type: "number", description: "70%-Quantil." },
      q90: { type: "number", description: "90%-Quantil." },
    },
    required: ["zimmerzahl", "q10", "q30", "q50", "q70", "q90"],
  };
}

function buildSystemPrompt(): string {
  return `Du extrahierst strukturierte Marktdaten aus einem Gemeinde-/Regions-Standortreport für den Schweizer Immobilienmarkt (z.B. Wüest Partner "Standortinformation").

Solche Reports vergleichen typischerweise mehrere Regionsebenen nebeneinander (Gemeinde, MS-Region, Kanton, Schweiz) in denselben Tabellen. Extrahiere für \`kennzahlen\` AUSSCHLIESSLICH die Spalte/Werte der GEMEINDE (die kleinste, spezifischste gewählte Region — meist die erste Spalte oder explizit als "Gemeinde XY" bezeichnet). Zusätzlich, aus DERSELBEN Tabelle, für \`kantonKennzahlen\` die Spalte/Werte des KANTONS (derselben Feldstruktur wie \`kennzahlen\`) — NICHT die MS-Region- oder Schweiz-Vergleichsspalten, die solche Reports zusätzlich enthalten.

Für \`kennzahlen\`/\`kantonKennzahlen\`: nimm die Werte aus der Zusammenfassungs-/Kennziffern-Tabelle (meist am Anfang des Reports betitelt "Zusammenfassung" oder "Kennziffern Wohnen").

Für \`preise\`: extrahiere die VOLLSTÄNDIGEN Quantil-Tabellen (10/30/50/70/90%-Quantil) je Zimmerzahl aus dem Abschnitt "Preise" — getrennt für Mietwohnungen (Nettomiete CHF/m²/Jahr), Eigentumswohnungen (Kaufpreis CHF/m²) und Einfamilienhäuser (Kaufpreis CHF/m²), jeweils für ALLE im Report vorkommenden Zimmerzahlen dieser Gemeinde (nicht nur eine).

Erfinde NIE einen Wert, der nicht im Dokument steht — fehlt eine Information, lasse das Feld weg statt zu schätzen.

Rufe AUSSCHLIESSLICH das Tool "${EXTRACTION_TOOL_NAME}" mit den extrahierten Daten auf, ohne zusätzlichen Erklärtext.`;
}

function kennzahlenSchema(scopeDescription: string) {
  return {
    type: "object",
    description: `${scopeDescription} aus der Zusammenfassungs-/Kennziffern-Tabelle — nur tatsächlich vorhandene Felder mitgeben.`,
    properties: {
      mietePreisVeraenderung3JahrePercent: { type: "number" },
      eigentumswohnungPreisVeraenderung3JahrePercent: { type: "number" },
      einfamilienhausPreisVeraenderung3JahrePercent: { type: "number" },
      bevoelkerungAnzahl: { type: "number" },
      bevoelkerungsentwicklung3JahrePercent: { type: "number" },
      anzahlHaushalte: { type: "number" },
      steuerbelastungSingle60kPercent: { type: "number" },
      steuerbelastungPaar120kPercent: { type: "number" },
      mietwohnungsbestand: { type: "number" },
      eigentumswohnungsbestand: { type: "number" },
      einfamilienhausbestand: { type: "number" },
      neuErstellteWohnungenProJahr: { type: "number" },
      leerstandMehrfamilienhaeuserPercent: { type: "number", description: "Wohnungsleerstände im Verhältnis zum Bestand, Mehrfamilienhäuser." },
      angebotsquoteMietwohnungenPercent: { type: "number" },
    },
  };
}

function buildExtractionToolSchema(): { type: "object"; properties: Record<string, unknown>; required: string[] } {
  return {
    type: "object",
    properties: {
      gemeinde: { type: "string", description: "Name der Gemeinde, für die dieser Report erstellt wurde." },
      canton: { type: "string", enum: CANTON_CODES, description: "Zweistelliges Kantonskürzel der Gemeinde." },
      reportDatum: { type: "string", description: "Abfragedatum des Reports, als ISO-Datum YYYY-MM-DD, falls im Dokument angegeben." },
      kennzahlen: kennzahlenSchema("Gemeinde-Kennzahlen"),
      kantonKennzahlen: kennzahlenSchema("Kanton-Vergleichsspalten-Kennzahlen (derselbe Report, dieselbe Tabelle, Kanton statt Gemeinde)"),
      preise: {
        type: "object",
        properties: {
          mietwohnungen: { type: "array", items: quantileRowSchema() },
          eigentumswohnungen: { type: "array", items: quantileRowSchema() },
          einfamilienhaeuser: { type: "array", items: quantileRowSchema() },
        },
        required: ["mietwohnungen", "eigentumswohnungen", "einfamilienhaeuser"],
      },
      makrolagenbeschreibung: { type: "string", description: "Kurze (2-4 Sätze) Zusammenfassung der Makrolagenbeschreibung, falls im Report vorhanden." },
    },
    required: ["gemeinde", "canton", "kennzahlen", "preise"],
  };
}

const KNOWN_CANTON_CODES = new Set(CANTON_CODES);

function parseQuantileRows(raw: unknown): RegionQuantileRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: RegionQuantileRow[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const r = entry as Record<string, unknown>;
    const nums = [r.zimmerzahl, r.q10, r.q30, r.q50, r.q70, r.q90];
    if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    rows.push({
      zimmerzahl: r.zimmerzahl as number,
      q10: r.q10 as number,
      q30: r.q30 as number,
      q50: r.q50 as number,
      q70: r.q70 as number,
      q90: r.q90 as number,
    });
  }
  return rows;
}

const KENNZAHLEN_NUMERIC_KEYS: (keyof RegionKennzahlen)[] = [
  "mietePreisVeraenderung3JahrePercent",
  "eigentumswohnungPreisVeraenderung3JahrePercent",
  "einfamilienhausPreisVeraenderung3JahrePercent",
  "bevoelkerungAnzahl",
  "bevoelkerungsentwicklung3JahrePercent",
  "anzahlHaushalte",
  "steuerbelastungSingle60kPercent",
  "steuerbelastungPaar120kPercent",
  "mietwohnungsbestand",
  "eigentumswohnungsbestand",
  "einfamilienhausbestand",
  "neuErstellteWohnungenProJahr",
  "leerstandMehrfamilienhaeuserPercent",
  "angebotsquoteMietwohnungenPercent",
];

function parseKennzahlen(raw: unknown): RegionKennzahlen {
  if (typeof raw !== "object" || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const kennzahlen: RegionKennzahlen = {};
  for (const key of KENNZAHLEN_NUMERIC_KEYS) {
    const v = r[key];
    if (typeof v === "number" && Number.isFinite(v)) kennzahlen[key] = v;
  }
  return kennzahlen;
}

/**
 * Defensiv geparst — unerwartete/fehlende Felder werden weggelassen statt einen Wert zu
 * erfinden oder zu werfen, konsistent mit `parseDocumentExtractionResponse` in
 * dueDiligenceExtraction.ts. Wirft nur, wenn `gemeinde`/`canton` (die einzigen für die
 * Region-Zuordnung zwingenden Felder) fehlen — ein Ergebnis ohne diese wäre nutzlos.
 */
export function parseRegionExtractionResponse(jsonText: string): RegionExtractionResult {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;

  const gemeinde = typeof parsed.gemeinde === "string" ? parsed.gemeinde.trim() : "";
  const cantonRaw = typeof parsed.canton === "string" ? parsed.canton.toUpperCase() : "";
  const canton = KNOWN_CANTON_CODES.has(cantonRaw) ? cantonRaw : "";
  if (!gemeinde || !canton) throw new Error("Extraktion lieferte keine gültige Gemeinde/Kanton-Zuordnung");

  const reportDatumRaw = typeof parsed.reportDatum === "string" ? parsed.reportDatum : undefined;
  const reportDatum = reportDatumRaw && /^\d{4}-\d{2}-\d{2}$/.test(reportDatumRaw) ? reportDatumRaw : undefined;

  const preiseRaw = typeof parsed.preise === "object" && parsed.preise !== null ? (parsed.preise as Record<string, unknown>) : {};
  const preise: RegionPreisTabelle = {
    mietwohnungen: parseQuantileRows(preiseRaw.mietwohnungen),
    eigentumswohnungen: parseQuantileRows(preiseRaw.eigentumswohnungen),
    einfamilienhaeuser: parseQuantileRows(preiseRaw.einfamilienhaeuser),
  };

  const makrolagenbeschreibung = typeof parsed.makrolagenbeschreibung === "string" && parsed.makrolagenbeschreibung.trim() ? parsed.makrolagenbeschreibung.trim() : undefined;

  // Nur mitgeben, wenn tatsächlich mindestens ein Feld erkannt wurde — sonst würde die
  // Gemeinde/Kanton-Umschaltung auf der Regionsseite einen leeren "Kanton"-Tab anzeigen.
  const kantonKennzahlenParsed = parseKennzahlen(parsed.kantonKennzahlen);
  const kantonKennzahlen = Object.keys(kantonKennzahlenParsed).length > 0 ? kantonKennzahlenParsed : undefined;

  return {
    gemeinde,
    canton,
    ...(reportDatum ? { reportDatum } : {}),
    kennzahlen: parseKennzahlen(parsed.kennzahlen),
    ...(kantonKennzahlen ? { kantonKennzahlen } : {}),
    preise,
    ...(makrolagenbeschreibung ? { makrolagenbeschreibung } : {}),
  };
}

export async function extractRegionReport(pdfBase64: string, filename: string): Promise<RegionExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: buildSystemPrompt(),
    tools: [{ name: EXTRACTION_TOOL_NAME, description: "Nimmt die extrahierten Regions-Marktdaten entgegen.", input_schema: buildExtractionToolSchema() }],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }, title: filename },
          { type: "text", text: "Analysiere diesen Regions-/Gemeinde-Standortreport gemäss den Anweisungen im System-Prompt und rufe das Tool mit den extrahierten Daten auf." },
        ],
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error(`Antwort von Claude wurde bei max_tokens abgeschnitten — "${filename}" ist vermutlich zu umfangreich für eine einzelne Analyse.`);
  }

  const toolUseBlock = response.content.find((block) => block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME);
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") throw new Error("Keine strukturierte Antwort (Tool-Aufruf) von Anthropic erhalten");

  return parseRegionExtractionResponse(JSON.stringify(toolUseBlock.input));
}
