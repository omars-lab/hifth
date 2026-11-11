---
date: 2026-11-11
repo: hifth
session: session_01DFwERZHKo9hNwauqKoaMV1
branch: build-and-test, PR #594
folded: no
---

## Snags
- `apps/web/e2e/edge-peel.spec.ts`: the strip test that failed on its own in Firefox was put
  down to a busy machine for days. It was the app: the strip measured before the left page knew
  its side. A test that passes on the retry hides a fault a reader can see.
- `apps/web/playwright.config.ts`: the laptop and Firefox runs read hand-kept lists of files,
  so a new test file was skipped there twice in a week. `pnpm gate:e2e-runs` now refuses that.
- `Makefile` `pre-push-checks`: a preview server left on the browser tests' port made a push
  fail minutes in, looking like a broken test. `make e2e-port-free` now stops it in a second.
- `docs/performance.md` item ⑳ (branch `startup-slowed`): a slow-down was blamed on start-up
  work because the note said the app grew 10 KB. It had grown 22. Check the size figure from
  the built files before reasoning from it.
- `docs/issues.json`: rewriting it with a script to change two rows reformatted five other
  lines. It is hand-edited; change it with a plain edit.
- `scripts/perf-sweep.mjs`: the middle of five readings hid that one build reads two values
  400 ms apart. `make perf-compare` keeps every run; read them all.

## Worth copying
- `.claude/skills/testing/SKILL.md` "A test that fails now and then": repeat it 25 times with
  no retries, make it keep looking, and if it still fails have the code write down what it saw.
  Three short steps found a cause that reading the code had not.
- Holding back one file's delivery in a browser test (a context with the offline cache switched
  off, then a delayed route) turned "a slow connection might do this" into a failing test.

## Didn't work
- Stopping a watcher "once both pages are found": found is not the same as settled. Watch for
  the change that matters (a page changing side) instead of a count.
