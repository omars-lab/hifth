# Loop 2 — The hop

**Status:** complete. **Date:** 2026-07-23.
**Exit criterion (PLAN §Loop 2):** tap 2:48 → rail → popover → hop to 2:123 cross-page →
bead back, one-handed on a phone.
**Result:** the full tour passes end-to-end on WebKit + Chromium touch engines (both mobile
viewports). The product exists here — Hifth now *navigates the graph*, not just the page.

## What shipped

Tap **2:48** on page 7 → a **hop rail** of direction chips (↻ same-surah look-alikes, ▶ later)
appears beside it → tap the ↻ chip → a **bottom-sheet popover** lists the hops nearest-first →
tap "hop to **2:123**" → the stage **mounts page 19, pans to the ayah, and pulses** it, while a
**subha bead** for 2:48 threads onto the footer trail and the origin keeps a dashed verdigris
breadcrumb → tap the bead to **rewind** to 2:48 (page 7 again), same code path as the forward hop.

- **`packages/core/adjacency.ts`** — the graph routing table (spec §5, §6, §9). Pure,
  framework-free, DOM-free. The **edge-type registry** (3 active: mutashabih/related-meaning/
  shared-root; 3 reserved: hadith/tafsir/lexicon — present so activation is a status flip, not a
  UI change). `bucketEdges` buckets a selection's active edges into rail chips by direction
  (↻◀▶⬡), `orderForHifz` ranks the popover nearest-first (same page → same juz → earlier →
  later). The `Adjacency` class answers `chipsForKey`/`hopsForKey` over loaded shards; a missing
  shard or ayah simply yields no chips (never throws). `buildShards` compiles the mock's compact
  curated table into canonical-key spec-§6 shards. **11 unit tests.**
- **`packages/core/view.ts`** — the pure pan/zoom transform math (spec §3), the highest-value
  hop seam. `frameBboxToView` (bbox → the `{x,y,z}` that centers it in the stage — the mock's
  `focus()` ported and asserted against known numbers), `bboxToScreen`, `easeInOutCubic`,
  `lerpView`, `clampZoom`. DOM-free so a wrong scale factor (the failure that lands an ayah
  off-screen) is caught by a unit test, not a device. **8 unit tests.**
- **`packages/etl/scripts/build-adjacency.mjs`** — compiles the mock's hand-verified `ADJ`
  clusters (surah 2) into `apps/web/public/assets/adj/hafs-kfqc/2.json` via core's `buildShards`.
  Deterministic (sorted keys → byte-identical output); wired into `make etl` and the CI
  determinism gate. Loop 4 swaps the *input* (full Waqar144/QUL ETL) — output format and the
  runtime are unchanged.
- **`apps/web` PageStage → multi-page host manager** — now holds one host div per mounted page
  and exposes `navigateTo(key)` via an imperative handle. The transform is **one `view` model**
  written by both gestures and the RAF hop-tween, so a finger-down mid-hop cancels the tween and
  cleanly takes over (no CSS-transition fighting the next gesture frame). Honors `--dur-hop` /
  reduced-motion (instant when 0). Evicts pages outside the DOM budget (current + the selection's
  vendored hop targets); the eviction predicate is the one-function seam Loop 4 swaps for LRU-6.
- **`apps/web` HopRail / HopPopover / TrailBeads** — the L3 signature furniture. Rail chips carry
  glyph + count and open their sheet; the popover lists hifz-ordered rows with note/twin/root, the
  ↪ leap solid-accent (disabled + honest note for un-vendored targets); the trail is a subha-bead
  string, the live bead amber ("you are here"), origins quiet verdigris, tap-to-rewind.
- **`apps/web` App** — owns the `Adjacency` instance, `trail` state, `hop`/`beadBack` handlers,
  and computes `mountedPages`. Forward hop and bead-back are the **same navigateTo path** (spec §7:
  no separate deep-link logic), so Loop 3's share-links reuse it unchanged.

## Measured

- **JS budget:** **61.9 KB gz** app bundle (**72.4 KB** with the workbox SW chunks). Budget
  150 KB — comfortably inside. The adjacency + view math + three components added ~negligible gz.
