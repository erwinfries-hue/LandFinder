import type { SearchProfile } from "@landfinder/domain";

export type ProfileFieldType = "number" | "boolean" | "text";

export interface ProfileFieldDescriptor {
  key: string;
  label: string;
  type: ProfileFieldType;
  unit?: string;
}

export interface ProfileSectionDescriptor {
  sectionKey: keyof SearchProfile;
  title: string;
  fields: ProfileFieldDescriptor[];
}

/**
 * Alle numerischen/booleschen Suchprofil-Felder, flach nach Sektion gruppiert — die
 * Datengrundlage für die Tabellenansicht "Alle Werte" (Ergänzung zum Wizard, auf
 * Wunsch als admin-artige Übersicht). Listen-, Text- und Enum-Felder (Kantone,
 * Empfänger, Energiestandard, Baurecht-Policy etc.) bleiben bewusst in den jeweiligen
 * Wizard-Reitern, wo sie mit Auswahl-UI sinnvoller bedienbar sind.
 */
export const PROFILE_SECTIONS: ProfileSectionDescriptor[] = [
  {
    sectionKey: "regions",
    title: "Regionen",
    fields: [
      { key: "radiusKm", label: "Radius", type: "number", unit: "km" },
      { key: "maxTravelTimeMinutes", label: "Maximale Fahrzeit", type: "number", unit: "Min." },
    ],
  },
  {
    sectionKey: "budget",
    title: "Budget und Eigenkapital",
    fields: [
      { key: "maxEquityChf", label: "Maximales Eigenkapital", type: "number", unit: "CHF" },
      { key: "maxLandPriceChf", label: "Maximaler Grundstückspreis", type: "number", unit: "CHF" },
      { key: "maxTotalProjectVolumeChf", label: "Maximales Gesamtprojektvolumen", type: "number", unit: "CHF" },
      { key: "liquidityReserveChf", label: "Liquiditätsreserve", type: "number", unit: "CHF" },
      { key: "debtRatioTargetPercent", label: "Fremdfinanzierungsanteil Ziel", type: "number", unit: "%" },
      { key: "projectDurationMonths", label: "Projektlaufzeit", type: "number", unit: "Monate" },
      { key: "negativeRampUpAllowed", label: "Negative Anlaufphase zulässig", type: "boolean" },
    ],
  },
  {
    sectionKey: "objektart",
    title: "Objektart",
    fields: [
      { key: "baulandEnabled", label: "Unbebautes Bauland", type: "boolean" },
      { key: "abbruchobjektEnabled", label: "Grundstück mit Abbruchobjekt", type: "boolean" },
    ],
  },
  {
    sectionKey: "grundstueck",
    title: "Grundstück",
    fields: [
      { key: "minAreaM2", label: "Minimale Fläche", type: "number", unit: "m²" },
      { key: "maxAreaM2", label: "Maximale Fläche", type: "number", unit: "m²" },
      { key: "maxPricePerM2Chf", label: "Maximaler Preis/m²", type: "number", unit: "CHF" },
      { key: "minWidthM", label: "Mindestbreite", type: "number", unit: "m" },
      { key: "minDepthM", label: "Mindesttiefe", type: "number", unit: "m" },
      { key: "erschliessungRequired", label: "Erschliessung erforderlich", type: "boolean" },
      { key: "hanglageAllowed", label: "Hanglage zulässig", type: "boolean" },
      { key: "zufahrtRequired", label: "Zufahrt erforderlich", type: "boolean" },
      { key: "altlastenAllowed", label: "Altlasten zulässig", type: "boolean" },
      { key: "naturgefahrAllowed", label: "Naturgefahr zulässig", type: "boolean" },
    ],
  },
  {
    sectionKey: "projektziel",
    title: "Projektziel",
    fields: [
      { key: "minUnits", label: "Minimale Wohnungen", type: "number" },
      { key: "maxUnits", label: "Maximale Wohnungen", type: "number" },
      { key: "minNraM2", label: "Minimale Nettowohnfläche", type: "number", unit: "m²" },
      { key: "maxNraM2", label: "Maximale Nettowohnfläche", type: "number", unit: "m²" },
      { key: "parkingRequired", label: "Parkplätze", type: "boolean" },
      { key: "liftRequired", label: "Lift", type: "boolean" },
      { key: "accessibilityRequired", label: "Barrierefreiheit", type: "boolean" },
      { key: "balconiesRequired", label: "Balkone/Terrassen", type: "boolean" },
    ],
  },
  {
    sectionKey: "eigennutzung",
    title: "Eigennutzung",
    fields: [
      { key: "enabled", label: "Eigennutzung geplant", type: "boolean" },
      { key: "unitCount", label: "Anzahl Einheiten", type: "number" },
      { key: "targetSizeM2", label: "Zielgrösse", type: "number", unit: "m²" },
      { key: "roomCount", label: "Zimmerzahl", type: "number" },
      { key: "positionInBuilding", label: "Lage im Gebäude", type: "text" },
      { key: "imputedMarketRentChfPerM2Month", label: "Kalkulatorische Marktmiete", type: "number", unit: "CHF/m²/Mt." },
      { key: "maxAreaSharePercent", label: "Maximaler Flächenanteil", type: "number", unit: "%" },
      { key: "maxCapitalSharePercent", label: "Maximaler Kapitalanteil", type: "number", unit: "%" },
    ],
  },
  {
    sectionKey: "marktannahmen",
    title: "Marktannahmen",
    fields: [
      { key: "netRentChfPerM2Month", label: "Nettomiete", type: "number", unit: "CHF/m²/Mt." },
      { key: "parkingRentChfPerMonth", label: "Parkplatzmiete", type: "number", unit: "CHF/Mt." },
      { key: "vacancyRatePercent", label: "Leerstand", type: "number", unit: "%" },
      { key: "collectionLossRatePercent", label: "Mietausfall", type: "number", unit: "%" },
      { key: "managementCostPercent", label: "Verwaltung", type: "number", unit: "%" },
      { key: "maintenanceCostPercent", label: "Unterhalt", type: "number", unit: "%" },
      { key: "nonRecoverableCostPercent", label: "Nicht umlagefähige Kosten", type: "number", unit: "%" },
      { key: "capexReservePercent", label: "Capex-Reserve", type: "number", unit: "%" },
      { key: "exitCapRatePercent", label: "Exit-Kapitalisierungssatz", type: "number", unit: "%" },
    ],
  },
  {
    sectionKey: "baukosten",
    title: "Baukosten",
    fields: [
      { key: "buildingCostChfPerM2", label: "Gebäudekosten", type: "number", unit: "CHF/m²" },
      { key: "demolitionCostChfPerM2", label: "Abbruch", type: "number", unit: "CHF/m²" },
      { key: "erschliessungCostChf", label: "Erschliessung", type: "number", unit: "CHF" },
      { key: "umgebungCostChf", label: "Umgebung", type: "number", unit: "CHF" },
      { key: "werkanschlussCostChf", label: "Werkanschlüsse", type: "number", unit: "CHF" },
      { key: "parkingCostPerSpotChf", label: "Parkierung", type: "number", unit: "CHF/Platz" },
      { key: "feesPercent", label: "Honorare", type: "number", unit: "%" },
      { key: "permitsPercent", label: "Bewilligungen", type: "number", unit: "%" },
      { key: "contingencyPercent", label: "Reserve", type: "number", unit: "%" },
      { key: "constructionFinancingPercent", label: "Baufinanzierung", type: "number", unit: "%" },
      { key: "initialLeasingCostPercent", label: "Erstvermietung", type: "number", unit: "%" },
    ],
  },
  {
    sectionKey: "finanzierung",
    title: "Finanzierung",
    fields: [
      { key: "loanToCostPercent", label: "Loan-to-Cost", type: "number", unit: "%" },
      { key: "interestRateBasePercent", label: "Zinssatz Base", type: "number", unit: "%" },
      { key: "interestRateStressPercent", label: "Zinssatz Stress", type: "number", unit: "%" },
      { key: "amortizationPercent", label: "Amortisation", type: "number", unit: "%" },
    ],
  },
  {
    sectionKey: "renditeziele",
    title: "Renditeziele",
    fields: [
      { key: "minDscr", label: "Mindest-DSCR", type: "number" },
      { key: "minCashOnCashPercent", label: "Mindest-Cash-on-Cash", type: "number", unit: "%" },
      { key: "minYieldOnCostPercent", label: "Mindest-Yield-on-Cost", type: "number", unit: "%" },
      { key: "targetMarginPercent", label: "Zielmarge", type: "number", unit: "%" },
    ],
  },
  {
    sectionKey: "risiken",
    title: "Risiken und Ausschlüsse",
    fields: [
      { key: "excludedContamination", label: "Altlasten ausschliessen", type: "boolean" },
      { key: "excludedNaturalHazards", label: "Naturgefahren ausschliessen", type: "boolean" },
    ],
  },
  {
    sectionKey: "alerts",
    title: "Alerts und Empfänger",
    fields: [
      { key: "thresholdA", label: "Schwelle A", type: "number", unit: "Punkte" },
      { key: "thresholdB", label: "Schwelle B", type: "number", unit: "Punkte" },
      { key: "minDataConfidence", label: "Mindest-Datenvertrauen", type: "number", unit: "Punkte" },
      { key: "potentialAEnabled", label: "Potenzial-A aktiv", type: "boolean" },
      { key: "priceDropThresholdPercent", label: "Preisreduktion ab", type: "number", unit: "%" },
      { key: "maxImmediateEmailsPerDay", label: "Max. Sofort-E-Mails/Tag", type: "number" },
    ],
  },
  {
    sectionKey: "quellen",
    title: "Quellen",
    fields: [
      { key: "homegate", label: "Homegate", type: "boolean" },
      { key: "immoscout24", label: "ImmoScout24", type: "boolean" },
      { key: "newhome", label: "newhome", type: "boolean" },
      { key: "imapEnabled", label: "IMAP (E-Mail-Import)", type: "boolean" },
      { key: "smtpEnabled", label: "SMTP (Alert-Versand)", type: "boolean" },
      { key: "wuestEnabled", label: "Wüest Partner", type: "boolean" },
      { key: "llmEnabled", label: "LLM-Anbindung", type: "boolean" },
    ],
  },
];
