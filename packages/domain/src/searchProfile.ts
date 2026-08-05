import type { KantonCode, OevGueteklasse } from "./geography";

export interface SearchProfileRegions {
  cantons: KantonCode[];
  districts?: string[];
  municipalities?: string[];
  excludedMunicipalities?: string[];
  referenceAddress?: string;
  radiusKm?: number;
  maxTravelTimeMinutes?: number;
  minOevGueteklasse?: OevGueteklasse;
}

export interface SearchProfileBudget {
  maxEquityChf: number;
  maxLandPriceChf: number;
  maxTotalProjectVolumeChf: number;
  liquidityReserveChf?: number;
  debtRatioTargetPercent?: number;
  projectDurationMonths?: number;
  negativeRampUpAllowed: boolean;
}

export type BaurechtPolicy = "EXCLUDE" | "MANUAL_REVIEW" | "ALLOW";

export interface SearchProfileObjektart {
  baulandEnabled: boolean;
  abbruchobjektEnabled: boolean;
  baurecht: BaurechtPolicy;
}

export interface SearchProfileGrundstueck {
  minAreaM2?: number;
  maxAreaM2?: number;
  maxPricePerM2Chf?: number;
  erschliessungRequired: boolean;
  hanglageAllowed: boolean;
  zufahrtRequired: boolean;
  altlastenAllowed: boolean;
  naturgefahrAllowed: boolean;
  minWidthM?: number;
  minDepthM?: number;
}

export interface SearchProfileProjektziel {
  minUnits?: number;
  maxUnits?: number;
  minNraM2?: number;
  maxNraM2?: number;
  parkingRequired: boolean;
  liftRequired: boolean;
  accessibilityRequired: boolean;
  balconiesRequired: boolean;
  energyStandard?: string;
  constructionType?: string;
}

export interface SearchProfileEigennutzung {
  enabled: boolean;
  unitCount?: number;
  targetSizeM2?: number;
  roomCount?: number;
  positionInBuilding?: string;
  imputedMarketRentChfPerM2Month?: number;
  maxAreaSharePercent?: number;
  maxCapitalSharePercent?: number;
}

export interface SearchProfileMarktannahmen {
  netRentChfPerM2Month: number;
  parkingRentChfPerMonth?: number;
  vacancyRatePercent: number;
  collectionLossRatePercent: number;
  managementCostPercent: number;
  maintenanceCostPercent: number;
  nonRecoverableCostPercent: number;
  capexReservePercent: number;
  exitCapRatePercent: number;
}

export interface SearchProfileBaukosten {
  costBasis: "GFA" | "NRA";
  buildingCostChfPerM2: number;
  demolitionCostChfPerM2?: number;
  erschliessungCostChf?: number;
  umgebungCostChf?: number;
  werkanschlussCostChf?: number;
  parkingCostPerSpotChf?: number;
  feesPercent: number;
  permitsPercent: number;
  contingencyPercent: number;
  constructionFinancingPercent: number;
  initialLeasingCostPercent: number;
}

export interface SearchProfileFinanzierung {
  loanToCostPercent: number;
  interestRateBasePercent: number;
  interestRateStressPercent: number;
  amortizationPercent: number;
}

export interface SearchProfileRenditeziele {
  minDscr: number;
  minCashOnCashPercent: number;
  minYieldOnCostPercent: number;
  targetMarginPercent: number;
}

export interface SearchProfileRisiken {
  excludedContamination: boolean;
  excludedNaturalHazards: boolean;
  additionalExclusions?: string[];
}

export interface SearchProfileAlerts {
  thresholdA: number;
  thresholdB: number;
  minDataConfidence: number;
  potentialAEnabled: boolean;
  recipients: string[];
  /** "HH:mm" */
  digestTime: string;
  priceDropThresholdPercent: number;
  maxImmediateEmailsPerDay: number;
}

export interface SearchProfileQuellen {
  homegate: boolean;
  immoscout24: boolean;
  newhome: boolean;
  imapEnabled: boolean;
  smtpEnabled: boolean;
  wuestEnabled: boolean;
  llmEnabled: boolean;
}

/**
 * Ein aktives, editierbares, versioniertes Suchprofil (Abschnitt 1.2 / 6).
 * Im MVP existiert genau eines — mehrere parallele Suchprofile sind bewusst nicht im Scope.
 */
export interface SearchProfile {
  id: string;
  version: number;
  updatedAt: string;
  regions: SearchProfileRegions;
  budget: SearchProfileBudget;
  objektart: SearchProfileObjektart;
  grundstueck: SearchProfileGrundstueck;
  projektziel: SearchProfileProjektziel;
  eigennutzung: SearchProfileEigennutzung;
  marktannahmen: SearchProfileMarktannahmen;
  baukosten: SearchProfileBaukosten;
  finanzierung: SearchProfileFinanzierung;
  renditeziele: SearchProfileRenditeziele;
  risiken: SearchProfileRisiken;
  alerts: SearchProfileAlerts;
  quellen: SearchProfileQuellen;
}
