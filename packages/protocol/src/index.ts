import { z } from "zod";

export const protocolVersion = "0.0.1-draft" as const;

export const nodeDescriptorSchema = z
  .object({
    id: z.string().url(),
    name: z.string().trim().min(1).max(120),
    protocolVersion: z.literal(protocolVersion),
    inbox: z.string().url(),
  })
  .strict();

export type NodeDescriptor = z.infer<typeof nodeDescriptorSchema>;

export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const serviceListingSchema = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string(),
  priceMinor: z.number().int().nonnegative(),
  currency: currencySchema,
  status: z.enum(["draft", "published", "withdrawn"]),
});

export const accountSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  createdAt: z.string().datetime(),
});

export const createAccountSchema = accountSchema.pick({
  displayName: true,
  email: true,
});

export const bookingStateSchema = z.enum([
  "proposed",
  "confirmed",
  "completed",
  "cancelled",
  "rejected",
  "expired",
]);

export type BookingState = z.infer<typeof bookingStateSchema>;

const allowedTransitions: Record<BookingState, readonly BookingState[]> = {
  proposed: ["confirmed", "cancelled", "rejected", "expired"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
  expired: [],
};

export function canTransitionBooking(from: BookingState, to: BookingState) {
  return allowedTransitions[from].includes(to);
}

export const bookingEventSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  sequence: z.number().int().positive(),
  fromState: bookingStateSchema.nullable(),
  toState: bookingStateSchema,
  occurredAt: z.string().datetime(),
});

export const bookingSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  status: bookingStateSchema,
  agreedPriceMinor: z.number().int().nonnegative(),
  currency: currencySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  listing: serviceListingSchema.optional(),
  events: z.array(bookingEventSchema).optional(),
});

export const createBookingSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
});

export const transitionBookingSchema = z.object({
  state: bookingStateSchema,
});

export type ServiceListing = z.infer<typeof serviceListingSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type BookingEvent = z.infer<typeof bookingEventSchema>;
