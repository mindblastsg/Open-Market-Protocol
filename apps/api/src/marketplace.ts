import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  canTransitionBooking,
  type Account,
  type Booking,
  type BookingEvent,
  type BookingState,
  type ServiceListing,
} from "@omp/protocol";

export class MarketplaceNotFoundError extends Error {}
export class InvalidBookingTransitionError extends Error {}

interface ListingRow {
  id: string;
  node_id: string;
  title: string;
  description: string;
  price_minor: number;
  currency: string;
  status: "draft" | "published" | "withdrawn";
}

interface AccountRow {
  id: string;
  display_name: string;
  email: string;
  created_at: Date;
}

interface BookingRow {
  id: string;
  account_id: string;
  listing_id: string;
  status: BookingState;
  agreed_price_minor: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

interface EventRow {
  id: string;
  booking_id: string;
  sequence: number;
  from_state: BookingState | null;
  to_state: BookingState;
  occurred_at: Date;
}

function mapListing(row: ListingRow): ServiceListing {
  return {
    id: row.id,
    nodeId: row.node_id,
    title: row.title,
    description: row.description,
    priceMinor: row.price_minor,
    currency: row.currency,
    status: row.status,
  };
}

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at.toISOString(),
  };
}

function mapEvent(row: EventRow): BookingEvent {
  return {
    id: row.id,
    bookingId: row.booking_id,
    sequence: row.sequence,
    fromState: row.from_state,
    toState: row.to_state,
    occurredAt: row.occurred_at.toISOString(),
  };
}

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    accountId: row.account_id,
    listingId: row.listing_id,
    status: row.status,
    agreedPriceMinor: row.agreed_price_minor,
    currency: row.currency,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class MarketplaceRepository {
  constructor(private readonly pool: Pool) {}

  async listPublishedListings() {
    const result = await this.pool.query<ListingRow>(`
      select id, node_id, title, description, price_minor, currency, status
      from service_listings
      where status = 'published'
      order by title
    `);
    return result.rows.map(mapListing);
  }

  async createOrFindAccount(input: { displayName: string; email: string }) {
    const id = randomUUID();
    const result = await this.pool.query<AccountRow>(
      `
        insert into accounts (id, display_name, email)
        values ($1, $2, lower($3))
        on conflict (lower(email)) do update
        set display_name = excluded.display_name
        returning id, display_name, email, created_at
      `,
      [id, input.displayName, input.email],
    );
    return mapAccount(result.rows[0]!);
  }

  async createBooking(input: { accountId: string; listingId: string }) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const listing = await client.query<ListingRow>(
        `
          select id, node_id, title, description, price_minor, currency, status
          from service_listings
          where id = $1 and status = 'published'
          for share
        `,
        [input.listingId],
      );
      if (!listing.rows[0]) {
        throw new MarketplaceNotFoundError("Published listing not found");
      }

      const account = await client.query(
        "select id from accounts where id = $1",
        [input.accountId],
      );
      if (!account.rows[0]) {
        throw new MarketplaceNotFoundError("Account not found");
      }

      const id = randomUUID();
      const row = await client.query<BookingRow>(
        `
          insert into bookings (
            id, account_id, listing_id, status, agreed_price_minor, currency
          ) values ($1, $2, $3, 'proposed', $4, $5)
          returning id, account_id, listing_id, status, agreed_price_minor,
            currency, created_at, updated_at
        `,
        [
          id,
          input.accountId,
          input.listingId,
          listing.rows[0].price_minor,
          listing.rows[0].currency,
        ],
      );
      await this.insertEvent(client, id, 1, null, "proposed");
      await client.query("commit");
      return this.getBooking(row.rows[0]!.id);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async transitionBooking(id: string, nextState: BookingState) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const current = await client.query<BookingRow>(
        `
          select id, account_id, listing_id, status, agreed_price_minor,
            currency, created_at, updated_at
          from bookings where id = $1 for update
        `,
        [id],
      );
      const booking = current.rows[0];
      if (!booking) throw new MarketplaceNotFoundError("Booking not found");
      if (!canTransitionBooking(booking.status, nextState)) {
        throw new InvalidBookingTransitionError(
          `Cannot transition booking from ${booking.status} to ${nextState}`,
        );
      }

      const sequenceResult = await client.query<{ sequence: number }>(
        "select coalesce(max(sequence), 0) + 1 as sequence from booking_events where booking_id = $1",
        [id],
      );
      await client.query(
        "update bookings set status = $2, updated_at = now() where id = $1",
        [id, nextState],
      );
      await this.insertEvent(
        client,
        id,
        sequenceResult.rows[0]!.sequence,
        booking.status,
        nextState,
      );
      await client.query("commit");
      return this.getBooking(id);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getBooking(id: string) {
    const bookingResult = await this.pool.query<BookingRow>(
      `
        select id, account_id, listing_id, status, agreed_price_minor,
          currency, created_at, updated_at
        from bookings where id = $1
      `,
      [id],
    );
    const row = bookingResult.rows[0];
    if (!row) throw new MarketplaceNotFoundError("Booking not found");

    const [listingResult, eventResult] = await Promise.all([
      this.pool.query<ListingRow>(
        `
          select id, node_id, title, description, price_minor, currency, status
          from service_listings where id = $1
        `,
        [row.listing_id],
      ),
      this.pool.query<EventRow>(
        `
          select id, booking_id, sequence, from_state, to_state, occurred_at
          from booking_events where booking_id = $1 order by sequence
        `,
        [id],
      ),
    ]);

    return {
      ...mapBooking(row),
      listing: mapListing(listingResult.rows[0]!),
      events: eventResult.rows.map(mapEvent),
    };
  }

  private async insertEvent(
    client: PoolClient,
    bookingId: string,
    sequence: number,
    fromState: BookingState | null,
    toState: BookingState,
  ) {
    await client.query(
      `
        insert into booking_events (
          id, booking_id, sequence, from_state, to_state
        ) values ($1, $2, $3, $4, $5)
      `,
      [randomUUID(), bookingId, sequence, fromState, toState],
    );
  }
}
