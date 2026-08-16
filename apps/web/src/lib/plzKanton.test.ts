import { describe, it, expect } from "vitest";
import { cantonFromPlz, extractPlz, deriveCantonFromAddress } from "./plzKanton";

describe("cantonFromPlz", () => {
  it("löst eine bekannte, eindeutige PLZ auf", () => {
    expect(cantonFromPlz("8545")).toBe("ZH");
    expect(cantonFromPlz("6330")).toBe("ZG");
  });

  it("gibt nichts zurück für eine PLZ auf einer Kantonsgrenze, statt zu raten", () => {
    expect(cantonFromPlz("1410")).toBeUndefined();
  });

  it("gibt nichts zurück für eine unbekannte oder fehlende PLZ", () => {
    expect(cantonFromPlz("0000")).toBeUndefined();
    expect(cantonFromPlz(undefined)).toBeUndefined();
  });
});

describe("extractPlz", () => {
  it("findet eine 4-stellige PLZ im Adress-Fliesstext", () => {
    expect(extractPlz("Bahnhofstrasse 1, 8545 Rickenbach Sulz")).toBe("8545");
  });

  it("gibt nichts zurück ohne PLZ-Muster", () => {
    expect(extractPlz("Bahnhofstrasse 1")).toBeUndefined();
    expect(extractPlz(null)).toBeUndefined();
    expect(extractPlz(undefined)).toBeUndefined();
  });
});

describe("deriveCantonFromAddress", () => {
  it("kombiniert Extraktion und Zuordnung", () => {
    expect(deriveCantonFromAddress("Bahnhofstrasse 1, 8545 Rickenbach Sulz")).toBe("ZH");
    expect(deriveCantonFromAddress("Ohne PLZ")).toBeUndefined();
  });
});
