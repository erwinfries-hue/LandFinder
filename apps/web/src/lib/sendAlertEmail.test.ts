import { describe, it, expect, vi, afterEach } from "vitest";
import { sendListingAlertEmail } from "./sendAlertEmail";

describe("sendListingAlertEmail", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("ist ein No-op, solange RESEND_API_KEY oder RESEND_FROM_ADDRESS fehlen", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_ADDRESS;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendListingAlertEmail({ to: ["erwin.fries@gmx.ch"], listingTitle: "Bauland Cham", canonicalUrl: "https://example.ch/1" });

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("versendet über die Resend-API, wenn beide Umgebungsvariablen gesetzt sind", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_ADDRESS = "LandFinder <alerts@example.ch>";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendListingAlertEmail({
      to: ["erwin.fries@gmx.ch"],
      listingTitle: "Bauland Cham",
      canonicalUrl: "https://example.ch/1",
      canton: "ZG",
      askingPriceChf: 3_450_000,
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(options.body) as { from: string; to: string[]; subject: string; html: string };
    expect(body.from).toBe("LandFinder <alerts@example.ch>");
    expect(body.to).toEqual(["erwin.fries@gmx.ch"]);
    expect(body.subject).toContain("Bauland Cham");
    expect(body.html).toContain("example.ch/1");
    expect(body.html).toContain("ZG");
  });

  it("meldet ohne Absturz, wenn Resend einen Fehler zurückgibt", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_ADDRESS = "alerts@example.ch";
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    const result = await sendListingAlertEmail({ to: ["a@b.ch"], listingTitle: "Test", canonicalUrl: "https://example.ch/1" });

    expect(result.sent).toBe(false);
    expect(result.reason).toContain("401");
  });

  it("versendet nicht, wenn keine Empfänger angegeben sind", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_ADDRESS = "alerts@example.ch";
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendListingAlertEmail({ to: [], listingTitle: "Test", canonicalUrl: "https://example.ch/1" });

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
