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
  reparaturreservePercentOfKaufpreis: describe({
    key: "reparaturreservePercentOfKaufpreis",
    label: "Eigene Reparaturreserve",
    description: "Eigene Reserve für Reparaturen innerhalb der Wohnung (nicht die STWEG-Erneuerungsfonds-Beiträge, die separat in den Betriebskosten stecken) — Default gemäss Rückmeldung ca. 0.30% des Kaufpreises, per Wohnung auch als fixer CHF-Betrag überschreibbar.",
    unit: "% des Kaufpreises",
    defaultValue: 0.3,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  leerstandsreservePercentOfKaufpreis: describe({
    key: "leerstandsreservePercentOfKaufpreis",
    label: "Eigene Leerstandsreserve",
    description: "Zusätzlicher, eigener Puffer für unerwartet lange Vermietungslücken — ergänzt (nicht ersetzt) die bereits im Ertrag berücksichtigte typische Leerstandsquote.",
    unit: "% des Kaufpreises",
    defaultValue: 0.3,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  leerstandLangfristigPercent: describe({
    key: "leerstandLangfristigPercent",
    label: "Leerstand (langfristig, unmöbliert)",
    description: "Typischer Mietausfall bei normaler langfristiger Vermietung.",
    unit: "%",
    defaultValue: 2,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  leerstandMoebliertPercent: describe({
    key: "leerstandMoebliertPercent",
    label: "Leerstand (möbliert, mittelfristig)",
    description: "Höherer Mietausfall bei möblierter/mittelfristiger Vermietung — Rückmeldung nennt eine Spanne von 5–8%.",
    unit: "%",
    defaultValue: 6,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  moeblierungNutzungsdauerJahre: describe({
    key: "moeblierungNutzungsdauerJahre",
    label: "Möblierungs-Nutzungsdauer",
    description: "Nach dieser Anzahl Jahre wird im Mehrjahresmodell ein Möblierungsersatz als konkreter Cash-Abfluss angesetzt.",
    unit: "Jahre",
    defaultValue: 7,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  moeblierungErsatzquotePercent: describe({
    key: "moeblierungErsatzquotePercent",
    label: "Möblierungs-Ersatzquote",
    description: "Anteil der (inflationierten) Initialkosten, der bei einem Ersatz tatsächlich erneut anfällt — selten 100%.",
    unit: "% der Möblierungs-Initialkosten",
    defaultValue: 70,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  kalkulatorischerSteuersatzPercent: describe({
    key: "kalkulatorischerSteuersatzPercent",
    label: "Kalkulatorischer Steuersatz",
    description: "Grobe persönliche Schätzung für die Cashflow-Wasserfallrechnung — kein Steuerberatungsersatz, hängt real von Kanton/Gemeinde/Progression/Gesamtsituation ab.",
    unit: "%",
    defaultValue: 25,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  mietsteigerungPercentPerYear: describe({
    key: "mietsteigerungPercentPerYear",
    label: "Mietsteigerung p.a.",
    description: "Angenommenes jährliches Mietwachstum im 15-Jahres-Modell.",
    unit: "% p.a.",
    defaultValue: 1,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  kosteninflationPercentPerYear: describe({
    key: "kosteninflationPercentPerYear",
    label: "Kosteninflation p.a.",
    description: "Angenommene jährliche Kostensteigerung (Betriebskosten, Reserven, Möblierungsersatz) im 15-Jahres-Modell.",
    unit: "% p.a.",
    defaultValue: 1.5,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  wertsteigerungPercentPerYear: describe({
    key: "wertsteigerungPercentPerYear",
    label: "Wertsteigerung p.a.",
    description: "Angenommene jährliche Wertsteigerung der Liegenschaft im 15-Jahres-Modell.",
    unit: "% p.a.",
    defaultValue: 1,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  sellingCostPercent: describe({
    key: "sellingCostPercent",
    label: "Verkaufskosten (Exit)",
    description: "Grober Richtwert für Makler-/Verkaufsnebenkosten beim angenommenen Exit am Ende der Haltedauer.",
    unit: "%",
    defaultValue: 2.5,
    source: "Platzhalter — noch nicht mit Auftraggeber abgestimmt",
  }),
  holdingPeriodYearsDefault: describe({
    key: "holdingPeriodYearsDefault",
    label: "Haltedauer (Default)",
    description: "Default-Haltedauer für das Mehrjahresmodell — 5 bis 30 Jahre wählbar, wie vorgegeben.",
    unit: "Jahre",
    defaultValue: 15,
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
