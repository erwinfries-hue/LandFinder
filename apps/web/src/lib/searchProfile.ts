import type { SearchProfile } from "@landfinder/domain";
import regionsConfig from "../../../../config/regions.json";
import { createRemoteSyncedStore } from "./remoteStore";
import { createSupabaseServerClient } from "./supabaseServer";

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
    // War inkonsistent (15 Mio.): bei 3 Mio. Eigenkapital und 70% Fremdfinanzierung
    // sind max. 3'000'000 / 0.3 = 10 Mio. Projektvolumen finanzierbar.
    maxTotalProjectVolumeChf: 10_000_000,
    liquidityReserveChf: 200_000,
    debtRatioTargetPercent: 70,
    projectDurationMonths: 30,
    negativeRampUpAllowed: true,
  },
  objektart: {
    baulandEnabled: true,
    abbruchobjektEnabled: true,
    baurecht: "MANUAL_REVIEW",
  },
  grundstueck: {
    minAreaM2: 800,
    maxAreaM2: 5000,
    // Baden liegt laut data/wuest/ bereits beim Median (50%) bei 2'500 CHF/m²
    // (hohe Ausnützung); ein Deckel auf diesem Niveau würde teurere ZG/ZH-Lagen
    // systematisch ausschliessen.
    maxPricePerM2Chf: 3500,
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
    enabled: true,
    // Vorschlagswerte, leicht überschreibbar: eine Einheit (der Eigentümer bezieht
    // typischerweise nicht mehrere Wohnungen selbst), ~120 m² als komfortable
    // Familiengrösse konsistent mit den 20%-Flächen-/Kapitalanteil-Deckeln unten,
    // 4.5 Zimmer als zu dieser Grösse passender Zuschnitt, Attikageschoss als
    // verbreitete Eigennutzer-Präferenz (Aussicht, Privatsphäre, kein Publikumsverkehr).
    unitCount: 1,
    targetSizeM2: 120,
    roomCount: 4.5,
    positionInBuilding: "Attikageschoss",
    imputedMarketRentChfPerM2Month: 25,
    maxAreaSharePercent: 20,
    maxCapitalSharePercent: 20,
  },
  marktannahmen: {
    netRentChfPerM2Month: 22,
    parkingRentChfPerMonth: 120,
    // 3% war zu pessimistisch — Baden 0.8%, Wohlen 1.8%, Kanton AG 1.4% laut
    // data/wuest/. 2% behält trotzdem eine Sicherheitsmarge über den realen Werten.
    vacancyRatePercent: 2,
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
    // 4.2% liess bei Exit-Cap 3.2% nur 100 Basispunkte Entwicklungsspanne — knapp
    // für Bau-/Kostenrisiko. 4.5% gibt mehr Puffer.
    minYieldOnCostPercent: 4.5,
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

/**
 * Store über `localStorage` + Supabase (via `/api/state/search-profile`), angebunden
 * via `useSyncExternalStore` (siehe `SuchprofilWizard.tsx`) — nicht über
 * `useEffect`+`setState`, weil das beim initialen Laden zu Hydration-Mismatches
 * führen kann (Server kennt kein `localStorage`) und vom React-Compiler-Lint als
 * Anti-Pattern markiert wird. Details zum Server-Abgleich: `lib/remoteStore.ts`.
 */
const store = createRemoteSyncedStore<SearchProfile>({
  storageKey: "landfinder.searchProfile.v1",
  apiId: "search-profile",
  defaultValue: DEFAULT_SEARCH_PROFILE,
  merge: (partial) => ({ ...DEFAULT_SEARCH_PROFILE, ...(partial as Partial<SearchProfile>) }),
});

export const getSearchProfileSnapshot = store.getSnapshot;
export const getSearchProfileServerSnapshot = store.getServerSnapshot;
export const subscribeSearchProfile = store.subscribe;
export const setSearchProfile = store.setValue;

/**
 * Liest das echte, persistierte Suchprofil direkt aus Supabase — für Server Components
 * (z.B. die Quellen-Vorprüfung), die zum Zeitpunkt des Renderns den tatsächlich
 * gespeicherten Stand brauchen, nicht nur `DEFAULT_SEARCH_PROFILE`. Fällt auf den
 * Default zurück, wenn Supabase nicht konfiguriert ist oder noch kein Profil
 * gespeichert wurde (identische Merge-Logik wie der Client-Store oben).
 */
export async function getPersistedSearchProfile(): Promise<SearchProfile> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return DEFAULT_SEARCH_PROFILE;
  const { data, error } = await supabase.from("app_state").select("data").eq("id", "search-profile").maybeSingle();
  if (error || !data?.data) return DEFAULT_SEARCH_PROFILE;
  return { ...DEFAULT_SEARCH_PROFILE, ...(data.data as Partial<SearchProfile>) };
}
