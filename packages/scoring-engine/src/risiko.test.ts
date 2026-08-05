import { describe, it, expect } from "vitest";
import { scoreRisiko, type RisikoFlags } from "./risiko";

const noRisks: RisikoFlags = {
  altlasten: false,
  naturgefahren: false,
  gewaesser: false,
  laerm: false,
  planungszone: false,
  zufahrt: false,
  erschliessung: false,
  baukostenrisiken: false,
};

describe("scoreRisiko (Abschnitt 15, max. 10 Punkte)", () => {
  it("ohne Risikofaktoren die volle Punktzahl", () => {
    const result = scoreRisiko(noRisks);
    expect(result.total).toBe(10);
    expect(result.deductionPoints).toBe(0);
    expect(result.triggeredFactors).toEqual([]);
  });

  it("zieht die Default-Punktzahl pro zutreffendem Faktor ab", () => {
    const result = scoreRisiko({ ...noRisks, altlasten: true, laerm: true });
    expect(result.deductionPoints).toBe(4.5);
    expect(result.total).toBe(5.5);
    expect(result.triggeredFactors.sort()).toEqual(["altlasten", "laerm"].sort());
  });

  it("begrenzt den Score nie unter 0, auch wenn die Summe der Abzüge risikoMax übersteigt", () => {
    const allRisks: RisikoFlags = {
      altlasten: true,
      naturgefahren: true,
      gewaesser: true,
      laerm: true,
      planungszone: true,
      zufahrt: true,
      erschliessung: true,
      baukostenrisiken: true,
    };
    const result = scoreRisiko(allRisks);
    expect(result.deductionPoints).toBeGreaterThan(10);
    expect(result.total).toBe(0);
  });
});
