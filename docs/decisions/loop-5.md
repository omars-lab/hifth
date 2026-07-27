# Loop 5 — Highlight gesture + root lens

**Status:** complete (ayah granularity; word granularity waits on 4b as PLAN allows).
**Date:** 2026-07-25.
**Exit criterion (PLAN §Loop 5):** drag 2:47–2:48 → menu → merged hop list; root lens
nearest-page-first.
**Result:** hold-then-drag across two ayahs washes them amber and opens a menu whose hop
list is the **merged, deduped** union of both ayahs' edges in hifz order, each row naming
the ayah it came from; the ⬡ lens opens the corpus-wide root families for the selection,
nearest page first. `make ci` green (**82.6 KB gz** of 150), `make e2e` **40/40** on iPhone
WebKit + Android Chromium, core **145** unit tests, web **26**.

## What shipped

Press-and-hold on the page, drag across a couple of ayahs, and they light amber; lift, and
the menu opens with **one** list — 2:47's look-alikes and 2:48's, collapsed onto their
targets so the same hop never appears twice, ordered the way a hafiz would want them (same
page first). The address bar holds `#/hafs-kfqc/2:47-2:48`, so the range is shareable the
same way a single ayah always was. Tap the ⬡ in the trail bar and the **root lens** opens:
every root in the selected ayah, each with the other ayahs that share it, nearest page
first — 1,642 roots over all 6,236 ayahs.

- **`packages/core/gestures.ts`** — the intent classifier, DOM-free. `pointerIntent(sample)`
  is the pure rule table; `nextIntent(prev, sample)` latches a verdict for the stroke's
  life so a gesture can't change identity mid-drag. Thresholds are exported constants:
  `LONG_PRESS_MS = 350`, `TAP_SLOP_PX = 8`, `PINCH_POINTER_COUNT = 2`,
  `MARQUEE_MIN_SIZE = 0.5`. **27 tests** on the boundaries.
- **`packages/core/highlighter.ts`** — `rangeFromRect` (strict bbox intersection, then the
  contiguous run between endpoints), `keysInRect`, `highlightRange` (amber wash),
  `drawMarquee` (live dashed rect). All additive into `#hifth-overlay`; source geometry
  never touched. **15 → 32 tests.**
- **`packages/core/adjacency.ts`** — `mergeRangeEdges` + `Adjacency.hopsForRange`: union the
  range's active edges keyed `(type, target)`, drop edges pointing back inside the range,
  keep the richest edge **whole**, record contributing `sources[]`, sort by `orderForHifz`
  (now generic so merged edges survive the sort). **11 → 18 tests.**
- **`packages/core/roots.ts`** — the lens: `orderByPageDistance`, `groupByLemma`. Families
  order by nearest hop, then rarity, then codepoint. The reverse index doubles as the page
  table, so page distance needs no resolver. **15 tests.**
- **`packages/etl/scripts/build-roots.mjs`** — Quranic Arabic Corpus morphology → shards in
  both directions: `roots/<edition>/ayah/<surah>.json` (ayah → roots) and
  `root/<bucket>.json` (root → every ayah, LPT bin-packed into 32 buckets). Same in-script
  gates as 4a: key validity, per-shard gz budget, stable sorts. Registered in `make etl`,
  `make ci`, and the CI determinism step.
- **`apps/web`** — `PageStage` runs the classifier through @use-gesture and emits
  `onSelectRange(fromKey, toKey, keys)`; `HighlightMenu` and `RootLens` are modal dialogs
  with HopPopover's a11y contract (focus in, Tab trap, Escape, focus restore); `ShareSheet`
  gained a `variant` for ranges; `assets.ts` gained sibling root loaders next to `loadShard`.

## Decisions

- **Marquee arms at 350 ms, under the platform long-press** (iOS ~500, Android ~400). Pan
  latches on the *first pixel of movement*, so arming the marquee early costs pan nothing,
  while a longer hold makes highlighting feel stalled. `TAP_SLOP_PX = 8` is Android's own
  `ViewConfiguration` touch slop — the distance a finger wanders while a hand believes it is
  holding still. Two pointers always win as pinch, and a pinch that drops to one finger
  **stays** a pinch: the leftover finger is a zoom tail, not a new pan.
