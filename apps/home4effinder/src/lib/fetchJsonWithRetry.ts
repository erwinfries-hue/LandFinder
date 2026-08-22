/**
 * Wahr für einen absichtlichen `AbortController.abort()` (z.B. Nutzer klickt "Abbrechen")
 * — kein transienter Fehler, darf NIE wiederholt werden. Absichtlich NICHT auf
 * `instanceof Error` geprüft — der native Fetch-Abbruch wirft ein `DOMException`, das in
 * Node (im Gegensatz zum Browser) NICHT von `Error` erbt, nur `.name` ist verlässlich.
 */
function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && (err as { name: unknown }).name === "AbortError";
}

/**
 * Ein einzelner automatischer Wiederholungsversuch für die Dokumenten-KI-Endpunkte, die
 * anfällig für einen transienten 60-Sekunden-Timeout der zugrundeliegenden Vercel-Hobby-
 * Funktion sind (siehe docs/DECISIONS.md) — ein zweiter Versuch hat oft schlicht Glück mit
 * der Anthropic-API-Latenz. Retryt NUR, wenn `fetch()` selbst wirft ODER die Antwort kein
 * gültiges JSON ist (typisch für eine Vercel-Timeout-Fehlerseite, kein valides JSON) — eine
 * erfolgreich geparste Antwort mit einem inhaltlichen Fehler (z.B. `{synthesized: false}`)
 * wird NICHT wiederholt, das ist ein echter, kein transienter Fehler. Kein unbegrenztes
 * Retry, um bei einem dauerhaften Fehler nicht unnötig lange zu warten. Ein absichtlicher
 * Abbruch via `AbortSignal` (siehe DueDiligencePanel "Abbrechen"-Button) wird sofort
 * durchgereicht statt wiederholt — sonst würde "Abbrechen" den zweiten Versuch auslösen.
 */
export async function fetchJsonWithRetry<T>(input: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(input, init);
    return (await res.json()) as T;
  } catch (err) {
    if (isAbortError(err)) throw err;
    const res = await fetch(input, init);
    return (await res.json()) as T;
  }
}
