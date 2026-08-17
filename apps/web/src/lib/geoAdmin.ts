/**
 * Adress-Suche über die öffentliche swisstopo-API (api3.geo.admin.ch, "Nutzung von
 * Geodaten des Bundes" — offene Bundesgeodaten, kein API-Key nötig). Ersetzt/ergänzt
 * das bisherige manuelle "Rechtsklick auf Google Maps" beim Erfassen von
 * `facts.coordinates` in "Objekt vertiefen" (docs/OPEN_DECISIONS.md, Punkt F).
 *
 * Von hier (Sandbox) aus nicht gegen die echte API testbar — ausgehender
 * Netzwerkzugriff auf geo.admin.ch ist blockiert (nur der npm-Registry-Zugriff für
 * `npm install` ist freigegeben). Die geparsten Felder (`attrs.lat`/`attrs.lon`/
 * `attrs.label`) basieren auf der öffentlich dokumentierten SearchServer-
 * Antwortstruktur (`type=locations`, `origins=address`), sind aber **nicht gegen
 * echten Traffic verifiziert** — wie bei `fetchListingPage.ts`s newhome-Verhalten
 * erst in Produktion zu bestätigen. Bewusst defensiv geparst: weicht die Struktur ab
 * oder fehlt ein Feld, wird das einzelne Ergebnis übersprungen statt eine Koordinate
 * zu erfinden — konsistent mit dem Rest der Extraktion ("nichts wird erfunden").
 */

export interface GeoAddressSuggestion {
  label: string;
  lat: number;
  lon: number;
}

const SEARCH_URL = "https://api3.geo.admin.ch/rest/services/api/SearchServer";

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

export async function searchSwissAddress(query: string): Promise<GeoAddressSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let response: Response;
  try {
    response = await fetch(
      `${SEARCH_URL}?type=locations&origins=address&searchText=${encodeURIComponent(trimmed)}&limit=5`,
      { signal: AbortSignal.timeout(5000) },
    );
  } catch (error) {
    console.error("[geoAdmin] Adress-Suche fehlgeschlagen (Netzwerk)", error);
    return [];
  }
  if (!response.ok) {
    console.error("[geoAdmin] Adress-Suche fehlgeschlagen", response.status);
    return [];
  }

  let body: { results?: { attrs?: Record<string, unknown> }[] };
  try {
    body = await response.json();
  } catch (error) {
    console.error("[geoAdmin] Adress-Suche: Antwort nicht als JSON lesbar", error);
    return [];
  }

  const suggestions: GeoAddressSuggestion[] = [];
  for (const result of body.results ?? []) {
    const attrs = result.attrs;
    const lat = attrs?.lat;
    const lon = attrs?.lon;
    const label = attrs?.label;
    if (typeof lat === "number" && typeof lon === "number" && typeof label === "string") {
      suggestions.push({ label: stripHtmlTags(label), lat, lon });
    }
  }
  return suggestions;
}
