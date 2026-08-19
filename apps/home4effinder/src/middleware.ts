import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE_NAME } from "@/lib/authSession";

/**
 * Zugriffsschutz für die ganze App — Login prüft nur die eine bekannte E-Mail-Adresse
 * des Auftraggebers (kein Passwort, kein Multi-User-Login). Ausgenommen: die
 * Login-Seite/-API selbst.
 *
 * Fail closed: ist SESSION_SIGNING_SECRET nicht gesetzt, bleibt der Zugriff gesperrt
 * statt die Lücke offen zu lassen.
 */
const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/api/auth/"];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/");
  const signingSecret = process.env.SESSION_SIGNING_SECRET;

  if (!signingSecret) {
    if (isApiRoute) return NextResponse.json({ error: "not configured" }, { status: 503 });
    const url = new URL("/login", request.url);
    url.searchParams.set("reason", "not-configured");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!(await isValidSessionToken(token, signingSecret))) {
    if (isApiRoute) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
