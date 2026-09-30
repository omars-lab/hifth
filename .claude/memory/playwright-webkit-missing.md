---
name: playwright-webkit-missing
description: "WebKit IS installed now (was missing until ~2026-09-29): the e2e iphone project runs locally and in pre-push, and catches WebKit-only test bugs Chromium hides"
metadata:
  type: project
---

Until about 2026-09-29 the `[iphone]` e2e project could not launch here (Playwright's WebKit was not
installed). It is installed now, and `make pre-push` runs the iphone project along with the Chromium ones.

**Why it matters:** on 2026-09-30 the iphone run caught two test bugs the Chromium projects passed:
WebKit refuses a screenshot cut-out that starts off screen (Chromium quietly trims it), and a phone
page is still sliding into place right after a verse is drawn.

**How to apply:** verify with the iphone project too; a failure there is real, not a missing
browser. When reading pixels, trim the cut-out to the screen and wait for the mark to stop moving
(apps/web/e2e/ink.ts `pixelsOf` does both). See [[spa-hash-nav-no-reload]] for the rest of the
verification recipe.
