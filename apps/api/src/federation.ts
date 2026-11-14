import { randomUUID, sign, verify } from "node:crypto";
import {
  federatedBookingProposalSchema,
  federatedBookingReceiptSchema,
  federationEnvelopeSchema,
  nodeDescriptorSchema,
  serviceListingSchema,
  type Booking,
  type FederatedBookingProposal,
  type FederationEnvelope,
  type NodeDescriptor,
} from "@omp/protocol";
import { MarketplaceRepository } from "./marketplace.js";

export interface FederationTransport {
  get(url: string): Promise<unknown>;
  post(url: string, body: unknown): Promise<unknown>;
}

export class HttpFederationTransport implements FederationTransport {
  async get(url: string) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok)
      throw new Error(`Federation GET failed with ${response.status}`);
    return response.json();
  }

  async post(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      throw new Error(`Federation POST failed with ${response.status}`);
    return response.json();
  }
}

export interface FederationConfig {
  descriptor: NodeDescriptor;
  privateKey: string;
  allowedDescriptorUrls: ReadonlySet<string>;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`);
  return `{${entries.join(",")}}`;
}

function signingValue(envelope: Omit<FederationEnvelope, "signature">) {
  return Buffer.from(canonicalize(envelope));
}

export function signEnvelope(
  privateKey: string,
  input: Omit<FederationEnvelope, "signature">,
): FederationEnvelope {
  return {
    ...input,
    signature: sign(null, signingValue(input), privateKey).toString("base64"),
  };
}

export function verifyEnvelope(
  publicKey: string,
  envelope: FederationEnvelope,
) {
  const { signature, ...unsigned } = envelope;
  return verify(
    null,
    signingValue(unsigned),
    publicKey,
    Buffer.from(signature, "base64"),
  );
}

export class FederationService {
  constructor(
    private readonly repository: MarketplaceRepository,
    private readonly config: FederationConfig,
    private readonly transport: FederationTransport,
  ) {}

  async initialise() {
    await this.repository.configureNode(this.config.descriptor, true);
  }

  descriptor() {
    return this.config.descriptor;
  }

  async localListings() {
    return this.repository.listLocalPublishedListings(
      this.config.descriptor.databaseId,
    );
  }

  async syncPeer(descriptorUrl: string) {
    if (!this.config.allowedDescriptorUrls.has(descriptorUrl)) {
      throw new Error("Peer URL is not allowlisted");
    }
    const descriptor = nodeDescriptorSchema.parse(
      await this.transport.get(descriptorUrl),
    );
    await this.repository.configureNode(descriptor, true);
    const response = (await this.transport.get(descriptor.listings)) as {
      listings?: unknown[];
    };
    const listings = (response.listings ?? []).map((listing) =>
      serviceListingSchema.parse(listing),
    );
    await this.repository.upsertRemoteListings(descriptor.databaseId, listings);
    return { descriptor, listings };
  }

  async createBooking(input: { accountId: string; listingId: string }) {
    const booking = await this.repository.createBooking(input);
    if (booking.listing!.nodeId === this.config.descriptor.databaseId)
      return booking;

    const peer = await this.repository.getNodeByDatabaseId(
      booking.listing!.nodeId,
    );
    if (!peer.trusted || !peer.public_key)
      throw new Error("Listing node is not trusted");
    const proposal: FederatedBookingProposal = {
      sourceBookingId: booking.id,
      listingId: booking.listingId,
      agreedPriceMinor: booking.agreedPriceMinor,
      currency: booking.currency,
    };
    const envelope = signEnvelope(this.config.privateKey, {
      id: randomUUID(),
      type: "booking.proposed",
      sender: this.config.descriptor.id,
      sentAt: new Date().toISOString(),
      payload: proposal,
    });
    const receiptEnvelope = federationEnvelopeSchema.parse(
      await this.transport.post(peer.inbox_url, envelope),
    );
    if (!verifyEnvelope(peer.public_key, receiptEnvelope)) {
      throw new Error("Invalid federation receipt signature");
    }
    const receipt = federatedBookingReceiptSchema.parse(
      receiptEnvelope.payload,
    );
    if (receipt.sourceBookingId !== booking.id) {
      throw new Error("Federation receipt references a different booking");
    }
    return this.repository.transitionBooking(booking.id, "confirmed");
  }

  async receive(input: unknown) {
    const envelope = federationEnvelopeSchema.parse(input);
    if (envelope.type !== "booking.proposed") {
      throw new Error("Unsupported federation event type");
    }
    const peer = await this.repository.getTrustedNodeByUrl(envelope.sender);
    if (!verifyEnvelope(peer.public_key!, envelope)) {
      throw new Error("Invalid federation signature");
    }
    const proposal = federatedBookingProposalSchema.parse(envelope.payload);
    const receipt = await this.repository.recordFederatedProposal(
      envelope.id,
      envelope.sender,
      proposal,
      this.config.descriptor.databaseId,
    );
    return signEnvelope(this.config.privateKey, {
      id: randomUUID(),
      type: "booking.confirmed",
      sender: this.config.descriptor.id,
      sentAt: new Date().toISOString(),
      payload: receipt,
    });
  }
}

export type FederatedBooking = Booking;
