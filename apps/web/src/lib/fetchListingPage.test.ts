import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchListingPage } from "./fetchListingPage";

describe("fetchListingPage", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("liefert OK mit HTML bei erfolgreicher Antwort", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "<html>Inserat</html>",
    }) as unknown as typeof fetch;

    const result = await fetchListingPage("https://example.ch/inserat/1");
    expect(result).toEqual({ status: "OK", html: "<html>Inserat</html>", httpStatus: 200 });
  });

  it.each([403, 429])("erkennt HTTP %i als BLOCKIERT", async (status) => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status, text: async () => "" }) as unknown as typeof fetch;
    const result = await fetchListingPage("https://example.ch/inserat/1");
    expect(result).toEqual({ status: "BLOCKED", html: "", httpStatus: status });
  });

  it("behandelt andere Fehler-Statuscodes als ERROR", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }) as unknown as typeof fetch;
    const result = await fetchListingPage("https://example.ch/inserat/1");
    expect(result).toEqual({ status: "ERROR", html: "", httpStatus: 404 });
  });

  it("erkennt einen Abbruch (Timeout) am AbortError", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    const result = await fetchListingPage("https://example.ch/inserat/1");
    expect(result).toEqual({ status: "TIMEOUT", html: "" });
  });

  it("behandelt sonstige Netzwerkfehler als ERROR", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await fetchListingPage("https://example.ch/inserat/1");
    expect(result).toEqual({ status: "ERROR", html: "" });
  });

  it("sendet einen browserähnlichen User-Agent samt Accept-Headern (Entscheid 2026-08-07, siehe OPEN_DECISIONS.md Punkt A)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "<html></html>" });
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchListingPage("https://example.ch/inserat/1");

    const [calledUrl, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(calledUrl).toBe("https://example.ch/inserat/1");
    expect(options.headers["User-Agent"]).toContain("Chrome");
    expect(options.headers["User-Agent"]).not.toContain("Bot");
    expect(options.headers["Accept-Language"]).toContain("de-CH");
  });
});
