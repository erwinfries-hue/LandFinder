import plzKantonData from "../../../../config/plz-kanton.json";

const PLZ_TO_KANTON: Record<string, string> = plzKantonData;

/**
 * Deterministische PLZ→Kanton-Zuordnung für rund 3'376 Schweizer Postleitzahlen
 * (`config/plz-kanton.json`, abgeleitet aus dem Schweizer Post-PLZ-Verzeichnis via
 * github.com/gamba/swiss-geolocation, Stand 2015). PLZ→Kanton ändert sich praktisch
 * nie — Gemeinden wechseln nie den Kanton —, daher bleibt die Zuordnung trotz Alter
 * der Quelle verlässlich. Rund 16 von 3'392 Postleitzahlen liegen genau auf einer
 * Kantonsgrenze (z.B. 1410 gehört teils zu FR, teils zu VD) — für diese bewusst
 * **kein** Kanton hinterlegt, statt zwischen zwei möglichen zu raten.
 */
export function cantonFromPlz(plz: string | undefined): string | undefined {
  if (!plz) return undefined;
  return PLZ_TO_KANTON[plz];
}

/** Erste plausible 4-stellige Schweizer PLZ aus einem Adress-Fliesstext (z.B. "Bahnhofstrasse 1, 8545 Rickenbach"). */
export function extractPlz(addressText: string | null | undefined): string | undefined {
  if (!addressText) return undefined;
  return addressText.match(/\b(\d{4})\b/)?.[1];
}

/** Leitet den Kanton direkt aus dem in einem Adresstext enthaltenen PLZ ab. */
export function deriveCantonFromAddress(addressText: string | null | undefined): string | undefined {
  return cantonFromPlz(extractPlz(addressText));
}
