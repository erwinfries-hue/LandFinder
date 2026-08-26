import type { AllowedUpdateField } from "./bestandsrendite";

/**
 * Feldpfade + Labels für Feldwert-Übernahmevorschläge — Single Source of Truth,
 * verwendet sowohl von `/api/properties/[id]/due-diligence/route.ts` (bekanntes Objekt,
 * mit aktuellem Wert) als auch vom kombinierten Neu-Erfassen-Flow
 * (`PropertyCreateForm`, noch kein Objekt, daher ohne aktuellen Wert). Muss exakt mit
 * `ALLOWED_UPDATE_FIELDS` in bestandsrendite.ts übereinstimmen (dort auch geprüft).
 */
export const BESTANDSRENDITE_KNOWN_FIELD_LABELS: { field: AllowedUpdateField; label: string }[] = [
  { field: "zimmerzahl", label: "Zimmerzahl" },
  { field: "baujahr", label: "Baujahr" },
  { field: "parkplatzKaufpreisChf", label: "Aussenparkplatz-Kaufpreis (CHF)" },
  { field: "garagenplatzKaufpreisChf", label: "Tiefgaragenplatz-/Garage-Kaufpreis (CHF)" },
  { field: "hobbyraumKaufpreisChf", label: "Hobbyraum-Kaufpreis (CHF)" },
  { field: "miete.wohnungsMieteChfPerMonth", label: "Nettomiete Wohnung (CHF/Monat)" },
  { field: "miete.parkplatzMieteChfPerMonth", label: "Miete Aussenparkplatz (CHF/Monat)" },
  { field: "miete.garagenplatzMieteChfPerMonth", label: "Miete Garage (CHF/Monat)" },
  { field: "miete.hobbyraumMieteChfPerMonth", label: "Miete Hobbyraum (CHF/Monat)" },
  { field: "miete.sonstigeEinnahmenChfPerYear", label: "Sonstige Einnahmen (CHF/Jahr)" },
  { field: "miete.leerstandPercent", label: "Leerstand (%)" },
  { field: "betriebskosten.stwegAkontobeitragChfPerYear", label: "STWEG-Akontobeitrag (CHF/Jahr)" },
  {
    field: "betriebskosten.stwegAkontobeitragUeberwaelzbarChfPerYear",
    label: "davon überwälzbar auf Mieter via Nebenkosten (CHF/Jahr, NICHT der Gesamtbeitrag — dafür siehe oben)",
  },
  { field: "stweg.erneuerungsfondsSaldoChf", label: "Erneuerungsfonds-Saldo (CHF, GESAMT der STWEG — NICHT der Wohnungsanteil, dafür siehe unten)" },
  { field: "stweg.erneuerungsfondsWohnungsanteilChf", label: "Erneuerungsfonds-Wohnungsanteil (CHF, NUR Anteil der geprüften Wohnung — NICHT der Gesamtsaldo der STWEG)" },
  { field: "stweg.erneuerungsfondsZielwertChf", label: "Erneuerungsfonds-Zielwert (CHF)" },
  { field: "stweg.wertquotePromille", label: "Wertquote (Promille)" },
];
