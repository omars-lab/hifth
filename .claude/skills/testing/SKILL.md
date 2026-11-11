---
name: testing
description: How Hifth is tested — the unit, end-to-end, and golden-image layers, how to run each, and which browser runs a push checks (desktop Chrome and Firefox, Android, iPhone on WebKit, iPad, the golden pictures, the pitch). Use when writing or running tests, adding a regression, deciding which suite a change belongs in, or when a phone, Firefox or golden test will not run or finds no tests.
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

These three layers **assert**. When you need to *look* — see a change rather than
pin it — that is the `run-app` skill's `make drive`, not a layer here: it drives a
real headless Chromium against a running server and writes a PNG, holds no baselines,
and asserts nothing (its one optional `--expect` only stops a silently-wrong flow
from handing back a misleading picture). Look first, then, once you know what to
hold still, add the claim in the lowest layer above that can hold it.

## What runs, and when

**Every layer runs on this laptop before a push** (`make pre-push-checks`): the unit tests, then
these browser runs, then the pitch suite when the private notes are on the machine.

| run | what it is | which files |
|---|---|---|
| `desktop` | Chrome at 1440×900, the two-leaf spread | a fixed list in `playwright.config.ts` |
| `desktop-firefox`, `desktop-firefox-runs` | Firefox, the owner's browser | a fixed list (see below) |
| `iphone` | WebKit, the engine Safari and the iPad app use, at iPhone size | every spec not on its ignore list |
| `android` | Chrome at Pixel size | the same |
| `ipad` | the iPad's size, with touch | `ipad.spec.ts` only |
| `golden`, `ipad-golden` | pictures of the page compared with saved ones | the golden specs |

This section used to say only the desktop run counted and the phone runs were switched off.
That stopped being true when WebKit was installed here and the phone runs joined the push
checks. A phone run that fails is a real failure.

**So a regression for something a reader sees goes in the spec for that feature**, and you run it
in the browsers that matter before the push, not only in Chrome:

```
pnpm -C apps/web exec playwright test pencil --project desktop --project desktop-firefox --project iphone
```

Say which runs you ran. If WebKit will not start, install it once:
`pnpm -C apps/web exec playwright install webkit`.

## Running them

Everything runs from the **repo root**, and the PATH gotcha from the `run-app` skill
applies — a non-login shell here has node 18, which has no `pnpm`. Use the version
`.nvmrc` names (22 today):

```
export PATH="/Users/omareid/.nvm/versions/node/v22.22.3/bin:$PATH"
```

### Unit tests

```
pnpm -C apps/web exec vitest run                 # the whole web suite
pnpm -C apps/web exec vitest run src/App.test.tsx # one file
pnpm -r test                                     # every package (core, etl, web)
```

`@hifth/core` must be built before the packages that import it (`make core`, or
`make test` which does it for you) — the Loop 0 lesson.

### End-to-end, in a browser

```
pnpm -C apps/web exec playwright test --project=desktop
pnpm -C apps/web exec playwright test desktop.spec.ts --project=desktop -g "holds the slider"
```

**Playwright does not build the app.** It serves whatever is already in `apps/web/dist`,
so build first or the run tests the old app:

```
pnpm -C apps/web exec vite build --logLevel error
```

The main checkout serves on **:4173**; every other working copy gets its own port
(`scripts/lib/e2e-port.mjs`), so two copies' runs cannot collide. For a fast inner loop
against a `vite dev` you already have open on **:7122**, point the run at it instead:

```
HIFTH_BASE_URL=http://localhost:7122 pnpm -C apps/web exec playwright test --project=desktop
```

`HIFTH_REUSE_SERVER=1` lets a run use a preview server left running on the copy's port.
It serves `dist` as it is on disk, so a rebuild is picked up; it is opt-in because it
will happily test a build you forgot to redo.

A push looks at the copy's two ports before anything else (`make e2e-port-free`). If a
preview server from an earlier look is still on one, the push stops in a second and prints
the port, the program holding it and the `kill` line that stops it. Run the same target by
hand before a long browser run.

### Firefox runs a fixed list of test files

The owner reads in Firefox, but the `desktop-firefox` project runs **only the files named
in its `testMatch` in `apps/web/playwright.config.ts`**. A new spec file that is not on
that list is never run in Firefox, and `--project desktop-firefox` on it reports "no
tests found" or passes on nothing. When a feature is something a reader sees or touches,
add its spec to the list in the same change.

```
pnpm -C apps/web exec playwright test pencil --project desktop --project desktop-firefox
```

Firefox on a pretend iPad (`hasTouch`) sends a mouse click with **no pointer event**, so
code that listens for `pointerdown` never hears `page.mouse.click`. Use
`page.touchscreen.tap` for a touch (found 2026-11-11, the pencil's rings).

The other projects: `pitch` and `pitch-firefox` (the private pitch build, its own port),
`pitch-script` (the six demo passages), `iphone`, `ipad`, and the golden pictures.

### Reading a failure

```
make report    # opens the last run's traces, DOM snapshots, console, network,
               # and the three-way image diff for a golden failure
```

## The golden pictures

`golden` photographs one page per shot at phone size, and `ipad-golden` at iPad size. Only the
set made on this Mac is committed (`__screenshots__/darwin/`); the push checks compare against
it. `make golden` runs them, and `make golden-update` rewrites the saved pictures: show the
owner the difference and ask before doing that.

## Adding a regression (the rule of thumb)

1. **Can jsdom see it?** (logic, wiring, a rendered string, DOM order) → unit test,
   co-located `*.test.tsx`. Runs now, runs everywhere.
2. **Does it need a real layout engine?** (geometry, computed direction, a native
   control's greed, real key/wheel events) → a browser test in the feature's spec.
3. **Is it inherently a phone claim?** (single-leaf band, collapsed chrome, a mobile
   viewport's arithmetic) → the phone spec; the `iphone` and `android` runs check it on
   every push.
4. **Is it a pixel?** (colour, wash, exact placement) → a golden picture.
