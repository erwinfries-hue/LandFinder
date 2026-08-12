import type { SearchProfile, DataPoint, ScoreBreakdown, ConfidenceBreakdown, Empfehlung, HardGateResult } from "@landfinder/domain";
import {
  BAUPOTENZIAL_PARAMETERS,
  STRESS_CASE_PARAMETERS,
  estimateBaupotenzial,
  buildingCostChf,
  calculateProjektkosten,
  calculateErtrag,
  calculateFinanzierung,
  calculateWert,
  runBaseAndStress,
  type ScenarioInputs,
} from "@landfinder/financial-engine";
import {
  SCORE_WEIGHTS,
  SCORE_BANDS,
  RISK_DEDUCTIONS,
  CONFIDENCE_WEIGHTS,
  EMPFEHLUNG_PARAMETERS,
  calculateScore,
  calculateConfidence,
  evaluateHardGates,
  deriveEmpfehlung,
  type ScoreInput,
  type HardGateContext,
} from "@landfinder/scoring-engine";
import { overrideKey, type AnnahmenOverrides } from "./annahmen";
import {
  resolveMarketAssumptions,
  toBaupotenzialInputFields,
  type BaupotenzialFacts,
  type ListingAnalysisInput,
  type ListingVertiefungFacts,
} from "./listingVertiefung";

function baupotenzialLabel(facts: BaupotenzialFacts): string {
  switch (facts.method) {
    case "DENSITY_RATIO":
      return `Ausnützungsziffer ${facts.densityRatio}`;
    case "VOLUME_RATIO":
      return `Baumassenziffer ${facts.volumeRatio} m³/m²`;
    case "COVERAGE_RATIO":
      return `Überbauungsziffer ${facts.siteCoverageRatio}, ${facts.effectiveFloors} Geschosse`;
  }
}

/**
 * Rohfakten für "Chamerstrasse, Cham ZG" — bewusst nur für dieses eine Demo-Objekt,
 * weil es als einziges genug Detailangaben hat, um echt durch die Engines zu laufen
 * (siehe docs/OPEN_DECISIONS.md, Punkt F: die anderen 5 Demo-Objekte bleiben
 * unverändert statischer Text statt erfundene Eingabedaten zu bekommen).
 *
 * Übersetzt aus der ursprünglichen, handgeschriebenen Objekt-Vertiefung in
 * demo-data.ts ("Zone W3 amtlich bestätigt, Ausnützung 0.6 verifiziert (Stufe B)",
 * "ÖV-Güteklasse B, 6 Min. zur S-Bahn Cham" etc.) in strukturierte Engine-Eingaben.
 * Die berechneten Ergebnisse weichen deshalb von den ursprünglichen (frei verfassten)
 * Demo-Zahlen ab — das ist erwartet, kein Fehler.
 */
export const CHAM_FACTS = {
  canton: "ZG",
  parcelAreaM2: 1860,
  askingPriceChf: 3_450_000,
  densityRatio: 0.6,
  zoneVerification: "B" as const,
  overallVerification: "B" as const,
  oevGueteklasse: "B" as const,
  /** Gemeinde Cham, laut Demo-Text — Markt-Score-Input, nicht der Suchprofil-Zielwert. */
  localVacancyRatePercent: 0.9,
  /** Ungefähre Gemeinde-Koordinate (nicht parzellenscharf), nur damit der Hard Gate "Standort identifizierbar" nicht grundlos greift. */
  coordinates: { lat: 47.18, lon: 8.46 },
};

/**
 * Score-Eingaben, für die weder das Objekt noch das Suchprofil eine echte Zahl
 * liefern (keine Wüest-Gemeindedaten für Zug/Cham, keine manuelle Zielmieter-Fit-
 * Beurteilung). Bewusst als neutrale/grobe Schätzwerte benannt statt stillschweigend
 * in die Formel geschrieben — siehe `assumptionNotes` in `computeChamAnalysis`.
 */
