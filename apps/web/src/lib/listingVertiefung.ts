import type { Objektart, OevGueteklasse, VerificationLevel } from "@landfinder/domain";
import type { RisikoFlags } from "@landfinder/scoring-engine";
import type { BaupotenzialInput } from "@landfinder/financial-engine";

/**
 * Manuell erfasste Vertiefungsdaten zu einem echten Inserat (`listings.vertiefung`,
 * Migration 0007) — das Gegenstück zu `extraction` (automatische Stufe-2-Extraktion):
 * alles hier kann nie automatisch aus einer Suchabo-Mail oder Portalseite kommen,
 * sondern muss der Nutzer nachtragen, bevor ein echter Score berechenbar ist. Übersetzt
 * `CHAM_FACTS`/`UNVERIFIED_MARKET_ASSUMPTIONS` (`apps/web/src/lib/objektAnalysis.ts`)
 * in ein wiederverwendbares Shape für beliebige Inserate statt nur Cham.
 */

export type BaupotenzialFacts =
  | { method: "DENSITY_RATIO"; densityRatio: number }
  | { method: "VOLUME_RATIO"; volumeRatio: number }
  | { method: "COVERAGE_RATIO"; siteCoverageRatio: number; effectiveFloors: number };

/**
 * Weiche Risikofaktoren, die den Score reduzieren, auch wenn die zugehörigen Hard
 * Gates (`erschliessungOk`/`zufahrtOk` unten) bereits bestanden sind — z.B. "Zufahrt
 * technisch gesichert, aber nur über ein gemeinsames Erschliessungsrecht, ÖREB
 * ausstehend" ist ein Hard-Gate-Pass mit trotzdem erhöhtem Risiko. 1:1 die Flags aus
 * `@landfinder/scoring-engine`.
 */
export type ListingRisiken = RisikoFlags;

/**
 * Markt-/Lage-Annahmen, für die es nie eine "richtige" Zahl ohne Wüest-/Gemeindedaten
 * gibt — anders als z.B. die Zone (die per ÖREB/Bauamt amtlich feststellbar ist).
 * Bleiben deshalb einzeln überschreibbar statt Pflichtfelder; fehlt eine, wird der
 * neutrale Default verwendet und in `assumptionNotes` offen als ungeprüfte Schätzung
 * gekennzeichnet (siehe `resolveMarketAssumptions`).
 */
export interface ListingMarktAnnahmen {
  localVacancyRatePercent?: number;
  populationGrowth3yPercent?: number;
  rentLevelRatio?: number;
  constructionActivityRatePercent?: number;
  zielmieterFitRatio?: number;
  /** Innert 30 Min. erreichbare Einwohner — hat keinen sinnvollen generischen Default. */
  reachableResidents30min?: number;
}

export interface ListingVertiefungFacts {
  baupotenzial: BaupotenzialFacts;
  zoneLabel: string;
  zoneVerification: VerificationLevel;
  overallVerification: VerificationLevel;
  oevGueteklasse: OevGueteklasse;
  erschliessungOk: boolean;
  zufahrtOk: boolean;
  risiken: ListingRisiken;
  /**
   * Pflicht statt optional: der Hard Gate "Standort identifizierbar"
   * (`LOCATION_NOT_IDENTIFIABLE`, `@landfinder/scoring-engine`) greift sonst bei jedem
   * Inserat ohne BFS-Gemeindenummer — Koordinaten lassen sich in Sekunden per
   * Rechtsklick auf Google Maps ablesen, ein fehlender Wert wäre keine echte Lücke.
   */
  coordinates: { lat: number; lon: number };
  /** Amtlicher Parzellennachweis, z.B. von map.geo.admin.ch — hebt die Konfidenz deutlich, aber nicht zwingend vorhanden. */
  egrid?: string;
  /** Nur für Abbruchobjekte: Basis für Abbruchkosten (profile.baukosten.demolitionCostChfPerM2 × Fläche). */
  existingBuildingAreaM2?: number;
  marktAnnahmen?: ListingMarktAnnahmen;
  /** Freier Text, z.B. Quelle/Datum der Zonenangabe oder ÖREB-Status — rein dokumentarisch, fliesst nicht in die Berechnung. */
  notes?: string;
}

/** Minimale, aus dem Inserat selbst stammende Eingaben für die Engine. */
export interface ListingAnalysisInput {
  canton: string;
  objectType: Objektart;
  askingPriceChf: number;
  parcelAreaM2: number;
}

