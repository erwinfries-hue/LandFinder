import type { ReactNode } from "react";
import { InfoHint } from "@landfinder/ui";

export function Metric({
  l,
  v,
  sub,
  hint,
  valueColor,
  subColor,
}: {
  l: string;
  v: string;
  sub?: ReactNode;
  /** Erklärt per Hover, was der Wert bedeutet und/oder wie er berechnet wird. */
  hint?: string;
  valueColor?: string;
  subColor?: string;
}) {
  return (
    <div className="metric">
      <div className="l">
        {l}
        {hint ? <InfoHint text={hint} /> : null}
      </div>
      <div className="v" style={valueColor ? { color: valueColor } : undefined}>
        {v}
      </div>
      {sub ? (
        <div className="sub" style={subColor ? { color: subColor } : undefined}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}
