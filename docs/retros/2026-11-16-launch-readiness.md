---
date: 2026-11-16
repo: hifth
session: launch-readiness (App Store launch items 7, 10, 12 to 15, 18)
branch: launch-readiness
folded: yes
---

## Snags
- `apps/web/playwright.config.ts`: a spec only runs where a project's `testMatch` names it, so passing a file path, or a project that does not list it, prints "No tests found" and looks like a pass. Name a fragment (`lazy-tools`) and check the count of tests run.
- `scripts/gate-budget.mjs`: moving code out of start-up never lowers the total, so a fix for the start-up limit always trips the 1 KB drift check next. Plan the `make budget-update` and its trims.md note into the same commit.
- `.claude/skills/optimizing-performance/trims.md`: the gate's listing shows no style sheets, but the start-up sum counts the main one (about 18 KB). Check which sheet a moved part's styles landed in before counting the saving.

## Worth copying
- For a start-up trim, pick a part that draws nothing until opened (the go-to box). A part that draws its own button, like the share sheet, would pop in late and is the wrong one to move.
- A claim in a code comment ("the card still offers to reload if the file cannot load") got its own browser test that blocks the file. A claim with no test is a guess.
