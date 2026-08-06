/**
 * Gemeinsame Grundlage für `searchProfile.ts` und `annahmen.ts`: ein externer Store
 * (kompatibel mit `useSyncExternalStore`), der weiterhin sofort/synchron aus
 * `localStorage` liest (keine Hydration-Verzögerung, kein Flackern), aber zusätzlich
 * einmalig pro Seitenaufruf mit dem Server (`/api/state/[id]`, Supabase-gestützt)
 * abgleicht und Schreibvorgänge dorthin weiterreicht — so bleibt der Zustand
 * geräteübergreifend konsistent statt nur pro Browser (siehe docs/OPEN_DECISIONS.md,
 * Punkt F/D). `localStorage` bleibt als schnelle lokale Kopie/Fallback erhalten, falls
 * der Server (noch) nicht erreichbar oder nicht konfiguriert ist.
 */
export function createRemoteSyncedStore<T>(options: {
  storageKey: string;
  apiId: string;
  defaultValue: T;
  /** Merged einen aus localStorage/Server gelesenen Teil-Wert defensiv über den Default. */
  merge: (partial: unknown) => T;
}) {
  let cachedRaw: string | null = null;
  let cachedValue: T = options.defaultValue;
  let fetchedFromServer = false;
  let fetchInFlight = false;
  const listeners = new Set<() => void>();

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  function readLocal(): T {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(options.storageKey);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = raw ? safeMerge(raw) : options.defaultValue;
    }
    return cachedValue;
  }

  function safeMerge(raw: string): T {
    try {
      return options.merge(JSON.parse(raw));
    } catch {
      return options.defaultValue;
    }
  }

  function applyAndNotify(value: T): void {
    cachedValue = value;
    cachedRaw = JSON.stringify(value);
    if (typeof window !== "undefined") window.localStorage.setItem(options.storageKey, cachedRaw);
    notify();
  }

  /** Wird beim ersten `getSnapshot()`-Aufruf im Browser einmalig angestossen (lazy, gegen Mehrfachaufrufe abgesichert). */
  function fetchFromServerOnce(): void {
    if (fetchedFromServer || fetchInFlight || typeof window === "undefined") return;
    fetchInFlight = true;
    fetch(`/api/state/${options.apiId}`)
      .then((res) => res.json())
      .then((body: { data?: unknown }) => {
        fetchedFromServer = true;
        if (body?.data) applyAndNotify(options.merge(body.data));
      })
      .catch((err) => {
        console.warn(`[remoteStore:${options.apiId}] Server-Sync fehlgeschlagen, bleibe bei lokalem Stand`, err);
      })
      .finally(() => {
        fetchInFlight = false;
      });
  }

  return {
    getSnapshot(): T {
      fetchFromServerOnce();
      return readLocal();
    },
    getServerSnapshot(): T {
      return options.defaultValue;
    },
    subscribe(callback: () => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    /** Löst mit `true` auf, sobald der Server-Schreibvorgang bestätigt ist (bzw. `false` bei Fehler/nicht konfiguriert) — für UI-Feedback wie "Gespeichert ✓". Lokal ist der Wert bereits vorher übernommen, unabhängig vom Ausgang. */
    async setValue(value: T): Promise<boolean> {
      applyAndNotify(value);
      try {
        const res = await fetch(`/api/state/${options.apiId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: cachedRaw ?? JSON.stringify(value),
        });
        if (!res.ok) return false;
        const body = (await res.json()) as { saved?: boolean };
        return Boolean(body.saved);
      } catch (err) {
        console.warn(`[remoteStore:${options.apiId}] Speichern auf Server fehlgeschlagen, lokal aber übernommen`, err);
        return false;
      }
    },
  };
}
