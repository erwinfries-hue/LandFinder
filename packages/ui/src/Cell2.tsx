import type { ReactNode } from "react";

/** Generische zweizeilige Tabellenzelle: Wert gross oben, Beschriftung klein darunter. */
export function Cell2({ top, bottom, mono = false }: { top: ReactNode; bottom: ReactNode; mono?: boolean }) {
  return (
    <div className="cell2">
      <span className={mono ? "top mono" : "top"}>{top}</span>
      <span className={mono ? "bottom mono" : "bottom"}>{bottom}</span>
    </div>
  );
}
