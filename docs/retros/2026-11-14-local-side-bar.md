---
date: 2026-11-14
repo: hifth
session: bbb12999
branch: release-ignores-comments (the local-only side bar for hifth.app)
folded: no
---

## Snags
- `.claude/skills/deploy-site/scripts/release-hifth-app.mjs`: deleting the old release folder failed with "directory not empty" because Finder kept writing `.DS_Store` into it. Retrying never wins; moving the folder aside first and deleting the moved copy does. Written up in `docs/issues/old-folder-written-to-while-deleted.md`.
- `.claude/skills/deploy-site/scripts/dev-sidebar.mjs`: the side bar listed 9 panels where the features page showed 11, because it matched the card's class exactly and the two pitch-only cards carry a second class. Count what the page shows against what the list shows before calling a list done.
- The side bar's phone Menu button sat bottom-left, under the comment bar, which wraps to two rows on a phone. Only the screenshot at 390 px showed it; moved to the top-left with a test.

## Worth copying
- Checking a page with Chrome DevTools at 1280 and 390 px, then one throwaway Playwright Firefox screenshot (script put in `apps/web/e2e/tools/`, deleted after), covered both browsers the owner uses in a few minutes.
