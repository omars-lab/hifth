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

### ③ The mounted set has no ceiling · **fixed**

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

**Closed by [`PageStage.budget.test.tsx`](../apps/web/src/components/PageStage.budget.test.tsx)**
— *"holds no more than the cap however many hop targets a selection has"*, written as the
entry specified and verified by inducing the old behaviour: with the cap removed it reports
12 mounted where 6 are allowed. The policy is
[`retainPages`](../packages/core/src/mounted-set.ts) in L1, called from the stage's eviction
effect, and `MOUNTED_PAGE_CAP` is the one number the on-device verdict tunes.

**It turned out to be two rules, not one, and the entry only saw the first.** A ceiling alone
would have made the stage strictly worse at the thing it was already good at: the old effect
kept `mountedPages ∪ current` and nothing else, so the stage has never had a *cache* — only a
working set, torn down and rebuilt on every selection. Capping that set without adding recency
means a reader who turns forward and back pays two fetches for a page that was in the DOM a
second ago. So `retainPages` fills the slots the request does not use with pages already
mounted, newest first. Both halves have their own test and each fails without the other; the
recency one fails with *one* page mounted where three were expected.

The 6 is still a guess — Loop 4b's spec said "LRU ~6 pages" before anything was measured, and
this loop did not measure it either. What changed is that the guess is now a named constant in
one file with a test asserting the stage obeys it, instead of an absence.

### ④ The desktop spread mounts two leaves, not one · **fixed**

Above `1024×740` the app mounts both leaves of the spread — deliberately a *mount* and not a
`display: none`, because a hidden leaf still fetches its SVG and builds a `Highlighter`
(`docs/design/desktop.md`). Today at most one leaf is ever real, since no two vendored pages
are adjacent. After 4b every spread is two real leaves, so any cap from ③ is a cap on
**leaves**, and a desktop reader turning pages walks through them twice as fast as a phone
reader does.

Not a defect; a multiplier to apply once ③ has a number.

**Closed by [`mounted-set.test.ts`](../packages/core/src/mounted-set.test.ts)** — the
`spreadBudget` block, which asserts the two shares sum to `MOUNTED_PAGE_CAP` — and by
[`PageStage.budget.test.tsx`](../apps/web/src/components/PageStage.budget.test.tsx)'s *"obeys a
smaller budget than the cap"*, which is the other half: a split nothing honours is arithmetic,
not a budget. Verified by inducing the old behaviour — pinning the stage's eviction to
`MOUNTED_PAGE_CAP` instead of its `pageBudget` prop makes the second test report 6 mounted
where 2 are allowed.

The multiplier ③ was waiting on turned out to be exactly 2, and the remedy is to stop the cap
being per-leaf: `spreadBudget()` splits the one number into `{ reading: 4, facing: 2 }`, and
`App.tsx` hands each `PageStage` its share. So the book costs 6 leaves, not 12, and the
desktop reader and the phone reader hold the same amount of paper.

The split is uneven on purpose. Hop targets only ever arrive at the leaf the reader is on —
the facing leaf is asked for exactly one page, always — so its share is one page plus one slot
of recency, enough to make turning back a spread free, and everything else stays where the
hops land. Below the breakpoint there is no second leaf and the reading stage takes the whole
cap, which is why the phone number in ③ did not change.

---

## 3. Bytes

### ⑤ Bundle headroom, and who is going to spend it · **fixed**

**106.6 KB gz against the 150 KB budget** as of `3962fc3` — 43 KB of headroom. Loop 4b spends
none of it (pages are assets, not bundle), but Loop 6b's pack manager and manifest, and Loop
7's polish, both land in the bundle. `gate:budget` is the only thing that will notice, and it
notices at the cliff rather than on the slope.

Worth considering: have the gate print the delta against `main` rather than only the absolute,
so a PR that adds 9 KB is visible as *adding 9 KB* instead of as "still under budget".

**Closed by [`scripts/gate-budget.mjs`](../scripts/gate-budget.mjs)** and the committed
[`budget-baseline.json`](../scripts/budget-baseline.json) beside it. Every run now prints a
delta per chunk, and a move of more than **1 KB in either direction** fails until the baseline
is re-accepted with `make budget-update`.

