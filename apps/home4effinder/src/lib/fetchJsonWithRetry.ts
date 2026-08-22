/**
 * Ein einzelner automatischer Wiederholungsversuch für die Dokumenten-KI-Endpunkte, die
 * anfällig für einen transienten 60-Sekunden-Timeout der zugrundeliegenden Vercel-Hobby-
 * Funktion sind (siehe docs/DECISIONS.md) — ein zweiter Versuch hat oft schlicht Glück mit
 * der Anthropic-API-Latenz. Retryt NUR, wenn `fetch()` selbst wirft ODER die Antwort kein
 * gültiges JSON ist (typisch für eine Vercel-Timeout-Fehlerseite, kein valides JSON) — eine
 * erfolgreich geparste Antwort mit einem inhaltlichen Fehler (z.B. `{synthesized: false}`)
 * wird NICHT wiederholt, das ist ein echter, kein transienter Fehler. Kein unbegrenztes
 * Retry, um bei einem dauerhaften Fehler nicht unnötig lange zu warten.
 */
export async function fetchJsonWithRetry<T>(input: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(input, init);
    return (await res.json()) as T;
  } catch {
    const res = await fetch(input, init);
    return (await res.json()) as T;
  }
}
