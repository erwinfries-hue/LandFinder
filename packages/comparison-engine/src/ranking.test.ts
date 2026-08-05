import { describe, it, expect } from "vitest";
import { rankAndCompare, type ComparisonEntry } from "./ranking";

// Kanton ZG: drei Objekte, absichtlich ohne Gleichstände auf den Extremwerten,
// damit "grösster Vorteil/Nachteil" für B eindeutig auf yieldOnCost/equity zeigt.
const zgA: ComparisonEntry = {
  listingId: "zg-a",
  canton: "ZG",
  metrics: {
    scoreTotal: 80,
    dataConfidenceTotal: 75,
    pricePerM2LandChf: 2100,
    pricePerM2NraChf: 2600,
    totalCostPerM2NraChf: 6100,
    yieldOnCostPercent: 4.0,
    residualValueDifferencePercent: 1,
    equityRequiredChf: 1_300_000,
  },
};
const zgB: ComparisonEntry = {
  listingId: "zg-b",
  canton: "ZG",
  metrics: {
    scoreTotal: 70,
    dataConfidenceTotal: 65,
    pricePerM2LandChf: 2300,
    pricePerM2NraChf: 2800,
    totalCostPerM2NraChf: 6300,
    yieldOnCostPercent: 6.0, // uncontestet bestes yieldOnCost der Gruppe
    residualValueDifferencePercent: 2,
    equityRequiredChf: 1_800_000, // uncontestet schlechtestes (höchstes) Eigenkapital der Gruppe
  },
};
const zgC: ComparisonEntry = {
  listingId: "zg-c",
  canton: "ZG",
  metrics: {
    scoreTotal: 60,
    dataConfidenceTotal: 55,
    pricePerM2LandChf: 2500,
    pricePerM2NraChf: 3000,
    totalCostPerM2NraChf: 6500,
    yieldOnCostPercent: 3.0,
    residualValueDifferencePercent: 3,
    equityRequiredChf: 900_000,
  },
};

const agD: ComparisonEntry = {
  listingId: "ag-d",
  canton: "AG",
  metrics: {
    scoreTotal: 95, // höchster Score über alle Kantone
    dataConfidenceTotal: 90,
    pricePerM2LandChf: 2000,
    pricePerM2NraChf: 2500,
    totalCostPerM2NraChf: 6000,
    yieldOnCostPercent: 5.5,
    residualValueDifferencePercent: 8,
    equityRequiredChf: 1_100_000,
  },
};
const agE: ComparisonEntry = {
  listingId: "ag-e",
  canton: "AG",
  metrics: {
    scoreTotal: 40,
    dataConfidenceTotal: 50,
    pricePerM2LandChf: 2700,
    pricePerM2NraChf: 3200,
    totalCostPerM2NraChf: 6700,
    yieldOnCostPercent: 2.5,
    residualValueDifferencePercent: -5,
    equityRequiredChf: 1_600_000,
  },
};

describe("rankAndCompare (Abschnitt 20)", () => {
  const results = rankAndCompare([zgA, zgB, zgC, agD, agE]);
  const byId = new Map(results.map((r) => [r.listingId, r]));

  it("Gesamtrang läuft über alle Kantone hinweg nach Score", () => {
    expect(byId.get("ag-d")!.overallRank).toBe(1); // 95
    expect(byId.get("zg-a")!.overallRank).toBe(2); // 80
    expect(byId.get("zg-b")!.overallRank).toBe(3); // 70
    expect(byId.get("zg-c")!.overallRank).toBe(4); // 60
    expect(byId.get("ag-e")!.overallRank).toBe(5); // 40
    expect(byId.get("zg-a")!.overallCount).toBe(5);
  });

  it("Kantonsrang und Perzentil sind auf die Kantonsgruppe beschränkt", () => {
    expect(byId.get("zg-a")!.cantonRank).toBe(1);
    expect(byId.get("zg-a")!.cantonCount).toBe(3);
    expect(byId.get("zg-a")!.percentile).toBeCloseTo(100, 6);

    expect(byId.get("zg-b")!.cantonRank).toBe(2);
    expect(byId.get("zg-b")!.percentile).toBeCloseTo(50, 6);

    expect(byId.get("zg-c")!.cantonRank).toBe(3);
    expect(byId.get("zg-c")!.percentile).toBeCloseTo(0, 6);

    expect(byId.get("ag-d")!.cantonRank).toBe(1);
    expect(byId.get("ag-d")!.cantonCount).toBe(2);
  });

  it("Vergleich zum Top-Objekt bezieht sich auf den Kantons-Spitzenreiter", () => {
    const b = byId.get("zg-b")!;
    expect(b.vsTopObject.topListingId).toBe("zg-a");
    expect(b.vsTopObject.scoreDeltaPoints).toBe(-10);
    expect(b.vsTopObject.yieldOnCostDeltaPercent).toBeCloseTo(2.0, 6); // B ist beim Yield on Cost sogar besser als der Score-Spitzenreiter

    const a = byId.get("zg-a")!;
    expect(a.vsTopObject.topListingId).toBe("zg-a");
    expect(a.vsTopObject.scoreDeltaPoints).toBe(0);
  });

  it("grösster Vorteil/Nachteil zeigt die Kennzahl mit dem höchsten/tiefsten Perzentil in der Kantonsgruppe", () => {
    const b = byId.get("zg-b")!;
    expect(b.biggestAdvantage.metric).toBe("yieldOnCostPercent");
    expect(b.biggestAdvantage.percentile).toBeCloseTo(100, 6);
    expect(b.biggestDisadvantage.metric).toBe("equityRequiredChf");
    expect(b.biggestDisadvantage.percentile).toBeCloseTo(0, 6);
  });

  it("bei nur einem aktiven Objekt im Kanton ist das Perzentil trivial 100", () => {
    const solo = rankAndCompare([agD]);
    expect(solo[0].cantonRank).toBe(1);
    expect(solo[0].cantonCount).toBe(1);
    expect(solo[0].percentile).toBe(100);
  });

  it("mit leerer Eingabe gibt es kein Ergebnis", () => {
    expect(rankAndCompare([])).toEqual([]);
  });
});
