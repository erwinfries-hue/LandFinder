import { describe, expect, it } from "vitest";
import type { DueDiligenceCategoryResult, DueDiligenceMissingDocument } from "@landfinder/domain";
import { computeInvestmentScore } from "./investmentScore";

function category(status: DueDiligenceCategoryResult["status"]): DueDiligenceCategoryResult {
  return { category: "STWEG", status, findings: [] };
}

describe("computeInvestmentScore", () => {
  it("liefert undefined, solange keine Due-Diligence-Synthese vorliegt", () => {
    expect(computeInvestmentScore({ categories: [], missingDocuments: [], bruttoRenditePercent: 5, cashflowChf: 1000 })).toBeUndefined();
  });

  it("vergibt die volle Punktzahl bei durchweg unauffälligen Kategorien, vollständigen Unterlagen und starker Rendite", () => {
    const categories = Array.from({ length: 9 }, () => category("OK"));
    const result = computeInvestmentScore({ categories, missingDocuments: [], bruttoRenditePercent: 6, cashflowChf: 1000 });
    expect(result).toEqual({ totalScore: 100, dueDiligenceScore: 60, documentationScore: 15, renditeScore: 25 });
  });

  it("vergibt null Punkte bei durchweg riskanten Kategorien, fehlenden Pflichtunterlagen und schwacher Rendite mit negativem Cashflow", () => {
    const categories = Array.from({ length: 9 }, () => category("RISIKO"));
    const missingDocuments: DueDiligenceMissingDocument[] = [
      { documentType: "STWEG_PROTOKOLL", priority: "ZWINGEND" },
      { documentType: "GRUNDBUCHAUSZUG", priority: "ZWINGEND" },
    ];
    const result = computeInvestmentScore({ categories, missingDocuments, bruttoRenditePercent: 1, cashflowChf: -500 });
    expect(result?.dueDiligenceScore).toBe(0);
    expect(result?.renditeScore).toBe(0);
    expect(result?.documentationScore).toBeLessThan(15);
    expect(result?.totalScore).toBeLessThan(20);
  });

  it("gewichtet Klärungsbedarf als halben Kategorie-Anteil", () => {
    const categories = Array.from({ length: 9 }, () => category("KLAERUNGSBEDARF"));
    const result = computeInvestmentScore({ categories, missingDocuments: [], bruttoRenditePercent: 6, cashflowChf: 1000 });
    expect(result?.dueDiligenceScore).toBe(30);
  });

  it("bleibt innerhalb 0-100, auch bei extremen Eingaben", () => {
    const categories = Array.from({ length: 9 }, () => category("OK"));
    const result = computeInvestmentScore({ categories, missingDocuments: [], bruttoRenditePercent: 50, cashflowChf: 1_000_000 });
    expect(result?.totalScore).toBeLessThanOrEqual(100);
  });
});
