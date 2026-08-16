import { describe, it, expect, afterEach } from "vitest";
import { hasValidCronSecret } from "./cronAuth";

describe("hasValidCronSecret", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("lehnt ab, wenn CRON_SECRET nicht gesetzt ist (fail closed, auch bei korrektem Header)", () => {
    delete process.env.CRON_SECRET;
    const request = new Request("https://example.com/api/cron/maintenance", { headers: { authorization: "Bearer irgendwas" } });
    expect(hasValidCronSecret(request)).toBe(false);
  });

  it("lehnt ab, wenn der Authorization-Header fehlt", () => {
    process.env.CRON_SECRET = "geheim";
    const request = new Request("https://example.com/api/cron/maintenance");
    expect(hasValidCronSecret(request)).toBe(false);
  });

  it("lehnt ab, wenn der Header nicht mit CRON_SECRET übereinstimmt", () => {
    process.env.CRON_SECRET = "geheim";
    const request = new Request("https://example.com/api/cron/maintenance", { headers: { authorization: "Bearer falsch" } });
    expect(hasValidCronSecret(request)).toBe(false);
  });

  it("akzeptiert den von Vercel Cron automatisch gesetzten Bearer-Header bei korrektem CRON_SECRET", () => {
    process.env.CRON_SECRET = "geheim";
    const request = new Request("https://example.com/api/cron/maintenance", { headers: { authorization: "Bearer geheim" } });
    expect(hasValidCronSecret(request)).toBe(true);
  });
});
