import { describe, it, expect } from "vitest";
import { bisectRoot, netPresentValue, internalRateOfReturn } from "./numeric";

describe("bisectRoot", () => {
  it("findet die Nullstelle einer linearen Funktion", () => {
    expect(bisectRoot((x) => x - 5, -100, 100)).toBeCloseTo(5, 1);
  });

  it("liefert undefined, wenn kein Vorzeichenwechsel im Intervall liegt", () => {
    expect(bisectRoot((x) => x * x + 1, -100, 100)).toBeUndefined();
  });

  it("liefert die Intervallgrenze direkt, wenn sie bereits (annähernd) die Nullstelle ist", () => {
    expect(bisectRoot((x) => x, 0, 100)).toBe(0);
  });
});

describe("netPresentValue", () => {
  it("Periode 0 wird nicht abgezinst, spätere Perioden schon", () => {
    expect(netPresentValue([100], 10)).toBe(100);
    expect(netPresentValue([0, 110], 10)).toBeCloseTo(100, 5);
  });
});

describe("internalRateOfReturn", () => {
  it("berechnet die IRR einer einfachen Ein-Perioden-Investition (1000 → 1100 nach 1 Jahr = 10%)", () => {
    expect(internalRateOfReturn([-1000, 1100])).toBeCloseTo(10, 1);
  });

  it("berechnet die IRR über mehrere Perioden mit unregelmässigen Cashflows", () => {
    const cashflows = [-1000, 50, 50, 50, 1100]; // Investition, 3 Jahre Ertrag, Exit im 4. Jahr
    const irr = internalRateOfReturn(cashflows);
    expect(irr).toBeDefined();
    expect(netPresentValue(cashflows, irr!)).toBeCloseTo(0, 0);
  });

  it("liefert undefined bei durchgehend positiven Cashflows (keine Investition, keine sinnvolle IRR)", () => {
    expect(internalRateOfReturn([100, 100, 100])).toBeUndefined();
  });
});