- **Adjacency shard:** surah 2 = 8 ayahs, 15 edges, well under the 50 KB-gz shard budget.
- **Tests:** core **40** (keys 5 + resolver 7 + highlighter 9 + **adjacency 11** + **view 8**),
  web **6** (incl. the rail-appears-on-select wiring), e2e **10** across both viewports —
  including the **full hop tour** (tap 2:48 → rail → popover → cross-page hop to 2:123 → bead
  back) and the **un-vendored-target degradation** case. Full clean-state `make ci` green, ETL
  determinism gate green (committed shard == fresh build).

## Decided

- **`navigateTo` owns the transform; PageStage owns page lifecycle.** The tricky part — animating
  a transition between two mounted pages — needs one owner of the `view` model or gestures and the
  tween fight. So the transform moved out of a per-page local ref into a single stage-level model
  written by both paths; the RAF tween cancels on any gesture frame. PageStage still owns fetch /
  mount / evict (L3's job); L2 owns the math (`frameBboxToView`).
- **RAF tween, not CSS transition or WAAPI.** A CSS `transition: transform` would keep
  interpolating toward a stale target while the finger moves; `transitionend` is unreliable when
  interrupted. A RAF tween writes through the *same* `applyTransform` as gestures — interruption is
  just "stop the loop and let the gesture take over," zero style-property contention.
- **"Adjacent" = the selection's vendored hop targets, not page ±1.** The DOM budget should
  prefetch *where the user can actually hop*; Loop 2's hop is a 12-page jump (p7→p19) that a
  prev/next rule would never mount. So `mountedPages` = current + resolvable edge targets.
- **Un-vendored hop targets: surfaced but disabled, never a ghost page (Plan Q6).** The rail/
  popover still *shows* the link and its note (surfacing links is the product), but the leap is
  greyed with an honest "‏هذه الصفحة غير متوفّرة بعد‎" — panning to an empty placeholder is a
  worse experience than staying oriented. `navigateTo` no-ops on an unresolvable key regardless,
  so it degrades without throwing. (In Loop 2 only p7/p9/p19 are vendored; 82:19, 7:161 etc. are
  the disabled cases.)
- **The breadcrumb (on-page) and the bead (chrome) are two renderings of one `trail` array.**
  App is the single writer — it pushes to `trail` and calls `hl.highlight(...,"breadcrumb")`
  together, so they never drift. The breadcrumb survives the hop because the origin page stays
  mounted.

## Deferred — with where they land

- **Wheel-zoom on desktop** — trivial; folded into Loop 3 stage polish (mobile is the acceptance
  device, so it wasn't on the Loop 2 exit path).
- **Page-turn swipe gesture** — the RTL convention is pinned (loop-1.md: drag left→right = next);
  the swipe *implementation* competes with pan-intent thresholds and lands with the gesture work in
  **Loop 3/5**. Loop 2 navigates by hop, not by swipe.
- **DiffView (2:48 vs 2:123 = شفاعة/عدل swap), share/deep-link grammar, keyboard hop path,
  VoiceOver/TalkBack on the rail** — all **Loop 3** (diffs + share + a11y). The popover shows the
  edge *note* today; the token-level diff view is Loop 3.
- **LRU-6 page eviction** — Loop 2 keeps the tiny current+targets set; the predicate swap to an
  insertion-ordered LRU of 6 is **Loop 4** (full-corpus streaming), a one-function edit.
- **On-device perf verdict (still open from Loop 1, task #24)** — unchanged; the hop is a GPU
  composite of already-rasterized layers, so it doesn't move the verdict. Still gates Loop 4.

## Check it on your phone

```bash
make phone     # build + serve on your LAN; prints the URL to open on a phone
```

Open the printed `http://<your-mac-LAN-IP>:4173` on your phone (same Wi-Fi). One-handed:
**tap 2:48** (page 7) — it fills amber and a **hop rail** (↻ ▶) appears at the top-start corner;
**tap the ↻ chip** → a sheet lists the look-alikes nearest-first; **tap "hop to البقرة · ٢:١٢٣"**
→ the page slides to **page 19**, pans to 2:123, and it **pulses**; a **bead** for 2:48 is now on
the footer trail. **Tap that bead** → you rewind to 2:48 on page 7. Try the **▶ chip** too: its
82:19 row is shown but its leap is greyed with "غير متوفّرة بعد" — that page isn't vendored yet,
and we don't pan to a ghost.