const UNVERIFIED_MARKET_ASSUMPTIONS = {
  /** Grobe Schätzung Zug/Zürich-Agglomeration, keine Wüest-Mobilitätsdaten. */
  reachableResidents30min: 250_000,
  /** Grobe Schätzung (Kanton ZG wächst überdurchschnittlich), keine Gemeindedaten. */
  populationGrowth3yPercent: 4,
  /** Neutral (Parität) — keine Wüest-Vergleichsdaten für Kanton ZG vorhanden. */
  rentLevelRatio: 1.0,
  /** Neutral (Bandmitte) — keine Baubewilligungsstatistik für Cham hinterlegt. */
  constructionActivityRatePercent: 1.75,
  /** Neutral (Bandmitte) — Zielmieter-Fit ist laut Scoring-Engine explizit eine externe/manuelle Einschätzung, keine Formel. */
  zielmieterFitRatio: 0.5,
};

function resolveGroup(groupId: string, registry: Record<string, { key: string; defaultValue: number }>, overrides: AnnahmenOverrides) {
  const result: Record<string, number> = {};
  for (const key in registry) {
    result[key] = overrides[overrideKey(groupId, registry[key].key)] ?? registry[key].defaultValue;
  }
  return result;
}

export interface ObjektAnalysisResult {
  baupotenzial: { estimatedGfaM2: number; adjustedNraM2: number };
  base: {
    totalDevelopmentCostChf: number;
    equityRequiredChf: number;
    loanToCostPercent: number;
    dscr: number;
    cashOnCashPercent: number;
    noiChf: number;
  };
  stress: {
    dscr: number;
    cashOnCashPercent: number;
    rentChfPerM2Month: number;
    buildingCostPerM2Chf: number;
    interestRatePercent: number;
  };
  wert: ReturnType<typeof calculateWert>;
  yieldOnCostPercent: number;
  score: ScoreBreakdown;
  confidence: ConfidenceBreakdown;
  hardGate: HardGateResult;
  empfehlung: Empfehlung;
  assumptionNotes: string[];
}

/**
 * Rechnet ein beliebiges Objekt (echtes Inserat + manuell erfasste Vertiefungsdaten)
 * komplett durch financial-engine + scoring-engine, mit den aktuellen
 * Suchprofil-Annahmen und Annahmen-Register-Overrides. `computeChamAnalysis` (unten)
 * ist nur noch ein dünner Wrapper darüber, der die Cham-Demo-Fakten übersetzt —
 * dieselbe Funktion treibt sowohl die Cham-Detailseite als auch "Objekt vertiefen"
 * für echte `/quellen`-Treffer.
 */
