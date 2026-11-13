---
name: deploy-site
description: Release or publish Hifth's public site — hifth.app (front page plus the web app at /read/) or the older GitHub Pages and Cloudflare copies — and check that only the bare minimum went up, with no development features, pitch build, design pages or debug files. Use for "deploy", "release the site", "publish hifth.app", "push the landing page", "is hifth.app live", "what is on the live site", or when a release check refuses something.
---

# Releasing Hifth's site

## The short version

```
make hifth-app-check      build, put the release folder together, refuse anything extra
make hifth-app-publish    the check, then upload with the saved keys, then look at the live site
make hifth-app-verify     look at the live site again, any time
```

Run them with Node 22 on the path (`export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`).
Release after the merge, from a worktree switched to origin/main with nothing uncommitted. The
main checkout usually holds other sessions' work, so the check would refuse it. The check refuses
anything but a clean tree whose commit is on origin/main.

```mermaid
flowchart LR
  A[clean tree,<br/>commit on main] --> B[make site<br/>build + its gates]
  B --> C[put the folder together<br/>front page + app under read/]
  C --> D{only the bare minimum?}
  D -- no --> X[refused, with each file and why]
  D -- yes --> E[upload with the<br/>new account's keys]
  E --> F[look at the live site<br/>pages, commit, dev addresses]
```

## Where Hifth is published, and when to use each

| Where | How it gets there | When |
|---|---|---|
| **hifth.app** (front page, app at /read/) | `make hifth-app-publish` from this laptop | After a merge that changes the front page or the app. This is the address readers are given. |
| blog.bytesofpurpose.com/hifth/ (app and design pages) | GitHub Pages, on every merge to main, by itself | Nothing to do. The design pages live only here. |
| The old Cloudflare copy (`make deploy-cloudflare`) | wrangler's own login, which is a **different account** | Only on a day GitHub is down. Never for hifth.app. |

## What the check refuses

The release reads the exact folder it will upload. A file is refused unless it is on the list
of what the site needs. A text file is refused if it carries a sign of a development feature.
The lists live in `scripts/shipped.mjs`. A new kind of file has to be added there on purpose.

- **Files that never go up:**
  - a pitch build (`read/pitch/`), which holds The Study Quran's text;
  - debug copies of the source (`.map`);
  - the design pages (`read/docs/`);
  - hidden files;
  - the server's own code (`functions/`, `lib/`).
- **Signs of development in a shipped file:**
  - the development server's live reload;
  - the page-comment button;
  - the "what each commit was for" picture;
  - the outside library's page data;
  - Cloudflare's test key for the spam check;
  - a `localhost` or `127.0.0.1` address;
  - the privacy page's "[contact address to come]" placeholder.
- **Missing pieces:** the front page, the privacy page, the "no page here" page, the app's page,
  and its service worker. Without the "no page here" page, Cloudflare answers every unknown
  address with the front page, so a mistyped link looks like it worked.
- **The wrong commit:** the app must carry the commit being released, because its source-code
  offer names that commit (the app's licence is the GPL).
- **The tree:** uncommitted changes, or a commit not on origin/main.

When the check refuses, fix the cause. Don't widen a list to make the refusal go away, unless the
file really belongs on the site. If it does, say so in the commit.

After the upload, `verify` fetches the live front page, the privacy page and the app, and checks
that the app carries this commit (in its main script or a script that one loads). Then it asks
for every development address (`live.mjs`, `DEV_PATHS`). Each must answer with an error, or with
the same page as an address that cannot exist, never with content.

**Try it before publishing** on Cloudflare's own local server, which behaves like the real host:

```
make hifth-app-check ARGS=--no-build
(cd apps/landing && wrangler pages dev dist --port 8788)
make hifth-app-verify ARGS="--url http://localhost:8788 --commit <the commit the build carries>"
```

**The email form** has a server part. Its code is `apps/landing/lib/notify.mjs`, with Cloudflare's
two entry files in `apps/landing/functions/api/`. Its database is described in
`apps/landing/wrangler.toml`, with the table in `schema.sql`. The upload runs from
`apps/landing/`, so wrangler finds all of these. None of them is copied into the release folder.

- **Once, on the new account** (through dotenvx, like the upload):
  1. `wrangler d1 create hifth-notify`, then put the id it prints in `wrangler.toml`. Until
     then the check refuses the stand-in id.
  2. `wrangler d1 execute hifth-notify --remote --file schema.sql`.
  3. Put the spam check's secret in as a Pages secret, `TURNSTILE_SECRET`.
- **To try the form locally:** `make hifth-app-serve`, then open http://127.0.0.1:7124/ (press C to
  leave a comment on the page). It makes
  the local table and starts the server with Cloudflare's published test secret, which always
  passes. Once any setting is given with `--binding`, the database has to be named with `--d1`
  too; the script does both.

