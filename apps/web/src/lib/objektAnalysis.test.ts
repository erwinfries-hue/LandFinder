import { describe, it, expect } from "vitest";
import { computeChamAnalysis, computeListingAnalysis, CHAM_FACTS } from "./objektAnalysis";
import { DEFAULT_SEARCH_PROFILE } from "./searchProfile";
import type { ListingAnalysisInput, ListingVertiefungFacts } from "./listingVertiefung";

const TEST_LISTING: ListingAnalysisInput = {
  canton: "AG",
  objectType: "BAULAND",
  askingPriceChf: 3_000_000,
  parcelAreaM2: 2000,
};

const TEST_FACTS: ListingVertiefungFacts = {
  baupotenzial: { method: "DENSITY_RATIO", densityRatio: 0.5 },
  zoneLabel: "W2",
  zoneVerification: "C",
  overallVerification: "C",
  oevGueteklasse: "C",
  erschliessungOk: true,
  zufahrtOk: true,
  risiken: {
    altlasten: false,
    naturgefahren: false,
    gewaesser: false,
    laerm: false,
    planungszone: false,
    zufahrt: false,
    erschliessung: false,
    baukostenrisiken: true,
  },
  coordinates: { lat: 47.4, lon: 8.2 },
};

describe("computeChamAnalysis", () => {
  it("liefert mit den Standard-Annahmen ein plausibles, in sich konsistentes Ergebnis", () => {
    const result = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});

    expect(result.score.total).toBeGreaterThanOrEqual(0);
    expect(result.score.total).toBeLessThanOrEqual(100);
    expect(result.confidence.total).toBeGreaterThanOrEqual(0);
    expect(result.confidence.total).toBeLessThanOrEqual(100);
    expect([
      "SOFORT_PRUEFEN",
      "POTENZIAL_DRINGEND_VERIFIZIEREN",
      "WEITERVERFOLGEN",
      "BEOBACHTEN_VERHANDELN",
      "NICHT_WEITERVERFOLGEN",
      "UNGENUEGENDE_DATEN",
    ]).toContain(result.empfehlung);
    expect(result.yieldOnCostPercent).toBeGreaterThan(0);
    // Gesamtinvestition muss über dem reinen Landpreis liegen (Land + Bau + Nebenkosten).
    expect(result.base.totalDevelopmentCostChf).toBeGreaterThan(CHAM_FACTS.askingPriceChf);
    expect(result.hardGate.status).toBe("PASSED");
    expect(result.baupotenzial.adjustedNraM2).toBeGreaterThan(0);
  });

  it("gibt bei jedem Aufruf mit denselben Eingaben dasselbe Ergebnis zurück (keine versteckte Zufälligkeit)", () => {
    const a = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    const b = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    expect(a.score.total).toBe(b.score.total);
    expect(a.base.totalDevelopmentCostChf).toBe(b.base.totalDevelopmentCostChf);
  });

  it("reduziert das Baupotenzial, wenn ein Annahmen-Override den Geometriefaktor verkleinert", () => {
    const base = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    const overridden = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, { "baupotenzial.geometryFactor": 0.5 });

    expect(overridden.baupotenzial.adjustedNraM2).toBeLessThan(base.baupotenzial.adjustedNraM2);
  });

  it("übernimmt einen Stress-Case-Override direkt in den Stress-Zinssatz", () => {
    const result = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, { "stress.interestRateDeltaPp": 5 });
    expect(result.stress.interestRatePercent).toBeCloseTo(DEFAULT_SEARCH_PROFILE.finanzierung.interestRateBasePercent + 5, 5);
  });

  it("erhöht die Gesamtinvestition, wenn das Suchprofil höhere Baukosten pro m² annimmt", () => {
    const base = computeChamAnalysis(DEFAULT_SEARCH_PROFILE, {});
    const expensiveProfile = {
      ...DEFAULT_SEARCH_PROFILE,
      baukosten: {
        ...DEFAULT_SEARCH_PROFILE.baukosten,
        buildingCostChfPerM2: DEFAULT_SEARCH_PROFILE.baukosten.buildingCostChfPerM2 * 2,
      },
    };
    const expensive = computeChamAnalysis(expensiveProfile, {});

    expect(expensive.base.totalDevelopmentCostChf).toBeGreaterThan(base.base.totalDevelopmentCostChf);
  });
});

