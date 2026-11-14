---
date: 2026-11-14
repo: hifth
session: feature-check-on-ipad
branch: after-startup-step
folded: no
---

## Snags
- `.claude/skills/walk-app/scripts/feature-check.mjs`: the first real-iPad run waited out all 26 cards, because the iPad held an old test build with no capture folder. It now stops at the first card and says what to install. Check which build is on the device before a long run.
- `.claude/skills/walk-app/scripts/feature-check.mjs`: the two-page card failed on an upright iPad, where the app shows one page by design. A check that compares against a layout rule has to read the screen size the capture records, not assume a wide screen.
- `intent` commit labels: a commit made before `intent start` on a branch is refused at push. Run `intent start <task>` before the first commit on the branch, not after.

## Worth copying
- Whether a link restarts the open app was answered in one minute: the app's process number from `devicectl device info processes` before and after the link, then a capture link to read where it landed.
