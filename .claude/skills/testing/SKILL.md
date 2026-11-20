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

A quick look at one local page in Firefox, with no test file: `pnpm -C apps/web exec playwright
screenshot --browser=firefox <address> <out.png>` (Playwright lives in `apps/web`, not the root).
For a phone-width look in the `chrome-devtools` tools, use `emulate` with a viewport of
`390x844x3,mobile,touch`; `resize_page` stops at about 500 px wide.

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
`make test` which does it for you) — the Loop 0 lesson. The web app's type check reads the
core package's built output too, so after a change to core it fails with errors that point at
the web app's files until `pnpm -C packages/core -s build` runs.

**A test that was green the moment you wrote it** has not shown it can fail. Break the feature on
purpose in two places, watch the test go red each time, then put the code back.
Before you trust a first-try pass, check which build `dist` holds: Playwright serves whatever was
built last, and a test passed on a build made without the feature it was meant to catch
(2026-11-19). And some faults only show on the real phone: on iPhone Safari a grown part kept its
words at their old size while the test browsers grew them (2026-11-20). When a size or text
change passes at once, look at it on the simulator before calling it checked.

**A new file that reads the record of what was opened** is refused at commit time by the privacy
check, minutes into the commit. Run `pnpm -s gate:revision-privacy` (a second) right after adding
one, and add the file to the check's list if it truly needs the record.

**Write a script's Arabic-letter test as `/\p{Script=Arabic}/u`**, not a range of typed Arabic
characters. A typed range picked up an invisible character that the commit's lint refused, and
the Edit tool turns `\u` escapes back into raw characters (2026-11-11).

### Tests that run git

A test that runs git makes a throwaway repo and strips every `GIT_*` variable first:
`fixtureEnv()` in `scripts/gate-fixture.mjs`. During a commit, the hook's own git variables
would otherwise point the test's `git init` and `git add` at the real repo. Point the global
settings at nothing as well, so the laptop's own git setup cannot leak in.

Don't run one repo's git-heavy tests while another repo's push checks are running. Both slow
down, and a timing failure then can't be read. Run them one after the other.

**After moving test files,** run the moved tests and search for the old path in every quoting
style (quotes, backticks, bare). A search for quoted paths once missed one in backticks, and a
test that reads every script in its folder started reading the moved tests too.

### End-to-end, in a browser

```
pnpm -C apps/web exec playwright test --project=desktop
pnpm -C apps/web exec playwright test desktop.spec.ts --project=desktop -g "holds the slider"
```

**Name the setups a spec runs on.** Some specs run on the phone setups only (a hold marks
words only on a touch screen, so `word.spec.ts` skips the computer ones); "passes everywhere"
then means "passes on iphone and android", and the report says so.

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

**A new test file: say where it runs.** The laptop (`desktop`) and Firefox
(`desktop-firefox`) runs each pick their files from a list in `apps/web/playwright.config.ts`;
the two phone runs take everything not named as left out. `apps/web/e2e/runs.json` records
which runs pick up each file, and the commit check (`pnpm gate:e2e-runs`) refuses a new file,
or one that joined or left a run, printing where it runs and where it does not. Add the file
to the lists it belongs on, then `pnpm gate:e2e-runs --write` and commit the record with it.

**Before picking `--project`, look the file up in `apps/web/e2e/runs.json`.** Some files run
only on the laptop and Firefox (the phone runs leave `lazy-tools.spec.ts` out, for one), so
`--project=iphone` on them finds no tests and says so, which is easy to read as a pass.

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

**Tapping a verse:** `tapAyah` in `apps/web/e2e/ayah.ts` taps with a finger, at a point it has
checked a finger can reach. A run with no touch (the desktop ones) needs a mouse click at
`ayahTarget`'s point instead. No helper picks between the two yet, so each new test chooses by
the project it runs in.

**To make "a slow connection might do this" into a failing test,** hold back one file: open a
context with the offline cache switched off (`serviceWorkers: "block"`), then delay that file's
route. With the cache on, the route is never asked.

The other projects: `pitch` and `pitch-firefox` (the private pitch build, its own port),
`pitch-script` (the six demo passages), `iphone`, `ipad`, and the golden pictures.

### Reading a failure

```
make report    # opens the last run's traces, DOM snapshots, console, network,
               # and the three-way image diff for a golden failure
```

**The push names every test that passed only on its second try.** The browser tests retry a
failed test once, so such a test lets the push through. Right after the browser tests (and after
the pitch suite), `scripts/second-tries.mjs` reads Playwright's results file and prints each one:
the run, the file and line, the test's name, what went wrong the first time, and how many of the
last twenty runs it needed a second try in. Each run is kept in a history inside git's own folder,
shared by every working copy and never committed. It only reports; the push still passes or fails
on the tests themselves. A name in that list is a fault to fix with the three steps below, and if
you cannot fix it this session, give it a backlog row. To see which tests do it most often:

