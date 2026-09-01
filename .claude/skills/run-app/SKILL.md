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
node-20 install. Put it in front before running anything:

```
export PATH="/Users/omareid/.nvm/versions/node/v20.20.2/bin:$PATH"
```

(`.nvmrc` pins 22, but the reliable, present-on-disk toolchain is node 20 above.
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
