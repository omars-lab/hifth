# Loop 6a — Skin, editions, wayfinding, offline foundation

**Status:** complete (ungated half; pin-a-juz packs are Loop 6b, still gated on follow-up ①).
**Date:** 2026-07-25.
**Exit criterion (PLAN §Loop 6a):** instant plain⇄tajweed toggle with identical geometry;
jump to any surah/juz/ayah; visited pages survive a reload offline; Lighthouse ≥90.
**Result:** all four met. The skin swap is proven byte-identical by geometry fingerprint
rather than asserted; the jumper answers surah-by-name, juz, and `surah:ayah` through the
same `restoreState` a shared link uses; a visited page opens and is still *tappable* with
the network off; Lighthouse is **94 / 100 / 100 / 100** (perf / a11y / best-practices / SEO)
across three runs. `make ci` green (**91.5 KB gz** of 150), `make e2e` **88 passed,
6 skipped, 0 failed**, core **211** unit tests, web **82**.

## What shipped

Three agents wrote this loop simultaneously into one tree, then a merge pass reconciled
them (see *The merge pass*, below — it is the most transferable thing in this record).

### A — the tajweed skin

Toggle the skin and the page recolours; nothing moves. That is the whole spec §8 promise,
and it is **proven, not claimed**: `geometrySignature` fingerprints every shape attribute
on the page, and both the unit and e2e tiers compare the bytes across a swap.

- **Source:** `cpfair/quran-tajweed` @ `496f71cd`, CC BY 4.0 by the author's own README,
  verified byte-identical through a second transport. Attribution ships four ways —
  `SOURCES.md`, `data/tajweed/PROVENANCE.md`, `NOTICE.txt` beside the shards, and a visible
  credit in the in-app legend. quran.com's spans were rejected (no grant, and enumerating
  all 114 surahs shows they descend from this same file); QUL #58/#87 rejected on Loop 5's
  grounds — no licence text, login-gated downloads.
- **Granularity, stated rather than faked.** The vendored pages carry per-ayah hit polygons
  and no letter or ligature elements, so a character span has nothing to attach to. The
  shards keep the source's spans **verbatim** — Loop 4b's ligature corpus consumes them
  unchanged — while what paints today is one mark per ayah: its **rarest** rule. Rarest by
  measured coverage, not taste (91.5% of ayahs carry a madd; 2.1% carry a madd lazim).
- **Colour is never the only channel.** Each family also has an Arabic name, a text mark and
  a dash pattern, and the legend is part of the feature — reachable with the skin off.
- Labelled **beta on the control itself in both states**, per PLAN §6, until hafiz sign-off.

### B — wayfinding

- **The jumper** (`/`, or ⌖ in the chrome) answers the three ways a hafiz names a place:
  surah by name or number, juz, or `surah:ayah`. `core/jump.ts` is the pure query language;
  landing goes through `restoreState`, the same path a live hop and a cold-opened link take.
  `origin` picks the *wording of the announcement* and never a second navigation path.
- **The keyboard map** (`core/keymap.ts`) is a tested precedence ladder, not a race:
  modifiers, text fields and open dialogs opt out first; then an already-`preventDefault`ed
  event; then `/`, which deliberately survives ayah focus because the jumper must be
  reachable from anywhere; then horizontal arrows turn pages. Vertical arrows stay with
  Loop 3's ayah stepper. Paging walks the pages actually vendored and says
  «آخر صفحة متوفّرة» rather than landing on a blank.
- **EditionPicker** lists every edition Hifth knows, un-vendored ones disabled and carrying
  their *real* blocker (a non-commercial licence, a missing page source) — the hop rail's
  surfaced-but-disabled rule, applied to mushafs. Under each row is the concordance line: a
  position crosses editions through a table or not at all (spec §1 forbids index
  arithmetic), and with no table shipped, every row says so. Real code with an empty table,
  proven by fixture rather than by faking a second mushaf.
- **CoachMarks** teach the three verbs the app actually has, once per device.

### C — offline foundation, golden images, Lighthouse

