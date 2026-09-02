---
name: designs-public-on-site
description: "Tenet since 2026-09-01 — every design page under docs/ is public on the app's own site at the same path; never publish decision pages to claude.ai as their address"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-02T02:13:50.680Z
---

The owner wants every design and decision page public-facing, for transparency, and made it a
tenet of the repo (CLAUDE.md "Every design is public"). The web build stages `docs/**/*.html`
onto the site at the same path, so `docs/design/x.html` is
`https://blog.bytesofpurpose.com/hifth/docs/design/x.html`, with a front door at `/docs/` linked
from the colophon. A decision's `artifact` is derived from its `page` and the gate refuses any
other address.

**Why:** "i want all the designs to be public facing for transparency" / "this should be a tenant
for our repo". Earlier, nine pages went to claude.ai and the tree named five; a link on another
host dies with the host.

**How to apply:** publishing a design = merging it. Do not publish pages to claude.ai as the
decision's address; a conversational copy is allowed but goes in `docs/artifacts.json` as a copy.
Pages reference vendored art as `../../apps/web/public/assets/…` and the staging step rewrites
it; any other dangling relative link fails the build. See [[hifth-app-identity]] and
[[artifacts-english-by-default]].
