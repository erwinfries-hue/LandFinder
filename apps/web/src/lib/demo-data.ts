import type { DialTone } from "@landfinder/ui";

export type EmpfehlungKlasse = "A" | "B" | "C";

export type Objekt = {
  slug: string;
  adresse: string;
  ort: string;
  kanton: string;
  plz: string;
  parzelle: string;
  objektart: "Bauland" | "Abbruchobjekt";
  score: number;
  scoreTon: DialTone;
  vertrauen: number;
  vertrauenLabel: string;
  empfKlasse: EmpfehlungKlasse;
  empfWort: string;
  empfFarbe: string;
  flaecheM2: number;
  preisChf: number;
  preisProM2: number;
  yieldOnCost: number;
  /** Stufe-2-Vertiefung — nur vorhanden, wenn die Vertiefung bereits ausgeführt wurde. */
  vertiefung?: {
    egrid: string;
    zone: string;
    leadSummary: string;
    nraM2: number;
    nraVerifikation: "A" | "B" | "C";
    gesamtinvestitionChf: number;
    eigenkapitalbedarfChf: number;
    ltcProzent: number;
    dscrBase: number;
    dscrStress: number;
    residualwertChf: number;
    residualwertDiffChf: number;
    residualwertDiffProzent: number;
    positives: string[];
    negatives: string[];
    base: { nettomiete: string; baukosten: string; zinssatz: string; dscr: string; cashOnCash: string };
    stress: { nettomiete: string; baukosten: string; zinssatz: string; dscr: string; cashOnCash: string };
    baupotenzialMethode: string;
    baupotenzialVerifikation: string;
    rangKanton: number;
    totalKanton: number;
    perzentil: number;
    provenance: string[];
  };
};

