import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/authSession";
import { getPropertyById, getPropertyDueDiligence } from "@/lib/properties";
import { computeBestandsrenditeAnalysis, computeVerhandlungskorridor, computeMoeblierungsAlternative, parseBestandsrenditeFacts } from "@/lib/bestandsrendite";
import { computeInvestmentScore } from "@/lib/investmentScore";
import { renderManagementSummaryPdf } from "@/lib/managementSummaryPdf";

export const maxDuration = 30;

/**
 * Liefert das Management-Summary als PDF-Datei zum direkten Download (`<a href>`, keine
 * Fetch-API nötig — die Session prüft `hasValidSession` wie bei jeder anderen Route,
 * zusätzlich zur globalen `middleware.ts`). Rendert bei jedem Aufruf frisch aus den
 * aktuell gespeicherten Daten, kein gecachtes PDF (siehe managementSummaryPdf.tsx).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: propertyId } = await params;
  const property = await getPropertyById(propertyId);
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  const factsParsed = property.bestandsrendite ? parseBestandsrenditeFacts(property.bestandsrendite) : null;
  const facts = factsParsed && "facts" in factsParsed ? factsParsed.facts : null;
  if (!facts) return NextResponse.json({ error: "keine Bestandsrendite-Fakten erfasst — Management Summary noch nicht möglich" }, { status: 400 });

  const propertyInput = { kaufpreisChf: property.asking_price_chf, wohnflaecheM2: property.wohnflaeche_m2, canton: property.canton };
  const analysis = computeBestandsrenditeAnalysis(propertyInput, facts);
  const verhandlungskorridor = computeVerhandlungskorridor(propertyInput, facts);
  const moeblierungsAlternative = computeMoeblierungsAlternative(propertyInput, facts);
  const dueDiligence = await getPropertyDueDiligence(propertyId);

  const investmentScore = dueDiligence?.result
    ? computeInvestmentScore({
        categories: dueDiligence.result.categories,
        missingDocuments: dueDiligence.result.missingDocuments,
        bruttoRenditePercent: analysis.schnellcheck.bruttoRenditePercent,
        cashflowChf: analysis.schnellcheck.groberCashflowChf,
      })?.totalScore
    : undefined;

  const pdfBuffer = await renderManagementSummaryPdf({
    addressText: property.title || property.address_text,
    canton: property.canton,
    generatedAt: new Date(),
    analysis,
    verhandlungskorridor,
    dueDiligence: dueDiligence?.result ?? null,
    investmentScore,
    moeblierungsAlternative,
  });

  const safeFilename = (property.title || property.address_text).replace(/[^a-zA-Z0-9äöüÄÖÜ_.-]+/g, "_");
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Management-Summary_${safeFilename}.pdf"`,
    },
  });
}
