# Loop 4b — Page corpus + streaming (all 604 pages)

**Status:** complete. **Date:** 2026-08-03.
**Exit criterion (PLAN §Loop 4b):** all 604 pages vendored and cross-checked against the QUL
V2 layout; every ayah navigable; first-page TTI < 2.5 s on mid-Android.
**Result:** **604/604 pages** ship, every one hash-checked against
`quranpedia/quran-svg@5fbcb1d4` on every CI run; the ayah→page table re-derives from the
shipped SVG and reproduces the Loop 4a file byte-for-byte; the manifest in front of the first
paint went **down**, from a three-page file to **1,333 bytes gzipped for the whole print**.

## What shipped

Every hop target now resolves. Before this loop a rail chip whose ayah lived outside pages
7/9/19 was surfaced-but-disabled — the app knew the edge and could not honour it. That was
the last structural reason the product was a demo.

- **`packages/etl/scripts/vendor-pages.mjs`** (new, network, manual) — fetches the pin,
  optimizes with svgo at the pinned version and config, applies the two declared `id`
  repairs, writes 604 SVGs and their hashes into `quran-svg.pin.json`.
- **`packages/etl/scripts/extract-pages.mjs`** (rewritten, offline, CI) — reads the *vendored*
  bytes and derives the manifest and the ayah→page table from them.
- **`scripts/gate-pages.mjs`** (new) — re-hashes all 604 vendored files against the pin,
  offline, on every run.
- **`packages/core/src/manifest.ts`** — the compact wire form and `expandManifest`.
- **`packages/core/src/mounted-set.ts`** — `retainPages`, `MOUNTED_PAGE_CAP`, `spreadBudget`:
  the DOM budget, which only became necessary once every hop target resolved.

## Decisions

- **Two scripts, not one, split on the network boundary.** `vendor-pages.mjs` touches the
  internet and is run by hand; `extract-pages.mjs` touches only bytes that are committed and
  runs in CI. The split is what lets CI assert something it otherwise could not: a
  `git diff --exit-code -- apps/web/public/assets` after re-extraction proves *the anchors we
  ship are re-derivable from the page bytes we ship*. One script spanning both would have made
  that check a network call, and a check that needs the network is a check that gets skipped.
- **The pipeline's self-test is Loop 0's own output.** The svgo config was not chosen by
  taste; it was recovered by search until it reproduced pages 7, 9 and 19 **byte-for-byte**
  as Loop 0 shipped them. That runs unconditionally before the other 601 are written. The
  three pages had come out of a design mock, so this also retired an unproven claim: the mock
  and the upstream repo are now known to be the same bytes rather than assumed to be.
- **The ayah→page table re-derived from different bytes and did not move.** Loop 4a built it
  from the corpus's per-page JSON; 4b rebuilds it from the polygons in the shipped SVG. Same
  6236 entries, no diff. That is the JSON metadata and the shipped geometry agreeing — a page
  whose polygons were dropped or renumbered in vendoring could not have passed.
- **The manifest's wire form is a compact ayah→page table, and it deleted a backlog item.**
  `backlog.md` ⑪ projected ~109 KB gz for 604 pages of `AssetManifest` and proposed sharding
  by juz. The projection was right about the old shape and wrong about the remedy: the compact
  form is **24,471 bytes raw, 1,333 gz, for the whole print**, so sharding would add thirty
  requests to save nothing. `expandManifest` rebuilds the full shape at load, and
  `compactManifest` *refuses* a corpus where an ayah spans two pages or an id is not its own
  verse — the compaction is only sound because those invariants hold, so it asserts them.
- **The mounted set got a ceiling and a cache in the same change** (`backlog.md` ③ ④). See
  those entries: capping without recency would have made the stage worse, and an unsplit cap
  would have let the desktop spread hold twice what a phone holds.
- **Two upstream `id` defects are repaired, and the repair is pinned to exactly two.** 19:3 on
  p305 and 75:5 on p577 carry path geometry in `id` where every other polygon carries
  `verse-<absolute ayah>`. A future pin that fixes them upstream fails the assertion loudly
  rather than drifting silently.