export function computeListingAnalysis(
  profile: SearchProfile,
  annahmenOverrides: AnnahmenOverrides,
  listing: ListingAnalysisInput,
  facts: ListingVertiefungFacts,
): ObjektAnalysisResult {
  const market = resolveMarketAssumptions(facts.marktAnnahmen, profile.marktannahmen.vacancyRatePercent);
  const assumptionNotes: string[] = [
    `${baupotenzialLabel(facts.baupotenzial)} und Zone "${facts.zoneLabel}" wie erfasst übernommen (Verifikationsstufe ${facts.zoneVerification}), nicht durch ein amtliches Dokument in diesem System verifiziert.`,
    ...market.assumptionNotes,
    "Parkplatzanzahl nicht erfasst — Parkplatzkosten/-erträge mit 0 angenommen.",
  ];
  if (listing.objectType === "ABBRUCHOBJEKT" && facts.existingBuildingAreaM2 === undefined) {
    assumptionNotes.push("Abbruchobjekt ohne erfasste bestehende Gebäudefläche — Abbruchkosten mit 0 angenommen statt eine Fläche zu erfinden.");
  }
  if (facts.risiken.zufahrt || facts.risiken.erschliessung) {
    assumptionNotes.push("Zufahrt/Erschliessung als weicher Risikofaktor markiert, auch wenn das zugehörige Hard Gate bestanden hat.");
  }
  if (facts.notes) assumptionNotes.push(facts.notes);

  const baupotenzialFactors = resolveGroup("baupotenzial", BAUPOTENZIAL_PARAMETERS, annahmenOverrides) as Record<
    keyof typeof BAUPOTENZIAL_PARAMETERS,
    number
  >;
  const stressParams = resolveGroup("stress", STRESS_CASE_PARAMETERS, annahmenOverrides) as Record<
    keyof typeof STRESS_CASE_PARAMETERS,
    number
  >;
  const scoreWeights = resolveGroup("scoreweights", SCORE_WEIGHTS, annahmenOverrides) as Record<keyof typeof SCORE_WEIGHTS, number>;
  const scoreBands = resolveGroup("scorebands", SCORE_BANDS, annahmenOverrides) as Record<keyof typeof SCORE_BANDS, number>;
  const riskDeductions = resolveGroup("risk", RISK_DEDUCTIONS, annahmenOverrides) as Record<keyof typeof RISK_DEDUCTIONS, number>;
  const confidenceWeights = resolveGroup("confidence", CONFIDENCE_WEIGHTS, annahmenOverrides) as Record<
    keyof typeof CONFIDENCE_WEIGHTS,
    number
  >;
  const empfehlungParams = resolveGroup("empfehlung", EMPFEHLUNG_PARAMETERS, annahmenOverrides) as Record<
    keyof typeof EMPFEHLUNG_PARAMETERS,
    number
  >;

  const baupotenzial = estimateBaupotenzial({
    ...toBaupotenzialInputFields(facts.baupotenzial),
    parcelAreaM2: listing.parcelAreaM2,
    factors: baupotenzialFactors,
  });

  const ownerUseNraM2 = profile.eigennutzung.enabled ? profile.eigennutzung.targetSizeM2 ?? 0 : 0;

  const buildingCost = buildingCostChf({
    basis: profile.baukosten.costBasis,
    costPerM2Chf: profile.baukosten.buildingCostChfPerM2,
    gfaM2: baupotenzial.estimatedGfaM2,
    nraM2: baupotenzial.adjustedNraM2,
  });

  const demolitionChf =
    listing.objectType === "ABBRUCHOBJEKT" && facts.existingBuildingAreaM2 !== undefined
      ? (profile.baukosten.demolitionCostChfPerM2 ?? 0) * facts.existingBuildingAreaM2
      : 0;

  const projektkosten = calculateProjektkosten({
    landCostChf: listing.askingPriceChf,
    purchaseCostsChf: 0, // Handänderungssteuer/Notariat: nicht separat im Suchprofil erfasst
    demolitionChf,
    remediationChf: 0,
    sitePreparationChf: profile.baukosten.erschliessungCostChf ?? 0,
    buildingCostChf: buildingCost,
    parkingCostChf: 0, // Anzahl Parkplätze nicht erfasst
    utilityConnectionsChf: profile.baukosten.werkanschlussCostChf ?? 0,
    externalWorksChf: profile.baukosten.umgebungCostChf ?? 0,
    professionalFeesPercent: profile.baukosten.feesPercent,
    permitsAndFeesPercent: profile.baukosten.permitsPercent,
    contingencyPercent: profile.baukosten.contingencyPercent,
    constructionFinancingPercent: profile.baukosten.constructionFinancingPercent,
    initialLeasingCostPercent: profile.baukosten.initialLeasingCostPercent,
  });

  const loanAmountChf = projektkosten.totalDevelopmentCostChf * (profile.finanzierung.loanToCostPercent / 100);
  const amortizationChfPerYear = loanAmountChf * (profile.finanzierung.amortizationPercent / 100);

  const scenarioInputs: ScenarioInputs = {
    totalNraM2: baupotenzial.adjustedNraM2,
    ownerUseNraM2,
    ownerMarketRentChfPerM2Month: profile.eigennutzung.imputedMarketRentChfPerM2Month ?? 0,

    rentChfPerM2Month: profile.marktannahmen.netRentChfPerM2Month,
    parkingIncomeChfPerYear: 0,
    otherIncomeChfPerYear: 0,
    vacancyRatePercent: profile.marktannahmen.vacancyRatePercent,
    collectionLossRatePercent: profile.marktannahmen.collectionLossRatePercent,
    // Alle vier prozentualen Nebenkosten-Kategorien des Suchprofils zusammengefasst
    // (Verwaltung, Unterhalt, nicht umlagefähige Kosten, Capex-Reserve) statt zwei
    // davon separat als Fix-CHF zu modellieren — bewusste Vereinfachung.
    operatingExpenseRatioPercent:
      profile.marktannahmen.managementCostPercent +
      profile.marktannahmen.maintenanceCostPercent +
      profile.marktannahmen.nonRecoverableCostPercent +
      profile.marktannahmen.capexReservePercent,
    fixedNonRecoverableCostsChfPerYear: 0,
    annualCapexReserveChfPerYear: 0,

    landCostChf: listing.askingPriceChf,
    purchaseCostsChf: 0,
    demolitionChf,
    remediationChf: 0,
    sitePreparationChf: profile.baukosten.erschliessungCostChf ?? 0,
    buildingCostBasis: profile.baukosten.costBasis,
    buildingCostPerM2Chf: profile.baukosten.buildingCostChfPerM2,
    gfaM2: baupotenzial.estimatedGfaM2,
    parkingCostChf: 0,
    utilityConnectionsChf: profile.baukosten.werkanschlussCostChf ?? 0,
    externalWorksChf: profile.baukosten.umgebungCostChf ?? 0,
    professionalFeesPercent: profile.baukosten.feesPercent,
    permitsAndFeesPercent: profile.baukosten.permitsPercent,
    contingencyPercent: profile.baukosten.contingencyPercent,
    constructionFinancingPercent: profile.baukosten.constructionFinancingPercent,
    initialLeasingCostPercent: profile.baukosten.initialLeasingCostPercent,

    loanToCostPercent: profile.finanzierung.loanToCostPercent,
    interestRatePercent: profile.finanzierung.interestRateBasePercent,
    amortizationChfPerYear,

    exitCapRatePercent: profile.marktannahmen.exitCapRatePercent,
    targetProfitMarginPercent: profile.renditeziele.targetMarginPercent,
    askingLandPriceChf: listing.askingPriceChf,
  };

  const { base, stress } = runBaseAndStress(scenarioInputs, stressParams);

  const ertragBase = calculateErtrag({
    rentalNraM2: Math.max(baupotenzial.adjustedNraM2 - ownerUseNraM2, 0),
    rentChfPerM2Month: scenarioInputs.rentChfPerM2Month,
    parkingIncomeChfPerYear: 0,
    otherIncomeChfPerYear: 0,
    vacancyRatePercent: scenarioInputs.vacancyRatePercent,
    collectionLossRatePercent: scenarioInputs.collectionLossRatePercent,
    operatingExpenseRatioPercent: scenarioInputs.operatingExpenseRatioPercent,
    fixedNonRecoverableCostsChfPerYear: 0,
    annualCapexReserveChfPerYear: 0,
  });
  const finanzierungBase = calculateFinanzierung({
    totalDevelopmentCostChf: projektkosten.totalDevelopmentCostChf,
    loanToCostPercent: profile.finanzierung.loanToCostPercent,
    interestRatePercent: profile.finanzierung.interestRateBasePercent,
    amortizationChfPerYear,
    noiChf: ertragBase.noiChf,
  });
  const wert = calculateWert({
    noiChf: ertragBase.noiChf,
    exitCapRatePercent: profile.marktannahmen.exitCapRatePercent,
    totalDevelopmentCostChf: projektkosten.totalDevelopmentCostChf,
    totalCostExcludingLandChf: projektkosten.totalCostExcludingLandChf,
    targetProfitMarginPercent: profile.renditeziele.targetMarginPercent,
    askingLandPriceChf: listing.askingPriceChf,
  });

  const yieldOnCostPercent = (base.noiChf / projektkosten.totalDevelopmentCostChf) * 100;
  const formTopografieFactor = baupotenzialFactors.geometryFactor * baupotenzialFactors.topographyFactor;

  const scoreInput: ScoreInput = {
    wirtschaftlichkeit: {
      yieldOnCostPercent,
      residualwertdifferenzPercent: wert.landValueGapPercent,
      developmentMarginPercent: wert.developmentMarginPercent,
      dscrBase: base.dscr,
      totalDevelopmentCostChf: projektkosten.totalDevelopmentCostChf,
      maxTotalProjectVolumeChf: profile.budget.maxTotalProjectVolumeChf,
    },
    baupotenzial: {
      zoneVerification: facts.zoneVerification,
      overallVerification: facts.overallVerification,
      achievedNraM2: baupotenzial.adjustedNraM2,
      targetMinNraM2: profile.projektziel.minNraM2,
      targetMaxNraM2: profile.projektziel.maxNraM2,
      formTopografieFactor,
      erschliessungOk: facts.erschliessungOk,
      zufahrtOk: facts.zufahrtOk,
    },
    markt: {
      vacancyRatePercent: market.localVacancyRatePercent,
      populationGrowth3yPercent: market.populationGrowth3yPercent,
      rentLevelRatio: market.rentLevelRatio,
      constructionActivityRatePercent: market.constructionActivityRatePercent,
    },
    lage: {
      oevGueteklasse: facts.oevGueteklasse,
      reachableResidents30min: market.reachableResidents30min,
      zielmieterFitRatio: market.zielmieterFitRatio,
    },
    risiko: facts.risiken,
  };
  const score = calculateScore(scoreInput, { weights: scoreWeights, bands: scoreBands, riskDeductions });

  const now = new Date().toISOString();
  const point = <T,>(value: T, confidence: number, source: DataPoint<T>["source"], verified: boolean, note?: string): DataPoint<T>[] => [
    { value, source, confidence, verified, fetchedAt: now, note },
  ];
  const confidence = calculateConfidence(
    {
      adresseParzelle: point(
        facts.egrid ? `EGRID ${facts.egrid}, Kanton ${listing.canton}` : `Kanton ${listing.canton}, kein EGRID erfasst`,
        facts.egrid ? 95 : 60,
        facts.egrid ? "OFFICIAL_AUTOMATED" : "LISTING_EXTRACTED",
        Boolean(facts.egrid),
        facts.egrid ? undefined : "Kein amtlicher Parzellennachweis (EGRID) hinterlegt.",
      ),
      zoneBauparameter: point(
        `${facts.zoneLabel}, ${baupotenzialLabel(facts.baupotenzial)}`,
        facts.zoneVerification === "A" ? 90 : facts.zoneVerification === "B" ? 65 : 35,
        "OFFICIAL_AUTOMATED",
        facts.zoneVerification === "A",
        `Verifikationsstufe ${facts.zoneVerification}${facts.zoneVerification === "A" ? "" : " — amtliches Dokument nicht (vollständig) nutzerseitig bestätigt"}.`,
      ),
      risikenOereb: point(
        facts.notes || "Keine ergänzenden Risiko-/ÖREB-Angaben erfasst",
        facts.overallVerification === "A" ? 80 : facts.overallVerification === "B" ? 50 : 25,
        "LISTING_EXTRACTED",
        facts.overallVerification === "A",
      ),
      mietdaten: point(
        profile.marktannahmen.netRentChfPerM2Month,
        10,
        "USER_ASSUMPTION",
        false,
        "Generische Suchprofil-Annahme, kein lokaler Mietvergleich hinterlegt.",
      ),
      baukosten: point(
        profile.baukosten.buildingCostChfPerM2,
        35,
        "LISTING_EXTRACTED",
        false,
        "Nur Suchprofil-Annahme bzw. Inseratsangabe, extern nicht bestätigt.",
      ),
      inseratsvollstaendigkeit: point("Preis, Fläche, Kanton vorhanden", 75, "LISTING_EXTRACTED", false),
      finanzierung: point(profile.finanzierung.interestRateBasePercent, 40, "USER_ASSUMPTION", false, "Generische Suchprofil-Annahme, kein Bankangebot."),
    },
    confidenceWeights,
  );

  const hardGateCtx: HardGateContext = {
    listing: {
      canton: listing.canton,
      objectType: listing.objectType,
      baurecht: false,
      erschliessung: facts.erschliessungOk,
      coordinates: facts.coordinates,
      municipalityBfsId: undefined,
      askingPriceChf: listing.askingPriceChf,
      parcelAreaM2: listing.parcelAreaM2,
    },
    profile: {
      regions: profile.regions,
      objektart: profile.objektart,
      budget: profile.budget,
      projektziel: profile.projektziel,
      risiken: profile.risiken,
      grundstueck: profile.grundstueck,
    },
    totalDevelopmentCostChf: projektkosten.totalDevelopmentCostChf,
    equityRequiredChf: finanzierungBase.equityRequiredChf,
    achievedNraM2: baupotenzial.adjustedNraM2,
    isInBuildingZone: true,
    residentialUsePermitted: true,
    zufahrtOk: facts.zufahrtOk,
    prohibitedNaturalHazard: facts.risiken.naturgefahren,
    prohibitedContamination: facts.risiken.altlasten,
  };
  const hardGate = evaluateHardGates(hardGateCtx);

  const empfehlung = deriveEmpfehlung(hardGate, score.total, confidence.total, profile.alerts, empfehlungParams);

  return {
    baupotenzial: { estimatedGfaM2: baupotenzial.estimatedGfaM2, adjustedNraM2: baupotenzial.adjustedNraM2 },
    base: {
      totalDevelopmentCostChf: projektkosten.totalDevelopmentCostChf,
      equityRequiredChf: finanzierungBase.equityRequiredChf,
      loanToCostPercent: profile.finanzierung.loanToCostPercent,
      dscr: base.dscr,
      cashOnCashPercent: base.cashOnCashPercent,
      noiChf: base.noiChf,
    },
    stress: {
      dscr: stress.dscr,
      cashOnCashPercent: stress.cashOnCashPercent,
      rentChfPerM2Month: scenarioInputs.rentChfPerM2Month * (1 + stressParams.rentDeltaPct / 100),
      buildingCostPerM2Chf: scenarioInputs.buildingCostPerM2Chf * (1 + stressParams.constructionCostDeltaPct / 100),
      interestRatePercent: scenarioInputs.interestRatePercent + stressParams.interestRateDeltaPp,
    },
    wert,
    yieldOnCostPercent,
    score,
    confidence,
    hardGate,
    empfehlung,
    assumptionNotes,
  };
}

