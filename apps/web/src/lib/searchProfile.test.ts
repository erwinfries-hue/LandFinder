import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPersistedSearchProfile, DEFAULT_SEARCH_PROFILE } from "./searchProfile";
import { createSupabaseServerClient } from "./supabaseServer";

vi.mock("./supabaseServer", () => ({ createSupabaseServerClient: vi.fn() }));

const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);

function createSupabaseMock(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, maybeSingle } as unknown as SupabaseClient & {
    from: typeof from;
    select: typeof select;
    eq: typeof eq;
    maybeSingle: typeof maybeSingle;
  };
}

describe("getPersistedSearchProfile", () => {
  beforeEach(() => {
    mockCreateSupabaseServerClient.mockReset();
  });

  it("liefert den Default zurück, wenn Supabase nicht konfiguriert ist", async () => {
    mockCreateSupabaseServerClient.mockReturnValue(null);

    const result = await getPersistedSearchProfile();

    expect(result).toEqual(DEFAULT_SEARCH_PROFILE);
  });

  it("liefert den Default zurück, wenn noch kein Profil gespeichert wurde", async () => {
    const supabase = createSupabaseMock({ data: null, error: null });
    mockCreateSupabaseServerClient.mockReturnValue(supabase);

    const result = await getPersistedSearchProfile();

    expect(result).toEqual(DEFAULT_SEARCH_PROFILE);
    expect(supabase.from).toHaveBeenCalledWith("app_state");
    expect(supabase.eq).toHaveBeenCalledWith("id", "search-profile");
  });

  it("liefert den Default zurück, wenn die Abfrage einen Fehler liefert, statt zu werfen", async () => {
    const supabase = createSupabaseMock({ data: null, error: new Error("db down") });
    mockCreateSupabaseServerClient.mockReturnValue(supabase);

    await expect(getPersistedSearchProfile()).resolves.toEqual(DEFAULT_SEARCH_PROFILE);
  });

  it("merged das gespeicherte Profil über den Default (überschreibt nur die vorhandenen Bereiche)", async () => {
    const partial = { budget: { ...DEFAULT_SEARCH_PROFILE.budget, maxLandPriceChf: 9_000_000 } };
    const supabase = createSupabaseMock({ data: { data: partial }, error: null });
    mockCreateSupabaseServerClient.mockReturnValue(supabase);

    const result = await getPersistedSearchProfile();

    expect(result.budget.maxLandPriceChf).toBe(9_000_000);
    // Nicht überschriebene Bereiche bleiben unverändert beim Default.
    expect(result.marktannahmen).toEqual(DEFAULT_SEARCH_PROFILE.marktannahmen);
    expect(result.regions).toEqual(DEFAULT_SEARCH_PROFILE.regions);
  });
});
