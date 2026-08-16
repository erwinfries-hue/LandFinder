import type { ChipTone } from "@landfinder/ui";
import { createSupabaseServerClient } from "./supabaseServer";
import { deriveCantonFromAddress } from "./plzKanton";

/**
 * Lesezugriff auf die echten Stufe-1/2-Daten (`inbound_alerts`, `listings`) für die
 * Quellen-Seite (siehe apps/web/src/app/quellen/page.tsx). Bisher nur über das
 * Supabase-Dashboard einsehbar — hier erstmals innerhalb von LandFinder selbst.
 */

export interface ListingRow {
  id: string;
  canonical_url: string;
  source: string;
  title: string | null;
  description: string | null;
  object_type: string | null;
  address_text: string | null;
  canton: string | null;
  municipality: string | null;
  asking_price_chf: number | null;
  parcel_area_m2: number | null;
  existing_building: boolean | null;
  known_zone: string | null;
  extraction: { method?: string; confidence?: number } & Record<string, unknown>;
  ingestion_status: string;
  first_seen_at: string;
  last_seen_at: string;
  active: boolean;
  /** Diagnose des letzten Stufe-2-Abrufversuchs (Migration 0004) — z.B. um ein Portal-Blocking (HTTP 403/429) nachzuvollziehen. */
  last_fetch_http_status: number | null;
  last_fetch_at: string | null;
  /** Zeitpunkt der Alert-Mail, falls je eine ausgelöst wurde (Migration 0005, siehe listingAlerts.ts). */
  alert_sent_at: string | null;
  /** Manuell erfasste Vertiefungsdaten (Migration 0007, siehe listingVertiefung.ts) — `null`, bis "Objekt vertiefen" ausgeführt wurde. */
  vertiefung: Record<string, unknown> | null;
  vertiefung_updated_at: string | null;
}

export interface InboundAlertRow {
  id: string;
  received_at: string;
  from_address: string;
  subject: string;
  portal_message_date: string | null;
  listing_links: string[];
  processed: boolean;
}

/**
 * Ergänzt einen fehlenden Kanton anhand der PLZ im Adresstext (`plzKanton.ts`) — rein
 * in der Anzeige-/Anwendungsschicht, schreibt nichts in die Datenbank zurück. Betrifft
 * z.B. Inserate, deren Kanton nicht separat extrahiert wurde, aber deren Adresstext
 * bereits eine eindeutige PLZ enthält.
 */
export function withDerivedCanton(row: ListingRow): ListingRow {
  if (row.canton) return row;
  const derived = deriveCantonFromAddress(row.address_text);
  return derived ? { ...row, canton: derived } : row;
}

/** `null` = Supabase nicht konfiguriert; sonst die (ggf. leere) Ergebnisliste. */
export async function getListings(limit = 100): Promise<ListingRow[] | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[listings] getListings fehlgeschlagen", error);
    return [];
  }
  return (data as ListingRow[]).map(withDerivedCanton);
}

export async function getListingById(id: string): Promise<ListingRow | null | undefined> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[listings] getListingById fehlgeschlagen", id, error);
    return null;
  }
  return data ? withDerivedCanton(data as ListingRow) : null;
}

/**
 * Andere bereits vertiefte echte Inserate im selben Kanton — die Vergleichsgruppe für
 * den Kantonsvergleich auf `/quellen/[id]` (siehe ListingLiveAnalysis.tsx). Bewusst nur
 * unter vertieften Inseraten, nicht allen — ohne Vertiefungsdaten liesse sich für sie
 * gar kein Score berechnen.
 */
export async function getVertieftePeersInCanton(
  canton: string,
  excludeId: string,
): Promise<Pick<ListingRow, "id" | "canton" | "object_type" | "asking_price_chf" | "parcel_area_m2" | "vertiefung">[]> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("listings")
    .select("id, canton, object_type, asking_price_chf, parcel_area_m2, vertiefung")
    .eq("canton", canton)
    .not("vertiefung", "is", null)
    .neq("id", excludeId);
  if (error) {
    console.error("[listings] getVertieftePeersInCanton fehlgeschlagen", canton, error);
    return [];
  }
  return data;
}

export async function getInboundAlerts(limit = 50): Promise<InboundAlertRow[] | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("inbound_alerts")
    .select("id, received_at, from_address, subject, portal_message_date, listing_links, processed")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[listings] getInboundAlerts fehlgeschlagen", error);
    return [];
  }
  return data as InboundAlertRow[];
}

const STATUS_LABELS: Record<string, { label: string; shortLabel: string; tone: ChipTone }> = {
  NEW: { label: "Neu", shortLabel: "Neu", tone: "neutral" },
  PARTIAL: { label: "Teilweise (LLM)", shortLabel: "LLM", tone: "warn" },
  MANUAL_INPUT_REQUIRED: { label: "Manuell prüfen", shortLabel: "Prüf", tone: "warn" },
  BLOCKED: { label: "Blockiert", shortLabel: "Blk", tone: "bad" },
  TIMEOUT: { label: "Timeout", shortLabel: "Zeit", tone: "bad" },
  NOT_AVAILABLE: { label: "Nicht erreichbar", shortLabel: "Fehl", tone: "bad" },
};

/** `shortLabel` ist die abgekürzte Fassung für schmale Tabellenspalten (siehe QuellenListingsTable.tsx) — `label` bleibt der volle Begriff, z.B. für den Hover-Text oder die Detailseite. */
export function listingStatus(status: string): { label: string; shortLabel: string; tone: ChipTone } {
  return STATUS_LABELS[status] ?? { label: status, shortLabel: status, tone: "neutral" };
}

const OBJECT_TYPE_LABELS: Record<string, string> = {
  BAULAND: "Bauland",
  ABBRUCHOBJEKT: "Grundstück mit Abbruchobjekt",
};

export function objectTypeLabel(objectType: string | null): string {
  if (!objectType) return "—";
  return OBJECT_TYPE_LABELS[objectType] ?? objectType;
}

/** Baujahr eines erkannten bestehenden Gebäudes — liegt nur in `extraction.fields` (jsonb), keine eigene Spalte (siehe listingExtraction.ts). */
export function extractionBuildYear(row: ListingRow): number | undefined {
  const fields = row.extraction?.fields as Record<string, unknown> | undefined;
  const year = fields?.buildYear;
  return typeof year === "number" ? year : undefined;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });
}
