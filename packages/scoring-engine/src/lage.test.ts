import { describe, it, expect } from "vitest";
import { scoreLage } from "./lage";

describe("scoreLage (Abschnitt 15, max. 10 Punkte)", () => {
  it("rechnet alle drei Teilkategorien korrekt", () => {
    const result = scoreLage({
      oevGueteklasse: "B",
      reachableResidents30min: 275_000, // Band 50'000..500'000 -> Mitte
      zielmieterFitRatio: 0.6,
    });

    expect(result.oev).toBeCloseTo(4 * 0.7, 6);
    expect(result.erreichbarkeit).toBeCloseTo(1.5, 6);
    expect(result.zielmieterFit).toBeCloseTo(1.8, 6);
    expect(result.total).toBeCloseTo(4 * 0.7 + 1.5 + 1.8, 6);
  });

  it("clampt zielmieterFitRatio auf [0, 1]", () => {
    const overshoot = scoreLage({ oevGueteklasse: "D", reachableResidents30min: 0, zielmieterFitRatio: 1.5 });
    expect(overshoot.zielmieterFit).toBe(3);
    const undershoot = scoreLage({ oevGueteklasse: "D", reachableResidents30min: 0, zielmieterFitRatio: -0.5 });
    expect(undershoot.zielmieterFit).toBe(0);
  });

  it("ÖV-Güteklasse D ergibt 0 Punkte für ÖV", () => {
    const result = scoreLage({ oevGueteklasse: "D", reachableResidents30min: 0, zielmieterFitRatio: 0 });
    expect(result.oev).toBe(0);
  });
});
