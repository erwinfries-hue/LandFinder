import Anthropic from "@anthropic-ai/sdk";
import plzOrtMultiwordData from "../../../../config/plz-ort-multiword.json";

/**
 * Extraktion strukturierter Felder aus einer Inserat-Detailseite (Stufe 2). Läuft
 * standardmässig im Demo-/Mock-Modus (Masterdokument, Punkt 3.1/30: "Bis zur Klärung
 * [des LLM-Providers] läuft alles im Demo-Modus gegen die Mock-LLM-Implementierung"),
 * bis `ANTHROPIC_API_KEY` gesetzt ist (docs/OPEN_DECISIONS.md, Punkt B) — dann ohne
 * Code-Änderung automatisch mit echter Extraktion.
 */

const SWISS_CANTONS = ["ZH", "BE", "LU", "UR", "SZ", "OW", "NW", "GL", "ZG", "FR", "SO", "BS", "BL", "SH", "AR", "AI", "SG", "GR", "AG", "TG", "TI", "VD", "VS", "NE", "GE", "JU"];

export interface ExtractedListingFields {
  title?: string;
  description?: string;
  objectType?: "BAULAND" | "ABBRUCHOBJEKT";
  addressText?: string;
  canton?: string;
  askingPriceChf?: number;
  parcelAreaM2?: number;
  knownZone?: string;
}

export type ExtractionMethod = "MOCK_HEURISTIC" | "EMAIL_HEURISTIC" | "ANTHROPIC";

