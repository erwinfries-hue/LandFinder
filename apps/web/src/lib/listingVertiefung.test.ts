import { describe, it, expect } from "vitest";
import { resolveMarketAssumptions, toBaupotenzialInputFields, parseListingVertiefungFacts, NEUTRAL_MARKET_DEFAULTS } from "./listingVertiefung";

describe("resolveMarketAssumptions", () => {
  it("verwendet neutrale Defaults und dokumentiert jede Lücke, wenn nichts erfasst ist", () => {
    const resolved = resolveMarketAssumptions(undefined, 2);

    expect(resolved.localVacancyRatePercent).toBe(2);
    expect(resolved.populationGrowth3yPercent).toBe(NEUTRAL_MARKET_DEFAULTS.populationGrowth3yPercent);
    expect(resolved.rentLevelRatio).toBe(NEUTRAL_MARKET_DEFAULTS.rentLevelRatio);
    expect(resolved.constructionActivityRatePercent).toBe(NEUTRAL_MARKET_DEFAULTS.constructionActivityRatePercent);
    expect(resolved.zielmieterFitRatio).toBe(NEUTRAL_MARKET_DEFAULTS.zielmieterFitRatio);
    expect(resolved.reachableResidents30min).toBe(0);
    expect(resolved.assumptionNotes.length).toBeGreaterThanOrEqual(6);
  });

  it("übernimmt manuell erfasste Werte statt der Defaults, ohne dafür eine Notiz zu erzeugen", () => {
    const resolved = resolveMarketAssumptions(
      {
        localVacancyRatePercent: 0.5,
        populationGrowth3yPercent: 3,
        rentLevelRatio: 1.1,
        constructionActivityRatePercent: 2.2,
        zielmieterFitRatio: 0.8,
        reachableResidents30min: 50_000,
      },
      2,
    );

    expect(resolved).toMatchObject({
      localVacancyRatePercent: 0.5,
      populationGrowth3yPercent: 3,
      rentLevelRatio: 1.1,
      constructionActivityRatePercent: 2.2,
      zielmieterFitRatio: 0.8,
      reachableResidents30min: 50_000,
    });
    expect(resolved.assumptionNotes).toEqual([]);
  });
});

describe("toBaupotenzialInputFields", () => {
  it("übersetzt jede Baupotenzial-Methode in das flache financial-engine-Shape", () => {
    expect(toBaupotenzialInputFields({ method: "DENSITY_RATIO", densityRatio: 0.6 })).toEqual({
      method: "DENSITY_RATIO",
      densityRatio: 0.6,
    });
    expect(toBaupotenzialInputFields({ method: "VOLUME_RATIO", volumeRatio: 4.5 })).toEqual({
      method: "VOLUME_RATIO",
      volumeRatio: 4.5,
    });
    expect(toBaupotenzialInputFields({ method: "COVERAGE_RATIO", siteCoverageRatio: 0.3, effectiveFloors: 4 })).toEqual({
      method: "COVERAGE_RATIO",
      siteCoverageRatio: 0.3,
      effectiveFloors: 4,
    });
  });
});

const VALID_FACTS_INPUT = {
  baupotenzial: { method: "DENSITY_RATIO", densityRatio: 0.5 },
  zoneLabel: "W2",
  zoneVerification: "B",
  overallVerification: "B",
  oevGueteklasse: "B",
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
    baukostenrisiken: false,
  },
  coordinates: { lat: 47.4, lon: 8.2 },
};

describe("parseListingVertiefungFacts", () => {
  it("akzeptiert ein vollständiges, gültiges Objekt", () => {
    const result = parseListingVertiefungFacts(VALID_FACTS_INPUT);
    expect("facts" in result).toBe(true);
    if ("facts" in result) {
      expect(result.facts.zoneLabel).toBe("W2");
      expect(result.facts.baupotenzial).toEqual({ method: "DENSITY_RATIO", densityRatio: 0.5 });
    }
  });

  it("lehnt ab, wenn die Koordinaten fehlen (Hard Gate 'Standort identifizierbar')", () => {
    const withoutCoordinates = { ...VALID_FACTS_INPUT, coordinates: undefined };
    const result = parseListingVertiefungFacts(withoutCoordinates);
    expect("error" in result).toBe(true);
  });

  it("lehnt eine unbekannte Baupotenzial-Methode ab", () => {
    const result = parseListingVertiefungFacts({ ...VALID_FACTS_INPUT, baupotenzial: { method: "UNKNOWN" } });
    expect("error" in result).toBe(true);
  });

  it("lehnt eine ungültige Zonen-Verifikationsstufe ab", () => {
    const result = parseListingVertiefungFacts({ ...VALID_FACTS_INPUT, zoneVerification: "Z" });
    expect("error" in result).toBe(true);
  });

  it("lehnt fehlende Risiko-Flags ab", () => {
    const result = parseListingVertiefungFacts({ ...VALID_FACTS_INPUT, risiken: { altlasten: false } });
    expect("error" in result).toBe(true);
  });

  it("erlaubt fehlende optionale Markt-Annahmen/EGRID", () => {
    const result = parseListingVertiefungFacts(VALID_FACTS_INPUT);
    expect("facts" in result).toBe(true);
    if ("facts" in result) {
      expect(result.facts.marktAnnahmen).toBeUndefined();
      expect(result.facts.egrid).toBeUndefined();
    }
  });
});
