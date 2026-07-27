# Loop 4a — Edge-data ETL (full mutashabihat corpus)

**Status:** complete. **Date:** 2026-07-25.
**Exit criterion (PLAN §Loop 4a):** deterministic full-corpus edge ETL — 100% valid keys,
every shard <50KB gz, byte-identical across runs — with the hop rail live on real data for
the 3 vendored pages.
**Result:** `pnpm etl` compiles **3,006 edges onto 1,522 ayahs across all 114 surah shards**
from the vendored Waqar144 mutashabihat dataset + the Loop-2 curated seed; two consecutive
runs hash byte-identical; the largest shard (2.json) is **2.4KB gzipped** against the 50KB
budget; all 26 Playwright e2e tests pass on both mobile engines with the rail running on
the real data.

## What shipped

Tap any ayah on the three vendored pages and the rail now shows its **real** mutashabihat —
e.g. 2:48 gains the dataset's 7:140 and 14:5 look-alikes alongside the curated 2:123 —
with un-vendored targets surfaced-but-disabled exactly as before (they enable themselves
page-by-page as 4b vendors the corpus).

- **`packages/core/quran-meta.ts`** — the Hafs/Kufan structural tables: `AYAH_COUNTS`
  (114 surahs summing to 6,236), `toAbsoluteAyah`/`fromAbsoluteAyah` (binary search),
  `JUZ_STARTS` + `juzOf` (Tanzil boundaries — juz divisions are print-independent text
  divisions, safe for any Madani edition). All range-checked and throwing; **8 tests**
  incl. a full 1..6236 round-trip sweep and a monotonic juz sweep.
- **`packages/etl/data/mutashabihat/`** — the [Waqar144 Quran_Mutashabihat_Data](https://github.com/Waqar144/Quran_Mutashabihat_Data)
  drop, pinned @ `f35f6d5` with SHA-256 + verbatim license in `PROVENANCE.md`. 1,344
  juz-keyed entries, 2,448 directed edges, absolute-ayah addressing.
- **`packages/etl/data/pages/ayah-pages.json`** — abs ayah → page (6,236 entries), derived
  from the quran-svg corpus's own per-page JSON @ `5fbcb1d`. Validated: every ayah on
  exactly one page, monotonic 1→604, matches the three vendored pages verbatim.
- **`packages/etl/scripts/build-adjacency.mjs`** — rewritten as the full ETL: dataset
  entries → member-granularity directed edges → curated-seed merge → symmetrize → dedupe →
  spec-§6 records with real `dir` (dPage from the page table, sameJuz from the juz table)
  → 114 shards (empty ones included so the app's loader never 404s). Gates run in-script:
  key validity (conversion throws), per-shard gz budget, deterministic stable sorts.
- **`apps/web`** — on-demand shard loading replaces the Loop-2 up-front `[2]`: shards live
  in React state (`Map<surah, shard>`), the `Adjacency` table is rebuilt per shard arrival,
  `ensureShard` fetches each surah at most once, and mounted pages' surahs are prefetched
  so chips appear the instant an ayah is tapped. `buildShards` is retired from the ETL
  path (kept in core as the curated-fixture reference compiler for tests).

## Decisions

- **The print pin (the loop's big finding):** the quran-svg corpus follows the
  **KFGQPC QCF V2 / 1421H print**, *not* V1/1405H (what Tanzil and quran.com default to).
  V1/V2 layouts diverge on **36 pages** (120–123, 144–145, 531–534, 564–600 region —
  juz-30-heavy, prime mutashabihat territory). Proven by word-count arithmetic against the
  two QUL layout DBs (details in `packages/etl/data/pages/PROVENANCE.md`). Consequence:
  the 4b anchor cross-check must use [QUL layout id 10 (V2/1421H)](https://qul.tarteel.ai/resources/mushaf-layout/10);
  V1-based ayah→page tables must never be used for this edition. Our `ayah-pages.json`
  sidesteps the issue by deriving from the corpus's own metadata.
- **Symmetrization is required, measured, and applied:** the dataset is only partially
  symmetric — 399 of 2,445 anchor pairs lacked a reverse; the ETL generated **476 reverse
  edges** (anchor-granularity) so the rail lights up from either end of every pair.
  Generated reverses copy note/twin/ctx/root (direction-neutral) but drop word anchors
  (they located words on the forward target only).
- **Multi-ayah ranges:** an edge attaches to *every* ayah of a source range (the rail
  works wherever you tap) and targets the *first* ayah of a target range (the hop lands at
  the range's start). 43 source ranges, 52 target ranges in the pin.
- **Curated seed wins on collision** (4 collisions merged): the Loop-2 hand-verified notes,
  twin flags, and root edges are richer than the dataset's bare pairs; `ctx` flags OR
  together. The dataset's `ctx: 2` maps to spec `ctx: true`.
- **Juz filing mismatches warn, never fail:** 9 dataset entries are filed under a
  neighboring juz key (author's organizational choice near boundaries); we recompute juz
  from Tanzil boundaries, so the filing is irrelevant to output.
- **QurSim stays demoted** (per the 2026-07-25 grounding pass): semantic relatedness, not
  lafẓi mutashabihat — reserved `related` edge type, not a 4a source.

## Measured

| Metric | Value | Budget |
|---|---|---|
| Directed edges in (dataset + curated) | 2,519 + 15 | — |
| Duplicates merged / reverses generated | 4 / 476 | — |
| Edges out / ayahs covered / shards | 3,006 / 1,522 / 114 | — |
| Largest shard gz (2.json) | 2,448 B | <51,200 B |
| Determinism (2 runs, tree hash) | byte-identical | required |
| JS bundle | 76.8 KB gz | <150 KB |
| e2e | 26/26 pass (iPhone + Android) | all green |

## Deferred

- **Hop-target enablement** — targets outside pages 7/9/19 stay disabled until 4b vendors
  the 604-page corpus (gated on follow-up ①, the on-device perf verdict).
- **QUL V2 cross-check of `ayah-pages.json`** — folded into 4b's anchor extraction, which
  re-derives the table and must reproduce it byte-identically.
- **Word-level spans on dataset edges** — the dataset is ayah-granularity; word anchors
  survive only on curated edges. Word granularity across the corpus needs 4b's ligature
  evaluation (PLAN §Loop 4b).
- **Hafiz data-QA** — the weekly 20-random-edges spot-audit against a printed mushaf
  starts when Loop 7 begins; the dataset's own provenance (Qari Idrees Al-Asim's work)
  is credited in SOURCES.md and will appear in the app's about surface.
