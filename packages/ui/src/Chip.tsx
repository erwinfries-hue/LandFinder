import type { ReactNode } from "react";

export type ChipTone = "good" | "warn" | "bad" | "neutral" | "accent";

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}
