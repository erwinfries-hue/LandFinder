import type { SearchProfile } from "@landfinder/domain";
import { formatChf } from "./demo-data";
import { objectTypeLabel } from "./listings";

/**
 * Automatische Vorprüfung eines echten, per Stufe-2 extrahierten Inserats gegen das
 * aktuelle Suchprofil — bewusst NUR die vier Kriterien, die sich ehrlich aus den
 * extrahierten Feldern beurteilen lassen (Kanton, Objektart, Preis, Preis/m²).
 *
 * Volle Score/Empfehlung (wie bei Cham) brauchen zwingend eine Ausnützungsziffer,
 * Zonenverifikation und Koordinaten — nichts davon lässt sich aus einem Inserate-Text
 * extrahieren, ohne es zu erfinden (siehe docs/OPEN_DECISIONS.md, Punkt F). Deshalb
 * gibt es hier keinen Score, sondern nur PASSED/FAILED/INSUFFICIENT_DATA pro Kriterium.
 */

export type PrescreenRuleStatus = "PASSED" | "FAILED" | "INSUFFICIENT_DATA";

export interface PrescreenRule {
  key: "region" | "objektart" | "preisMax" | "preisProM2Max";
  label: string;
  status: PrescreenRuleStatus;
  evidence: string;
}

export type PrescreenStatus = "PASSED" | "REJECTED" | "INSUFFICIENT_DATA";

export interface PrescreenResult {
  status: PrescreenStatus;
  rules: PrescreenRule[];
}

export interface PrescreenableListing {
  canton: string | null;
  object_type: string | null;
  asking_price_chf: number | null;
  parcel_area_m2: number | null;
}

function checkRegion(listing: PrescreenableListing, profile: SearchProfile): PrescreenRule {
  if (!listing.canton) {
    return { key: "region", label: "Region", status: "INSUFFICIENT_DATA", evidence: "Kanton nicht extrahiert." };
  }
  const ok = profile.regions.cantons.includes(listing.canton);
  return {
    key: "region",
    label: "Region",
    status: ok ? "PASSED" : "FAILED",
    evidence: ok
      ? `Kanton ${listing.canton} im Suchprofil aktiviert.`
      : `Kanton ${listing.canton} nicht im Suchprofil (${profile.regions.cantons.join(", ") || "keine Region aktiviert"}).`,
  };
}

function checkObjektart(listing: PrescreenableListing, profile: SearchProfile): PrescreenRule {
  if (!listing.object_type) {
    return { key: "objektart", label: "Objektart", status: "INSUFFICIENT_DATA", evidence: "Objektart nicht extrahiert." };
  }
  const enabled =
    listing.object_type === "BAULAND"
      ? profile.objektart.baulandEnabled
      : listing.object_type === "ABBRUCHOBJEKT"
        ? profile.objektart.abbruchobjektEnabled
        : undefined;
  if (enabled === undefined) {
    return {
      key: "objektart",
      label: "Objektart",
      status: "INSUFFICIENT_DATA",
      evidence: `Unbekannte Objektart „${listing.object_type}".`,
    };
  }
  return {
    key: "objektart",
    label: "Objektart",
    status: enabled ? "PASSED" : "FAILED",
    evidence: `${objectTypeLabel(listing.object_type)} im Suchprofil ${enabled ? "aktiviert" : "deaktiviert"}.`,
  };
}

function checkPreisMax(listing: PrescreenableListing, profile: SearchProfile): PrescreenRule {
  if (listing.asking_price_chf == null) {
    return { key: "preisMax", label: "Preis-Obergrenze", status: "INSUFFICIENT_DATA", evidence: "Preis nicht extrahiert." };
  }
  const ok = listing.asking_price_chf <= profile.budget.maxLandPriceChf;
  return {
    key: "preisMax",
    label: "Preis-Obergrenze",
    status: ok ? "PASSED" : "FAILED",
    evidence: `CHF ${formatChf(listing.asking_price_chf)} ${ok ? "unter" : "über"} dem maximalen Grundstückspreis (CHF ${formatChf(profile.budget.maxLandPriceChf)}).`,
  };
}

function checkPreisProM2Max(listing: PrescreenableListing, profile: SearchProfile): PrescreenRule {
  if (listing.asking_price_chf == null || !listing.parcel_area_m2 || profile.grundstueck.maxPricePerM2Chf === undefined) {
    return {
      key: "preisProM2Max",
      label: "Preis/m²-Obergrenze",
      status: "INSUFFICIENT_DATA",
      evidence: "Preis und/oder Fläche nicht extrahiert, oder kein Preis/m²-Limit im Suchprofil gesetzt.",
    };
  }
  const pricePerM2 = listing.asking_price_chf / listing.parcel_area_m2;
  const ok = pricePerM2 <= profile.grundstueck.maxPricePerM2Chf;
  return {
    key: "preisProM2Max",
    label: "Preis/m²-Obergrenze",
    status: ok ? "PASSED" : "FAILED",
    evidence: `CHF ${formatChf(Math.round(pricePerM2))}/m² ${ok ? "unter" : "über"} dem maximalen Preis/m² (CHF ${formatChf(profile.grundstueck.maxPricePerM2Chf)}/m²).`,
  };
}

export function prescreenListing(listing: PrescreenableListing, profile: SearchProfile): PrescreenResult {
  const rules = [checkRegion(listing, profile), checkObjektart(listing, profile), checkPreisMax(listing, profile), checkPreisProM2Max(listing, profile)];

  const status: PrescreenStatus = rules.some((r) => r.status === "FAILED")
    ? "REJECTED"
    : rules.some((r) => r.status === "INSUFFICIENT_DATA")
      ? "INSUFFICIENT_DATA"
      : "PASSED";

  return { status, rules };
}
