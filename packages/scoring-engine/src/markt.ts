import { SCORE_WEIGHTS, SCORE_BANDS, defaultsOf, type ScoreWeightValues, type ScoreBandValues } from "./parameters";
import { linearBandScore } from "./scoreHelpers";

export interface MarktScoreInput {
  vacancyRatePercent: number;
  populationGrowth3yPercent: number;
  /** Lokale Median-Miete ÷ kantonale Referenz-Median-Miete (aus Wüest-Daten, `data/wuest/`). */
  rentLevelRatio: number;
  /** Neu erstellte Wohnungen pro Jahr ÷ Wohnungsbestand, in %. */
  constructionActivityRatePercent: number;
}

export interface MarktScoreResult {
  total: number;
  leerstand: number;
  bevoelkerungHaushalte: number;
  mietniveau: number;
  bautaetigkeit: number;
}

/** Markt-Score, max. 15 Punkte (Abschnitt 15). */
export function scoreMarkt(
  input: MarktScoreInput,
  weights: ScoreWeightValues = defaultsOf(SCORE_WEIGHTS),
  bands: ScoreBandValues = defaultsOf(SCORE_BANDS),
): MarktScoreResult {
  const leerstand = linearBandScore(input.vacancyRatePercent, bands.vacancyFloorPct, bands.vacancyCeilingPct, weights.leerstand);
  const bevoelkerungHaushalte = linearBandScore(
    input.populationGrowth3yPercent,
    bands.populationGrowthFloorPct,
    bands.populationGrowthCeilingPct,
    weights.bevoelkerungHaushalte,
  );
  const mietniveau = linearBandScore(input.rentLevelRatio, bands.mietniveauFloorRatio, bands.mietniveauCeilingRatio, weights.mietniveau);
  const bautaetigkeit = linearBandScore(
    input.constructionActivityRatePercent,
    bands.bautaetigkeitFloorPct,
    bands.bautaetigkeitCeilingPct,
    weights.bautaetigkeit,
  );

  return { total: leerstand + bevoelkerungHaushalte + mietniveau + bautaetigkeit, leerstand, bevoelkerungHaushalte, mietniveau, bautaetigkeit };
}