The site has no `_redirects` file on purpose: Cloudflare ignored the app's catch-all rule under
`/read/` as an endless loop, and the app needs none, since it keeps its place after the `#`.
Cloudflare also serves `privacy.html` at `/privacy`, so `_headers` names that address.

## Rules

- **Keys:** never print a key or the account ID. `make hifth-app-publish` loads them through
  dotenvx. The script refuses to upload unless the new account's token and ID are both loaded,
  because otherwise wrangler would fall back to its own login, which is the other account.
- **First time on a laptop:** `lpass login` (the owner), then
  `make env-keys-pull && make env-bootstrap`. Prove the keys with `make cf-tokens`.
- **The Cloudflare Pages project** is `hifth-app` unless `HIFTH_APP_PAGES_PROJECT` says otherwise.

## Scripts — when to use each

| Script | What it does | When to reach for it | Command |
|---|---|---|---|
| `scripts/release-hifth-app.mjs check` | Builds (make site), puts the release folder together in `apps/landing/dist/`, and refuses it if it holds anything extra or the commit is not releasable | Before every release; to see what would go up | `make hifth-app-check` (`ARGS=--no-build` checks the last build) |
| `scripts/release-hifth-app.mjs prepare` | Builds and checks the release folder like `check`, without asking for a merged commit (what would stop a release is listed, not refused), and makes the local sign-up table. After the check, it adds the **Designs** button (bottom left of the front pages, never in the app) and every design page and written note under `/docs/design/` | First half of looking at hifth.app on this laptop | `make hifth-app-serve` runs it (`ARGS=--no-build` reuses the last build) |
| `scripts/release-hifth-app.mjs serve --port N` | Serves the prepared folder with Cloudflare's local server and the spam check's always-pass test keys | Second half; `make hifth-app-serve` has the comment server start it behind itself, so http://127.0.0.1:7124 has the Comment button | `make hifth-app-serve` |
| `scripts/release-hifth-app.mjs publish` | The check, then `wrangler pages deploy` with the saved keys, then verify | To release hifth.app | `make hifth-app-publish` |
| `scripts/release-hifth-app.mjs verify` | Looks at the live site as a reader's browser does | After a release; when someone asks if hifth.app is live | `make hifth-app-verify` (`ARGS="--url https://x.pages.dev"` for a preview) |
| `apps/web/e2e/landing-shots.spec.ts` (a Playwright file, not a script here) | Builds the plain public app and photographs it for the front page: the laptop, phone and iPad-with-pen views and one picture per feature, into `apps/landing/shots/` as JPEGs. Each picture checks the screen shows what it is meant to before it is taken. Never from the pitch build | After a change to how the app looks that the front page's pictures show; before a release that changes the front page | `make landing-shots` |
| `scripts/list-count.mjs` | Asks Cloudflare how many people are on the Mac-app list, and prints that number only; an answer holding anything else is refused | When someone asks how many signed up; after a sign-up test on the live site | `make hifth-app-list-count` |
| `scripts/shipped.mjs` | The lists of what may and may not go up, and the folder check | Changing what the site may hold | imported; tests: `node --test .claude/skills/deploy-site/scripts/shipped.test.mjs` |
| `scripts/dev-designs.mjs` | The **Designs** button for the local site: lists every options page and written note, newest commit first, and draws each note (its pictures, diagrams and highlighted boxes) as a page. The release check refuses the button and `docs/` if either ever reaches a folder going up | Changing the button or how notes are drawn; a new design page needs nothing, the list is read from the folders | imported by `prepare`; tests: `node --test .claude/skills/deploy-site/scripts/dev-designs.test.mjs` |
| `scripts/live.mjs` | The look at the live site | Changing what verify asks for | imported; tests: `node --test .claude/skills/deploy-site/scripts/live.test.mjs` |

All the tests run with `pnpm test:scripts`.
