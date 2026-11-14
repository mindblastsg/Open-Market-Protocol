import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createDatabase } from "./database.js";
import { MarketplaceRepository } from "./marketplace.js";

const connectionString = process.env.DATABASE_URL;
const database = connectionString ? createDatabase(connectionString) : null;
const marketplace = database ? new MarketplaceRepository(database.pool) : null;
const app = marketplace ? buildApp({ marketplace }) : null;
const createdAccountIds: string[] = [];

afterAll(async () => {
  await app?.close();
  if (database && createdAccountIds.length > 0) {
    await database.pool.query(
      "delete from accounts where id = any($1::uuid[])",
      [createdAccountIds],
    );
  }
  await database?.close();
});

describe.skipIf(!app)("standalone marketplace flow", () => {
  it("creates an account and completes an auditable simulated booking", async () => {
    const listingsResponse = await app!.inject({
      method: "GET",
      url: "/api/listings",
    });
    expect(listingsResponse.statusCode).toBe(200);
    const listings = listingsResponse.json().listings as Array<{ id: string }>;
    expect(listings).toHaveLength(3);

    const uniqueEmail = `demo-${randomUUID()}@example.test`;
    const accountResponse = await app!.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { displayName: "Demo participant", email: uniqueEmail },
    });
    expect(accountResponse.statusCode).toBe(201);
    const accountId = accountResponse.json().account.id as string;
    createdAccountIds.push(accountId);

    const createResponse = await app!.inject({
      method: "POST",
      url: "/api/bookings",
      payload: { accountId, listingId: listings[0]!.id },
    });
    expect(createResponse.statusCode).toBe(201);
    const proposed = createResponse.json().booking;
    expect(proposed.status).toBe("proposed");
    expect(proposed.events).toHaveLength(1);

    const confirmResponse = await app!.inject({
      method: "POST",
      url: `/api/bookings/${proposed.id}/transitions`,
      payload: { state: "confirmed" },
    });
    expect(confirmResponse.statusCode).toBe(200);
    const confirmed = confirmResponse.json().booking;
    expect(confirmed.status).toBe("confirmed");
    expect(
      confirmed.events.map((event: { toState: string }) => event.toState),
    ).toEqual(["proposed", "confirmed"]);

    const completeResponse = await app!.inject({
      method: "POST",
      url: `/api/bookings/${proposed.id}/transitions`,
      payload: { state: "completed" },
    });
    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().booking.status).toBe("completed");

    const invalidResponse = await app!.inject({
      method: "POST",
      url: `/api/bookings/${proposed.id}/transitions`,
      payload: { state: "cancelled" },
    });
    expect(invalidResponse.statusCode).toBe(409);
  });
});
