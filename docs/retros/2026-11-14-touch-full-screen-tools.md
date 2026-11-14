---
date: 2026-11-14
repo: hifth
session: full screen keeps the tools on a phone
branch: next-item-3
folded: no
---

## Snags
- `apps/web/e2e/*.spec.ts`: `getByRole("radio", { name: "Mistake" })` also matches longer names
  that contain the word; pass `exact: true` for a tool's radio.
- Playwright's `iphone` project is 390×664 (Safari with its bars), not 844 tall, and Safari's
  "Install Hifth" notice takes ~160 px at the top there until hidden. A size worked from the
  screen's height (`dvh`) ignores it; size from the page area itself (`cqh` on a size container).
- On a phone the page is sized by the screen's width, so a strip kept at the foot does not by
  itself keep the page above it; `--stage-page-cap` has to hold the page to the height left too.
- `vite preview` serves the build at `/`, not `/hifth/`; a blank page at `/hifth/` is the wrong
  address, not a broken build.
- There is no `timeout` command on this Mac; bound a Playwright run with `--global-timeout`.
  `gate:budget` stops a push at more than 1 KB of growth: run `make budget-update` before the push,
  not after it fails.
- A height limit meant for an upright phone shrank the page by a third on its side; check a
  layout change with the phone on its side before calling it done.
- The page's offline cache kept serving the old style sheet after a rebuild, so a fixed band
  still showed in the browser. Unregister the offline worker and clear its caches before judging
  a picture of a style change.
- `make app-probe ... PROBE_SHOT=x.png` writes the picture into the worktree root, where it could
  be staged; move it to the scratchpad straight away (it shows the page).

## Worth copying
- Writing the "off the page" and "highlighter keeps the tray" tests before the fix found two
  faults the by-eye check at 844 tall had passed.
