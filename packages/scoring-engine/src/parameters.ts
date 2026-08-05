/**
 * Wie in `packages/financial-engine`: jeder Gewichts-, Schwellen- oder Bandwert ist
 * hier benannt, beschrieben und mit Default versehen — nichts steckt "nackt" in einer
 * Formel. Das Masterdokument gibt die Gewichte pro Kategorie exakt vor (Abschnitt 15,
 * 16); wo es keine Formel für die Umrechnung eines Rohwerts in Punkte vorgibt (z.B.
 * ab welchem Yield-on-Cost-Wert die volle Punktzahl erreicht ist), ist das hier als
 * explizite, editierbare Modellannahme benannt — nie stillschweigend erfunden.
 */
export interface ParameterDescriptor<T = number> {
  key: string;
  label: string;
  description: string;
  unit: string;
  defaultValue: T;
  source: string;
}

function describe<T>(p: ParameterDescriptor<T>): ParameterDescriptor<T> {
  return p;
}

export function defaultsOf<K extends string>(registry: Record<K, ParameterDescriptor>): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key in registry) result[key] = registry[key].defaultValue;
  return result;
}

/** Typ-Alias für "alle Default-Werte einer Registry" — Basistyp für optionale Override-Parameter in den Score-Funktionen. */
export type ValuesOf<Registry> = Registry extends Record<infer K extends string, ParameterDescriptor> ? Record<K, number> : never;

// ---------------------------------------------------------------------------
// Kategorie-Gewichte (Abschnitt 15) — diese Werte sind im Masterdokument exakt
// vorgegeben, hier trotzdem als Parameter erfasst, damit sie im UI sichtbar bleiben.
// ---------------------------------------------------------------------------
export const SCORE_WEIGHTS = {
  yieldOnCost: describe({ key: "yieldOnCost", label: "Yield on Cost", description: "Anteil am Wirtschaftlichkeits-Score.", unit: "Punkte", defaultValue: 12, source: "Abschnitt 15" }),
  residualwertdifferenz: describe({ key: "residualwertdifferenz", label: "Residualwertdifferenz", description: "Anteil am Wirtschaftlichkeits-Score.", unit: "Punkte", defaultValue: 12, source: "Abschnitt 15" }),
  entwicklungsmarge: describe({ key: "entwicklungsmarge", label: "Entwicklungsmarge", description: "Anteil am Wirtschaftlichkeits-Score.", unit: "Punkte", defaultValue: 6, source: "Abschnitt 15" }),
  dscrCashflow: describe({ key: "dscrCashflow", label: "DSCR/Cashflow", description: "Anteil am Wirtschaftlichkeits-Score.", unit: "Punkte", defaultValue: 5, source: "Abschnitt 15" }),
  budgetfit: describe({ key: "budgetfit", label: "Budgetfit", description: "Anteil am Wirtschaftlichkeits-Score.", unit: "Punkte", defaultValue: 5, source: "Abschnitt 15" }),

  zone: describe({ key: "zone", label: "Zone", description: "Anteil am Baupotenzial-Score.", unit: "Punkte", defaultValue: 6, source: "Abschnitt 15" }),
  projektgroesse: describe({ key: "projektgroesse", label: "Projektgrösse", description: "Anteil am Baupotenzial-Score.", unit: "Punkte", defaultValue: 8, source: "Abschnitt 15" }),
  formTopografie: describe({ key: "formTopografie", label: "Form/Topografie", description: "Anteil am Baupotenzial-Score.", unit: "Punkte", defaultValue: 4, source: "Abschnitt 15" }),
  erschliessungZufahrt: describe({ key: "erschliessungZufahrt", label: "Erschliessung/Zufahrt", description: "Anteil am Baupotenzial-Score.", unit: "Punkte", defaultValue: 4, source: "Abschnitt 15" }),
  verifikation: describe({ key: "verifikation", label: "Verifikation", description: "Anteil am Baupotenzial-Score.", unit: "Punkte", defaultValue: 3, source: "Abschnitt 15" }),

  leerstand: describe({ key: "leerstand", label: "Leerstand", description: "Anteil am Markt-Score.", unit: "Punkte", defaultValue: 5, source: "Abschnitt 15" }),
  bevoelkerungHaushalte: describe({ key: "bevoelkerungHaushalte", label: "Bevölkerung/Haushalte", description: "Anteil am Markt-Score.", unit: "Punkte", defaultValue: 4, source: "Abschnitt 15" }),
  mietniveau: describe({ key: "mietniveau", label: "Mietniveau", description: "Anteil am Markt-Score.", unit: "Punkte", defaultValue: 3, source: "Abschnitt 15" }),
  bautaetigkeit: describe({ key: "bautaetigkeit", label: "Bautätigkeit", description: "Anteil am Markt-Score.", unit: "Punkte", defaultValue: 3, source: "Abschnitt 15" }),

  oev: describe({ key: "oev", label: "ÖV", description: "Anteil am Lage-Score.", unit: "Punkte", defaultValue: 4, source: "Abschnitt 15" }),
  erreichbarkeit: describe({ key: "erreichbarkeit", label: "Erreichbarkeit", description: "Anteil am Lage-Score.", unit: "Punkte", defaultValue: 3, source: "Abschnitt 15" }),
  zielmieterFit: describe({ key: "zielmieterFit", label: "Zielmieter-Fit", description: "Anteil am Lage-Score.", unit: "Punkte", defaultValue: 3, source: "Abschnitt 15" }),

  risikoMax: describe({ key: "risikoMax", label: "Risiko (max.)", description: "Maximalpunktzahl der Risikokategorie, bevor Abzüge angewendet werden.", unit: "Punkte", defaultValue: 10, source: "Abschnitt 15" }),
} as const;

