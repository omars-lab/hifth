---
date: 2026-11-14
repo: hifth
session: the verse's tools as tabs in its drawer
branch: next-item-4
folded: 2026-11-20
---

## Snags
- The browser's offline copy of the app on a `vite preview` port used before kept serving an older
  build, so the new setting looked ignored. Unregister the offline worker and clear its caches
  before judging anything on a reused port (same snag as the full-screen note, a second time; it
  wants a line in the `run-app` skill).
  - Landed: already in run-app, "The preview keeps the old build after a rebuild".
- `apps/web/e2e/drawer-tools.spec.ts` was not in the Firefox run, though the owner uses Firefox;
  adding a spec name to `desktop-firefox` in `playwright.config.ts` is the whole cost when the
  spec has no Chrome-only step.
  - Landed: the spec is on the desktop-firefox list, and testing says "Firefox runs a fixed list of test files".

## Worth copying
- Keeping the tab rules (which tab is in front, what a tool's button does) as two small pure
  functions in `drawer-tools.ts` made them testable without a browser, and the app wiring short.
  - Landed: testing, "Adding a regression" (rules as small pure functions).
