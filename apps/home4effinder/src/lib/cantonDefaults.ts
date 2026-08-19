/**
 * Kantonsspezifische Vorschlagswerte für Parameter, die real signifikant zwischen den
 * 26 Kantonen streuen — als Alternative zu einem einzigen schweizweiten Platzhalter.
 * Bewusst als statische, jetzt (2026-08-19) recherchierte Tabelle statt einer
 * Live-Internetrecherche pro Objekt (Entscheidung mit dem Auftraggeber abgestimmt) —
 * Nachteil: veraltet mit der Zeit, müsste künftig manuell aufgefrischt werden.
 *
 * Alle anderen Bestandsrendite-Parameter (Mietsteigerung, Kosteninflation,
 * Wertsteigerung, Möblierungs-/Renovationsannahmen, Reserven, Haltedauer …) sind
 * NICHT kantonsspezifisch, sondern bleiben ein einzelner, schweizweiter Default —
 * siehe BESTANDSRENDITE_PARAMETERS in packages/financial-engine/src/parameters.ts.
 */

/**
 * Handänderungssteuer (kantonale Grunderwerbssteuer, vom Käufer zu tragen) — Sätze für
 * den steuerbaren Regelfall (nicht-selbstbewohnt/Anlageobjekt, kein reduzierter Satz für
 * Ersterwerb/Verwandte). Acht Kantone erheben gar keine Handänderungssteuer (nur eine
 * Grundbuchgebühr, die separat unter "Notariat/Grundbuch" erfasst wird).
 *
 * Quellen (August 2026, mehrfach quergecheckt): ESTV-Steuermäppchen "Handänderungssteuer",
 * grundheim.ch, immoverkauf24.ch, finanz-vergleich.ch. Bei Kantonen mit Gemeindezuschlag
 * (VD, FR) bzw. Spannen (GR) wurde ein realistischer, häufig zitierter Wert gewählt statt
 * eines rechnerischen Mittels — kein Steuerberatungsersatz, im Zweifel beim zuständigen
 * Grundbuchamt/Notariat nachfragen.
 */
const HANDAENDERUNGSSTEUER_PERCENT_BY_CANTON: Record<string, number> = {
  ZH: 0,
  ZG: 0,
  SZ: 0,
  UR: 0,
  GL: 0,
  SH: 0,
  AG: 0,
  TI: 0,
  BE: 1.8,
  LU: 1.5,
  OW: 1.5,
  NW: 1.0,
  FR: 1.5,
  SO: 2.2,
  BS: 3.0,
  BL: 2.5,
  AR: 2.0,
  AI: 1.0,
  SG: 1.0,
  GR: 1.75,
  TG: 2.5,
  VD: 3.3,
  VS: 1.5,
  NE: 3.3,
  GE: 3.0,
  JU: 2.1,
};

/**
 * Grobe, dreistufige Kategorisierung der kantonalen Einkommenssteuerbelastung (Kanton +
 * Gemeinde + Bund, kombiniert) — als Grundlage für den "Kalkulatorischer Steuersatz"
 * Default. Bewusst KEINE einkommensspezifisch exakten Zahlen pro Kanton, da die reale
 * Steuerbelastung stark von Einkommen/Zivilstand/Konfession/Gemeinde abhängt und eine
 * scheinbar präzise Einzelzahl pro Kanton hier mehr Genauigkeit vortäuschen würde, als
 * recherchierbar ist ("nichts wird erfunden") — die grobe Einordnung "günstig/mittel/teuer"
 * ist dagegen gut dokumentiert und stabil.
 *
 * Quelle: bekannte, wiederkehrende Rankings (u.a. ESTV-Steuerbelastungsmonitoring,
 * gängige Kantons-Steuervergleiche) — Zug/Schwyz/Nidwalden/Obwalden/Uri/Appenzell
 * Innerrhoden regelmässig als günstigste, Genf/Waadt/Basel-Stadt/Neuenburg/Jura als
 * teuerste Kantone genannt.
 */
const STEUERTIER_BY_CANTON: Record<string, "GUENSTIG" | "MITTEL" | "TEUER"> = {
  ZG: "GUENSTIG",
  SZ: "GUENSTIG",
  NW: "GUENSTIG",
  OW: "GUENSTIG",
  UR: "GUENSTIG",
  AI: "GUENSTIG",
  GE: "TEUER",
  VD: "TEUER",
  BS: "TEUER",
  NE: "TEUER",
  JU: "TEUER",
};
const KALKULATORISCHER_STEUERSATZ_PERCENT_BY_TIER: Record<"GUENSTIG" | "MITTEL" | "TEUER", number> = {
  GUENSTIG: 18,
  MITTEL: 24,
  TEUER: 29,
};

export interface CantonDefaults {
  handaenderungssteuerPercent: number;
  kalkulatorischerSteuersatzPercent: number;
}

/** `undefined`/unbekannter Kanton → `undefined`, Aufrufer fällt dann auf den schweizweiten Platzhalter zurück. */
export function getCantonDefaults(canton: string | undefined): CantonDefaults | undefined {
  if (!canton || !(canton in HANDAENDERUNGSSTEUER_PERCENT_BY_CANTON)) return undefined;
  const tier = STEUERTIER_BY_CANTON[canton] ?? "MITTEL";
  return {
    handaenderungssteuerPercent: HANDAENDERUNGSSTEUER_PERCENT_BY_CANTON[canton],
    kalkulatorischerSteuersatzPercent: KALKULATORISCHER_STEUERSATZ_PERCENT_BY_TIER[tier],
  };
}
