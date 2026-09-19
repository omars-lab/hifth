---
name: run-app
description: Launch the actual Hifth app and open it in a browser — the real navigation instrument, not a picture of it. Use when asked to run, start, open, or screenshot "the app", "Hifth", or "the desktop/mobile UI", or to confirm a change works in the running app. The project's answer to the built-in `run` skill.
---

# Running Hifth

The app is a Vite dev server. It is **served**, not a file you open.

```
pnpm dev          # serves the web app
open http://localhost:5173/
```

Leave `pnpm dev` running in the background; it hot-reloads.

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
`localhost:5173`. `packages/etl/out/*.html` are generated sitting outputs, not the
app either.

If the ask is genuinely "open that design page", `open docs/design/<name>.html` —
but confirm which, because "desktop UI" reads both ways.

## Seeing a change — three ways a fix gets checked where it cannot fail

1. **A hash-only navigation is not a reload.** The app routes on `#/…`, so pointing
   the tab at a new `#` address keeps the old module graph running. After an edit,
   force a real reload (`location.reload()`, or another path and back) before
   reading the DOM. The served source can be new while the page is still old; two
   sessions have lost turns to this.
2. **Two servers, two truths.** `pnpm dev` (5173) wraps the tree in StrictMode and
   double-mounts everything; `vite preview` (4173) is the built app, which strips it.
   A fault seen on one and not the other is a dev-only artefact — say so, and do not
   ship a fix for the built app that only the dev server needed.
3. **e2e runs the build.** `pnpm --filter @hifth/web build` first, and free 4173
   (`lsof -ti:4173 | xargs kill`) or Playwright refuses to start its own.

## Screenshotting the app when there is no browser window — `make drive`

When the change needs to be **seen** and no browser is attached (the Chrome
extension is a coin-flip, and reasoning from CSS is how UI bugs get missed — look
at the render), drive a real headless Chromium against a server you already have
up and read the PNG it writes:

```
make drive HASH='#/hafs-kfqc/1:1'
make drive HASH='#/hafs-kfqc/1:1' ACT='clickrole=button|commentary; settle=400' \
  EXPECT='div[role="dialog"]' OUT=fatiha-commentary.png LOCALE=en-US
make drive BASE=http://localhost:5173 VIEWPORT=1440x900   # pitch server, desktop spread
```

- A **deep-link `HASH`** reaches most states with no clicks: `#/hafs-kfqc/2:48`
  selects that verse, `#/hafs-kfqc/p19` opens page 19 (see `e2e/deeplink.spec.ts`).
- `ACT` is a short step list joined by `;` — `wait=`, `waitrole=role|name`,
  `click=`, `clickrole=role|name`, `fill=css|text`, `press=Key`, `settle=ms`.
- `EXPECT` is a CSS selector that must be visible or the run exits non-zero — so a
  flow that silently landed on the wrong screen fails loudly instead of handing
  back a misleading picture.
- `BASE` defaults to the dev server (5173); point it at 4173 for the built app or
  at the pitch server. `OUT` is under `apps/web/` and the run prints the path.

This is the mechanism behind this skill's promise to "screenshot the app". It is
**not a test** — it asserts nothing on its own and holds no baselines. The `testing`
skill owns the suites that hold the UI still (e2e, golden); this is for *looking*
and for a quick end-to-end sanity check. The driver is `apps/web/e2e/tools/drive.mjs`;
`make drive` is the one stable call site over it.
