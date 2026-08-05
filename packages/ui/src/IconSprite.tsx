import type { CSSProperties } from "react";

/**
 * Handgezeichnetes Icon-Set (Grenzstein, Triangulation, Parzelle, Kompass, ...) statt Emoji.
 * Einmal pro Seite rendern (z.B. im Root-Layout), danach per <Icon name="..."/> referenzieren.
 */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-mark" viewBox="0 0 24 24">
          <path d="M12 3l7 4v6l-7 8-7-8V7z" />
          <circle cx="12" cy="10.5" r="1.4" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-plot" viewBox="0 0 24 24">
          <rect x="3.5" y="6" width="17" height="13" strokeDasharray="2.2 2.2" />
          <path d="M2 19h20" />
        </symbol>
        <symbol id="i-tri" viewBox="0 0 24 24">
          <path d="M12 4l9 16H3z" />
          <circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-contour" viewBox="0 0 24 24">
          <path d="M2 17c3-4 5 3 8 0s5-6 8-2" />
          <path d="M2 12c3-3 5 2 8 0s5-4 8-1" />
        </symbol>
        <symbol id="i-compass" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M14.5 9.5 12 14l-2.5-.5L12 9z" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-import" viewBox="0 0 24 24">
          <path d="M12 4v11" />
          <path d="M8 12l4 4 4-4" />
          <path d="M4 19h16" />
        </symbol>
        <symbol id="i-mail" viewBox="0 0 24 24">
          <rect x="3" y="5.5" width="18" height="13" rx="1" />
          <path d="M4 7l8 6 8-6" />
        </symbol>
        <symbol id="i-check" viewBox="0 0 24 24">
          <path d="M4 12.5l5 5L20 6.5" />
        </symbol>
        <symbol id="i-alert" viewBox="0 0 24 24">
          <path d="M12 4 2 20h20z" />
          <path d="M12 10.5v4" />
          <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="i-grid" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </symbol>
        <symbol id="i-scale" viewBox="0 0 24 24">
          <path d="M4 20h16" />
          <path d="M12 4v16" />
          <path d="M5 8h6M13 8h6" />
          <path d="M5 8l-2.5 5.5a2.6 2.6 0 0 0 5 0z" />
          <path d="M19 8l-2.5 5.5a2.6 2.6 0 0 0 5 0z" />
        </symbol>
        <symbol id="i-doc" viewBox="0 0 24 24">
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4" />
          <path d="M9 12h7M9 15.5h7M9 8.5h3" />
        </symbol>
      </defs>
    </svg>
  );
}

export type IconName =
  | "mark"
  | "plot"
  | "tri"
  | "contour"
  | "compass"
  | "import"
  | "mail"
  | "check"
  | "alert"
  | "grid"
  | "scale"
  | "doc";

export function Icon({
  name,
  width = 16,
  className,
  style,
}: {
  name: IconName;
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={["icon", className].filter(Boolean).join(" ")}
      width={width}
      height={width}
      style={style}
      aria-hidden="true"
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}
