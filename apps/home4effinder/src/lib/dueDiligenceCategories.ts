import type { DueDiligenceCategory } from "@landfinder/domain";

/**
 * Einzige Quelle für die neun Due-Diligence-Kategorien, deren Anzeige-Reihenfolge und
 * deren deutsches Label — vorher an drei Stellen dupliziert (Synthese-Prompt,
 * `DueDiligencePanel`, Dokumenttyp-Katalog-Rendering). Jeder Dokumenttyp trägt in
 * `documentTypes.ts` bereits eine `defaultCategory` aus genau dieser Liste, sodass sich
 * sowohl Dokumente als auch DD-Befunde nach demselben Schema gruppieren lassen.
 */
export const CATEGORY_ORDER: DueDiligenceCategory[] = [
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

export const CATEGORY_LABEL: Record<DueDiligenceCategory, string> = {
  GRUNDBUCH_RECHTE: "Grundbuch/Rechte",
  STWEG: "STWEG",
  ERNEUERUNGSFONDS: "Erneuerungsfonds",
  GEBAEUDE_SANIERUNGEN: "Gebäude/Sanierungen",
  MIETVERHAELTNIS: "Mietverhältnis",
  NEBENKOSTEN: "Nebenkosten",
  HEIZUNG_ENERGIE: "Heizung/Energie",
  TECHNISCHE_UNTERLAGEN: "Technische Unterlagen",
  DOKUMENTENVOLLSTAENDIGKEIT: "Dokumentenvollständigkeit",
};
