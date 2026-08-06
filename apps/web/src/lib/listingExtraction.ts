import Anthropic from "@anthropic-ai/sdk";

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

export type ExtractionMethod = "MOCK_HEURISTIC" | "ANTHROPIC";

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
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const askingPriceChf = priceMatch ? Number(priceMatch[1].replace(/[^\d]/g, "")) || undefined : undefined;

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
