import type { Empfehlung, HardGateResult, SearchProfileAlerts } from "@landfinder/domain";
import { EMPFEHLUNG_PARAMETERS, defaultsOf, type EmpfehlungParameterValues } from "./parameters";

export type EmpfehlungAlertContext = Pick<SearchProfileAlerts, "thresholdA" | "thresholdB" | "minDataConfidence" | "potentialAEnabled">;

/**
 * Leitet die Empfehlung (Abschnitt 18) aus Hard-Gate-Status, Score und Datenvertrauen
 * ab. Die Alert-Schwellen (`thresholdA`/`thresholdB`/`minDataConfidence`) kommen aus
 * dem Suchprofil; die zusätzlich benötigten Bandbreiten sind in
 * `EMPFEHLUNG_PARAMETERS` benannt und editierbar.
 */
export function deriveEmpfehlung(
  hardGate: HardGateResult,
  scoreTotal: number,
  confidenceTotal: number,
  alerts: EmpfehlungAlertContext,
  params: EmpfehlungParameterValues = defaultsOf(EMPFEHLUNG_PARAMETERS),
): Empfehlung {
  if (hardGate.status === "REJECTED_BY_RULE") return "NICHT_WEITERVERFOLGEN";
  if (confidenceTotal < alerts.minDataConfidence) return "UNGENUEGENDE_DATEN";

  if (scoreTotal >= alerts.thresholdA) {
    if (alerts.potentialAEnabled && confidenceTotal < params.potentialAConfidenceFloor) {
      return "POTENZIAL_DRINGEND_VERIFIZIEREN";
    }
    return "SOFORT_PRUEFEN";
  }
  if (scoreTotal >= alerts.thresholdB) return "WEITERVERFOLGEN";
  if (scoreTotal >= alerts.thresholdB - params.beobachtenBandwidth) return "BEOBACHTEN_VERHANDELN";
  return "NICHT_WEITERVERFOLGEN";
}
