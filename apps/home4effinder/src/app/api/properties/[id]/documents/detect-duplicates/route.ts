import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

export const maxDuration = 60;

/**
 * Findet byte-identische Dokument-Dubletten eines Objekts anhand des SHA-256-Content-Hash
 * (`content_hash`) — bewusst NICHT anhand von Dateinamen-Mustern (z.B. "-1"-Suffix): ein
 * gleicher/ähnlicher Dateiname beweist keine Inhaltsgleichheit, und umgekehrt könnten zwei
 * völlig unterschiedlich benannte Dateien zufällig denselben Inhalt haben (z.B. zweimal
 * dieselbe PDF hochgeladen). Bereits hochgeladene Dokumente ohne `content_hash` (vor
 * Migration 0006 hochgeladen) werden hier nachträglich gehasht (Backfill), erst danach
 * gruppiert — sonst blieben ältere Dubletten unentdeckt.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ checked: false, configured: false }, { status: 200 });

  const { data: docs, error: fetchError } = await supabase
    .from("property_documents")
    .select("id, original_filename, uploaded_at, storage_path, content_hash")
    .eq("property_id", propertyId)
    .order("uploaded_at", { ascending: true });
  if (fetchError) {
    console.error(`[api/properties/${propertyId}/documents/detect-duplicates] Lesen fehlgeschlagen`, fetchError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!docs || docs.length === 0) return NextResponse.json({ duplicateGroups: [] });

  const hashById = new Map<string, string>();
  for (const doc of docs) {
    if (doc.content_hash) {
      hashById.set(doc.id, doc.content_hash);
      continue;
    }
    // Backfill: Dokument wurde vor Migration 0006 hochgeladen, hat noch keinen Hash.
    const { data: blob, error: downloadError } = await supabase.storage.from("property-documents").download(doc.storage_path);
    if (downloadError || !blob) {
      console.error(`[api/properties/${propertyId}/documents/detect-duplicates] Download für Backfill fehlgeschlagen`, doc.id, downloadError);
      continue; // dieses eine Dokument bleibt beim Duplikat-Abgleich unberücksichtigt, statt den ganzen Request scheitern zu lassen
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    await supabase.from("property_documents").update({ content_hash: hash }).eq("id", doc.id);
    hashById.set(doc.id, hash);
  }

  const groups = new Map<string, { id: string; filename: string; uploadedAt: string }[]>();
  for (const doc of docs) {
    const hash = hashById.get(doc.id);
    if (!hash) continue;
    const entry = { id: doc.id, filename: doc.original_filename, uploadedAt: doc.uploaded_at };
    const existing = groups.get(hash);
    if (existing) existing.push(entry);
    else groups.set(hash, [entry]);
  }

  // `docs` ist bereits nach uploaded_at aufsteigend sortiert, daher ist innerhalb jeder
  // Gruppe automatisch das älteste Dokument zuerst — Löschvorschlag betrifft die jüngeren.
  const duplicateGroups = [...groups.entries()]
    .filter(([, documents]) => documents.length > 1)
    .map(([contentHash, documents]) => ({ contentHash, documents }));

  return NextResponse.json({ duplicateGroups });
}
