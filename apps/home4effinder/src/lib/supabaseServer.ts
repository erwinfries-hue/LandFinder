import { createClient } from "@supabase/supabase-js";

/**
 * Nur serverseitig verwenden (z.B. Route Handlers) — der service_role-Key umgeht
 * Row Level Security vollständig. Niemals in eine "use client"-Komponente importieren.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
