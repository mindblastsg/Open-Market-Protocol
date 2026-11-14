import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("health endpoint", () => {
  it("reports the service as a foundation scaffold", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "open-market-protocol-api",
      status: "ok",
      phase: "foundation",
      database: "not-configured",
    });
  });

  it("reports a database failure without claiming readiness", async () => {
    const app = buildApp({ checkDatabase: async () => false });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "degraded",
      database: "unavailable",
    });
  });
});