// ---------------------------------------------------------------------------
// Umrechnungs-Bänder (Rohwert → Punkte). Das Masterdokument gibt hierfür keine
// Formel vor — dies sind explizite, benannte Modellannahmen.
// ---------------------------------------------------------------------------
export const SCORE_BANDS = {
  yieldOnCostFloorPct: describe({ key: "yieldOnCostFloorPct", label: "Yield on Cost — 0 Punkte ab", description: "Yield-on-Cost-Wert, bei dem 0 Punkte vergeben werden.", unit: "%", defaultValue: 2.5, source: "Modellannahme" }),
  yieldOnCostCeilingPct: describe({ key: "yieldOnCostCeilingPct", label: "Yield on Cost — volle Punktzahl ab", description: "Yield-on-Cost-Wert, ab dem die volle Punktzahl vergeben wird.", unit: "%", defaultValue: 5.5, source: "Modellannahme" }),

  landValueGapFloorPct: describe({ key: "landValueGapFloorPct", label: "Residualwertdifferenz — 0 Punkte ab", description: "Differenz Residualwert/Angebotspreis, bei der 0 Punkte vergeben werden.", unit: "%", defaultValue: -10, source: "Modellannahme" }),
  landValueGapCeilingPct: describe({ key: "landValueGapCeilingPct", label: "Residualwertdifferenz — volle Punktzahl ab", description: "Differenz Residualwert/Angebotspreis, ab der die volle Punktzahl vergeben wird.", unit: "%", defaultValue: 20, source: "Modellannahme" }),

  developmentMarginFloorPct: describe({ key: "developmentMarginFloorPct", label: "Entwicklungsmarge — 0 Punkte ab", description: "Entwicklungsmarge, bei der 0 Punkte vergeben werden.", unit: "%", defaultValue: 10, source: "Modellannahme" }),
  developmentMarginCeilingPct: describe({ key: "developmentMarginCeilingPct", label: "Entwicklungsmarge — volle Punktzahl ab", description: "Entwicklungsmarge, ab der die volle Punktzahl vergeben wird.", unit: "%", defaultValue: 25, source: "Modellannahme" }),

  dscrFloor: describe({ key: "dscrFloor", label: "DSCR — 0 Punkte ab", description: "DSCR (Base Case), bei dem 0 Punkte vergeben werden.", unit: "Faktor", defaultValue: 1.0, source: "Modellannahme" }),
  dscrCeiling: describe({ key: "dscrCeiling", label: "DSCR — volle Punktzahl ab", description: "DSCR (Base Case), ab dem die volle Punktzahl vergeben wird.", unit: "Faktor", defaultValue: 1.5, source: "Modellannahme" }),

  budgetfitFloorRatio: describe({ key: "budgetfitFloorRatio", label: "Budgetfit — 0 Punkte ab", description: "Verhältnis Gesamtinvestition/max. Budget, bei dem 0 Punkte vergeben werden.", unit: "Faktor", defaultValue: 1.0, source: "Modellannahme" }),
  budgetfitCeilingRatio: describe({ key: "budgetfitCeilingRatio", label: "Budgetfit — volle Punktzahl ab", description: "Verhältnis Gesamtinvestition/max. Budget, ab dem die volle Punktzahl vergeben wird.", unit: "Faktor", defaultValue: 0.8, source: "Modellannahme" }),

  formTopografieFloor: describe({ key: "formTopografieFloor", label: "Form/Topografie — 0 Punkte ab", description: "Produkt aus Geometrie- und Topografiefaktor, bei dem 0 Punkte vergeben werden.", unit: "Faktor", defaultValue: 0.7, source: "Modellannahme" }),
  formTopografieCeiling: describe({ key: "formTopografieCeiling", label: "Form/Topografie — volle Punktzahl ab", description: "Produkt aus Geometrie- und Topografiefaktor, ab dem die volle Punktzahl vergeben wird.", unit: "Faktor", defaultValue: 1.0, source: "Modellannahme" }),

  projektgroesseToleranceBelow: describe({ key: "projektgroesseToleranceBelow", label: "Projektgrösse — Toleranz unter Zielbereich", description: "Abstand unter dem minimalen Zielwert, ab dem 0 Punkte vergeben werden.", unit: "m² NRA", defaultValue: 300, source: "Modellannahme" }),
  projektgroesseToleranceAbove: describe({ key: "projektgroesseToleranceAbove", label: "Projektgrösse — Toleranz über Zielbereich", description: "Abstand über dem maximalen Zielwert, ab dem 0 Punkte vergeben werden.", unit: "m² NRA", defaultValue: 300, source: "Modellannahme" }),

  vacancyFloorPct: describe({ key: "vacancyFloorPct", label: "Leerstand — 0 Punkte ab", description: "Leerstandsquote, bei der 0 Punkte vergeben werden.", unit: "%", defaultValue: 2.0, source: "Modellannahme" }),
  vacancyCeilingPct: describe({ key: "vacancyCeilingPct", label: "Leerstand — volle Punktzahl ab", description: "Leerstandsquote, ab der die volle Punktzahl vergeben wird.", unit: "%", defaultValue: 0.3, source: "Modellannahme" }),

  populationGrowthFloorPct: describe({ key: "populationGrowthFloorPct", label: "Bevölkerungswachstum — 0 Punkte ab", description: "Bevölkerungsentwicklung über 3 Jahre, bei der 0 Punkte vergeben werden.", unit: "%", defaultValue: 0, source: "Modellannahme" }),
  populationGrowthCeilingPct: describe({ key: "populationGrowthCeilingPct", label: "Bevölkerungswachstum — volle Punktzahl ab", description: "Bevölkerungsentwicklung über 3 Jahre, ab der die volle Punktzahl vergeben wird.", unit: "%", defaultValue: 8, source: "Modellannahme" }),

  mietniveauFloorRatio: describe({ key: "mietniveauFloorRatio", label: "Mietniveau — 0 Punkte ab", description: "Verhältnis lokale Median-Miete zu kantonaler Referenzmiete, bei dem 0 Punkte vergeben werden.", unit: "Faktor", defaultValue: 0.85, source: "Modellannahme" }),
  mietniveauCeilingRatio: describe({ key: "mietniveauCeilingRatio", label: "Mietniveau — volle Punktzahl ab", description: "Verhältnis lokale Median-Miete zu kantonaler Referenzmiete, ab dem die volle Punktzahl vergeben wird.", unit: "Faktor", defaultValue: 1.15, source: "Modellannahme" }),

  bautaetigkeitFloorPct: describe({ key: "bautaetigkeitFloorPct", label: "Bautätigkeit — 0 Punkte ab", description: "Verhältnis Neubauten pro Jahr zu Bestand, bei dem 0 Punkte vergeben werden.", unit: "%", defaultValue: 3.0, source: "Modellannahme" }),
  bautaetigkeitCeilingPct: describe({ key: "bautaetigkeitCeilingPct", label: "Bautätigkeit — volle Punktzahl ab", description: "Verhältnis Neubauten pro Jahr zu Bestand, ab dem die volle Punktzahl vergeben wird.", unit: "%", defaultValue: 0.5, source: "Modellannahme" }),

  erreichbarkeitFloor: describe({ key: "erreichbarkeitFloor", label: "Erreichbarkeit — 0 Punkte ab", description: "Innert 30 Min. erreichbare Einwohner, bei denen 0 Punkte vergeben werden.", unit: "Personen", defaultValue: 50_000, source: "Modellannahme" }),
  erreichbarkeitCeiling: describe({ key: "erreichbarkeitCeiling", label: "Erreichbarkeit — volle Punktzahl ab", description: "Innert 30 Min. erreichbare Einwohner, ab denen die volle Punktzahl vergeben wird.", unit: "Personen", defaultValue: 500_000, source: "Modellannahme" }),
} as const;