**The delta is against a committed baseline, not against `main`.** The entry's phrasing was the
obvious design and it was rejected on where the number ends up. Building the merge base gives a
number in a CI log, which is a place nobody looks; the committed file gives

```diff
-    "assets/index.js": 100246,
+    "assets/index.js": 109458,
```

in the diff a reviewer is already reading. It also doubles the build in CI and cannot run on an
offline or detached checkout, neither of which the log-line version was buying anything for.
The cost is one `make budget-update` on the PRs that actually move bytes — the same trade the
golden images make, and the same warning printed with it: an accepted baseline is the gate
agreeing with you, which is worth nothing unless you looked.

Two decisions inside that are not obvious. **A tolerance rather than an exact match**, because
the chunk hash is not stable even where the bytes are — three builds of the app chunk, one in
CI and two here, came out `index-CywQJkCX.js`, `index-C_PRj0XG.js` and `index-M-HaqE5a.js`, all
97.9 KB gz. So the baseline is keyed on the name with the hash stripped, and the size is
compared with a kilobyte of room. And **a shrink fails too**, which reads as pedantry and is not: unrecorded
headroom is headroom the next change spends without anyone seeing it go, which is the original
complaint with the sign flipped.

Still 108.7 KB gz against 150. The entry's 106.6 KB at `3962fc3` has become 108.7 across the
nineteen merges since — 2.1 KB, or about 110 bytes a merge. That is the slope it was worried
about, and it is a gentle one; the value of measuring it was never the number, it was that
until now nobody could have told you whether it was gentle.

### ⑥ The vendored corpus is the largest thing we ship, and nothing watches it · **fixed**

A vendored page is **~47 KB gz** (measured: 48.6 / 42.6 / 48.5 KB for pages 7, 9, 19). At 604
pages that is roughly **28 MB gz** of mushaf — two orders of magnitude past the JS bundle,
and the actual weight of this application.

`gate:budget` watches JS. `gate:golden-size` watches committed baseline PNGs. Nothing watches
`public/assets/`, where `roots` is already 2.4 MB, `skins` 952 KB and `adj` 932 KB before a
single extra page lands. Loop 4b should not be the first time anyone measures this.

**Proposal:** a `gate:assets` in the same shape as the others — per-directory ceilings, printed
every build, failing on the cliff. It is the cheapest item on this page and the one most likely
to be regretted if skipped.

**Closed by [`scripts/gate-assets.mjs`](../scripts/gate-assets.mjs)**, which prints this on
every `make ci`:

```
   450.7 KB gz  147 files  roots/hafs-kfqc  (ceiling 768.0 KB)
   207.7 KB gz  115 files  skins/hafs-kfqc  (ceiling 384.0 KB)
    55.8 KB gz  114 files  adj/hafs-kfqc  (ceiling 128.0 KB)
   136.4 KB gz    3 files  pages/hafs-kfqc  (heaviest 47.4 KB 7.svg, mean 45.5 KB)
    26.8 MB gz  604 pages projected from that mean  (ceiling 32.0 MB)
     0.5 KB gz    3 pages  manifest.json  → 108.7 KB gz at 604 pages (ceiling 256.0 KB)
```

Two things the proposal above got slightly wrong, both worth recording. **First, a
per-directory ceiling is the wrong instrument for `pages/`** — it is the one kind that grows,
so a total ceiling would have to be raised by the very change it exists to watch, and raising
it is indistinguishable from noticing. The invariant that survives Loop 4b is *per-page* weight,
so that is what is gated, and the whole-mus'haf figure is **projected from today's mean** rather
than measured. Three vendored pages now say something about six hundred and four. The other
three kinds are complete — one shard per surah, one corpus-wide root index — so for them the
proposal's absolute ceiling is exactly right, and a breach there means the ETL started emitting
something new rather than that the book got longer.

**Second, the estimate in this entry was 15% high.** «~28 MB gz» came from averaging the three
measured pages by hand; the gate's mean is 45.5 KB, so the projection is 26.8 MB. The direction
of the argument is unchanged, which is the useful thing to notice about it: two orders of
magnitude past the bundle either way.

