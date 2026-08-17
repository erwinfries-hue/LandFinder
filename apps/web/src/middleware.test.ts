import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("middleware", () => {
  const originalPassword = process.env.APP_PASSWORD;

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = originalPassword;
  });

  it("lässt die Cron-Route ohne Session-Cookie durch (eigene Prüfung via CRON_SECRET in der Route selbst)", async () => {
    process.env.APP_PASSWORD = "geheim";
    const request = new NextRequest("https://example.com/api/cron/maintenance");
    const response = await middleware(request);
    // NextResponse.next() hat keinen redirect/JSON-Error-Body — die Middleware greift hier nicht ein.
    expect(response.status).toBe(200);
  });

  it("lässt den Postmark-Webhook ohne Session-Cookie durch", async () => {
    process.env.APP_PASSWORD = "geheim";
    const request = new NextRequest("https://example.com/api/inbound/portal-alerts");
    const response = await middleware(request);
    expect(response.status).toBe(200);
  });

  it("weist eine geschützte API-Route ohne gültiges Session-Cookie mit 401 ab", async () => {
    process.env.APP_PASSWORD = "geheim";
    const request = new NextRequest("https://example.com/api/state/searchProfile");
    const response = await middleware(request);
    expect(response.status).toBe(401);
  });

  it("bleibt gesperrt (fail closed), wenn APP_PASSWORD nicht gesetzt ist — auch für eine sonst geschützte Route", async () => {
    delete process.env.APP_PASSWORD;
    const request = new NextRequest("https://example.com/api/state/searchProfile");
    const response = await middleware(request);
    expect(response.status).toBe(503);
  });
});
