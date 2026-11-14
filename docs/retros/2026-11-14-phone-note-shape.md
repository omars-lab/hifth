---
date: 2026-11-14
repo: hifth
session: phone note shape
branch: note-shape-phone, PR #622
folded: no
---

## Snags
- `.claude/skills/walk-app/` pitch walk: its check on a phone on its side only asked about the
  note, so the bars at the foot of the screen covering the end of the verse passed unseen. Only
  the walk's pictures showed it. A check should ask about every line of the verse, not one card.
- The Edit tool turns `\uXXXX` escapes in what it writes into the real characters, so a regex
  range written that way put invisible characters in the source and lint refused it. Build such
  ranges from numbers (`String.fromCharCode`).
- `pnpm gate:issues`: a design page's item heading must end on one of the backlog's own status
  words (open, confirmed, suspected, blocked, answered, fixed), and must agree with its row's
  status. "built" or "done" fail.
- `apps/web/e2e/pitch.spec.ts`: the sideways-phone tests assumed the note lies across the foot,
  so changing the default shape failed six of them on the push. They now set that shape on
  purpose, and a separate group states the same promises for the new default.

## Worth copying
- Keep the old tests pinned to the setting they were written for, and write the same promises
  again for the new default. The new group found a real fault (the chips hidden behind the
  standing note) that the old tests could not reach.
