import type { FastifyInstance } from "fastify";
import {
  createAccountSchema,
  createBookingSchema,
  createServiceListingSchema,
  transitionBookingSchema,
} from "@omp/protocol";
import {
  InvalidBookingTransitionError,
  MarketplaceNotFoundError,
  type MarketplaceRepository,
} from "./marketplace.js";
import type { FederationService } from "./federation.js";

export function registerMarketplaceRoutes(
  app: FastifyInstance,
  marketplace: MarketplaceRepository,
  operatorToken?: string,
  federation?: FederationService,
) {
  app.get("/api/listings", async () => ({
    listings: await marketplace.listPublishedListings(),
  }));

  app.post("/api/accounts", async (request, reply) => {
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid account", details: parsed.error.issues });
    }
    return reply
      .code(201)
      .send({ account: await marketplace.createOrFindAccount(parsed.data) });
  });

  app.post("/api/bookings", async (request, reply) => {
    const parsed = createBookingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid booking", details: parsed.error.issues });
    }
    try {
      const booking = federation
        ? await federation.createBooking(parsed.data)
        : await marketplace.createBooking(parsed.data);
      return reply.code(201).send({ booking });
    } catch (error) {
      if (error instanceof MarketplaceNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/bookings/:id",
    async (request, reply) => {
      try {
        return { booking: await marketplace.getBooking(request.params.id) };
      } catch (error) {
        if (error instanceof MarketplaceNotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/bookings/:id/transitions",
    async (request, reply) => {
      const parsed = transitionBookingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: "Invalid transition", details: parsed.error.issues });
      }
      try {
        return {
          booking: await marketplace.transitionBooking(
            request.params.id,
            parsed.data.state,
          ),
        };
      } catch (error) {
        if (error instanceof MarketplaceNotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof InvalidBookingTransitionError) {
          return reply.code(409).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  function requireOperator(authorization: string | undefined) {
    return Boolean(
      operatorToken && authorization === `Bearer ${operatorToken}`,
    );
  }

  app.post("/api/operator/listings", async (request, reply) => {
    if (!requireOperator(request.headers.authorization)) {
      return reply
        .code(401)
        .send({ error: "Operator authentication required" });
    }
    const parsed = createServiceListingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid listing",
        details: parsed.error.issues,
      });
    }
    return reply
      .code(201)
      .send({ listing: await marketplace.createListing(parsed.data) });
  });

  app.post<{ Params: { id: string } }>(
    "/api/operator/listings/:id/withdraw",
    async (request, reply) => {
      if (!requireOperator(request.headers.authorization)) {
        return reply
          .code(401)
          .send({ error: "Operator authentication required" });
      }
      try {
        return {
          listing: await marketplace.withdrawListing(request.params.id),
        };
      } catch (error) {
        if (error instanceof MarketplaceNotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );
}
