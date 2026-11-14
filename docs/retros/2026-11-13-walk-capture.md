---
date: 2026-11-13
repo: hifth
session: walk capture (session_01DFwERZHKo9hNwauqKoaMV1)
branch: walk-capture-1
folded: no
---

## Snags
- `.claude/skills/walk-app/scripts/release-check.mjs`: two of its first signs were strings of 15 bytes or fewer. An optimized Swift build packs those into the machine code, so a byte search can never find them. The check passed on a build that did leak. A test now refuses short string signs. Any future "is X in the binary" check needs the same rule.
- `native/Hifth/Capture/WalkCapture.swift`: where.json waited for Apple's video export, so closing the app mid-export lost the page and verse too. Write what you already have first, then fill in the slow part.
- `chrome-devtools` resize_page can't go below about 500 px wide; use `emulate` with a viewport of `390x844x3,mobile,touch` for the phone-width check.
- Playwright lives in `apps/web`, not the repo root: `pnpm -C apps/web exec playwright screenshot --browser=firefox …` is the quick Firefox look at a local page.

## Worth copying
- Proving a release check both ways on real builds: a deliberately leaky Release (`SWIFT_ACTIVE_COMPILATION_CONDITIONS=DEBUG` plus the Files app define) must fail, and the clean one must pass. That is how the short-string hole showed up.
- Checking the gallery with made-up captures (an ffmpeg test pattern, one refused video, one unsettled) in the scratchpad, never real ones, keeps the book's text out of every check.
- Merge clashes in the generated backlog pages (`docs/backlog.md`, `issues.md`, `waiting-on-you.md`): merge by hand, keeping both sides' new items, save a copy, then redraw and compare. Only counts and fingerprints should move.
