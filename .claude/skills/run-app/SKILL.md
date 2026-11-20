---
name: run-app
description: Launch the actual Hifth app and open it in a browser — the real navigation instrument, not a picture of it. Use when asked to run, start, open, or screenshot "the app", "Hifth", "the site", hifth.app on this laptop, or "the desktop/mobile UI"; to choose between the ways to run it locally (dev, pitch, built preview, phone, hifth.app with comments, the pre-publish copy); when a local page has no comment bar; or to confirm a change works in the running app. For a GIF or video, use record-demo; to walk every device and build down a checklist, use walk-app. The project's answer to the built-in `run` skill.
---

# Running Hifth

The app is a Vite dev server. It is **served**, not a file you open.

```
pnpm dev          # serves the web app
open http://localhost:7122/
```

Leave `pnpm dev` running in the background; it hot-reloads.

## Which way to run it, and when?

Each way has its own fixed port, so two can run at once. A taken port fails loudly instead of
moving.

| Command | Address | What you get | Comment bar? | Use it when |
|---|---|---|---|---|
| `make dev` | 127.0.0.1:7122 | The app from source, reloading on each save. Runs everything twice on purpose (StrictMode), so some faults are development-only | Yes | Making and checking a change. The everyday one |
| `make pitch` | 127.0.0.1:7122 | The same, plus The Study Quran's notes (the private pitch build) | Yes | Working on the pitch. Never share it or take pictures of it for the repo |
| `make preview` | 127.0.0.1:7123 | The built public app, as readers get it. Saves itself for offline use (see 4 below) | No | Checking the built app, offline behaviour, or a fault the dev server does not show |
| `make phone` | your laptop's Wi-Fi address, port 7123 | The built app, reachable from a phone on the same Wi-Fi | No | Trying it on a real phone |
| `make hifth-app-serve` | 127.0.0.1:7124 | All of hifth.app: the front page, the app under `/read/`, the sign-up form with test keys, plus a side bar and the design pages that only the laptop copy has. `ARGS=--no-build` reuses the last build | Yes (press C) | Looking at or commenting on the site, or trying the form |
| `make hifth-app-check ARGS=--no-build`, then `(cd apps/landing && wrangler pages dev dist --port 8788)` | localhost:8788 | Exactly the folder that would be published, on Cloudflare's own local server. No side bar, no comments | No | Only right before publishing, to run `make hifth-app-verify ARGS="--url http://localhost:8788 --commit <commit>"` against it (the `deploy-site` skill) |
| `make comments` | 127.0.0.1:8767 | The comment server in front of the dev server on 7122 | Yes | When the dev server's own comment bar is not loading |
| (the browser tests) | 127.0.0.1:4173 | The tests' own copy of the built app | No | Never by hand. Free the port if a test run refuses to start (see 3 below) |

**The local servers serve the app from the root, not from the live site's path.** The site lives
under `/hifth/` on the web, but `http://127.0.0.1:7123/hifth/` on the laptop is a blank page. Open
the address the server prints.

**To comment on a page, use 7122 or 7124.** The bar is added only by the dev server or by the
comment server in front of something. A built copy served on its own (7123, 8788) never has it.
Comments are saved in `.page-comments/threads/` of the folder the server was started from, so
start it from the checkout whose comments you want answered.

## The PATH gotcha

A non-login shell here has **node 18** on `PATH`, which has no `pnpm` and is too old
for this repo (`engines` wants `>=20`). The `pnpm` that works ships with the nvm
node-22 install (`.nvmrc` pins 22). Put it in front before running anything:

```
export PATH="/Users/omareid/.nvm/versions/node/v22.22.3/bin:$PATH"
```

(`.nvmrc` pins 22, and v22.22.3 is the present-on-disk toolchain that matches it.
`nvm use` in an interactive shell works too.)

## The app is not the same as a picture of the app

Do not open a file from `docs/design/*.html` when someone asks for "the app" or
"the UI". Those pages are **decision mocks** — a drawing of one question, on a real
mus'haf page, so a reader can answer it. They are indexed in `docs/decisions.json`
(and, once published, `docs/artifacts.json`), not served by the app. The app is
`localhost:7122`. `packages/etl/out/*.html` are generated sitting outputs, not the
app either.

If the ask is genuinely "open that design page", `open docs/design/<name>.html` —
but confirm which, because "desktop UI" reads both ways.

## Seeing a change — six ways a fix gets checked where it cannot fail

1. **A hash-only navigation is not a reload.** The app routes on `#/…`, so pointing
   the tab at a new `#` address keeps the old module graph running. After an edit,
   force a real reload (`location.reload()`, or another path and back) before
   reading the DOM. The served source can be new while the page is still old; two
   sessions have lost turns to this.
