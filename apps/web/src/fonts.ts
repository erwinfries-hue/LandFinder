import localFont from "next/font/local";

/** Editorielle Display-Serife für Überschriften und die Kernaussage. */
export const fontDisplay = localFont({
  src: [
    { path: "./fonts/Newsreader-Display-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Newsreader-Display-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Newsreader-Text-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Newsreader-Italic-500.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["ui-serif", "Georgia", "serif"],
});

/** Zivil-amtlicher UI-Text. */
export const fontBody = localFont({
  src: [
    { path: "./fonts/PublicSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/PublicSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/PublicSans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/PublicSans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

/** Zahlen, Koordinaten, Kennzahlen — tabular figures. */
export const fontMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});
