---
name: checks-local-not-ci
description: GitHub Actions spend runs out hours into each cycle; move every check possible into local pre-commit/pre-push hooks, CI keeps only what can't run locally
metadata:
  type: feedback
---

Run checks through the local git hooks, not CI. Local hooks can be assumed to always run, because the owner is the only developer. CI keeps only what can't run on the laptop, such as the iPhone/WebKit tests and the deploy.

**Why:** Omar, 2026-09-27: the NaqshCoffee Actions spend limit is hit "hours into a new cycle" because of how we do PRs. He said "maximize checks we do via pre commit hooks" and "assume they will be run all the time, we are only dev".

**Measured 2026-09-27:** hifth is public on the personal account, so its Actions minutes are free. The limit that runs out is the NaqshCoffee org's: 3,000 minutes a month, $0 above that, spent almost entirely by qiyas (62-minute test step) and bikar (deploys). Plan: 3d-models .claude/plans/ci-spend.md.

**How to apply:** don't add CI jobs as a backup for local hooks. Push fewer times (batch commits), and don't merge main back into a branch just to refresh CI. The plan is in 3d-models .claude/plans/ci-spend.md (for a dedicated session). Related: [[standing-merge-approval]].
