import Anthropic from "@anthropic-ai/sdk";
import { AnthropicNotConfiguredError } from "./dueDiligenceExtraction";

/**
 * Grobe Mietwert-Schätzung, wenn kein Dokument einen Mietwert liefert (weder ein
 * bestehender Mietvertrag noch ein Exposé) — auf ausdrücklichen Wunsch, damit das
 * Formular nicht mit einem leeren, unmarkierten Pflichtfeld hängen bleibt. Nutzt Claudes
 * allgemeines Wissen über den Schweizer Mietwohnungsmarkt, KEINE Live-Internetrecherche
 * (kein Websuche-Tool verkabelt — siehe docs/DECISIONS.md für die Abwägung). Deshalb
 * bewusst klar als Annahme im UI markiert ("nichts wird erfunden" bleibt gewahrt, weil
 * der Nutzer die Herkunft transparent sieht und sie jederzeit überschreiben kann).
 */
export interface MarketRentEstimateInput {
  canton: string;
  zimmerzahl?: number;
}

export interface MarketRentEstimateResult {
  wohnungsMieteChfPerMonth: number;
  rationale: string;
}

const MARKET_RENT_TOOL_NAME = "emit_market_rent_estimate";

function buildToolSchema(): { type: "object"; properties: Record<string, unknown>; required: string[] } {
  return {
    type: "object",
    properties: {
      wohnungsMieteChfPerMonth: { type: "number", description: "Geschätzte Netto-Kaltmiete pro Monat in CHF für eine bestehende, durchschnittlich ausgestattete Mietwohnung." },
      rationale: {
        type: "string",
        description: "1-2 Sätze Begründung — muss explizit klarstellen, dass dies eine grobe KI-Schätzung ohne Live-Marktdaten ist, keine echte Marktrecherche.",
      },
    },
    required: ["wohnungsMieteChfPerMonth", "rationale"],
  };
}

export async function estimateMarketRent(input: MarketRentEstimateInput): Promise<MarketRentEstimateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicNotConfiguredError();

  const client = new Anthropic({ apiKey });

  const system = `Du schätzt eine plausible Netto-Kaltmiete für eine bestehende Mietwohnung in der Schweiz. Du hast KEINEN Internetzugriff und führst KEINE Live-Recherche durch — du schätzt ausschliesslich aus deinem allgemeinen Wissen über das ungefähre Mietniveau nach Kanton und Zimmerzahl.

Das ist eine grobe Annahme für ein Formularfeld, keine Marktanalyse — mach das in "rationale" explizit deutlich (z.B. "Grobe Schätzung ohne Live-Daten, bitte gegenprüfen"). Rufe AUSSCHLIESSLICH das Tool "${MARKET_RENT_TOOL_NAME}" auf, ohne zusätzlichen Text.`;

  const userText = `Kanton: ${input.canton}${input.zimmerzahl !== undefined ? `, Zimmerzahl: ${input.zimmerzahl}` : ""}`;

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system,
    tools: [{ name: MARKET_RENT_TOOL_NAME, description: "Nimmt die geschätzte Netto-Kaltmiete entgegen.", input_schema: buildToolSchema() }],
    tool_choice: { type: "tool", name: MARKET_RENT_TOOL_NAME },
    messages: [{ role: "user", content: userText }],
  });

  const toolUseBlock = response.content.find((block) => block.type === "tool_use" && block.name === MARKET_RENT_TOOL_NAME);
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") throw new Error("Keine strukturierte Antwort (Tool-Aufruf) von Anthropic erhalten");

  const parsed = toolUseBlock.input as Record<string, unknown>;
  const wohnungsMieteChfPerMonth = typeof parsed.wohnungsMieteChfPerMonth === "number" ? parsed.wohnungsMieteChfPerMonth : undefined;
  const rationale = typeof parsed.rationale === "string" ? parsed.rationale : "";
  if (wohnungsMieteChfPerMonth === undefined || wohnungsMieteChfPerMonth <= 0) throw new Error("Ungültige Mietschätzung erhalten");

  return { wohnungsMieteChfPerMonth, rationale };
}
