---
name: standing-merge-approval
description: "Standing yes (2026-09-27) to merge my own green PRs and keep going in hifth, bikar and qiyas (not the 3d-print repos); don't stop to ask \"shall I merge?\""
metadata:
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-27T13:51:58.258Z
---

In hifth, bikar and qiyas (and their worktrees; NOT the 3d-print repos — owner corrected this 2026-09-27), when a PR I opened is
green, merge it (`gh pr merge N --merge`), branch the next piece of work off fresh main in the same
worktree, and continue in feature-ROI order. Do not end a turn on "Shall I merge #N?".

**Why:** Omar said "merge and continue" after every PR for many rounds, then (2026-09-27) asked for a
hook that pushes a session to merge and continue instead of stopping to ask. The hook is now in each
repo's own `.claude/settings.json` as a Stop hook (hifth #116, qiyas #33, bikar #265); it logs to
`~/.claude/metrics/merge-nudges.log`.

**Check CI before merging, every time.** Main in hifth was merged red for ~10 PRs (#106–#115: an
iPhone-only hop test and the 150 KB size check) because "green" was assumed, not looked at; fixed in #117.

**What "green" means in hifth (2026-09-29):** the repo runs no checks on pull requests on purpose
(see [[checks-local-not-ci]]); `gh pr checks` says "no checks reported" and that is normal. The
check is the local pre-push hook (every gate, vitest, all six Playwright projects, the public
build), which must have passed on the push. After the merge, watch the "Deploy" run on main —
that is the only remote check, and it must succeed for the merge commit.

**How to apply:** still stop, and say why in plain words, when tests fail, a golden re-baseline
would be needed, or the PR needs the owner's call (a one-way door, held text, spend). Those are
real judgment calls; a green PR is not. Commit/branch rules in [[delegate-independent-work-to-commit-on-branch]] still hold.