The gate also fails on an **unknown kind directory, a loose top-level file, or an edition
directory whose `EDITIONS` status is not `vendored`.** That is not tidiness. The defect being
closed is *bytes shipping that nothing weighs*, and a gate that quietly skips what it does not
recognise reintroduces it one directory at a time. It reads `public/assets` and the
`concordance.ts` **source** — never `dist/` — for the reason `gate-quran-meta.mjs` states: the
failure must land on the commit that causes it, and in CI's gate job nothing is built.

### ⑦ Both locales ship at first paint — deliberate, revisit at four · **answered**

`messages/catalogs.gen.ts` statically imports every locale, and says why: the chrome is a few
KB and must be on screen at first paint, offline, with nothing to wait on. That reasoning is
correct for two locales and does not obviously survive being multiplied — Urdu, Turkish,
Indonesian and French are all plausible, and the file's own doc comment advertises that adding
one is "a JSON catalog plus a row".

Not work today. The trigger to revisit is a **fourth** locale, and this entry exists so that
whoever adds it finds the decision rather than the consequence.

### ⑪ The manifest is one whole fetch, and it grows with the book · **fixed**

Weighing the corpus for ⑥ turned up the file that is not like the others. `manifest.json` holds
a polygon list per page and is fetched **entire**, at
[`assets.ts:16`](../apps/web/src/assets.ts), before the first page can be resolved — it is not
sharded, not lazy, and not skippable. Today it is 553 bytes gz, which is 184 bytes per page.
At 604 pages that is **~109 KB gz in front of first paint**, on a phone, offline-first, ahead of
the page SVG it exists to locate.

That is not fatal and it may well be acceptable: it is one request, it caches, and 109 KB gz is
under the JS budget. What makes it worth an entry is that nothing about the current design will
*tell* us — the manifest is the last remaining asset with no per-page fetch, so it converts the
whole book into a fixed cost paid on every cold start.

**How we'd know:** cold-cache time-to-first-page on the mid-tier Android of ①, with the manifest
at full size, against the same measurement with a per-page or per-juz shard. `gate:assets`
already prints the projection and fails past 256 KB gz, so the number is visible every build
rather than discovered during Loop 4b.

Not work today — three pages make it 553 bytes. The trigger is **Loop 4b**, which is also the
loop that would fix it, since sharding the manifest by juz is the same work as pinning a juz
offline (Loop 6b).

**Closed by [`manifest.test.ts`](../packages/core/src/manifest.test.ts)** and the shape it
tests — [`CompactManifest`](../packages/core/src/manifest.ts), the form the ETL now writes and
`loadManifest` expands. `gate:assets` keeps the number honest on every build.

**The projection was right and the remedy was wrong, which is the useful part.** 604 pages of
the old shape really is ~109 KB gz. But it is 109 KB of *restated arithmetic*: the corpus has
exactly one polygon per ayah, and every polygon's id is `verse-<absolute ayah>` — so `number`,
`surah`, `ayah`, `key` and `elementId` are all recoverable from a position in a 6236-long
array, and the only irreducible fact is which page each ayah sits on. The wire form is that
array plus a viewBox and its two overrides:

```
24,471 bytes raw · 1,333 bytes gz · the whole print
```

**1.3 KB.** Sharding a 1.3 KB file by juz would add thirty requests to save nothing, so the
entry is closed by deletion of the problem rather than by the fix it proposed — and Loop 6b's
pin-a-juz work loses the "same work as" argument along with it. What it does instead is inherit
a *proof*: `compactManifest` **refuses** a corpus where an ayah spans two pages or an id is not
its own verse, and `extract-pages.mjs` re-derives the manifest from the committed SVGs on every
CI run. The compression is not a trick; it is those two invariants written down.

### ⑬ The corpus is 92 MB of outlines and 47% of it repeats · **answered**

Loop 4b put **604 page SVGs, 92 MB on disk** into the tree, and the obvious question on the
commit is whether they should be stored some other way — generated at build time, deduplicated,
or pushed out to LFS. Measured before answering, so nobody re-derives it:

| | |
|---|---|
| One page (p50) | 157,734 B raw · 45,971 gz · **37,117 brotli** |
| Of that, path `d` data | 155,502 B — **98.6%** |
| Largest single `<path>` | `d` of 138,630 B — the page's entire scripture, one element |
| Elements per page | 28 paths; **zero** `use`, `defs`, `symbol` or `text` |
| Exact-shape reuse, 51-page sample | 70,706 subpaths → 37,380 unique — **1.9×, 47.1% repeats** |
| Whole corpus, git-packed | 92 MB → **28 MB** |