- **A merged edge keeps its winning record whole; it is not field-merged.** On a collision
  the richer edge (more of note/twin/root/ctx) wins outright. A `note` is prose written
  about *its* source ayah — splicing another ayah's note onto it would put words in the
  annotator's mouth. Instead every merged edge carries `sources[]`, so the row can say
  "من ٢:٤٧" and the trail bead records the ayah the leap actually left from.
- **A range's hop list excludes hops back into the range.** Word anchors are stripped before
  the containment test, so `2:122#w3` counts as `2:122`. Highlighting 2:47–2:48 should
  offer somewhere to *go*, not the other half of the selection.
- **The range link is the spec's form, and now actually round-trips** (see below).
- **QAC is the root source; the corpus's terms are honored in three places.** See the
  licensing section — this was the loop's real gate.
- **The rail's ⬡ chip and the ⬡ lens are different promises today.** The chip is curated
  `shared-root` edges (hand-verified, few); the lens is corpus-wide (1,642 roots). Same
  glyph, two meanings — **a Loop 6 decision**, deliberately not resolved here by quietly
  merging them.

## Bugs found in earlier loops (fixed here)

Three, each surfaced by an agent working *outside* the code it owned — the useful side
effect of running three implementations against one tree.

1. **Pan ended in a selection (Loop 1).** The Highlighter's `pointerup` listener fired
   `onSelect` on *any* release over a polygon, so finishing a pan selected an ayah. It sits
   below @use-gesture in the bubble path and can't be told after the fact to stay quiet, so
   it now measures its own press→release travel against `TAP_SLOP_PX`. Covered by e2e.
2. **The §7 range form did not parse (Loop 3).** `serializeState` emitted the compact
   `2:47-48` while `parseHash("…/2:47-2:48")` — the form written literally in the spec —
   returned `null`. Serialization and parsing were each *self*-consistent, which is exactly
   why Loop 3's round-trip property test could not see it. Serialize now emits the spec
   form, parse accepts both and normalizes, cross-surah endpoints are rejected.