- **The corpus found a real defect, on the first turn it made possible.** Every page this
  build carried was odd, so every turn it could make was right-leaf → right-leaf, and the
  bound-edge inset `page-transition.md` §2.4 puts on `.stage` was — by luck of the inventory
  — correct for both pages of every cross-fade. Page 8 ends that: «no glyph moves while the
  page turns» failed by exactly one `--stage-pad`, the arriving verso painted at the recto's
  origin for the length of the fade and jumping 16 px when `data-leaf` flipped. §2.3 had
  flagged that the left-hand leaf was unreachable and that anything written for it could not
  be seen; the thing it could not see was one layer below the corner it was talking about.
  The inset now lives on each host as the difference from the stage's, which keeps §6's
  pointer arithmetic exactly as it was — the current page still sits at the layer's origin —
  and the fix is two CSS declarations. This is the argument for vendoring stated as a result
  rather than as a hope: a branch waiting for a corpus is a branch that corpus finds.
- **The asset decision point — word geometry — is a NO for this loop, on evidence.** PLAN
  §Loop 4b named the ligature corpus as a candidate for word-granular selection. The adopted
  corpus settles half of it immediately: `mushafs/hafs/kfqc/json/*` carries one polygon per
  *ayah* and nothing finer, so word granularity cannot come from the pages we now ship. The
  candidate ([MushafDatabase-Ligature-Based-SVG](https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG))
  does have per-ligature groups, 604 pages, KFGQPC Hafs, and a permissive licence — but its
  README does not say **which print**, and Loop 4a's finding makes that the whole question:
  V1/1405H and V2/1421H disagree on 36 pages, and adopting a V1-paginated corpus would
  silently invalidate `ayah-pages.json`, every edge's `dPage`, and every share link. Adopting
  it is a second corpus, not a layer. Carried as PLAN follow-up 13 with the test that decides
  it named there.

## Measured

| Metric | Value | Budget / prior |
|---|---|---|
| Pages vendored | 604 / 604 | 3 |
| Page SVG on disk | 91 MB (~158 KB mean) | — |
| Manifest, gzipped | 1,333 B — whole print | ⑪ projected ~109 KB |
| Loop 0 pages reproduced from the pin | 7, 9, 19 byte-for-byte | required |
| `ayah-pages.json` re-derived from SVG | no diff, 6236 entries | must reproduce |
| `id` repairs applied | exactly 2 (19:3 p305, 75:5 p577) | asserted |
| Mounted pages, worst case | `MOUNTED_PAGE_CAP` = 6 (4 + 2 on a spread) | was unbounded |
| **TTI, median of 5** | **2264 ms** (2262–2268) | exit criterion 2500 |
| TBT, median of 5 | 85 ms | was 0 |
| JS bundle | 109.9 KB gz (+1.2) | baseline accepted |

**The exit criterion, and the surprise in it.** *< 2.5 s TTI on mid-Android* was the number
this loop was gated on, and the honest expectation written in `backlog.md` ⑫ was that 604
pages would eat into a margin already measured as thin as 71 ms. It went the other way: 236 ms
of margin on the same laptop that produced the 71. More interesting than the median is the
*shape*. Nine pre-corpus runs of one unchanged build came out bimodal — 2279–2284 or
2429–2437, nothing between, a gap equal to `rttMs` to the millisecond. Five post-corpus runs
span **six milliseconds**. The compact manifest did not merely avoid ⑪'s projected 109 KB; it
took the request ahead of the largest paint off the edge of a round trip it had been sitting
on. What it cost is TBT: 0 → 85 ms, `expandManifest` rebuilding 6236 entries at load, and that
retires a sentence both ⑨ and `.lighthouserc.json` had been carrying — *nothing here is
compute-bound* — which was a fact about a three-page build wearing the clothes of an
architectural property.

## Deferred

- **Word granularity** — PLAN follow-up 13, above. Blocks external task #65 (word-level
  selection → refined mutashabihat search) and the word-granular roots/tajweed painting that
  Loops 5 and 6a left as ayah-fallback.
- **`MOUNTED_PAGE_CAP` is still a guess.** 6 came from the spec before anything was measured
  and this loop did not measure it either; what changed is that it is a named constant with a
  test instead of an absence. `backlog.md` ① ② own the measurement, and they are blocked on
  hardware.
- **Pin-a-juz packs** — Loop 6b, whose gate this loop was. It loses the "sharding the manifest
  is the same work" argument, since there is no manifest left to shard.
