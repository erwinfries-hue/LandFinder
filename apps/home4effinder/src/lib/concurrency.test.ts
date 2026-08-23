import { describe, it, expect, vi } from "vitest";
import { runWithConcurrency } from "./concurrency";

describe("runWithConcurrency", () => {
  it("verarbeitet alle Items", async () => {
    const results: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      results.push(item);
    });
    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("läuft nie mehr als `limit` Worker gleichzeitig", async () => {
    let active = 0;
    let maxActive = 0;
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("bricht bei einem Fehler in einem Worker die gesamte Verarbeitung ab (Promise.all-Semantik)", async () => {
    await expect(
      runWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("funktioniert mit limit grösser als die Anzahl Items", async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    await runWithConcurrency([1, 2], 10, worker);
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it("tut nichts bei einer leeren Liste", async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    await runWithConcurrency([], 3, worker);
    expect(worker).not.toHaveBeenCalled();
  });
});
