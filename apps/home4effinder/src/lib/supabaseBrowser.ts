"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * NUR für Direct-Uploads via Signed URL (siehe RegionUploadForm.tsx) — Vercel-
 * Serverless-Functions haben ein hartes Payload-Limit von 4.5 MB, ein 90-seitiger
 * Regionsreport (mehrere MB, siehe Wüest-Partner-Beispiel) überschreitet das leicht
 * und liess den Upload sofort mit einem generischen "Netzwerkfehler" fehlschlagen
 * (Live-Test-Rückmeldung — die Anfrage wurde von der Plattform abgelehnt, bevor der
 * Route-Handler-Code überhaupt lief). Die grosse Datei lädt der Client deshalb DIREKT
 * zu Supabase Storage hoch (der Server mint nur eine kleine Signed-URL, kein grosser
 * Payload läuft mehr durch die Vercel-Function).
 *
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` ist bewusst ein NEUER Env-Var — bisher lief
 * jeglicher Supabase-Zugriff ausschliesslich serverseitig über den service_role-Key.
 * Für einen Signed-Upload reicht der öffentliche Anon-Key: die eigentliche
 * Berechtigung steckt im Token der Signed URL (server-seitig mit dem service_role-Key
 * gemintet, siehe api/regions/[id]/documents/signed-upload-url/route.ts), nicht in
 * einer RLS-Policy — `uploadToSignedUrl` benötigt laut Supabase-SDK explizit KEINE
 * RLS-Policy-Berechtigung.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}
