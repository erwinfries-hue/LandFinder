import { BESTANDSRENDITE_PARAMETERS, type BestandsrenditeParameterKey } from "@landfinder/financial-engine";
import { createSupabaseServerClient } from "./supabaseServer";
import type { ParameterOverrides } from "./bestandsrendite";

const KNOWN_KEYS = new Set(Object.keys(BESTANDSRENDITE_PARAMETERS));

function isKnownKey(key: string): key is BestandsrenditeParameterKey {
  return KNOWN_KEYS.has(key);
}

/**
 * Liest alle gespeicherten Annahmen-Überschreibungen (`app_settings`, Migration 0007) —
 * "Annahmen"-Reiter. Leeres Objekt, wenn Supabase nicht konfiguriert ist oder noch keine
 * Überschreibung gespeichert wurde — dann gilt überall unverändert der Registry-Default
 * aus BESTANDSRENDITE_PARAMETERS.
 */
export async function getParameterOverrides(): Promise<ParameterOverrides> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return {};
  const { data } = await supabase.from("app_settings").select("key,value");
  const overrides: ParameterOverrides = {};
  for (const row of data ?? []) {
    if (isKnownKey(row.key)) overrides[row.key] = row.value;
  }
  return overrides;
}

/**
 * Speichert eine Menge von Annahmen-Überschreibungen aus dem "Annahmen"-Reiter — ein
 * `null`-Wert löscht die Überschreibung wieder (Rückfall auf den Registry-Default,
 * transparent im Formular als "Standard: X" ausgewiesen statt eine Löschung zu
 * verstecken). Unbekannte Schlüssel werden ignoriert statt einen Fehler zu werfen —
 * schützt vor kaputten Requests, ohne dem Nutzer eine kryptische 500 zu zeigen.
 */
export async function saveParameterOverrides(values: Record<string, number | null>): Promise<{ saved: boolean; error?: string }> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return { saved: false, error: "Supabase nicht konfiguriert" };

  const toUpsert = Object.entries(values).filter(
    (entry): entry is [string, number] => isKnownKey(entry[0]) && typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  const toDelete = Object.entries(values)
    .filter(([key, value]) => isKnownKey(key) && (value === null || !Number.isFinite(value)))
    .map(([key]) => key);

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("app_settings").upsert(toUpsert.map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() })));
    if (error) return { saved: false, error: error.message };
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from("app_settings").delete().in("key", toDelete);
    if (error) return { saved: false, error: error.message };
  }
  return { saved: true };
}
