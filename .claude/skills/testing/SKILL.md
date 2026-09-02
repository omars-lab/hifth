---
name: testing
description: How Hifth is tested — the unit, end-to-end, and golden-image layers, how to run each, and the current policy that only NON-MOBILE tests are exercised until the mobile app is implemented. Use when writing or running tests, adding a regression, deciding which suite a change belongs in, or when a mobile (iPhone/Android/golden) test will not run in this environment.
---

# Testing Hifth

Three layers, each answering a question the layer below it cannot reach.

| layer | what it proves | where | runner |
| --- | --- | --- | --- |
| **unit / contract** | logic, wiring, message completeness, DOM order | `**/*.test.ts(x)`, co-located | Vitest (jsdom) |
| **end-to-end** | what a browser lays out — geometry, direction, real events | `apps/web/e2e/*.spec.ts` | Playwright |
| **golden image** | the pixels — a wash, a clone's coordinate space, a skin shift | `e2e/golden.spec.ts` → `e2e/__screenshots__/` | Playwright (chromium, mobile viewport) |

The split is deliberate: a claim goes in the **lowest** layer that can hold it. DOM
order is a unit test; DOM order becoming *sides* under an RTL flow is e2e; the colour
of the band is a golden. Don't assert in e2e what jsdom could have caught, and don't
screenshot what a geometry assertion states more precisely.

## The current policy: non-mobile only

**Until the mobile app is implemented, we run the non-mobile tests only.** That means:

- **Unit tests** (all of them — they are jsdom, viewport-independent).
- **The `desktop` Playwright project** — chromium at 1440×900, the two-leaf spread.

We do **not** currently gate on the **mobile** e2e projects — `iphone` (WebKit),
`android` (Chromium mobile), or `golden` (mobile-viewport screenshots). They are not
deleted and their specs are not wrong; they are waiting on two things this repo does
not yet have stood up: the mobile implementation they assert against, and a matching
browser toolchain in the working environment (WebKit in particular tends to lag the
Playwright CLI version — the "Playwright was just installed or updated" nag is that
mismatch, not a real gap).

**So when you add a regression for a change that is visible in both layouts, its
runnable home is a unit test or the `desktop` project.** The mobile e2e is still the
right place to *also* state the claim for the future — write it there too when it
belongs there (e.g. the English wordmark's natural home is `lang.spec.ts`) — but do
not treat a green mobile run as a precondition for landing, and do not treat a mobile
project that will not launch here as a failure of your change. Verify on desktop +
jsdom, say which you ran, and note the mobile assertion is deferred.

## Running them

Everything runs from the **repo root**, and the PATH gotcha from the `run-app` skill
applies — a non-login shell here has node 18, which has no `pnpm`:

```
export PATH="/Users/omareid/.nvm/versions/node/v20.20.2/bin:$PATH"
```

### Unit tests

```
pnpm -C apps/web exec vitest run                 # the whole web suite
pnpm -C apps/web exec vitest run src/App.test.tsx # one file
pnpm -r test                                     # every package (core, etl, web)
```

`@hifth/core` must be built before the packages that import it (`make core`, or
`make test` which does it for you) — the Loop 0 lesson.

### End-to-end — the non-mobile project

```
pnpm -C apps/web exec playwright test --project=desktop
pnpm -C apps/web exec playwright test desktop.spec.ts --project=desktop -g "holds the slider"
```

By default Playwright builds `dist/` and serves it on **:4173** (a clean production
build — this is what a real run asserts). For a fast inner loop against a `vite dev`
you already have open on **:5173**, point the run at it instead — this skips the build
and the `--strictPort` preview server entirely:

```
HIFTH_BASE_URL=http://localhost:5173 pnpm -C apps/web exec playwright test --project=desktop
```

Use `HIFTH_BASE_URL` for iterating; let the default preview build run before you
believe a pass. (`HIFTH_REUSE_SERVER=1` is a different, narrower escape hatch — it
lets the built-in server adopt whatever is on :4173; opt-in because it will happily
test the wrong build.)

### Reading a failure

```
make report    # opens the last run's traces, DOM snapshots, console, network,
               # and the three-way image diff for a golden failure
```

## What mobile testing will be, once it is stood up

Recorded here so the plan is not lost while the projects are dark:

- **`iphone`** — WebKit, iPhone viewport, `hasTouch`. The acceptance device (PLAN §8):
  the smoke tour and the phone-specific chrome (the colophon sheet, the collapsed
  language switch, the page-turn band on a single leaf) live here.
- **`android`** — Chromium, Pixel viewport. The second mobile engine.
- **`golden`** — chromium at the phone viewport with `deviceScaleFactor: 2`,
  `isMobile`, photographing one SVG per shot. Platform-split baselines under
  `__screenshots__/{platform}/` (`make golden` for darwin, `make golden-linux` for the
  CI-shaped linux set); `gate:golden-env` fails the build if the local Playwright and
  the CI image disagree.
- **Bringing them back**: install the matching browsers (`pnpm -C apps/web exec
  playwright install`), stand up the mobile layout the specs assert against, then run
  `make e2e` (iphone + android + golden) and reconcile. At that point the deferred
  assertions written into `lang.spec.ts` and the other phone specs start earning their
  keep, and this policy section gets rewritten to "all layers run".

## Adding a regression (the rule of thumb)

1. **Can jsdom see it?** (logic, wiring, a rendered string, DOM order) → unit test,
   co-located `*.test.tsx`. Runs now, runs everywhere.
2. **Does it need a real layout engine?** (geometry, computed direction, a native
   control's greed, real key/wheel events) → `desktop` project e2e. Runs now.
3. **Is it inherently a phone claim?** (single-leaf band, collapsed chrome, a mobile
   viewport's arithmetic) → write it in the phone spec for the future, and find a
   desktop-or-jsdom stand-in to guard it **now** if the change ships now.
4. **Is it a pixel?** (colour, wash, exact placement) → golden — deferred with the
   rest of mobile until the golden project runs here.
