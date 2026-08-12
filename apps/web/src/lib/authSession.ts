/**
 * Einfache, abhängigkeitsfreie Session-Cookie-Signierung für den Passwort-Schutz
 * der ganzen App (siehe docs/OPEN_DECISIONS.md, Punkt D). Bewusst kein volles
 * Multi-User-Login mit einzelnen Konten — das ist ein Sofort-Fix für die Lücke,
 * dass `/api/state/*` bisher ganz ohne Zugriffsschutz erreichbar war. Ein
 * geteiltes Passwort (Umgebungsvariable `APP_PASSWORD`) reicht für den
 * aktuellen Nutzerkreis (Abschnitt 6: "2-5 bekannte Nutzer").
 *
 * Nutzt bewusst die Web Crypto API (`crypto.subtle`) statt Node's `crypto`-Modul:
 * `middleware.ts` läuft in der Edge Runtime, die kein Node-`crypto` unterstützt —
 * Web Crypto funktioniert dagegen identisch in Edge Runtime, Node.js und Browser.
 *
 * Token-Format: `<Ablaufzeitpunkt>.<HMAC-SHA256 des Ablaufzeitpunkts, hex>`,
 * signiert mit APP_PASSWORD als Schlüssel — fälschungssicher, solange das
 * Passwort geheim bleibt, ohne Session-Tabelle/JWT-Bibliothek.
 */

export const SESSION_COOKIE_NAME = "lf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${bytesToHex(signature)}`;
}

/** Prüft das Session-Cookie eines eingehenden Requests gegen `APP_PASSWORD` — gemeinsame Prüfung für API-Routen ausserhalb der Middleware (defense in depth). */
export async function hasValidSession(request: Request): Promise<boolean> {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return isValidSessionToken(match?.[1], appPassword);
}

export async function isValidSessionToken(token: string | undefined | null, secret: string): Promise<boolean> {
  if (!token) return false;
  const [payload, signatureHex] = token.split(".");
  if (!payload || !signatureHex) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const signatureBytes = hexToBytes(signatureHex);
  if (!signatureBytes) return false;

  const key = await getHmacKey(secret);
  return crypto.subtle.verify("HMAC", key, signatureBytes.buffer as ArrayBuffer, new TextEncoder().encode(payload));
}
