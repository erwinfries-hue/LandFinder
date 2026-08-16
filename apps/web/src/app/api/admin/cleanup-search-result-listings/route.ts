import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { isSearchResultsUrl } from "@/lib/inboundMail";

/**
 * Löscht `listings`-Zeilen, deren `canonical_url` eine Trefferlisten-/Such-URL ist
 * statt eines einzelnen Inserats (z.B. Homegate "Alle Treffer ansehen"-Link) — siehe
 * docs/OPEN_DECISIONS.md, Punkt A (2026-08-16). `extractPortalListingLinks()` filtert
 * solche Links seit demselben Datum aus, bevor sie überhaupt als `listings`-Zeile
 * gespeichert werden; diese Funktion räumt nur die vorher entstandenen, bereits
 * gespeicherten Altzeilen auf. Bewusst eng begrenzt: löscht ausschliesslich Zeilen, bei
 * denen `isSearchResultsUrl(canonical_url)` zutrifft — dieselbe Funktion, die die
 * Neuentstehung solcher Zeilen verhindert. Kann gefahrlos wiederholt aufgerufen werden,
 * findet dann einfach nichts mehr. Als eigenständige Funktion exportiert, damit sowohl
 * die (Session-geschützte) manuelle Route unten als auch der tägliche Cron-Job
 * (`api/cron/maintenance/route.ts`) dieselbe Logik nutzen, ohne sich per HTTP
 * gegenseitig aufzurufen.
 */
export async function runCleanupSearchResultListings(supabase: SupabaseClient) {
  const { data: listings, error: listingsError } = await supabase.from("listings").select("id, canonical_url");
  if (listingsError) {
    console.error("[cleanup-search-result-listings] Lesen von listings fehlgeschlagen", listingsError);
    return { error: "read listings failed" as const };
  }

  const toDelete = (listings ?? []).filter((l) => isSearchResultsUrl(l.canonical_url));
  if (toDelete.length === 0) {
    return { checked: listings?.length ?? 0, deleted: 0, deletedListings: [] };
  }

  const { error: deleteError } = await supabase.from("listings").delete().in("id", toDelete.map((l) => l.id));
  if (deleteError) {
    console.error("[cleanup-search-result-listings] Löschen fehlgeschlagen", deleteError);
    return { error: "delete failed" as const };
  }

  return {
    checked: listings?.length ?? 0,
    deleted: toDelete.length,
    deletedListings: toDelete.map((l) => ({ id: l.id, canonicalUrl: l.canonical_url })),
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const result = await runCleanupSearchResultListings(supabase);
  if ("error" in result) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
