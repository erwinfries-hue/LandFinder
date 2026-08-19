import { NextResponse } from "next/server";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { DOCUMENT_TYPE_CATALOG } from "@/lib/documentTypes";
import { parseDocumentExtractionResponse, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/dueDiligenceExtraction";

/**
 * Hängt ein Dokument an ein GERADE erst angelegtes Objekt an, dessen Stufe-1-Analyse
 * bereits vorher über `/api/properties/prefill` gelaufen ist (Objekt-Erfassung "aus
 * Dokumenten vorausfüllen") — lädt die Datei hoch und übernimmt das mitgeschickte
 * Extraktionsergebnis 1:1, statt Claude ein zweites Mal für dasselbe Dokument
 * aufzurufen. Das mitgeschickte JSON läuft trotzdem durch denselben defensiven Parser
 * wie eine frische LLM-Antwort — der Client ist hier nur der eine bekannte Nutzer
 * dieser App, aber Struktur-/Typprüfung kostet nichts und hält den Code konsistent.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const documentTypeRaw = formData.get("documentType");
  const extractionRaw = formData.get("extraction");
  if (!(file instanceof File)) return NextResponse.json({ error: "file fehlt" }, { status: 400 });
  if (typeof documentTypeRaw !== "string" || !(documentTypeRaw in DOCUMENT_TYPE_CATALOG)) {
    return NextResponse.json({ error: "documentType fehlt oder unbekannt" }, { status: 400 });
  }
  if (typeof extractionRaw !== "string") return NextResponse.json({ error: "extraction fehlt" }, { status: 400 });
  const documentType = documentTypeRaw as DueDiligenceDocumentType;

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json({ error: `Datei zu gross (max. ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB)` }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Nur PDF-Dateien werden unterstützt" }, { status: 400 });
  }

  let extraction;
  try {
    extraction = parseDocumentExtractionResponse(extractionRaw, documentType);
  } catch {
    return NextResponse.json({ error: "extraction ist kein gültiges JSON" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: property, error: propertyError } = await supabase.from("properties").select("id").eq("id", propertyId).maybeSingle();
  if (propertyError) {
    console.error(`[api/properties/${propertyId}/documents/attach] Lesen des Objekts fehlgeschlagen`, propertyError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Siehe Kommentar in documents/route.ts — Storage-Key bewusst ohne Original-Dateinamen.
  const storagePath = `${propertyId}/${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage.from("property-documents").upload(storagePath, bytes, { contentType: "application/pdf" });
  if (uploadError) {
    console.error(`[api/properties/${propertyId}/documents/attach] Upload in Storage fehlgeschlagen`, uploadError);
    return NextResponse.json({ error: "storage upload failed" }, { status: 500 });
  }

  const { data: docRow, error: insertError } = await supabase
    .from("property_documents")
    .insert({
      property_id: propertyId,
      document_type: documentType,
      storage_path: storagePath,
      original_filename: file.name,
      analysis_status: "DONE",
      extraction,
      analyzed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) {
    console.error(`[api/properties/${propertyId}/documents/attach] Anlegen der Dokument-Zeile fehlgeschlagen`, insertError);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: docRow.id }, { status: 201 });
}
