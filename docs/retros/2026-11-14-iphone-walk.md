---
date: 2026-11-14
repo: hifth
session: iphone-walk-pitch
branch: next-item-5, PR #621
folded: no
---

## Snags
- `.claude/skills/walk-app/scripts/pitch-walk-steps.mjs`: the checks were written for an iPad on its side (two pages, the commentary in sight at once), so the first iPhone walk failed 5 of 14 steps on things a phone does on purpose. Any new step should ask the window what it has room for (`h.spread()`) rather than assume an iPad.
- `native/Hifth/Resources/Info-iOS.plist`: the iPhone was allowed upright only, and no test or walk noticed for weeks, because every iPhone walk before this one ran upright. The walk's own check that the picture is wider than tall is what caught it.

## Worth copying
- Looking at the side-on pictures before calling the failures faults. Three of the five were the walk's checks, not the app, and the pictures settled it in a minute.
