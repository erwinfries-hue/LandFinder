import { describe, it, expect } from "vitest";
import { scoreMarkt } from "./markt";

describe("scoreMarkt (Abschnitt 15, max. 15 Punkte)", () => {
  it("rechnet alle vier Teilkategorien korrekt (Default-Parameter, Werte in Bandmitte)", () => {
    const result = scoreMarkt({
      vacancyRatePercent: 1.15, // Band 2.0..0.3 -> Mitte
      populationGrowth3yPercent: 4, // Band 0..8 -> Mitte
      rentLevelRatio: 1.0, // Band 0.85..1.15 -> Mitte
      constructionActivityRatePercent: 1.75, // Band 3.0..0.5 -> Mitte
    });

    expect(result.leerstand).toBeCloseTo(2.5, 6);
    expect(result.bevoelkerungHaushalte).toBeCloseTo(2, 6);
    expect(result.mietniveau).toBeCloseTo(1.5, 6);
    expect(result.bautaetigkeit).toBeCloseTo(1.5, 6);
    expect(result.total).toBeCloseTo(7.5, 6);
  });
});