- **Three asset classes, three strategies**, chosen on size, mutability, and what a miss
  costs offline:

  | Class | Strategy | Why |
  |---|---|---|
  | shell + registry | precache | without `assets/manifest.json` a cold offline start renders nothing at all |
  | mushaf pages | CacheFirst, 32 entries, **no maxAge** | a page's bytes never change; a time-expired page is one that vanishes offline, the exact failure this cache prevents |
  | ETL data shards | StaleWhileRevalidate | single-digit KB, stable paths, and they *do* change — a corrected edge ships new bytes to the same URL |

  `clientsClaim` (not `skipWaiting`) fills the cache from the **first** visit; without it the
  installing tab stays uncontrolled and everything it fetches bypasses the worker.
- **The failure paths are UI.** `persist()` grants are silent and heuristic, so denial is the
  normal case. `storage.ts` classifies durability, and `OfflineNotice` says the one true
  thing — a capped quota outranks a missing install, which outranks a denied persist —
  at most once per problem.
- **Golden images** (moved here from Loop 5): ten shots, pages 7/9/19 × selection /
  breadcrumb / phrase, plus a marquee on 7. Its own project with the viewport spelled out
  (390×844 @2×) rather than taken from `devices`, so a Playwright upgrade that retunes a
  descriptor cannot silently invalidate every baseline. Baselines are **per platform**
  (`__screenshots__/{platform}/`) because the same build differs by anti-aliased pixels
  between macOS and Linux.
- **Lighthouse CI** gate at `minScore 0.9` on all four categories.

## Decisions

- **⬡ chip vs ⬡ lens (the Loop 5 collision, resolved).** Same glyph, two promises: the rail
  chip is the *curated* shared-root edge, the lens is the *corpus-wide* root family. They
  are now one surface — the curated edges appear inside the lens, marked as curated — so the
  glyph makes one promise. Covered by `01b702c`.
- **A shared link decides which page shows, not the network.** `navigatedRef` lets an
  explicit `navigateTo` beat the initial-mount default, so a cold-opened `#/…/9:1` lands on
  page 9 even when page 7 resolves first. Found by the golden harness as *one flaky shot in
  ten*, then given its own deterministic test in `e2e/deeplink.spec.ts` — accepting the
  baseline was the last step, not the fix.
- **The skin preference is deliberately not persisted.** Tajweed is beta; a beta rendering
  of scripture that silently returns on every launch is a different promise than one you
  opt into.
- **Pin-a-juz stays in Loop 6b.** Pinning a juz while three pages are vendored is theatre,
  and the packs need Loop 4b's corpus. What is testable *today* is the foundation and its
  failure paths, and that is what shipped.
- **Offline e2e is Chromium-only.** Playwright's WebKit neither runs our service worker
  against the preview server the way real iOS Safari does nor routes `setOffline` through
  its network stack. A green WebKit run there would be a lie. The iOS half is a device
  check: the 8+ day ITP survival test, which is Loop 6b's, on hardware.

## The merge pass — what three parallel agents cost, and what it bought

Each agent's work was correct on its own and passed its own tier. The only files more than
one touched were `PageStage.tsx`, `Makefile` and `App.tsx`, and no edit clobbered another.
The defect was **semantic, and only existed once both halves were mounted**:

> **B's coach strip and C's storage notice are both strips *in* the layout above the stage,
> each for the same good reason — neither may cover an ayah. Stacked, they cost 226px of a
> 412×839 phone. `main` drops from 713px to 487px: a third of the stage, on exactly the
> visit where a reader is deciding what this app is.**

Neither agent could have seen it. It is resolved in the one place that can see both: `App`
holds the storage notice until the coach strip reports it has left. Teaching goes first —
one asks for a tap *now*, the other warns about eviction that may never come. The hold is
presentational only: the storage read and the first-interaction `persist()` request still
run while held, so a grant that arrives during the lesson is already reflected when the
strip lifts.

**The second finding is the more useful one.** Fixing the stacking broke an offline test
that had been green for a loop — and the cause was in the *test*, not the app. Playwright
aims at the centre of an element's bounding box, clipped to the viewport. An ayah is a run
of text, so one that wraps a line is a path of two disjoint rectangles, and the centre of
the box containing both falls in the gap — which belongs to the neighbouring ayah. Tapping
`#verse-54` (2:47) lands on `#verse-55`. It had been passing only because a banner above the
stage was making the stage shorter, pushing the clipped aim point back inside 2:47.

