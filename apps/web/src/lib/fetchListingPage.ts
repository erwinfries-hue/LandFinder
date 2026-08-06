/**
 * Gezielter Einzelseiten-Abruf einer konkreten Inserat-URL (Stufe 2, siehe
 * docs/OPEN_DECISIONS.md Punkt A) — kein Durchsuchen/Crawlen des Portal-Katalogs,
 * nur die eine Seite, auf die uns eine Suchabo-Mail bereits verwiesen hat.
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
        "User-Agent": "Mozilla/5.0 (compatible; LandFinderBot/1.0; privates Vorprüfungstool, kein Crawler)",
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
