/**
 * Value-Add-Analysen für Möblierung und Renovation — bewusst als eigenes Modul
 * (Rückmeldung 2026-08-16: "von Anfang an als eigene Module bauen", da möblierte/
 * mittelfristige Vermietung ein mögliches Differenzierungsmerkmal von Home4efFinder
 * ist). Beantwortet: lohnt sich die Zusatzinvestition (Möblierung/Renovation)
 * überhaupt, gemessen am dadurch erzielbaren Mehrertrag?
 */

export interface ValueAddRoiResult {
  zusaetzlicherJahresertragChf: number;
  roiPercent: number;
  /** `undefined`, wenn kein Mehrertrag entsteht (Payback wäre unendlich). */
  paybackYears: number | undefined;
}

export function calculateValueAddRoi(investmentChf: number, zusaetzlicherJahresertragChf: number): ValueAddRoiResult {
  const roiPercent = investmentChf > 0 ? (zusaetzlicherJahresertragChf / investmentChf) * 100 : 0;
  const paybackYears = zusaetzlicherJahresertragChf > 0 ? investmentChf / zusaetzlicherJahresertragChf : undefined;
  return { zusaetzlicherJahresertragChf, roiPercent, paybackYears };
}

export interface RenovationRoiInput {
  renovationCostChf: number;
  mieteVorherChfPerMonth: number;
  mieteNachherChfPerMonth: number;
}

/** "Renovation ROI": Mehrertrag aus höherer erzielbarer Miete nach Renovation ÷ Renovationskosten. */
export function calculateRenovationRoi(input: RenovationRoiInput): ValueAddRoiResult {
  const deltaChfPerMonth = input.mieteNachherChfPerMonth - input.mieteVorherChfPerMonth;
  return calculateValueAddRoi(input.renovationCostChf, deltaChfPerMonth * 12);
}

// ---------------------------------------------------------------------------
// Möblierungs-Lebenszyklus — für die Mehrjahresrechnung: kein geglätteter
// Jahresbetrag, sondern ein konkreter Cash-Abfluss im Ersatzjahr (Rückmeldung:
// "für die Mehrjahresrechnung würde ich tatsächlich den Cash-Abfluss im Ersatzjahr
// rechnen"). `moeblierungGeglaetteReserveChfPerJahr` bleibt als informative,
// geglättete Zusatzansicht verfügbar, ist aber nicht die Grundlage der 15-Jahres-
// Cashflows.
// ---------------------------------------------------------------------------

export interface MoeblierungLebenszyklusInput {
  initialCostChf: number;
  nutzungsdauerJahre: number;
  /** Anteil der (inflationierten) Initialkosten, der bei einem Ersatz tatsächlich erneut anfällt — selten 100%, da z.B. Grundausstattung teils weiterverwendet wird. */
  ersatzquotePercent: number;
  kostensteigerungPercentPerYear: number;
}

/** Geglättete jährliche Reserve — rein informativ, siehe Modulkopf. */
export function moeblierungGeglaetteReserveChfPerJahr(input: MoeblierungLebenszyklusInput): number {
  if (input.nutzungsdauerJahre <= 0) return 0;
  return (input.initialCostChf * (input.ersatzquotePercent / 100)) / input.nutzungsdauerJahre;
}

/**
 * Tatsächlicher Ersatz-Cashout für ein gegebenes Jahr (1-indexiert, Jahr 0 ist die
 * Initialinvestition selbst und wird hier nicht behandelt) — 0 in allen Jahren ohne
 * fälligen Ersatz, sonst die auf dieses Jahr hochgerechneten (inflationierten)
 * Ersatzkosten.
 */
export function moeblierungErsatzCashflowChf(input: MoeblierungLebenszyklusInput, jahr: number): number {
  if (input.nutzungsdauerJahre <= 0 || jahr <= 0 || jahr % input.nutzungsdauerJahre !== 0) return 0;
  const basiskostenChf = input.initialCostChf * (input.ersatzquotePercent / 100);
  return basiskostenChf * Math.pow(1 + input.kostensteigerungPercentPerYear / 100, jahr);
}

// ---------------------------------------------------------------------------
// Renovationspositionen — typisiert nach steuerlicher Kategorie (Rückmeldung: die KI
// kann eine Einstufung vorschlagen, entscheiden/bestätigen muss der Nutzer).
// ---------------------------------------------------------------------------

export type RenovationKategorie = "WERTERHALTEND" | "WERTVERMEHREND" | "ENERGETISCH";
export type SteuerlicheAbzugsfaehigkeit = "JA" | "NEIN" | "UNKLAR";

export interface RenovationPosition {
  betragChf: number;
  kategorie: RenovationKategorie;
  jahr: number;
  steuerlicheAbzugsfaehigkeit: SteuerlicheAbzugsfaehigkeit;
  beschreibung?: string;
}

export interface RenovationPositionenSummary {
  totalChf: number;
  totalByKategorie: Record<RenovationKategorie, number>;
}

/** Reine Summierung, keine steuerliche Bewertung — siehe Modulkopf. */
export function summarizeRenovationPositionen(positionen: RenovationPosition[]): RenovationPositionenSummary {
  const totalByKategorie: Record<RenovationKategorie, number> = { WERTERHALTEND: 0, WERTVERMEHREND: 0, ENERGETISCH: 0 };
  let totalChf = 0;
  for (const p of positionen) {
    totalByKategorie[p.kategorie] += p.betragChf;
    totalChf += p.betragChf;
  }
  return { totalChf, totalByKategorie };
}
