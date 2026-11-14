import { generateKeyPairSync, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createDatabase, type Database } from "./database.js";
import {
  FederationService,
  signEnvelope,
  type FederationConfig,
  type FederationTransport,
} from "./federation.js";
import { MarketplaceRepository } from "./marketplace.js";

class InMemoryTransport implements FederationTransport {
  private readonly apps = new Map<string, FastifyInstance>();

  register(origin: string, app: FastifyInstance) {
    this.apps.set(origin, app);
  }

  async get(url: string) {
    return this.request(url, "GET");
  }

  async post(url: string, body: unknown) {
    return this.request(url, "POST", body);
  }

  private async request(url: string, method: "GET" | "POST", body?: unknown) {
    const parsed = new URL(url);
    const app = this.apps.get(parsed.origin);
    if (!app)
      throw new Error(`No in-memory node registered for ${parsed.origin}`);
    const response = await app.inject({
      method,
      url: `${parsed.pathname}${parsed.search}`,
      ...(body === undefined ? {} : { payload: body }),
    });
    if (response.statusCode >= 400) {
      throw new Error(`In-memory federation request failed: ${response.body}`);
    }
    return response.json();
  }
}

function keys() {
  return generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
}

function config(
  origin: string,
  databaseId: string,
  name: string,
  peerDescriptorUrl: string,
): FederationConfig {
  const pair = keys();
  return {
    descriptor: {
      id: `${origin}/nodes/main`,
      databaseId,
      name,
      protocolVersion: "0.0.1-draft",
      inbox: `${origin}/federation/inbox`,
      listings: `${origin}/federation/listings`,
      publicKey: pair.publicKey,
    },
    privateKey: pair.privateKey,
    allowedDescriptorUrls: new Set([peerDescriptorUrl]),
  };
}

const primaryUrl = process.env.DATABASE_URL;
const peerUrl = process.env.PEER_DATABASE_URL;
const enabled = Boolean(primaryUrl && peerUrl);

describe.skipIf(!enabled)("two-node federation", () => {
  let databaseA: Database;
  let databaseB: Database;
  let repositoryA: MarketplaceRepository;
  let repositoryB: MarketplaceRepository;
  let federationA: FederationService;
  let federationB: FederationService;
  let appA: FastifyInstance;
  let appB: FastifyInstance;
  let configA: FederationConfig;
  let configB: FederationConfig;
  const accountIds: string[] = [];

  beforeAll(async () => {
    databaseA = createDatabase(primaryUrl!);
    databaseB = createDatabase(peerUrl!);
    repositoryA = new MarketplaceRepository(databaseA.pool);
    repositoryB = new MarketplaceRepository(databaseB.pool);
    const transport = new InMemoryTransport();
    configA = config(
      "http://node-a.test",
      "10000000-0000-4000-8000-000000000001",
      "Node A",
      "http://node-b.test/federation/node",
    );
    configB = config(
      "http://node-b.test",
      "10000000-0000-4000-8000-000000000002",
      "Node B",
      "http://node-a.test/federation/node",
    );
    federationA = new FederationService(repositoryA, configA, transport);
    federationB = new FederationService(repositoryB, configB, transport);
    await Promise.all([federationA.initialise(), federationB.initialise()]);
    appA = buildApp({ marketplace: repositoryA, federation: federationA });
    appB = buildApp({ marketplace: repositoryB, federation: federationB });
    transport.register("http://node-a.test", appA);
    transport.register("http://node-b.test", appB);
    await federationA.syncPeer("http://node-b.test/federation/node");
    await federationB.syncPeer("http://node-a.test/federation/node");
  });

  afterAll(async () => {
    if (accountIds.length > 0) {
      await databaseB.pool.query(
        "delete from accounts where id = any($1::uuid[])",
        [accountIds],
      );
    }
    await Promise.all([appA.close(), appB.close()]);
    await Promise.all([databaseA.close(), databaseB.close()]);
  });

  it("discovers a remote listing and completes a signed cross-node booking", async () => {
    const listingsResponse = await appB.inject({
      method: "GET",
      url: "/api/listings",
    });
    const remoteListing = listingsResponse
      .json()
      .listings.find(
        (listing: { nodeId: string }) =>
          listing.nodeId === configA.descriptor.databaseId,
      );
    expect(remoteListing).toBeTruthy();

    const accountResponse = await appB.inject({
      method: "POST",
      url: "/api/accounts",
      payload: {
        displayName: "Federated customer",
        email: `federated-${randomUUID()}@example.test`,
      },
    });
    const accountId = accountResponse.json().account.id as string;
    accountIds.push(accountId);

    const bookingResponse = await appB.inject({
      method: "POST",
      url: "/api/bookings",
      payload: { accountId, listingId: remoteListing.id },
    });
    expect(bookingResponse.statusCode).toBe(201);
    const booking = bookingResponse.json().booking;
    expect(booking.status).toBe("confirmed");
    expect(
      booking.events.map((event: { toState: string }) => event.toState),
    ).toEqual(["proposed", "confirmed"]);

    const mirrored = await databaseA.pool.query<{ count: string }>(
      "select count(*)::text as count from remote_bookings where source_booking_id = $1",
      [booking.id],
    );
    expect(mirrored.rows[0]!.count).toBe("1");
  });

  it("returns the same remote booking for a retried signed event", async () => {
    const sourceBookingId = randomUUID();
    const eventId = randomUUID();
    const envelope = signEnvelope(configB.privateKey, {
      id: eventId,
      type: "booking.proposed",
      sender: configB.descriptor.id,
      sentAt: new Date().toISOString(),
      payload: {
        sourceBookingId,
        listingId: "20000000-0000-4000-8000-000000000001",
        agreedPriceMinor: 4500,
        currency: "GBP",
      },
    });

    const first = await appA.inject({
      method: "POST",
      url: "/federation/inbox",
      payload: envelope,
    });
    const second = await appA.inject({
      method: "POST",
      url: "/federation/inbox",
      payload: envelope,
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().payload.remoteBookingId).toBe(
      second.json().payload.remoteBookingId,
    );

    const count = await databaseA.pool.query<{ count: string }>(
      "select count(*)::text as count from remote_bookings where source_booking_id = $1",
      [sourceBookingId],
    );
    expect(count.rows[0]!.count).toBe("1");
  });
});