// ---------------------------------------------------------------------------
// Risikoabzüge (Abschnitt 15, "Risikoabzüge:"-Liste ohne im Masterdokument
// vorgegebene Punktwerte — hier explizit benannt und begrenzt auf risikoMax).
// ---------------------------------------------------------------------------
export const RISK_DEDUCTIONS = {
  altlasten: describe({ key: "altlasten", label: "Altlasten", description: "Abzug, wenn ein belasteter Standort (KbS) vorliegt und nicht extern ausgeschlossen ist.", unit: "Punkte", defaultValue: 3, source: "Abschnitt 15" }),
  naturgefahren: describe({ key: "naturgefahren", label: "Naturgefahren", description: "Abzug bei erhöhtem Naturgefahrenrisiko (z.B. Hochwasser, Rutschung).", unit: "Punkte", defaultValue: 3, source: "Abschnitt 15" }),
  gewaesser: describe({ key: "gewaesser", label: "Gewässer", description: "Abzug bei Einschränkung durch Gewässerraum.", unit: "Punkte", defaultValue: 1.5, source: "Abschnitt 15" }),
  laerm: describe({ key: "laerm", label: "Lärm", description: "Abzug bei Grenzwertüberschreitung.", unit: "Punkte", defaultValue: 1.5, source: "Abschnitt 15" }),
  planungszone: describe({ key: "planungszone", label: "Planungszone", description: "Abzug, wenn das Objekt oder die Nachbarschaft in einer Planungszone liegt.", unit: "Punkte", defaultValue: 1, source: "Abschnitt 15" }),
  zufahrt: describe({ key: "zufahrt", label: "Zufahrt", description: "Abzug bei ungesicherter oder gemeinsamer Zufahrt.", unit: "Punkte", defaultValue: 1, source: "Abschnitt 15" }),
  erschliessung: describe({ key: "erschliessung", label: "Erschliessung", description: "Abzug bei unvollständiger Erschliessung.", unit: "Punkte", defaultValue: 1.5, source: "Abschnitt 15" }),
  baukostenrisiken: describe({ key: "baukostenrisiken", label: "Baukostenrisiken", description: "Abzug, wenn Baukosten nur geschätzt und extern nicht bestätigt sind.", unit: "Punkte", defaultValue: 1, source: "Abschnitt 15" }),
} as const;

