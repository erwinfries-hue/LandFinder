import type { ReactNode } from "react";

export type ChipTone = "good" | "warn" | "bad" | "neutral" | "accent";

/** `title` zeigt den vollen Begriff per Hover — nützlich, wenn `children` bewusst abgekürzt ist (z.B. in schmalen Tabellenspalten). */
export function Chip({ tone, title, children }: { tone: ChipTone; title?: string; children: ReactNode }) {
  return (
    <span className={`chip ${tone}`} title={title}>
      {children}
    </span>
  );
}
