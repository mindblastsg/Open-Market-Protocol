import Fastify from "fastify";

export type DatabaseCheck = () => Promise<boolean>;

interface BuildAppOptions {
  checkDatabase?: DatabaseCheck;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.get("/health", async (_request, reply) => {
    const database = options.checkDatabase
      ? await options.checkDatabase().catch(() => false)
      : null;

    const ready = database !== false;
    return reply.code(ready ? 200 : 503).send({
      service: "open-market-protocol-api",
      status: ready ? "ok" : "degraded",
      phase: "foundation",
      database:
        database === null
          ? "not-configured"
          : database
            ? "ready"
            : "unavailable",
    });
  });

  return app;
}

