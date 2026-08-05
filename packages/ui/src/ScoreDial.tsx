export type DialTone = "good" | "accent" | "warn" | "neutral";

const toneVar: Record<DialTone, string> = {
  good: "var(--good)",
  accent: "var(--accent)",
  warn: "var(--warn)",
  neutral: "var(--neutral-ink)",
};

/** Radialer Score-/Vertrauens-Indikator, angelehnt an ein Theodolit-Zifferblatt. */
export function ScoreDial({
  value,
  tone,
  size = 26,
}: {
  value: number;
  tone: DialTone;
  size?: number;
}) {
  const r = size / 2 - 2.5;
  const circumference = 2 * Math.PI * r;
  const filled = (value / 100) * circumference;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3" />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={toneVar[tone]}
        strokeWidth="3"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}

/** Grosse Variante mit Zahl im Zentrum, für die Objekt-Detailseite. */
export function ScoreDialLarge({
  value,
  tone,
  size = 64,
}: {
  value: number;
  tone: DialTone;
  size?: number;
}) {
  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;
  const filled = (value / 100) * circumference;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={toneVar[tone]}
        strokeWidth="6"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text
        x={center}
        y={center + 6}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="17"
        fontWeight={600}
        fill="var(--ink)"
      >
        {value}
      </text>
    </svg>
  );
}
