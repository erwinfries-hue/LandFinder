import { calculateValueAddRoi, type ValueAddRoiResult } from "./bestandsrenditeValueAdd";

/**
 * "Furnished Rental / Rental Strategy Engine" (SIPIS-Modul v1.1, vom Auftraggeber als
 * vollständige Fachspezifikation geliefert) — granularer Kostenmotor für möblierte
 * Vermietung, gemeinsam genutzt von allen drei möblierten Dauer-Varianten (Langzeit/
 * Mittelzeit/Kurzzeit, siehe `Vermietungsmodell` in bestandsrendite.ts). Löst die bisher
 * pauschalen Felder `reinigungServiceMoebliertChfPerYear`/`nebenkostenMoebliertChfPerYear`/
 * `reparatur.jaehrlichMoebliertChf` vollständig ab (kein Doppelzählungsrisiko).
 *
 * Bewusst als eigenes Modul (gleiche Konvention wie bestandsrenditeValueAdd.ts) statt
 * Teil des Kern-Moduls — reine Möblierungs-Ökonomie, unabhängig von Hypothek/Steuer/
 * Cashflow-Wasserfall.
 */

export interface MoebliertBetriebskostenInput {
  internetChfPerMonth: number;
  kabelTvChfPerMonth: number;
  streamingChfPerMonth: number;
  /** "included electricity" — vom Vermieter getragener Stromanteil bei möblierter Vermietung. */
  stromChfPerMonth: number;
  abfallChfPerMonth: number;
  mieterwechselProJahr: number;
  reinigungProWechselChf: number;
  waescheProWechselChf: number;
  inseratProWechselChf: number;
  verbrauchsmaterialChfPerMonth: number;
  kleinreparaturenChfPerMonth: number;
  hausratversicherungChfPerMonth: number;
  schadenreserveChfPerMonth: number;
  /** % vom effektiven Jahresertrag der möblierten Vermietung (Verwaltungsgebühr). */
  verwaltungsgebuehrPercent: number;
  /** % vom effektiven Jahresertrag der möblierten Vermietung (Buchungsplattform-Gebühr, z.B. Airbnb/Booking). */
  plattformgebuehrPercent: number;
}

export interface FurnishedOpexBreakdown {
  internetChfPerYear: number;
  kabelTvChfPerYear: number;
  streamingChfPerYear: number;
  stromChfPerYear: number;
  abfallChfPerYear: number;
  reinigungChfPerYear: number;
  waescheChfPerYear: number;
  inseratChfPerYear: number;
  verbrauchsmaterialChfPerYear: number;
  kleinreparaturenChfPerYear: number;
  hausratversicherungChfPerYear: number;
  schadenreserveChfPerYear: number;
  verwaltungsgebuehrChfPerYear: number;
  plattformgebuehrChfPerYear: number;
  totalChfPerYear: number;
}

/**
 * Granulare möblierte Betriebskosten für EIN Jahr — direkte Umsetzung der Spec-Formeln
 * (cleaning/laundry/listing_cost_annual = proWechsel × Mieterwechsel/Jahr, Monatsfelder ×12,
 * Gebühren = Percent × effektiver Jahresertrag der möblierten Vermietung).
 */
export function calculateFurnishedOpex(input: MoebliertBetriebskostenInput, effektiverJahresertragMoebliertChf: number): FurnishedOpexBreakdown {
  const internetChfPerYear = input.internetChfPerMonth * 12;
  const kabelTvChfPerYear = input.kabelTvChfPerMonth * 12;
  const streamingChfPerYear = input.streamingChfPerMonth * 12;
  const stromChfPerYear = input.stromChfPerMonth * 12;
  const abfallChfPerYear = input.abfallChfPerMonth * 12;
  const verbrauchsmaterialChfPerYear = input.verbrauchsmaterialChfPerMonth * 12;
  const kleinreparaturenChfPerYear = input.kleinreparaturenChfPerMonth * 12;
  const hausratversicherungChfPerYear = input.hausratversicherungChfPerMonth * 12;
  const schadenreserveChfPerYear = input.schadenreserveChfPerMonth * 12;
  const reinigungChfPerYear = input.reinigungProWechselChf * input.mieterwechselProJahr;
  const waescheChfPerYear = input.waescheProWechselChf * input.mieterwechselProJahr;
  const inseratChfPerYear = input.inseratProWechselChf * input.mieterwechselProJahr;
  const verwaltungsgebuehrChfPerYear = effektiverJahresertragMoebliertChf * (input.verwaltungsgebuehrPercent / 100);
  const plattformgebuehrChfPerYear = effektiverJahresertragMoebliertChf * (input.plattformgebuehrPercent / 100);

  const totalChfPerYear =
    internetChfPerYear +
    kabelTvChfPerYear +
    streamingChfPerYear +
    stromChfPerYear +
    abfallChfPerYear +
    reinigungChfPerYear +
    waescheChfPerYear +
    inseratChfPerYear +
    verbrauchsmaterialChfPerYear +
    kleinreparaturenChfPerYear +
    hausratversicherungChfPerYear +
    schadenreserveChfPerYear +
    verwaltungsgebuehrChfPerYear +
    plattformgebuehrChfPerYear;

  return {
    internetChfPerYear,
    kabelTvChfPerYear,
    streamingChfPerYear,
    stromChfPerYear,
    abfallChfPerYear,
    reinigungChfPerYear,
    waescheChfPerYear,
    inseratChfPerYear,
    verbrauchsmaterialChfPerYear,
    kleinreparaturenChfPerYear,
    hausratversicherungChfPerYear,
    schadenreserveChfPerYear,
    verwaltungsgebuehrChfPerYear,
    plattformgebuehrChfPerYear,
    totalChfPerYear,
  };
}

