/**
 * Jeder in den Formeln verwendete Faktor ist hier als benanntes, beschriebenes Objekt
 * mit Default-Wert erfasst — nicht als "magische Zahl" irgendwo in einer Funktion.
 * Diese Registry ist die Datengrundlage für ein künftiges "Annahmen"-Register in der
 * UI (eigener Reiter, in dem Nutzer:innen jeden Wert einsehen und überschreiben können).
 * Die Formeln selbst nehmen diese Werte immer als explizite Parameter entgegen — nie
 * als eingebauten Default innerhalb der Berechnung.
 */
export interface ParameterDescriptor<T = number> {
  key: string;
  label: string;
  description: string;
  unit: string;
  defaultValue: T;
  /** Abschnitt im Masterdokument, aus dem dieser Parameter stammt. */
  source: string;
}

function describe<T>(p: ParameterDescriptor<T>): ParameterDescriptor<T> {
  return p;
}

/**
 * Korrekturfaktoren für die Baupotenzial-Schätzung (Abschnitt 9). Reine Annahmen —
 * ohne amtliche Bestätigung entsprechend als Verifikationsstufe C zu kennzeichnen.
 */
export const BAUPOTENZIAL_PARAMETERS = {
  netEfficiencyRatio: describe({
    key: "netEfficiencyRatio",
    label: "Nettoeffizienz (NRA/GFA)",
    description: "Anteil der Nettowohnfläche an der Geschossfläche — deckt Wände, Erschliessung, Technik ab.",
    unit: "Faktor (0–1)",
    defaultValue: 0.82,
    source: "Abschnitt 9",
  }),
  averageFloorHeightM: describe({
    key: "averageFloorHeightM",
    label: "Durchschnittliche Geschosshöhe",
    description: "Für die Umrechnung von zulässigem Gebäudevolumen in Geschossfläche.",
    unit: "m",
    defaultValue: 3.0,
    source: "Abschnitt 9",
  }),
  geometryFactor: describe({
    key: "geometryFactor",
    label: "Geometriefaktor",
    description: "Korrektur für unregelmässige Parzellenform, die die nutzbare Fläche reduziert.",
    unit: "Faktor (0–1)",
    defaultValue: 0.95,
    source: "Abschnitt 9",
  }),
  setbackFactor: describe({
    key: "setbackFactor",
    label: "Grenzabstandsfaktor",
    description: "Korrektur für Grenz- und Gebäudeabstände, die die bebaubare Fläche einschränken.",
    unit: "Faktor (0–1)",
    defaultValue: 0.95,
    source: "Abschnitt 9",
  }),
  topographyFactor: describe({
    key: "topographyFactor",
    label: "Topografiefaktor",
    description: "Korrektur für Hanglage oder unebenes Terrain.",
    unit: "Faktor (0–1)",
    defaultValue: 1.0,
    source: "Abschnitt 9",
  }),
  accessFactor: describe({
    key: "accessFactor",
    label: "Erschliessungsfaktor",
    description: "Korrektur, falls Teile der Parzelle für Zufahrt/Erschliessung reserviert werden müssen.",
    unit: "Faktor (0–1)",
    defaultValue: 1.0,
    source: "Abschnitt 9",
  }),
} as const;

/**
 * Default-Startwerte für den Stress-Case (Abschnitt 14). Editierbare Startwerte —
 * kein fixer Bestandteil einer Berechnung, sondern der Ausgangspunkt im Suchprofil.
 */
