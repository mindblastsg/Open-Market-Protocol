import pg from "pg";

export interface Database {
  pool: pg.Pool;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  return {
    pool,
    async ping() {
      const result = await pool.query<{ ok: number }>("select 1 as ok");
      return result.rows[0]?.ok === 1;
    },
    async close() {
      await pool.end();
    },
  };
}
