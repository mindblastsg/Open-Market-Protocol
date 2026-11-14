# ADR 0001: Initial reference implementation stack

- **Status:** Proposed
- **Date:** 2026-11-14

## Context

The project needs a thin vertical foundation that can grow into two independently operated marketplace nodes. The reference implementation must be approachable to contributors, testable without hosted services, and explicit about the boundary between protocol contracts and application code.

## Decision

Use an npm workspace with:

- TypeScript for the reference implementation;
- React and Vite for the browser application;
- Fastify for the node API;
- Zod for executable draft protocol schemas;
- PostgreSQL 17 as the planned durable local store;
- Vitest for initial unit and injection tests;
- Docker Compose for development infrastructure;
- GitHub Actions on Node.js 22 for verification.

Keep protocol schemas in a separate `@omp/protocol` package. Application packages may depend on protocol contracts; protocol contracts must not depend on application or persistence details.

## Consequences

- Contributors need Node.js 22 and npm; Docker is required only for PostgreSQL.
- The scaffold can be built and tested before database integration exists.
- npm workspaces keep the initial toolchain small.
- TypeScript is a reference implementation choice, not a requirement for conforming implementations.
- Fedify remains an evaluation item and is not added until a federation spike validates its fit.
- The licence is intentionally unresolved and must be decided before inviting substantive code contributions.

## Validation

Accept this decision only after continuous integration verifies type checking, tests, and production builds from a clean checkout. Revisit it if the first federation or persistence spike exposes a material mismatch.

