import type { ReactNode } from "react";

export function Metric({
  l,
  v,
  sub,
  valueColor,
  subColor,
}: {
  l: string;
  v: string;
  sub?: ReactNode;
  valueColor?: string;
  subColor?: string;
}) {
  return (
    <div className="metric">
      <div className="l">{l}</div>
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

export function StressRow({ label, base, stress }: { label: string; base: string; stress: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num mono">{base}</td>
      <td className="num mono">{stress}</td>
    </tr>
  );
}
