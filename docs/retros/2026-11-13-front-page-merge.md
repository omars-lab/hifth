---
date: 2026-11-13
repo: hifth
session: bbb12999
branch: mistake-kinds (the hifth.app front page), PR #610, merged
folded: no
---

## Snags
- `make pre-push` (the push hook): a background `git push … ; echo exit=$?` reported success because the echo ran last, while the push had been refused by `gate:budget`. Read the log's last lines, not the background task's exit code, or end the command with the push itself.
- `make pre-push` browser tests after the merge: two tests from one side met the other side's change for the first time (the front page's device panels; the taller mistake question on an iPad). Both were test faults, found by printing the measured box rather than reading code. Run the whole browser suite once on a merge before pushing.
- `scripts/gate-budget.mjs` after a merge of main: each side was under the 1.0 KB quiet margin, but together they moved the size 1.5 KB, so the push failed even though neither branch had. A merge that brings in a lot of main should run `pnpm gate:budget` before pushing, and expect to run `make budget-update`.
- `.claude/skills/optimizing-performance/trims.md`: named the size map tool by a path that did not exist (`scripts/size-by-source.mjs`); it lives in the skill's own scripts folder. Fixed in the same commit as this note.
- `pnpm test:scripts` after merging: the app-links page test failed until `make app-links-doc` rebuilt the shared link code. The rebuilt page was unchanged, so a stale build of the shared package, not the page, caused it.

## Worth copying
- `docs/issues.json` conflicts (both sides only added rows at the end): rebuilding the file row by row from the common ancestor, ours and theirs (keep whichever side changed a row, and flag rows both changed) resolved three conflict blocks with no hand-picking and no rows lost. Then rebuild the generated pages from the merged file, never resolve them by hand.