// Demo-/Mock-Daten für den ohne produktive Credentials lauffähigen Demo-Modus
// (Abschnitt 3.1, Punkt 30 des Masterdokuments). Ersetzt in Phase 1/2 durch echte
// Analysen aus `analyses` (siehe Datenmodell, Abschnitt 24).
export const demoObjekte: Objekt[] = [
  {
    slug: "cham-chamerstrasse-2214",
    adresse: "Chamerstrasse",
    ort: "Cham",
    kanton: "ZG",
    plz: "6330",
    parzelle: "2214",
    objektart: "Bauland",
    score: 84,
    scoreTon: "good",
    vertrauen: 71,
    vertrauenLabel: "mittel",
    empfKlasse: "A",
    empfWort: "Prüfen",
    empfFarbe: "var(--good)",
    flaecheM2: 1860,
    preisChf: 3_450_000,
    preisProM2: 1855,
    yieldOnCost: 4.6,
    vertiefung: {
      egrid: "CH685284972",
      zone: "W3, amtlich bestätigt",
      leadSummary:
        "Attraktives Bauland in guter ÖV-Lage mit plausibilisiertem Baupotenzial; der Angebotspreis liegt rund 9.6 % unter dem Residualwert.",
      nraM2: 1340,
      nraVerifikation: "B",
      gesamtinvestitionChf: 8_240_000,
      eigenkapitalbedarfChf: 2_140_000,
      ltcProzent: 74,
      dscrBase: 1.32,
      dscrStress: 1.04,
      residualwertChf: 3_780_000,
      residualwertDiffChf: 330_000,
      residualwertDiffProzent: 9.6,
      // Bewusst ohne konkrete Zahlen (Residualwert-%, DSCR-Wert etc.) — diese werden
      // jetzt live berechnet (siehe LiveChamAnalysis.tsx) und würden hier sonst bei
      // jeder Annahmenänderung veralten. Qualitative Punkte bleiben stabil.
      positives: [
        "ÖV-Güteklasse B, 6 Min. zur S-Bahn Cham",
        "Leerstand Gemeinde 0.9 % — deutlich unter Kantonsschnitt",
        "Zone W3 amtlich bestätigt, Ausnützung 0.6 verifiziert (Stufe B)",
      ],
      negatives: [
        "Baukosten nur Inseratsangabe, extern noch nicht bestätigt",
        "Zufahrt über gemeinsames Erschliessungsrecht, ÖREB ausstehend",
        "Nachbarparzelle in Planungszone — mögliche Bauverzögerung",
        "Wüest-Mietvergleich für Cham noch nicht hinterlegt",
      ],
      base: { nettomiete: "24.50", baukosten: "3'950", zinssatz: "2.1%", dscr: "1.32", cashOnCash: "3.8%" },
      stress: { nettomiete: "22.80", baukosten: "4'425", zinssatz: "3.6%", dscr: "1.04", cashOnCash: "1.1%" },
      baupotenzialMethode: "Ausnützungsziffer × Grundstücksfläche",
      baupotenzialVerifikation: "B — amtliches Dokument, nutzerseitig nicht bestätigt",
      rangKanton: 1,
      totalKanton: 12,
      perzentil: 96,
      provenance: ["OFFICIAL_AUTOMATED", "LISTING_EXTRACTED", "USER_ASSUMPTION", "MODEL_ESTIMATE"],
    },
  },
  {
    slug: "steinhausen-zugerstrasse-970",
    adresse: "Zugerstrasse",
    ort: "Steinhausen",
    kanton: "ZG",
    plz: "6312",
    parzelle: "970",
    objektart: "Bauland",
    score: 81,
    scoreTon: "good",
    vertrauen: 83,
    vertrauenLabel: "hoch",
    empfKlasse: "A",
    empfWort: "Prüfen",
    empfFarbe: "var(--good)",
    flaecheM2: 2150,
    preisChf: 4_120_000,
    preisProM2: 1916,
    yieldOnCost: 4.9,
  },
  {
    slug: "neuenhof-industriestrasse-3381",
    adresse: "Industriestrasse",
    ort: "Neuenhof",
    kanton: "AG",
    plz: "8965",
    parzelle: "3381",
    objektart: "Abbruchobjekt",
    score: 76,
    scoreTon: "accent",
    vertrauen: 64,
    vertrauenLabel: "mittel",
    empfKlasse: "B",
    empfWort: "Weiterverfolgen",
    empfFarbe: "var(--accent)",
    flaecheM2: 1340,
    preisChf: 2_890_000,
    preisProM2: 2157,
    yieldOnCost: 4.1,
  },
  {
    slug: "root-bahnhofstrasse-512",
    adresse: "Bahnhofstrasse",
    ort: "Root",
    kanton: "LU",
    plz: "6037",
    parzelle: "512",
    objektart: "Bauland",
    score: 74,
    scoreTon: "accent",
    vertrauen: 58,
    vertrauenLabel: "tief",
    empfKlasse: "B",
    empfWort: "Weiterverfolgen",
    empfFarbe: "var(--accent)",
    flaecheM2: 1480,
    preisChf: 2_340_000,
    preisProM2: 1581,
    yieldOnCost: 3.8,
  },
  {
    slug: "freienbach-seestrasse-145",
    adresse: "Seestrasse",
    ort: "Freienbach",
    kanton: "SZ",
    plz: "8807",
    parzelle: "145",
    objektart: "Bauland",
    score: 69,
    scoreTon: "warn",
    vertrauen: 39,
    vertrauenLabel: "sehr tief",
    empfKlasse: "C",
    empfWort: "Verifizieren",
    empfFarbe: "var(--warn)",
    flaecheM2: 2640,
    preisChf: 5_950_000,
    preisProM2: 2254,
    yieldOnCost: 3.4,
  },
  {
    slug: "baar-rigistrasse-664",
    adresse: "Rigistrasse",
    ort: "Baar",
    kanton: "ZG",
    plz: "6340",
    parzelle: "664",
    objektart: "Bauland",
    score: 66,
    scoreTon: "neutral",
    vertrauen: 61,
    vertrauenLabel: "mittel",
    empfKlasse: "C",
    empfWort: "Beobachten",
    empfFarbe: "var(--neutral-ink)",
    flaecheM2: 1970,
    preisChf: 3_780_000,
    preisProM2: 1919,
    yieldOnCost: 3.2,
  },
];

/**
 * Formatiert Zahlen im Schweizer Stil (Tausendertrennzeichen "'"), manuell statt via
 * Intl.NumberFormat("de-CH") — dessen Trennzeichen unterscheidet sich zwischen Node (SSR)
 * und Browser (ICU-Daten), was zu Hydration-Mismatches führt.
 */
export function formatChf(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.round(Math.abs(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return sign + grouped;
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
