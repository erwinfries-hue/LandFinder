import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRemoteSyncedStore } from "./remoteStore";

/** Minimaler In-Memory-Ersatz für `window.localStorage`, ohne jsdom-Abhängigkeit. */
function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

interface TestValue {
  id: string;
  value: number;
}

const defaultValue: TestValue = { id: "default", value: 0 };
function merge(partial: unknown): TestValue {
  return { ...defaultValue, ...(partial as Partial<TestValue>) };
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createRemoteSyncedStore", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("liest den Default-Wert, wenn localStorage leer ist", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
    const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });
    expect(store.getSnapshot()).toEqual(defaultValue);
  });

  it("liest sofort aus localStorage, ohne auf den Server zu warten", () => {
    (window as unknown as { localStorage: ReturnType<typeof createLocalStorageMock> }).localStorage.setItem(
      "test.v1",
      JSON.stringify({ id: "local", value: 5 }),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
    const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });
    expect(store.getSnapshot()).toEqual({ id: "local", value: 5 });
  });

  it("fällt bei kaputtem JSON in localStorage auf den Default zurück, statt zu werfen", () => {
    (window as unknown as { localStorage: ReturnType<typeof createLocalStorageMock> }).localStorage.setItem(
      "test.v1",
      "{kein gültiges JSON",
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }));
    const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });
    expect(store.getSnapshot()).toEqual(defaultValue);
  });

  it("gleicht einmalig mit dem Server ab und benachrichtigt Listener bei neuen Daten", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: { id: "server", value: 9 } }) });
    vi.stubGlobal("fetch", fetchMock);
    const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });
    const listener = vi.fn();
    store.subscribe(listener);

    store.getSnapshot(); // löst fetchFromServerOnce() aus
    await nextTick();

    expect(fetchMock).toHaveBeenCalledWith("/api/state/test");
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({ id: "server", value: 9 });
  });

  it("ruft den Server nur einmal ab, auch bei mehrfachem getSnapshot()", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });

    store.getSnapshot();
    store.getSnapshot();
    store.getSnapshot();
    await nextTick();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bleibt beim lokalen Stand, wenn der Server-Abgleich fehlschlägt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });

    store.getSnapshot();
    await nextTick();

    expect(store.getSnapshot()).toEqual(defaultValue);
    expect(consoleWarn).toHaveBeenCalled();
  });

  it("getServerSnapshot() liefert immer den Default-Wert (für SSR)", () => {
    const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });
    expect(store.getServerSnapshot()).toEqual(defaultValue);
  });

  describe("setValue", () => {
    it("übernimmt den Wert sofort lokal und meldet true, wenn der Server bestätigt", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
      vi.stubGlobal("fetch", fetchMock);
      const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });

      const result = await store.setValue({ id: "neu", value: 42 });

      expect(result).toBe(true);
      expect(store.getSnapshot()).toEqual({ id: "neu", value: 42 });
      expect(fetchMock).toHaveBeenCalledWith("/api/state/test", expect.objectContaining({ method: "PUT" }));
    });

    it("übernimmt den Wert lokal, meldet aber false, wenn der Server ablehnt", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
      const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });

      const result = await store.setValue({ id: "neu", value: 42 });

      expect(result).toBe(false);
      expect(store.getSnapshot()).toEqual({ id: "neu", value: 42 });
    });

    it("übernimmt den Wert lokal, meldet aber false, wenn der Server nicht erreichbar ist", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });

      const result = await store.setValue({ id: "neu", value: 42 });

      expect(result).toBe(false);
      expect(store.getSnapshot()).toEqual({ id: "neu", value: 42 });
      expect(consoleWarn).toHaveBeenCalled();
    });

    it("benachrichtigt Listener sofort, ohne auf die Server-Antwort zu warten", () => {
      let resolveFetch: (value: unknown) => void = () => {};
      vi.stubGlobal(
        "fetch",
        vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
        ),
      );
      const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });
      const listener = vi.fn();
      store.subscribe(listener);

      void store.setValue({ id: "neu", value: 1 });

      expect(listener).toHaveBeenCalledTimes(1);
      resolveFetch({ ok: true, json: async () => ({ saved: true }) });
    });
  });

  describe("subscribe", () => {
    it("liefert eine Unsubscribe-Funktion, die den Listener wieder entfernt", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ saved: true }) }));
      const store = createRemoteSyncedStore({ storageKey: "test.v1", apiId: "test", defaultValue, merge });
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      unsubscribe();

      await store.setValue({ id: "neu", value: 1 });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