/**
 * Neutrale Defaults für die Markt-/Lage-Annahmen ohne Wüest-/Gemeindedaten — dieselben
 * Werte, die bisher nur für Cham als `UNVERIFIED_MARKET_ASSUMPTIONS` galten
 * ("Neutral (Parität)", "Neutral (Bandmitte)"), jetzt als generischer Startpunkt.
 * `reachableResidents30min` hat bewusst KEINEN Default hier (0 statt einer geratenen
 * Zahl) — das war bei Cham eine Zug-spezifische Schätzung (250'000), die für ein
 * Inserat in einem anderen Kanton falsch wäre.
 */
export const NEUTRAL_MARKET_DEFAULTS: Required<Omit<ListingMarktAnnahmen, "localVacancyRatePercent" | "reachableResidents30min">> = {
  populationGrowth3yPercent: 0,
  rentLevelRatio: 1.0,
  constructionActivityRatePercent: 1.75,
  zielmieterFitRatio: 0.5,
};

export interface ResolvedMarketAssumptions {
  localVacancyRatePercent: number;
  populationGrowth3yPercent: number;
  rentLevelRatio: number;
  constructionActivityRatePercent: number;
  zielmieterFitRatio: number;
  reachableResidents30min: number;
  assumptionNotes: string[];
}

/**
 * Löst die optionalen Markt-/Lage-Annahmen auf: manuell erfasster Wert, sonst
 * neutraler Default (bzw. bei `localVacancyRatePercent` der generische
 * Suchprofil-Zielwert statt eine erfundene lokale Zahl) — und dokumentiert jede
 * Lücke transparent statt sie stillschweigend zu füllen.
 */
export function resolveMarketAssumptions(
  facts: ListingMarktAnnahmen | undefined,
  profileVacancyRatePercent: number,
): ResolvedMarketAssumptions {
  const notes: string[] = [];

  const localVacancyRatePercent = facts?.localVacancyRatePercent;
  if (localVacancyRatePercent === undefined) {
    notes.push(
      `Kein lokaler Leerstand erfasst — Suchprofil-Zielwert (${profileVacancyRatePercent}%) als ungeprüfte Schätzung übernommen.`,
    );
  }

  const reachableResidents30min = facts?.reachableResidents30min;
  if (reachableResidents30min === undefined) {
    notes.push("Erreichbare Bevölkerung (30 Min.) nicht erfasst — Lage-Teilscore dafür auf Minimum statt auf eine geratene Zahl gesetzt.");
  }

  for (const [key, label] of [
    ["populationGrowth3yPercent", "Bevölkerungswachstum"],
    ["rentLevelRatio", "Mietniveau-Verhältnis"],
    ["constructionActivityRatePercent", "Bautätigkeit"],
    ["zielmieterFitRatio", "Zielmieter-Fit"],
  ] as const) {
    if (facts?.[key] === undefined) {
      notes.push(`${label} nicht erfasst — neutraler Default (${NEUTRAL_MARKET_DEFAULTS[key]}) angenommen, keine Wüest-/Gemeindedaten.`);
    }
  }

  return {
    localVacancyRatePercent: localVacancyRatePercent ?? profileVacancyRatePercent,
    populationGrowth3yPercent: facts?.populationGrowth3yPercent ?? NEUTRAL_MARKET_DEFAULTS.populationGrowth3yPercent,
    rentLevelRatio: facts?.rentLevelRatio ?? NEUTRAL_MARKET_DEFAULTS.rentLevelRatio,
    constructionActivityRatePercent: facts?.constructionActivityRatePercent ?? NEUTRAL_MARKET_DEFAULTS.constructionActivityRatePercent,
    zielmieterFitRatio: facts?.zielmieterFitRatio ?? NEUTRAL_MARKET_DEFAULTS.zielmieterFitRatio,
    reachableResidents30min: reachableResidents30min ?? 0,
    assumptionNotes: notes,
  };
}

/** Übersetzt die diskriminierte Vertiefungs-Eingabe in das flache Shape, das `estimateBaupotenzial` (financial-engine) erwartet. */
export function toBaupotenzialInputFields(
  facts: BaupotenzialFacts,
): Pick<BaupotenzialInput, "method" | "densityRatio" | "volumeRatio" | "siteCoverageRatio" | "effectiveFloors"> {
  switch (facts.method) {
    case "DENSITY_RATIO":
      return { method: "DENSITY_RATIO", densityRatio: facts.densityRatio };
    case "VOLUME_RATIO":
      return { method: "VOLUME_RATIO", volumeRatio: facts.volumeRatio };
    case "COVERAGE_RATIO":
      return { method: "COVERAGE_RATIO", siteCoverageRatio: facts.siteCoverageRatio, effectiveFloors: facts.effectiveFloors };
  }
}

const VERIFICATION_LEVELS = new Set(["A", "B", "C"]);
const OEV_LEVELS = new Set(["A", "B", "C", "D"]);

