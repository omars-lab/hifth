---
date: 2026-11-16
repo: hifth
session: launch-readiness, layout plan and influence research
branch: influences-catalog
folded: yes
---

## Snags
- `make commit-labels` (the push check): both research agents' pushes were refused because their commits named no task, and the fix it prints (`intent answer`, then commit the links file) makes a new commit that is refused the same way. The printed advice should say to run `intent start <task>` before that commit. Worked around by giving the research a backlog row and labelling on one merged branch; written into `.claude/skills/find-influences/SKILL.md` step 4.
- `intent answer` writes into whatever folder it is run from, with no warning when that is not the branch being fixed. One agent wrote a line into the main checkout and had to take it out.
- A new worktree cannot redraw the backlog pages (`make issues-doc`) until `packages/core` is built; the error is a missing-module stack trace that does not say so. The `issues` skill should name the build step.
- `gate:issues` needs a source note to have the heading "Open questions, and what would answer each" and a `### ①` item; found only by failing twice. The `issues` skill could show the smallest note that passes.
- `apps/web/src/messages/plain-words.test.ts`: the web app reads `@hifth/core` from its built copy, so a wording fix in core looked unfixed until core was rebuilt. The `testing` skill should say so beside the e2e "rebuild dist" line.

## Worth copying
- Two researchers apart, then a checker: the checker found six real disagreements and settled each from the code, and flagged 38 findings that only one researcher had. Telling researchers to commit and not push, with the checker's branch carrying the labels, avoids the push snag above.
- A dash check written as a test first (`plain-words.test.ts`, `scripts/landing-page.test.mjs`) found a tenth dash that counting by eye had missed.

## Didn't work
- Asking each researcher to open its own pull request. Neither could, and the research only makes sense merged, so one pull request from the checker's branch is the right shape.