// ---------------------------------------------------------------------------
// Datenvertrauens-Gewichte (Abschnitt 16) — im Masterdokument exakt vorgegeben.
// ---------------------------------------------------------------------------
export const CONFIDENCE_WEIGHTS = {
  adresseParzelle: describe({ key: "adresseParzelle", label: "Adresse/Parzelle", description: "Anteil am Datenvertrauens-Score.", unit: "Punkte", defaultValue: 15, source: "Abschnitt 16" }),
  zoneBauparameter: describe({ key: "zoneBauparameter", label: "Zone/Bauparameter", description: "Anteil am Datenvertrauens-Score.", unit: "Punkte", defaultValue: 25, source: "Abschnitt 16" }),
  risikenOereb: describe({ key: "risikenOereb", label: "Risiken/ÖREB", description: "Anteil am Datenvertrauens-Score.", unit: "Punkte", defaultValue: 15, source: "Abschnitt 16" }),
  mietdaten: describe({ key: "mietdaten", label: "Mietdaten", description: "Anteil am Datenvertrauens-Score.", unit: "Punkte", defaultValue: 15, source: "Abschnitt 16" }),
  baukosten: describe({ key: "baukosten", label: "Baukosten", description: "Anteil am Datenvertrauens-Score.", unit: "Punkte", defaultValue: 15, source: "Abschnitt 16" }),
  inseratsvollstaendigkeit: describe({ key: "inseratsvollstaendigkeit", label: "Inseratsvollständigkeit", description: "Anteil am Datenvertrauens-Score.", unit: "Punkte", defaultValue: 10, source: "Abschnitt 16" }),
  finanzierung: describe({ key: "finanzierung", label: "Finanzierung", description: "Anteil am Datenvertrauens-Score.", unit: "Punkte", defaultValue: 5, source: "Abschnitt 16" }),
} as const;

