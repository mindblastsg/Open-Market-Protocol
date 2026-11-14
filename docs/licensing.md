# Licensing decision

## Status

Open. The repository must not imply an open-source licence until the owner deliberately adopts one by adding a `LICENSE` file.

## Decision criteria

The project needs a licence that:

- permits independent marketplace implementations and commercial operation;
- preserves a clear patent grant for protocol implementers;
- is recognised by common package registries and open-source tooling;
- is compatible with the intended federation and web dependencies;
- makes contribution terms understandable without a bespoke contributor agreement.

## Leading option

Apache License 2.0 is the current recommendation because it is permissive and includes an explicit patent grant. This is a recommendation, not legal advice or an adopted licence.

## Alternatives to evaluate

- MIT for maximum simplicity, with a less explicit patent position;
- MPL 2.0 for file-level reciprocity;
- AGPL 3.0 for network-use reciprocity, with materially different adoption and compatibility trade-offs.

## Required owner action

The repository owner should choose the licensing intent after considering legal advice where appropriate. Implementation work should remain review-only until that decision is recorded.