2. **Two servers, two truths.** `pnpm dev` (7122) wraps the tree in StrictMode and
   double-mounts everything; `vite preview` (7123) is the built app, which strips it.
   A fault seen on one and not the other is a dev-only artefact — say so, and do not
   ship a fix for the built app that only the dev server needed.
3. **e2e runs the build.** `pnpm --filter @hifth/web build` first, and free 4173, the tests' own port in the main checkout,
   (`lsof -ti:4173 | xargs kill`) or Playwright refuses to start its own.
4. **The preview keeps the old build after a rebuild.** The built app saves itself in the
   browser so it works offline, and a tab that has opened it once goes on being served that
   saved copy. A change then looks as if it did not land. Clear it in the tab, then reload:
   `navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))).then(() => location.reload())`.
   If the old look is still there after that, the saved files outlived the worker; delete them
   too and reload: `caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).then(() => location.reload())`
   (2026-11-19: a style change for the link line only showed after both).
   To know which build the tab runs, compare the script name it loaded
   (`[...document.scripts].map((s) => s.src)`) with the one in `apps/web/dist/index.html`;
   if they differ, the tab is on the saved copy, whatever the page looks like.
   The dev server (7122) saves nothing, so it never does this.
5. **At phone width the dev server's comment bar covers the bottom of the app.** The bar for
   leaving comments on a page sits in the bottom corner of every dev-server page, and on a
   narrow window it lies over the slider or a bottom row of icons, so a press there lands on
   the bar. Its **Hide** button is not enough: the small Comments tab it leaves still lies
   over the last icon of the row and the end of the slider (measured at 390 wide, 2026-11-11),
   and Hide is forgotten on reload. Look at the preview, which never has the bar, or take the
   bar off the page for the look: `document.getElementById("__page-comments")?.remove()`.
   On a page of our own with that bar (the dev side bar, 2026-11-14), a button at the bottom
   corner sat under it too, and the bar wraps to two rows on a phone; only the picture at 390
   wide showed it.
6. **Both of the owner's browsers, in minutes.** Look with Chrome DevTools at 1280 and 390
   wide, then take one Firefox picture with a throwaway Playwright script in
   `apps/web/e2e/tools/`, deleted after.

## Screenshotting the app when there is no browser window — `make drive`

When the change needs to be **seen** and no browser is attached (the Chrome
extension is a coin-flip, and reasoning from CSS is how UI bugs get missed — look
at the render), drive a real headless Chromium against a server you already have
up and read the PNG it writes:

```
make drive HASH='#/hafs-kfqc/1:1'
make drive HASH='#/hafs-kfqc/1:1' ACT='clickrole=button|commentary; settle=400' \
  EXPECT='div[role="dialog"]' OUT=fatiha-commentary.png LOCALE=en-US
make drive BASE=http://localhost:7122 VIEWPORT=1440x900   # pitch server, desktop spread
```

- A **deep-link `HASH`** reaches most states with no clicks: `#/hafs-kfqc/2:48`
  selects that verse, `#/hafs-kfqc/p19` opens page 19 (see `e2e/deeplink.spec.ts`).
- `ACT` is a short step list joined by `;` — `wait=`, `waitrole=role|name`,
  `click=`, `clickrole=role|name`, `fill=css|text`, `press=Key`, `settle=ms`.
- `EXPECT` is a CSS selector that must be visible or the run exits non-zero — so a
  flow that silently landed on the wrong screen fails loudly instead of handing
  back a misleading picture.
- `BASE` defaults to the dev server (7122); point it at 7123 for the built app or
  at the pitch server. `OUT` is under `apps/web/` and the run prints the path.
- `MOUSE=1` drives a desktop with a real pointer (hover styles, the page-edge grab);
  `drag=x,y>x,y` in `ACT` presses, glides and lets go — a page turn by its edge.
  `swipe=x,y>x,y` is the same with a real finger (Chrome only): a phone or iPad swipe.

For a GIF or video of a run — something that moves — use the `record-demo` skill. To walk the
whole app in every device and build, down a checklist that grows with each fault, use `walk-app`.

This is the mechanism behind this skill's promise to "screenshot the app". It is
**not a test** — it asserts nothing on its own and holds no baselines. The `testing`
skill owns the suites that hold the UI still (e2e, golden); this is for *looking*
and for a quick end-to-end sanity check. The driver is `apps/web/e2e/tools/drive.mjs`;
`make drive` is the one stable call site over it.
