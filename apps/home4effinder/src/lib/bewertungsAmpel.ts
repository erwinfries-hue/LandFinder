import type { DueDiligenceSeverity } from "@landfinder/domain";
import type { RegionExtractionResult } from "./regionExtraction";
import { estimateQuantilePosition, findClosestQuantileRow } from "./regionMarketData";

/**
 * Konsolidierte "Bewertungsübersicht" — Wunsch aus dem SIPIS/ChatGPT-Benchmark-Vergleich
 * (siehe DECISIONS.md): SIPIS zeigt ein "Risiko-Radar" mit mehreren Ampeln nebeneinander
 * (Markt, Kaufpreis, Rendite, Cashflow, Möblierungs-Upside, STWEG, Energie, Exit).
 * HOME4efFINDER hatte bisher zwar schon Ampeln (Investment-Score-Chip, Rendite-Farbe je
 * Kennzahl, Due-Diligence-Kategorie-Chips), aber verstreut über die Seite statt an EINER
 * Stelle auf einen Blick zusammengefasst. Diese Datei baut genau diese Zusammenfassung —
 * bewusst NUR aus bereits vorhandenen, selbst berechneten Werten (wie beim
 * Investment-Score, siehe investmentScore.ts: "nichts wird erfunden"), keine neue
 * KI-Einschätzung.
 *
 * `AmpelStatus` nutzt bewusst dieselben drei Werte wie `ChipTone`
 * ("good"/"warn"/"bad") statt eigener Begriffe, damit sich jede Dimension direkt als
 * `<Chip tone={...}>` (Web) bzw. mit derselben Farbzuordnung im PDF darstellen lässt.
 */
export type AmpelStatus = "good" | "warn" | "bad";

export interface AmpelDimension {
  key: string;
  label: string;
  status: AmpelStatus;
  detail: string;
}

const SEVERITY_TO_AMPEL: Record<DueDiligenceSeverity, AmpelStatus> = { OK: "good", KLAERUNGSBEDARF: "warn", RISIKO: "bad" };

