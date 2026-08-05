export type EmpfehlungKlasse = "A" | "B" | "C";

const toneVar: Record<EmpfehlungKlasse, string> = {
  A: "var(--good)",
  B: "var(--accent)",
  C: "var(--warn)",
};

/**
 * Zweizeilige Empfehlungs-Zelle: Klasse (A/B/C) gross oben, ein Wort klein darunter.
 * A = Sofort prüfen, B = Weiterverfolgen, C = Verifizieren / Beobachten.
 */
export function EmpfehlungBadge({
  klasse,
  wort,
  farbe = toneVar[klasse],
}: {
  klasse: EmpfehlungKlasse;
  wort: string;
  farbe?: string;
}) {
  return (
    <div className="cell2">
      <span className="top" style={{ color: farbe }}>
        {klasse}
      </span>
      <span className="bottom">{wort}</span>
    </div>
  );
}
