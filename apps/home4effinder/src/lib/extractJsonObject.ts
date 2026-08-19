/**
 * Extrahiert das erste vollständige JSON-Objekt aus einem Text — robuster als ein gieriger
 * Regex (`/\{[\s\S]*\}/`), der bei zusätzlichem Text nach dem eigentlichen JSON (z.B. eine
 * schliessende Markdown-Code-Fence gefolgt von einem Nachsatz mit eigenen geschweiften
 * Klammern) leicht ungültiges, zusammengeklebtes "JSON" erzeugt. In Produktion beobachtet:
 * `SyntaxError: Unexpected non-whitespace character after JSON` — der Regex hatte bis zur
 * LETZTEN `}` im gesamten Antworttext gematcht, nicht bis zur ersten tatsächlich
 * schliessenden Klammer des JSON-Objekts.
 *
 * Zählt stattdessen die Klammertiefe ab der ersten `{` und ignoriert Klammern innerhalb von
 * String-Literalen (inkl. Escape-Zeichen), bis die Tiefe wieder auf 0 fällt.
 */
export function extractFirstJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}
