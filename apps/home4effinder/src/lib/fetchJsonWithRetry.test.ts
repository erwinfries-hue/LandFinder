import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJsonWithRetry } from "./fetchJsonWithRetry";

describe("fetchJsonWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("liefert das Ergebnis des ersten Versuchs, wenn dieser gelingt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithRetry<{ ok: boolean }>("/api/x");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("wiederholt genau einmal, wenn fetch() wirft (z.B. Netzwerkfehler)", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithRetry<{ ok: boolean }>("/api/x");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("wiederholt genau einmal, wenn die Antwort kein valides JSON ist (typisch für eine Timeout-Fehlerseite)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.reject(new SyntaxError("Unexpected token <")) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithRetry<{ ok: boolean }>("/api/x");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("wirft, wenn auch der zweite Versuch scheitert (kein unbegrenztes Retry)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJsonWithRetry("/api/x")).rejects.toThrow("network down");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retryt NICHT bei einem absichtlichen Abbruch (AbortError) — reicht ihn sofort durch", async () => {
    const abortError = new DOMException("The user aborted a request.", "AbortError");
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJsonWithRetry("/api/x")).rejects.toThrow("The user aborted a request.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retryt NICHT, wenn die Antwort erfolgreich als JSON geparst wird, auch bei einem inhaltlichen Fehler", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ synthesized: false, error: "Analyse fehlgeschlagen" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJsonWithRetry<{ synthesized: boolean }>("/api/x");

    expect(result).toEqual({ synthesized: false, error: "Analyse fehlgeschlagen" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
