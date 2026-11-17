---
date: 2026-11-16
repo: hifth
session: launch-readiness, new layout on the page bar
branch: new-layout-bottom-bar, PR #636
folded: no
---

## Snags
- `scripts/gate-e2e-runs.test.mjs`: a new browser test file fails the commit until `pnpm gate:e2e-runs --write` records it in `apps/web/e2e/runs.json`. The `testing` skill should say to run it in the same step as adding a spec file.
- `docs/issues.json`: the size limit already had a backlog row (`room-under-the-size-limit-again`) under a name I did not search for, so closing the item in `docs/performance.md` failed the backlog check at commit time. Search the backlog by the source item (`㉓`), not by a guessed name, before closing one.
- The PostToolUse hook `check-decision-anchors.py` (decision-tracking-manager plugin) points at a file that is gone, and errors after every Edit and Write. The edits still apply. The plugin's hook path needs fixing.

## Worth copying
- Measuring start-up again with every server stopped gave steady numbers (five runs within 17 ms) and a raise backed by evidence, where a trim was not available.
