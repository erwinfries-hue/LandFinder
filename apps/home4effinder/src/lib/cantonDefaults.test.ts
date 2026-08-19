import { describe, it, expect } from "vitest";
import { getCantonDefaults } from "./cantonDefaults";
import { AVAILABLE_CANTONS } from "./cantons";

describe("getCantonDefaults", () => {
  it("liefert für jeden der 26 Kantone ein Ergebnis", () => {
    for (const c of AVAILABLE_CANTONS) {
      const result = getCantonDefaults(c.code);
      expect(result).toBeDefined();
      expect(result!.handaenderungssteuerPercent).toBeGreaterThanOrEqual(0);
      expect(result!.kalkulatorischerSteuersatzPercent).toBeGreaterThan(0);
    }
  });

  it("kennt die acht Kantone ohne Handänderungssteuer", () => {
    for (const c of ["ZH", "ZG", "SZ", "UR", "GL", "SH", "AG", "TI"]) {
      expect(getCantonDefaults(c)!.handaenderungssteuerPercent).toBe(0);
    }
  });

  it("liefert undefined für unbekannten/fehlenden Kanton, statt zu raten", () => {
    expect(getCantonDefaults(undefined)).toBeUndefined();
    expect(getCantonDefaults("")).toBeUndefined();
    expect(getCantonDefaults("XX")).toBeUndefined();
  });

  it("Genf/Waadt/Basel-Stadt/Neuenburg/Jura gelten als steuerlich teurere Kantone", () => {
    for (const c of ["GE", "VD", "BS", "NE", "JU"]) {
      expect(getCantonDefaults(c)!.kalkulatorischerSteuersatzPercent).toBe(29);
    }
  });

  it("Zug/Schwyz/Nidwalden/Obwalden/Uri/Appenzell Innerrhoden gelten als steuergünstigste Kantone", () => {
    for (const c of ["ZG", "SZ", "NW", "OW", "UR", "AI"]) {
      expect(getCantonDefaults(c)!.kalkulatorischerSteuersatzPercent).toBe(18);
    }
  });
});
