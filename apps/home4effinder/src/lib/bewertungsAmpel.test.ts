import { describe, it, expect } from "vitest";
import { computeBewertungsAmpeln } from "./bewertungsAmpel";
import type { RegionExtractionResult } from "./regionExtraction";

const baseParams = {
  nettoRenditePercent: 4,
  nettoRenditeZielPercent: 4,
  nachhaltigerCashflowChf: 1_000,
  dueDiligenceOverallStatus: undefined,
  moeblierungFurnitureRoiPercent: undefined,
};

const regionData: RegionExtractionResult = {
  gemeinde: "Wohlen",
  canton: "AG",
  kennzahlen: {},
  preise: {
    mietwohnungen: [],
    eigentumswohnungen: [{ zimmerzahl: 4, q10: 5_220, q30: 6_160, q50: 6_900, q70: 8_150, q90: 9_300 }],
    einfamilienhaeuser: [],
  },
};

describe("computeBewertungsAmpeln", () => {
  it("Rendite: grün wenn Ziel erreicht, gelb bis 1 Prozentpunkt darunter, rot darunter — dieselben Schwellen wie renditeAmpelColor", () => {
    expect(computeBewertungsAmpeln({ ...baseParams, nettoRenditePercent: 4.5, nettoRenditeZielPercent: 4 }).find((a) => a.key === "rendite")?.status).toBe(
      "good",
    );
    expect(computeBewertungsAmpeln({ ...baseParams, nettoRenditePercent: 3.5, nettoRenditeZielPercent: 4 }).find((a) => a.key === "rendite")?.status).toBe(
      "warn",
    );
    expect(computeBewertungsAmpeln({ ...baseParams, nettoRenditePercent: 2.5, nettoRenditeZielPercent: 4 }).find((a) => a.key === "rendite")?.status).toBe(
      "bad",
    );
  });

  it("Cashflow: grün bei nachhaltigem Cashflow >= 0, rot darunter", () => {
    expect(computeBewertungsAmpeln({ ...baseParams, nachhaltigerCashflowChf: 0 }).find((a) => a.key === "cashflow")?.status).toBe("good");
    expect(computeBewertungsAmpeln({ ...baseParams, nachhaltigerCashflowChf: -1 }).find((a) => a.key === "cashflow")?.status).toBe("bad");
  });

  it("Kaufpreis vs. Markt fehlt ohne regionMarkt-Angabe komplett (keine erfundene Einschätzung ohne Regionsreport)", () => {
    const ampeln = computeBewertungsAmpeln(baseParams);
    expect(ampeln.find((a) => a.key === "kaufpreisMarkt")).toBeUndefined();
  });

  it("Kaufpreis vs. Markt: unter dem Median grün, zwischen 50-75%-Quantil gelb, darüber rot", () => {
    const guenstig = computeBewertungsAmpeln({ ...baseParams, regionMarkt: { regionData, zimmerzahl: 4, kaufpreisChfPerM2: 6_000 } }); // zwischen q10/q30, deutlich unter dem Median
    expect(guenstig.find((a) => a.key === "kaufpreisMarkt")?.status).toBe("good");

    const mittel = computeBewertungsAmpeln({ ...baseParams, regionMarkt: { regionData, zimmerzahl: 4, kaufpreisChfPerM2: 7_500 } }); // zwischen q50/q70
    expect(mittel.find((a) => a.key === "kaufpreisMarkt")?.status).toBe("warn");

    const teuer = computeBewertungsAmpeln({ ...baseParams, regionMarkt: { regionData, zimmerzahl: 4, kaufpreisChfPerM2: 9_000 } }); // nahe q90
    expect(teuer.find((a) => a.key === "kaufpreisMarkt")?.status).toBe("bad");
  });

  it("Möblierungs-Upside fehlt ohne erfassten ROI, sonst gestuft nach Höhe", () => {
    expect(computeBewertungsAmpeln(baseParams).find((a) => a.key === "moeblierung")).toBeUndefined();
    expect(computeBewertungsAmpeln({ ...baseParams, moeblierungFurnitureRoiPercent: 70 }).find((a) => a.key === "moeblierung")?.status).toBe("good");
    expect(computeBewertungsAmpeln({ ...baseParams, moeblierungFurnitureRoiPercent: 30 }).find((a) => a.key === "moeblierung")?.status).toBe("warn");
    expect(computeBewertungsAmpeln({ ...baseParams, moeblierungFurnitureRoiPercent: 5 }).find((a) => a.key === "moeblierung")?.status).toBe("bad");
  });

  it("Due Diligence: fehlt ohne Synthese, sonst direkt aus overallStatus übernommen (OK/KLAERUNGSBEDARF/RISIKO -> good/warn/bad)", () => {
    expect(computeBewertungsAmpeln(baseParams).find((a) => a.key === "dueDiligence")).toBeUndefined();
    expect(computeBewertungsAmpeln({ ...baseParams, dueDiligenceOverallStatus: "OK" }).find((a) => a.key === "dueDiligence")?.status).toBe("good");
    expect(computeBewertungsAmpeln({ ...baseParams, dueDiligenceOverallStatus: "KLAERUNGSBEDARF" }).find((a) => a.key === "dueDiligence")?.status).toBe(
      "warn",
    );
    expect(computeBewertungsAmpeln({ ...baseParams, dueDiligenceOverallStatus: "RISIKO" }).find((a) => a.key === "dueDiligence")?.status).toBe("bad");
  });

  it("Rendite und Cashflow sind immer vorhanden (keine optionalen Eingaben), maximal fünf Dimensionen insgesamt", () => {
    const ampeln = computeBewertungsAmpeln(baseParams);
    expect(ampeln.map((a) => a.key)).toEqual(["rendite", "cashflow"]);

    const vollstaendig = computeBewertungsAmpeln({
      ...baseParams,
      dueDiligenceOverallStatus: "OK",
      moeblierungFurnitureRoiPercent: 60,
      regionMarkt: { regionData, zimmerzahl: 4, kaufpreisChfPerM2: 6_000 },
    });
    expect(vollstaendig).toHaveLength(5);
  });
});
