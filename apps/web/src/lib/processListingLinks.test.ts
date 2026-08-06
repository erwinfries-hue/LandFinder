import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processListingLinks } from "./processListingLinks";
import { fetchListingPage } from "./fetchListingPage";
import { extractListingFields } from "./listingExtraction";

vi.mock("./fetchListingPage", () => ({ fetchListingPage: vi.fn() }));
vi.mock("./listingExtraction", () => ({ extractListingFields: vi.fn() }));

const mockFetchListingPage = vi.mocked(fetchListingPage);
const mockExtractListingFields = vi.mocked(extractListingFields);

/** Minimaler Fake für den Teil der Supabase-Query-Builder-API, den processListingLinks nutzt. */
function createSupabaseMock() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ upsert }));
  return { from, upsert } as unknown as SupabaseClient & { from: typeof from; upsert: typeof upsert };
}

describe("processListingLinks", () => {
  beforeEach(() => {
    mockFetchListingPage.mockReset();
    mockExtractListingFields.mockReset();
  });

  it("verarbeitet ein erfolgreich abgerufenes Inserat und speichert die Extraktion (Heuristik → MANUAL_INPUT_REQUIRED)", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "OK", html: "<html></html>" });
    mockExtractListingFields.mockResolvedValue({
      fields: { title: "Bauland Cham", canton: "ZG", askingPriceChf: 1_000_000 },
      method: "MOCK_HEURISTIC",
      confidence: 25,
    });

    await processListingLinks(supabase, ["https://www.homegate.ch/kauf/12345"]);

    expect(supabase.from).toHaveBeenCalledWith("listings");
    expect(supabase.upsert).toHaveBeenCalledTimes(1);
    const [record, options] = supabase.upsert.mock.calls[0];
    expect(record).toMatchObject({
      canonical_url: "https://www.homegate.ch/kauf/12345",
      source: "HOMEGATE",
      title: "Bauland Cham",
      canton: "ZG",
      asking_price_chf: 1_000_000,
      ingestion_status: "MANUAL_INPUT_REQUIRED",
    });
    expect(options).toEqual({ onConflict: "canonical_url" });
  });

  it("setzt PARTIAL, wenn die Extraktion über Anthropic gelaufen ist", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "OK", html: "<html></html>" });
    mockExtractListingFields.mockResolvedValue({
      fields: { title: "Bauland Cham" },
      method: "ANTHROPIC",
      confidence: 65,
    });

    await processListingLinks(supabase, ["https://www.immoscout24.ch/de/d/12345"]);

    const [record] = supabase.upsert.mock.calls[0];
    expect(record.ingestion_status).toBe("PARTIAL");
    expect(record.source).toBe("IMMOSCOUT24");
  });

  it.each([
    ["BLOCKED", "BLOCKED"],
    ["TIMEOUT", "TIMEOUT"],
    ["ERROR", "NOT_AVAILABLE"],
  ] as const)("speichert bei Abruf-Status %s nur den Fehlerfall (%s), ohne Extraktion aufzurufen", async (fetchStatus, expectedIngestionStatus) => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: fetchStatus, html: "" });

    await processListingLinks(supabase, ["https://www.newhome.ch/de/kauf/12345"]);

    expect(mockExtractListingFields).not.toHaveBeenCalled();
    expect(supabase.upsert).toHaveBeenCalledTimes(1);
    const [record, options] = supabase.upsert.mock.calls[0];
    expect(record).toEqual({
      canonical_url: "https://www.newhome.ch/de/kauf/12345",
      source: "NEWHOME",
      ingestion_status: expectedIngestionStatus,
    });
    expect(options).toEqual({ onConflict: "canonical_url" });
  });

  it("erkennt unbekannte Portale als EMAIL_IMPORT", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "BLOCKED", html: "" });

    await processListingLinks(supabase, ["https://www.example-portal.ch/listing/1"]);

    expect(supabase.upsert.mock.calls[0][0]).toMatchObject({ source: "EMAIL_IMPORT" });
  });

  it("begrenzt die Verarbeitung pro Aufruf auf MAX_LINKS_PER_RUN (2) und lässt weitere Links unverarbeitet", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "BLOCKED", html: "" });

    await processListingLinks(supabase, [
      "https://www.homegate.ch/kauf/1",
      "https://www.homegate.ch/kauf/2",
      "https://www.homegate.ch/kauf/3",
    ]);

    expect(mockFetchListingPage).toHaveBeenCalledTimes(2);
    expect(supabase.upsert).toHaveBeenCalledTimes(2);
    expect(mockFetchListingPage).toHaveBeenNthCalledWith(1, "https://www.homegate.ch/kauf/1");
    expect(mockFetchListingPage).toHaveBeenNthCalledWith(2, "https://www.homegate.ch/kauf/2");
  });

  it("verarbeitet mehrere Links nacheinander und loggt einen Upsert-Fehler statt zu werfen", async () => {
    const supabase = createSupabaseMock();
    supabase.upsert.mockResolvedValueOnce({ error: new Error("db down") }).mockResolvedValueOnce({ error: null });
    mockFetchListingPage.mockResolvedValue({ status: "OK", html: "<html></html>" });
    mockExtractListingFields.mockResolvedValue({ fields: {}, method: "MOCK_HEURISTIC", confidence: 25 });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      processListingLinks(supabase, ["https://www.homegate.ch/kauf/1", "https://www.homegate.ch/kauf/2"]),
    ).resolves.toBeUndefined();

    expect(supabase.upsert).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
