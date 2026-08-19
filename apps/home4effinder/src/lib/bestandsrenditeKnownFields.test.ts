import { describe, it, expect } from "vitest";
import { BESTANDSRENDITE_KNOWN_FIELD_LABELS } from "./bestandsrenditeKnownFields";
import { isAllowedUpdateField } from "./bestandsrendite";

describe("BESTANDSRENDITE_KNOWN_FIELD_LABELS", () => {
  it("jeder Feldpfad ist auch in ALLOWED_UPDATE_FIELDS erlaubt (bestandsrendite.ts) — verhindert Drift zwischen den beiden Listen", () => {
    for (const { field } of BESTANDSRENDITE_KNOWN_FIELD_LABELS) {
      expect(isAllowedUpdateField(field)).toBe(true);
    }
  });

  it("jeder Eintrag hat ein nicht-leeres Label", () => {
    for (const { label } of BESTANDSRENDITE_KNOWN_FIELD_LABELS) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("keine doppelten Feldpfade", () => {
    const fields = BESTANDSRENDITE_KNOWN_FIELD_LABELS.map((f) => f.field);
    expect(new Set(fields).size).toBe(fields.length);
  });
});
