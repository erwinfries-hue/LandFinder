import { describe, it, expect } from "vitest";
import { listingStatus, objectTypeLabel, formatDateTime, withDerivedCanton, type ListingRow } from "./listings";

function makeRow(overrides: Partial<ListingRow>): ListingRow {
  return {
    id: "1",
    canonical_url: "https://example.ch/1",
    source: "HOMEGATE",
    title: null,
    description: null,
    object_type: null,
    address_text: null,
    canton: null,
    municipality: null,
    asking_price_chf: null,
    parcel_area_m2: null,
    existing_building: null,
    known_zone: null,
    extraction: {},
    ingestion_status: "MANUAL_INPUT_REQUIRED",
    first_seen_at: "2026-08-01T00:00:00Z",
    last_seen_at: "2026-08-01T00:00:00Z",
    active: true,
    last_fetch_http_status: null,
    last_fetch_at: null,
    alert_sent_at: null,
    vertiefung: null,
    vertiefung_updated_at: null,
    ...overrides,
  };
}

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

describe("withDerivedCanton", () => {
  it("ergänzt den Kanton anhand der PLZ im Adresstext, wenn keiner extrahiert wurde", () => {
    const row = makeRow({ canton: null, address_text: "Bahnhofstrasse 1, 8545 Rickenbach Sulz" });
    expect(withDerivedCanton(row).canton).toBe("ZH");
  });

  it("lässt einen bereits vorhandenen Kanton unangetastet", () => {
    const row = makeRow({ canton: "AG", address_text: "Bahnhofstrasse 1, 8545 Rickenbach Sulz" });
    expect(withDerivedCanton(row).canton).toBe("AG");
  });

  it("erfindet keinen Kanton, wenn die PLZ auf einer Kantonsgrenze liegt oder fehlt", () => {
    expect(withDerivedCanton(makeRow({ canton: null, address_text: "Rue Principale 1, 1410 Thierrens" })).canton).toBeNull();
    expect(withDerivedCanton(makeRow({ canton: null, address_text: null })).canton).toBeNull();
  });
});

describe("formatDateTime", () => {
  it("formatiert ein ISO-Datum als Schweizer Datum mit Uhrzeit", () => {
    const formatted = formatDateTime("2026-08-07T10:30:00Z");
    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
