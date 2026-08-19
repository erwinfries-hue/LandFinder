import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/authSession";

/**
 * Einziger zugelassener Nutzer — diese App ist ausschliesslich für den Auftraggeber
 * persönlich bestimmt, die bekannte E-Mail-Adresse allein genügt als Zugriffsschutz.
 * Bewusst als Konstante statt Umgebungsvariable: keine geheime Zeichenfolge, die
 * separat verteilt/rotiert werden müsste.
 */
const ALLOWED_EMAIL = "erwin.fries@gmx.ch";

export async function POST(request: Request): Promise<Response> {
  // Reiner Signierschlüssel für das Session-Cookie (siehe authSession.ts) — nichts,
  // was ein Nutzer eingibt. Fail-closed: ohne gesetzten Schlüssel bleibt der Zugriff
  // gesperrt statt offen.
  const signingSecret = process.env.SESSION_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "Login ist noch nicht konfiguriert (SESSION_SIGNING_SECRET fehlt als Umgebungsvariable)." },
      { status: 503 },
    );
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.email || body.email.trim().toLowerCase() !== ALLOWED_EMAIL) {
    return NextResponse.json({ error: "Unbekannte E-Mail-Adresse." }, { status: 401 });
  }

  const token = await createSessionToken(signingSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
