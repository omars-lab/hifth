---
name: optimizing-performance
description: How to keep Hifth opening fast, and how to decide whether the app's code-size cap should move. Use when the size check fails or is close to failing, when the Lighthouse start-up check goes red, before adding a large library or feature, when asked "is it worth raising the limit?", when choosing what to trim, or when the performance reminder hook says the app is near its size cap. Draws the growth, breakdown and start-up-cost charts with make perf-report / make perf-sweep.
---

# Optimizing performance

**What we promise:** the app is usable within **2.5 seconds** on a mid-range Android phone on a
slow connection. Everything here serves that promise. How it is measured, with diagrams and links,
is in [measuring.md](measuring.md). Read that first if "Lighthouse", "time to interactive" or
"gzipped" are new words.

## The two checks, and which one matters

| check | what it measures | where | fails when |
| --- | --- | --- | --- |
| **start-up check** (Lighthouse) | the real promise: time until the app is usable, on a modelled slow phone | `make lighthouse`, **by hand** before a demo or a release (also inside `make loop-verify`); since 2026-09-27 nothing runs it automatically | the median of 5 runs is over 2500 ms |
| **size cap** | how much code the phone downloads, compressed | `pnpm gate:budget`: before every push (the pre-push hook) and every deploy (`make site`) | the total is over the cap, **or** it moved more than 1 KB since the last accepted size |

**The size cap stands in for the promise; it is not the promise.** It exists because it is instant,
exact and runs before every push, while Lighthouse takes minutes, models a phone, and only runs
when someone asks for it, which makes the cap the only automatic guard on start-up. So when the cap
and the start-up check disagree, **the start-up check wins**, and the cap is what moves.

## When the size cap trips (or is about to)

```
make perf-report      # growth over time + what is taking up the room   (seconds)
make perf-sweep       # start-up time as code is added                  (~1 min per amount)
make perf-report      # redraw with the sweep included
open docs/performance/bundle-report.html
```

Then read the three charts in order, and decide:

1. **How has it grown?** A steady climb means features are paying their way. A sudden jump means
   one change brought in a lot. Find that change before anything else (`git log -p --
   scripts/budget-baseline.json`).
2. **What is taking up the room?** Look for things that do not need to load before the first page:
   settings, option pages, rarely used tools, the crop tool, big tables. Those can load **when
   first opened** (a dynamic `import()`), so they stop counting against start-up time. A library
   that is large for what we use it for can be swapped out. **Trim first if there is an obvious
   candidate.**
3. **What does more code cost?** The sweep chart gives milliseconds per kilobyte, and how many
   kilobytes still fit inside 2.5 s. **Raise the cap only while the chart shows room**, and leave a
   margin. The padding the sweep adds only has to download, but real code also has to run, so a
   real feature costs more than the chart says.

### Deciding: trim or raise?

| choice | pros | cons | what it commits you to |
| --- | --- | --- | --- |
| **Trim** (load rarely used parts later) | keeps the promise with room to spare; start-up can get faster | effort; a short wait the first time a later-loaded screen opens | every later-loaded part is its own file, which the service worker must also cache for offline use |
| **Raise the cap** | quick; unblocks the feature now | start-up slows a little at a time, and nobody notices because the checks keep passing | re-run the sweep before each future raise; the start-up check becomes the only real guard |
| **Drop the cap, keep only the start-up check** | measures the real thing | slow and a little noisy; with Lighthouse run only by hand, a big addition is not caught until someone runs it | Lighthouse would have to go back into the pre-push hook (minutes on every push) |

**Default:** raise when the sweep shows at least twice the headroom you are asking for; trim when
it does not; never raise just to make a red check go green without looking at the charts.

### Raising the cap

