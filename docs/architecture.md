# Architecture

## Status

This document describes the target architecture. A verified Phase 0 scaffold now implements the workspace, web shell, API health endpoint, draft protocol package, PostgreSQL development service, tests, and CI. Marketplace, persistence, federation, and accounting capabilities remain unimplemented.

## System intent

Open Market Protocol is intended to define a small set of interoperable marketplace contracts and a reference implementation. Each marketplace node is independently operated and controls its own database, membership, listings, policies, keys, and commercial records.

The protocol should enable cooperation without requiring every operator to share one application, database, or platform owner.

## Boundaries

### Marketplace node

A node is the principal operational and trust boundary. It is expected to contain:

- a web interface for customers, suppliers, and operators;
- a local API and domain model;
- a local PostgreSQL database;
- an authenticated federation inbox;
- a durable event outbox;
- signing keys and explicit trust configuration;
- a local ledger and economic reporting interface.

### Protocol contracts

The protocol surface should be smaller than the reference application. Candidate contracts include:

- node identity and discovery;
- listing publication and withdrawal;
- booking proposal and lifecycle events;
- delivery receipts and error responses;
- accounting evidence needed by both sides of a transaction;
- schema and protocol version negotiation.

Contracts should be versioned, documented, and testable without depending on internal tables or framework types.

### Economic engine

The planned economic engine has four separate concerns:

1. a double-entry transaction ledger;
2. versioned fee calculation;
3. deterministic simulated surplus allocation;
4. private statements and safe aggregate reporting.

Accounting calculation is not payment processing. Alpha outputs must be clearly labelled as simulations and must not create legal or financial entitlements.

## Reference implementation direction

- **TypeScript** for the reference implementation and shared schemas.
- **React + Vite** for the browser application.
- **Fastify** for local node APIs.
- **PostgreSQL** for durable local state and migrations.
- **Fedify** as a federation framework to evaluate, using applicable federation patterns rather than inventing identity and transport primitives without need.
- **Docker Compose** for the two-node local demonstration.
- **GitHub Actions** for repeatable quality checks.

The initial stack is recorded in [ADR 0001](adr/0001-reference-stack.md). Its suitability for marketplace persistence and federation still requires vertical prototypes.

## Core flows

### Local booking

1. A customer selects a listing.
2. The node validates the request and records a booking proposal.
3. A deterministic state transition is appended to the booking history.
4. The interface shows the current state and its evidence.

### Federated booking

1. Node B discovers a listing published by node A.
2. Node B creates a local proposal and enqueues a signed event.
3. Node A verifies identity, signature, freshness, schema, and policy.
4. Node A applies an idempotent state transition and sends a receipt or response.
5. Both nodes preserve their own records and expose disagreement or delivery failure rather than hiding it.

## Reliability requirements

- transactional outbox for messages coupled to local state changes;
- stable event IDs and idempotency keys;
- bounded retries with observable dead-letter states;
- deterministic state transitions;
- explicit timeout, cancellation, rejection, and expiry states;
- no assumption of immediate or exactly-once network delivery;
- local availability when a remote node is unavailable.

## Security work

Federation expands the attack surface and must be treated as security-critical. Design and tests should cover:

- authenticated node identity and signature verification;
- replay and downgrade protection;
- SSRF-safe discovery and URL handling;
- strict schema validation and payload limits;
- key storage, rotation, and revocation;
- authorisation at node and participant boundaries;
- abusive peers, rate limiting, and trust removal;
- audit records without leaking private participant data;
- safe defaults that reject example secrets in non-development modes.

A security policy and threat model are Phase 0 deliverables. This document is not a security review.

## Data ownership and privacy

Each node should remain the source of truth for its local members and commercial records. Federation should exchange only the data required for the agreed transaction. Public economic reporting should use aggregates designed to resist disclosure of private participant activity.

Retention, erasure, portability, dispute handling, and cross-jurisdiction operation remain open policy and legal questions.

## Open decisions

Before substantive implementation, the project should record architecture decisions for:

- licensing;
- monorepo and package boundaries;
- canonical schemas and compatibility rules;
- identity, discovery, and trust bootstrap;
- applicability of Fedify and specific federation extensions;
- booking state machine and conflict handling;
- ledger scope and accounting invariants;
- privacy model and aggregate reporting thresholds;
- local development and deployment topology;
- protocol governance and change control.

## Validation strategy

The architecture should be considered credible only when supported by:

- unit tests for state and accounting invariants;
- integration tests with real databases and queues;
- two-node failure and retry tests;
- protocol conformance fixtures;
- security-focused negative tests;
- a fresh-clone end-to-end demonstration;
- eventually, an independent implementation in another language.

See the [roadmap](roadmap.md) for phased exit criteria.
