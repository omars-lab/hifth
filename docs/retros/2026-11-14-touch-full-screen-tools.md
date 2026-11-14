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
  "Install Hifth" notice takes ~160 px at the top there until hidden. A layout check at the foot
  of the screen has to set `hifth.notice.install-ios` first, or it measures the notice.
- On a phone the page is sized by the screen's width, so a strip kept at the foot does not by
  itself keep the page above it; `--stage-page-cap` has to hold the page to the height left too.
- `vite preview` serves the build at `/`, not `/hifth/`; a blank page at `/hifth/` is the wrong
  address, not a broken build.
- There is no `timeout` command on this Mac; bound a Playwright run with `--global-timeout`.
  `gate:budget` stops a push at more than 1 KB of growth: run `make budget-update` before the push,
  not after it fails.

## Worth copying
- Writing the "off the page" and "highlighter keeps the tray" tests before the fix found two
  faults the by-eye check at 844 tall had passed.
