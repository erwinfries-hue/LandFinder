import { BAUPOTENZIAL_PARAMETERS, STRESS_CASE_PARAMETERS } from "@landfinder/financial-engine";
import { SCORE_WEIGHTS, SCORE_BANDS, RISK_DEDUCTIONS, CONFIDENCE_WEIGHTS, EMPFEHLUNG_PARAMETERS } from "@landfinder/scoring-engine";
import { createRemoteSyncedStore } from "./remoteStore";

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

/** Wie `searchProfile.ts`: Store über `localStorage` + Supabase, siehe `lib/remoteStore.ts`. */
const store = createRemoteSyncedStore<AnnahmenOverrides>({
  storageKey: "landfinder.annahmenOverrides.v1",
  apiId: "annahmen-overrides",
  defaultValue: {},
  merge: (partial) => partial as AnnahmenOverrides,
});

export const getAnnahmenSnapshot = store.getSnapshot;
export const getAnnahmenServerSnapshot = store.getServerSnapshot;
export const subscribeAnnahmen = store.subscribe;
export const setAnnahmenOverrides = store.setValue;

export function overrideKey(groupId: string, paramKey: string): string {
  return `${groupId}.${paramKey}`;
}
