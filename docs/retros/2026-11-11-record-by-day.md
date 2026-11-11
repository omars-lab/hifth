---
date: 2026-11-11
repo: hifth
session: f20a6685-f1f6-450b-9b0a-9cf2dce93d64
branch: pencil-rings (PR #590), pencil-settings-page (PR #591), calendar-by-day
folded: no
---

## Snags
- `.claude/skills/testing/SKILL.md`: nothing says the web app's type check reads the core package's built output. After a change to the core package the check fails with errors about the web app until `pnpm -C packages/core -s build` is run.
- `.claude/skills/walk-app/SKILL.md`: seeding a made-up record from a probe is not written down. Opening the record's database from a script with no set-up step leaves an empty database the app then cannot write to. `scripts/record-days-walk.js` now shows the safe way.
- `apps/web/e2e/` helpers: a test that taps a verse has to pick between a touch tap and a mouse click by hand, depending on the browser. One helper that picks would save the same four lines in each new test.
- `CLAUDE.md` ("the others stay as a setting in the info panel"): for a layout the reader switches between on every visit, a switch in the sheet itself fits better than a setting. The rule could say so.
- `scripts/gate-revision-privacy.mjs`: a new file that reads the record of what was opened is refused at commit time, minutes in. `pnpm -s gate:revision-privacy` takes a second; the testing skill could say to run it after adding any file that reads the record.

## Worth copying
- `.claude/skills/optimizing-performance/trims.md`: a function only a late-loading screen uses, added to a core file that start-up also reads, loads at start-up. Putting it in a file of its own moved it out (0.4 KB) with no other change.
- A test that was green the moment it was written: break the feature on purpose in two places, watch the test fail each time, then put the code back. It is the next best thing to having seen it fail first.
- Looking at the Arabic screen before calling a right-to-left layout done. The month's arrows were flipped twice (once by the browser, once by our own style), which no English test could show.

## Didn't work
- Opening the preview at the site's public path on the local server. The local preview serves from the root, so the page was blank; check the address the server prints.
