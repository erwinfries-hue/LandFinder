import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchSwissAddress } from "./geoAdmin";

describe("searchSwissAddress", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("liefert eine leere Liste ohne Anfrage bei leerem Suchtext", async () => {
    const results = await searchSwissAddress("   ");
    expect(results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("parst gültige Ergebnisse (lat/lon/label vorhanden) und entfernt HTML-Hervorhebungen im Label", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ attrs: { lat: 47.1817, lon: 8.4657, label: "Chamerstrasse 1 <b>6300 Zug</b>" } }],
      }),
    } as Response);

    const results = await searchSwissAddress("Chamerstrasse 1 Zug");

    expect(results).toEqual([{ label: "Chamerstrasse 1 6300 Zug", lat: 47.1817, lon: 8.4657 }]);
  });

  it("überspringt Ergebnisse mit fehlenden/unerwarteten Feldern statt eine Koordinate zu erfinden", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { attrs: { lat: 47.1, lon: 8.1, label: "Vollständig" } },
          { attrs: { lat: "47.2", lon: 8.2, label: "Lat als String, nicht number" } },
          { attrs: { label: "Ohne Koordinaten" } },
          {},
        ],
      }),
    } as Response);

    const results = await searchSwissAddress("Musterstrasse 1");

    expect(results).toEqual([{ label: "Vollständig", lat: 47.1, lon: 8.1 }]);
  });

  it("liefert eine leere Liste bei einem Netzwerkfehler, statt zu werfen", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(searchSwissAddress("Musterstrasse 1")).resolves.toEqual([]);

    consoleError.mockRestore();
  });

  it("liefert eine leere Liste bei einem nicht-erfolgreichen HTTP-Status", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(searchSwissAddress("Musterstrasse 1")).resolves.toEqual([]);

    consoleError.mockRestore();
  });

  it("kodiert den Suchtext korrekt in der Anfrage-URL", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) } as Response);

    await searchSwissAddress("Bahnhofstrasse 1, 8000 Zürich");

    const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent("Bahnhofstrasse 1, 8000 Zürich"));
  });
});