export function computeBewertungsAmpeln(params: {
  nettoRenditePercent: number;
  nettoRenditeZielPercent: number;
  nachhaltigerCashflowChf: number;
  dueDiligenceOverallStatus: DueDiligenceSeverity | undefined;
  /** = `furnishingRoi.roiPercent` (NETTO-basiert, siehe bestandsrendite.ts) — `undefined`, wenn keine Möblierungskosten erfasst sind (keine sinnvolle Aussage möglich). */
  moeblierungFurnitureRoiPercent: number | undefined;
  /**
   * Referenzwert aus dem "Annahmen"-Reiter (`BESTANDSRENDITE_PARAMETERS.minimumRequiredFurnitureRoiPercent`)
   * — Grundlage für die Möblierungs-Upside-Ampel-Schwellen (siehe dort). Seit dem SIPIS
   * Furnished-Rental-Modul (v1.1) ist `moeblierungFurnitureRoiPercent` NETTO-basiert
   * (Mehrertrag bereits um alle möblierungsspezifischen Zusatzkosten bereinigt) statt wie
   * zuvor bruttomietbasiert — strukturell deutlich niedrigere Werte als vorher, daher
   * relativ zu diesem Referenzwert statt fixer Prozentsätze eingestuft.
   */
  minimumRequiredFurnitureRoiPercent: number;
  /**
   * Für die Kaufpreis-vs-Markt-Ampel — dieselben Rohdaten wie `MarktEinordnungView`
   * (Regionsreport der Gemeinde). `undefined`, wenn kein Regionsreport für die Gemeinde
   * des Objekts vorliegt — dann wird die Dimension komplett weggelassen statt eine
   * erfundene Einschätzung zu zeigen.
   */
  regionMarkt?: { regionData: RegionExtractionResult; zimmerzahl: number | undefined; kaufpreisChfPerM2: number };
}): AmpelDimension[] {
  const {
    nettoRenditePercent,
    nettoRenditeZielPercent,
    nachhaltigerCashflowChf,
    dueDiligenceOverallStatus,
    moeblierungFurnitureRoiPercent,
    minimumRequiredFurnitureRoiPercent,
    regionMarkt,
  } = params;

  const dimensionen: AmpelDimension[] = [];

  // Rendite — dieselben Schwellenwerte wie renditeAmpelColor (investmentScore.ts):
  // Ziel erreicht = grün, bis 1 Prozentpunkt darunter = gelb, mehr darunter = rot.
  const renditeStatus: AmpelStatus =
    nettoRenditePercent >= nettoRenditeZielPercent ? "good" : nettoRenditePercent >= nettoRenditeZielPercent - 1 ? "warn" : "bad";
  dimensionen.push({
    key: "rendite",
    label: "Nettorendite",
    status: renditeStatus,
    detail: `${nettoRenditePercent.toFixed(2)}% vs. Ziel ${nettoRenditeZielPercent}%`,
  });

  // Cashflow — nachhaltiger Cashflow (nach Zins/Amortisation/Steuer/Reparatur-/Leerstandsreserve)
  // positiv oder nicht; bewusst zweistufig statt einer erfundenen "knapp positiv"-Schwelle.
  dimensionen.push({
    key: "cashflow",
    label: "Cashflow",
    status: nachhaltigerCashflowChf >= 0 ? "good" : "bad",
    detail: nachhaltigerCashflowChf >= 0 ? "nachhaltig positiv" : "nachhaltig negativ",
  });

  // Kaufpreis vs. Markt — Quantil-Position des Kaufpreis/m² innerhalb der Gemeinde
  // (Regionsreport). Unter dem Median (≤50%-Quantil) = grün, bis 75% = gelb, darüber = rot.
  if (regionMarkt?.zimmerzahl !== undefined) {
    const row = findClosestQuantileRow(regionMarkt.regionData.preise.eigentumswohnungen, regionMarkt.zimmerzahl);
    if (row) {
      const position = estimateQuantilePosition(regionMarkt.kaufpreisChfPerM2, row);
      const percent = position.kind === "interpolated" ? position.percent : position.boundaryPercent;
      const status: AmpelStatus = percent <= 50 ? "good" : percent <= 75 ? "warn" : "bad";
      const label = position.kind === "below" ? "< 10%-Quantil" : position.kind === "above" ? "> 90%-Quantil" : `≈ ${Math.round(percent)}%-Quantil`;
      dimensionen.push({ key: "kaufpreisMarkt", label: "Kaufpreis vs. Markt", status, detail: `${label} der Gemeinde` });
    }
  }

  // Möblierungs-Upside — nur wenn tatsächlich Möblierungskosten erfasst sind (sonst keine
  // sinnvolle ROI-Aussage möglich, siehe furnishingRoi in bestandsrendite.ts). Relativ zur
  // geforderten Mindestrendite eingestuft (nicht mehr fixe Prozentsätze) — grün ab dem
  // Doppelten der Mindestrendite, gelb ab der Mindestrendite selbst, sonst rot.
  if (moeblierungFurnitureRoiPercent !== undefined) {
    const status: AmpelStatus =
      moeblierungFurnitureRoiPercent >= minimumRequiredFurnitureRoiPercent * 2
        ? "good"
        : moeblierungFurnitureRoiPercent >= minimumRequiredFurnitureRoiPercent
          ? "warn"
          : "bad";
    dimensionen.push({ key: "moeblierung", label: "Möblierungs-Upside", status, detail: `ROI ${moeblierungFurnitureRoiPercent.toFixed(0)}%` });
  }

  // Due-Diligence-Gesamtstatus — Kurzform des bereits vorhandenen Gesamtstatus-Chips
  // (DueDiligencePanel), hier zusätzlich in der Übersicht, damit alle Ampeln an einer
  // Stelle sichtbar sind statt über die Seite verstreut.
  if (dueDiligenceOverallStatus !== undefined) {
    dimensionen.push({
      key: "dueDiligence",
      label: "Due Diligence",
      status: SEVERITY_TO_AMPEL[dueDiligenceOverallStatus],
      detail: dueDiligenceOverallStatus === "OK" ? "unauffällig" : dueDiligenceOverallStatus === "KLAERUNGSBEDARF" ? "Klärungsbedarf" : "wesentliches Risiko",
    });
  }

  return dimensionen;
}
