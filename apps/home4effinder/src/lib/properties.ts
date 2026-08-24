import { createSupabaseServerClient } from "./supabaseServer";

/** Eine erfasste Bestandswohnung (`properties`-Tabelle, Migration 0001). */
export interface PropertyRow {
  id: string;
  title: string | null;
  address_text: string;
  canton: string;
  asking_price_chf: number;
  wohnflaeche_m2: number;
  /** Rein informativer Referenz-Link zum Original-Inserat — wird nie automatisch abgerufen/ausgelesen (siehe docs/DECISIONS.md, Homegate-Blockade-Erfahrung aus LandFinder). */
  listing_url: string | null;
  /** Freitext-Marktvergleichsnotizen (Migration 0003) — manuell vom Nutzer erfasst, kein automatischer Abruf/Scraping, analog zu listing_url. */
  market_reference_notes: string | null;
  /** Bestandsrendite-Fakten (siehe bestandsrendite.ts) — `null`, bis "Bestandsrendite-Fakten erfassen" ausgeführt wurde. */
  bestandsrendite: Record<string, unknown> | null;
  bestandsrendite_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

/** `null` = Supabase nicht konfiguriert; sonst die (ggf. leere) Ergebnisliste. */
export async function getProperties(limit = 100): Promise<PropertyRow[] | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("[properties] getProperties fehlgeschlagen", error);
    return [];
  }
  return data as PropertyRow[];
}

export async function getPropertyById(id: string): Promise<PropertyRow | null | undefined> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[properties] getPropertyById fehlgeschlagen", id, error);
    return null;
  }
  return data as PropertyRow | null;
}

/** Hochgeladene Due-Diligence-Dokumente eines Objekts, neueste zuerst. */
export async function getPropertyDocuments(propertyId: string) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("property_documents")
    .select("id, document_type, original_filename, uploaded_at, analysis_status, analysis_error, extraction, excluded_from_synthesis")
    .eq("property_id", propertyId)
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error("[properties] getPropertyDocuments fehlgeschlagen", propertyId, error);
    return [];
  }
  return data;
}

/** Persistierte Due-Diligence-Synthese eines Objekts (Stufe 2), `null` wenn noch nie angestossen. */
export async function getPropertyDueDiligence(propertyId: string) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("property_due_diligence")
    .select("status, error_message, result, generated_at, dismissed_field_proposals")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) {
    console.error("[properties] getPropertyDueDiligence fehlgeschlagen", propertyId, error);
    return null;
  }
  return data;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });
}
