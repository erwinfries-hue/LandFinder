import type { DueDiligenceCategory, DueDiligenceDocumentType, DueDiligencePriority } from "@landfinder/domain";

/**
 * Zentraler, modularer Katalog aller unterstützten Dokumenttypen für die
 * Bestandsrendite-Due-Diligence (apps/home4effinder/docs/DECISIONS.md). Ein neuer
 * Dokumenttyp bedeutet: neuen Eintrag hier + neuen Wert in
 * `@landfinder/domain`s `DueDiligenceDocumentType` — keine weitere
 * Architekturänderung (wie vom Auftraggeber gefordert: "Bitte modular bauen").
 *
 * `extractionGuidance` fliesst direkt in den Stufe-1-Extraktionsprompt
 * (`dueDiligenceExtraction.ts`) — für die Priorität-A-Typen wörtlich aus Abschnitt 4
 * der Produktvorgabe übernommen (STWEG-Protokoll, Erneuerungsfonds, Mietvertrag,
 * Grundbuch), für die übrigen Typen eine sinnvolle, aber bewusst generischere
 * Anleitung (MVP-Entscheidung).
 */

export interface DocumentTypeConfig {
  type: DueDiligenceDocumentType;
  label: string;
  priority: DueDiligencePriority;
  defaultCategory: DueDiligenceCategory;
  description: string;
  extractionGuidance: string;
}