const CHAM_LISTING_INPUT: ListingAnalysisInput = {
  canton: CHAM_FACTS.canton,
  objectType: "BAULAND",
  askingPriceChf: CHAM_FACTS.askingPriceChf,
  parcelAreaM2: CHAM_FACTS.parcelAreaM2,
};

const CHAM_VERTIEFUNG_FACTS: ListingVertiefungFacts = {
  baupotenzial: { method: "DENSITY_RATIO", densityRatio: CHAM_FACTS.densityRatio },
  zoneLabel: "W3",
  zoneVerification: CHAM_FACTS.zoneVerification,
  overallVerification: CHAM_FACTS.overallVerification,
  oevGueteklasse: CHAM_FACTS.oevGueteklasse,
  erschliessungOk: true,
  zufahrtOk: true,
  risiken: {
    altlasten: false,
    naturgefahren: false,
    gewaesser: false,
    laerm: false,
    planungszone: false,
    zufahrt: true, // gemeinsames Erschliessungsrecht, ÖREB ausstehend
    erschliessung: false,
    baukostenrisiken: true, // Baukosten nur Inseratsangabe, extern nicht bestätigt
  },
  coordinates: CHAM_FACTS.coordinates,
  egrid: "CH685284972",
  marktAnnahmen: {
    localVacancyRatePercent: CHAM_FACTS.localVacancyRatePercent,
    populationGrowth3yPercent: UNVERIFIED_MARKET_ASSUMPTIONS.populationGrowth3yPercent,
    rentLevelRatio: UNVERIFIED_MARKET_ASSUMPTIONS.rentLevelRatio,
    constructionActivityRatePercent: UNVERIFIED_MARKET_ASSUMPTIONS.constructionActivityRatePercent,
    zielmieterFitRatio: UNVERIFIED_MARKET_ASSUMPTIONS.zielmieterFitRatio,
    reachableResidents30min: UNVERIFIED_MARKET_ASSUMPTIONS.reachableResidents30min,
  },
  notes: "Erschliessungsrecht gemeinsam, ÖREB-Auszug noch nicht vorliegend.",
};

/**
 * Rechnet "Chamerstrasse, Cham ZG" durch — dünner Wrapper um `computeListingAnalysis`
 * mit den Cham-Demo-Fakten. Ändert der Nutzer im Wizard z.B. die Baukosten, ändert
 * sich dieses Ergebnis entsprechend.
 */
export function computeChamAnalysis(profile: SearchProfile, annahmenOverrides: AnnahmenOverrides): ObjektAnalysisResult {
  return computeListingAnalysis(profile, annahmenOverrides, CHAM_LISTING_INPUT, CHAM_VERTIEFUNG_FACTS);
}
