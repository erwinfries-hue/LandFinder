import { describe, it, expect } from "vitest";
import { listingStatus, objectTypeLabel, formatDateTime } from "./listings";

describe("listingStatus", () => {
  it("mappt bekannte Ingestion-Status auf Label und Farbton", () => {
    expect(listingStatus("NEW")).toEqual({ label: "Neu", tone: "neutral" });
    expect(listingStatus("PARTIAL")).toEqual({ label: "Teilweise (LLM)", tone: "warn" });
    expect(listingStatus("MANUAL_INPUT_REQUIRED")).toEqual({ label: "Manuell prüfen", tone: "warn" });
    expect(listingStatus("BLOCKED")).toEqual({ label: "Blockiert", tone: "bad" });
    expect(listingStatus("TIMEOUT")).toEqual({ label: "Timeout", tone: "bad" });
    expect(listingStatus("NOT_AVAILABLE")).toEqual({ label: "Nicht erreichbar", tone: "bad" });
  });

  it("fällt bei unbekanntem Status auf den Rohwert mit neutralem Ton zurück, statt abzustürzen", () => {
    expect(listingStatus("IRGENDWAS_NEUES")).toEqual({ label: "IRGENDWAS_NEUES", tone: "neutral" });
  });
});

describe("objectTypeLabel", () => {
  it("übersetzt die bekannten Objekttypen", () => {
    expect(objectTypeLabel("BAULAND")).toBe("Bauland");
    expect(objectTypeLabel("ABBRUCHOBJEKT")).toBe("Grundstück mit Abbruchobjekt");
  });

  it("zeigt einen Platzhalter, wenn kein Typ bekannt ist", () => {
    expect(objectTypeLabel(null)).toBe("—");
  });

  it("gibt einen unbekannten Typ unverändert zurück, statt ihn zu verschlucken", () => {
    expect(objectTypeLabel("SONSTIGES")).toBe("SONSTIGES");
  });
});

describe("formatDateTime", () => {
  it("formatiert ein ISO-Datum als Schweizer Datum mit Uhrzeit", () => {
    const formatted = formatDateTime("2026-08-07T10:30:00Z");
    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
