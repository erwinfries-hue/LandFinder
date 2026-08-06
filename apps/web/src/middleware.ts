import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE_NAME } from "@/lib/authSession";

/**
 * Passwort-Schutz für die ganze App (siehe docs/OPEN_DECISIONS.md, Punkt D) —
 * schliesst insbesondere die Lücke, dass `/api/state/*` bisher ganz ohne
 * Zugriffsschutz erreichbar war. Ausgenommen: die Login-Seite/-API selbst und
 * der Postmark-Webhook (hat seine eigene Basic-Auth via INBOUND_WEBHOOK_SECRET
 * und muss ohne Session-Cookie erreichbar bleiben, da Postmark keine Cookies
 * mitschickt).
 *
 * Fail closed: ist APP_PASSWORD nicht gesetzt, bleibt der Zugriff gesperrt
 * statt die Lücke offen zu lassen.
 */
const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = ["/api/auth/", "/api/inbound/"];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/");
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    if (isApiRoute) return NextResponse.json({ error: "not configured" }, { status: 503 });
    const url = new URL("/login", request.url);
    url.searchParams.set("reason", "not-configured");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!(await isValidSessionToken(token, appPassword))) {
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
