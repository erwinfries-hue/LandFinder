import { describe, it, expect } from "vitest";
import { prescreenListing, type PrescreenableListing } from "./listingPrescreen";
import { DEFAULT_SEARCH_PROFILE } from "./searchProfile";

function listing(overrides: Partial<PrescreenableListing>): PrescreenableListing {
  return {
    canton: "ZG",
    object_type: "BAULAND",
    asking_price_chf: 3_000_000,
    parcel_area_m2: 1000,
    ...overrides,
  };
}

describe("prescreenListing", () => {
  it("besteht die Vorprüfung, wenn alle vier Kriterien im Rahmen des Suchprofils liegen", () => {
    const result = prescreenListing(listing({}), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("PASSED");
    expect(result.rules.every((r) => r.status === "PASSED")).toBe(true);
  });

  it("lehnt ab, wenn der Kanton nicht im Suchprofil aktiviert ist", () => {
    const result = prescreenListing(listing({ canton: "GE" }), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("REJECTED");
    expect(result.rules.find((r) => r.key === "region")?.status).toBe("FAILED");
  });

  it("lehnt ab, wenn die Objektart im Suchprofil deaktiviert ist", () => {
    const profile = { ...DEFAULT_SEARCH_PROFILE, objektart: { ...DEFAULT_SEARCH_PROFILE.objektart, baulandEnabled: false } };
    const result = prescreenListing(listing({ object_type: "BAULAND" }), profile);
    expect(result.status).toBe("REJECTED");
    expect(result.rules.find((r) => r.key === "objektart")?.status).toBe("FAILED");
  });

  it("lehnt ab, wenn der Preis über der Obergrenze des Suchprofils liegt", () => {
    const result = prescreenListing(listing({ asking_price_chf: DEFAULT_SEARCH_PROFILE.budget.maxLandPriceChf + 1 }), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("REJECTED");
    expect(result.rules.find((r) => r.key === "preisMax")?.status).toBe("FAILED");
  });

  it("lehnt ab, wenn der Preis pro m² über der Obergrenze des Suchprofils liegt", () => {
    const result = prescreenListing(listing({ asking_price_chf: 10_000_000, parcel_area_m2: 1000 }), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("REJECTED");
    expect(result.rules.find((r) => r.key === "preisProM2Max")?.status).toBe("FAILED");
  });

  it("meldet fehlende Daten statt zu raten, wenn Kanton nicht extrahiert wurde", () => {
    const result = prescreenListing(listing({ canton: null }), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.rules.find((r) => r.key === "region")?.status).toBe("INSUFFICIENT_DATA");
  });

  it("meldet fehlende Daten statt zu raten, wenn Objektart nicht extrahiert wurde", () => {
    const result = prescreenListing(listing({ object_type: null }), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.rules.find((r) => r.key === "objektart")?.status).toBe("INSUFFICIENT_DATA");
  });

  it("meldet fehlende Daten statt zu raten, wenn Preis oder Fläche fehlen", () => {
    const ohnePreis = prescreenListing(listing({ asking_price_chf: null }), DEFAULT_SEARCH_PROFILE);
    expect(ohnePreis.rules.find((r) => r.key === "preisMax")?.status).toBe("INSUFFICIENT_DATA");
    expect(ohnePreis.rules.find((r) => r.key === "preisProM2Max")?.status).toBe("INSUFFICIENT_DATA");

    const ohneFlaeche = prescreenListing(listing({ parcel_area_m2: null }), DEFAULT_SEARCH_PROFILE);
    expect(ohneFlaeche.rules.find((r) => r.key === "preisProM2Max")?.status).toBe("INSUFFICIENT_DATA");
    // Preis-Obergrenze bleibt unabhängig von der Fläche prüfbar.
    expect(ohneFlaeche.rules.find((r) => r.key === "preisMax")?.status).toBe("PASSED");
  });

  it("gibt INSUFFICIENT_DATA zurück, wenn ausser fehlenden Feldern nichts explizit fehlschlägt", () => {
    const result = prescreenListing(listing({ canton: null, asking_price_chf: null, parcel_area_m2: null }), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("INSUFFICIENT_DATA");
  });

  it("eine FAILED-Regel überstimmt INSUFFICIENT_DATA bei anderen Regeln (REJECTED gewinnt)", () => {
    const result = prescreenListing(listing({ canton: "GE", asking_price_chf: null }), DEFAULT_SEARCH_PROFILE);
    expect(result.status).toBe("REJECTED");
  });
});
