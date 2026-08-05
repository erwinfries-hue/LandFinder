export interface ValueChange {
  previous: number;
  current: number;
  deltaAbsolute: number;
  deltaPercent: number;
}

/** Für "Preis- und Scoreveränderung" (Abschnitt 20) — generisch für beide nutzbar. */
export function computeChange(previous: number, current: number): ValueChange {
  const deltaAbsolute = current - previous;
  const deltaPercent = previous !== 0 ? (deltaAbsolute / previous) * 100 : 0;
  return { previous, current, deltaAbsolute, deltaPercent };
}
