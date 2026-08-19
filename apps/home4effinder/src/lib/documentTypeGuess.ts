import type { DueDiligenceDocumentType } from "@landfinder/domain";

/**
 * Errät den Dokumenttyp aus dem Dateinamen — reine Vorausfüllung für die
 * Upload-Maske (`PropertyCreateForm`, `DueDiligencePanel`), NICHT die eigentliche
 * Dokumentenklassifizierung: der Nutzer sieht den Vorschlag immer als editierbares
 * Auswahlfeld und kann ihn vor dem Hochladen korrigieren. Trifft keine Regel zu, bleibt
 * der Aufrufer für den Fallback (z.B. zuletzt gewählter Typ oder "SONSTIGES")
 * verantwortlich — diese Funktion rät nie auf gut Glück, sie liefert `undefined`.
 *
 * Regeln sind bewusst nach Spezifität geordnet und werden der Reihe nach geprüft (erste
 * passende Regel gewinnt) — z.B. "Betriebskosten" + "Wohnung" vor blossem
 * "Betriebskosten", da ersteres eindeutig die individuelle Nebenkostenabrechnung der
 * Wohnung meint, nicht die STWEG-weite Jahresrechnung.
 */

interface Rule {
  type: DueDiligenceDocumentType;
  /** Jedes Wort muss im (kleingeschriebenen, normalisierten) Dateinamen vorkommen. */
  all: string[];
}

const RULES: Rule[] = [
  { type: "NEBENKOSTENABRECHNUNG", all: ["betriebskosten", "wohnung"] },
  { type: "NEBENKOSTENABRECHNUNG", all: ["nebenkosten", "wohnung"] },
  { type: "STWEG_BEGRUENDUNG", all: ["begruendung"] },
  { type: "STWEG_BEGRUENDUNG", all: ["wertquote"] },
  { type: "STWEG_REGLEMENT", all: ["reglement"] },
  { type: "STWEG_PROTOKOLL", all: ["protokoll"] },
  { type: "STWEG_PROTOKOLL", all: ["gv"] },
  { type: "BUDGET_STWEG", all: ["budget"] },
  { type: "ERNEUERUNGSFONDS", all: ["erneuerungsfonds"] },
  { type: "ERNEUERUNGSFONDS", all: ["kapital", "zins"] },
  { type: "JAHRESRECHNUNG", all: ["jahresrechnung"] },
  { type: "JAHRESRECHNUNG", all: ["betriebskosten"] },
  { type: "GRUNDBUCHAUSZUG", all: ["grundbuch"] },
  { type: "MIETVERTRAG", all: ["mietvertrag"] },
  { type: "GRUNDRISS", all: ["grundriss"] },
  { type: "GEBAEUDEVERSICHERUNG", all: ["versicherung"] },
  { type: "GEBAEUDEVERSICHERUNG", all: ["police"] },
  { type: "GEBAEUDEVERSICHERUNG", all: ["agv"] },
  { type: "HEIZUNG_SERVICE", all: ["heizung"] },
  { type: "HEIZUNG_SERVICE", all: ["heiz"] },
  { type: "ENERGIEAUSWEIS", all: ["energieausweis"] },
  { type: "ENERGIEAUSWEIS", all: ["geak"] },
  { type: "SINA", all: ["sina"] },
  { type: "SINA", all: ["elektrokontrolle"] },
  { type: "RENOVATIONSNACHWEIS", all: ["sanierung"] },
  { type: "RENOVATIONSNACHWEIS", all: ["renovation"] },
  { type: "BAUBESCHRIEB", all: ["baubeschrieb"] },
  { type: "PARKPLATZ_UNTERLAGEN", all: ["parkplatz"] },
  { type: "PARKPLATZ_UNTERLAGEN", all: ["garage"] },
  { type: "EXPOSE_INSERAT", all: ["expose"] },
  { type: "EXPOSE_INSERAT", all: ["inserat"] },
];

/** Kleinschreibung, Akzente/Umlaute entfernt (é→e, ä→a, …), in Einzelwörter zerlegt — macht "PDF_Exposé_.pdf" zu ["pdf", "expose", "pdf"] für den Wortabgleich. */
function wordsOf(filename: string): string[] {
  const stripped = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return stripped.split(/[^a-z0-9]+/).filter(Boolean);
}

export function guessDocumentType(filename: string): DueDiligenceDocumentType | undefined {
  const words = wordsOf(filename);
  // Präfix- statt Exaktvergleich: deutsche Flexionsformen (Sanierung/Sanierungen,
  // Grundriss/Grundrisse, Versicherung/Versicherungen, …) sollen dieselbe Regel treffen.
  const matches = (keyword: string) => words.some((w) => w.startsWith(keyword));
  for (const rule of RULES) {
    if (rule.all.every(matches)) return rule.type;
  }
  return undefined;
}
