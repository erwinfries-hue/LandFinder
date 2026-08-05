import { describe, it, expect } from "vitest";
import { linearBandScore, withinRangeScore, discreteLevelScore } from "./scoreHelpers";

describe("linearBandScore", () => {
  it("interpoliert linear zwischen floor und ceiling", () => {
    expect(linearBandScore(3.5, 2, 5, 12)).toBe(6);
  });

  it("clampt auf 0 unterhalb floor (höher ist besser)", () => {
    expect(linearBandScore(1, 2, 5, 12)).toBe(0);
  });

  it("clampt auf maxPoints oberhalb ceiling (höher ist besser)", () => {
    expect(linearBandScore(10, 2, 5, 12)).toBe(12);
  });

  it("funktioniert auch invertiert (tiefer ist besser)", () => {
    expect(linearBandScore(2.0, 2.0, 0.3, 5)).toBe(0);
    expect(linearBandScore(0.3, 2.0, 0.3, 5)).toBe(5);
    expect(linearBandScore(1.15, 2.0, 0.3, 5)).toBeCloseTo(2.5, 6);
  });

  it("gibt maxPoints zurück, wenn floor = ceiling und value >= floor", () => {
    expect(linearBandScore(5, 5, 5, 10)).toBe(10);
    expect(linearBandScore(4, 5, 5, 10)).toBe(0);
  });
});

describe("withinRangeScore", () => {
  it("volle Punktzahl innerhalb des Zielbereichs", () => {
    expect(withinRangeScore(900, 800, 1000, 300, 300, 8)).toBe(8);
  });

  it("fällt unterhalb des Minimums linear über die Toleranz ab", () => {
    expect(withinRangeScore(650, 800, 1000, 300, 300, 8)).toBeCloseTo(4, 6);
  });

  it("fällt oberhalb des Maximums linear über die Toleranz ab", () => {
    expect(withinRangeScore(1150, 800, 1000, 300, 300, 8)).toBeCloseTo(4, 6);
  });
});

describe("discreteLevelScore", () => {
  it("gibt den Punktwert der jeweiligen Stufe zurück", () => {
    const points = { A: 6, B: 4, C: 1 };
    expect(discreteLevelScore("A", points)).toBe(6);
    expect(discreteLevelScore("C", points)).toBe(1);
  });
});
