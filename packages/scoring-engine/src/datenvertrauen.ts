import type { DataPoint, ConfidenceBreakdown } from "@landfinder/domain";
import { CONFIDENCE_WEIGHTS, defaultsOf, type ConfidenceWeightValues } from "./parameters";

export interface ConfidenceInput {
  adresseParzelle: DataPoint<unknown>[];
  zoneBauparameter: DataPoint<unknown>[];
  risikenOereb: DataPoint<unknown>[];
  mietdaten: DataPoint<unknown>[];
  baukosten: DataPoint<unknown>[];
  inseratsvollstaendigkeit: DataPoint<unknown>[];
  finanzierung: DataPoint<unknown>[];
}

/** Ohne Datenpunkte in einer Kategorie gibt es 0 Punkte — kein Vertrauen ohne Beleg. */
function categoryScore(points: DataPoint<unknown>[], maxWeight: number): number {
  if (points.length === 0) return 0;
  const avgConfidence = points.reduce((sum, p) => sum + p.confidence, 0) / points.length;
  return maxWeight * (avgConfidence / 100);
}

/**
 * Datenvertrauen, Gesamt 100 (Abschnitt 16). Jede Kategorie ist der gewichtete
 * Durchschnitt der `confidence`-Werte (0–100) der zugeordneten `DataPoint`s —
 * mechanisch aus der Provenienz abgeleitet, keine zusätzliche Modellannahme nötig.
 */
export function calculateConfidence(
  input: ConfidenceInput,
  weights: ConfidenceWeightValues = defaultsOf(CONFIDENCE_WEIGHTS),
): ConfidenceBreakdown {
  const adresseParzelle = categoryScore(input.adresseParzelle, weights.adresseParzelle);
  const zoneBauparameter = categoryScore(input.zoneBauparameter, weights.zoneBauparameter);
  const risikenOereb = categoryScore(input.risikenOereb, weights.risikenOereb);
  const mietdaten = categoryScore(input.mietdaten, weights.mietdaten);
  const baukosten = categoryScore(input.baukosten, weights.baukosten);
  const inseratsvollstaendigkeit = categoryScore(input.inseratsvollstaendigkeit, weights.inseratsvollstaendigkeit);
  const finanzierung = categoryScore(input.finanzierung, weights.finanzierung);

  return {
    total: adresseParzelle + zoneBauparameter + risikenOereb + mietdaten + baukosten + inseratsvollstaendigkeit + finanzierung,
    adresseParzelle,
    zoneBauparameter,
    risikenOereb,
    mietdaten,
    baukosten,
    inseratsvollstaendigkeit,
    finanzierung,
  };
}