export const DOCUMENT_TYPE_CATALOG: Record<DueDiligenceDocumentType, DocumentTypeConfig> = {
  // --- Priorität A — zwingend ---
  STWEG_PROTOKOLL: {
    type: "STWEG_PROTOKOLL",
    label: "STWEG-Protokoll",
    priority: "ZWINGEND",
    defaultCategory: "STWEG",
    description: "Protokoll einer STWEG-Versammlung, idealerweise die letzten 3 Jahre.",
    extractionGuidance:
      "Erfasse: beschlossene Sanierungen; diskutierte, aber vertagte Investitionen; Sonderumlagen; grössere Reparaturen (Lift, Dach/Fassade/Fenster, Heizung, Wasserleitungen, Elektro-/Stromleitungen, Garage, Umgebung) — auch wenn eine Sanierung erst über den Erneuerungsfonds finanziert werden soll, statt bereits ausgeführt zu sein; wiederkehrende Probleme; Konflikte innerhalb der STWEG; geplante nächste Investitionen; Abstimmungsergebnisse, wenn relevant. WICHTIG, separat prüfen: wird im Protokoll erwähnt, dass ein oder mehrere Eigentümer mit Akontobeiträgen/Sonderumlagen im Rückstand sind oder Beiträge nicht bezahlt haben (Zahlungsrückstände/-ausfälle)? Das ist ein eigenständiges finanzielles Risiko (die übrigen Eigentümer haften ggf. für den Ausfall) und muss als eigener Fund erfasst werden, auch wenn es nur in einem Nebensatz/Traktandum steht — nicht nur unter 'Konflikte' subsumieren. Wichtig auch: auch ein abgelehntes oder vertagtes Projekt ist ein mögliches zukünftiges Risiko und muss als Fund erfasst werden, nicht nur beschlossene Vorhaben.",
  },
  JAHRESRECHNUNG: {
    type: "JAHRESRECHNUNG",
    label: "Jahresrechnung / Betriebskostenabrechnung",
    priority: "ZWINGEND",
    defaultCategory: "STWEG",
    description: "Jahresrechnung bzw. Betriebskostenabrechnung der STWEG.",
    extractionGuidance:
      'Erfasse: Gesamtbetriebskosten der Liegenschaft und deren Zusammensetzung (Verwaltung, Versicherung, Unterhalt, Hauswart, Energie); Anteil/Wertquote der geprüften Wohnung an diesen Kosten, falls ersichtlich; Auffälligkeiten wie stark schwankende oder ungewöhnlich hohe Einzelpositionen; Vergleich zur vorherigen Periode, falls mehrere Jahresrechnungen vorliegen. Prüfe die Bilanz/den Anhang auch auf offene Debitoren/Forderungen gegenüber einzelnen Eigentümern (ausstehende Akontobeiträge/Sonderumlagen) — falls vorhanden, als eigenständigen Fund erfassen (finanzielles Risiko für die übrigen Eigentümer). Enthält das Dokument einen "Kostenverteiler nach Eigentümer" o.ä. mit dem effektiven Jahresbeitrag der geprüften Wohnung, diesen Betrag zusätzlich als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "stwegAkontobeitragChfPerYear" (Zahl, CHF/Jahr) erfassen — sowie, falls dort ebenfalls ersichtlich, die Wertquote als "wertquotePromille" (Zahl, z.B. 50 für 50‰).',
  },
  BUDGET_STWEG: {
    type: "BUDGET_STWEG",
    label: "Budget der STWEG",
    priority: "ZWINGEND",
    defaultCategory: "STWEG",
    description: "Budgetplanung der STWEG für die laufende/kommende Periode.",
    extractionGuidance:
      'Erfasse: budgetierte Kosten je Kategorie, geplante grössere Ausgaben, geplante Beitragsänderungen (Akontobeiträge/Erneuerungsfonds), Abweichungen zur letzten Jahresrechnung, falls beide vorliegen. Enthält das Dokument eine "Budgetverteilung nach Eigentümer" o.ä. mit dem budgetierten Jahresbeitrag der geprüften Wohnung, diesen Betrag zusätzlich als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "stwegAkontobeitragChfPerYear" (Zahl, CHF/Jahr) erfassen — sowie, falls dort ebenfalls ersichtlich, die Wertquote als "wertquotePromille" (Zahl, z.B. 50 für 50‰).',
  },
  ERNEUERUNGSFONDS: {
    type: "ERNEUERUNGSFONDS",
    label: "Erneuerungsfonds (Saldo/Beiträge)",
    priority: "ZWINGEND",
    defaultCategory: "ERNEUERUNGSFONDS",
    description: "Nachweis über Saldo und jährliche Beiträge des STWEG-Erneuerungsfonds.",
    extractionGuidance:
      'Erfasse: aktueller Saldo; historische Entwicklung, falls mehrere Perioden ersichtlich; jährlicher Beitrag; Anteil/Wertquote der geprüften Wohnung; ausserordentliche Entnahmen; eine Einschätzung, ob der Fonds im Verhältnis zum Gebäudealter und zu bekannten/geplanten Investitionen (aus STWEG-Protokollen) ausreichend erscheint — als Einschätzung kennzeichnen, nicht als Fakt. WICHTIG: Kapital-/Zinsausweise nennen häufig ZWEI Beträge — den GESAMTSaldo des Erneuerungsfonds der ganzen STWEG (z.B. "Bank Erneuerungsfonds ... Kapital per ...") UND separat den nach Wertquote anteiligen Betrag NUR der geprüften Wohnung ("Total Ihrer Objekte", oft deutlich kleiner). Diese ZWEI Beträge gehören in ZWEI GETRENNTE strukturierte Fakten im facts-Feld — NIE denselben Schlüssel für beide verwenden und NIE den einen mit dem anderen überschreiben: "erneuerungsfondsSaldoChf" (Zahl) IMMER der GESAMTSaldo der ganzen STWEG, "erneuerungsfondsWohnungsanteilChf" (Zahl) IMMER NUR der anteilige Betrag der geprüften Wohnung. Die Wertquote separat als "wertquotePromille" (Zahl, z.B. 50 für 50‰) erfassen, falls ersichtlich. Nennt das Dokument oder ein zugehöriges Reglement einen ausdrücklichen Ziel-/Sollwert für den Fonds (z.B. "Zielgrösse", "angestrebter Mindestbestand"), diesen zusätzlich als "erneuerungsfondsZielwertChf" (Zahl) erfassen — NICHT mit einer eigenen Einschätzung der Angemessenheit verwechseln, nur ein im Dokument tatsächlich genannter Zielwert zählt.',
  },
  STWEG_REGLEMENT: {
    type: "STWEG_REGLEMENT",
    label: "STWEG-Reglement / Nutzungs- und Verwaltungsordnung",
    priority: "ZWINGEND",
    defaultCategory: "STWEG",
    description: "Reglement bzw. Nutzungs- und Verwaltungsordnung der STWEG.",
    extractionGuidance:
      "Erfasse: Nutzungsbeschränkungen (z.B. Vermietung, gewerbliche Nutzung, Haustiere), Kostenverteilschlüssel, Stimmrechtsregeln, Sonderrechte/-pflichten einzelner Einheiten, ungewöhnliche oder besonders einschränkende Klauseln.",
  },
  GRUNDBUCHAUSZUG: {
    type: "GRUNDBUCHAUSZUG",
    label: "Grundbuchauszug",
    priority: "ZWINGEND",
    defaultCategory: "GRUNDBUCH_RECHTE",
    description: "Aktueller Grundbuchauszug der Wohnung (und ggf. separat der Garage/des Parkplatzes).",
    extractionGuidance:
      'Erfasse: Eigentümer; genaue Stockwerkeinheit; Wertquote; Miteigentumsanteile Garage; Sonder-/Nutzungsrechte; Dienstbarkeiten; Grundlasten; Baurecht (falls vorhanden — bei dieser Objektart ein Dealbreaker, klar als Risiko markieren); Weg-/Parkplatzrechte; ungewöhnliche Belastungen; Widersprüche zum Inserat bzw. zum vermeintlichen Kaufgegenstand (z.B. ein im Inserat erwähnter Parkplatz, der grundbuchlich nicht oder anders zugeordnet ist). Die Sonderrecht-Angabe nennt oft die Zimmerzahl direkt im Text (z.B. "4-Zimmerwohnung im 1. Obergeschoss") — falls so ersichtlich, zusätzlich als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "zimmerzahl" (Zahl, z.B. 4) erfassen.',
  },
  MIETVERTRAG: {
    type: "MIETVERTRAG",
    label: "Mietvertrag (inkl. Nachträge)",
    priority: "ZWINGEND",
    defaultCategory: "MIETVERHAELTNIS",
    description: "Aktueller Mietvertrag der Wohnung inkl. allfälliger Nachträge.",
    extractionGuidance:
      'Erfasse: Nettomiete Wohnung; Miete Garage/Parkplatz; Nebenkosten (pauschal oder Akonto — welches von beiden); Mietbeginn; Kündigungsfrist/-termine; Kaution; besondere Vereinbarungen; mitvermietete Einrichtungen; Referenzzinssatz, sofern genannt; erkennbares Mietsteigerungspotenzial (z.B. Miete deutlich unter dem, was im Inserat/anderen Dokumenten als markttypisch erscheint). Erfasse Nettomiete Wohnung UND Miete Garage/Parkplatz zusätzlich als strukturierte Fakten im facts-Feld mit GENAU den Schlüsseln "wohnungsMieteChfPerMonth" bzw. "parkplatzMieteChfPerMonth" (jeweils Zahl, CHF/Monat) — diese exakten Schlüsselnamen sind wichtig, damit die Werte automatisch als Vorschlag ins Erfassungsformular übernommen werden können.',
  },
  NEBENKOSTENABRECHNUNG: {
    type: "NEBENKOSTENABRECHNUNG",
    label: "Nebenkostenabrechnung der Wohnung",
    priority: "ZWINGEND",
    defaultCategory: "NEBENKOSTEN",
    description: "Nebenkostenabrechnung der konkreten Wohnung (nicht der ganzen Liegenschaft) — entweder an einen Mieter (Nachzahlung/Guthaben-Abrechnung) oder von der STWEG-Verwaltung an den Eigentümer (Kostenanteil der Wohnung).",
    extractionGuidance:
      'Zwei unterschiedliche, aber ähnlich benannte Varianten möglich — am Inhalt erkennbar, nicht am Dateinamen: (1) Mieter-Abrechnung: enthält einen Vergleich zu den im Mietvertrag akontierten Beträgen (Nachzahlung/Guthaben) — hier effektive Nebenkosten der Wohnung, den Vergleich und die Zusammensetzung der Kosten erfassen. (2) Eigentümer-Kostenanteil (von der STWEG-Verwaltung, z.B. "Betriebskostenabrechnung"): zeigt den Anteil der Wohnung an Heizkosten/allgemeinen Nebenkosten/Erneuerungsfonds nach Wertquote, KEIN Bezug zu einem Mietvertrag — hier den "Total Kosten"/"Ihr Anteil"-Betrag zusätzlich als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "stwegAkontobeitragChfPerYear" (Zahl, CHF/Jahr) erfassen, sowie die Wertquote als "wertquotePromille" (Zahl, z.B. 50 für 50‰), falls ersichtlich. Bei Variante (2) NICHT nach einem Mietvertrags-Akonto-Vergleich suchen — der existiert dort nicht.',
  },
  GRUNDRISS: {
    type: "GRUNDRISS",
    label: "Grundriss / Flächenunterlagen",
    priority: "ZWINGEND",
    defaultCategory: "TECHNISCHE_UNTERLAGEN",
    description: "Grundrissplan bzw. Flächenberechnung der Wohnung.",
    extractionGuidance:
      'Erfasse: Wohnfläche laut Plan, Zimmerzahl, Raumaufteilung, ob ein Reduit/Keller/Balkon separat ausgewiesen ist. Die Zimmerzahl steht auf einem Grundriss oft NICHT als Zahl da, sondern muss aus den beschrifteten Räumen abgeleitet werden — zähle dafür Wohnzimmer und alle als "Zimmer"/Schlafzimmer beschrifteten Räume zusammen (Küche, Bad, Gang/Korridor NICHT mitzählen) und erfasse das Ergebnis als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "zimmerzahl" (Zahl). Vergleiche die Fläche explizit mit der im Inserat genannten Fläche — jede Abweichung ist ein zu meldender Widerspruch.',
  },

  // --- Priorität B — empfohlen ---
  GEBAEUDEVERSICHERUNG: {
    type: "GEBAEUDEVERSICHERUNG",
    label: "Gebäude-/Sachversicherung",
    priority: "EMPFOHLEN",
    defaultCategory: "GEBAEUDE_SANIERUNGEN",
    description: "Police der Gebäude- bzw. Sachversicherung.",
    extractionGuidance:
      'Erfasse: Versicherungssumme, Deckungsumfang, Selbstbehalt, Hinweise auf bereits gemeldete Schäden. Gebäudeversicherungspolicen (z.B. kantonale Gebäudeversicherung) nennen häufig ein "Baujahr" als eigenes Feld — falls so ersichtlich, zusätzlich als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "baujahr" (Zahl, z.B. 1964) erfassen.',
  },
  HEIZUNG_SERVICE: {
    type: "HEIZUNG_SERVICE",
    label: "Heizungsinformationen / Serviceunterlagen",
    priority: "EMPFOHLEN",
    defaultCategory: "HEIZUNG_ENERGIE",
    description: "Angaben zu Heizungstyp, Alter, Serviceverlauf.",
    extractionGuidance: "Erfasse: Heizungstyp (z.B. Gas/Öl/Wärmepumpe/Fernwärme), Baujahr/Alter, letzte Serviceintervalle, bekannte Mängel, absehbarer Ersatzbedarf.",
  },
  ENERGIEAUSWEIS: {
    type: "ENERGIEAUSWEIS",
    label: "Energieunterlagen",
    priority: "EMPFOHLEN",
    defaultCategory: "HEIZUNG_ENERGIE",
    description: "Energieausweis bzw. Energiekennzahlen der Liegenschaft.",
    extractionGuidance: "Erfasse: Energieeffizienzklasse/-kennzahl, Ausstellungsdatum, ggf. Hinweise auf empfohlene energetische Massnahmen.",
  },
  SINA: {
    type: "SINA",
    label: "Sicherheitsnachweis elektrische Installationen (SiNa)",
    priority: "EMPFOHLEN",
    defaultCategory: "TECHNISCHE_UNTERLAGEN",
    description: "Sicherheitsnachweis bzw. letzte Elektrokontrolle.",
    extractionGuidance: "Erfasse: Datum der letzten Kontrolle, festgestellte Mängel, ob eine Nachkontrolle/Behebung dokumentiert ist. Fehlt ein aktueller Nachweis, ist das explizit als offener Punkt zu behandeln.",
  },
  RENOVATIONSNACHWEIS: {
    type: "RENOVATIONSNACHWEIS",
    label: "Renovations-/Sanierungsnachweis",
    priority: "EMPFOHLEN",
    defaultCategory: "GEBAEUDE_SANIERUNGEN",
    description: "Rechnungen oder Nachweise zu durchgeführten Renovationen/Sanierungen.",
    extractionGuidance:
      "Erfasse: Art der Arbeiten, Jahr, Betrag, ausführende Firma falls genannt. Vergleiche das genannte Jahr/den Umfang explizit mit allfälligen Angaben im Inserat oder Verkäuferaussagen (z.B. 'Renovation 2020' im Inserat vs. tatsächlich belegte Renovation) — jede Abweichung ist ein zu meldender Widerspruch.",
  },
  BAUBESCHRIEB: {
    type: "BAUBESCHRIEB",
    label: "Baubeschrieb",
    priority: "EMPFOHLEN",
    defaultCategory: "TECHNISCHE_UNTERLAGEN",
    description: "Ursprünglicher Baubeschrieb der Liegenschaft/Wohnung.",
    extractionGuidance:
      'Erfasse: Baujahr, Bauweise, ursprünglicher Ausbaustandard, verwendete Materialien/Systeme, soweit relevant für den heutigen Zustand. Das Baujahr zusätzlich als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "baujahr" (Zahl, z.B. 1964) erfassen.',
  },
  PARKPLATZ_UNTERLAGEN: {
    type: "PARKPLATZ_UNTERLAGEN",
    label: "Parkplatz-/Garagenunterlagen",
    priority: "EMPFOHLEN",
    defaultCategory: "GRUNDBUCH_RECHTE",
    description: "Unterlagen zu Einstellhallen-/Aussenparkplatz (separat vom Grundbuchauszug, falls vorhanden).",
    extractionGuidance:
      'Erfasse: Parkplatznummer/-bezeichnung, ob Eigentum oder nur Nutzungsrecht, Zuordnung zur Wohnung. Prüfe explizit gegen Grundbuchauszug und Inserat auf Übereinstimmung. Wird ein separater Kaufpreis für einen offenen/Aussen-Parkplatz genannt (z.B. in einer Kaufabrechnung), diesen als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "parkplatzKaufpreisChf" (Zahl) erfassen; einen separaten Kaufpreis für einen Tiefgaragenplatz/eine Garage stattdessen mit GENAU dem Schlüssel "garagenplatzKaufpreisChf" (Zahl) — beide Schlüssel können gleichzeitig vorkommen, falls beide Parkierungsarten vorhanden sind.',
  },
  STWEG_BEGRUENDUNG: {
    type: "STWEG_BEGRUENDUNG",
    label: "Stockwerkeigentumsbegründung / Wertquoten",
    priority: "EMPFOHLEN",
    defaultCategory: "GRUNDBUCH_RECHTE",
    description: "Begründungsakt des Stockwerkeigentums mit Wertquoten aller Einheiten.",
    extractionGuidance:
      'Erfasse: Wertquote der Wohnung, Anzahl und Art aller Einheiten in der STWEG, Sonderrechte/-nutzungen laut Begründungsakt. Die Wertquote zusätzlich als strukturierten Fakt im facts-Feld mit GENAU dem Schlüssel "wertquotePromille" (Zahl, z.B. 50 für 50‰) erfassen.',
  },

  // --- Objekt-Basisdaten ---
  EXPOSE_INSERAT: {
    type: "EXPOSE_INSERAT",
    label: "Exposé / Inserat",
    priority: "EMPFOHLEN",
    defaultCategory: "DOKUMENTENVOLLSTAENDIGKEIT",
    description: "Verkaufsexposé bzw. ausgedrucktes Online-Inserat des Objekts.",
    extractionGuidance:
      'Erfasse als Basisdaten (siehe basisdaten-Feld): vollständige Adresse, Kanton, Kaufpreis, Wohnfläche. Erfasse zusätzlich als strukturierte Fakten im facts-Feld — mit GENAU diesen Schlüsseln, falls im Dokument ersichtlich: "zimmerzahl" (Zahl, z.B. 3.5), "baujahr" (Zahl, z.B. 1998), "parkplatzKaufpreisChf" (Zahl, NUR falls ein separater Kaufpreis für einen offenen/Aussen-Parkplatz genannt wird, nicht der Gesamtkaufpreis), "garagenplatzKaufpreisChf" (Zahl, NUR falls ein separater Kaufpreis für einen Tiefgaragenplatz/eine Garage genannt wird — beide Schlüssel können gleichzeitig vorkommen). Diese exakten Schlüsselnamen sind wichtig, damit die Werte automatisch als Vorschlag ins Erfassungsformular übernommen werden können. Erfasse zusätzlich als Fund, falls ersichtlich: Stockwerk, beschriebener Zustand/Ausbaustandard, erwähnte Sonderrechte (Parkplatz, Keller, Balkon) — auch die oben als Fakten erfassten Werte hier nochmals im Fliesstext nennen. Vergleiche die genannte Wohnfläche explizit mit anderen bereits vorliegenden Dokumenten (z.B. Grundriss) — jede Abweichung ist ein zu meldender Widerspruch.',
  },

  // --- Auffangkategorie ---
  SONSTIGES: {
    type: "SONSTIGES",
    label: "Sonstiges Dokument",
    priority: "OPTIONAL",
    defaultCategory: "DOKUMENTENVOLLSTAENDIGKEIT",
    description: "Jedes Dokument, das keinem der obigen Typen entspricht.",
    extractionGuidance: "Fasse den Inhalt sachlich zusammen und melde alles, was für den Kaufentscheid einer Eigentumswohnung als Renditeobjekt relevant erscheint — insbesondere Widersprüche zu bereits erfassten Daten.",
  },
};

export function documentTypesByPriority(): Record<DueDiligencePriority, DocumentTypeConfig[]> {
  const result: Record<DueDiligencePriority, DocumentTypeConfig[]> = { ZWINGEND: [], EMPFOHLEN: [], OPTIONAL: [] };
  for (const config of Object.values(DOCUMENT_TYPE_CATALOG)) {
    result[config.priority].push(config);
  }
  return result;
}

/** Alle Dokumenttypen, die für eine "vollständige" Grundausstattung typischerweise erwartet werden (Priorität A) — Basis für die Missing-Documents-Liste in der Due-Diligence-Synthese. */
export function requiredAndRecommendedDocumentTypes(): DueDiligenceDocumentType[] {
  return Object.values(DOCUMENT_TYPE_CATALOG)
    .filter((c) => c.priority === "ZWINGEND" || c.priority === "EMPFOHLEN")
    .map((c) => c.type);
}
