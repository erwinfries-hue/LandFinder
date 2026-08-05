import type { HTMLAttributes } from "react";

/** Dokument-Panel mit Registrierungsmarke oben links (statt bunter Karte mit Seitenleiste). */
export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["panel", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}