Three readings. **The file is not a document, it is a photograph of one** — the print's glyphs
arrive as flattened outlines with no font, no shaping and no reusable symbol, which is exactly
why svgo cannot get it below ~46 KB gz and why there is no smaller *faithful* form lying around
unused. **Nothing here is on the critical path**: pages are fetched one at a time on demand,
brotli, ~37 KB each — the corpus is a repository cost, not a reader's cost, and the TTI that
matters went *down* this loop. **And the repeats are real but not free**: every ligature in the
book is drawn from a small alphabet, so an idealised glyph sprite (`<defs>` + `<use>`, one
outline per distinct shape) is the obvious win — but 1.9× is the *ceiling measured on the bytes
we actually have*, not the ceiling in principle, because svgo rounds coordinates after they have
been placed, so the same ligature at two different x-offsets is two different strings. Recovering
the true reuse means re-deriving glyph identity from unrounded geometry, i.e. re-running the
outline extraction ourselves — a second ETL that owns the typography, against an upstream we
currently only *verify*.

Which is the case against doing it today, in one line: **we would be trading a pin we can prove
for a pipeline we would have to trust.** `vendor-pages.mjs` reproduces the upstream bytes
byte-for-byte through a pinned svgo, `quran-svg.pin.json` carries three SHA-256s per page, and
`gate:pages` re-hashes all 604 offline on every run. That is the strongest guarantee in the repo
about the correctness of scripture on screen. A sprite build sits *downstream* of it, so exactness
would have to be re-established against a rendered image rather than a hash — and the day a
rounding change silently thickens one letter, the gate that catches it is the one we deleted.

**Git LFS is the wrong tool for the same reason, plus a worse one.** LFS stores blobs
uncompressed and outside the pack, so 92 MB stays 92 MB where packed git already made it 28,
and it converts a clone from *works offline, anywhere, forever* into a clone that needs a
working LFS endpoint. This project's whole claim is that it survives without a network.

