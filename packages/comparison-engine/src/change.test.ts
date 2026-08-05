import { describe, it, expect } from "vitest";
import { computeChange } from "./change";

describe("computeChange (Preis- und Scoreveränderung, Abschnitt 20)", () => {
  it("rechnet absolute und relative Veränderung", () => {
    const result = computeChange(3_450_000, 3_200_000);
    expect(result.deltaAbsolute).toBe(-250_000);
    expect(result.deltaPercent).toBeCloseTo((-250_000 / 3_450_000) * 100, 6);
  });

  it("funktioniert auch für Score-Veränderungen (kleinere Zahlen)", () => {
    const result = computeChange(66, 84);
    expect(result.deltaAbsolute).toBe(18);
    expect(result.deltaPercent).toBeCloseTo((18 / 66) * 100, 6);
  });

  it("vermeidet Division durch 0, wenn der vorherige Wert 0 war", () => {
    const result = computeChange(0, 100);
    expect(result.deltaAbsolute).toBe(100);
    expect(result.deltaPercent).toBe(0);
  });
});
