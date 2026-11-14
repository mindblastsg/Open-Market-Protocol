# GitHub Pages plan

## Recommendation

Keep the repository README as the primary landing page during Phase 0. It renders well on desktop and mobile, stays close to the work, and avoids presenting a documentation shell as if a product were already available.

Create a GitHub Pages site only when there is enough verified material to justify a separate destination.

## Proposed trigger

Implement Pages when at least one of these is true:

- the two-node demo has verified setup instructions;
- protocol schemas and generated API reference are published;
- screenshots can show real interfaces rather than concepts;
- a hosted alpha has a maintained status and safety notice.

## Minimal implementation

When the trigger is met:

1. use a lightweight static documentation generator with no server runtime;
2. source content from `docs/` and link back to the repository;
3. keep the same concise positioning and status notice as the README;
4. publish versioned protocol and API references;
5. add real screenshots with descriptive alt text;
6. include demo limitations, data policy, security reporting, and release status;
7. deploy through a reviewable GitHub Actions workflow after the repository licence and security policy exist.

## Suggested information architecture

- Overview
- Try the demo
- Run two nodes locally
- Protocol
- Architecture
- Economic model
- Roadmap
- Contributing
- Security and limitations

## Editorial and accessibility rules

- design mobile-first with a readable single-column measure;
- use system fonts, high contrast, and minimal JavaScript;
- avoid autoplay, decorative animation, and badge walls;
- preserve heading order and keyboard navigation;
- never replace status text with colour alone;
- keep diagrams understandable as nearby prose;
- show “planned”, “verified”, and “deployed” labels explicitly.

## Current decision

Pages is **planned, not enabled**. Enabling it now would add maintenance without adding verified functionality. The README and supporting Markdown documents are the intentionally lightweight public surface for the pre-alpha stage.
