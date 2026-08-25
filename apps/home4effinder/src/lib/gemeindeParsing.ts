/**
 * Best-effort-Ableitung der Gemeinde aus der frei erfassten Objektadresse (z.B. "Obere
 * Haldenstrasse 42, 5610 Wohlen" → "Wohlen") — für das Gemeinde-Feld im
 * Objekterfassungsformular vorausgefüllt, aber NIE stillschweigend festgeschrieben: der
 * Nutzer sieht/korrigiert das Ergebnis immer, bevor gespeichert wird (siehe
 * PropertyCreateForm.tsx). `address_text` ist in dieser App bewusst unstrukturierter
 * Freitext ohne Formatvorgabe (siehe DECISIONS.md) — die Regex ist deshalb nur ein
 * Vorschlag, keine Garantie.
 */

/**
 * Erwartet das Schweizer Muster "…, PLZ Ort" am Ende der Adresse (vierstellige PLZ,
 * gefolgt vom Ortsnamen bis zum Stringende). Liefert `undefined`, wenn keine PLZ
 * gefunden wird — z.B. bei einer noch unvollständigen Adresse ohne PLZ/Ort.
 */
export function guessGemeindeFromAddress(addressText: string): string | undefined {
  const match = /(\d{4})\s+(.+)$/.exec(addressText.trim());
  if (!match) return undefined;
  const ort = match[2].trim();
  return ort ? ort : undefined;
}

/**
 * Für stabiles Kanton+Gemeinde-Matching (regions-Tabelle, Migration 0008) — Gross-/
 * Kleinschreibung und mehrfache/führende/nachgestellte Leerzeichen dürfen nicht zu zwei
 * unterschiedlichen Regionszeilen für dieselbe Gemeinde führen.
 */
export function normalizeGemeinde(gemeinde: string): string {
  return gemeinde.trim().toLowerCase().replace(/\s+/g, " ");
}
