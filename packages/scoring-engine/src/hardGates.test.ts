import { describe, it, expect } from "vitest";
import { evaluateHardGates, type HardGateContext } from "./hardGates";

function baseContext(): HardGateContext {
  return {
    listing: {
      canton: "ZG",
      objectType: "BAULAND",
      baurecht: false,
      erschliessung: true,
      coordinates: { lat: 47.1, lon: 8.5 },
      municipalityBfsId: "1701",
      askingPriceChf: 3_000_000,
      parcelAreaM2: 1_500,
    },
    profile: {
      regions: { cantons: ["ZG", "ZH"] },
      objektart: { baulandEnabled: true, abbruchobjektEnabled: false, baurecht: "EXCLUDE" },
      budget: { maxEquityChf: 2_000_000, maxLandPriceChf: 4_000_000, maxTotalProjectVolumeChf: 10_000_000, negativeRampUpAllowed: true },
      projektziel: { parkingRequired: true, liftRequired: true, accessibilityRequired: true, balconiesRequired: true, minNraM2: 500 },
      risiken: { excludedContamination: true, excludedNaturalHazards: true },
      grundstueck: {
        maxPricePerM2Chf: 3_500,
        erschliessungRequired: true,
        hanglageAllowed: true,
        zufahrtRequired: true,
        altlastenAllowed: false,
        naturgefahrAllowed: false,
      },
    },
    totalDevelopmentCostChf: 8_000_000,
    equityRequiredChf: 1_800_000,
    achievedNraM2: 900,
    isInBuildingZone: true,
    residentialUsePermitted: true,
    zufahrtOk: true,
    prohibitedNaturalHazard: false,
    prohibitedContamination: false,
  };
}

describe("evaluateHardGates (Abschnitt 17)", () => {
  it("gibt PASSED zurück, wenn kein Gate zutrifft", () => {
    expect(evaluateHardGates(baseContext())).toEqual({ status: "PASSED" });
  });

  it("OUTSIDE_REGION, wenn der Kanton nicht im Suchprofil ist", () => {
    const ctx = baseContext();
    ctx.listing.canton = "BE";
    const result = evaluateHardGates(ctx);
    expect(result.status).toBe("REJECTED_BY_RULE");
    expect(result.reason).toBe("OUTSIDE_REGION");
  });

  it("WRONG_OBJECT_TYPE, wenn die Objektart im Suchprofil deaktiviert ist", () => {
    const ctx = baseContext();
    ctx.listing.objectType = "ABBRUCHOBJEKT";
    expect(evaluateHardGates(ctx).reason).toBe("WRONG_OBJECT_TYPE");
  });

  it("BAURECHT_EXCLUDED, wenn Baurecht vorliegt und ausgeschlossen ist", () => {
    const ctx = baseContext();
    ctx.listing.baurecht = true;
    expect(evaluateHardGates(ctx).reason).toBe("BAURECHT_EXCLUDED");
  });

  it("BAURECHT_EXCLUDED greift nicht, wenn das Suchprofil Baurecht zulässt", () => {
    const ctx = baseContext();
    ctx.listing.baurecht = true;
    ctx.profile.objektart.baurecht = "ALLOW";
    expect(evaluateHardGates(ctx)).toEqual({ status: "PASSED" });
  });

  it("NOT_IN_BUILDING_ZONE", () => {
    const ctx = baseContext();
    ctx.isInBuildingZone = false;
    expect(evaluateHardGates(ctx).reason).toBe("NOT_IN_BUILDING_ZONE");
  });

  it("PROHIBITED_CONTAMINATION nur wenn sowohl vorhanden als auch ausgeschlossen", () => {
    const ctx = baseContext();
    ctx.prohibitedContamination = true;
    ctx.profile.risiken.excludedContamination = false;
    expect(evaluateHardGates(ctx)).toEqual({ status: "PASSED" });

    ctx.profile.risiken.excludedContamination = true;
    expect(evaluateHardGates(ctx).reason).toBe("PROHIBITED_CONTAMINATION");
  });

  it("ACCESS_MISSING, wenn die Erschliessung fehlt", () => {
    const ctx = baseContext();
    ctx.listing.erschliessung = false;
    expect(evaluateHardGates(ctx).reason).toBe("ACCESS_MISSING");
  });

  it("PRICE_ABOVE_MAXIMUM", () => {
    const ctx = baseContext();
    ctx.listing.askingPriceChf = 5_000_000;
    expect(evaluateHardGates(ctx).reason).toBe("PRICE_ABOVE_MAXIMUM");
  });

  it("PRICE_PER_M2_ABOVE_MAXIMUM, wenn Preis/Fläche über dem Deckel im Suchprofil liegt", () => {
    const ctx = baseContext();
    ctx.listing.askingPriceChf = 3_000_000;
    ctx.listing.parcelAreaM2 = 600; // CHF 5'000/m² > Deckel 3'500
    expect(evaluateHardGates(ctx).reason).toBe("PRICE_PER_M2_ABOVE_MAXIMUM");
  });

  it("PRICE_PER_M2_ABOVE_MAXIMUM greift nicht ohne bekannte Parzellenfläche", () => {
    const ctx = baseContext();
    ctx.listing.parcelAreaM2 = undefined;
    expect(evaluateHardGates(ctx)).toEqual({ status: "PASSED" });
  });

  it("TOTAL_PROJECT_ABOVE_MAXIMUM", () => {
    const ctx = baseContext();
    ctx.totalDevelopmentCostChf = 11_000_000;
    expect(evaluateHardGates(ctx).reason).toBe("TOTAL_PROJECT_ABOVE_MAXIMUM");
  });

  it("EQUITY_ABOVE_MAXIMUM", () => {
    const ctx = baseContext();
    ctx.equityRequiredChf = 2_500_000;
    expect(evaluateHardGates(ctx).reason).toBe("EQUITY_ABOVE_MAXIMUM");
  });

  it("PROJECT_SIZE_UNREACHABLE, wenn die erreichbare NRA unter dem Zielminimum liegt", () => {
    const ctx = baseContext();
    ctx.achievedNraM2 = 200;
    expect(evaluateHardGates(ctx).reason).toBe("PROJECT_SIZE_UNREACHABLE");
  });

  it("LOCATION_NOT_IDENTIFIABLE hat Priorität vor allen anderen Regeln", () => {
    const ctx = baseContext();
    ctx.listing.coordinates = undefined;
    ctx.listing.municipalityBfsId = undefined;
    ctx.listing.canton = undefined; // würde sonst auch OUTSIDE_REGION auslösen
    expect(evaluateHardGates(ctx).reason).toBe("LOCATION_NOT_IDENTIFIABLE");
  });

  it("manuelle Übersteuerung setzt Status auf PASSED, behält Regel/Beleg/Override sichtbar", () => {
    const ctx = baseContext();
    ctx.listing.askingPriceChf = 5_000_000;
    const override = { overriddenBy: "erwin.fries@gmx.ch", justification: "Verhandlungsspielraum bestätigt", at: "2026-08-05" };
    const result = evaluateHardGates(ctx, override);
    expect(result.status).toBe("PASSED");
    expect(result.reason).toBe("PRICE_ABOVE_MAXIMUM");
    expect(result.override).toEqual(override);
  });
});