```
make second-tries     # the tests that needed a second try, most often first, over the last 20 runs
node scripts/second-tries.mjs --results <results.json> --history <file>   # one run, by hand
```

**A test that fails now and then and passes on the retry: find out whether the test or the
app is wrong before touching either.** Three steps, each a few minutes:

1. Run only that test many times with no retries:
   `pnpm exec playwright test e2e/<file> --project=desktop-firefox -g "<name>" --repeat-each 25 --retries 0`
   (from `apps/web`). Now it fails on demand.
2. Make the test keep looking (`expect(async () => { … }).toPass({ timeout: 10_000 })`). If it
   now always passes, the test was looking too soon. If it still fails, the app is wrong and
   stays wrong, which a reader would see.
3. For an app fault, have the code write down what it saw each time it ran (a list on
   `window`, printed in the test's failure message), read one failing run, then take the
   record out. The browser tests serve the built app, so run `make -s build` after each
   change to the app's code, or the record never shows up.

The page-edge strip was found this way on 2026-11-11
(`docs/issues/edge-strip-measured-before-the-leaf-knew-its-side.md`).

Four more habits for these:

- **Repeat the fix 25 times too, before committing it.** The first fix for a test that needed
  two free ports failed five runs in eight.
- **When a failing run's picture shows the cause, force that state** rather than chasing the
  timing. The chips beside the look-alike rows failed once because the verse's drawer measured
  itself while still short; slowing the processor never made it happen, but holding the drawer
  short with a style and then letting it grow made it fail every time (2026-11-12).
- **A value read once right after a load or a setting change goes in `expect.poll`**, and a
  first page load gets 20 seconds. Four tests passed only on retry on a busy laptop, each of
  them reading such a value once.
- **Watch for the change that matters, not a count.** A watcher told to stop "once both pages
  are found" stopped before they had settled; watching for the page changing side caught it.

**A unit test that waits for something from the rarely used tools fails when the laptop is
busy.** The share sheet's links, the report button and the other tools in
`components/rarely-used.ts` load the first time they open. The first load compiles that whole
file, 1.5 to 3 seconds on a quiet laptop, which can run past the 5-second wait during the commit
check. Load it once before the tests, with its own allowance, so the wait covers only the
drawing:

```ts
beforeAll(async () => {
  await import("./rarely-used");
}, 60_000);
```

`PageStopped.test.tsx`, `HighlightMenu.test.tsx` and `ShareSheet.native.test.tsx` do this
(2026-11-16 and 2026-11-19). A browser test that opens a page and waits the default 5 seconds
for the verse's tools hit the same thing on a busy push: wait 20 seconds, as
`slider-arrows.spec.ts` does.

## After merging main, and pushing in the background

(Folded from the Nov 13 front-page merge note, and the Nov 20 loop passes.)

- **Run the whole browser suite once on a merge before pushing.** Two tests from one side can meet
  the other side's change for the first time. Print the measured box before reading code.
- **Run `pnpm gate:budget` after a merge that brings in a lot of main.** Each side can be under
  the 1.0 KB margin while the two together are not; expect to run `make budget-update`.
- **A background push reports the last command's exit.** `git push …; echo exit=$?` said yes
  while the push hook had refused it. Read the log's last lines, or end the command with the push.
- **A background command needs the same PATH as a foreground one** (Node 22 and `~/.local/bin`),
  or the push hook stops at once on the Node check.
- **Don't build in a working copy while its push is testing there.** The build replaces the app
  the push's browser tests are serving.
- **On a small phone, a layout test runs in English as well as Arabic.** The test browsers start in
  Arabic, and the English row is the wider one.
- **On an iPhone, Safari's own bars take room the test browsers don't.** On the iPhone SE the page
  gets about 500 px of height, not 667, and Safari shows the install banner the test browsers
  never do. A test about room on a small phone uses 375 by 500, and the banner (an iPhone user
  agent, with storage that says it is not kept) where it matters: see `e2e/text-grow.spec.ts`.

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

A test that measures something first asserts the setup took: the thing was found, and the
condition really holds (a drawer test checks the drawer did grow). A "not found" answer of -1
is less than any limit, and passed a test on 2026-11-20 before the fix existed.

To learn whether a resize or a turn rebuilds a part of the page, tag its DOM node before
(`el.dataset.probe = "1"`) and look for the tag after: one probe settles what reading the
layout code cannot. After a fix, ask what it might have opened (the advisor is good at this):
on 2026-11-13 that found Escape clearing only the words the page made itself, not the ones the
app handed down.

Keep a feature's rules (which tab is in front, what a button does in each state) as small pure
functions beside the component, as `drawer-tools.ts` does: they take a unit test with no browser,
and the browser test is left with only the wiring.
