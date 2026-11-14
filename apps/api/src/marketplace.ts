import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  canTransitionBooking,
  type Account,
  type Booking,
  type BookingEvent,
  type BookingState,
  type FederatedBookingProposal,
  type FederatedBookingReceipt,
  type NodeDescriptor,
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

interface NodeRow {
  id: string;
  canonical_url: string;
  display_name: string;
  protocol_version: string;
  inbox_url: string;
  public_key: string | null;
  trusted: boolean;
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

  async listLocalPublishedListings(nodeId: string) {
    const result = await this.pool.query<ListingRow>(
      `
        select id, node_id, title, description, price_minor, currency, status
        from service_listings
        where status = 'published' and node_id = $1
        order by title
      `,
      [nodeId],
    );
    return result.rows.map(mapListing);
  }

  async configureNode(descriptor: NodeDescriptor, trusted: boolean) {
    await this.pool.query(
      `
        insert into marketplace_nodes (
          id, canonical_url, display_name, protocol_version, inbox_url,
          public_key, trusted, last_seen_at
        ) values ($1, $2, $3, $4, $5, $6, $7, now())
        on conflict (id) do update set
          canonical_url = excluded.canonical_url,
          display_name = excluded.display_name,
          protocol_version = excluded.protocol_version,
          inbox_url = excluded.inbox_url,
          public_key = excluded.public_key,
          trusted = excluded.trusted,
          last_seen_at = now(),
          updated_at = now()
      `,
      [
        descriptor.databaseId,
        descriptor.id,
        descriptor.name,
        descriptor.protocolVersion,
        descriptor.inbox,
        descriptor.publicKey,
        trusted,
      ],
    );
  }

  async getNodeByDatabaseId(id: string) {
    const result = await this.pool.query<NodeRow>(
      `
        select id, canonical_url, display_name, protocol_version, inbox_url,
          public_key, trusted
        from marketplace_nodes where id = $1
      `,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new MarketplaceNotFoundError("Marketplace node not found");
    return row;
  }

  async getTrustedNodeByUrl(url: string) {
    const result = await this.pool.query<NodeRow>(
      `
        select id, canonical_url, display_name, protocol_version, inbox_url,
          public_key, trusted
        from marketplace_nodes
        where canonical_url = $1 and trusted = true
      `,
      [url],
    );
    const row = result.rows[0];
    if (!row?.public_key)
      throw new MarketplaceNotFoundError("Trusted peer not found");
    return row;
  }

  async upsertRemoteListings(nodeId: string, listings: ServiceListing[]) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const listing of listings) {
        if (listing.nodeId !== nodeId) {
          throw new Error(
            "Peer listing does not belong to its advertised node",
          );
        }
        await client.query(
          `
            insert into service_listings (
              id, node_id, title, description, price_minor, currency, status,
              origin_url
            ) values ($1, $2, $3, $4, $5, $6, $7,
              (select canonical_url from marketplace_nodes where id = $2))
            on conflict (id) do update set
              title = excluded.title,
              description = excluded.description,
              price_minor = excluded.price_minor,
              currency = excluded.currency,
              status = excluded.status,
              origin_url = excluded.origin_url,
              updated_at = now()
          `,
          [
            listing.id,
            nodeId,
            listing.title,
            listing.description,
            listing.priceMinor,
            listing.currency,
            listing.status,
          ],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordFederatedProposal(
    eventId: string,
    sender: string,
    proposal: FederatedBookingProposal,
    localNodeId: string,
  ): Promise<FederatedBookingReceipt> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const cached = await client.query<{
        response_payload: FederatedBookingReceipt;
      }>("select response_payload from federation_inbox where event_id = $1", [
        eventId,
      ]);
      if (cached.rows[0]) {
        await client.query("commit");
        return cached.rows[0].response_payload;
      }

      const listing = await client.query<ListingRow>(
        `
          select id, node_id, title, description, price_minor, currency, status
          from service_listings
          where id = $1 and node_id = $2 and status = 'published'
          for share
        `,
        [proposal.listingId, localNodeId],
      );
      const localListing = listing.rows[0];
      if (!localListing)
        throw new MarketplaceNotFoundError("Local listing not found");
      if (
        localListing.price_minor !== proposal.agreedPriceMinor ||
        localListing.currency !== proposal.currency
      ) {
        throw new InvalidBookingTransitionError(
          "Remote listing terms are stale",
        );
      }

      const remote = await client.query<{ id: string; status: "confirmed" }>(
        `
          insert into remote_bookings (
            id, source_node_url, source_booking_id, listing_id,
            agreed_price_minor, currency, status
          ) values ($1, $2, $3, $4, $5, $6, 'confirmed')
          on conflict (source_node_url, source_booking_id) do update
          set source_booking_id = excluded.source_booking_id
          returning id, status
        `,
        [
          randomUUID(),
          sender,
          proposal.sourceBookingId,
          proposal.listingId,
          proposal.agreedPriceMinor,
          proposal.currency,
        ],
      );
      const response: FederatedBookingReceipt = {
        sourceBookingId: proposal.sourceBookingId,
        remoteBookingId: remote.rows[0]!.id,
        status: "confirmed",
      };
      await client.query(
        `
          insert into federation_inbox (
            event_id, sender, event_type, response_payload
          ) values ($1, $2, 'booking.proposed', $3::jsonb)
        `,
        [eventId, sender, JSON.stringify(response)],
      );
      await client.query("commit");
      return response;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async createListing(input: {
    title: string;
    description: string;
    priceMinor: number;
    currency: string;
  }) {
    const id = randomUUID();
    const result = await this.pool.query<ListingRow>(
      `
        insert into service_listings (
          id, node_id, title, description, price_minor, currency, status
        ) values (
          $1, '10000000-0000-4000-8000-000000000001', $2, $3, $4, $5, 'published'
        )
        returning id, node_id, title, description, price_minor, currency, status
      `,
      [id, input.title, input.description, input.priceMinor, input.currency],
    );
    return mapListing(result.rows[0]!);
  }

  async withdrawListing(id: string) {
    const result = await this.pool.query<ListingRow>(
      `
        update service_listings
        set status = 'withdrawn', updated_at = now()
        where id = $1 and status = 'published'
        returning id, node_id, title, description, price_minor, currency, status
      `,
      [id],
    );
    if (!result.rows[0]) {
      throw new MarketplaceNotFoundError("Published listing not found");
    }
    return mapListing(result.rows[0]);
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
