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
    source:
      "Schweizweiter Fallback, falls kein Kanton bekannt ist. Wo bekannt, wird stattdessen der kantonsspezifische Wert verwendet (0% in 8 Kantonen bis 3.3% in VD/NE) — siehe apps/home4effinder/src/lib/cantonDefaults.ts (recherchiert August 2026).",
  }),
  notariatGrundbuchPercent: describe({
    key: "notariatGrundbuchPercent",
    label: "Notariat/Grundbuch",
    description: "Pauschale für Beurkundung und Grundbucheintrag.",
    unit: "%",
    defaultValue: 0.5,
    source: "Marktüblicher Bereich 0.1–1% je nach Kanton und Kaufpreishöhe — 0.5% als grober, häufig zitierter Mittelwert.",
  }),
  maklerprovisionPercent: describe({
    key: "maklerprovisionPercent",
    label: "Maklerprovision",
    description: "Default 0 — Annahme, dass Objekte primär direkt über Suchabo-Alerts gefunden werden, nicht über einen Makler.",
    unit: "%",
    defaultValue: 0,
    source: "Bewusst 0% als Standardfall (Direktsuche ohne Makler) — bei Maklerkauf marktüblich 2–3%, dann hier manuell überschreiben.",
  }),
  reparaturreservePercentOfKaufpreis: describe({
    key: "reparaturreservePercentOfKaufpreis",
    label: "Eigene Reparaturreserve",
    description: "Eigene Reserve für Reparaturen innerhalb der Wohnung (nicht die STWEG-Erneuerungsfonds-Beiträge, die separat in den Betriebskosten stecken) — Default gemäss Rückmeldung ca. 0.30% des Kaufpreises, per Wohnung auch als fixer CHF-Betrag überschreibbar.",
    unit: "% des Kaufpreises",
    defaultValue: 0.3,
    source:
      "Marktübliche Instandhaltungsrückstellungen für Wohneigentum liegen oft bei 0.5–1% des Gebäudewerts p.a.; 0.3% bewusst vorsichtiger gewählt, da es sich nur um die einzelne Wohnung (nicht die ganze Liegenschaft) handelt und die STWEG-Erneuerungsfonds-Beiträge bereits separat in den Betriebskosten stecken.",
  }),
  leerstandsreservePercentOfKaufpreis: describe({
    key: "leerstandsreservePercentOfKaufpreis",
    label: "Eigene Leerstandsreserve",
    description: "Zusätzlicher, eigener Puffer für unerwartet lange Vermietungslücken — ergänzt (nicht ersetzt) die bereits im Ertrag berücksichtigte typische Leerstandsquote.",
    unit: "% des Kaufpreises",
    defaultValue: 0.3,
    source: "Ergänzender Eigenpuffer zusätzlich zur bereits im Ertrag verrechneten typischen Leerstandsquote — 0.3% als konservativer Zusatzpuffer für unerwartet lange Vermietungslücken.",
  }),
  leerstandLangfristigPercent: describe({
    key: "leerstandLangfristigPercent",
    label: "Leerstand (langfristig, unmöbliert)",
    description: "Typischer Mietausfall bei normaler langfristiger Vermietung.",
    unit: "%",
    defaultValue: 2,
    source: "Die schweizweite Leerwohnungsziffer liegt seit Jahren bei ca. 1–1.5% (BFS-Leerwohnungszählung) — 2% als vorsichtiger Aufschlag für das Einzelobjekt-Risiko (kein Portfolio-Durchschnitt).",
  }),
  leerstandMoebliertPercent: describe({
    key: "leerstandMoebliertPercent",
    label: "Leerstand (möbliert, mittelfristig)",
    description: "Höherer Mietausfall bei möblierter/mittelfristiger Vermietung — Rückmeldung nennt eine Spanne von 5–8%.",
    unit: "%",
    defaultValue: 6,
    source: "Möblierte/mittelfristige Vermietungen haben empirisch höhere Leerstände als unmöblierte Langzeitvermietung — 6% als Mittelwert der genannten 5–8%-Spanne.",
  }),
  moeblierungNutzungsdauerJahre: describe({
    key: "moeblierungNutzungsdauerJahre",
    label: "Möblierungs-Nutzungsdauer",
    description: "Nach dieser Anzahl Jahre wird im Mehrjahresmodell ein Möblierungsersatz als konkreter Cash-Abfluss angesetzt.",
    unit: "Jahre",
    defaultValue: 7,
    source: "Übliche wirtschaftliche Nutzungsdauer von Wohnungsmöblierung (Möbel/Geräte) wird meist mit 5–10 Jahren angegeben — 7 Jahre als Mittelwert.",
  }),
  moeblierungErsatzquotePercent: describe({
    key: "moeblierungErsatzquotePercent",
    label: "Möblierungs-Ersatzquote",
    description: "Anteil der (inflationierten) Initialkosten, der bei einem Ersatz tatsächlich erneut anfällt — selten 100%.",
    unit: "% der Möblierungs-Initialkosten",
    defaultValue: 70,
    source: "Bei einem Ersatz wird selten 100% der ursprünglichen Kosten erneut fällig, da nicht jedes Teil gleichzeitig ersetzt werden muss — 70% als grobe Erfahrungsschätzung.",
  }),
  kalkulatorischerSteuersatzPercent: describe({
    key: "kalkulatorischerSteuersatzPercent",
    label: "Kalkulatorischer Steuersatz",
    description: "Grobe persönliche Schätzung für die Cashflow-Wasserfallrechnung — kein Steuerberatungsersatz, hängt real von Kanton/Gemeinde/Progression/Gesamtsituation ab.",
    unit: "%",
    defaultValue: 25,
    source:
      "Schweizweiter Fallback, falls kein Kanton bekannt ist. Wo bekannt, wird stattdessen eine grobe kantonale Einordnung (günstig/mittel/teuer, 18/24/29%) verwendet — siehe apps/home4effinder/src/lib/cantonDefaults.ts. Kombinierte Steuerbelastung (Bund/Kanton/Gemeinde) liegt real zwischen ca. 15% (günstigste Kantone) und 29% (teuerste); 25% als grobe schweizweite Mitte.",
  }),
  mietsteigerungPercentPerYear: describe({
    key: "mietsteigerungPercentPerYear",
    label: "Mietsteigerung p.a.",
    description: "Angenommenes jährliches Mietwachstum im 15-Jahres-Modell.",
    unit: "% p.a.",
    defaultValue: 1,
    source: "Orientiert an der langjährigen Schweizer Mietpreisentwicklung, die über längere Zeiträume typischerweise um rund 1% p.a. wächst — bewusst konservativ, kein Boom-Szenario.",
  }),
  kosteninflationPercentPerYear: describe({
    key: "kosteninflationPercentPerYear",
    label: "Kosteninflation p.a.",
    description: "Angenommene jährliche Kostensteigerung (Betriebskosten, Reserven, Möblierungsersatz) im 15-Jahres-Modell.",
    unit: "% p.a.",
    defaultValue: 1.5,
    source: "Etwas über der angenommenen Mietsteigerung, da Betriebs-/Unterhaltskosten (Energie, Hauswart, Dienstleistungen) tendenziell stärker steigen als Mieten — orientiert an der Schweizer Konsumententeuerung der letzten Jahre.",
  }),
  wertsteigerungPercentPerYear: describe({
    key: "wertsteigerungPercentPerYear",
    label: "Wertsteigerung p.a.",
    description: "Angenommene jährliche Wertsteigerung der Liegenschaft im 15-Jahres-Modell.",
    unit: "% p.a.",
    defaultValue: 1,
    source: "Konservative langfristige Wertsteigerungsannahme für Schweizer Wohneigentum — deutlich unter den starken Marktjahren einzelner Regionen (v.a. ZH/GE/ZG), bewusst vorsichtig für ein Basisszenario.",
  }),
  sellingCostPercent: describe({
    key: "sellingCostPercent",
    label: "Verkaufskosten (Exit)",
    description: "Grober Richtwert für Makler-/Verkaufsnebenkosten beim angenommenen Exit am Ende der Haltedauer.",
    unit: "%",
    defaultValue: 2.5,
    source: "Marktübliche Makler-/Vermarktungskosten beim Immobilienverkauf in der Schweiz liegen typischerweise bei 2–3%.",
  }),
  holdingPeriodYearsDefault: describe({
    key: "holdingPeriodYearsDefault",
    label: "Haltedauer (Default)",
    description: "Default-Haltedauer für das Mehrjahresmodell — 5 bis 30 Jahre wählbar, wie vorgegeben.",
    unit: "Jahre",
    defaultValue: 15,
    source: "Mittlere, praxisnahe Haltedauer für ein Buy-to-let-Investment — der volle Bereich 5–30 Jahre bleibt pro Objekt frei wählbar.",
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
