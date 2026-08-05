export type BuildingCostBasis = "GFA" | "NRA";

export interface BuildingCostInput {
  basis: BuildingCostBasis;
  costPerM2Chf: number;
  gfaM2?: number;
  nraM2?: number;
}

/** `building_cost = cost_per_gfa_m2 * gfa` oder `cost_per_nra_m2 * nra` (Abschnitt 11) — Methode bleibt sichtbar. */
export function buildingCostChf(input: BuildingCostInput): number {
  if (input.basis === "GFA") {
    if (input.gfaM2 === undefined) throw new Error("gfaM2 erforderlich für Kostenbasis GFA");
    return input.costPerM2Chf * input.gfaM2;
  }
  if (input.nraM2 === undefined) throw new Error("nraM2 erforderlich für Kostenbasis NRA");
  return input.costPerM2Chf * input.nraM2;
}

/**
 * Alle Kostenpositionen aus Abschnitt 11. Die prozentualen Positionen (Honorare,
 * Bewilligungen, Reserve, Baufinanzierung, Erstvermietung) werden — wie im
 * Suchprofil (`SearchProfileBaukosten`) so benannt und branchenüblich — als
 * Prozentsatz der Gebäudekosten verstanden; das ist eine Modellannahme und wird
 * hier bewusst als expliziter Parameter (`buildingCostChf`) sichtbar gehalten,
 * nicht in der Formel versteckt.
 */
export interface ProjektkostenInput {
  landCostChf: number;
  purchaseCostsChf: number;
  demolitionChf: number;
  remediationChf: number;
  sitePreparationChf: number;
  buildingCostChf: number;
  parkingCostChf: number;
  utilityConnectionsChf: number;
  externalWorksChf: number;
  professionalFeesPercent: number;
  permitsAndFeesPercent: number;
  contingencyPercent: number;
  constructionFinancingPercent: number;
  initialLeasingCostPercent: number;
}

export interface ProjektkostenResult {
  professionalFeesChf: number;
  permitsAndFeesChf: number;
  contingencyChf: number;
  constructionFinancingChf: number;
  initialLeasingCostChf: number;
  totalDevelopmentCostChf: number;
  /** Gesamtkosten ohne Landkosten — Grundlage für den Residualwert (Abschnitt 13). */
  totalCostExcludingLandChf: number;
}

export function calculateProjektkosten(input: ProjektkostenInput): ProjektkostenResult {
  const professionalFeesChf = input.buildingCostChf * (input.professionalFeesPercent / 100);
  const permitsAndFeesChf = input.buildingCostChf * (input.permitsAndFeesPercent / 100);
  const contingencyChf = input.buildingCostChf * (input.contingencyPercent / 100);
  const constructionFinancingChf = input.buildingCostChf * (input.constructionFinancingPercent / 100);
  const initialLeasingCostChf = input.buildingCostChf * (input.initialLeasingCostPercent / 100);

  const totalCostExcludingLandChf =
    input.purchaseCostsChf +
    input.demolitionChf +
    input.remediationChf +
    input.sitePreparationChf +
    input.buildingCostChf +
    input.parkingCostChf +
    input.utilityConnectionsChf +
    input.externalWorksChf +
    professionalFeesChf +
    permitsAndFeesChf +
    contingencyChf +
    constructionFinancingChf +
    initialLeasingCostChf;

  const totalDevelopmentCostChf = input.landCostChf + totalCostExcludingLandChf;

  return {
    professionalFeesChf,
    permitsAndFeesChf,
    contingencyChf,
    constructionFinancingChf,
    initialLeasingCostChf,
    totalDevelopmentCostChf,
    totalCostExcludingLandChf,
  };
}
