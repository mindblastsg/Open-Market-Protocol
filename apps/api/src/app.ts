import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({
    service: "open-market-protocol-api",
    status: "ok",
    phase: "foundation"
  }));

  return app;
}

