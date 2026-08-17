import { NextResponse } from "next/server";
import { searchSwissAddress } from "@/lib/geoAdmin";

/**
 * Dünner Server-Proxy für die swisstopo-Adress-Suche (siehe geoAdmin.ts) — läuft
 * serverseitig statt direkt im Browser, damit kein CORS-Setup gegen eine externe
 * Domain nötig ist. Durch die globale Login-Middleware bereits geschützt (kein
 * öffentlicher Präfix), kein zusätzlicher Auth-Check hier nötig.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const results = await searchSwissAddress(searchParams.get("q") ?? "");
  return NextResponse.json({ results });
}
