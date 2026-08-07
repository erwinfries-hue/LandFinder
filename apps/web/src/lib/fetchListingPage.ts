/**
 * Gezielter Einzelseiten-Abruf einer konkreten Inserat-URL (Stufe 2, siehe
 * docs/OPEN_DECISIONS.md Punkt A) — kein Durchsuchen/Crawlen des Portal-Katalogs,
 * nur die eine Seite, auf die uns eine Suchabo-Mail bereits verwiesen hat.
 *
 * Der User-Agent gibt sich bewusst als gewöhnlicher Browser aus, nicht mehr als
 * Bot (siehe docs/OPEN_DECISIONS.md, Punkt A, Entscheid 2026-08-07 — explizit
 * angefragt und freigegeben, da newhome.ch den vorherigen, selbstauskunftgebenden
 * User-Agent blockierte). Wirkt nur gegen Header-/UA-basierte Bot-Erkennung, nicht
 * gegen JS-Challenges (Cloudflare-artig) — von hier aus nicht gegen die echten
 * Portale testbar, Wirkung erst in Produktion sichtbar (siehe `last_fetch_http_status`
 * auf der Quellen-Detailseite).
 */

export type FetchListingStatus = "OK" | "BLOCKED" | "TIMEOUT" | "ERROR";

export interface FetchListingResult {
  status: FetchListingStatus;
  html: string;
  httpStatus?: number;
}

export async function fetchListingPage(url: string, timeoutMs = 8000): Promise<FetchListingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "de-CH,de;q=0.9,en;q=0.8",
      },
    });
    if (res.status === 403 || res.status === 429) {
      return { status: "BLOCKED", html: "", httpStatus: res.status };
    }
    if (!res.ok) {
      return { status: "ERROR", html: "", httpStatus: res.status };
    }
    const html = await res.text();
    return { status: "OK", html, httpStatus: res.status };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { status: "TIMEOUT", html: "" };
    }
    return { status: "ERROR", html: "" };
  } finally {
    clearTimeout(timer);
  }
}
