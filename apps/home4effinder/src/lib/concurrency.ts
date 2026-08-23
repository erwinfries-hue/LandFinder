/**
 * Führt `worker` über alle `items` mit maximal `limit` gleichzeitigen Aufrufen aus, statt
 * streng nacheinander. Eingeführt, weil das rein sequenzielle Analysieren/Anhängen vieler
 * Dokumente (Neu-Erfassen-Flow, jedes einzeln ein eigener Server-Request) bei grösseren
 * Dokumentensets (15-20 Dateien) mehrere Minuten dauerte — spürbar "sehr sehr lange" laut
 * Rückmeldung, und je länger die Seite offen bleiben muss, desto grösser das Risiko, dass
 * eine mobile Verbindung/der Tab dazwischen unterbrochen wird und Ergebnisse verloren
 * gehen. Jeder einzelne Request bleibt weiterhin ein eigener, unabhängiger Server-Aufruf
 * mit eigenem Zeitbudget — Parallelität hier ist rein clientseitig (mehrere Fetches
 * gleichzeitig statt nacheinander), erhöht also nicht das Risiko eines einzelnen
 * Server-Timeouts, nur die Gesamtdauer sinkt. `limit` bewusst moderat gewählt (siehe
 * Aufrufer), um weder die Anthropic-API-Rate-Limits noch die Supabase-Verbindungen zu
 * überlasten.
 */
export async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function runNext(): Promise<void> {
    const i = index++;
    if (i >= items.length) return;
    await worker(items[i]);
    await runNext();
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
}
