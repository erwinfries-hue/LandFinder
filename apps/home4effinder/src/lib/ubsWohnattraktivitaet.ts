/**
 * UBS Wohnattraktivitätsindikator 2026 (Medienmitteilung UBS Switzerland AG, 27. August
 * 2026, CIO GWM) — rein informativer Kontext zur Standortqualität einer Gemeinde für
 * eine Familie mit zwei Kindern und Ø-Einkommen, KEIN Bestandteil irgendeiner
 * Rendite-/Cashflow-Berechnung.
 *
 * Die Mitteilung selbst enthält nur eine Handvoll namentlich genannter Gemeinden (Top-3
 * je Region + einige qualitative Beispielgruppen) — die vollständige Rangliste aller
 * Schweizer Gemeinden liegt laut Mitteilung unter www.ubs.com/gemeinderanking, das war
 * in dieser Umgebung aber nicht abrufbar (Netzwerk-Egress blockiert `www.ubs.com`).
 * Diese Liste enthält daher bewusst NUR die im Dokument selbst namentlich genannten
 * ~48 Gemeinden ("nichts wird erfunden") — für alle übrigen Gemeinden liefert
 * `findUbsWohnattraktivitaet` bewusst `undefined` statt eines geschätzten Werts.
 */

export type UbsWohnattraktivitaetKategorie = "TOP3" | "AGGLOMERATION" | "RAND_LAND" | "STEUERGUENSTIG" | "BEZAHLBARES_KLEINZENTRUM";

export interface UbsWohnattraktivitaetEintrag {
  /** Anzeigename wie in der UBS-Mitteilung. */
  gemeinde: string;
  /** Namensvarianten für den Abgleich gegen `property.gemeinde` (Kleinschreibung, siehe normalizeGemeindeName). */
  aliases: string[];
  canton: string;
  /** UBS-Arbeitsmarktgrossregion (nur bei TOP3 relevant). */
  region?: string;
  kategorie: UbsWohnattraktivitaetKategorie;
  /** Nur bei kategorie === "TOP3": Rang 1-3 innerhalb der Region. */
  rangInRegion?: 1 | 2 | 3;
}