`e2e/ayah.ts` now **finds** the point instead of assuming it: scroll into view, then sample
the box and keep the first place `document.elementFromPoint` answers with that ayah. That is
the question the browser asks on a real touch. Every ayah tap and both marquee drag
endpoints go through it. Same class as the golden marquee shot that photographed an empty
frame: **an assertion that cannot fail is worse than no assertion**, because it reads as
coverage.

**Verdict on the protocol:** shared tree, one branch, advisory `mkdir` lock, explicit-path
commits, no `--no-verify`. It held — three agents, no lost edits, no rebase. The cost is
that composition defects are invisible until the merge pass, so **the merge pass is not
optional and is not a formality**: it is the only tier that runs the whole product at once.
Budget it as its own step in every parallel loop.

## Measured

| Metric | Value | Budget |
|---|---|---|
| Lighthouse (3 runs) — perf / a11y / best-practices / SEO | 94 / 100 / 100 / 100 | ≥90 each |
| JS bundle | 91.5 KB gz | <150 KB |
| Tajweed shards | 114 surahs, largest 14.9 KB gz (`2.json`, 50.6 KB raw) | <50 KB gz |
| Golden baselines | 20 — 10 shots × 2 platforms (darwin, linux) | — |
| Core unit tests | 211 (14 files) | — |
| Web unit tests | 82 (9 files) | — |
| e2e | 88 passed, 6 skipped, 0 failed (10 specs × iPhone/Android/golden) | all green |
| Stage height cost of stacked strips (regression fixed) | 226px of 839 | 0 |

## Deferred

- **Pin-a-juz packs, eviction detection, re-pin offer** → Loop 6b (gated on 4b).
- **The 8+ day ITP offline survival test** (installed vs tab) and **iOS standalone state
  restoration** → Loop 6b, on hardware. Neither is emulable.
- **Hafiz sign-off on the tajweed skin** → Loop 7; the beta label stays until then.
- **Word-granularity tajweed painting** → after 4b. The spans are already vendored verbatim,
  so this is a rendering change, not a data change.
- **A tajweed row in the golden `SKINS` axis** → after hafiz sign-off, and only behind a
  **test-only** skin flag. Two agents converged on refusing it, and both reasons outlive the
  loop. First, baselines of a *beta* palette make the sign-off arrive as a wall of expected
  red diffs — which is how a team learns to `--update-snapshots` past its own gate, and a
  gate people walk past catches nothing. Second, the skin is React state with no URL param
  on purpose (see *Decisions*), so making the shot drivable by adding `?skin=tajweed` would
  ship a shareable link that switches a beta annotation layer on for a reader who never saw
  the badge — reopening by the back door the thing the badge exists to prevent. The axis is
  left in place as a documented seam: adding the row regenerates the matrix under new
  filenames and invalidates zero existing baselines.
- **A real concordance table** → whenever a second edition is vendored. The seam is code
  today, with an empty table and a fixture proving it.
- **`--ink-faint` contrast sweep** — it fails 4.5:1 wherever it carries text. Automated axe
  passes because it does not traverse every surface; tracked as its own follow-up.
- **GPL corresponding source reachable from the deployed app** — required before the first
  public deploy, not before the next loop.

## Check it on your phone

```bash
make phone     # build + serve on your LAN; prints the URL to open on a phone
```

1. **The skin.** Toggle plain⇄tajweed. The colours change and **nothing moves** — check a
   long ayah's edges against the page frame before and after. Open the legend with the skin
   *off* and confirm it still explains itself. The control should say "beta" in both states.
2. **Wayfinding.** Tap ⌖ (or press `/`). Jump by surah name, by juz, and by `2:255`. Try a
   surah that is not vendored — it must refuse honestly rather than land on a blank. Then
   arrow past the last vendored page and read the message.
3. **Offline, the real test.** Open page 7, let it settle, then turn on airplane mode and
   **reload**. The page must come back *and still be an instrument*: tap an ayah and the hop
   rail must open, which means the adjacency shard came out of the cache too.
4. **First run, on a small phone.** Clear site data and reload. You should see the coach
   strip and **no** storage banner underneath it. Dismiss the coach; the storage banner is
   then allowed to appear. If you ever see both at once, the fix regressed — that is the
   defect this loop's merge pass existed to catch.
