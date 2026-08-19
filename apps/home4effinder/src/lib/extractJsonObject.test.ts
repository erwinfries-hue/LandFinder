import { describe, it, expect } from "vitest";
import { extractFirstJsonObject } from "./extractJsonObject";

describe("extractFirstJsonObject", () => {
  it("extrahiert ein einfaches JSON-Objekt ohne Umgebungstext", () => {
    expect(extractFirstJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("ignoriert Text nach dem JSON-Objekt (der Bug, der den gierigen Regex kaputt gemacht hat)", () => {
    const text = '{"a":1}\n\nHinweis: das Objekt {irgendwas} wird nicht extrahiert.';
    expect(extractFirstJsonObject(text)).toBe('{"a":1}');
  });

  it("ignoriert eine schliessende Markdown-Code-Fence mit Nachsatz", () => {
    const text = '```json\n{"a":1,"b":{"c":2}}\n```\nZusätzliche Erklärung mit { geschweiften } Klammern.';
    expect(extractFirstJsonObject(text)).toBe('{"a":1,"b":{"c":2}}');
  });

  it("respektiert verschachtelte Objekte korrekt", () => {
    const text = '{"a":{"b":{"c":1}},"d":2}';
    expect(extractFirstJsonObject(text)).toBe(text);
  });

  it("ignoriert geschweifte Klammern innerhalb von String-Literalen", () => {
    const text = '{"summary":"Enthält { eine Klammer } im Text","value":1}';
    expect(extractFirstJsonObject(text)).toBe(text);
  });

  it("respektiert escapte Anführungszeichen innerhalb von Strings", () => {
    const text = '{"quote":"er sagte \\"hallo { welt }\\""}';
    expect(extractFirstJsonObject(text)).toBe(text);
  });

  it("liefert undefined, wenn keine öffnende Klammer vorhanden ist", () => {
    expect(extractFirstJsonObject("kein json hier")).toBeUndefined();
  });

  it("liefert undefined, wenn das Objekt nie geschlossen wird", () => {
    expect(extractFirstJsonObject('{"a":1')).toBeUndefined();
  });
});
