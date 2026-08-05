import type { Listing, SearchProfile, HardGateReason, HardGateResult, HardGateOverride } from "@landfinder/domain";

export interface HardGateContext {
  listing: Pick<
    Listing,
    | "canton"
    | "objectType"
    | "baurecht"
    | "erschliessung"
    | "coordinates"
    | "municipalityBfsId"
    | "askingPriceChf"
    | "parcelAreaM2"
  >;
  profile: Pick<SearchProfile, "regions" | "objektart" | "budget" | "projektziel" | "risiken" | "grundstueck">;
  totalDevelopmentCostChf: number;
  equityRequiredChf: number;
  achievedNraM2: number;
  isInBuildingZone: boolean;
  residentialUsePermitted: boolean;
  zufahrtOk: boolean;
  prohibitedNaturalHazard: boolean;
  prohibitedContamination: boolean;
}

interface RuleCheck {
  reason: HardGateReason;
  evidence: string;
  triggered: boolean;
}

/**
 * Prüft alle Hard Gates aus Abschnitt 17 in der hier definierten Reihenfolge und
 * gibt die erste zutreffende Regel zurück — Hard Gates sind nicht kompensierbar
 * durch einen guten Score. Mit `manualOverride` kann eine Regel gezielt und mit
 * Begründung übersteuert werden; Regel und Beleg bleiben dabei sichtbar.
 */
export function evaluateHardGates(ctx: HardGateContext, manualOverride?: HardGateOverride): HardGateResult {
  const rules: RuleCheck[] = [
    {
      reason: "LOCATION_NOT_IDENTIFIABLE",
      evidence: "Weder Koordinaten noch BFS-Gemeindenummer vorhanden.",
      triggered: !ctx.listing.coordinates && !ctx.listing.municipalityBfsId,
    },
    {
      reason: "OUTSIDE_REGION",
      evidence: `Kanton ${ctx.listing.canton ?? "unbekannt"} nicht im Suchprofil (${ctx.profile.regions.cantons.join(", ")}).`,
      triggered: !ctx.listing.canton || !ctx.profile.regions.cantons.includes(ctx.listing.canton),
    },
    {
      reason: "WRONG_OBJECT_TYPE",
      evidence: `Objektart ${ctx.listing.objectType} im Suchprofil deaktiviert.`,
      triggered:
        (ctx.listing.objectType === "BAULAND" && !ctx.profile.objektart.baulandEnabled) ||
        (ctx.listing.objectType === "ABBRUCHOBJEKT" && !ctx.profile.objektart.abbruchobjektEnabled),
    },
    {
      reason: "BAURECHT_EXCLUDED",
      evidence: "Baurecht liegt vor, Suchprofil schliesst Baurecht aus.",
      triggered: Boolean(ctx.listing.baurecht) && ctx.profile.objektart.baurecht === "EXCLUDE",
    },
    {
      reason: "NOT_IN_BUILDING_ZONE",
      evidence: "Parzelle liegt nicht in einer Wohnbauzone.",
      triggered: !ctx.isInBuildingZone,
    },
    {
      reason: "RESIDENTIAL_USE_NOT_PERMITTED",
      evidence: "Wohnnutzung an diesem Standort nicht zulässig.",
      triggered: !ctx.residentialUsePermitted,
    },
    {
      reason: "PROHIBITED_CONTAMINATION",
      evidence: "Belasteter Standort, im Suchprofil ausgeschlossen.",
      triggered: ctx.prohibitedContamination && ctx.profile.risiken.excludedContamination,
    },
    {
      reason: "PROHIBITED_NATURAL_HAZARD",
      evidence: "Naturgefahr, im Suchprofil ausgeschlossen.",
      triggered: ctx.prohibitedNaturalHazard && ctx.profile.risiken.excludedNaturalHazards,
    },
    {
      reason: "ACCESS_MISSING",
      evidence: "Erschliessung/Zufahrt fehlt oder ist nicht gesichert.",
      triggered: ctx.listing.erschliessung === false || !ctx.zufahrtOk,
    },
    {
      reason: "PRICE_ABOVE_MAXIMUM",
      evidence: `Angebotspreis über dem maximalen Grundstückspreis (CHF ${ctx.profile.budget.maxLandPriceChf}).`,
      triggered: (ctx.listing.askingPriceChf ?? 0) > ctx.profile.budget.maxLandPriceChf,
    },
    {
      reason: "PRICE_PER_M2_ABOVE_MAXIMUM",
      evidence: `Preis/m² (CHF ${
        ctx.listing.parcelAreaM2 ? Math.round((ctx.listing.askingPriceChf ?? 0) / ctx.listing.parcelAreaM2) : "?"
      }) über dem maximalen Preis/m² des Suchprofils (CHF ${ctx.profile.grundstueck.maxPricePerM2Chf ?? "?"}).`,
      triggered:
        ctx.profile.grundstueck.maxPricePerM2Chf !== undefined &&
        Boolean(ctx.listing.parcelAreaM2) &&
        ctx.listing.parcelAreaM2! > 0 &&
        (ctx.listing.askingPriceChf ?? 0) / ctx.listing.parcelAreaM2! > ctx.profile.grundstueck.maxPricePerM2Chf,
    },
    {
      reason: "TOTAL_PROJECT_ABOVE_MAXIMUM",
      evidence: `Gesamtinvestition über dem maximalen Projektvolumen (CHF ${ctx.profile.budget.maxTotalProjectVolumeChf}).`,
      triggered: ctx.totalDevelopmentCostChf > ctx.profile.budget.maxTotalProjectVolumeChf,
    },
    {
      reason: "EQUITY_ABOVE_MAXIMUM",
      evidence: `Eigenkapitalbedarf über dem maximalen Eigenkapital (CHF ${ctx.profile.budget.maxEquityChf}).`,
      triggered: ctx.equityRequiredChf > ctx.profile.budget.maxEquityChf,
    },
    {
      reason: "PROJECT_SIZE_UNREACHABLE",
      evidence: `Erreichbare NRA (${ctx.achievedNraM2} m²) liegt unter dem minimalen Zielwert des Suchprofils.`,
      triggered: ctx.profile.projektziel.minNraM2 !== undefined && ctx.achievedNraM2 < ctx.profile.projektziel.minNraM2,
    },
  ];

  const first = rules.find((r) => r.triggered);
  if (!first) return { status: "PASSED" };

  if (manualOverride) {
    return { status: "PASSED", reason: first.reason, evidence: first.evidence, override: manualOverride };
  }
  return { status: "REJECTED_BY_RULE", reason: first.reason, evidence: first.evidence };
}
