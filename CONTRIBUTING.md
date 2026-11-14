# Contributing

Open Market Protocol is at a pre-alpha, foundation stage. Contributions are welcome, especially where they turn assumptions into testable decisions.

## Before you start

1. Read the [README](README.md), [architecture](docs/architecture.md), and [roadmap](docs/roadmap.md).
2. Check existing issues and pull requests.
3. Open an issue before a large feature, protocol change, new dependency, or economic rule.
4. Keep proposals narrow enough to review and verify independently.

The foundation workspace is verified with Node.js 22. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`. Docker is optional until working on PostgreSQL integration. The marketplace and federation demos do not exist yet.

## Good early contributions

- clarify architecture boundaries or open questions;
- propose a small architecture decision record;
- define booking state transitions and failure cases;
- draft versioned event schemas and conformance fixtures;
- threat-model discovery, signing, replay, SSRF, or peer abuse;
- define ledger invariants and property-based test cases;
- improve accessibility, terminology, or contributor onboarding;
- translate roadmap outcomes into focused issues with acceptance criteria.

## Pull requests

A useful pull request should:

- explain the problem and why it belongs in the current phase;
- distinguish implemented behaviour from planned behaviour;
- identify security, privacy, compatibility, and economic effects;
- include or update tests when executable code exists;
- update relevant documentation;
- avoid unrelated formatting or dependency changes;
- remain small enough for a reviewer to understand.

Use draft pull requests for early design discussion. Link the relevant issue when one exists.

## Documentation language

Honest status is part of the project’s quality bar:

- use **planned** for unimplemented work;
- use **implemented** only for merged code;
- use **verified** only when documented checks pass;
- use **deployed** only for a reachable, maintained environment;
- label examples and economic figures as illustrative or simulated;
- never imply real payments, ownership, dividends, or legal rights in the alpha.

## Design expectations

Contributions should support:

- independent node operation;
- clear protocol and implementation boundaries;
- versioned, testable contracts;
- deterministic and auditable state changes;
- transparent economic rules;
- secure defaults;
- accessible interfaces and documentation;
- minimal central dependencies.

## Conduct and governance

A formal code of conduct, maintainer model, licence, security reporting path, and protocol governance process still need to be adopted. Until then, engage respectfully, critique ideas rather than people, and avoid sharing security vulnerabilities in public issues.

Please do not contribute substantial code under an assumed licence: licensing is a Phase 0 decision and must be made explicitly.
