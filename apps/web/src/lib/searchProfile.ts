import type { SearchProfile } from "@landfinder/domain";
import regionsConfig from "../../../../config/regions.json";

export const AVAILABLE_CANTONS: { code: string; name: string }[] = regionsConfig.cantons.map((c) => ({
  code: c.code,
  name: c.name,
}));

/**
 * Default-Werte für ein neues Suchprofil — Schweizer Marktannahmen, klar als solche
 * dokumentiert (siehe docs/OPEN_DECISIONS.md, Punkt F). Diese Zahlen sind
 * unternehmerische Entscheidungen und werden hier nicht als Tatsachen behauptet,
 * sondern als Startpunkt zum Überschreiben.
 */
export const DEFAULT_SEARCH_PROFILE: SearchProfile = {
  id: "default",
  version: 1,
  updatedAt: new Date().toISOString().slice(0, 10),
  regions: {
    cantons: regionsConfig.cantons.filter((c) => c.defaultEnabled).map((c) => c.code),
    referenceAddress: undefined,
    radiusKm: undefined,
    maxTravelTimeMinutes: undefined,
    minOevGueteklasse: undefined,
  },
  budget: {
    maxEquityChf: 3_000_000,
    maxLandPriceChf: 5_000_000,
    maxTotalProjectVolumeChf: 15_000_000,
    liquidityReserveChf: 200_000,
    debtRatioTargetPercent: 70,
    projectDurationMonths: 30,
    negativeRampUpAllowed: true,
  },
  objektart: {
    baulandEnabled: true,
    abbruchobjektEnabled: false,
    baurecht: "MANUAL_REVIEW",
  },
  grundstueck: {
    minAreaM2: 800,
    maxAreaM2: 5000,
    maxPricePerM2Chf: 2500,
    erschliessungRequired: true,
    hanglageAllowed: true,
    zufahrtRequired: true,
    altlastenAllowed: false,
    naturgefahrAllowed: false,
  },
  projektziel: {
    minUnits: 8,
    maxUnits: 30,
    minNraM2: 600,
    maxNraM2: 3000,
    parkingRequired: true,
    liftRequired: true,
    accessibilityRequired: true,
    balconiesRequired: true,
    energyStandard: "Minergie",
    constructionType: "Massivbau",
  },
  eigennutzung: {
    enabled: false,
    unitCount: undefined,
    targetSizeM2: undefined,
    roomCount: undefined,
    positionInBuilding: undefined,
    imputedMarketRentChfPerM2Month: 25,
    maxAreaSharePercent: 20,
    maxCapitalSharePercent: 20,
  },
  marktannahmen: {
    netRentChfPerM2Month: 22,
    parkingRentChfPerMonth: 120,
    vacancyRatePercent: 3,
    collectionLossRatePercent: 1,
    managementCostPercent: 4,
    maintenanceCostPercent: 8,
    nonRecoverableCostPercent: 3,
    capexReservePercent: 2,
    exitCapRatePercent: 3.2,
  },
  baukosten: {
    costBasis: "NRA",
    buildingCostChfPerM2: 4200,
    demolitionCostChfPerM2: 250,
    erschliessungCostChf: 150_000,
    umgebungCostChf: 100_000,
    werkanschlussCostChf: 80_000,
    parkingCostPerSpotChf: 25_000,
    feesPercent: 9,
    permitsPercent: 1.5,
    contingencyPercent: 6,
    constructionFinancingPercent: 2.5,
    initialLeasingCostPercent: 1,
  },
  finanzierung: {
    loanToCostPercent: 70,
    interestRateBasePercent: 2.2,
    interestRateStressPercent: 3.7,
    amortizationPercent: 1,
  },
  renditeziele: {
    minDscr: 1.2,
    minCashOnCashPercent: 3.5,
    minYieldOnCostPercent: 4.2,
    targetMarginPercent: 15,
  },
  risiken: {
    excludedContamination: true,
    excludedNaturalHazards: true,
    additionalExclusions: [],
  },
  alerts: {
    thresholdA: 75,
    thresholdB: 55,
    minDataConfidence: 40,
    potentialAEnabled: true,
    recipients: ["erwin.fries@gmx.ch"],
    digestTime: "07:00",
    priceDropThresholdPercent: 5,
    maxImmediateEmailsPerDay: 10,
  },
  quellen: {
    homegate: true,
    immoscout24: true,
    newhome: true,
    imapEnabled: false,
    smtpEnabled: false,
    wuestEnabled: true,
    llmEnabled: false,
  },
};

const STORAGE_KEY = "landfinder.searchProfile.v1";

/**
 * Kleiner externer Store über `localStorage`, angebunden via `useSyncExternalStore`
 * (siehe `SuchprofilWizard.tsx`) — nicht über `useEffect`+`setState`, weil das beim
 * initialen Laden zu Hydration-Mismatches führen kann (Server kennt kein
 * `localStorage`) und vom React-Compiler-Lint als Anti-Pattern markiert wird.
 */
let cachedRaw: string | null = null;
let cachedProfile: SearchProfile = DEFAULT_SEARCH_PROFILE;
const listeners = new Set<() => void>();

function parse(raw: string | null): SearchProfile {
  if (!raw) return DEFAULT_SEARCH_PROFILE;
  try {
    return { ...DEFAULT_SEARCH_PROFILE, ...(JSON.parse(raw) as Partial<SearchProfile>) };
  } catch {
    return DEFAULT_SEARCH_PROFILE;
  }
}

export function getSearchProfileSnapshot(): SearchProfile {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedProfile = parse(raw);
  }
  return cachedProfile;
}

export function getSearchProfileServerSnapshot(): SearchProfile {
  return DEFAULT_SEARCH_PROFILE;
}

export function subscribeSearchProfile(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setSearchProfile(profile: SearchProfile): void {
  cachedRaw = JSON.stringify(profile);
  cachedProfile = profile;
  window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((l) => l());
}
