---
date: 2026-11-13
repo: hifth
session: word links, feature-check words, words kept across a relayout
branch: flake-fixes
folded: 2026-11-20
---

## Snags
- Chrome DevTools against a rebuilt `vite preview`: the app's offline copy kept serving the old
  bundle, so a fixed build looked "still broken". Unregister service workers and delete caches
  before any by-eye check of a rebuild (the e2e runs block service workers; a by-hand look does not).
  - Landed: already in run-app, "The preview keeps the old build after a rebuild".
- `apps/web/e2e/word.spec.ts` runs only on the phone setups, since a hold marks words only on a
  touch screen. A claim of "passes on every browser setup" has to name which setups a spec runs on.
  - Landed: testing, "End-to-end, in a browser".

## Worth copying
- To learn whether a component is rebuilt by a resize, tag its DOM node before the resize and
  check after: `sameStage: false` settled in one probe what reading the layout code could not.
  - Landed: testing, "Adding a regression".
- Asking the advisor what a fix might have opened found the Escape gap: words handed down from
  the app were drawn, but Escape only knew about words the page had made itself.
  - Landed: testing, "Adding a regression".
