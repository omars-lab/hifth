---
date: 2026-11-17
repo: hifth
session: 857e6644 (reviewer walk of the store build)
branch: store-feedback
folded: no
---

## Snags
- `scripts/gate-use-cases.mjs` reads test titles straight from the file text, so a test made
  in a loop with a built title (`${title} (${lang})`) is "not a test" to it. A use case's test
  must keep a written-out title; share the body through a function instead.
- `scripts/gate-issues.mjs` refuses `"launch": false`: a row is either `true` or has no tag.
  The backlog skill does not say so.
- `git commit -o <file>` means "commit only this file", not "write output here". Redirect the
  hook's output with `> log 2>&1` instead; the pre-commit output is too long to read inline.

## Worth copying
- Checking only one language hid a real fault: the top-bar fit test ran in Arabic only and
  never saw the English bar spill at 320 px. A layout test should run in each language the app
  ships.
- Fixing the reported fault (a stray "Left off" ribbon) by writing its test first exposed a
  worse one behind it (a saved place lost on launch). Test-first paid off twice in one fix.

## Didn't work
- Trimming the English top bar on the live page (smaller tag, shorter line) fit Chrome with no
  room and still spilled in Safari. Logged as needing a narrow-phone layout instead.