1. Change `BUDGET_GZ` in `scripts/gate-budget.mjs` (and the `gates` help line in the `Makefile`).
2. `make budget-update`, then read the baseline diff.
3. `make perf-report` so the page shows the new cap line, and commit the page.
4. Add a line to [the history below](#cap-history): the date, old → new, and the sweep numbers that
   justified it.

## Things that are already known (do not re-learn them)

- **The pitch build is not counted.** The private pitch code is left out of the public build by a
  compile-time switch (`__PITCH__` in `apps/web/vite.config.ts`). If it ever leaks in, the size
  check fails with "pitch-only code is in the public build". That happened once and pushed the app
  over the cap.
- **Build core before the web app.** The web app uses `packages/core/dist`, so `make build` (not
  `pnpm build` in `apps/web`) is what a size measurement must follow.
- **Nothing here is limited by processor speed yet.** Start-up is dominated by downloads, so kilobytes
  are the right thing to count. One exception: expanding the page index on load costs about 85 ms
  of blocking time. If blocking time grows, measure processor work too, not only size.
- **Lighthouse's own performance score ignores time to interactive** (it carries zero weight in
  Lighthouse 12), which is why the check asserts the 2500 ms directly. A score of 100 does not mean
  the promise is kept.
- **A cold machine adds one slow run in five** (seen on GitHub's, when Lighthouse still ran there).
  That is why 5 runs and the median are used; a single red run is not a regression.
- **Lighthouse left GitHub on 2026-09-27** (#119 moved every check into local git hooks to save
  GitHub Actions minutes, and left Lighthouse out as too slow for a hook). Run `make lighthouse`
  before a demo, and whenever the size cap moves.

## What to trim, and how

**Read [trims.md](trims.md) now.** It holds where the room goes, each trim's status (in progress,
parked, done), and the checklist for taking one on: measure, failing test first, the things that
have bitten trims before (a flash on first open, offline, the pitch build, a saving too small to
matter), measure again.

## The reminder

A hook (`scripts/hook-perf-nudge.mjs`, run after every shell command) watches builds, pushes, the
size check and the start-up check. When the code is within 15 KB of the cap, the size check fails,
or the start-up check misses 2.5 s, it tells the session to run this skill, once per session for
each finding. It only reads files and the command's own output; it never builds anything itself.

## Cap history

| date | cap | why |
| --- | --- | --- |
| 2026-07 | 150 KB | set in the original plan alongside the 2.5 s start-up goal |
| 2026-09-27 | 175 KB | the app reached 149.3 KB. Sweep: start-up 2254 ms as built; still ≤ 2500 ms with +50 KB (2408), over it from +60 KB (2553). So ~50 KB of room for download-only code; raised by half of that (+25 KB). The owner chose to raise now and trim later |

### What the 2026-09-27 sweep taught us

- **Start-up rises in steps of 150 ms, not smoothly.** Each step is one more simulated network
  round trip for the script to arrive. Between steps, extra code is close to free; across one, a
  single kilobyte costs 150 ms. So "ms per KB" is an average, and the question to ask is **which
  step you land on**.
- **Near a step, runs disagree.** +25 KB measured 2404 ms in one sweep and 2257 ms in the next,
  because it sits right at a step's edge. Trust the pattern across several amounts, not one point.
- **Today: +0 to +50 KB is on the 2.25–2.41 s steps, +60 to +80 KB on 2.55 s (over), +90 KB on 2.71 s.**

## Tools

| command | does | file |
| --- | --- | --- |
| `make perf-report` | draws the charts into `docs/performance/bundle-report.html` | `scripts/perf-report.mjs` |
| `make perf-sweep` | measures start-up at +0/+25/+50/+100 KB (`ADD=0,50` to choose) and writes `docs/performance/sweep.json` | `scripts/perf-sweep.mjs` |
| `make lighthouse` | the start-up check itself | `.lighthouserc.json` |
| `pnpm gate:budget` / `make budget-update` | the size cap / accept a new size | `scripts/gate-budget.mjs`, `scripts/budget-baseline.json` |

The sweep writes structured log lines (`ev=lighthouse_start`, `ev=lighthouse_done`) so a long run
can be followed with `grep ev= <log>`.