export const STRESS_CASE_PARAMETERS = {
  rentDeltaPct: describe({
    key: "rentDeltaPct",
    label: "Mietanpassung Stress-Case",
    description: "Prozentuale Veränderung der Nettomiete gegenüber dem Base Case.",
    unit: "%",
    defaultValue: -7,
    source: "Abschnitt 14",
  }),
  constructionCostDeltaPct: describe({
    key: "constructionCostDeltaPct",
    label: "Baukostenanpassung Stress-Case",
    description: "Prozentuale Veränderung der Baukosten gegenüber dem Base Case.",
    unit: "%",
    defaultValue: 12,
    source: "Abschnitt 14",
  }),
  interestRateDeltaPp: describe({
    key: "interestRateDeltaPp",
    label: "Zinssatzanpassung Stress-Case",
    description: "Veränderung des Zinssatzes gegenüber dem Base Case, in Prozentpunkten.",
    unit: "Prozentpunkte",
    defaultValue: 1.5,
    source: "Abschnitt 14",
  }),
  nraDeltaPct: describe({
    key: "nraDeltaPct",
    label: "Nettowohnflächenanpassung Stress-Case",
    description: "Prozentuale Veränderung der realisierbaren Nettowohnfläche gegenüber dem Base Case.",
    unit: "%",
    defaultValue: -5,
    source: "Abschnitt 14",
  }),
  delayMonths: describe({
    key: "delayMonths",
    label: "Bauverzögerung Stress-Case",
    description: "Zusätzliche Bauzeit gegenüber dem Base Case (erhöht Bau- und Finanzierungskosten).",
    unit: "Monate",
    defaultValue: 9,
    source: "Abschnitt 14",
  }),
  extraContingencyPct: describe({
    key: "extraContingencyPct",
    label: "Zusätzliche Reserve Stress-Case",
    description: "Zusätzlicher Reservezuschlag auf die Gesamtprojektkosten gegenüber dem Base Case.",
    unit: "Prozentpunkte",
    defaultValue: 3,
    source: "Abschnitt 14",
  }),
} as const;

/**
 * Kostenstruktur-Annahmen für "Bestandsrendite auf Eigentumswohnungen"
 * (`bestandsrendite.ts`, docs/OPEN_DECISIONS.md Punkt M) — anders als
 * `BAUPOTENZIAL_PARAMETERS`/`STRESS_CASE_PARAMETERS` **nicht** aus einem
 * abgenommenen Masterdokument-Abschnitt übernommen (den gibt es für diese Objektart
 * noch nicht), deshalb `source` hier bewusst ehrlich als Platzhalter markiert statt
 * eine Abschnittsnummer zu erfinden. Grobe, plausible Schweizer Marktwerte als
 * Startpunkt, kein kalibrierter Business-Wert — mit dem Auftraggeber abzustimmen,
 * bevor sie irgendwo als Standard-Voreinstellung in einer UI landen.
 */
export const BESTANDSRENDITE_PARAMETERS = {
  handaenderungssteuerPercent: describe({
    key: "handaenderungssteuerPercent",
    label: "Handänderungssteuer",
    description: "Kantonal/kommunal stark unterschiedlich (0–3.3%, mehrere Kantone 0% für Käufer) — grober Mittelwert, kein kantonsscharfer Satz.",
    unit: "%",
    defaultValue: 2,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  notariatGrundbuchPercent: describe({
    key: "notariatGrundbuchPercent",
    label: "Notariat/Grundbuch",
    description: "Pauschale für Beurkundung und Grundbucheintrag.",
    unit: "%",
    defaultValue: 0.5,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  maklerprovisionPercent: describe({
    key: "maklerprovisionPercent",
    label: "Maklerprovision",
    description: "Default 0 — Annahme, dass Objekte primär direkt über Suchabo-Alerts gefunden werden, nicht über einen Makler.",
    unit: "%",
    defaultValue: 0,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  jaehrlicherRenovationssatzPercent: describe({
    key: "jaehrlicherRenovationssatzPercent",
    label: "Laufende Renovationsrückstellung",
    description: "Jährliche Rückstellung für laufende Renovationen, in % des Kaufpreises (nicht der Initial-Renovationskosten) — grober Richtwert.",
    unit: "% des Kaufpreises",
    defaultValue: 1,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  jaehrlicherMoebelErsatzsatzPercent: describe({
    key: "jaehrlicherMoebelErsatzsatzPercent",
    label: "Möblierungs-Ersatzrate",
    description: "Jährlicher Ersatz-/Erneuerungssatz für Mobiliar, in % der Möblierungs-Initialkosten — grob an einer Nutzungsdauer von ca. 6–8 Jahren orientiert.",
    unit: "% der Möblierungskosten",
    defaultValue: 14,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
} as const;

export type BaupotenzialFactorKey = keyof typeof BAUPOTENZIAL_PARAMETERS;
export type StressCaseParameterKey = keyof typeof STRESS_CASE_PARAMETERS;
export type BestandsrenditeParameterKey = keyof typeof BESTANDSRENDITE_PARAMETERS;

/** Extrahiert nur die Default-Werte aus einer Parameter-Registry, für den direkten Gebrauch in Formeln. */
export function defaultsOf<K extends string>(
  registry: Record<K, ParameterDescriptor>,
): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key in registry) {
    result[key] = registry[key].defaultValue;
  }
  return result;
}
