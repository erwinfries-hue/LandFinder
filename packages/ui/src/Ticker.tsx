export type TickerItem = {
  value: number | string;
  label: string;
  sub?: string;
  color?: string;
};

/** Ruhig laufendes KPI-Laufband für den Dashboard-Header. Pausiert bei Hover und bei prefers-reduced-motion. */
export function Ticker({ items }: { items: TickerItem[] }) {
  const group = (hidden: boolean) => (
    <div className={hidden ? "ticker-group ticker-dup" : "ticker-group"} aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "contents" }}>
          <div className="tick-item">
            <span className="tick-n" style={item.color ? { color: item.color } : undefined}>
              {item.value}
            </span>
            <span className="tick-l">{item.label}</span>
            {item.sub ? <span className="tick-s">{item.sub}</span> : null}
          </div>
          <span className="tick-sep">│</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="ticker" role="group" aria-label="Kennzahlen im Überblick">
      <div className="ticker-track">
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}
