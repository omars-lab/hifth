---
name: golden-rebaseline-recipe
description: "Goldens: owner wants to see the diff before a re-baseline, and only the darwin set exists since 2026-09-27"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-02T04:27:50.860Z
---

When the golden screenshots drift, the owner wants the diff shown and a yes/no put to them
before any baseline is rewritten; on 2026-09-01 they looked at the one-pixel post-hop framing
shift and chose "accept and re-baseline". The new baselines then go in one commit that says why:
`make golden-update`. Since 2026-09-27 only the darwin set exists (the linux set and its
Docker image were retired with the GitHub e2e job), so there is one set to refresh.

**Why:** twelve shots changing under a commit that never mentions them is the event the
goldens exist to make deliberate; a silent re-baseline defeats them.

**How to apply:** reproduce with `make golden`, describe the diff in one sentence (what moved,
what did not), ask, then rewrite the set and close the follow-up against
`apps/web/e2e/golden.spec.ts`. See [[juz-jump-leaf-alignment]] and [[playwright-webkit-missing]].
