---
name: playwright-webkit-missing
description: "The e2e \"iphone\" project runs on WebKit, which is not installed on this laptop — every iphone test fails at browser launch, not in the app; run desktop/android/golden (Chromium) and ask before installing"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-02T00:04:00.172Z
---

On 2026-09-01 the full `npx playwright test` run failed every `[iphone]` test with
`browserType.launch: Executable doesn't exist at ~/Library/Caches/ms-playwright/webkit-2311/pw_run.sh`.
The `desktop`, `android` (Pixel 7) and `golden` projects are Chromium and run fine.

**Why:** WebKit was never installed via `npx playwright install webkit` on this machine. Installing it
is a download from Playwright's CDN, which needs the user's explicit go-ahead first.

**How to apply:** Verify a change with `--project desktop --project android --project golden`. Report
the iphone project as *not run*, never as failing. Offer the install as a one-line ask rather than
starting it. See [[spa-hash-nav-no-reload]] for the rest of the verification recipe.
