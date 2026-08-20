import { NextResponse } from "next/server";
import type { DueDiligenceDocumentType } from "@landfinder/domain";
import { hasValidSession } from "@/lib/authSession";
import { DOCUMENT_TYPE_CATALOG } from "@/lib/documentTypes";
import {
  extractDocumentFields,
  AnthropicNotConfiguredError,
  MAX_DOCUMENT_SIZE_BYTES,
  isSupportedDocumentFile,
  isPdfDocumentFile,
  type DocumentSourceInput,
} from "@/lib/dueDiligenceExtraction";

/**
 * Zustandslose Vorab-Analyse eines Dokuments (typischerweise Exposé), BEVOR ein Objekt
 * überhaupt existiert — kein property_id vorhanden, daher weder DB-Zeile noch
 * Storage-Upload hier. Liefert nur das Extraktionsergebnis zurück, mit dem der Client
 * das Erfassungsformular vorausfüllt. Der Client hält Datei + Ergebnis im Speicher und
 * schickt beides beim tatsächlichen "Objekt anlegen" an
 * `/api/properties/[id]/documents/attach`, damit die (teure) Claude-Analyse nicht ein
 * zweites Mal läuft.
 */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
  if (!isSupportedDocumentFile(file)) {
    return NextResponse.json({ error: "Nur PDF- oder Text-Dateien werden unterstützt" }, { status: 400 });
  }

  const source: DocumentSourceInput = isPdfDocumentFile(file)
    ? { kind: "pdf", pdfBase64: Buffer.from(await file.arrayBuffer()).toString("base64") }
    : { kind: "text", text: await file.text() };
  try {
    const extraction = await extractDocumentFields(source, documentType, file.name);
    return NextResponse.json({ analyzed: true, extraction });
  } catch (err) {
    const message = err instanceof AnthropicNotConfiguredError ? err.message : "Analyse fehlgeschlagen";
    console.error("[api/properties/prefill] Analyse fehlgeschlagen", err);
    return NextResponse.json({ analyzed: false, error: message }, { status: 502 });
  }
}