/**
 * Manuelle Validierung statt einer Schema-Bibliothek (keine im Projekt vorhanden) —
 * prüft nur, was die Engine zwingend braucht, um nicht abzustürzen; fehlende optionale
 * Markt-Annahmen sind erlaubt (siehe `resolveMarketAssumptions`).
 */
export function parseListingVertiefungFacts(input: unknown): { facts: ListingVertiefungFacts } | { error: string } {
  if (typeof input !== "object" || input === null) return { error: "Kein Objekt" };
  const body = input as Record<string, unknown>;

  const baupotenzial = body.baupotenzial as Record<string, unknown> | undefined;
  if (!baupotenzial || typeof baupotenzial.method !== "string") return { error: "baupotenzial.method fehlt" };
  let baupotenzialFacts: BaupotenzialFacts;
  if (baupotenzial.method === "DENSITY_RATIO") {
    if (typeof baupotenzial.densityRatio !== "number") return { error: "baupotenzial.densityRatio fehlt" };
    baupotenzialFacts = { method: "DENSITY_RATIO", densityRatio: baupotenzial.densityRatio };
  } else if (baupotenzial.method === "VOLUME_RATIO") {
    if (typeof baupotenzial.volumeRatio !== "number") return { error: "baupotenzial.volumeRatio fehlt" };
    baupotenzialFacts = { method: "VOLUME_RATIO", volumeRatio: baupotenzial.volumeRatio };
  } else if (baupotenzial.method === "COVERAGE_RATIO") {
    if (typeof baupotenzial.siteCoverageRatio !== "number" || typeof baupotenzial.effectiveFloors !== "number") {
      return { error: "baupotenzial.siteCoverageRatio/effectiveFloors fehlt" };
    }
    baupotenzialFacts = {
      method: "COVERAGE_RATIO",
      siteCoverageRatio: baupotenzial.siteCoverageRatio,
      effectiveFloors: baupotenzial.effectiveFloors,
    };
  } else {
    return { error: `Unbekannte baupotenzial.method: ${baupotenzial.method}` };
  }

  if (typeof body.zoneLabel !== "string" || !body.zoneLabel) return { error: "zoneLabel fehlt" };
  if (typeof body.zoneVerification !== "string" || !VERIFICATION_LEVELS.has(body.zoneVerification)) {
    return { error: "zoneVerification muss A/B/C sein" };
  }
  if (typeof body.overallVerification !== "string" || !VERIFICATION_LEVELS.has(body.overallVerification)) {
    return { error: "overallVerification muss A/B/C sein" };
  }
  if (typeof body.oevGueteklasse !== "string" || !OEV_LEVELS.has(body.oevGueteklasse)) {
    return { error: "oevGueteklasse muss A/B/C/D sein" };
  }
  if (typeof body.erschliessungOk !== "boolean") return { error: "erschliessungOk fehlt" };
  if (typeof body.zufahrtOk !== "boolean") return { error: "zufahrtOk fehlt" };

  const risiken = body.risiken as Record<string, unknown> | undefined;
  if (!risiken) return { error: "risiken fehlt" };
  for (const key of ["altlasten", "naturgefahren", "gewaesser", "laerm", "planungszone", "zufahrt", "erschliessung", "baukostenrisiken"] as const) {
    if (typeof risiken[key] !== "boolean") return { error: `risiken.${key} fehlt` };
  }

  const coordinates = body.coordinates && typeof body.coordinates === "object" ? (body.coordinates as { lat?: unknown; lon?: unknown }) : undefined;
  if (!coordinates || typeof coordinates.lat !== "number" || typeof coordinates.lon !== "number") {
    return { error: "coordinates.lat/lon fehlt" };
  }

  return {
    facts: {
      baupotenzial: baupotenzialFacts,
      zoneLabel: body.zoneLabel,
      zoneVerification: body.zoneVerification as VerificationLevel,
      overallVerification: body.overallVerification as VerificationLevel,
      oevGueteklasse: body.oevGueteklasse as OevGueteklasse,
      erschliessungOk: body.erschliessungOk,
      zufahrtOk: body.zufahrtOk,
      risiken: risiken as unknown as ListingRisiken,
      coordinates: { lat: coordinates.lat, lon: coordinates.lon },
      egrid: typeof body.egrid === "string" && body.egrid ? body.egrid : undefined,
      existingBuildingAreaM2: typeof body.existingBuildingAreaM2 === "number" ? body.existingBuildingAreaM2 : undefined,
      marktAnnahmen: (body.marktAnnahmen as ListingMarktAnnahmen | undefined) ?? undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
  };
}