export interface FurnishingRoiInput {
  /** furniture_initial_cost + household_inventory_initial_cost (+ ggf. weitere Erst-Möblierungskosten). */
  incrementalFurnishingInvestmentChf: number;
  /** furnished_NOI − unfurnished_NOI, bereits netto der gesamten möblierungsbedingten Zusatzkosten. */
  incrementalNoiChf: number;
}

/**
 * "Furniture ROI" NETTO auf Basis des inkrementellen NOI (Spec: `furnishing_ROI =
 * incremental_NOI / incremental_furnishing_investment`) — anders als eine rein
 * bruttomietbasierte ROI-Kennzahl bereits um alle möblierungsspezifischen Zusatzkosten
 * bereinigt (Guardrail: "assume furnished rental is superior solely because gross rent
 * is higher" darf nicht passieren).
 */
export function calculateFurnishingRoi(input: FurnishingRoiInput): ValueAddRoiResult {
  return calculateValueAddRoi(input.incrementalFurnishingInvestmentChf, input.incrementalNoiChf);
}

export interface FurnishedRentalDeltaInput {
  /** Möblierungsbedingte Zusatzkosten ggü. unmöbliert, CHF/Jahr (bei unmöbliert ohne jegliche möblierte Zusatzkosten = FurnishedOpexBreakdown.totalChfPerYear der möblierten Variante). */
  incrementalOpexChfPerYear: number;
  /** Zusätzlicher Mietausfall ggü. unmöbliert durch die (typischerweise höhere) Leerstandsquote der möblierten Vermietung, CHF/Jahr. */
  incrementalVacancyLossChfPerYear: number;
  incrementalFurnishingInvestmentChf: number;
  minimumRequiredFurnitureRoiPercent: number;
  /** furnished_gross_potential_rent − unfurnished_gross_potential_rent (Sollmiete-Differenz, ohne Leerstandsabzug). */
  additionalGrossRentalIncomeChfPerYear: number;
  incrementalNoiChf: number;
}

export interface FurnishedRentalDeltaResult {
  breakEvenFurnishingPremiumChfPerYear: number;
  breakEvenFurnishingPremiumChfPerMonth: number;
  requiredFurnitureReturnChfPerYear: number;
  minimumEconomicFurnishingPremiumChfPerYear: number;
  /** = incremental_NOI ÷ additional_gross_rental_income — `undefined`, wenn kein zusätzlicher Bruttoertrag entsteht (Division durch 0/negativ nicht aussagekräftig). */
  furnishingEfficiencyRatio: number | undefined;
}

/**
 * Break-even-/Mindestrendite-Kennzahlen der Spec: der Mietaufschlag, der MINDESTENS
 * nötig ist, um die möblierungsbedingten Mehrkosten zu decken (`break_even_...`), bzw.
 * zusätzlich noch die geforderte Mindestrendite auf die Möblierungsinvestition zu
 * erwirtschaften (`minimum_economic_...`).
 */
export function calculateFurnishedRentalDelta(input: FurnishedRentalDeltaInput): FurnishedRentalDeltaResult {
  const breakEvenFurnishingPremiumChfPerYear = input.incrementalOpexChfPerYear + input.incrementalVacancyLossChfPerYear;
  const requiredFurnitureReturnChfPerYear = input.incrementalFurnishingInvestmentChf * (input.minimumRequiredFurnitureRoiPercent / 100);
  const minimumEconomicFurnishingPremiumChfPerYear = breakEvenFurnishingPremiumChfPerYear + requiredFurnitureReturnChfPerYear;
  const furnishingEfficiencyRatio = input.additionalGrossRentalIncomeChfPerYear > 0 ? input.incrementalNoiChf / input.additionalGrossRentalIncomeChfPerYear : undefined;

  return {
    breakEvenFurnishingPremiumChfPerYear,
    breakEvenFurnishingPremiumChfPerMonth: breakEvenFurnishingPremiumChfPerYear / 12,
    requiredFurnitureReturnChfPerYear,
    minimumEconomicFurnishingPremiumChfPerYear,
    furnishingEfficiencyRatio,
  };
}
