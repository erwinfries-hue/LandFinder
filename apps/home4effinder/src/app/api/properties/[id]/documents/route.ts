import { NextResponse } from "next/server";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";
import { DOCUMENT_TYPE_CATALOG } from "@/lib/documentTypes";
import { extractDocumentFields, AnthropicNotConfiguredError, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/dueDiligenceExtraction";

/**
 * Upload + Stufe-1-Analyse eines einzelnen Due-Diligence-Dokuments. Bewusst **ein
 * Dokument pro Request**, synchron abgearbeitet (kein Zwischenstatus "ANALYZING" über
 * mehrere Requests, keine Job-Queue/Polling-Infrastruktur) — hält die Umsetzung
 * einfach. Mehrere PDFs gleichzeitig hochladen bedeutet: der Client schickt mehrere
 * Requests (parallel oder nacheinander), nicht einen Multi-File-Request — sonst würde
 * ein einzelner Request potenziell mehrere Minuten-lange LLM-Aufrufe bündeln und das
 * Vercel-Zeitbudget riskieren (siehe `maxDuration` unten).
 */
export const maxDuration = 60;

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
  if (!(file instanceof File)) return NextResponse.json({ error: "file fehlt" }, { status: 400 });
  if (typeof documentTypeRaw !== "string" || !(documentTypeRaw in DOCUMENT_TYPE_CATALOG)) {
    return NextResponse.json({ error: "documentType fehlt oder unbekannt" }, { status: 400 });
  }
  const documentType = documentTypeRaw as DueDiligenceDocumentType;

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json({ error: `Datei zu gross (max. ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)} MB)` }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Nur PDF-Dateien werden unterstützt" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data: property, error: propertyError } = await supabase.from("properties").select("id").eq("id", propertyId).maybeSingle();
  if (propertyError) {
    console.error(`[api/properties/${propertyId}/documents] Lesen des Objekts fehlgeschlagen`, propertyError);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storagePath = `${propertyId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from("property-documents").upload(storagePath, bytes, { contentType: "application/pdf" });
  if (uploadError) {
    console.error(`[api/properties/${propertyId}/documents] Upload in Storage fehlgeschlagen`, uploadError);
    return NextResponse.json({ error: "storage upload failed" }, { status: 500 });
  }

  const { data: docRow, error: insertError } = await supabase
    .from("property_documents")
    .insert({ property_id: propertyId, document_type: documentType, storage_path: storagePath, original_filename: file.name })
    .select("id")
    .single();
  if (insertError) {
    console.error(`[api/properties/${propertyId}/documents] Anlegen der Dokument-Zeile fehlgeschlagen`, insertError);
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  const pdfBase64 = Buffer.from(bytes).toString("base64");
  try {
    const extraction = await extractDocumentFields(pdfBase64, documentType, file.name);
    await supabase
      .from("property_documents")
      .update({ analysis_status: "DONE", extraction, analyzed_at: new Date().toISOString() })
      .eq("id", docRow.id);
    return NextResponse.json({ saved: true, id: docRow.id, status: "DONE", extraction }, { status: 201 });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Analyse fehlgeschlagen";
    console.error(`[api/properties/${propertyId}/documents] Analyse fehlgeschlagen`, err);
    await supabase.from("property_documents").update({ analysis_status: "FAILED", analysis_error: message }).eq("id", docRow.id);
    return NextResponse.json({ saved: true, id: docRow.id, status: "FAILED", error: message }, { status: 201 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: propertyId } = await params;

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ documents: [] }, { status: 200 });

  const { data, error } = await supabase
    .from("property_documents")
    .select("id, document_type, original_filename, uploaded_at, analysis_status, analysis_error, extraction, analyzed_at")
    .eq("property_id", propertyId)
    .order("uploaded_at", { ascending: false });
  if (error) {
    console.error(`[api/properties/${propertyId}/documents] Lesen fehlgeschlagen`, error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}
