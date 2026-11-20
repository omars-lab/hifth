---
date: 2026-11-11
repo: hifth
session: session_01DFwERZHKo9hNwauqKoaMV1
branch: build-and-test, PR #594
folded: 2026-11-19
---

## Snags
- `apps/web/e2e/edge-peel.spec.ts`: the strip test that failed on its own in Firefox was put
  down to a busy machine for days. It was the app: the strip measured before the left page knew
  its side. A test that passes on the retry hides a fault a reader can see.
  - Landed: already in testing ("A test that fails now and then", the edge-strip paragraph).
- `apps/web/playwright.config.ts`: the laptop and Firefox runs read hand-kept lists of files,
  so a new test file was skipped there twice in a week. `pnpm gate:e2e-runs` now refuses that.
  - Landed: held by the commit check `pnpm gate:e2e-runs`; already in testing.
- `Makefile` `pre-push-checks`: a preview server left on the browser tests' port made a push
  fail minutes in, looking like a broken test. `make e2e-port-free` now stops it in a second.
  - Landed: already in testing; held by a test: `scripts/e2e-port-free.test.mjs`.
- `docs/performance.md` item ⑳ (branch `startup-slowed`): a slow-down was blamed on start-up
  work because the note said the app grew 10 KB. It had grown 22. Check the size figure from
  the built files before reasoning from it.
  - Landed: optimizing-performance, "Things that are already known" (check a size figure against the built files).
- `docs/issues.json`: rewriting it with a script to change two rows reformatted five other
  lines. It is hand-edited; change it with a plain edit.
  - Landed: issues, "Open" (plain edit, never a script).
- Commit labels typed by hand (branch `stale-skills`): an `Intent-None:` line written one
  paragraph above the credit lines was invisible to git's label reader, so six commits looked
  unlabelled. Use `intent start --none "<reason>"` and let the hook write the line; the tool
  (intent-manager 1.2.1) now also reads a label wherever it sits.
  - Landed: already in the repo's `CLAUDE.md` ("intent start" once per branch, and the hook writes the lines); the label reader belongs to another repo (the plugin marketplace, intent-manager).
- `intent why` on a merge commit (intent-manager 1.2.0, before release): it explained the next
  ordinary commit instead. Found in review, not by the tests; a merge is the newest commit on
  main most days, so try a new reading command on `HEAD` of main first.
  - Landed: belongs to another repo (the plugin marketplace, intent-manager). Marked only.
- `scripts/perf-sweep.mjs`: the middle of five readings hid that one build reads two values
  400 ms apart. `make perf-compare` keeps every run; read them all.
  - Landed: already in optimizing-performance (the `make perf-compare` row in its tools table).
- Moving test files into a skill's folder (branch `stale-skills`): a search-and-replace for
  quoted paths missed one written between backticks, and `walk-digits.test.mjs`, which reads
  every script in its folder, began reading the tests too. After a move, run the moved tests
  and search for the old path in every quoting style.
  - Landed: testing, "Tests that run git" (after moving test files, run them and search the old path in every quoting style).
- `scripts/e2e-port-free.test.mjs`: it asked for one free port and assumed the one 1000 above
  was free. Another program held it and an unrelated commit was refused. A test that needs two
  ports opens both, and picks the numbers itself: the first fix let the system pick, which gives
  ports so high that the second does not exist, and it failed five runs in eight. Repeat a fix
  for a now-and-then failure 25 times before committing it.
  - Landed: testing, "A test that fails now and then" (repeat a fix 25 times); the two-port case is held by a test: `scripts/e2e-port-free.test.mjs`.
- `.intent/config.json`: a list only shows up in the picture `make intent` draws once the
  settings name it. Goals and decisions are not named yet (the page says so under its key), and
  the 13 by-hand checks take their status from `docs/validation/ledger.json`, which the tool
  does not read, so two finished ones are drawn as open.
  - Landed: belongs to another repo (the plugin marketplace, intent-manager, which does not read the by-hand checks list), and the settings file here is the owner's to extend. Marked only.
- intent-manager's `agents/link-backfiller.md`: told "none is for work no task describes", the
  readers marked 33 of 105 old commits as belonging to nothing, and about a dozen were real
  changes to the app. Giving the order to try (a task, then a use case or feature, then nothing)
  brought it to 18, all chores.
  - Landed: belongs to another repo (the plugin marketplace, intent-manager). Marked only.
- intent-manager's `intent backfill merge`: a reader who agreed with a link a rule had already
  made had the answer dropped as a repeat, so four commits were handed out on every run. Only
  the run on real history showed it; the made-up test repo had no rule and reader agreeing.
  - Landed: belongs to another repo (the plugin marketplace, intent-manager). Marked only.
- intent-manager's `intent changelog` (1.5.0, before release): the first draft on this repo
  listed one task under three headings, because where a change is filed was worked out per
  commit. A task is now filed once, by its own row first. The made-up test repo had one commit
  per task, so only the real run showed it.
  - Landed: belongs to another repo (the plugin marketplace, intent-manager). Marked only.
- `docs/issues.json`: 117 of the 127 open rows name no `useCase` and no `feature`, so
  `intent roadmap` can only heap them. New rows should name one when they are written.
  - Landed: issues, "Open" (new rows name a use case or a feature). Filling in the old rows means editing `docs/issues.json`, which this pass could not touch.

## Worth copying
- intent-manager's `intent draw`, before release: the page was looked at in its rare states
  (nothing linked, no main branch, a label naming a task that is gone) in two throwaway repos.
  That found three wording faults the real repo could not show.
  - Landed: belongs to another repo (the plugin marketplace, intent-manager). Marked only.
- `.claude/skills/testing/SKILL.md` "A test that fails now and then": repeat it 25 times with
  no retries, make it keep looking, and if it still fails have the code write down what it saw.
  Three short steps found a cause that reading the code had not.
  - Landed: already in testing ("A test that fails now and then", the three steps).
- Holding back one file's delivery in a browser test (a context with the offline cache switched
  off, then a delayed route) turned "a slow connection might do this" into a failing test.
  - Landed: testing, "hold back one file" (offline cache blocked, then a delayed route).
- intent-manager's `skills/backfill-links/SKILL.md` step 5: before keeping the readers' links,
  list every "belongs to nothing" answer beside its commit's subject and files. One screen of
  reading showed the whole pattern of wrong answers, which a random sample of six only hinted at.
  - Landed: belongs to another repo (the plugin marketplace, intent-manager). Marked only.

## Didn't work
- Stopping a watcher "once both pages are found": found is not the same as settled. Watch for
  the change that matters (a page changing side) instead of a count.
  - Landed: testing, "A test that fails now and then" (watch for the change that matters, not a count).
