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

export interface ChamAnalysisResult {
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
 * Rechnet "Chamerstrasse, Cham ZG" komplett durch financial-engine + scoring-engine,
 * mit den aktuellen Suchprofil-Annahmen und Annahmen-Register-Overrides — ändert der
 * Nutzer im Wizard z.B. die Baukosten, ändert sich dieses Ergebnis entsprechend.
 */
export function computeChamAnalysis(profile: SearchProfile, annahmenOverrides: AnnahmenOverrides): ChamAnalysisResult {
  const assumptionNotes: string[] = [
    "Ausnützungsziffer 0.6 und Zone W3 aus der ursprünglichen Objektbeschreibung übernommen, nicht durch ein amtliches Dokument in diesem System verifiziert.",
    "Erreichbare Bevölkerung (30 Min.), Bevölkerungswachstum, Mietniveau-Verhältnis und Bautätigkeit: keine Wüest-Daten für Kanton ZG hinterlegt (nur Baden/Wohlen AG) — grobe Schätzungen bzw. neutrale Werte, siehe UNVERIFIED_MARKET_ASSUMPTIONS.",
    "Zielmieter-Fit noch nicht manuell beurteilt — Bandmitte (0.5) angenommen.",
    "Zufahrt gilt als gesichert (Hard Gate passiert), aber als weicher Risikofaktor markiert — laut Objektbeschreibung ein gemeinsames Erschliessungsrecht mit ausstehendem ÖREB-Auszug.",
    "Parkplatzanzahl nicht erfasst — Parkplatzkosten/-erträge mit 0 angenommen.",
  ];

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
    method: "DENSITY_RATIO",
    parcelAreaM2: CHAM_FACTS.parcelAreaM2,
    densityRatio: CHAM_FACTS.densityRatio,
    factors: baupotenzialFactors,
  });

  const ownerUseNraM2 = profile.eigennutzung.enabled ? profile.eigennutzung.targetSizeM2 ?? 0 : 0;

  const buildingCost = buildingCostChf({
    basis: profile.baukosten.costBasis,
    costPerM2Chf: profile.baukosten.buildingCostChfPerM2,
    gfaM2: baupotenzial.estimatedGfaM2,
    nraM2: baupotenzial.adjustedNraM2,
  });

  const projektkosten = calculateProjektkosten({
    landCostChf: CHAM_FACTS.askingPriceChf,
    purchaseCostsChf: 0, // Handänderungssteuer/Notariat: nicht separat im Suchprofil erfasst
    demolitionChf: 0, // Bauland, kein Abbruchobjekt
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

    landCostChf: CHAM_FACTS.askingPriceChf,
    purchaseCostsChf: 0,
    demolitionChf: 0,
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
    askingLandPriceChf: CHAM_FACTS.askingPriceChf,
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
    askingLandPriceChf: CHAM_FACTS.askingPriceChf,
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
      zoneVerification: CHAM_FACTS.zoneVerification,
      overallVerification: CHAM_FACTS.overallVerification,
      achievedNraM2: baupotenzial.adjustedNraM2,
      targetMinNraM2: profile.projektziel.minNraM2,
      targetMaxNraM2: profile.projektziel.maxNraM2,
      formTopografieFactor,
      erschliessungOk: true,
      zufahrtOk: true,
    },
    markt: {
      vacancyRatePercent: CHAM_FACTS.localVacancyRatePercent,
      populationGrowth3yPercent: UNVERIFIED_MARKET_ASSUMPTIONS.populationGrowth3yPercent,
      rentLevelRatio: UNVERIFIED_MARKET_ASSUMPTIONS.rentLevelRatio,
      constructionActivityRatePercent: UNVERIFIED_MARKET_ASSUMPTIONS.constructionActivityRatePercent,
    },
    lage: {
      oevGueteklasse: CHAM_FACTS.oevGueteklasse,
      reachableResidents30min: UNVERIFIED_MARKET_ASSUMPTIONS.reachableResidents30min,
      zielmieterFitRatio: UNVERIFIED_MARKET_ASSUMPTIONS.zielmieterFitRatio,
    },
    risiko: {
      altlasten: false,
      naturgefahren: false,
      gewaesser: false,
      laerm: false,
      planungszone: false,
      zufahrt: true, // gemeinsames Erschliessungsrecht, ÖREB ausstehend
      erschliessung: false,
      baukostenrisiken: true, // Baukosten nur Inseratsangabe, extern nicht bestätigt
    },
  };
  const score = calculateScore(scoreInput, { weights: scoreWeights, bands: scoreBands, riskDeductions });

  const now = new Date().toISOString();
  const point = <T,>(value: T, confidence: number, source: DataPoint<T>["source"], verified: boolean, note?: string): DataPoint<T>[] => [
    { value, source, confidence, verified, fetchedAt: now, note },
  ];
  const confidence = calculateConfidence(
    {
      adresseParzelle: point("Chamerstrasse, 6330 Cham, Parzelle 2214, EGRID CH685284972", 95, "OFFICIAL_AUTOMATED", true),
      zoneBauparameter: point(
        "W3, Ausnützungsziffer 0.6",
        65,
        "OFFICIAL_AUTOMATED",
        false,
        "Amtliches Dokument vorhanden, nutzerseitig nicht bestätigt (Stufe B)",
      ),
      risikenOereb: point("ÖREB-Auszug ausstehend", 30, "LISTING_EXTRACTED", false, "Erschliessungsrecht gemeinsam, Auszug noch nicht vorliegend"),
      mietdaten: point(profile.marktannahmen.netRentChfPerM2Month, 10, "USER_ASSUMPTION", false, "Kein Wüest-Mietvergleich für Cham hinterlegt"),
      baukosten: point(profile.baukosten.buildingCostChfPerM2, 35, "LISTING_EXTRACTED", false, "Nur Inseratsangabe, extern nicht bestätigt"),
      inseratsvollstaendigkeit: point("Adresse, Preis, Fläche, Zone vorhanden", 75, "LISTING_EXTRACTED", false),
      finanzierung: point(profile.finanzierung.interestRateBasePercent, 40, "USER_ASSUMPTION", false, "Generische Suchprofil-Annahme, kein Bankangebot"),
    },
    confidenceWeights,
  );

  const hardGateCtx: HardGateContext = {
    listing: {
      canton: CHAM_FACTS.canton,
      objectType: "BAULAND",
      baurecht: false,
      erschliessung: true,
      coordinates: CHAM_FACTS.coordinates,
      municipalityBfsId: undefined,
      askingPriceChf: CHAM_FACTS.askingPriceChf,
      parcelAreaM2: CHAM_FACTS.parcelAreaM2,
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
    zufahrtOk: true,
    prohibitedNaturalHazard: false,
    prohibitedContamination: false,
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
