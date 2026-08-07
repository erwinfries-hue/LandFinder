import type { ChipTone } from "@landfinder/ui";
import { createSupabaseServerClient } from "./supabaseServer";

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
  return data as ListingRow[];
}

export async function getListingById(id: string): Promise<ListingRow | null | undefined> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[listings] getListingById fehlgeschlagen", id, error);
    return null;
  }
  return data as ListingRow | null;
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

const STATUS_LABELS: Record<string, { label: string; tone: ChipTone }> = {
  NEW: { label: "Neu", tone: "neutral" },
  PARTIAL: { label: "Teilweise (LLM)", tone: "warn" },
  MANUAL_INPUT_REQUIRED: { label: "Manuell prüfen", tone: "warn" },
  BLOCKED: { label: "Blockiert", tone: "bad" },
  TIMEOUT: { label: "Timeout", tone: "bad" },
  NOT_AVAILABLE: { label: "Nicht erreichbar", tone: "bad" },
};

export function listingStatus(status: string): { label: string; tone: ChipTone } {
  return STATUS_LABELS[status] ?? { label: status, tone: "neutral" };
}

const OBJECT_TYPE_LABELS: Record<string, string> = {
  BAULAND: "Bauland",
  ABBRUCHOBJEKT: "Grundstück mit Abbruchobjekt",
};

export function objectTypeLabel(objectType: string | null): string {
  if (!objectType) return "—";
  return OBJECT_TYPE_LABELS[objectType] ?? objectType;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  });
}
