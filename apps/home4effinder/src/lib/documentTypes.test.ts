import { describe, it, expect } from "vitest";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { DOCUMENT_TYPE_CATALOG, documentTypesByPriority, requiredAndRecommendedDocumentTypes, classifySourceConfidence } from "./documentTypes";

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
  "EXPOSE_INSERAT",
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

  it("genau 9 Priorität-A- und 9 Priorität-B-Dokumenttypen (8 aus der Produktvorgabe + EXPOSE_INSERAT)", () => {
    const byPriority = documentTypesByPriority();
    expect(byPriority.ZWINGEND).toHaveLength(9);
    expect(byPriority.EMPFOHLEN).toHaveLength(9);
    expect(byPriority.OPTIONAL).toHaveLength(1); // SONSTIGES
  });
});

describe("requiredAndRecommendedDocumentTypes", () => {
  it("enthält alle Priorität-A- und -B-Typen, aber nicht SONSTIGES", () => {
    const types = requiredAndRecommendedDocumentTypes();
    expect(types).toHaveLength(18);
    expect(types).not.toContain("SONSTIGES");
    expect(types).toContain("STWEG_PROTOKOLL");
    expect(types).toContain("SINA");
  });
});

describe("classifySourceConfidence", () => {
  it("stuft amtliche/vertragliche Dokumente als HIGH ein", () => {
    (["GRUNDBUCHAUSZUG", "MIETVERTRAG", "JAHRESRECHNUNG", "STWEG_PROTOKOLL", "BUDGET_STWEG", "ERNEUERUNGSFONDS", "NEBENKOSTENABRECHNUNG"] as DueDiligenceDocumentType[]).forEach(
    (type) => expect(classifySourceConfidence(type)).toBe("HIGH"),
    );
  });

  it("stuft Exposé/Inserat und Sonstiges als LOW ein", () => {
    expect(classifySourceConfidence("EXPOSE_INSERAT")).toBe("LOW");
    expect(classifySourceConfidence("SONSTIGES")).toBe("LOW");
  });

  it("stuft unbekannte Quelle (undefined) als LOW ein, nicht MEDIUM", () => {
    expect(classifySourceConfidence(undefined)).toBe("LOW");
  });

  it("stuft übrige Dokumenttypen als MEDIUM ein", () => {
    expect(classifySourceConfidence("GRUNDRISS")).toBe("MEDIUM");
    expect(classifySourceConfidence("HEIZUNG_SERVICE")).toBe("MEDIUM");
  });
});
