---
date: 2026-11-14
repo: hifth
session: move-12-kb-out-of-startup
branch: move-12-kb-out-of-startup
folded: no
---

## Snags
- `.claude/skills/optimizing-performance/trims.md`: a part that a build drops as unused still ships its styles. The commentary's CSS reached the public build that way. The skill now says so; a trim has to check the CSS file, not only the script.
- `apps/web/src/App.tsx`: the app had nothing to catch a part that fails to load later, so one missing file blanked the whole app. Every later-loaded part now sits in `Later`, which draws nothing in its place.
- `apps/web/e2e/pencil.spec.ts`: moving a part to load later can slow a different device than the one you were thinking of. The upright iPad draws no page-edge strips, so its Pencil ring waited for a download at the first squeeze. Check every kind of screen that draws a part before moving it out of start-up.
- `scripts/gate-e2e-runs.mjs`: a new test file fails the commit until `pnpm gate:e2e-runs --write` records its runs. Run it before the first commit, not after the hook refuses.

## Worth copying
- Finding the step with stand-in builds first (padding the start-up script by known amounts) put the edge between 157 and 162.6 KB before any real code moved. Then the trim only had to cross a known line.
- A "phone never asks for it" test needs a guard that the file exists at all, or it passes on a build where nothing was split.
