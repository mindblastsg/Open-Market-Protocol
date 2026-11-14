import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const migrationsDirectory = fileURLToPath(
  new URL("../migrations", import.meta.url),
);
const pool = new pg.Pool({ connectionString, max: 1 });
const advisoryLock = 7_603_341;

try {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [advisoryLock]);
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const name of migrationFiles) {
      const sql = await readFile(
        new URL(`../migrations/${name}`, import.meta.url),
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "select checksum from schema_migrations where name = $1",
        [name],
      );

      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${name} has changed`);
        }
        continue;
      }

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into schema_migrations (name, checksum) values ($1, $2)",
          [name, checksum],
        );
        await client.query("commit");
        process.stdout.write(`Applied ${name}\n`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client
      .query("select pg_advisory_unlock($1)", [advisoryLock])
      .catch(() => undefined);
    client.release();
  }
} finally {
  await pool.end();
}

