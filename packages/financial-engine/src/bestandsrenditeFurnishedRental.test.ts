import { describe, it, expect } from "vitest";
import { calculateFurnishedOpex, calculateFurnishingRoi, calculateFurnishedRentalDelta, type MoebliertBetriebskostenInput } from "./bestandsrenditeFurnishedRental";

// Spec-Defaults aus "SIPIS MODULE — FURNISHED RENTAL / RENTAL STRATEGY ENGINE, v1.1".
const specDefaults: MoebliertBetriebskostenInput = {
  internetChfPerMonth: 65,
  kabelTvChfPerMonth: 0,
  streamingChfPerMonth: 23,
  stromChfPerMonth: 60,
  abfallChfPerMonth: 15,
  mieterwechselProJahr: 3,
  reinigungProWechselChf: 180,
  waescheProWechselChf: 40,
  inseratProWechselChf: 100,
  verbrauchsmaterialChfPerMonth: 15,
  kleinreparaturenChfPerMonth: 30,
  hausratversicherungChfPerMonth: 15,
  schadenreserveChfPerMonth: 20,
  verwaltungsgebuehrPercent: 0,
  plattformgebuehrPercent: 0,
};

describe("calculateFurnishedOpex", () => {
  it("rechnet alle Spec-Formeln mit den Spec-Default-Werten korrekt durch", () => {
    const result = calculateFurnishedOpex(specDefaults, 30_000);

    expect(result.internetChfPerYear).toBe(780); // 65 × 12
    expect(result.kabelTvChfPerYear).toBe(0);
    expect(result.streamingChfPerYear).toBe(276); // 23 × 12
    expect(result.stromChfPerYear).toBe(720); // 60 × 12
    expect(result.abfallChfPerYear).toBe(180); // 15 × 12
    expect(result.reinigungChfPerYear).toBe(540); // 180 × 3 Mieterwechsel
    expect(result.waescheChfPerYear).toBe(120); // 40 × 3
    expect(result.inseratChfPerYear).toBe(300); // 100 × 3
    expect(result.verbrauchsmaterialChfPerYear).toBe(180); // 15 × 12
    expect(result.kleinreparaturenChfPerYear).toBe(360); // 30 × 12
    expect(result.hausratversicherungChfPerYear).toBe(180); // 15 × 12
    expect(result.schadenreserveChfPerYear).toBe(240); // 20 × 12
    expect(result.verwaltungsgebuehrChfPerYear).toBe(0);
    expect(result.plattformgebuehrChfPerYear).toBe(0);

    const erwartetesTotal = 780 + 0 + 276 + 720 + 180 + 540 + 120 + 300 + 180 + 360 + 180 + 240;
    expect(result.totalChfPerYear).toBe(erwartetesTotal);
  });

  it("berechnet Verwaltungs-/Plattformgebühr als Prozentsatz des effektiven möblierten Jahresertrags", () => {
    const result = calculateFurnishedOpex({ ...specDefaults, verwaltungsgebuehrPercent: 5, plattformgebuehrPercent: 3 }, 30_000);
    expect(result.verwaltungsgebuehrChfPerYear).toBe(1_500);
    expect(result.plattformgebuehrChfPerYear).toBe(900);
  });

  it("0 Mieterwechsel pro Jahr macht Reinigung/Wäsche/Inserat 0, ohne Fehler", () => {
    const result = calculateFurnishedOpex({ ...specDefaults, mieterwechselProJahr: 0 }, 30_000);
    expect(result.reinigungChfPerYear).toBe(0);
    expect(result.waescheChfPerYear).toBe(0);
    expect(result.inseratChfPerYear).toBe(0);
  });
});

describe("calculateFurnishingRoi", () => {
  it("nutzt den inkrementellen NOI (netto), nicht den rohen Mietaufschlag", () => {
    const result = calculateFurnishingRoi({ incrementalFurnishingInvestmentChf: 14_000, incrementalNoiChf: 2_100 });
    expect(result.zusaetzlicherJahresertragChf).toBe(2_100);
    expect(result.roiPercent).toBeCloseTo(15, 5);
    expect(result.paybackYears).toBeCloseTo(14_000 / 2_100, 5);
  });

  it("liefert 0% ROI und undefined Payback bei negativem inkrementellem NOI (Möblierung lohnt sich netto nicht)", () => {
    const result = calculateFurnishingRoi({ incrementalFurnishingInvestmentChf: 14_000, incrementalNoiChf: -500 });
    expect(result.roiPercent).toBeCloseTo((-500 / 14_000) * 100, 5);
    expect(result.paybackYears).toBeUndefined();
  });
});

describe("calculateFurnishedRentalDelta", () => {
  it("rechnet Break-even und Mindest-wirtschaftlichen Zuschlag korrekt durch", () => {
    const result = calculateFurnishedRentalDelta({
      incrementalOpexChfPerYear: 3_876, // Summe aus dem calculateFurnishedOpex-Beispiel oben
      incrementalVacancyLossChfPerYear: 800,
      incrementalFurnishingInvestmentChf: 14_000,
      minimumRequiredFurnitureRoiPercent: 15,
      additionalGrossRentalIncomeChfPerYear: 4_800,
      incrementalNoiChf: 2_100,
    });

    expect(result.breakEvenFurnishingPremiumChfPerYear).toBe(4_676); // 3'876 + 800
    expect(result.breakEvenFurnishingPremiumChfPerMonth).toBeCloseTo(4_676 / 12, 5);
    expect(result.requiredFurnitureReturnChfPerYear).toBe(2_100); // 14'000 × 15%
    expect(result.minimumEconomicFurnishingPremiumChfPerYear).toBe(6_776); // 4'676 + 2'100
    expect(result.furnishingEfficiencyRatio).toBeCloseTo(2_100 / 4_800, 5);
  });

  it("liefert furnishingEfficiencyRatio undefined statt Division durch 0, wenn kein zusätzlicher Bruttoertrag entsteht", () => {
    const result = calculateFurnishedRentalDelta({
      incrementalOpexChfPerYear: 1_000,
      incrementalVacancyLossChfPerYear: 0,
      incrementalFurnishingInvestmentChf: 10_000,
      minimumRequiredFurnitureRoiPercent: 15,
      additionalGrossRentalIncomeChfPerYear: 0,
      incrementalNoiChf: -1_000,
    });
    expect(result.furnishingEfficiencyRatio).toBeUndefined();
  });
});
