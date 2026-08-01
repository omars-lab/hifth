# Backlog — performance and optimization

**What this file is, and what it is not.** [`PLAN.md`](PLAN.md) §Status & tracking remains the
roadmap of record: loops, their gates, and their open follow-ups live there and nowhere else.
This file holds the **optimization work that is not yet scheduled into a loop** — items that
are real, that we can name a measurement for, and that would otherwise survive only as a
sentence buried in a decision record or a comment. An item graduates *out* of here the moment
it becomes a loop's exit criterion or a numbered follow-up; at that point PLAN.md owns it and
the row here is deleted rather than duplicated.

The standing rule the validation ledger runs on applies to everything below: **an entry that
cannot name what it would measure is not an optimization, it is a preference.** Each item
therefore says how we would know it worked, and several of them say plainly that we cannot
know yet.

Every item is an `### ⓝ … · **status**` row, the same convention every design doc's open
section uses, so `pnpm gate:issues` reads this file without a special case. The vocabulary is
defined once in [`issues.json`](issues.json).

---

## 0. The verdict everything else waits on

### ① On-device perf verdict — `perf-verdict-on-device` · **blocked**

The keystone. It decides which of the three rendering strategies in §1 gets built, and it
gates **Loop 4b, Loop 6b and Loop 7** (`docs/validation/ledger.json`). It is the oldest open
item in the project — deferred at the end of Loop 1 and carried through six loops — and the
reason it sat is now well understood: the old recipe was pair-over-USB, enable Web Inspector,
find the timeline, read a flame chart, and a check that expensive to run is a check that does
not get run.

That friction is gone. `make phone-perf` serves the probe build over the LAN and the phone
measures itself — three five-second segments driven with real fingers, no cable and no
DevTools:

| segment | what it is actually asking |
|---|---|
| `pan` | steady-state compositing of a mounted ~170 KB inline SVG |
| `pinch` | re-raster when zoom passes the layer's backing store |
| `highlight` | overlay churn on tap — an INP question, not an fps one |

The probe (`apps/web/src/perf/probe.ts`) is behind a build-time flag and never enters a
shipped bundle.

**To run it:** `make validate CHECK=perf-verdict-on-device` prints the full runbook.
**When the JSON lands:** `make record CHECK=perf-verdict-on-device RESULT='…'`, then do the
two things the ledger's `tunes` list names — replace the emulated frame budget in
`apps/web/perf/pan-zoom-trace.mjs` with the measured one, and settle §Loop 4b in PLAN.md.

**Owner: the user.** Nothing here can be done from this machine.

### ② The same measurement on real mid-tier Android · **blocked**

`pan-zoom-trace.mjs`'s baseline is emulated — about 8.3 ms/frame and, suspiciously, flat
under CPU throttle, which is the signature of a measurement that is not seeing the thing it
was written to see. Emulation cannot model the two risks that matter: the initial raster of a
170 KB inline SVG on a low-end GPU, and re-raster on zoom past the backing store.

Loop 4b's exit criterion is *first-page TTI < 2.5 s on mid-Android*. Nobody has held a
mid-Android. The probe removes the tooling dependency for the reader but not the hardware
dependency for the claim.

**Blocked on hardware** (an Android phone; `adb` optional now that the probe is self-serving).
Previously tracked as task #71.

---

## 1. Rendering strategy — three candidates, exactly one survives

The verdict picks one. The other two should die with it rather than linger as options, and
whichever wins gets written into `docs/decisions/` with the numbers that chose it.

**(a) Inline SVG everywhere — the status quo.** Every mounted page is a live DOM tree, which
is what makes per-ayah `role="button"` polygons, the tajweed skin's class swap, and the
highlighter's geometry possible at all. The cost is linear in mounted pages and paid in
raster, not in bytes.

**(b) `content-visibility` virtualization.** Keep inline SVG, let the browser skip layout and
paint for off-screen pages. Cheapest to try; the open question is whether `contain-intrinsic-size`
can be given honestly, since mushaf leaves are uniform enough that it probably can.

**(c) Raster-glyph fallback.** Ship pre-rendered raster for the page and keep only the polygon
overlay as DOM. Fastest to paint, and it costs the thing this app is built on — a raster page
cannot carry the skin, and the accessibility tree would have to be synthesised beside an image
rather than being the page. Genuinely a last resort, and worth naming as one so it is not
reached for casually.

---

## 2. Bounded mounting

### ③ The mounted set has no ceiling · **confirmed**

`App.tsx:288` computes `mountedPages` as *the current page plus every vendored hop target of
the current selection*. With three pages vendored the set can never exceed three, so this has
never been wrong. After Loop 4b it is the selection's entire hop fan-out, and a densely
connected ayah can have a lot of it.

Loop 4b's own spec already says what the answer is — *fetch-on-demand, LRU ~6 pages, prefetch
hop targets and adjacent pages* — so this is not a new idea, it is a note that the current
code is the un-bounded special case and the bound is not written yet. `PageStage.tsx:495`
already evicts everything outside `keep`, so the change is one policy function, not a rewrite.

