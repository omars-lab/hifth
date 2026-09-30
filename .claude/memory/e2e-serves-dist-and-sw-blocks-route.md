---
name: e2e-serves-dist-and-sw-blocks-route
description: "Playwright e2e in hifth runs against the BUILT dist (vite preview), and page.route cannot slow a fetch the service worker answers; own a context with serviceWorkers \"block\" to simulate a slow shard"
metadata:
  node_type: memory
  type: project
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-09-30T13:19:45.057Z
---

Two traps hit on 2026-09-30 while writing the word-run race test (`apps/web/e2e/word.spec.ts`):

- The e2e web server is `vite preview` over `apps/web/dist`, so a source edit is invisible to
  the tests until `pnpm run build` (or `pnpm exec vite build`) in the worktree. A test that
  "still fails after the fix" usually means the bundle was not rebuilt.
- `page.route("**/assets/words/**", …)` did nothing on the phone projects: the service worker
  answers that fetch itself (runtime cache), and Playwright's route hook never sees it. To
  slow or fail a shard, open your own context with `browser.newContext({ serviceWorkers: "block" })`
  (the pattern `e2e/inventory.ts` and `page-turn.spec.ts` already use) and route on that page.

**Why:** both wasted a rebuild-and-rerun cycle each; the second looked like the app ignoring the delay.

**How to apply:** rebuild before any e2e run after a source change; block the worker in any
test that manipulates network timing. Related: [[juz-jump-leaf-alignment]] (rebuild note),
[[golden-rebaseline-recipe]].
