import { buildApp } from "./app.js";
import { createDatabase } from "./database.js";

const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl ? createDatabase(databaseUrl) : null;
const app = database
  ? buildApp({ checkDatabase: () => database.ping() })
  : buildApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await database?.close();
    process.exit(0);
  });
}
