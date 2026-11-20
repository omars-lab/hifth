---
date: 2026-11-19
repo: hifth
session: hifth.app front page (design fixes, the list's daily tidy)
branch: notify-list-keep-awake, PR after #659
folded: no
---

## Snags
- `supabase/config.toml` has the database's web interface (`[api]`) off on purpose, since the same settings run the outside library's store. Any try that needs the list's web interface (`make hifth-app-serve`, `make hifth-app-tidy-try`) needs a scratch copy with it on; a plain `supabase start` here quietly gives a status with no API_URL. The deploy-site skill now says so, but a `make` target that builds the scratch copy would end the guessing.
- `intent start` in a worktree reads the main checkout unless given `-C <worktree>`; it said "no task named" for a row that existed.
- `hallmark` needs puppeteer-core installed, and writes its output into the folder it is run from.
- The local comment bar on `make hifth-app-serve` pages makes the page scroll sideways at 320 px, so a narrow-width check there blames the page for the bar's fault. Check narrow widths on the plain files (a static server on `apps/landing/`).
- `scripts/supabase-profile.test.mjs` refuses any `supabase …` command in a skill without `--profile`, even a local-only one; write the profile into examples from the start.

## Worth copying
- Proving the timer job with Cloudflare's local runner (`wrangler dev --test-scheduled`, then knocking `/__scheduled`) against a local database, with one old and one new made-up row, showed the real Worker and the real database function agree. The stand-in tests could not show that.

## Didn't work
- Pull requests here have no hosted checks by design, so `gh pr checks` saying "no checks reported" is normal; the commit and push hooks are the checks.
