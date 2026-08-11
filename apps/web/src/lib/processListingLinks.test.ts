import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processListingLinks } from "./processListingLinks";
import { fetchListingPage } from "./fetchListingPage";
import { extractListingFields } from "./listingExtraction";

vi.mock("./fetchListingPage", () => ({ fetchListingPage: vi.fn() }));
vi.mock("./listingExtraction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./listingExtraction")>();
  return { ...actual, extractListingFields: vi.fn() };
});

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
    ["BLOCKED", 403, "BLOCKED"],
    ["TIMEOUT", undefined, "TIMEOUT"],
    ["ERROR", 500, "NOT_AVAILABLE"],
  ] as const)("speichert bei Abruf-Status %s nur den Fehlerfall (%s), ohne Extraktion aufzurufen", async (fetchStatus, httpStatus, expectedIngestionStatus) => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: fetchStatus, html: "", httpStatus });

    await processListingLinks(supabase, ["https://www.newhome.ch/de/kauf/12345"]);

    expect(mockExtractListingFields).not.toHaveBeenCalled();
    expect(supabase.upsert).toHaveBeenCalledTimes(1);
    const [record, options] = supabase.upsert.mock.calls[0];
    expect(record).toEqual({
      canonical_url: "https://www.newhome.ch/de/kauf/12345",
      source: "NEWHOME",
      ingestion_status: expectedIngestionStatus,
      last_fetch_http_status: httpStatus ?? null,
      last_fetch_at: expect.any(String),
    });
    expect(options).toEqual({ onConflict: "canonical_url" });
  });

  it("speichert den echten HTTP-Statuscode einer Blockade zur Diagnose (z.B. newhome-Bot-Erkennung)", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "BLOCKED", html: "", httpStatus: 429 });

    await processListingLinks(supabase, ["https://www.newhome.ch/de/kauf/1"]);

    const [record] = supabase.upsert.mock.calls[0];
    expect(record.last_fetch_http_status).toBe(429);
    expect(new Date(record.last_fetch_at).toString()).not.toBe("Invalid Date");
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

  it("fällt auf den Mailinhalt zurück, wenn der Seitenabruf nur ein Bild statt der Inserat-Seite liefert", async () => {
    const supabase = createSupabaseMock();
    // Simuliert genau den real beobachteten Fall (2026-08-08): der "Link" ist ein
    // Homegate-Vorschaubild, extractListingFields findet darin nichts Brauchbares.
    mockFetchListingPage.mockResolvedValue({ status: "OK", html: "<html><body>binary image garbage</body></html>" });
    mockExtractListingFields.mockResolvedValue({ fields: {}, method: "MOCK_HEURISTIC", confidence: 25 });

    await processListingLinks(
      supabase,
      ["https://media2.homegate.ch/.../image.jpg"],
      {
        subject: "1 neuer Treffer für 'Bauland zum Kaufen'",
        htmlBody: "<p>CHF 2'970'000.–</p><p>Friedhofweg 2<br/>4414 Füllinsdorf</p>",
      },
    );

    const [record] = supabase.upsert.mock.calls[0];
    expect(record.asking_price_chf).toBe(2_970_000);
    expect(record.address_text).toBe("Friedhofweg 2, 4414 Füllinsdorf");
    expect(record.extraction.method).toBe("EMAIL_HEURISTIC");
    expect(record.ingestion_status).toBe("MANUAL_INPUT_REQUIRED");
  });

  it("bevorzugt die Seiten-Extraktion, wenn sie bereits brauchbare Felder liefert (kein Mail-Fallback nötig)", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "OK", html: "<html></html>" });
    mockExtractListingFields.mockResolvedValue({
      fields: { title: "Echte Seite", askingPriceChf: 1_000_000 },
      method: "MOCK_HEURISTIC",
      confidence: 25,
    });

    await processListingLinks(supabase, ["https://www.homegate.ch/kauf/1"], {
      subject: "Anderer Betreff",
      htmlBody: "<p>CHF 9'999'999.–</p>",
    });

    const [record] = supabase.upsert.mock.calls[0];
    expect(record.title).toBe("Echte Seite");
    expect(record.asking_price_chf).toBe(1_000_000);
  });

  it("nutzt den Mail-Fallback auch, wenn der Seitenabruf komplett blockiert war", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "BLOCKED", html: "", httpStatus: 403 });

    await processListingLinks(supabase, ["https://www.newhome.ch/de/kauf/1"], {
      subject: "Neue Treffer in Ihrem Suchabo",
      htmlBody: "<p>CHF 500'000.-</p><p>Musterstrasse 1<br/>8000 Zürich</p>",
    });

    const [record] = supabase.upsert.mock.calls[0];
    expect(record.asking_price_chf).toBe(500_000);
    expect(record.ingestion_status).toBe("MANUAL_INPUT_REQUIRED");
    expect(mockExtractListingFields).not.toHaveBeenCalled();
  });

  it("bleibt beim Fehlerstatus, wenn weder Seite noch Mailinhalt etwas Brauchbares liefern", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({ status: "BLOCKED", html: "", httpStatus: 403 });

    await processListingLinks(supabase, ["https://www.newhome.ch/de/kauf/1"], {
      subject: "Erinnerung: Bitte Anmeldung bestätigen",
      htmlBody: "<p>Bitte bestätige deine Anmeldung.</p>",
    });

    const [record] = supabase.upsert.mock.calls[0];
    expect(record).toEqual({
      canonical_url: "https://www.newhome.ch/de/kauf/1",
      source: "NEWHOME",
      ingestion_status: "BLOCKED",
      last_fetch_http_status: 403,
      last_fetch_at: expect.any(String),
    });
  });

  it("verwendet die aufgelöste Ziel-URL nach einer Weiterleitung (z.B. SendGrid-Tracking-Link) als canonical_url", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({
      status: "OK",
      html: "<html>Echtes Inserat</html>",
      finalUrl: "https://www.homegate.ch/kaufen/echtes-inserat-12345",
    });
    mockExtractListingFields.mockResolvedValue({
      fields: { title: "Echtes Inserat", askingPriceChf: 2_970_000 },
      method: "MOCK_HEURISTIC",
      confidence: 25,
    });

    await processListingLinks(supabase, ["https://u123.ct.sendgrid.net/uni/ls/click?upn=abc"]);

    expect(mockExtractListingFields).toHaveBeenCalledWith("<html>Echtes Inserat</html>");
    const [record] = supabase.upsert.mock.calls[0];
    expect(record.canonical_url).toBe("https://www.homegate.ch/kaufen/echtes-inserat-12345");
    expect(record.source).toBe("HOMEGATE");
    expect(record.title).toBe("Echtes Inserat");
  });

  it("behandelt eine Weiterleitung auf eine unbekannte Domain nicht als Inserat-Seite", async () => {
    const supabase = createSupabaseMock();
    mockFetchListingPage.mockResolvedValue({
      status: "OK",
      html: "<html>Irgendetwas Fremdes</html>",
      finalUrl: "https://voellig-unbekannt.example.com/xyz",
    });

    await processListingLinks(supabase, ["https://u123.ct.sendgrid.net/uni/ls/click?upn=abc"], {
      subject: "1 neuer Treffer",
      htmlBody: "<p>CHF 500'000.-</p><p>Musterstrasse 1<br/>8000 Zürich</p>",
    });

    // Seiteninhalt einer unerwarteten Domain wird nicht als Inserat-Daten interpretiert.
    expect(mockExtractListingFields).not.toHaveBeenCalled();
    // canonical_url bleibt der ursprüngliche Tracking-Link, da die Ziel-Domain nicht bekannt ist.
    const [record] = supabase.upsert.mock.calls[0];
    expect(record.canonical_url).toBe("https://u123.ct.sendgrid.net/uni/ls/click?upn=abc");
    // Mail-Fallback greift trotzdem, da wir wenigstens den Mailinhalt haben.
    expect(record.asking_price_chf).toBe(500_000);
  });

  it("verwendet den Mailinhalt-Fallback nur für den ersten Link, nicht für jeden Link derselben Mail (Bug 2026-08-11: doppelte Zeilen)", async () => {
    const supabase = createSupabaseMock();
    // Zwei Links derselben Mail (z.B. Logo- und Tracking-Link), beide ohne brauchbare
    // Seiten-Extraktion — vorher wurde für beide derselbe Mailinhalt gespeichert, was zu
    // zwei fast identischen Zeilen mit unterschiedlicher canonical_url führte.
    mockFetchListingPage.mockResolvedValue({ status: "BLOCKED", html: "", httpStatus: 403 });

    await processListingLinks(
      supabase,
      ["https://media2.homegate.ch/.../logo.jpg", "https://u123.ct.sendgrid.net/uni/ls/click?upn=abc"],
      {
        subject: "1 neuer Treffer für 'Bauland zum Kaufen'",
        htmlBody: "<p>CHF 2'970'000.–</p><p>Friedhofweg 2<br/>4414 Füllinsdorf</p>",
      },
    );

    expect(supabase.upsert).toHaveBeenCalledTimes(2);
    const [firstRecord] = supabase.upsert.mock.calls[0];
    const [secondRecord] = supabase.upsert.mock.calls[1];
    expect(firstRecord.asking_price_chf).toBe(2_970_000);
    expect(firstRecord.address_text).toBe("Friedhofweg 2, 4414 Füllinsdorf");
    // Der zweite Link bekommt keine Kopie desselben Mailinhalts, sondern bleibt beim
    // eigenen (Fehler-)Status stehen.
    expect(secondRecord.asking_price_chf).toBeUndefined();
    expect(secondRecord.address_text).toBeUndefined();
    expect(secondRecord.ingestion_status).toBe("BLOCKED");
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
