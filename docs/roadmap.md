# Roadmap to v0.1 alpha

This roadmap is a planning baseline, not a delivery promise. The repository is currently at the documentation stage. Status should change only when the relevant exit criteria can be demonstrated from a fresh checkout.

## v0.1 definition

The first alpha is not intended to replace a mature marketplace. It should prove one focused proposition:

> Independent nodes can exchange marketplace events, complete a simulated booking, and produce a transparent economic record without a central platform dependency.

The alpha must use fictional data and simulated money. It must not imply legal ownership, dividends, regulated payment processing, or production readiness.

## Phase 0 — foundation

**Goal:** create a maintainable and reviewable project base.

Planned work:

- define repository and package boundaries;
- record architecture decisions and protocol versioning policy;
- select and document an open-source licence;
- scaffold the TypeScript applications and shared packages;
- add PostgreSQL migrations and Docker Compose development services;
- add formatting, linting, type checking, tests, and continuous integration;
- publish security and contribution guidance.

**Exit criteria:** a fresh clone launches a minimal application, connects to its local database, and passes all documented checks without external credentials.

## Phase 1 — standalone marketplace node

**Goal:** demonstrate a coherent local marketplace before adding distribution.

Planned domain objects include `Node`, `Operator`, `Supplier`, `Listing`, `Booking`, `Agreement`, and `Event`.

Planned work:

- browse and inspect fictional service listings;
- create a simulated booking;
- implement a deterministic, auditable booking state machine;
- show booking history in a usable web interface;
- provide an operator view for listings and booking state.

**Exit criteria:** a visitor can select a fictional service, submit a simulated booking, receive a confirmation, and inspect the full state history.

## Phase 2 — federation

**Goal:** make two independently configured nodes interoperate.

Planned work:

- establish node identities and signing keys;
- define discovery and explicit trust configuration;
- publish and update federated listings;
- exchange booking proposals, acceptance, rejection, cancellation, and receipts;
- implement durable outboxes, retries, idempotency, and observable failure states;
- address signature verification, replay protection, SSRF, input validation, and key rotation;
- build protocol conformance tests.

**Exit criteria:** node B books a fictional service hosted by node A. Restarts and retried delivery do not duplicate the booking, and each node retains useful local operation during a remote outage.

## Phase 3 — distributed economics

**Goal:** make the accounting consequences of a simulated transaction explicit.

Planned work:

- double-entry records using integer minor currency units;
- versioned and configurable fee rules;
- deterministic allocation after costs, reserves, and other stated obligations;
- participant statements and aggregate reporting;
- immutable links between a calculation and the rule version used.

**Exit criteria:** every simulated transaction balances, allocations never exceed the available simulated amount, and a calculation can be reproduced from recorded inputs.

## Phase 4 — public alpha

**Goal:** let an unfamiliar reviewer evaluate the proposition.

Planned work:

- one documented command to start two isolated local nodes;
- separate databases, identities, and signing keys;
- seeded fictional suppliers and listings;
- a visual federation inspector;
- browser-accessible hosted demo using demo-only data;
- end-to-end tests and operational documentation.

**Exit criteria:** a reviewer can complete a simulated cross-node booking in the hosted demo and reproduce the flow locally from a fresh clone.

## Deferred beyond v0.1

The following are intentionally out of scope for the first alpha:

- real payment collection or payouts;
- production identity verification;
- real dividends, ownership rights, or financial entitlements;
- ride dispatch, GPS tracking, or sector-specific operations;
- cryptocurrency, blockchain settlement, or tokenisation;
- automated governance elections;
- production service-level guarantees.

Later milestones may explore portability, external marketplace adapters, independent implementations, formal governance, operational hardening, and a legally structured pilot.

## Status vocabulary

Use these labels consistently:

- **Planned:** agreed direction with no implementation evidence.
- **In progress:** active work exists on a review branch or pull request.
- **Implemented:** merged code exists.
- **Verified:** documented acceptance criteria pass from a fresh checkout.
- **Deployed:** a maintained URL or environment is publicly reachable.

A feature should never be described as working, live, or available based only on a design document.