Not work today. **The trigger is a second corpus.** One print packs to 28 MB and nobody notices;
what changes the arithmetic is adopting a *second* set of 604 pages — the ligature-based corpus
of PLAN follow-up 13 (needed for word granularity, external task #65), a second riwāyah, or a
second layout version — because that is the point where the sprite stops being a compression
trick and starts being the thing that lets two prints share one glyph table. Two concrete
numbers to reach for instead of a feeling: **packed history past ~100 MB**, or a cold `git clone`
past ~2 minutes on the connection someone actually contributes from. Until one of those, the
92 MB is the price of being able to prove what we ship.

---

## 4. Prefetch

### ⑧ Shards prefetch by mounted page, not by hop target · **fixed**

`App.tsx:301` prefetches adjacency shards for every surah *visible on a mounted page*, so the
rail is ready the instant an ayah is tapped. That is the right eager step for the tap, and it
is the wrong one for the hop: a mutashabihat edge very often points into a different surah, so
the shard for the place the reader is about to go is exactly the one not prefetched.

Loop 7 names this as "perf pass (shard prefetch on selection)". The comment at `App.tsx:299`
already says 4b widens it. Recording it here so the widening is a task rather than a comment.

**How we'd know:** time from hop-chip tap to rail-populated, with a cold shard cache.

**Closed by `apps/web/e2e/hop.spec.ts`** — *"the shard for where the rail can send you is
fetched before you go"*. A second effect walks the selection's `hopsForKey` and `rangeHops`
and calls `ensureShard` on each target's surah, beside the page-keyed loop rather than
replacing it: the two sets are different and both are wanted.

The comment that deferred this to 4b was wrong about *when*, not about *what*. Nothing here
needed a streamed corpus — the hop list is already computed for the rail, so the widening
costs the walk and nothing else. It was deferred because the prefetch was read as a
page-mounting concern, which is the frame the bug lives in.

Targets on unvendored pages are prefetched too, which is the one judgement call in it.
`canHop` disables those chips today, so the shard buys nothing a reader can see this loop;
what it buys is a truthful count on the far side the day 4b vendors the page, and filtering
by `resolver` here would push the inventory's shape into a cache decision that should not
know about it.

**The measurement in *How we'd know* was not taken, and the test is not it.** A timing
assertion against a cold cache is flaky by construction in a suite that runs three projects
on one machine, so the row asserts the *cause* instead: with no chip opened and no hop taken,
2:120's rail offers 13:37 and surah 13's shard has already been requested. It also asserts
`< 5` shards — a rule that fetched all 114 would satisfy the first claim while being the same
bug pointing the other way.

---

## 5. Measurement gaps

### ⑨ TTI on mid-Android is an exit criterion with no instrument · **fixed**

Lighthouse CI gates ≥90 on a desktop runner. Loop 4b's exit says *< 2.5 s on mid-Android*.
These are not the same claim, and the second one currently has nothing behind it. Either the
criterion acquires an instrument (a throttled Lighthouse profile chosen to stand in for the
class of device) or it should be restated as something CI can actually assert. An exit
criterion nothing evaluates is the interface-papering-over-a-gap failure this project has
already paid for twice.

**Closed by the `interactive` assertion in [`.lighthouserc.json`](../.lighthouserc.json)**,
which fails CI at a median TTI above 2500 ms.

**The instrument was already running, and that is the part this entry got wrong.** The entry
reads as though Lighthouse were profiling a desktop, and half of that is true — the *runner*
is desktop-class hardware. But the *emulation* has been mid-Android the whole time, because
that is Lighthouse's default and nobody had looked: a Moto G Power (2022) at 412×823, Slow 4G,
**4× CPU slowdown**. It has been reporting TTI on every push since Loop 6a. It was reporting
**2.27 s**.

So the gap was never the profile. It was that **nothing read the number**, and the four
category assertions structurally could not: in Lighthouse 12 the TTI audit carries **weight 0**
and sits in the `hidden` group. A build can score a perfect 100 on performance with a TTI of
any size. `≥90` was never making the claim we were reading into it — which is the same failure
the entry names, one layer further in than the entry looked.

Two things were needed, then, and neither was a new harness:

- **Assert it.** `"interactive": ["error", { "maxNumericValue": 2500, "aggregationMethod": "median" }]`.
- **Pin the device.** The profile is now written out in the config rather than inherited, with
  every number copied from a report. Inherited, a Lighthouse upgrade that retunes its default
  preset would silently change *which phone* the criterion is about — a criterion whose device
  can move underneath it is the same shape of gap as one with no instrument at all.

**What measuring it turned up.** Fifteen runs across two machines whose `benchmarkIndex` spans
2142 to 3403 (this laptop and `ubuntu-latest`) landed inside **2266–2437 ms**, one cold CI run
at 2794 aside. Lantern's simulation is far more host-independent than the hardware under it,
which is what makes an emulated number worth asserting at all.

It does not scatter, though — it **steps**. Nine consecutive runs of one unchanged build came
out bimodal: three at 2279–2284, six at 2429–2437, nothing in between. The gap is 150 ms, which
is `rttMs` to the millisecond. The LCP resource simply lands one simulated round trip later in
some runs. `numberOfRuns` went 3 → 5 for that reason and not out of a general taste for more
samples: a median has to come from enough runs that one step plus one cold start cannot carry it.

And **TTI was identical to LCP in all nine**, because total blocking time is 0. Nothing on this
path is compute-bound. Whatever eventually moves this number will be a network waterfall — a
resource added in front of the largest paint — not a script that got slower. That is worth
knowing before the first red.

**Half of that stopped being true in Loop 4b, and the half that broke is the half that read
like a law.** TTI is still identical to LCP, so the conclusion survives; the *reason* given for
it does not. Blocking time is no longer 0 — `expandManifest` rebuilds 6236 entries at load and
costs a median 85 ms of TBT, which is the first compute this path has ever carried. "Nothing
here is compute-bound" was an observation about a build with three pages in its manifest, and
it was written in the voice of a property of the architecture. The step it describes also
vanished: five post-corpus runs span six milliseconds where nine pre-corpus runs straddled a
150 ms round trip. Numbers in ⑫.

The reading is in ⑫, because it is not good news and it is not this entry's subject.

### ⑫ The exit criterion has 71 ms of margin, on three pages · **fixed**

⑨ gave *< 2.5 s TTI on mid-Android* an instrument. The instrument says the app passes, and by
how much: the worst honest median measured is **2429 ms against 2500** — 71 ms, or **half a
simulated round trip**. The best is 2281. Both are passes; one of them is a pass that a single
extra request in front of the largest paint would end.

This is on **three vendored pages**. Loop 4b vendors the other 601, and ⑪ adds ~109 KB gz of
manifest fetched whole before the first page can resolve. Neither is on the critical path
today, and the point of writing this down now is that "not on the critical path" is a claim
with an expiry date and no alarm on it.

**One of those two threats did not arrive.** ⑪'s ~109 KB was the old `AssetManifest` shape
projected to 604 pages; Loop 4b ships the compact wire form instead, and the manifest in front
of the first paint is **1,333 bytes gzipped for the whole print** — smaller than the
three-page file this margin was measured against. So the fetch ahead of LCP did not grow. The
604 pages did, and they are fetched one at a time on demand, which is the thing left to
re-measure.

What would answer it: the numbers already collected are the *pre-4b* baseline, so the work is
to look again immediately after the corpus lands rather than at the end of the loop — the
criterion is a Loop 4b exit, and discovering a breach at the exit is discovering it too late to
choose differently. If it does breach, the lever is the waterfall in front of LCP (TBT is 0, so
there is nothing to make faster, only things to stop fetching first), and the honest fallback
is to restate the criterion against real hardware — which is ② — rather than against Lantern.

Not blocked: the measurement is repeatable today with `make lighthouse`. It is `confirmed`
rather than `risk`-flavoured guesswork because the 71 ms is measured, from fifteen runs, and
recorded above.

**The margin is host-dependent, and the two CI runs since say so.** 71 ms is the worst case and
it belongs to *this laptop*, whose runs are bimodal; CI has now produced ten samples across two
pushes and every warm one landed in the lower mode:

```
PR #50   2278  2279  2281  2281   ·  2768 (TBT 344)      median 2281   219 ms of margin
main     2273  2274  2276  2277   ·  2806 (TBT 318)      median 2276   224 ms of margin
```

Two things to take from that and one not to. The cold run is real and it is *why*
`aggregationMethod` is `median` — it appeared once in each set, both times on the runner with
the lowest `benchmarkIndex`, and both times it is the only sample in either set with a non-zero
blocking time. And the honest margin on the machine that actually gates merges is closer to
**220 ms than to 71**. What not to take from it is comfort: 220 ms is still under a tenth of the
budget, both numbers are for three pages, and neither says anything about the run after 4b. The
worst figure stays in this entry's title deliberately, because the entry exists to be read
before the corpus lands rather than after.

**The post-corpus reading, taken the hour the corpus landed** (2026-08-03, `make lighthouse`,
604 pages vendored, same laptop as the 71 ms worst case). Five runs:

```
TTI   2268  2264  2262  2264  2265      median 2264      236 ms of margin
TBT    100    85   100    84    84      median   85      was 0
LCP  identical to TTI in all five
```

The margin did not shrink. It **widened**, on the machine that produced the worst number in
this entry's title, from 71 ms to 236 — and the bimodality widened out of existence with it:
nine runs of the pre-4b build stepped between 2279–2284 and 2429–2437 with nothing in between,
and these five span **six milliseconds**. That step was one simulated round trip (`rttMs` 150,
to the millisecond), which is what a resource landing in the next RTT window looks like; the
manifest ahead of the first paint went from a three-page `AssetManifest` to 1,333 bytes gz, and
it stopped straddling the boundary. So the compact wire form did not merely avoid ⑪'s 109 KB —
it took a request off the edge of a round trip that the old one sat on.

Two things not to take from that. **TBT went from 0 to 85 ms**, which is `expandManifest`
rebuilding 6236 entries at load, and it is the first compute this path has ever had; the
statement above and in ⑨ that "nothing here is compute-bound" is now false, and the next thing
that moves TTI could be a script after all. And this is still Lantern on a laptop — ② is still
the real-hardware check and is still blocked on hardware. What *is* settled is the question
this entry was opened to ask: the 604 pages did not cost the exit criterion anything, because
they are fetched one at a time on demand and never in front of the largest paint.

Closed by `.lighthouserc.json`'s `interactive` assertion — median of five, 2500 ms, which has
gated every push since ⑨ and now has the post-corpus distribution written beside it.

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
