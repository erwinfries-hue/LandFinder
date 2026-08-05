import { BAUPOTENZIAL_PARAMETERS, STRESS_CASE_PARAMETERS } from "@landfinder/financial-engine";
import { SCORE_WEIGHTS, SCORE_BANDS, RISK_DEDUCTIONS, CONFIDENCE_WEIGHTS, EMPFEHLUNG_PARAMETERS } from "@landfinder/scoring-engine";

export interface AnnahmeGroup {
  id: string;
  title: string;
  description: string;
  registry: Record<string, { key: string; label: string; description: string; unit: string; defaultValue: number; source: string }>;
}

/**
 * Alle Parameter-Registries aus `financial-engine` und `scoring-engine` an einem Ort —
 * das "Annahmen"-Register. Jeder Wert hier ist derselbe, den die Formeln tatsächlich
 * verwenden (`ParameterDescriptor.defaultValue`); eine Änderung hier wirkt sich direkt
 * auf jede künftige Berechnung aus, die diese Registry als Default nutzt.
 */
export const ANNAHME_GROUPS: AnnahmeGroup[] = [
  {
    id: "baupotenzial",
    title: "Baupotenzial-Korrekturfaktoren",
    description: "Financial-Engine, Abschnitt 9 — Korrekturfaktoren für die Flächenschätzung.",
    registry: BAUPOTENZIAL_PARAMETERS,
  },
  {
    id: "stress",
    title: "Stress-Case-Parameter",
    description: "Financial-Engine, Abschnitt 14 — Default-Startwerte für den Stress-Case.",
    registry: STRESS_CASE_PARAMETERS,
  },
  {
    id: "scoreweights",
    title: "Score-Gewichte",
    description: "Scoring-Engine, Abschnitt 15 — Punktegewichte pro Teilkriterium.",
    registry: SCORE_WEIGHTS,
  },
  {
    id: "scorebands",
    title: "Score-Umrechnungsbänder",
    description: "Scoring-Engine — Modellannahmen zur Umrechnung Rohwert → Punkte (im Masterdokument nicht beziffert).",
    registry: SCORE_BANDS,
  },
  {
    id: "risk",
    title: "Risikoabzüge",
    description: "Scoring-Engine, Abschnitt 15 — Punktabzüge pro Risikofaktor (im Masterdokument nicht beziffert).",
    registry: RISK_DEDUCTIONS,
  },
  {
    id: "confidence",
    title: "Datenvertrauens-Gewichte",
    description: "Scoring-Engine, Abschnitt 16 — Gewichte pro Datenkategorie.",
    registry: CONFIDENCE_WEIGHTS,
  },
  {
    id: "empfehlung",
    title: "Empfehlungs-Parameter",
    description: "Scoring-Engine, Abschnitt 18 — zusätzliche Schwellen für die Empfehlungsableitung.",
    registry: EMPFEHLUNG_PARAMETERS,
  },
];

export type AnnahmenOverrides = Record<string, number>;

const STORAGE_KEY = "landfinder.annahmenOverrides.v1";

/** Wie `searchProfile.ts`: externer Store über `localStorage`, angebunden via `useSyncExternalStore`. */
let cachedRaw: string | null = null;
let cachedOverrides: AnnahmenOverrides = {};
const listeners = new Set<() => void>();

function parse(raw: string | null): AnnahmenOverrides {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AnnahmenOverrides;
  } catch {
    return {};
  }
}

export function getAnnahmenSnapshot(): AnnahmenOverrides {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedOverrides = parse(raw);
  }
  return cachedOverrides;
}

export function getAnnahmenServerSnapshot(): AnnahmenOverrides {
  return {};
}

export function subscribeAnnahmen(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setAnnahmenOverrides(overrides: AnnahmenOverrides): void {
  cachedRaw = JSON.stringify(overrides);
  cachedOverrides = overrides;
  window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach((l) => l());
}

export function overrideKey(groupId: string, paramKey: string): string {
  return `${groupId}.${paramKey}`;
}
