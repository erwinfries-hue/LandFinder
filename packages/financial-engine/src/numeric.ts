/**
 * Generische numerische Hilfsfunktionen für die Bestandsrendite-Mehrjahresrechnung
 * (`bestandsrenditeMehrjahresmodell.ts`) und die Break-even-Werte der Investment-Case-
 * Rechnung (`bestandsrendite.ts`). Bewusst per Bisektion statt Newton-Raphson/
 * geschlossener Formel — kein Ableitungscode nötig und robust für die hier typischen,
 * monotonen Zusammenhänge (z.B. "mehr Miete → mehr Cashflow"). Passt zum
 * MVP-Anspruch ("nicht institutionelles Niveau", Rückmeldung 2026-08-16).
 */

/** Sucht `x` in `[lo, hi]`, für das `fn(x) ≈ 0` — vorausgesetzt `fn` wechselt im Intervall das Vorzeichen. */
export function bisectRoot(fn: (x: number) => number, lo: number, hi: number, maxIterations = 200): number | undefined {
  let low = lo;
  let high = hi;
  let fLow = fn(low);
  const fHigh = fn(high);
  if (Math.abs(fLow) < 1e-6) return low;
  if (Math.abs(fHigh) < 1e-6) return high;
  if (Math.sign(fLow) === Math.sign(fHigh)) return undefined;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const fMid = fn(mid);
    if (Math.abs(fMid) < 0.01) return mid;
    if (Math.sign(fMid) === Math.sign(fLow)) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

export function netPresentValue(cashflows: number[], ratePercent: number): number {
  const rate = ratePercent / 100;
  return cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}

/**
 * Interner Zinsfuss über eine Cashflow-Reihe (`cashflows[0]` typischerweise die
 * negative Anfangsinvestition in Periode 0). `undefined`, wenn im Suchbereich
 * [-99%, 1000%] kein Vorzeichenwechsel liegt (z.B. durchgehend positive/negative
 * Cashflows) — dann ist keine sinnvolle IRR definiert, statt eine falsche Zahl
 * zurückzugeben.
 */
export function internalRateOfReturn(cashflows: number[]): number | undefined {
  return bisectRoot((rate) => netPresentValue(cashflows, rate), -99, 1000);
}
