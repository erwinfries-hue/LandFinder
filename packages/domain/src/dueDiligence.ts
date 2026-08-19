/**
 * Typen für die Dokumenten-KI / Due-Diligence-Prüfung von Bestandswohnungen
 * (HOME4efFINDER, apps/home4effinder). Reine Typen — die eigentliche Extraktions-/
 * Synthese-Logik lebt in `apps/home4effinder/src/lib/documentTypes.ts`,
 * `dueDiligenceExtraction.ts`, `dueDiligenceSynthesis.ts` (analog zum Muster
 * `packages/domain` = Typen, `apps/<name>/src/lib` = tatsächliche Verarbeitung).
 */

/**
 * Katalog der unterstützten Dokumenttypen — Priorität A (zwingend) und B (empfohlen)
 * aus der Produktvorgabe, plus SONSTIGES als Auffangkategorie. Bewusst als offene
 * Liste angelegt (siehe `documentTypes.ts`), damit weitere Typen künftig ohne
 * Architekturänderung ergänzt werden können.
 */
export type DueDiligenceDocumentType =
  // Priorität A
  | "STWEG_PROTOKOLL"
  | "JAHRESRECHNUNG"
  | "BUDGET_STWEG"
  | "ERNEUERUNGSFONDS"
  | "STWEG_REGLEMENT"
  | "GRUNDBUCHAUSZUG"
  | "MIETVERTRAG"
  | "NEBENKOSTENABRECHNUNG"
  | "GRUNDRISS"
  // Priorität B
  | "GEBAEUDEVERSICHERUNG"
  | "HEIZUNG_SERVICE"
  | "ENERGIEAUSWEIS"
  | "SINA"
  | "RENOVATIONSNACHWEIS"
  | "BAUBESCHRIEB"
  | "PARKPLATZ_UNTERLAGEN"
  | "STWEG_BEGRUENDUNG"
  // Objekt-Basisdaten (kein Due-Diligence-Dokument im engeren Sinn, aber Quelle für
  // Adresse/Kaufpreis/Wohnfläche beim Anlegen eines neuen Objekts)
  | "EXPOSE_INSERAT"
  // Auffangkategorie
  | "SONSTIGES";

export type DueDiligencePriority = "ZWINGEND" | "EMPFOHLEN" | "OPTIONAL";

/** Fachbereiche, in denen die Due-Diligence-Prüfung je einen eigenen Status ausweist. */
export type DueDiligenceCategory =
  | "GRUNDBUCH_RECHTE"
  | "STWEG"
  | "ERNEUERUNGSFONDS"
  | "GEBAEUDE_SANIERUNGEN"
  | "MIETVERHAELTNIS"
  | "NEBENKOSTEN"
  | "HEIZUNG_ENERGIE"
  | "TECHNISCHE_UNTERLAGEN"
  | "DOKUMENTENVOLLSTAENDIGKEIT";

/** Ampel-Status — sowohl je Kategorie als auch als Gesamtstatus verwendet. */
export type DueDiligenceSeverity = "OK" | "KLAERUNGSBEDARF" | "RISIKO";

/**
 * Ein einzelner Befund mit Quellenbeleg — Kern der "jede Aussage muss auf das
 * Quelldokument zurückführbar sein"-Anforderung. `sourcePage`/`sourceQuote` fehlen nur,
 * wenn das Dokument keine Seitenzahlen hat (z.B. eine einseitige Bestätigung) oder die
 * Aussage aus einem Abgleich zwischen mehreren Dokumenten entsteht (dann trägt jeder
 * beteiligte Beleg seinen eigenen Fund).
 */
export interface DueDiligenceFinding {
  category: DueDiligenceCategory;
  severity: DueDiligenceSeverity;
  summary: string;
  detail?: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourcePage?: number;
  sourceQuote?: string;
  /** Markiert Widersprüche zwischen zwei oder mehr Quellen (Inserat/Dokument/bereits erfasste Daten) explizit. */
  isContradiction?: boolean;
}