// Top-3-Gemeinden je der zehn UBS-Regionen (Wohnattraktivitätsindikator, Haushalt mit
// Ø-Einkommen und zwei Kindern) — aus der Grafik "Top-Drei-Gemeinden in den zehn
// Regionen" der Mitteilung.
const TOP3: UbsWohnattraktivitaetEintrag[] = [
  { gemeinde: "Solothurn", aliases: ["solothurn"], canton: "SO", region: "Jura-Seeland-Solothurn", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Biel/Bienne", aliases: ["biel", "bienne", "biel/bienne"], canton: "BE", region: "Jura-Seeland-Solothurn", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Neuchâtel", aliases: ["neuchatel", "neuchâtel"], canton: "NE", region: "Jura-Seeland-Solothurn", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Aarau", aliases: ["aarau"], canton: "AG", region: "Zürich-Aarau-Schaffhausen", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Baden", aliases: ["baden"], canton: "AG", region: "Zürich-Aarau-Schaffhausen", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Schaffhausen", aliases: ["schaffhausen"], canton: "SH", region: "Zürich-Aarau-Schaffhausen", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Basel", aliases: ["basel"], canton: "BS", region: "Basel", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Riehen", aliases: ["riehen"], canton: "BS", region: "Basel", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Bettingen", aliases: ["bettingen"], canton: "BS", region: "Basel", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "St. Gallen", aliases: ["st. gallen", "st gallen", "sankt gallen"], canton: "SG", region: "Bodensee", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Wil (SG)", aliases: ["wil", "wil (sg)", "wil sg"], canton: "SG", region: "Bodensee", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Teufen (AR)", aliases: ["teufen", "teufen (ar)", "teufen ar"], canton: "AR", region: "Bodensee", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Vevey", aliases: ["vevey"], canton: "VD", region: "Genève-Lausanne", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Lausanne", aliases: ["lausanne"], canton: "VD", region: "Genève-Lausanne", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Morges", aliases: ["morges"], canton: "VD", region: "Genève-Lausanne", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Sion", aliases: ["sion"], canton: "VS", region: "Westalpen", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Martigny", aliases: ["martigny"], canton: "VS", region: "Westalpen", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Conthey", aliases: ["conthey"], canton: "VS", region: "Westalpen", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Fribourg", aliases: ["fribourg", "freiburg"], canton: "FR", region: "Bern-Fribourg", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Murten", aliases: ["murten", "morat"], canton: "FR", region: "Bern-Fribourg", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Bern", aliases: ["bern"], canton: "BE", region: "Bern-Fribourg", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Luzern", aliases: ["luzern"], canton: "LU", region: "Zentralschweiz", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Zug", aliases: ["zug"], canton: "ZG", region: "Zentralschweiz", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Schwyz", aliases: ["schwyz"], canton: "SZ", region: "Zentralschweiz", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Lugano", aliases: ["lugano"], canton: "TI", region: "Tessin", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Locarno", aliases: ["locarno"], canton: "TI", region: "Tessin", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Tenero-Contra", aliases: ["tenero-contra", "tenero"], canton: "TI", region: "Tessin", kategorie: "TOP3", rangInRegion: 3 },
  { gemeinde: "Chur", aliases: ["chur"], canton: "GR", region: "Ostalpen", kategorie: "TOP3", rangInRegion: 1 },
  { gemeinde: "Quarten", aliases: ["quarten"], canton: "SG", region: "Ostalpen", kategorie: "TOP3", rangInRegion: 2 },
  { gemeinde: "Vaz/Obervaz", aliases: ["vaz/obervaz", "vaz", "obervaz"], canton: "GR", region: "Ostalpen", kategorie: "TOP3", rangInRegion: 3 },
];

// Weitere in der Mitteilung namentlich genannte Gemeinden (ohne Rang, nur als
// Beispiele der jeweiligen Gruppe) — aus dem Fliesstext "Zusammenspiel verschiedener
// Standortfaktoren ist entscheidend" (Morges ist bereits oben unter TOP3 erfasst).
const SONSTIGE: UbsWohnattraktivitaetEintrag[] = [
  { gemeinde: "Zollikon", aliases: ["zollikon"], canton: "ZH", kategorie: "AGGLOMERATION" },
  { gemeinde: "Baar", aliases: ["baar"], canton: "ZG", kategorie: "AGGLOMERATION" },
  { gemeinde: "Granges-Paccot", aliases: ["granges-paccot", "granges paccot"], canton: "FR", kategorie: "AGGLOMERATION" },
  { gemeinde: "Gaiserwald", aliases: ["gaiserwald"], canton: "SG", kategorie: "AGGLOMERATION" },
  { gemeinde: "La Roche", aliases: ["la roche"], canton: "FR", kategorie: "RAND_LAND" },
  { gemeinde: "Düdingen", aliases: ["düdingen", "duedingen", "dudingen"], canton: "FR", kategorie: "RAND_LAND" },
  { gemeinde: "Erlach", aliases: ["erlach"], canton: "BE", kategorie: "RAND_LAND" },
  { gemeinde: "Sissach", aliases: ["sissach"], canton: "BL", kategorie: "RAND_LAND" },
  { gemeinde: "Walenstadt", aliases: ["walenstadt"], canton: "SG", kategorie: "RAND_LAND" },
  { gemeinde: "Freienbach", aliases: ["freienbach"], canton: "SZ", kategorie: "STEUERGUENSTIG" },
  { gemeinde: "Cologny", aliases: ["cologny"], canton: "GE", kategorie: "STEUERGUENSTIG" },
  { gemeinde: "Appenzell", aliases: ["appenzell"], canton: "AI", kategorie: "STEUERGUENSTIG" },
  { gemeinde: "St. Moritz", aliases: ["st. moritz", "st moritz", "sankt moritz"], canton: "GR", kategorie: "STEUERGUENSTIG" },
  { gemeinde: "Paradiso", aliases: ["paradiso"], canton: "TI", kategorie: "STEUERGUENSTIG" },
  { gemeinde: "Grenchen", aliases: ["grenchen"], canton: "SO", kategorie: "BEZAHLBARES_KLEINZENTRUM" },
  { gemeinde: "Langenthal", aliases: ["langenthal"], canton: "BE", kategorie: "BEZAHLBARES_KLEINZENTRUM" },
  { gemeinde: "Zofingen", aliases: ["zofingen"], canton: "AG", kategorie: "BEZAHLBARES_KLEINZENTRUM" },
  { gemeinde: "Wattwil", aliases: ["wattwil"], canton: "SG", kategorie: "BEZAHLBARES_KLEINZENTRUM" },
  { gemeinde: "Thusis", aliases: ["thusis"], canton: "GR", kategorie: "BEZAHLBARES_KLEINZENTRUM" },
];

export const UBS_WOHNATTRAKTIVITAET_2026: UbsWohnattraktivitaetEintrag[] = [...TOP3, ...SONSTIGE];

function normalizeGemeindeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Gleicht Kanton + Gemeinde eines Objekts gegen die in der UBS-Mitteilung namentlich
 * genannten Gemeinden ab — `undefined`, wenn keine Übereinstimmung existiert (deckt nur
 * die ~48 in der Mitteilung genannten von ~2000 Schweizer Gemeinden ab, siehe oben).
 */
export function findUbsWohnattraktivitaet(canton: string | null | undefined, gemeinde: string | null | undefined): UbsWohnattraktivitaetEintrag | undefined {
  if (!canton || !gemeinde) return undefined;
  const normalizedGemeinde = normalizeGemeindeName(gemeinde);
  const normalizedCanton = canton.trim().toUpperCase();
  return UBS_WOHNATTRAKTIVITAET_2026.find((e) => e.canton === normalizedCanton && e.aliases.includes(normalizedGemeinde));
}

/** Kurzer Anzeigetext für UI/PDF — eine Zeile, ohne Wertung über den Eintrag hinaus. */
export function formatUbsWohnattraktivitaetHinweis(eintrag: UbsWohnattraktivitaetEintrag): string {
  switch (eintrag.kategorie) {
    case "TOP3":
      return `UBS Wohnattraktivitätsindikator 2026: Platz ${eintrag.rangInRegion} von 3 in der Region ${eintrag.region} (Haushalt mit zwei Kindern, Ø-Einkommen).`;
    case "AGGLOMERATION":
      return "UBS Wohnattraktivitätsindikator 2026: als attraktive Agglomerationsgemeinde genannt (gute Erreichbarkeit, tiefere Steuern/Wohnkosten als Nachbarzentrum).";
    case "RAND_LAND":
      return "UBS Wohnattraktivitätsindikator 2026: als attraktive Agglomerationsrand-/Landgemeinde genannt (hohe Lebensqualität, vergleichsweise tiefe Wohnkosten).";
    case "STEUERGUENSTIG":
      return "UBS Wohnattraktivitätsindikator 2026: als steuergünstige Gemeinde für Haushalte mit hohem Einkommen genannt.";
    case "BEZAHLBARES_KLEINZENTRUM":
      return "UBS Wohnattraktivitätsindikator 2026: als bezahlbares Kleinzentrum für Haushalte mit tieferem Einkommen genannt.";
  }
}
