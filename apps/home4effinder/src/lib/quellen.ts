import { createSupabaseServerClient } from "./supabaseServer";

/**
 * Quellenverzeichnis (Migration 0009) — allgemeine Studien/Marktberichte/
 * Referenzdokumente (z.B. UBS Wohnattraktivitätsindikator), unabhängig von Objekt oder
 * Region. Bewusst OHNE KI-Extraktion (anders als region_documents) — reine
 * Nachschlage-/Verlinkungsliste mit Titel/Kategorie/Herausgeber/Datum + Link (entweder
 * eine hochgeladene Datei ODER eine externe URL, siehe Migration).
 */
export interface QuelleRow {
  id: string;
  title: string;
  category: string;
  publisher: string | null;
  published_date: string | null;
  notes: string | null;
  external_url: string | null;
  storage_path: string | null;
  original_filename: string | null;
  created_at: string;
}

/** Vorschlagswerte für das Kategorie-Feld (Datalist, frei überschreibbar — kein starres Enum). */
export const QUELLEN_CATEGORY_SUGGESTIONS = ["Studie", "Marktbericht", "Gesetzestext", "Sonstiges"];

const SELECT_COLUMNS = "id, title, category, publisher, published_date, notes, external_url, storage_path, original_filename, created_at";

/** `null` = Supabase nicht konfiguriert; sonst die (ggf. leere) Ergebnisliste, neueste zuerst. */
export async function listQuellen(): Promise<QuelleRow[] | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("quellen").select(SELECT_COLUMNS).order("created_at", { ascending: false });
  if (error) {
    console.error("[quellen] listQuellen fehlgeschlagen", error);
    return [];
  }
  return data;
}

export async function getQuelleById(id: string): Promise<QuelleRow | null | undefined> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from("quellen").select(SELECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("[quellen] getQuelleById fehlgeschlagen", id, error);
    return null;
  }
  return data;
}
