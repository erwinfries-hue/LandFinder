import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { hasValidSession } from "@/lib/authSession";

export async function POST(request: Request): Promise<Response> {
  if (!(await hasValidSession(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const addressText = typeof b.addressText === "string" ? b.addressText.trim() : "";
  const canton = typeof b.canton === "string" ? b.canton.trim() : "";
  const askingPriceChf = typeof b.askingPriceChf === "number" ? b.askingPriceChf : undefined;
  const wohnflaecheM2 = typeof b.wohnflaecheM2 === "number" ? b.wohnflaecheM2 : undefined;

  if (!addressText) return NextResponse.json({ error: "addressText fehlt" }, { status: 400 });
  if (!canton) return NextResponse.json({ error: "canton fehlt" }, { status: 400 });
  if (askingPriceChf === undefined || askingPriceChf <= 0) return NextResponse.json({ error: "askingPriceChf fehlt oder ungültig" }, { status: 400 });
  if (wohnflaecheM2 === undefined || wohnflaecheM2 <= 0) return NextResponse.json({ error: "wohnflaecheM2 fehlt oder ungültig" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ saved: false, configured: false }, { status: 200 });

  const { data, error } = await supabase
    .from("properties")
    .insert({
      title: addressText,
      address_text: addressText,
      canton,
      asking_price_chf: askingPriceChf,
      wohnflaeche_m2: wohnflaecheM2,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[api/properties] Anlegen fehlgeschlagen", error);
    return NextResponse.json({ saved: false, error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: data.id }, { status: 201 });
}