describe("computeListingAnalysis", () => {
  it("liefert für ein beliebiges (nicht-Cham-)Objekt ein plausibles, in sich konsistentes Ergebnis", () => {
    const result = computeListingAnalysis(DEFAULT_SEARCH_PROFILE, {}, TEST_LISTING, TEST_FACTS);

    expect(result.score.total).toBeGreaterThanOrEqual(0);
    expect(result.score.total).toBeLessThanOrEqual(100);
    expect(result.confidence.total).toBeGreaterThanOrEqual(0);
    expect(result.confidence.total).toBeLessThanOrEqual(100);
    expect(result.hardGate.status).toBe("PASSED");
    expect(result.baupotenzial.adjustedNraM2).toBeGreaterThan(0);
    expect(result.base.totalDevelopmentCostChf).toBeGreaterThan(TEST_LISTING.askingPriceChf);
  });

  it("lehnt via Hard Gate ab, wenn der Kanton nicht im Suchprofil aktiviert ist", () => {
    const result = computeListingAnalysis(DEFAULT_SEARCH_PROFILE, {}, { ...TEST_LISTING, canton: "GE" }, TEST_FACTS);
    expect(result.hardGate.status).toBe("REJECTED_BY_RULE");
    expect(result.hardGate.reason).toBe("OUTSIDE_REGION");
    expect(result.empfehlung).toBe("NICHT_WEITERVERFOLGEN");
  });

  it("erhöht den Score-Anteil Baupotenzial bei einer höheren Zonen-/Gesamtverifikation", () => {
    const low = computeListingAnalysis(DEFAULT_SEARCH_PROFILE, {}, TEST_LISTING, TEST_FACTS);
    const high = computeListingAnalysis(DEFAULT_SEARCH_PROFILE, {}, TEST_LISTING, {
      ...TEST_FACTS,
      zoneVerification: "A",
      overallVerification: "A",
    });
    expect(high.score.baupotenzial).toBeGreaterThan(low.score.baupotenzial);
  });

  it("berechnet Abbruchkosten nur, wenn Objektart ABBRUCHOBJEKT ist und eine Gebäudefläche erfasst wurde", () => {
    const bauland = computeListingAnalysis(DEFAULT_SEARCH_PROFILE, {}, TEST_LISTING, TEST_FACTS);
    const abbruchOhneFlaeche = computeListingAnalysis(
      DEFAULT_SEARCH_PROFILE,
      {},
      { ...TEST_LISTING, objectType: "ABBRUCHOBJEKT" },
      TEST_FACTS,
    );
    const abbruchMitFlaeche = computeListingAnalysis(
      DEFAULT_SEARCH_PROFILE,
      {},
      { ...TEST_LISTING, objectType: "ABBRUCHOBJEKT" },
      { ...TEST_FACTS, existingBuildingAreaM2: 400 },
    );

    // Ohne erfasste Gebäudefläche keine erfundenen Abbruchkosten (bleibt gleich wie Bauland).
    expect(abbruchOhneFlaeche.base.totalDevelopmentCostChf).toBe(bauland.base.totalDevelopmentCostChf);
    expect(abbruchMitFlaeche.base.totalDevelopmentCostChf).toBeGreaterThan(abbruchOhneFlaeche.base.totalDevelopmentCostChf);
  });

  it("stützt sich ohne EGRID auf eine niedrigere Konfidenz für den Parzellennachweis", () => {
    const ohneEgrid = computeListingAnalysis(DEFAULT_SEARCH_PROFILE, {}, TEST_LISTING, TEST_FACTS);
    const mitEgrid = computeListingAnalysis(DEFAULT_SEARCH_PROFILE, {}, TEST_LISTING, { ...TEST_FACTS, egrid: "CH123456789" });
    expect(mitEgrid.confidence.total).toBeGreaterThan(ohneEgrid.confidence.total);
  });
});
