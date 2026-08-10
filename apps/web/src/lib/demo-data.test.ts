import { describe, it, expect } from "vitest";
import { formatChf, mapsUrl } from "./demo-data";

describe("formatChf", () => {
  it("gruppiert Tausender mit Schweizer Apostroph", () => {
    expect(formatChf(1000)).toBe("1'000");
    expect(formatChf(3_450_000)).toBe("3'450'000");
  });

  it("lässt Zahlen unter 1000 ohne Trennzeichen", () => {
    expect(formatChf(999)).toBe("999");
    expect(formatChf(0)).toBe("0");
  });

  it("rundet Kommazahlen auf ganze Zahlen", () => {
    expect(formatChf(1234.6)).toBe("1'235");
    expect(formatChf(1234.4)).toBe("1'234");
  });

  it("behandelt negative Werte korrekt (Minus vor der Gruppierung)", () => {
    expect(formatChf(-2500)).toBe("-2'500");
  });
});

describe("mapsUrl", () => {
  it("baut eine Google-Maps-Such-URL mit korrekt kodierter Adresse", () => {
    const url = mapsUrl("Chamerstrasse 1, 6330 Cham");
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=Chamerstrasse%201%2C%206330%20Cham");
  });
});