**How we'd know:** a test that selects a high-degree ayah and asserts the mounted count stays
at the cap. Cheap, and it fails today for the right reason (there is no cap).

### ④ The desktop spread mounts two leaves, not one · **blocked**

Above `1024×740` the app mounts both leaves of the spread — deliberately a *mount* and not a
`display: none`, because a hidden leaf still fetches its SVG and builds a `Highlighter`
(`docs/design/desktop.md`). Today at most one leaf is ever real, since no two vendored pages
are adjacent. After 4b every spread is two real leaves, so any cap from ③ is a cap on
**leaves**, and a desktop reader turning pages walks through them twice as fast as a phone
reader does.

Not a defect; a multiplier to apply once ③ has a number.

---

## 3. Bytes

### ⑤ Bundle headroom, and who is going to spend it · **open**

**106.6 KB gz against the 150 KB budget** as of `3962fc3` — 43 KB of headroom. Loop 4b spends
none of it (pages are assets, not bundle), but Loop 6b's pack manager and manifest, and Loop
7's polish, both land in the bundle. `gate:budget` is the only thing that will notice, and it
notices at the cliff rather than on the slope.

Worth considering: have the gate print the delta against `main` rather than only the absolute,
so a PR that adds 9 KB is visible as *adding 9 KB* instead of as "still under budget".

### ⑥ The vendored corpus is the largest thing we ship, and nothing watches it · **open**

A vendored page is **~47 KB gz** (measured: 48.6 / 42.6 / 48.5 KB for pages 7, 9, 19). At 604
pages that is roughly **28 MB gz** of mushaf — two orders of magnitude past the JS bundle,
and the actual weight of this application.

`gate:budget` watches JS. `gate:golden-size` watches committed baseline PNGs. Nothing watches
`public/assets/`, where `roots` is already 2.4 MB, `skins` 952 KB and `adj` 932 KB before a
single extra page lands. Loop 4b should not be the first time anyone measures this.

**Proposal:** a `gate:assets` in the same shape as the others — per-directory ceilings, printed
every build, failing on the cliff. It is the cheapest item on this page and the one most likely
to be regretted if skipped.

### ⑦ Both locales ship at first paint — deliberate, revisit at four · **answered**

`messages/catalogs.gen.ts` statically imports every locale, and says why: the chrome is a few
KB and must be on screen at first paint, offline, with nothing to wait on. That reasoning is
correct for two locales and does not obviously survive being multiplied — Urdu, Turkish,
Indonesian and French are all plausible, and the file's own doc comment advertises that adding
one is "a JSON catalog plus a row".

Not work today. The trigger to revisit is a **fourth** locale, and this entry exists so that
whoever adds it finds the decision rather than the consequence.

---

## 4. Prefetch

### ⑧ Shards prefetch by mounted page, not by hop target · **confirmed**

`App.tsx:301` prefetches adjacency shards for every surah *visible on a mounted page*, so the
rail is ready the instant an ayah is tapped. That is the right eager step for the tap, and it
is the wrong one for the hop: a mutashabihat edge very often points into a different surah, so
the shard for the place the reader is about to go is exactly the one not prefetched.

Loop 7 names this as "perf pass (shard prefetch on selection)". The comment at `App.tsx:299`
already says 4b widens it. Recording it here so the widening is a task rather than a comment.

**How we'd know:** time from hop-chip tap to rail-populated, with a cold shard cache.

---

## 5. Measurement gaps

### ⑨ TTI on mid-Android is an exit criterion with no instrument · **open**

Lighthouse CI gates ≥90 on a desktop runner. Loop 4b's exit says *< 2.5 s on mid-Android*.
These are not the same claim, and the second one currently has nothing behind it. Either the
criterion acquires an instrument (a throttled Lighthouse profile chosen to stand in for the
class of device) or it should be restated as something CI can actually assert. An exit
criterion nothing evaluates is the interface-papering-over-a-gap failure this project has
already paid for twice.

### ⑩ The CI frame budget is a number from an emulator · **blocked**

`pan-zoom-trace.mjs` asserts against 16.7 ms with an emulated ~8.3 ms baseline. Item ① replaces
that number with a measured one — listed separately because it is the *only* part of ① that is
mechanical, and it must not be forgotten once the interesting part (the strategy decision) is
settled.

---

## Considered and deliberately not doing

- **Precaching the mushaf corpus in the service worker.** Ruled out at `vite.config.ts:35` —
  604 pages would blow the install precache. Visited pages are runtime-cached instead, which
  is the correct shape and is already built.
- **A batteries-included i18n runtime.** Rejected during the i18n work: 9.3–25.2 KB on top of
  the same catalogues we compile ourselves for ~180 B of `Intl.PluralRules`
  (`docs/decisions/i18n.md`).
- **Raster pages as the default.** See §1(c). It is a fallback, not a preference, and it costs
  the skin and the accessibility tree.
