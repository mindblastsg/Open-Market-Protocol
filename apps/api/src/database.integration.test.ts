import { afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "./database.js";

const connectionString = process.env.DATABASE_URL;
const database = connectionString ? createDatabase(connectionString) : null;

afterAll(async () => {
  await database?.close();
});

describe.skipIf(!database)("database integration", () => {
  it("connects to PostgreSQL", async () => {
    await expect(database!.ping()).resolves.toBe(true);
  });
});