// ---------------------------------------------------------------------------
// Empfehlungslogik (Abschnitt 18) — die Alert-Schwellen (thresholdA/B,
// minDataConfidence) kommen aus dem Suchprofil; diese Parameter sind zusätzliche,
// im Masterdokument nicht explizit bezifferte Modellannahmen.
// ---------------------------------------------------------------------------
export const EMPFEHLUNG_PARAMETERS = {
  beobachtenBandwidth: describe({ key: "beobachtenBandwidth", label: "Beobachten/Verhandeln — Bandbreite unter Schwelle B", description: "Score-Punkte unterhalb der Schwelle B, für die noch \"Beobachten/verhandeln\" statt \"Nicht weiterverfolgen\" empfohlen wird.", unit: "Punkte", defaultValue: 15, source: "Modellannahme" }),
  potentialAConfidenceFloor: describe({ key: "potentialAConfidenceFloor", label: "Potenzial-A — Mindestvertrauen für \"Sofort prüfen\"", description: "Ab diesem Datenvertrauen wird ein A-Treffer als \"Sofort prüfen\" statt \"Potenzial – dringend verifizieren\" gemeldet.", unit: "Punkte (0-100)", defaultValue: 80, source: "Modellannahme, angelehnt an Abschnitt 16 (\"hoch\")" }),
} as const;

export type ScoreWeightValues = ValuesOf<typeof SCORE_WEIGHTS>;
export type ScoreBandValues = ValuesOf<typeof SCORE_BANDS>;
export type RiskDeductionValues = ValuesOf<typeof RISK_DEDUCTIONS>;
export type ConfidenceWeightValues = ValuesOf<typeof CONFIDENCE_WEIGHTS>;
export type EmpfehlungParameterValues = ValuesOf<typeof EMPFEHLUNG_PARAMETERS>;
