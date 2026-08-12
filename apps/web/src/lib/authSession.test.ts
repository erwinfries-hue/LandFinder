import { describe, it, expect, vi, afterEach } from "vitest";
import { createSessionToken, isValidSessionToken, hasValidSession, SESSION_COOKIE_NAME } from "./authSession";

describe("createSessionToken / isValidSessionToken", () => {
  it("akzeptiert ein frisch erzeugtes Token mit dem richtigen Secret", async () => {
    const token = await createSessionToken("correct-secret");
    expect(await isValidSessionToken(token, "correct-secret")).toBe(true);
  });

  it("lehnt das Token mit einem falschen Secret ab", async () => {
    const token = await createSessionToken("correct-secret");
    expect(await isValidSessionToken(token, "wrong-secret")).toBe(false);
  });

  it("lehnt fehlende oder leere Tokens ab", async () => {
    expect(await isValidSessionToken(undefined, "secret")).toBe(false);
    expect(await isValidSessionToken(null, "secret")).toBe(false);
    expect(await isValidSessionToken("", "secret")).toBe(false);
  });

  it("lehnt manipulierte Tokens ab (Payload verändert, Signatur nicht angepasst)", async () => {
    const token = await createSessionToken("correct-secret");
    const [, signature] = token.split(".");
    const tamperedExpiry = Date.now() + 999 * 24 * 60 * 60 * 1000;
    const tampered = `${tamperedExpiry}.${signature}`;
    expect(await isValidSessionToken(tampered, "correct-secret")).toBe(false);
  });

  it("lehnt abgelaufene Tokens ab", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const token = await createSessionToken("correct-secret");
      vi.setSystemTime(new Date("2027-01-01T00:00:00Z")); // weit nach den 30 Tagen Gültigkeit
      expect(await isValidSessionToken(token, "correct-secret")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lehnt Tokens mit ungültigem Format ab", async () => {
    expect(await isValidSessionToken("kein-punkt-drin", "secret")).toBe(false);
    expect(await isValidSessionToken("123.nicht-hex!!", "secret")).toBe(false);
  });
});

describe("hasValidSession", () => {
  afterEach(() => {
    delete process.env.APP_PASSWORD;
  });

  it("lehnt ab, wenn APP_PASSWORD nicht gesetzt ist (fail closed)", async () => {
    delete process.env.APP_PASSWORD;
    const request = new Request("https://example.test", { headers: { cookie: `${SESSION_COOKIE_NAME}=irrelevant` } });
    expect(await hasValidSession(request)).toBe(false);
  });

  it("lehnt ab, wenn kein Cookie mitgeschickt wird", async () => {
    process.env.APP_PASSWORD = "correct-secret";
    const request = new Request("https://example.test");
    expect(await hasValidSession(request)).toBe(false);
  });

  it("akzeptiert ein gültiges Session-Cookie", async () => {
    process.env.APP_PASSWORD = "correct-secret";
    const token = await createSessionToken("correct-secret");
    const request = new Request("https://example.test", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });
    expect(await hasValidSession(request)).toBe(true);
  });

  it("lehnt ein Cookie mit falschem Secret ab", async () => {
    process.env.APP_PASSWORD = "correct-secret";
    const token = await createSessionToken("wrong-secret");
    const request = new Request("https://example.test", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });
    expect(await hasValidSession(request)).toBe(false);
  });
});
