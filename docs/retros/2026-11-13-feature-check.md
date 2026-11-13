---
date: 2026-11-13
repo: hifth
session: f20a6685
branch: feature-check
folded: no
---

## Snags
- `.claude/skills/walk-app/scripts/feature-check.mjs`: the capture's `where.json` is written three
  times (empty, then after the page answers, then with the video), so waiting for the file to
  appear read the first, empty write. Wait until the page has answered or the video is set.
- The capture could name a dialog by its label only, which is in the reader's language and
  changes with the words. Panels a link opens now carry their link name (`data-panel`), and
  the capture lists it; a new panel needs the same attribute or the check fails it.
- The private notes live only in the main checkout, so a worktree cannot build the pitch app
  until they are copied into its own git-ignored folder.
- `make app-run-ipad` does not rebuild the web pages; it copies in whatever `make app-web` built
  last. A full run failed all nine panels for that reason alone. The check now names an app
  built from another commit; run `make app-web app-run-ipad FLAVOUR=…` together.
- Once the private notes were copied in, the push ran the pitch tests here for the first time,
  and one found a real fault for every reader on a computer: zoomed in, the page-edge grab
  strips reached up over the toolbar and took the press meant for Zoom out. Fixed in
  `EdgeGrabRails.tsx`, with a public test in `e2e/edge-peel.spec.ts`. When checking a fix by
  eye, clear the app's offline copy first, or the page runs the old script.

## Worth copying
- Sending each card's link and then a capture link named after the card, one card at a time
  with the app closed in between, turned "does every link work in the app" into one command
  with a line per card.
