/**
 * Zentrale Hover-Erklärungstexte für Kennzahlen — an einem Ort, damit dieselbe
 * Formulierung überall verwendet wird (Dashboard, Objekt-Detail, statisch wie live).
 */
export const METRIC_HINTS = {
  angebotspreis: "Vom Verkäufer geforderter Preis für das Grundstück (Inseratsangabe).",
  grundstuecksflaeche: "Fläche der Parzelle laut Grundbuch/Inserat.",
  nra: "Nettowohnfläche: Ausnützungsziffer × Grundstücksfläche × Korrekturfaktoren (Nettoeffizienz, Geometrie, Grenzabstand, Topografie, Erschliessung) — Formel im Suchprofil-Reiter 'Annahmen & Formeln' editierbar.",
  gesamtinvestition: "Summe aller Projektkosten: Land, Bau, Abbruch/Sanierung, Nebenkosten, Honorare, Reserve, Baufinanzierung (Base Case).",
  eigenkapitalbedarf: "Gesamtinvestition abzüglich Fremdkapital (Loan-to-Cost-Anteil).",
  yieldOnCost: "Nettoertrag (NOI) ÷ Gesamtprojektkosten. Zeigt die Rendite auf die gesamte Investition — unabhängig vom späteren Verkehrswert.",
  dscr: "Debt Service Coverage Ratio: Nettoertrag (NOI) ÷ jährlicher Kapitaldienst (Zins + Amortisation). Unter 1.0 heisst: der Ertrag deckt die Finanzierung nicht.",
  residualwert: "Maximal sinnvoller Grundstückspreis: Verkehrswert (Nettoertrag ÷ Exit-Kapitalisierungssatz) abzüglich Baukosten und Zielgewinn.",
  cashOnCash: "Cashflow vor Steuern ÷ eingesetztes Eigenkapital, in %.",
  nettomiete: "Angenommene Nettomiete pro m² Nettowohnfläche und Monat. Stress-Case: reduziert um den Stress-Case-Parameter 'Mietanpassung'.",
  baukostenM2: "Gebäudekosten pro m² Nettowohnfläche. Stress-Case: erhöht um den Stress-Case-Parameter 'Baukostenanpassung'.",
  zinssatz: "Fremdkapital-Zinssatz. Stress-Case: erhöht um den Stress-Case-Parameter 'Zinssatzanpassung' (Prozentpunkte).",
  score: "Attraktivitäts-Score, max. 100 Punkte: Wirtschaftlichkeit (40), Baupotenzial (25), Markt (15), Lage (10), Risiko (10) — Gewichte editierbar im Suchprofil-Reiter 'Annahmen & Formeln'.",
  vertrauen: "Datenvertrauen, max. 100 Punkte — wie gut die verwendeten Zahlen belegt sind (Herkunft, Verifikationsstufe). Kein Vertrauen ohne Beleg.",
  empfehlung: "Automatisch abgeleitete Handlungsempfehlung aus Score, Datenvertrauen und Hard-Gate-Status.",
  baupotenzialMethode: "Schätzung der realisierbaren Nettowohnfläche aus Zonenvorschriften (Ausnützungsziffer, Baumassenziffer oder Überbauungsziffer) — alle Korrekturfaktoren editierbar im Suchprofil-Reiter 'Annahmen & Formeln'.",
  verifikation: "Verifikationsstufe: A = amtliches Dokument bestätigt, B = amtliches Dokument vorhanden, nutzerseitig nicht bestätigt, C = reine Schätzung/Annahme.",
  vergleichKanton: "Rang und Perzentil dieses Objekts unter allen Objekten im selben Kanton, nach Score sortiert.",
  kanton: "Kanton, in dem das Objekt liegt.",
  flaeche: "Grundstücksfläche und Preis pro m² Land.",
  preis: "Angebotspreis für das Grundstück.",
  lage: "Öffnet die Adresse in Google Maps.",
} as const;
