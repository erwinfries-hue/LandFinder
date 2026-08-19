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
  { field: "parkplatzKaufpreisChf", label: "Parkplatz-Kaufpreis (CHF)" },
  { field: "miete.wohnungsMieteChfPerMonth", label: "Nettomiete Wohnung (CHF/Monat)" },
  { field: "miete.parkplatzMieteChfPerMonth", label: "Miete Parkplatz (CHF/Monat)" },
  { field: "miete.sonstigeEinnahmenChfPerYear", label: "Sonstige Einnahmen (CHF/Jahr)" },
  { field: "miete.leerstandPercent", label: "Leerstand (%)" },
  { field: "betriebskosten.stwegAkontobeitragChfPerYear", label: "STWEG-Akontobeitrag (CHF/Jahr)" },
  { field: "stweg.erneuerungsfondsSaldoChf", label: "Erneuerungsfonds-Saldo (CHF)" },
  { field: "stweg.erneuerungsfondsZielwertChf", label: "Erneuerungsfonds-Zielwert (CHF)" },
  { field: "stweg.wertquotePromille", label: "Wertquote (Promille)" },
];
