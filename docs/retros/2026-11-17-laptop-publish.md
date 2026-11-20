---
date: 2026-11-17
repo: hifth
session: 857e6644 (publish from the laptop, repo private later)
branch: laptop-publish, PR #641
folded: yes
---

## Snags
- A hand-set PATH for `git commit` (to put Node 22 first) left out `~/.local/bin`, so the
  prepare-commit-msg hook printed "the intent tool is not installed" and the commits landed with
  no `Intent-` lines. It does not fail the commit. Three commits had to be remade with
  `git commit-tree` on the same trees before the push. The hook could fail instead of warn.
- `scripts/gate-issues.mjs` takes only "agent" or "user" as an owner and only defect, question
  or risk as a severity, and a row pointing at a design page needs that page to carry an
  `## Open questions, and what would answer each` section with `### ① Title · **open**` items.
  The `issues` skill says none of this, so the first commit was refused four ways at once.

## Worth copying
- Putting the public source copy behind a switch that is off (`SOURCE_COPY = ""`) let the whole
  feature merge and be tested before the public repo exists, with nothing a reader sees
  changing. The owner's yes to the repo is then a one-line change.
- Pinning a shared rule (the release tag's shape) as a written-out string in both places that
  use it, not only through a shared function, catches the day one side changes it.