export interface ExtractionResult {
  fields: ExtractedListingFields;
  method: ExtractionMethod;
  /** Grobe, methodenabhängige Einschätzung (0-100) — keine Formel, siehe Abschnitt 8. */
  confidence: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    // Numerische HTML-Entities (z.B. "&#847;") vor der Textanalyse entfernen statt
    // dekodieren: manche Suchabo-Mails enthalten sie wiederholt als unsichtbaren
    // Anti-Spam-Füllstoff (Bug gefunden 2026-08-11: die dekodierten, unsichtbaren
    // Zeichen erschienen als literaler "&#847; &#847; ..."-Müll in der Beschreibung).
    .replace(/&#x[0-9a-f]+;/gi, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Unterhalb dieser Schwelle ist ein per Regex gefundener "CHF"-Betrag mit hoher
 * Sicherheit kein Kaufpreis für Bauland/Abbruchobjekt, sondern ein Fehltreffer (z.B.
 * eine Monatsmiete oder eine Nebenangabe) — dann lieber weglassen als einen falschen
 * Preis zu speichern (Bug gefunden 2026-08-11, echte Produktionsdaten: "CHF 1'150" als
 * Kaufpreis übernommen). Konsistent mit "nichts wird erfunden".
 */
const MIN_PLAUSIBLE_PRICE_CHF = 50_000;

function plausiblePrice(value: number | undefined): number | undefined {
  return value !== undefined && value >= MIN_PLAUSIBLE_PRICE_CHF ? value : undefined;
}

/**
 * Mehrwortige Ortsnamen je PLZ (config/plz-ort-multiword.json, dieselbe Quelle wie
 * plzKanton.ts: Swiss-Post-PLZ-Verzeichnis via github.com/gamba/swiss-geolocation) —
 * z.B. "8545": ["Rickenbach Sulz", "Rickenbach ZH"]. Nur PLZ mit mindestens einem
 * mehrwortigen Ortsnamen sind enthalten; einwortige Ortsnamen deckt die einfache
 * Regex unten bereits sicher ab.
 */
const PLZ_ORT_MULTIWORD: Record<string, string[]> = plzOrtMultiwordData;

/**
 * Liest den Ortsnamen direkt nach einer erkannten PLZ. Prüft zuerst gegen die
 * bekannten, echten Ortsnamen für genau diese PLZ (längster zuerst) — sicherer als
 * eine zweite grossgeschriebene Wortfolge zu raten, die z.B. bei "... 4414
 * Füllinsdorf Anbieter kontaktieren" fälschlich "Anbieter" mit einbeziehen würde.
 * Ohne bekannten Treffer bleibt es beim sicheren einzelnen Wort (kein Rateversuch
 * über die Wortgrenze hinaus).
 */
function captureOrt(textAfterPlz: string, plz: string): string | undefined {
  const known = PLZ_ORT_MULTIWORD[plz];
  if (known) {
    for (const name of [...known].sort((a, b) => b.length - a.length)) {
      const boundaryChar = textAfterPlz[name.length];
      if (textAfterPlz.startsWith(name) && (boundaryChar === undefined || /\s/.test(boundaryChar))) {
        return name;
      }
    }
  }
  return textAfterPlz.match(/^[A-ZÄÖÜ][\wÀ-ÿ.-]*/)?.[0];
}

/**
 * Adresse aus Fliesstext: bevorzugt Strasse + Hausnummer + PLZ + Ort, fällt sonst auf
 * reine PLZ + Ort zurück. Anlass (2026-08-16, echter Treffer): manche Suchabo-Mails
 * nennen aus Datenschutz-/Lead-Gen-Gründen nur den Ort, nicht die genaue Strasse (z.B.
 * "8545 Rickenbach Sulz") — bisher blieb so eine Adresse komplett unextrahiert, obwohl
 * der Ort im Mailtext stand.
 */
function matchAddress(text: string): string | undefined {
  const withStreet = text.match(/([A-ZÄÖÜ][\wÀ-ÿ.\- ]{1,40}?\s\d{1,4}[a-z]?)\s+(\d{4})\s+(?=[A-ZÄÖÜ])/);
  if (withStreet) {
    const plz = withStreet[2];
    const ort = captureOrt(text.slice(withStreet.index! + withStreet[0].length), plz);
    if (ort) return `${withStreet[1].trim()}, ${plz} ${ort}`;
  }

  const plzOnly = text.match(/\b(\d{4})\s+(?=[A-ZÄÖÜ])/);
  if (plzOnly) {
    const plz = plzOnly[1];
    const ort = captureOrt(text.slice(plzOnly.index! + plzOnly[0].length), plz);
    if (ort) return `${plz} ${ort}`;
  }

  return undefined;
}

/**
 * Regelbasierte Mindest-Extraktion ohne LLM — bewusst simpel und nur das, was sich
 * mit hoher Sicherheit aus dem Text lesen lässt. Erfindet nie einen Wert: fehlt ein
 * Muster im Text, bleibt das Feld undefined statt geraten.
 */
export function extractWithHeuristic(html: string): ExtractionResult {
  const text = stripHtml(html);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  const priceMatch = text.match(/CHF\s*([\d'’.]{4,})/i);
  const askingPriceChf = plausiblePrice(priceMatch ? Number(priceMatch[1].replace(/[^\d]/g, "")) || undefined : undefined);

  const areaMatch = text.match(/([\d'’]{2,})\s*m[²2]/i);
  const parcelAreaM2 = areaMatch ? Number(areaMatch[1].replace(/[^\d]/g, "")) || undefined : undefined;

  const cantonMatch = SWISS_CANTONS.find((code) => new RegExp(`\\b${code}\\b`).test(text));

  const objectType = /abbruch|rückbau|abriss/i.test(text) ? "ABBRUCHOBJEKT" : /bauland|baulandparzelle|unbebaut/i.test(text) ? "BAULAND" : undefined;

  return {
    fields: {
      title: titleMatch?.[1]?.trim(),
      description: text.slice(0, 400) || undefined,
      objectType,
      canton: cantonMatch,
      askingPriceChf,
      parcelAreaM2,
    },
    method: "MOCK_HEURISTIC",
    confidence: 25,
  };
}

export interface AlertMailContent {
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

/**
 * Extrahiert Basisfelder direkt aus dem Inhalt der Suchabo-Mail selbst (Betreff +
 * Text) — ohne externen Seitenabruf. Anlass (2026-08-08): Homegate-Suchabo-Mails
 * zeigen Preis und Adresse bereits im Mailtext an, aber der echte "Zum Inserat"-Link
 * läuft über einen E-Mail-Marketing-Tracking-Dienst (z.B. SendGrid Click-Tracking),
 * nicht über eine homegate.ch-Domain — unser Link-Filter (siehe inboundMail.ts)
 * erkennt ihn deshalb nicht, und Stufe 2 hätte ohnehin nur Bild-/Logo-Links abgerufen.
 * Sicherer als einer unbekannten Tracking-Domain zu folgen.
 *
 * Bewusst konservativ: Kanton wird NICHT aus dem Betreff geraten, weil Suchabo-Mails
 * oft mehrere Kantone gleichzeitig auflisten (die Suchkriterien, nicht die Lage des
 * konkreten Treffers) — eine falsche Zuordnung wäre schlimmer als keine Angabe.
 *
 * Aus demselben Grund: enthält die Mail mehrere Treffer ("3 neue Treffer"), lassen sich
 * Preis/Adresse/Fläche im Fliesstext keinem der Treffer sicher zuordnen (welcher der
 * drei?) — dann werden auch diese Felder nicht extrahiert (Bug gefunden 2026-08-11).
 */
const MULTI_MATCH_SUBJECT_PATTERN = /(\d+)\s+neue?r?\s+Treffer/i;

export function extractFromEmailContent(mail: AlertMailContent): ExtractionResult {
  const text = stripHtml(`${mail.subject}\n${mail.htmlBody ?? mail.textBody ?? ""}`);
  const matchCount = Number(mail.subject.match(MULTI_MATCH_SUBJECT_PATTERN)?.[1] ?? "1");
  const isMultiMatch = matchCount > 1;

  const priceMatch = isMultiMatch ? null : text.match(/CHF\s*([\d'’.]{4,})/i);
  const askingPriceChf = plausiblePrice(priceMatch ? Number(priceMatch[1].replace(/[^\d]/g, "")) || undefined : undefined);

  const areaMatch = isMultiMatch ? null : text.match(/([\d'’]{2,})\s*m[²2]/i);
  const parcelAreaM2 = areaMatch ? Number(areaMatch[1].replace(/[^\d]/g, "")) || undefined : undefined;

  const addressText = isMultiMatch ? undefined : matchAddress(text);

  const objectType = /abbruch|rückbau|abriss/i.test(text) ? "ABBRUCHOBJEKT" : /bauland|baulandparzelle|unbebaut/i.test(text) ? "BAULAND" : undefined;

  return {
    fields: {
      title: mail.subject || undefined,
      description: text.slice(0, 400) || undefined,
      objectType,
      addressText,
      askingPriceChf,
      parcelAreaM2,
    },
    method: "EMAIL_HEURISTIC",
    confidence: 30,
  };
}

const EXTRACTION_SYSTEM_PROMPT = `Du extrahierst strukturierte Immobilien-Inseratsdaten aus Schweizer Portalseiten (Homegate, ImmoScout24, newhome). Gib ausschliesslich ein JSON-Objekt zurück, ohne Erklärtext, mit genau diesen Feldern (jedes optional, weglassen statt raten, wenn nicht im Text vorhanden):
{"title": string, "description": string (max. 400 Zeichen Zusammenfassung), "objectType": "BAULAND" | "ABBRUCHOBJEKT", "addressText": string, "canton": string (2-Buchstaben-Kürzel, z.B. ZH), "askingPriceChf": number, "parcelAreaM2": number, "knownZone": string}
Erfinde nie einen Wert, der nicht im Text steht.`;

async function extractWithAnthropic(html: string, apiKey: string): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey });
  const text = stripHtml(html).slice(0, 15_000);

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Keine Text-Antwort von Anthropic erhalten");

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Keine JSON-Struktur in der Anthropic-Antwort gefunden");

  const fields = JSON.parse(jsonMatch[0]) as ExtractedListingFields;
  return { fields, method: "ANTHROPIC", confidence: 65 };
}

export async function extractListingFields(html: string): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      return await extractWithAnthropic(html, apiKey);
    } catch (err) {
      console.error("[listingExtraction] Anthropic-Extraktion fehlgeschlagen, Fallback auf Heuristik", err);
    }
  }
  return extractWithHeuristic(html);
}
