---
name: golden-rebaseline-recipe
description: "Goldens: owner wants to see the diff before a re-baseline, and the linux set can be refreshed locally because the pinned Playwright image is already on this machine"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-02T04:27:50.860Z
---

When the golden screenshots drift, the owner wants the diff shown and a yes/no put to them
before any baseline is rewritten; on 2026-09-01 they looked at the one-pixel post-hop framing
shift and chose "accept and re-baseline". Both platforms then go in one commit that says why:
`make golden-update` for darwin, `make golden-linux UPDATE=1` for linux. The pinned Playwright
image (v1.61.1-noble) is already pulled on this laptop, so the linux refresh is not a download
and needs no go-ahead.

**Why:** twelve shots changing under a commit that never mentions them is the event the
goldens exist to make deliberate; a silent re-baseline defeats them.

**How to apply:** reproduce with `make golden`, describe the diff in one sentence (what moved,
what did not), ask, then rewrite both sets and close the follow-up against
`apps/web/e2e/golden.spec.ts`. See [[juz-jump-leaf-alignment]] and [[playwright-webkit-missing]].
