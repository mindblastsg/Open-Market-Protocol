import type { FastifyInstance } from "fastify";
import {
  createAccountSchema,
  createBookingSchema,
  transitionBookingSchema,
} from "@omp/protocol";
import {
  InvalidBookingTransitionError,
  MarketplaceNotFoundError,
  type MarketplaceRepository,
} from "./marketplace.js";

export function registerMarketplaceRoutes(
  app: FastifyInstance,
  marketplace: MarketplaceRepository,
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
      return reply
        .code(201)
        .send({ booking: await marketplace.createBooking(parsed.data) });
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
}
