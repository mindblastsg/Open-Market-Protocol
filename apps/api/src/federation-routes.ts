import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { FederationService } from "./federation.js";

const syncSchema = z.object({ peerDescriptorUrl: z.string().url() });

export function registerFederationRoutes(
  app: FastifyInstance,
  federation: FederationService,
  operatorToken?: string,
) {
  app.get("/federation/node", async () => federation.descriptor());
  app.get("/federation/listings", async () => ({
    listings: await federation.localListings(),
  }));
  app.post("/federation/inbox", async (request) =>
    federation.receive(request.body),
  );

  app.post("/api/operator/federation/sync", async (request, reply) => {
    if (
      !operatorToken ||
      request.headers.authorization !== `Bearer ${operatorToken}`
    ) {
      return reply
        .code(401)
        .send({ error: "Operator authentication required" });
    }
    const parsed = syncSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid peer descriptor URL" });
    }
    const result = await federation.syncPeer(parsed.data.peerDescriptorUrl);
    return {
      peer: result.descriptor,
      importedListings: result.listings.length,
    };
  });
}
