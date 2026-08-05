import { describe, it, expect } from "vitest";
import { deriveEmpfehlung, type EmpfehlungAlertContext } from "./empfehlung";
import type { HardGateResult } from "@landfinder/domain";

const passed: HardGateResult = { status: "PASSED" };
const rejected: HardGateResult = { status: "REJECTED_BY_RULE", reason: "PRICE_ABOVE_MAXIMUM", evidence: "..." };

const alerts: EmpfehlungAlertContext = {
  thresholdA: 75,
  thresholdB: 55,
  minDataConfidence: 40,
  potentialAEnabled: true,
};

describe("deriveEmpfehlung (Abschnitt 18)", () => {
  it("NICHT_WEITERVERFOLGEN bei Hard-Gate-Ablehnung, unabhängig vom Score", () => {
    expect(deriveEmpfehlung(rejected, 95, 90, alerts)).toBe("NICHT_WEITERVERFOLGEN");
  });

  it("UNGENUEGENDE_DATEN, wenn das Datenvertrauen unter dem Suchprofil-Minimum liegt", () => {
    expect(deriveEmpfehlung(passed, 90, 30, alerts)).toBe("UNGENUEGENDE_DATEN");
  });

  it("SOFORT_PRUEFEN ab Schwelle A mit ausreichendem Vertrauen", () => {
    expect(deriveEmpfehlung(passed, 80, 85, alerts)).toBe("SOFORT_PRUEFEN");
  });

  it("POTENZIAL_DRINGEND_VERIFIZIEREN ab Schwelle A mit unzureichendem, aber ausreichendem Vertrauen für Analyse", () => {
    expect(deriveEmpfehlung(passed, 80, 60, alerts)).toBe("POTENZIAL_DRINGEND_VERIFIZIEREN");
  });

  it("SOFORT_PRUEFEN statt POTENZIAL_DRINGEND_VERIFIZIEREN, wenn potentialAEnabled = false", () => {
    expect(deriveEmpfehlung(passed, 80, 60, { ...alerts, potentialAEnabled: false })).toBe("SOFORT_PRUEFEN");
  });

  it("WEITERVERFOLGEN zwischen Schwelle B und A", () => {
    expect(deriveEmpfehlung(passed, 65, 85, alerts)).toBe("WEITERVERFOLGEN");
  });

  it("BEOBACHTEN_VERHANDELN innerhalb der Bandbreite unter Schwelle B", () => {
    expect(deriveEmpfehlung(passed, 45, 85, alerts)).toBe("BEOBACHTEN_VERHANDELN"); // 55 - 15 = 40 <= 45 < 55
  });

  it("NICHT_WEITERVERFOLGEN unterhalb der Beobachten-Bandbreite", () => {
    expect(deriveEmpfehlung(passed, 30, 85, alerts)).toBe("NICHT_WEITERVERFOLGEN");
  });
});
