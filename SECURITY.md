# Security policy

Open Market Protocol is pre-alpha software and must not be used for real payments, personal data, production bookings, or financial entitlements.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Use GitHub's private vulnerability reporting feature for this repository when available. If private reporting is unavailable, contact the repository owner privately through the contact method shown on their GitHub profile and include only enough information to establish a secure follow-up channel.

Include:

- the affected component and revision;
- reproduction steps or a minimal proof of concept;
- the likely security and privacy impact;
- any suggested mitigation;
- whether the issue has been disclosed elsewhere.

Do not access data or systems you do not own, degrade availability, use social engineering, or retain personal data while researching a report.

## Supported versions

There are no supported production releases. Security fixes will be applied to the active development branch and described in release notes once releases exist.

## Current security boundaries

The repository currently contains a development scaffold. It does not yet implement authentication, federation signatures, key management, payment processing, or production deployment. Those absences are limitations, not safe defaults.

Before a public alpha, the project intends to publish a threat model covering node identity, signature verification, replay and downgrade protection, SSRF-safe discovery, schema validation, payload limits, key rotation, peer abuse, audit data, and privacy-preserving reporting.