export interface DueDiligenceMissingDocument {
  documentType: DueDiligenceDocumentType;
  priority: DueDiligencePriority;
  note?: string;
}

export interface DueDiligenceSellerQuestion {
  question: string;
  /** Kurzer Bezug, welcher Befund die Frage ausgelöst hat — für die spätere E-Mail-Vorlage. */
  relatedFindingSummary?: string;
}

/**
 * Ein aus Dokumenten erkannter Wert, der einen bereits erfassten Wert ergänzen/ersetzen
 * könnte — nie automatisch übernommen (docs/OPEN_DECISIONS.md, Punkt N: "Neuer Wert aus
 * Dokument erkannt … → übernehmen?"), erst nach expliziter Bestätigung.
 */
export interface DueDiligenceFieldUpdateProposal {
  /** Technischer Feldname im Bestandsrendite-Facts-Objekt, z.B. "miete.netRentChfPerM2Month". */
  field: string;
  label: string;
  newValue: string | number;
  currentValue?: string | number | null;
  sourceDocumentId: string;
  sourceDocumentName: string;
  sourcePage?: number;
}

export interface DueDiligenceCategoryResult {
  category: DueDiligenceCategory;
  status: DueDiligenceSeverity;
  findings: DueDiligenceFinding[];
}

/** Ergebnis der Stufe-2-Synthese über alle hochgeladenen Dokumente eines Objekts hinweg. */
export interface DueDiligenceResult {
  overallStatus: DueDiligenceSeverity;
  /**
   * 2-4 Sätze Gesamteinschätzung in Fliesstext (z.B. "Interessantes Renditeobjekt, aber
   * nur zu einem disziplinierten Kaufpreis — …") — fasst zusammen, was die Kategorien
   * unten im Detail zeigen, damit man nicht erst alle Kategorien öffnen muss, um das
   * Gesamtbild zu bekommen. Kann leer sein (z.B. wenn noch keine Dokumente vorliegen).
   */
  overallSummary: string;
  categories: DueDiligenceCategoryResult[];
  missingDocuments: DueDiligenceMissingDocument[];
  sellerQuestions: DueDiligenceSellerQuestion[];
  fieldUpdateProposals: DueDiligenceFieldUpdateProposal[];
}

/**
 * Aus einem Dokument (typischerweise Exposé/Inserat, ggf. auch Grundriss/Grundbuchauszug)
 * erkannte Objekt-Basisdaten — jedes Feld nur befüllt, wenn im Dokument klar ersichtlich
 * ("nichts wird erfunden"). Dient ausschliesslich dem Vorausfüllen des Erfassungsformulars
 * für ein NEUES Objekt; ersetzt nie automatisch einen bereits erfassten Wert (dafür gibt es
 * die DueDiligenceFieldUpdateProposal-Flow für bestehende Objekte).
 */
export interface DocumentBasisdaten {
  adresseText?: string;
  /** Zweistelliges Kantonskürzel (z.B. "ZH") — nur, wenn eindeutig aus der Adresse/dem Dokument ableitbar. */
  kantonCode?: string;
  kaufpreisChf?: number;
  wohnflaecheM2?: number;
}

/** Ergebnis der Stufe-1-Extraktion eines einzelnen Dokuments. */
export interface DocumentExtractionResult {
  /** Von der KI erkannter/bestätigter Dokumenttyp — kann vom beim Upload gewählten Typ abweichen (dann als Fund markiert). */
  detectedDocumentType: DueDiligenceDocumentType;
  summary: string;
  /** Freie, dokumenttypspezifische Fakten (z.B. Erneuerungsfonds-Saldo, Mietbeginn) — bewusst als offenes Objekt, siehe documentTypes.ts für die je Typ erwartete Form. */
  facts: Record<string, unknown>;
  findings: DueDiligenceFinding[];
  /** Nur befüllt, wenn das Dokument Objekt-Basisdaten enthält (siehe DocumentBasisdaten). */
  basisdaten?: DocumentBasisdaten;
}