3. **A page could mount twice (Loop 1).** `ensurePage` checked its map before the `await`,
   so a cold range deep-link (initial mount racing `navigateTo`'s) appended two `<svg>`s for
   page 7, both labelled `page-label-7` — a duplicated landmark for a screen reader, and the
   flake behind `range.spec`'s `.first()`. In-flight mounts are memoized now; the spec keeps
   `.first()` (several *different* pages are legitimately mounted) and gains a count
   assertion on the label, which is the thing that must be unique. 3× repeat: 24/24.

Also: `@use-gesture`'s `movement` has its own 3 px tap threshold already subtracted — right
for the pan transform (no jump on latch), wrong for the intent split, where it would have
silently shrunk the slop radius. The classifier reads raw `xy − initial`.

## Licensing — the loop's gate

The plan said "QAC is CC-BY-SA". **That was wrong.** The Quranic Arabic Corpus is
distributed under the **GNU General Public License plus its own terms of use**, verified
against the primary source: the file's own copyright block, byte-identical to the `<pre>`
block published on [corpus.quran.com/download](https://corpus.quran.com/download/), with
[corpus.quran.com/license.jsp](https://corpus.quran.com/license.jsp) serving unmodified
GPL v3. `SOURCES.md`'s pending bullet is struck through and corrected.

- **The terms contradict themselves and no primary source resolves it.** GPL §5 grants the
  right to modify and redistribute; the terms of use say "CHANGING IT IS NOT ALLOWED".
  **Mitigation, recorded rather than hidden:** satisfy *both* readings — the file is
  vendored **verbatim with its copyright block intact and never edited**, and
  `build-roots.mjs` derives the shipped shards from it at build time.
- **Three obligations, three places.** The terms require the source be named, linked, and
  its copyright notice "reproduced appropriately in all works derived from or containing
  substantial portion of this file". The shards are exactly such a work — every root↔ayah
  pair in the corpus — so: `SOURCES.md` + `PROVENANCE.md` in the repo, a `NOTICE.txt`
  emitted **beside the shards** (quoted verbatim from the source header so it cannot drift),
  and a visible credit + `© 2011 Kais Dukes · GNU GPL` on the root lens itself.
- **The file also carries a Tanzil CC BY-ND 3.0 notice** for the Arabic text it annotates.
  Our shards emit **no Quran text** — roots, lemmas, ayah numbers, pages only — so the ND
  term binds the vendored copy (kept verbatim), not the ETL output.
- **Pin:** `alstat/QuranTree.jl@d7a0fe9`, SHA-256 `a1d12923…5d8c46` (6,309,503 B). The
  official download is behind an e-mail form, so the mirror is used purely as a *pinnable
  byte carrier*; byte-identity was confirmed against a second mirror
  (`cltk/arabic_morphology_quranic-corpus@b5abd4d`) and the official zip.
- **Rejected:** `mustafa0x/quran-morphology` (no license, and it had *stripped the copyright
  block*), QUL morphology (no license stated, downloads login-gated), MASAQ (clean CC BY 4.0
  but no root/lemma columns), `Sheople3/data-quran` (BY-NC-ND, no roots).
- **Open question for the user — the GPL's reach.** Under a strict reading the derived
  shards are a GPL-covered derivative work, which would oblige us to offer them under GPL
  and ship their corresponding source (we do — the ETL and the pinned input are in the
  repo). The app *code* is not a derivative of the data and is unaffected. **The repo has no
  `LICENSE` file at all**, so nothing conflicts today, but choosing Hifth's own license is
  now a real decision rather than a deferred one. Flagged, not decided.

## Measured

| Metric | Value | Budget |
|---|---|---|
| Roots: segments → roots · lemmas · pairs | 128,219 → 1,642 · 4,644 · 44,431 | — |
| Ayah coverage | 6,236 / 6,236 (6,214 carry a root) | all |
| Largest root shard gz (`ayah/2.json`) | 10,838 B | <51,200 B |
| Roots determinism (2 runs, tree hash) | byte-identical | required |
| JS bundle | 82.6 KB gz | <150 KB |
| Core unit tests | 145 (10 files) | — |
| Web unit tests | 26 (3 files) | — |
| e2e | 40/40 (iPhone + Android) | all green |

## Deferred

- **Word granularity.** Shards are ayah-level; word anchors need Loop 4b's ligature corpus.
  When it lands the tuples gain word indices and the lens API grows a `span` — nothing else
  changes. The `?w=` link form has round-tripped since Loop 3.
- **⬡ chip vs ⬡ lens** — same glyph, two promises. Loop 6 decides whether they merge.
- **No visual cue during the 350 ms arming hold.** An "armed" pulse needs a timer in the
  stage; deliberately left out rather than half-built.
- **Golden-image visual regression** (PLAN follow-up ③ named it for Loop 5) — the amber wash
  and marquee are exactly the kind of geometry the DOM can't assert. Still owed; moves to
  Loop 6 alongside the skin work, which needs the same harness.
- **The 22 root-less ayahs** (particles/pronouns and the disconnected letters, e.g. 2:1)
  correctly show an empty lens rather than a hidden ⬡.

## Check it on your phone

```bash
make phone     # build + serve on your LAN; prints the URL to open on a phone
```

1. **The drag.** On page 7 (or 9/19), **press and hold** an ayah for a beat, then drag across
   its neighbour. Both wash amber and the menu opens: one merged list, each row tagged with
   the ayah it came from (`من ٢:٤٧`). Tap **شارك** to copy the range link — it should read
   `#/hafs-kfqc/2:47-2:48`. Then check the gesture split is honest: a **quick** drag pans,
   two fingers pinch, a **tap** still selects, and finishing a pan should *not* select
   anything (that was the Loop 1 bug).
2. **The lens.** Select an ayah and tap the **⬡** in the trail bar. Root families, nearest
   page first. Open 2:1 — the disconnected letters — and confirm it's honestly empty rather
   than mysteriously missing.
3. **The parallel-agent question, answered on hardware:** three agents wrote this loop
   simultaneously into one tree. If the drag, the menu, and the lens each feel like they
   came from the same app, the protocol held.
