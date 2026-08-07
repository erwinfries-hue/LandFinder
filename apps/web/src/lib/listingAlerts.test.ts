import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { maybeSendListingAlert, type AlertableListing } from "./listingAlerts";
import { getPersistedSearchProfile, DEFAULT_SEARCH_PROFILE } from "./searchProfile";
import { sendListingAlertEmail } from "./sendAlertEmail";

vi.mock("./searchProfile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./searchProfile")>();
  return { ...actual, getPersistedSearchProfile: vi.fn() };
});
vi.mock("./sendAlertEmail", () => ({ sendListingAlertEmail: vi.fn() }));

const mockGetPersistedSearchProfile = vi.mocked(getPersistedSearchProfile);
const mockSendListingAlertEmail = vi.mocked(sendListingAlertEmail);

function createSupabaseMock(opts: { count?: number; countError?: unknown; claimedRows?: unknown[] | null; claimError?: unknown } = {}) {
  const { count = 0, countError = null, claimedRows = [{ id: "listing-1" }], claimError = null } = opts;

  const gte = vi.fn().mockResolvedValue({ count, error: countError });
  const selectForCount = vi.fn(() => ({ gte }));

  const selectAfterIs = vi.fn().mockResolvedValue({ data: claimedRows, error: claimError });
  const is = vi.fn(() => ({ select: selectAfterIs }));
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn(() => ({ eq }));

  const from = vi.fn(() => ({ select: selectForCount, update }));
  return { from, update, eq, is, selectAfterIs, gte } as unknown as SupabaseClient & {
    from: typeof from;
    update: typeof update;
    eq: typeof eq;
    is: typeof is;
    selectAfterIs: typeof selectAfterIs;
    gte: typeof gte;
  };
}

const passingListing: AlertableListing = {
  canonical_url: "https://www.homegate.ch/kauf/1",
  title: "Bauland Cham",
  address_text: "Chamerstrasse, Cham ZG",
  canton: "ZG",
  object_type: "BAULAND",
  asking_price_chf: 3_000_000,
  parcel_area_m2: 1_000,
};

describe("maybeSendListingAlert", () => {
  beforeEach(() => {
    mockGetPersistedSearchProfile.mockReset();
    mockSendListingAlertEmail.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_ADDRESS;
  });

  it("ist ein No-op ohne RESEND_API_KEY/RESEND_FROM_ADDRESS (keine Supabase-Zugriffe)", async () => {
    const supabase = createSupabaseMock();
    await maybeSendListingAlert(supabase, passingListing);
    expect(mockGetPersistedSearchProfile).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  describe("mit konfiguriertem Resend", () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = "re_test";
      process.env.RESEND_FROM_ADDRESS = "alerts@example.ch";
    });

    it("versendet, wenn die Vorprüfung bestanden ist, unter dem Tageslimit und noch nicht geklaimt", async () => {
      mockGetPersistedSearchProfile.mockResolvedValue(DEFAULT_SEARCH_PROFILE);
      mockSendListingAlertEmail.mockResolvedValue({ sent: true });
      const supabase = createSupabaseMock({ count: 0, claimedRows: [{ id: "listing-1" }] });

      await maybeSendListingAlert(supabase, passingListing);

      expect(mockSendListingAlertEmail).toHaveBeenCalledTimes(1);
      expect(mockSendListingAlertEmail.mock.calls[0][0]).toMatchObject({
        to: DEFAULT_SEARCH_PROFILE.alerts.recipients,
        listingTitle: "Bauland Cham",
        canonicalUrl: "https://www.homegate.ch/kauf/1",
      });
      expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ alert_sent_at: expect.any(String) }));
      expect(supabase.eq).toHaveBeenCalledWith("canonical_url", passingListing.canonical_url);
      expect(supabase.is).toHaveBeenCalledWith("alert_sent_at", null);
    });

    it("versendet nicht, wenn keine Empfänger im Suchprofil hinterlegt sind", async () => {
      mockGetPersistedSearchProfile.mockResolvedValue({ ...DEFAULT_SEARCH_PROFILE, alerts: { ...DEFAULT_SEARCH_PROFILE.alerts, recipients: [] } });
      const supabase = createSupabaseMock();

      await maybeSendListingAlert(supabase, passingListing);

      expect(mockSendListingAlertEmail).not.toHaveBeenCalled();
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("versendet nicht, wenn das Inserat die Vorprüfung nicht besteht", async () => {
      mockGetPersistedSearchProfile.mockResolvedValue(DEFAULT_SEARCH_PROFILE);
      const supabase = createSupabaseMock();

      await maybeSendListingAlert(supabase, { ...passingListing, canton: "GE" });

      expect(mockSendListingAlertEmail).not.toHaveBeenCalled();
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("versendet nicht, wenn das Tageslimit bereits erreicht ist", async () => {
      mockGetPersistedSearchProfile.mockResolvedValue(DEFAULT_SEARCH_PROFILE);
      const supabase = createSupabaseMock({ count: DEFAULT_SEARCH_PROFILE.alerts.maxImmediateEmailsPerDay });

      await maybeSendListingAlert(supabase, passingListing);

      expect(mockSendListingAlertEmail).not.toHaveBeenCalled();
      expect(supabase.update).not.toHaveBeenCalled();
    });

    it("versendet nicht doppelt, wenn der Claim (alert_sent_at war bereits gesetzt) keine Zeile trifft", async () => {
      mockGetPersistedSearchProfile.mockResolvedValue(DEFAULT_SEARCH_PROFILE);
      const supabase = createSupabaseMock({ claimedRows: [] });

      await maybeSendListingAlert(supabase, passingListing);

      expect(mockSendListingAlertEmail).not.toHaveBeenCalled();
    });

    it("bricht bei einem Fehler in der Tageslimit-Abfrage ab, ohne zu senden", async () => {
      mockGetPersistedSearchProfile.mockResolvedValue(DEFAULT_SEARCH_PROFILE);
      const supabase = createSupabaseMock({ countError: new Error("db down") });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await maybeSendListingAlert(supabase, passingListing);

      expect(mockSendListingAlertEmail).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it("loggt eine Warnung, wenn der Versand nach erfolgreichem Claim fehlschlägt, ohne zu werfen", async () => {
      mockGetPersistedSearchProfile.mockResolvedValue(DEFAULT_SEARCH_PROFILE);
      mockSendListingAlertEmail.mockResolvedValue({ sent: false, reason: "Resend HTTP 500" });
      const supabase = createSupabaseMock();
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      await expect(maybeSendListingAlert(supabase, passingListing)).resolves.toBeUndefined();

      expect(consoleWarn).toHaveBeenCalledTimes(1);
      consoleWarn.mockRestore();
    });
  });
});
