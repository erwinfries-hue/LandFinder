import { describe, it, expect } from "vitest";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { DOCUMENT_TYPE_CATALOG, documentTypesByPriority, requiredAndRecommendedDocumentTypes } from "./documentTypes";

// Vollständige Liste zur Absicherung, dass jeder Domain-Typ auch einen Katalogeintrag hat
// (und umgekehrt) — verhindert, dass ein neuer DueDiligenceDocumentType-Wert vergessen wird.
const ALL_TYPES: DueDiligenceDocumentType[] = [
  "STWEG_PROTOKOLL",
  "JAHRESRECHNUNG",
  "BUDGET_STWEG",
  "ERNEUERUNGSFONDS",
  "STWEG_REGLEMENT",
  "GRUNDBUCHAUSZUG",
  "MIETVERTRAG",
  "NEBENKOSTENABRECHNUNG",
  "GRUNDRISS",
  "GEBAEUDEVERSICHERUNG",
  "HEIZUNG_SERVICE",
  "ENERGIEAUSWEIS",
  "SINA",
  "RENOVATIONSNACHWEIS",
  "BAUBESCHRIEB",
  "PARKPLATZ_UNTERLAGEN",
  "STWEG_BEGRUENDUNG",
  "SONSTIGES",
];

describe("DOCUMENT_TYPE_CATALOG", () => {
  it("enthält für jeden bekannten Dokumenttyp genau einen Eintrag mit konsistentem type-Feld", () => {
    for (const type of ALL_TYPES) {
      expect(DOCUMENT_TYPE_CATALOG[type]).toBeDefined();
      expect(DOCUMENT_TYPE_CATALOG[type].type).toBe(type);
    }
    expect(Object.keys(DOCUMENT_TYPE_CATALOG).sort()).toEqual([...ALL_TYPES].sort());
  });

  it("jeder Eintrag hat nicht-leeres Label, Beschreibung und Extraktionsanleitung", () => {
    for (const config of Object.values(DOCUMENT_TYPE_CATALOG)) {
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.description.length).toBeGreaterThan(0);
      expect(config.extractionGuidance.length).toBeGreaterThan(0);
    }
  });

  it("genau 9 Priorität-A- und 8 Priorität-B-Dokumenttypen, wie in der Produktvorgabe gelistet", () => {
    const byPriority = documentTypesByPriority();
    expect(byPriority.ZWINGEND).toHaveLength(9);
    expect(byPriority.EMPFOHLEN).toHaveLength(8);
    expect(byPriority.OPTIONAL).toHaveLength(1); // SONSTIGES
  });
});

describe("requiredAndRecommendedDocumentTypes", () => {
  it("enthält alle Priorität-A- und -B-Typen, aber nicht SONSTIGES", () => {
    const types = requiredAndRecommendedDocumentTypes();
    expect(types).toHaveLength(17);
    expect(types).not.toContain("SONSTIGES");
    expect(types).toContain("STWEG_PROTOKOLL");
    expect(types).toContain("SINA");
  });
});
