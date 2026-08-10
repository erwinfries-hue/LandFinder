import { NextResponse } from "next/server";

/**
 * TEMPORÄR (2026-08-07): gibt den nicht-geheimen Teil der Supabase-Konfiguration zurück,
 * damit sich das aktuell in Vercel gesetzte Projekt identifizieren lässt — Vercel zeigt
 * als "Sensitive" markierte Variablen nach dem Speichern nie wieder im Klartext an.
 * Durch die Middleware bereits login-geschützt. Nach Gebrauch wieder entfernen.
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
