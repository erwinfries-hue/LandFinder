import { createSupabaseServerClient } from "./supabaseServer";
import { normalizeGemeinde } from "./gemeindeParsing";
import type { RegionExtractionResult, RegionQuantileRow } from "./regionExtraction";

/** Eine Region (Kanton+Gemeinde), `regions`-Tabelle (Migration 0008). */
export interface RegionRow {
  id: string;
  canton: string;
  gemeinde: string;
  created_at: string;
}

export interface RegionDocumentRow {
  id: string;
  region_id: string;
  original_filename: string;
  uploaded_at: string;
  analysis_status: string;
  analysis_error: string | null;
  extraction: RegionExtractionResult | null;
  analyzed_at: string | null;
  report_date: string | null;
  content_hash: string;
}

/** `null` = Supabase nicht konfiguriert; sonst die (ggf. leere) Ergebnisliste. */
export async function listRegions(): Promise<RegionRow[] | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("regions").select("id, canton, gemeinde, created_at").order("canton").order("gemeinde");
  if (error) {
    console.error("[regionMarketData] listRegions fehlgeschlagen", error);
    return [];
  }
  return data;
}

export async function getRegionById(id: string): Promise<RegionRow | null | undefined> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from("regions").select("id, canton, gemeinde, created_at").eq("id", id).maybeSingle();
  if (error) {
    console.error("[regionMarketData] getRegionById fehlgeschlagen", id, error);
    return null;
  }
  return data;
}

/** Neuester Report zuerst — nach `report_date` (Abfragedatum aus dem Report), Dokumente ohne erkanntes Datum per `uploaded_at` einsortiert. */
export async function getRegionDocuments(regionId: string): Promise<RegionDocumentRow[]> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("region_documents")
    .select("id, region_id, original_filename, uploaded_at, analysis_status, analysis_error, extraction, analyzed_at, report_date, content_hash")
    .eq("region_id", regionId)
    .order("report_date", { ascending: false, nullsFirst: false })
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error("[regionMarketData] getRegionDocuments fehlgeschlagen", regionId, error);
    return [];
  }
  return data;
}

export async function getRegionByCantonGemeinde(canton: string, gemeinde: string): Promise<RegionRow | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("regions")
    .select("id, canton, gemeinde, created_at")
    .eq("canton", canton)
    .eq("gemeinde_normalized", normalizeGemeinde(gemeinde))
    .maybeSingle();
  if (error) {
    console.error("[regionMarketData] getRegionByCantonGemeinde fehlgeschlagen", canton, gemeinde, error);
    return null;
  }
  return data;
}

/**
 * Liefert die Extraktion des NEUESTEN erfolgreich analysierten Reports für die
 * gegebene Kanton+Gemeinde-Kombination, oder `null`, wenn keine Region existiert oder
 * (noch) kein Dokument erfolgreich analysiert wurde. Wird sowohl vom
 * Markteinordnungs-Panel als auch — in PR B — von der Finanz-Engine-Anbindung
 * verwendet, siehe deriveRegionDefaults unten.
 */
export async function getRegionMarketData(canton: string, gemeinde: string): Promise<RegionExtractionResult | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  const region = await getRegionByCantonGemeinde(canton, gemeinde);
  if (!region) return null;

  const { data, error } = await supabase
    .from("region_documents")
    .select("extraction")
    .eq("region_id", region.id)
    .eq("analysis_status", "DONE")
    .order("report_date", { ascending: false, nullsFirst: false })
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[regionMarketData] getRegionMarketData fehlgeschlagen", canton, gemeinde, error);
    return null;
  }
  return (data?.extraction as RegionExtractionResult | null) ?? null;
}

export type QuantilePosition = { kind: "interpolated"; percent: number } | { kind: "below"; boundaryPercent: 10 } | { kind: "above"; boundaryPercent: 90 };

const QUANTILE_POINTS: { percent: number; key: keyof Pick<RegionQuantileRow, "q10" | "q30" | "q50" | "q70" | "q90"> }[] = [
  { percent: 10, key: "q10" },
  { percent: 30, key: "q30" },
  { percent: 50, key: "q50" },
  { percent: 70, key: "q70" },
  { percent: 90, key: "q90" },
];

/**
 * Lineare Interpolation zwischen den fünf Quantilpunkten einer Region-Preistabellenzeile
 * — für Werte ausserhalb 10-90% wird bewusst NICHT extrapoliert (eine extrapolierte Zahl
 * ausserhalb des tatsächlich beobachteten Bereichs wäre unplausibel präzise), sondern nur
 * "unter 10%-Quantil"/"über 90%-Quantil" zurückgegeben.
 */
export function estimateQuantilePosition(value: number, row: RegionQuantileRow): QuantilePosition {
  if (value <= row.q10) return { kind: "below", boundaryPercent: 10 };
  if (value >= row.q90) return { kind: "above", boundaryPercent: 90 };

  for (let i = 0; i < QUANTILE_POINTS.length - 1; i++) {
    const lower = QUANTILE_POINTS[i];
    const upper = QUANTILE_POINTS[i + 1];
    const lowerValue = row[lower.key];
    const upperValue = row[upper.key];
    if (value >= lowerValue && value <= upperValue) {
      const span = upperValue - lowerValue;
      const fraction = span > 0 ? (value - lowerValue) / span : 0;
      return { kind: "interpolated", percent: lower.percent + fraction * (upper.percent - lower.percent) };
    }
  }
  // Nicht-monotone Quantile in den Rohdaten (q10<=q30<=... verletzt) — sollte bei
  // sauber extrahierten Daten nicht vorkommen, aber besser ein grober Mittelwert als ein Wurf.
  return { kind: "interpolated", percent: 50 };
}

/** Passende Zeile für eine bestimmte Zimmerzahl — nächstgelegene, falls die exakte Zimmerzahl im Report fehlt. */
export function findClosestQuantileRow(rows: RegionQuantileRow[], zimmerzahl: number): RegionQuantileRow | undefined {
  if (rows.length === 0) return undefined;
  return rows.reduce((closest, row) => (Math.abs(row.zimmerzahl - zimmerzahl) < Math.abs(closest.zimmerzahl - zimmerzahl) ? row : closest));
}
