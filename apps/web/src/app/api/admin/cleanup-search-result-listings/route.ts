import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { isSearchResultsUrl } from "@/lib/inboundMail";

/**
 * Löscht `listings`-Zeilen, deren `canonical_url` eine Trefferlisten-/Such-URL ist
 * statt eines einzelnen Inserats (z.B. Homegate "Alle Treffer ansehen"-Link) — siehe
 * docs/OPEN_DECISIONS.md, Punkt A (2026-08-16). `extractPortalListingLinks()` filtert
 * solche Links seit demselben Datum aus, bevor sie überhaupt als `listings`-Zeile
 * gespeichert werden; diese Route räumt nur die vorher entstandenen, bereits
 * gespeicherten Altzeilen auf. Bewusst eng begrenzt: löscht ausschliesslich Zeilen, bei
 * denen `isSearchResultsUrl(canonical_url)` zutrifft — dieselbe Funktion, die die
 * Neuentstehung solcher Zeilen verhindert. Kann gefahrlos wiederholt aufgerufen werden,
 * findet dann einfach nichts mehr.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data: listings, error: listingsError } = await supabase.from("listings").select("id, canonical_url");
  if (listingsError) {
    console.error("[admin/cleanup-search-result-listings] Lesen von listings fehlgeschlagen", listingsError);
    return NextResponse.json({ error: "read listings failed" }, { status: 500 });
  }

  const toDelete = (listings ?? []).filter((l) => isSearchResultsUrl(l.canonical_url));
  if (toDelete.length === 0) {
    return NextResponse.json({ checked: listings?.length ?? 0, deleted: 0, deletedListings: [] });
  }

  const { error: deleteError } = await supabase.from("listings").delete().in("id", toDelete.map((l) => l.id));
  if (deleteError) {
    console.error("[admin/cleanup-search-result-listings] Löschen fehlgeschlagen", deleteError);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }

  return NextResponse.json({
    checked: listings?.length ?? 0,
    deleted: toDelete.length,
    deletedListings: toDelete.map((l) => ({ id: l.id, canonicalUrl: l.canonical_url })),
  });
}
