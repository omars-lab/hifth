# Hifth (حفظ) — Implementation Plan

**App identity.** Hifth is a pure navigation instrument for huffaz. Select or highlight an
ayah on a real mushaf SVG page → see typed hop links (similar verses, shared roots, later
hadith/tafsir) → jump. The knowledge graph is the routing table; the page is the
interface. No reader features (audio, translation, tafsir reading). *(Design-phase codename
was "Linker · رابط"; the app is Hifth everywhere.)*

**Platform.** Web app first, mobile-first: touch as the primary input, RTL-native layout,
installable PWA with offline page caching, fully static (no backend). Native iOS/Android
are a gated later track (Capacitor wrap of the same web build), not a v1 concern.

**Source documents** (in `docs/reference/`, kept verbatim for provenance):
- `linker-spec.md` — spec v0.9, the **contract of record**: key grammar, layer contract,
  highlighter API, adjacency shapes, URL grammar, ETL, phases.
- `linker-mock.html` — working mock on 3 real Madani pages (Hafs/KFQC, quranpedia corpus).
- `linker-architecture.html` — sources → ETL → static data → runtime diagram.
- `linker-delivery-plan.md` — the design conversation's week-numbered delivery plan
  (web + iOS tracks); its milestones, budgets, and UX furniture are folded into the loops
  below.

**Research** (`docs/research/2026-07-20-mobile-svg-pwa.md`): a verified deep-research pass
whose findings became the binding design rules in §4. **Re-grounded 2026-07-25** with live
source checks (data sources, licenses, storage policy, Safari status) — links inline in §4
and §7 Loop 4; the strategy change it produced is the Loop 4a/4b split below.

---

## Status & tracking

This section is the **roadmap of record** — it replaces the retired external task tracker;
statuses, gates, and open follow-ups live here and nowhere else. Convention: **every loop
ends by updating this section and writing `docs/decisions/loop-<N>.md`.**

One deliberate exception, and it is a narrow one: [`backlog.md`](backlog.md) holds
optimization work that is **not yet scheduled into a loop** — the on-device perf verdict and
what it decides, the mounting and prefetch bounds Loop 4b will need, the asset weight nothing
currently gates. Nothing there has a loop or a gate; the moment an item acquires one it moves
into this section and the backlog row is deleted rather than mirrored, so no item is ever
described in both files.

| Loop | Status | Exit criterion (short) | Record |
|---|---|---|---|
| 0 — Skeleton | complete | Installable RTL shell showing page 7; CI green with gates | [loop-0.md](decisions/loop-0.md) |
| 1 — Select + perf | complete-with-deferral | Tap-to-select on-device; RTL page-turn decided; perf verdict → follow-up ① | [loop-1.md](decisions/loop-1.md) |
| 2 — The hop | complete | Tap 2:48 → rail → popover → cross-page hop → bead back, one-handed | [loop-2.md](decisions/loop-2.md) |
| 3 — Diffs, share, a11y | complete | Teacher link cold-open restores exact view; screen reader announces hops | [loop-3.md](decisions/loop-3.md) |
| 4a — Edge-data ETL | complete | Deterministic full-corpus edge ETL; 100% valid keys; shards <50KB gz | [loop-4a.md](decisions/loop-4a.md) |
| 4b — Page corpus + streaming | complete | All 604 pages vendored + QUL-checked; every ayah navigable; TTI <2.5s mid-Android | [loop-4b.md](decisions/loop-4b.md) |
| 5 — Highlight + roots | complete (a word run now *searches*, and says how many places it is about — word-D, 2026-08-05; the segmentation blocker ⑬ named is measured and mapped, and ⑮'s keyboard path is in) | Drag-range → merged hop list; root lens nearest-page-first | [loop-5.md](decisions/loop-5.md), [word-selection.md](decisions/word-selection.md), [word-search.md](decisions/word-search.md) |
| 6a — Skin, editions, wayfinding | complete | Instant plain⇄tajweed toggle (identical geometry); jump anywhere; visited pages survive offline; Lighthouse ≥90 | [loop-6a.md](decisions/loop-6a.md) |
| 6b — Pin-a-juz packs | complete-with-deferral (the 8-day half is a user check) | Airplane-mode revision of a pinned juz works after 8+ days | [loop-6b.md](decisions/loop-6b.md) |
| 7 — Polish + beta | in flight — its four engineering items are all in (popover ordering, keyboard map, shard prefetch, the 5-page golden sweep, 2026-08-07); what remains is not a loop but a person | Hafiz revision session, zero friction notes → **web v1.0** | — |
| Track B — Capacitor | gated on web v1.0 | Same web build wrapped for iOS/Android; Universal Links | — |

### Desktop UI triage — a running thread under Loop 7 (opened 2026-09-01)

A hafiz using the desktop spread reported a run of paper-cuts and asked for a few new
surfaces. These are being worked as a **task list** (the session-tracked kind, the one the
"track the task files" commit made survive a clean open), not as loop items, because each is
small and none blocks web v1.0. The task list is the working copy; **this section is the one
that survives a session**, so when the two disagree, bring this one current. An audit on
2026-09-01 found it two defects stale and eight asks short, which is how this paragraph came
to be written.

**What this thread is for.** Every paper-cut a hafiz meets on the desktop spread gets fixed
with a guard, and the *class* of defect behind it gets a tool, so the next one of its kind is
caught before a reader meets it. The thread is done when the open list below is empty or
every remaining item is waiting on a decision the owner has been asked for. Its state lives
in three places: this section (the record), the session task list (the working copy) and
`docs/tasks.md` (the rendered page, which the gate keeps current).

**Done, each with its guard** (all 2026-09-01):

- **Zoom the open book.** The magnify buttons work with two pages showing and grow both
  leaves together, from the fold outward, so the middle gap is kept and a modest step clips
  nothing. It reverses an earlier "disabled while open" finding, on the reader's own call.
  Record: [`spread-zoom.md`](decisions/spread-zoom.md); the reversal is noted on
  [`wheel-and-zoom.md`](decisions/wheel-and-zoom.md).
- **Turn a leaf by grabbing its outer fore-edge** (a hand cursor on a rail that widens at the
  corners); a drag across the middle pans and selects, never turns. `b90b450`.
- **The two leaves stay level** after a juz jump (`b90b450`) and after a turn (`ba436e6`).
  Two fixes of one rule at two of its four sites — the rule now has one home, below.
- **One home for "the leaves land level and centred."** Every road onto a page — a cold
  open, a deep link, a hop, a turn's landing — now ends in one settle step in the stage,
  where four had each copied its three lines by hand; the fifth copy, hidden inside the
  fade under a turn's band, was found by looking for the other four. Two guards: a unit
  test that counts the sites and refuses a new road that centres by hand, and a desktop
  e2e that drives eight roads (cold open, deep link, page bar, turn, juz jump, zoom step,
  closing and reopening the book, a resize across the breakpoint) through one measurement.
  *A finding on the way:* that e2e first failed the reopen road by 313 px — a frame in
  which both leaves still wear their one-leaf transforms when an animation-frame callback
  measures them, and which the resize observer corrects before it is painted. A reader never
  sees it, so the rig reads after paint; the two older guards read inside the frame and
  pass only because their roads happen to settle earlier. `0035a4d`.
- **A turned leaf moves the address** in the URL bar, as a jump already did. `c1d702c`.
- **Ayah boxes drawn wrong.** 2:249's six-line middle inked as one slab, and 10:44 dropped
  to the coarse fallback because the print rounds to a tenth — with **110 other boxes**
  silently on the same fallback. `b2ffce3`. Nothing yet sweeps the book for the next one;
  see the follow-ups.
- **The revision map**: a number on every cell, "not in this build" keyed only when a cell in
  fact is, a date a person would write, and a picker for all time / last month / this month.
  `7d4402e` `631278b` `0ab9619` `ae8d01d`.
- **Zoom on the spread grew one leaf and left the other.** A fault of the dev server's
  double-mount only — the built app never had it — but the dev server is what a developer
  previews in. Fixed and guarded. `ff81f8e`.
- **The page bar redrawn**: thirty green detents, one per juz; a page-icon handle over the
  native slider (kept for its keyboard and screen-reader contract); a popover that names
  page · juz · surah while dragging. With seven tests, `3a9396a`.
  Two calls were made without a record — whether a detent is a landmark or a magnet, and
  which juz a boundary page belongs to — and a decision is owed for the pair.
- **The ayah's options rise over the facing leaf.** On a spread, each of the three sheets an
  ayah can raise — the hop list, the highlighted passage's menu, the root lens — lands over
  the leaf the ayah is *not* on, in either chrome language; a phone keeps its bottom sheet
  and a book closed to one leaf keeps its corner card. Found by rendering rather than
  reading: the card followed the chrome's direction, so in English every ayah on the
  right-hand page raised its options over its own highlight, and the Arabic chrome hid the
  same defect on the left-hand page. Guard: four rows in
  [`desktop.spec.ts`](../apps/web/e2e/desktop.spec.ts) — the hop list and the passage menu
  each land opposite the ayah for either leaf in both languages, neither leaf moves when a
  sheet rises, and no side is named with one leaf or below the breakpoint. The rule is
  written up in [`desktop.md`](design/desktop.md) §5.

**Still open, worst-first:**

- **A desktop page turn that peels from the corner** — asked for, and **refused by the
  page-transition record** (§8 ①: a curl necessarily moves the glyphs, and it cannot draw
  the difference between a crease and a gap). The ask and the record conflict, and only the
  owner can settle it: reopen that record with a curl drawn that expresses all four fold
  states, or improve the turn inside the fold vocabulary it already has. **Blocked on that
  answer.** Interim: the grab plays the current flip on release.
- **A tafseer section** inside those options, with sourced text and its provenance checked.
  **Reopens a v1 non-goal (§10: tafsir reading), so it is a decision before it is code:**
  `docs/decisions/tafseer.md` puts the two questions — whether and where, then which text
  and how its provenance is shown — with every option drawn on page 7 at real size
  (`docs/design/tafseer-options.html`) and the sources found, with licences. Open, for the
  owner. The only openly licensed reviewed text found is Arabic al-Muyassar (Tafsir
  Center, CC BY 4.0); every English tafseer found reserves its rights.
- **Comment-style mistake marking.** Zoom in, click a letter, a harakah or a marker, and
  drop a note anchored to that glyph; colour by kind (a comment, a correction, a note to the
  developers); icons shown only past a zoom threshold; hover reveals the span. A drag across
  text must **select rather than turn the page**. Recorded as a two-question decision, each
  option drawn on page 7 at the zoom it would be used (`docs/design/mistake-marking-options.html`):
  first, what a note can pin to — nothing, a verse, a word or run, or a letter/mark, where the
  last reopens the settled choice to ship the page as anonymous shapes; second, which kinds
  there are and whether any leaves the phone. Open, for the owner: both questions reopen a
  position the project has already taken (finer-than-word geometry is built but unshipped; a
  private record does not leave the phone by reflex). The word-grain option inherits the
  already-built drag-selects-not-turns gesture.
- **Keeping marks and comments on the device, and exporting them in a batch** (a file, or
  email). Drawn as two questions, its own decision: how a batch leaves the phone — nothing
  leaves, a file the reader saves, an email they send, or cloud sync — and, since a note
  points at a *spot* and not a whole verse, what an export contains so it is legible without
  shipping the Qur'an — a plain list, a list with an outlined picture of each spot, or a
  portable annotation file. Sibling to the confusion map's own export decision, and
  conditional on the mistake-marking note layer existing at all.
- **A bookmark you drop by tapping the fold**, animating downward like a ribbon, and every
  bookmark action written to a calendar. Now drawn as a two-question decision — is a bookmark
  one ribbon that moves or many the reader drops and lifts, and where is it kept so tapping the
  fold still means something next week (the address only, the phone's durable store, or a store
  that can be carried off the phone). The gesture is drawn and not in question; what it persists,
  and how much, is. Sibling to the notes-export persistence decision.
- **An activity calendar in the menu bar** — a day's reading, interactions and pages counted —
  and, inside it, **managing bookmarks** (clear a surah's, clear all, with a guard on the
  destructive ones). This is the long-planned revision record reaching the chrome; the shape
  is sketched in [`.claude/plans/interaction-calendar.md`](../.claude/plans/interaction-calendar.md).
  Needs its own decision, and it touches the revision-privacy question.
- **A highlighter setting** — outline vs. filled, and how see-through the fill is. Now drawn as
  a two-question decision on real ayahs at reading size: whether a reader chooses the mark's
  *shape* (the marker swipe the app draws today, a translucent fill, or an outline — never a box
  around a whole multi-line run, which the per-line grammar already rules out), and whether a
  reader tunes its *strength* or it stays fixed. The picture makes the point a paragraph would
  hide — at the app's real strength a fill is much fainter than the swipe, which is why the swipe
  exists — so the two questions are coupled. Constrained by the settled per-line grammar; the
  strength control is the same idea the tajweed-colour decision already set aside once.

**What the thread taught, as follow-ups** — the pattern under the paper-cuts, filed so the
next one is caught by a tool:

- **One home for "the leaves land level and centred"** — done, above.
- **A whole-book sweep for ayah boxes** — done. Three box defects were each found by a
  reader on one page, and the fix for one uncovered 110 more nobody had reported. Now
  `pnpm gate:boxes` runs the app's own pen over all 6,236 boxes (12,350 rectangles) and holds
  the count of boxes it cannot draw as lines at 8, all on the decorated pages 1–2, and the
  count of rectangles off the page's line grid at 2 — as ceilings *and* floors, so a pen that
  starts accepting something is as visible as one that starts refusing. It also counts, but
  does not hold, the 582 rectangles that fuse several lines (up to 13) and the 99 one-word
  dots. `make box-sweep` draws every flagged box on its real page at twice print size in
  `docs/design/ayah-box-sweep.html`. The two off-grid boxes are a new class, filed as
  follow-up 17.
- **A recipe for seeing a change** — done: the `run-app` skill now says which server is which,
  that a hash-only navigation is not a reload, and to rebuild before e2e. Two sessions had
  lost turns to each.
- **The page-bar decisions** — record and page done, and public on the site since the merge. Two open rows in the
  decision register, *juz-detents* (does a marker pull the release onto it) and *boundary-juz*
  (which juz a page carrying a seam is in), one record `docs/decisions/page-bar.md`, one drawn
  page `docs/design/page-bar-options.html` rebuilt by `scripts/build-page-bar-options.mjs`
  from the manifest and the bar's own stylesheet. The bar is 1.34 px a page on a laptop and
  0.4 px on a phone; four pages (62, 121, 201, 502) carry a juz seam, and on those the bar's
  bubble and the pack shelf already name different juz. The page's address is its own on
  the site, so the decision gate is green and the two rows wait only on the owner's answers.
- **The goldens were stale before this thread touched them.** Verifying the settle step ran
  the whole Chromium suite, and twelve phone goldens failed — all of them at a clean checkout
  of the branch head, and all of them since `b90b450`, the commit that made a hop land the
  leaves level. That fix reaching the phone framing, one pixel lower; the owner looked at
  the diff, accepted it, and darwin and linux were re-baselined together in `75db3cd`.
  Follow-up 16 under §Open follow-ups, closed.
- **A register went stale at a commit and nothing said so until now.** The use-cases page
  had not been re-rendered since `b90b450`; its gate failed at a clean checkout of the branch
  head, so that commit shipped with the gate red. Re-rendered (only line-number pointers had
  moved). The commit had edited `docs/use-cases.json` itself, and the pre-commit hook let it
  through: the hook ran the use-cases gate *scoped to the staged files*, which asks whether
  each pointer still resolves and never whether the page was re-rendered. Fixed in the hook,
  which now runs the use-cases, issues and tasks stale checks unscoped on every commit (three
  hash comparisons, under a second) and names `make render-docs`, a new target that rebuilds
  all four generated pages. The decisions README was already covered, since its hash depends
  only on its register. Not a new Claude-side hook: the failure was at the commit, and that
  is where the numbers freeze.
- **The bundle grew 2.2 KB and the baseline now says so.** The bar redesign and the settle
  step together moved the main bundle from 117.9 to 120.1 KB gzipped, past the 1 KB the
  budget gate absorbs quietly; 29.9 KB of headroom remains. The baseline was re-recorded
  so the number lands in the diff a reviewer reads.

- **The adjacency tree now names its third parent.** 510 of 3,002 shipped pairings carry a
  same-juz flag computed from the core package's juz table, which is Tanzil's structural
  metadata under CC BY, and neither the licensing map's row nor the shipped notice said so
  (what-we-depend-on ③). Named by hand in the notices gate's declaration, so the row and the
  notice must both carry "Tanzil" or the gate fails; the adjacency builder writes a paragraph
  into the notice, and a rebuild changed only that notice. The half still open is whether the
  trace should follow imports into core, now a question rather than a defect.

- **The licensing map is organised by door.** Three tables — repository, deployed site, store
  — each row saying what goes out, through which, under whose terms, with the measured numbers
  from the distribution audit (what-we-distribute ①, answered). Rows keep the shape the notices
  gate parses, and every gate that reads the file is green. Answered, not fixed: nothing checks
  that the tables stay sorted by door.

- **Every design is public, on the site — a tenet now, 2026-09-01.** Asked whether there was
  an admin page to put the designs on instead of publishing copies to another host, and the
  owner's answer was that all of them should be public-facing, for transparency, and that this
  should be a tenet of the repo. So: the web build now stages every page under `docs/` onto the
  site at the same path, with a generated front door at `/docs/` and a link to it from the
  colophon; the decision gate derives each decision's public address from its path and refuses
  any other; the eight decision rows with a page now carry the site address, and the records
  link it (earlier other-host copies stay named as copies); the tenet is in `CLAUDE.md` and the
  decide skill follows it. The page-bar page is therefore published by merging, and the
  decisions gate is green without anything being put on another host.

**Landed on main 2026-09-01** as the squash of PR #88, `243b37e`, after the owner accepted
the post-hop framing and the goldens were re-baselined on both platforms: the page bar
redesign and its seven tests; the settle step, its unit test and the every-road e2e; the
`run-app` recipe; the box sweep (its library, gate, page builder, the drawn page and its
wiring into the gates, the Makefile, CI and the map); follow-ups 16 and 17 and their index
rows; the page-bar decision record, its drawn page, its builder and its two register rows;
the re-rendered use-cases page; the bundle baseline; the by-door `LICENSES.md`, the adjacency notice and
builder, the notices gate declaration, the two design-doc markers with their index rows; the
public-designs tenet (the staging step and the site module, the build and CI wiring, the
service-worker denylist, the derived decision addresses in the gate, the eight register rows
and their records, the colophon link and its strings, the `CLAUDE.md` section, the decide
skill, the map and artifact-register notes); this section and the tasks page it re-renders.

### Open follow-ups

Each of these is indexed in [`issues.json`](issues.json) alongside the design docs' open
questions, `backlog.md` and the validation ledger, and `make issues` prints all four
registers in one list. They are indexed by *number only*: unlike every other register, a
follow-up here carries no status marker, because these are compound narratives whose job is
to record how a thing was believed over time — ② keeps its own retracted licence claim beside
the correction, ⑩ carries three successive re-measurements — and a single word cannot stand
in for that. `pnpm gate:issues` checks the number still exists and reads no further.

1. **On-device perf verdict** (formerly external-tracker task #24) — decide
   inline-SVG-everywhere vs content-visibility virtualization vs raster-glyph fallback.
   The emulated baseline (~8.3 ms/frame, flat under CPU throttle) cannot see the real
   risks: initial raster of a 170 KB inline SVG on a low-end phone, and re-raster on zoom
   past the layer's backing store. **To run it: `make validate CHECK=perf-verdict-on-device`**
   — the phone measures itself, no cable and no DevTools. The old recipe (pair over USB,
   enable Web Inspector, find the timeline) is a fair description of why this sat open for
   six loops: a check that expensive to run is a check that does not get run. The probe
   ([`src/perf/probe.ts`](../apps/web/src/perf/probe.ts)) is behind a build-time flag and
   never enters a shipped bundle. **Gates Loop 4b only**
   (page vendoring + streaming — the rendering-scale decision). Loop 4a (edge data) is
   pure data work, orthogonal to the rendering verdict, and proceeds ungated; Loop 6
   inherits the gate through 4b.
2. ~~**License confirmation**~~ — **substantially closed 2026-07-26**, and it caught a
   live defect. The overlay half is now read at the source rather than summarised:
   quran-svg's own contributions are **CC0 1.0**, which is the half the resolver depends
   on and it carries no obligation at all. The Complex's terms are read from that repo's
   [`NOTICE.md`](https://github.com/quranpedia/quran-svg/blob/main/NOTICE.md), which
   quotes them verbatim and cites Royal Decrees 136/8 and 9/B/46356 — the restriction is
   on **printing physical masahif for commercial sale**, not on digital or commercial use.
   The primary-source glance at [qurancomplex.gov.sa](https://qurancomplex.gov.sa) is
   still owed and still trivial: the origin refused connections from this environment
   (`ECONNREFUSED`, both `/en/` and `/en/terms/`) and the Wayback mirror is not fetchable
   here, so it needs an ordinary browser — `make validate CHECK=kfgqpc-terms-primary-source`.
   Nothing in the build depends on the answer.
   **The defect:** the colophon shipped in `74d5226` told every reader the mushaf pages
   were "إتاحة حرّة للاستعمال غير التجاري" — *non-commercial use only*. That is the
   **Libyan Endowments** edition's term, carried over to an edition we do not vendor; it
   claimed a restriction on the artwork that its publisher does not impose. Corrected in
   [`Colophon.tsx`](../apps/web/src/components/Colophon.tsx) and
   [`SOURCES.md`](../SOURCES.md). Worth naming as a pattern: a licence *summary* written
   into user-facing copy is a claim about someone else's terms, and the failure mode is
   silent — a too-strict paraphrase reads as caution and nobody files a bug about it.
   **Still live, for a later loop:** the **Libyan Endowments** editions (Qālūn/Warsh)
   *are* non-commercial-only, and commercial use needs the Ministry's prior approval —
   so `EditionPicker` may not grow one of those rows on the strength of `hafs-kfqc`'s
   terms. Per-edition licence review, per the Loop 0 gate.
3. Loop-assigned deferrals (already scoped in their loop sections; details in the decision
   records): full corpus vendoring + QUL validation → **done, Loop 4b**;
   **word-granularity roots + `?w=` UI** and **word-granularity tajweed painting** — both
   said "after 4b", and 4b's answer is that the shipped corpus has no word geometry at all,
   so they move behind **follow-up 13** rather than behind a loop (the tajweed spans are
   still vendored verbatim, so that one stays a rendering change once geometry exists).
   13 is answered as of 2026-08-04 — the candidate corpus is our print — so what stands
   between here and both features is no longer a corpus hunt but registering its word boxes
   onto our page frame and vendoring the result;
   **and as of 2026-08-06 that registration is two loops behind us and this entry had not
   noticed.** The boxes shipped (word-B) and so did the alignment (word-D), so
   **word-granularity roots + `?w=` UI is done** — the param is documented in
   [`query-params.md`](query-params.md) and the run announces its own outcome. Word-granular
   **tajweed** painting is the half that is left, and its wall is not the one written above:
   the annotations are codepoint offsets into a Tanzil Uthmani text this repo does not hold
   and will not. That is its own row — [`word-indexing.md` ⑤](design/word-indexing.md) —
   because a deferral re-pointed four times is a register asking to be split, and the split
   is what made the remaining work visible instead of merely deferred. **⑤ is answered the
   same day it was split, and it answered against its own prediction:** it expected a third
   segmentation and got a build change. `pnpm probe:tajweed-words` reconstructs the Tanzil
   string from the print's own per-word `data-hafs` — nothing vendored, the no-text rule
   intact — under eight corrections: three **structural** ones the corpus states rather than
   guesses (basmala prefix, the print's split conjunction waw which it flags itself, pause
   marks the print numbers as words) and five **orthographic** ones found by bracketing each
   failing ayah between its last correct annotation and its first wrong one — a tatweel
   carrying a small high mark, «أٓ», the small high madda, the hamza below, and the sakta
   seen where it ends a word. It lands **99.86%** of a character oracle on the exact expected
   letter — over **all 60,057 annotations**, since every one of the source's eighteen rules
   now names its letters, and **93.65%** of that once each check is weighted by the chance it
   could have failed — with **83.31%** of annotations inside one print word and **16.69%**
   across two adjacent ones — the cross-word phonology, paintable as a range. What is left is
   an ordinary bake with a **ten-ayah exception list, every entry named** (three of them names
   the repo already carries in `lib/segmentation.mjs`), not a corpus hunt. `pnpm
   probe:encodings` ([encoding-inspector.md](design/encoding-inspector.md)) is the instrument
   those corrections were read off, and where a ninth would be. The beta label is unaffected
   either way, because it hangs on the palette, not the geometry; **hafiz
   sign-off on the tajweed skin → Loop 7** (the beta label stays until then). **Done:**
   golden-image visual regression, Lighthouse CI, and the **⬡ chip vs ⬡ lens** collision —
   all Loop 6a ([loop-6a.md](decisions/loop-6a.md)); marquee drag-select (Loop 5);
   per-polygon a11y labels + keyboard hop path (Loop 3); `navigateTo` animation (Loop 2).
4. **On-device VoiceOver/TalkBack pass** (Loop 3 exit named it; automated axe + the
   keyboard hop tour cover the machine-checkable floor, both green in CI). The manual
   screen-reader gesture walkthrough on a real iOS/Android device is the remaining
   confirmation — `make validate CHECK=screen-reader-walkthrough`, run alongside
   follow-up ① on the same phone, **before Loop 7**.
5. ~~**Hifth's own license**~~ — **DECIDED 2026-07-25: GPL-3.0-or-later.** Opened by Loop 5,
   which vendored the [Quranic Arabic Corpus](https://corpus.quran.com/download/) morphology
   (**GPL + its own terms of use** — *not* CC-BY-SA, as this plan previously said; corrected
   in `SOURCES.md` and [loop-5.md](decisions/loop-5.md)) and so made the derived root shards
   a GPL-covered derivative work under a strict reading. The stated goal was that
   improvements come back, so: copyleft. **The plain GPL, not the AGPL** — a fully static,
   backend-free PWA hands the browser its whole bundle, so a modified deployment already
   *conveys* the code and owes its users source; §13 closes a network-service hole this
   architecture does not have. Licensing our code GPL also collapses the code/data seam, so
   the story is "GPL, except vendored assets under their own terms". Shipped as `LICENSE`
   (canonical gnu.org text, SHA-256 `3972dc97…b36986`) plus
   [`LICENSES.md`](../LICENSES.md), the per-path map.
   ~~**One live obligation, earlier than "public beta":**~~ — **discharged in the app**
   (`74d5226`). Publishing the site *is* distribution: a static app hands the browser real
   copies of `assets/roots/**`, so §6 owes whoever loads the page the Corresponding Source
   **for that build**. The commit is resolved at build time (`CF_PAGES_COMMIT_SHA` →
   `GITHUB_SHA` → `git rev-parse HEAD` → `"dev"`) and baked in through
   [`vite.config.ts`](../apps/web/vite.config.ts) →
   [`src/provenance.ts`](../apps/web/src/provenance.ts), so the link points at *that tree*
   rather than at a branch that moves under the reader; with no commit to name it degrades
   to the repository root instead of minting a link to nothing. It surfaces in
   [`Colophon.tsx`](../apps/web/src/components/Colophon.tsx), opened from the wordmark —
   the chrome already carries ⌖, ▤, the skin switch and its legend, and a fifth
   control would cost stage height on a phone. The same sheet finally pays the three
   attributions the vendored data has been owed since Loop 4a (corpus.quran.com's mandatory
   link, quran-tajweed's CC BY, the mutashabihat licence's "mention in your app"), which is
   the surface `SOURCES.md` has been promising.
   ~~**Still true, and now the only thing standing between us and the deploy:**~~ —
   **discharged 2026-07-29.** The offer is only real if `SOURCE_REPO` resolves, and it did
   not: the repository was private, so the colophon named an address that 404s to everyone
   who is not us. **The repository is now public**, which was one of the two ways out —
   repointing that one constant at wherever the source is actually served was the other, and
   nothing else in the code changes either way. Followed anonymously, the repo root, the
   exact build tree and all four attribution links now resolve; recorded in the ledger with
   `make record`. **The deploy is no longer blocked on licence grounds.**
   **`make source-offer` answers this in seconds** — it follows the offer with no `gh`, no
   token and no credentials, deliberately, because signed in as ourselves a private repo
   looks exactly like a public one and the check would have passed every day it was wrong.
   That is the shape of the whole obligation: it can only be tested by ceasing to be
   privileged. `make source-offer URL=<deployed>` additionally reads `SOURCE_REPO` and the
   build's commit out of the deployed bundle, so it checks what a reader is handed rather than
   what the branch declares. The half a machine cannot do — that a reader can *reach* the offer
   from inside the running app — stays at `make validate CHECK=source-offer-resolves`.
6. ~~**`--ink-faint` contrast sweep**~~ — **closed** (`68746bf`). The token was redefined
   `#9c9284` → `#6b6255`, clearing 4.5:1 on all four surfaces it lands on; fixing it at the
   token rather than across 23 call sites, since every one of them is a `color:`.
   The sweep is not by hand and not axe: `e2e/contrast.spec.ts` opens **fifteen** surfaces and
   measures each with `e2e/contrast.ts` (WCAG luminance, compositing semi-transparent layers
   to find the colour actually behind the text). Axe could not do this job — it filed most of
   this app's chrome under `incomplete` as `nonBmp` (every glyph control) or
   `shortTextContent` (every hop count), and `incomplete` never fails a build. **Any new
   sheet or popover needs a row in `SURFACES` or nothing is checking it.**
   Three of those fifteen are the field itself (`?field=`), which needed the instrument
   taught to read a *gradient* first: a wash was returning `unmeasured` and so the app's
   largest surface was its least checked one. It now measures every stop of the ramp, which
   measures every pixel of it — sRGB interpolation is per-channel linear and luminance is
   monotone per channel, so the extremes of the ramp are its stops. That upgrade caught the
   reference mus'haf's own field carrying `--ink-soft` at 2.39:1, and produced the rule the
   remaining fields ship under: **a field is a wash *and* the ink that survives it.**
   Five candidates shipped behind the parameter to close `page-transition.md` §7 ④; `tan`
   won, `dark` stayed as a night desk, and the rest were removed — which is why this count
   went eleven → eighteen → fifteen in two commits.
7. **The merge pass is a step, not a formality.** Loop 6a ran three agents into one tree and
   the protocol held — no lost edits, no rebase — but the defect it produced was *semantic*
   and existed only once both halves were mounted (two in-flow chrome strips, each correct
   alone, together eating a third of a phone's stage). Composition defects are invisible
   until the whole product runs at once, so **every parallel loop budgets a merge pass with
   its own `make ci` + `make e2e` on the merged tree** before the decision record is written.
   See [loop-6a.md](decisions/loop-6a.md) §The merge pass.
8. **The tajweed golden row** — the `SKINS` axis in `e2e/golden.spec.ts` is a live seam with
   one entry. Adding tajweed is gated on **two** preconditions, both of which must hold:
   the hafiz sign-off on the palette (or the gate's first firing is an expected wall of red
   that teaches everyone to `--update-snapshots` past it), and a **test-only** way to drive
   the skin — a production-readable `skin=` param would ship a shareable link that turns a
   beta annotation layer on for a reader who never saw the badge. Opened by Loop 6a;
   **after Loop 7's sign-off**. See [loop-6a.md](decisions/loop-6a.md) §Deferred.
9. **The revision record** (interaction calendar — per page, per juz, and now per hizb).
   Planned in [`.claude/plans/interaction-calendar.md`](../.claude/plans/interaction-calendar.md);
   three constraints decide its shape and none is a rendering question. Hizb used not to
   exist in this repo at all — not a constant, not a comment — and the obvious shortcut
   (half a juz) is wrong, because hizb boundaries are their own text division; a heatmap
   labelled «الحزب ١٢» over the wrong ayahs is #80's off-by-one wearing a new coat, and no
   test here would catch it. **That condition is now met**: `HIZB_STARTS` is sixty vendored
   `[surah, ayah]` pairs derived from every fourth `<quarter>` of the Tanzil metadata
   (`packages/etl/data/meta/quran-data.xml`, CC BY), `hizbOf` is exported beside `juzOf`,
   and `pnpm gate:quran-meta` re-derives all three tables from those bytes on every CI run
   so a mistyped digit fails the build. The measurement that made the shortcut refusable is
   pinned as a test: only **4 of 30** even hizbs land on their juz's arithmetic midpoint,
   and the worst misses by **39 ayahs**. **iOS ITP deletes script-writable storage after 7 days of no
   interaction** (see [`storage.ts`](../apps/web/src/storage.ts)) — which is precisely the
   history a "what have I not touched in weeks" view exists to report, deleted by the very
   condition it reports on; the record therefore carries a `since` stamp and says how young
   it is, because an emptied log rendered as a true one tells a hafiz they have revised
   nothing. And **a heatmap over three vendored pages of 604** draws a mostly-cold book, so
   the *picture* is **gated on Loop 4b** while the recording — a pure core module, an
   IndexedDB store, and a gate forbidding the log from being imported by anything that
   builds a URL — can ship now, since a day not recorded is a day that does not exist later.
   A log of when a person read Qur'an never leaves the device.
   **The recording shipped** (map feature [`revision-record`](map.json), gate
   `pnpm gate:revision-privacy`): [`revision.ts`](../packages/core/src/revision.ts) is pure
   and clockless, and each event carries the reader's UTC offset rather than taking one at
   read time — a single offset applied when the picture is drawn silently re-files every look
   recorded on the other side of a DST change or a flight. Two signals are wired and three are
   deliberately not: a tap that toggles a selection *off* means «dismiss», a hop arrival
   credits the ayah the corpus pointed at rather than the one the reader chose, and a share
   link was somebody else's choice — record all of those evenly and the result maps app usage,
   not revision, and the two diverge exactly where the record was meant to be useful. All
   three exclusions are asserted through the real UI in
   [`App.test.tsx`](../apps/web/src/App.test.tsx), because they hold by how `App.tsx` is wired
   and nothing else would notice them being rewired. What no test here can reach is a phone:
   ledger check `revision-record-lands-on-a-phone` covers the clock, the process killer and
   the seven-day sweep. The rule written here was that **#91 must not draw a picture until it
   has been run**, because the one unacceptable outcome is an emptied log rendered as a true
   one.

   **The picture shipped ahead of that check, and this is the argument.** The rule was
   protecting an invariant, not a schedule, and the invariant is now enforced in code and
   asserted where it can be: the sheet renders `since` on every open — empty record or not —
   so a log emptied by a sweep is visibly a *young* record rather than a year of revision
   that never happened, and [`revision.spec.ts`](../apps/web/e2e/revision.spec.ts) takes the
   record with the same CDP call the eviction specs use and proves the map still says how old
   it is afterwards. What the phone check still owns is the other half — whether an installed
   PWA on real hardware keeps the record across eight days at all — and no picture drawn in
   this repo can answer that. So the check stays open and stays blocking for
   Loop 6b; it no longer blocks the picture, because the failure it guards against
   is now a test rather than a promise. The map's second honesty problem is its own: 3 of 604
   pages are vendored, so **absent** — no paper in this build — is drawn as a different kind
   of thing from **cold**, no fill and a dashed hairline against sunk paper, and absent
   divisions are counted out of every total. Grey at lower opacity would tell a hafiz they had
   abandoned 99.5% of the Qur'an, which is false and entirely an artefact of the build. Design
   note: [`revision-record.md`](design/revision-record.md).

10. **The stage's coordinate model is doubled, and the page sits in a corner.** `holdAxis`
    returns an *absolute* top-left for an axis that fits
    ([`view.ts:76`](../packages/core/src/view.ts)) and `.layer` is `place-items: center`
    ([`PageStage.module.css:24-29`](../apps/web/src/components/PageStage.module.css)), so the
    centring offset lands twice: measured at 1440×900 the leaf is 245.8 px from the left of
    its layer and −0.2 from the right — flush against the spine of the spread — and at
    834×1194 it sits in the bottom-right corner of an otherwise empty field. This is the
    same defect `centerCurrent`'s own comment says was fixed in Loop 6a
    ([`PageStage.tsx:344-354`](../apps/web/src/components/PageStage.tsx)); the fix moved the
    arithmetic from the stage rect to the layer rect, which removed the padding term and not
    the centring term. It is invisible to CI for a structural reason worth keeping:
    `e2e/stage-fit.spec.ts` runs on the `iphone` and `android` projects only, and those are
    exactly the two viewports where the host is as wide as its layer and the doubling is
    zero. The same root cause makes part of the page unreachable below the fold (108.4 px at
    320×568, 271.9 px with the storage notice up) and makes `ctrl`+wheel zoom drift ~9 px
    horizontally and ~25 px vertically away from the pointer. **The first two faces are
    fixed** (§7 ①–②): `.layer` no longer centres and no longer grows past the stage, it
    places the host at its own physical top-left and does nothing else, and
    `e2e/stage-fit.spec.ts` now runs on `desktop` too with a 320×568 case that drags the foot
    of the page into view. Deleting the CSS centring was *not* the whole fix, which is the
    part worth carrying forward: the grid's default in a `dir="rtl"` subtree lays the host
    out flush to the **right**, so a physical `translate3d` moved it 240 px further right,
    and `place-items: center` had been masking that second mechanism all along. **Zoom's
    anchor (§7 ⑨) is now closed too**, and the prediction made when it was left open — that
    its vertical error would be the padding alone — was right to the pixel: −6.4 px on a
    1.0 → 1.4 zoom at 390 × 844, which is `16 × (k − 1)`. Two things only the re-measurement
    could show. The horizontal error is *structurally* zero, because
    [`page-transition.md`](design/page-transition.md) §2.4 drops the stage's padding on the
    leaf's bound side; and the whole defect is absent at 1440 × 900, because the spread
    neutralises `--stage-pad`. It was live on the acceptance device and gone on the one a
    developer looks at, which is the shape of every finding in this follow-up.
    Eleven findings, ordered by severity with reproductions and file:line, are in
    [`docs/design/page-turning.md` §7](design/page-turning.md); the presentation and gesture
    proposals in §3–§4 of that document are **not** scheduled here — they wait on
    follow-up ① and on a ceiling for the mounted set
    ([`docs/backlog.md`](backlog.md) §2). The hardening is independent of both.
    **The hardening is done.** Ten of the eleven are closed — ①② in `88cce9f`, ⑨ in
    `21f6380`, ③④⑤⑧ in `b1c24c2`, and ⑥⑦⑪ not by work aimed at them but as consequences of
    [`page-transition.md`](design/page-transition.md): the resting-edge system took the drop
    shadow away and gave the corner something to clip against (§2), and the fold gave reduced
    motion something to actually remove (§3–§4) — and the eleventh is
    ⑩, the mounted-set ceiling, which is not part of this follow-up but the thing §3–§4 were
    already said to be waiting on; it is indexed on its own and stays open. What holds the
    fix is [`apps/web/e2e/stage-fit.spec.ts`](../apps/web/e2e/stage-fit.spec.ts), which
    asserts both regimes on every axis — an axis the page *fits* must be centred, an axis it
    *overflows* must stay covered — and runs on `desktop` as well as the two phone projects,
    which is what the original defect needed and did not have.
    Re-measured at `89fe3dd`, at the two viewports this entry reproduced on. At 834 × 1194,
    where it recorded the leaf in the bottom-right corner of an otherwise empty field, the
    480.0 × 746.9 leaf now sits in an 818.0 × 912.4 layer with **169.0 px either side and
    82.7 / 82.8 top and bottom** — centred to a tenth of a pixel on both axes. At 1440 × 900
    the 245.8 / −0.2 asymmetry is gone for a second reason worth writing down: the layer no
    longer grows past its stage, so the leaf and its layer are both 406.7 px wide and the
    horizontal slack the offset used to be applied to twice is now *zero*. The defect could
    not recur there even if the arithmetic came back — which is exactly why the assertion
    that guards it runs at a viewport where the slack is real.

11. **A page turn should say what is between the two pages, and today it says nothing.**
    The transition effect — the leaf's edges at rest and the fold that crosses during a turn
    — is designed in [`docs/design/page-transition.md`](design/page-transition.md), measured
    against a reference mus'haf application at 430×932 CSS px. Two halves, sequenced apart.
    The **resting edge system** (§2) is what actually cures the floating leaf: no drop
    shadow, an asymmetric ≈20 px corner radius on the free side only, a 10 px fore-edge stack
    on the free side, the bound side bled off the screen, and a field the page is not.
    **Shipped.** `leafSideOf` in `packages/core` is the only thing that answers "which edge
    is free" — page parity, never a stylesheet's `:nth-child` or a logical property, since
    the free side flips with parity and logical properties flip with reading direction. Two
    corrections came out of building it and are recorded where they were claimed: `.host`
    **keeps** its `--paper-raised` background (the vendored SVGs have no background rect, so
    that fill is the paper, not a card — `page-turning.md` §3.1 ③ overreached), and **every
    golden baseline moved on both platforms**, which §6.4 had predicted would not happen —
    the new marks are outside the shot, but the shot's subject got 2 CSS px wider. One thing
    §2.4 describes is **not** done: on the desktop spread the leaf still floats ~150 px from
    the crease, because it fits its half and `holdAxis` centres what fits. Closing that gap
    means making core's centring rule conditional on being in a spread, which conflicts with
    the invariant that fixed the double-centring defect; it is tracked on its own. The
    **fold** (§3–§4) is **shipped too**. Its rule is the part worth reading: **a crease means
    the two pages face each other in the print, a gap means a leaf turned, sunk paper behind
    a dashed edge means the print has a leaf here and this build does not, and nothing at all
    means it was not a turn** — resolved by `foldBetween` in `packages/core` from `spreadOf`
    alone, never by parity in a stylesheet, so a correction to the print's pairing corrects
    every fold at once. That is not hypothetical: writing this document is what caught
    `spreadOf` pairing the wrong two leaves, and one line in `pages.ts` moved every spread at
    once. The predicate takes **no inventory parameter**, and the first draft's was the
    document's own worst idea: adjacency is a fact about the paper, and a predicate that
    could see what we vendored would be one array away from calling 7 | 9 a gap — the exact
    lie the section exists to prevent. With three non-adjacent pages vendored, **every turn
    in the shipped build is a hole and no crease can be drawn until Loop 4b** — which is the
    design working, not a limitation. One glyph never moves: the band is a third object
    crossing two stationary pages, asserted per frame in `page-turn.spec.ts`, and under
    `prefers-reduced-motion` it is not inserted at all rather than inserted-and-instant. Two
    things surfaced only because the turn got tests: a failed turn was naming the page still
    on screen rather than the one that failed, and on a desktop spread the band has to be
    portalled into the open book or it stops at the gutter. The visual half is the twin of
    follow-up ⑩'s §7 ④ (the turn is silent about the page it skipped) and they landed
    together. **Drag-to-turn** (§4) was held back to be designed on its own rather than as a
    detail of the visual half, and is now **shipped too**. `PointerIntent` has a `"turn"`
    verdict, and the whole safety argument is the *order* of the ladder: two pointers ⇒
    pinch, a completed 350 ms hold ⇒ marquee, and only then *sideways across a page that
    fits* ⇒ turn. Rules 1–2 keep absolute precedence, so **the marquee never paid for the
    turn** — a stroke cannot both hold for 350 ms and move before it. The slot the gesture
    spends is the one §4.1 measured: at fit-zoom a horizontal drag moves the page by zero,
    because `holdAxis` centres an axis that fits. `viewFitsAcross` asks that of **one axis
    only**, and that is not a shortcut — on a 390×844 phone the leaf overflows *vertically*
    at rest, so a two-axis predicate would report "does not fit" at fit-zoom and the gesture
    would be dead on the one device it was written for. Two numbers in it are **guesses and
    are labelled as such in the code**: the 2:1 axis ratio and the 25 % commit distance are
    §4.2–4.3's proposals, unmeasured there and unmeasured here (`page-transition.md` §7 ⑥
    already answered whether to reopen that: no). What the finger actually drags is **the
    fold** — the same single band the wheel turn already used, moved 1:1 with no easing — so
    §4.3's per-page `.leaf` wrapper stayed withdrawn and no glyph moves during a turn. The
    tracked band is *handed over* rather than replaced: `runTurn` finds it armed and
    re-targets it, which is why one gesture leaves exactly one `data-fold` in the DOM. Two
    things came out of building it. The desktop divergence in
    [`desktop-vs-mobile.md`](decisions/desktop-vs-mobile.md) row 19 said "Nothing" on a
    pointer, justified by *"a pointer drag already means marquee"* — false, since a marquee
    needs the hold; the rule is device-blind and the row is corrected in place. And a fold
    has an appearance before it has a destination: `crease`/`gap`/`hole` must be drawn while
    the finger is still moving, so the stage now asks its owner *which page comes next*
    (`turnTargetOf`) instead of guessing `page ± 1`, which with 7 | 9 | 19 vendored would
    have drawn the wrong band for the whole stroke. **Closed by**
    [`packages/core/src/gestures.test.ts`](../packages/core/src/gestures.test.ts) for the
    ladder and the commit rule, and
    [`apps/web/e2e/page-turn.spec.ts`](../apps/web/e2e/page-turn.spec.ts) for the band that
    follows a finger, the short drag that springs back, and the long horizontal drag that is
    still a marquee.

12. **A gate that enumerates from git has a smaller tree on the machine that writes the code
    than on the machine that gates it.** `gate:text-sources` listed `git ls-files`, which is
    the *index*, so a brand-new source file that had not been `git add`ed yet was outside the
    gate entirely. Reproduced rather than reasoned: a `packages/core/src/*.ts` carrying a NUL
    byte passed `pnpm gate:text-sources` while untracked and failed the same gate the moment
    it was staged. The boundary was exactly `git add`, which is the wrong boundary, because
    `make ci` is the mirror people run *before* staging — that is what it is for. CI never
    saw the gap and structurally could not: a checkout has no untracked files, so everything
    in the commit is tracked and the two machines disagree in the direction only the quieter
    one can see. The cost was a round trip — write a file, `make ci` green, push, CI red —
    for the one gate whose entire subject is a byte that makes a file unreviewable.
    **Closed by** [`scripts/gate-text-sources.mjs`](../scripts/gate-text-sources.mjs), which
    now lists `--cached --others --exclude-standard`: the index *and* what is on disk but
    neither tracked nor ignored. The count on a clean tree is unchanged at 166, which is the
    result to want — the fix adds files only when a working tree has them. One thing it also
    cost, and the reason the exclusion list grew: `apps/web/dist/assets/index-*.js` matches
    the source pattern, and until now the only thing keeping build output out of this gate
    was that it is untracked. `--exclude-standard` still keeps it out, but a gate whose scope
    is defined by `.gitignore` changes meaning when somebody edits `.gitignore` for an
    unrelated reason, so `dist`, `coverage`, `playwright-report` and `test-results` are named
    in the gate. This is the only gate in `scripts/` that enumerated from git; the others
    walk the tree or read a manifest, and were never in scope.

13. **Word geometry is a second corpus, not a layer, and the print is the question.** Loop 4b
    was the loop that was supposed to settle word granularity, and it settled half of it by
    arriving: `mushafs/hafs/kfqc/json/*` — the metadata behind the 604 pages now shipping —
    carries one polygon per **ayah** and nothing finer. So word-level selection cannot come
    from the pages the app shows, and the candidate named in §Loop 4b,
    [MushafDatabase-Ligature-Based-SVG](https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG),
    is the only route left. Its README (read 2026-08-03) is encouraging on everything except
    the one thing that decides it: per-ligature groups with `data-text`, 604 pages, KFGQPC
    Hafs, a permissive Sadaqa-e-Jaria grant — **and no statement of which print**. Loop 4a's
    finding is why that is fatal rather than untidy: V1/1405H and V2/1421H disagree on 36
    pages, our corpus is V2, and a V1-paginated word corpus would silently invalidate
    `ayah-pages.json`, every edge's `dPage`, and every share link already in someone's notes.
    **What would answer it:** run 4a's own arithmetic against the candidate — check whether
    5:77 sits on its p120 and 5:83 on its p121, the two boundaries where V1 and V2 first
    diverge. That is an afternoon, not a loop, and it must happen before any word-granularity
    work is scheduled, because a NO means this feature needs a different corpus and a YES
    means it needs a second ~600-file vendoring with its own pin and gate. Blocks external
    task #65 (word-level selection → refined mutashabihat search) and the word-granular
    roots/tajweed painting Loops 5 and 6a left as ayah-fallback.
    **Answered 2026-08-04 — it is V2, and the blocker moved.** The arithmetic ran, wider than
    the two boundaries proposed above: not 5:77/5:83 on two pages but every page in all four
    known divergence bands (120–123, 144–145, 531–534, 564–600) plus controls on either side
    of each band and at both ends of the book — 56 pages, **56/56 with an ayah span identical
    to `ayah-pages.json`**. Two pages would have been enough to be right and not enough to
    know it: a probe that only ever looks at contested pages cannot tell "this corpus is V2"
    from "our own table is wrong in exactly the contested places", which is why the controls
    are in the set. So the answer is the YES branch — a second vendoring — and it is
    reproducible rather than remembered:
    [`probe-ligature-print.mjs`](../packages/etl/scripts/probe-ligature-print.mjs) against a
    pinned commit, with every fetched page's SHA-256 written to
    [`ligature-svg.probe.json`](../packages/etl/data/pages/ligature-svg.probe.json), so a
    rerun either reproduces or says loudly that upstream moved. Three things the probe found
    that this entry did not predict, and they are what the next scheduling decision actually
    turns on. **Weight:** 595 KB raw / 114 KB gz per page → **67 MB gz for 604**, 2.6× the
    26.2 MB the whole app ships today and more than double `gate:assets`' 32 MB projection
    ceiling. **Shape:** `<g id="md-word-NNN" data-surah data-aya data-word-index-in-ayah
    data-hafs data-imlaey data-line-number>` wrapping per-ligature `<path data-text>` — paths,
    not rects, so a word's box is measured or precomputed, never read off an attribute.
    **Coordinates:** our p120 is `viewBox="0 0 345 550"` under
    `matrix(1.3333 0 0 -1.3333 -115 640)`; theirs is `viewBox="0 0 382.68 547.09"` with
    `data-rect="90.91,72.17,338.10,474.94"` on `#md-page-inner`. Same print, different frame —
    a word box does not transfer without a per-page registration against the text block. Taken
    together those point away from "vendor a second set of pictures" and toward *vendor the
    boxes*: derive per-word rectangles in ETL, register them onto the shipped page's frame,
    and ship a manifest beside `ayah-pages.json` rather than 604 more SVGs the app never
    draws. The print question is closed; **the open question is now registration**, and it is
    arithmetic on two pages the way this one looked like arithmetic on two pages.
    **Registration answered 2026-08-04 — and the sentence above is wrong twice.** It is not
    per-page, and it is not against the text block.
    [`probe-word-registration.mjs`](../packages/etl/scripts/probe-word-registration.mjs) fits
    `ours = s·theirs + t` and *measures* the residual rather than assuming one exists. The key
    is a correspondence neither corpus was built to provide and both already carry: the
    **ayah-end ornaments**. Ours are `<g ayah:x ayah:y>`, theirs `<g id="md-aya-mark-NNN"
    data-surah data-aya>` — 5–20 exact point pairs per page, no fonts, no rendering, no
    judgment, which is the standard the print probe held itself to. `#md-page-inner`'s
    `data-rect` is never read. The answer over 61 pages: **scale 1.3333 in both axes
    everywhere**, `ty` a constant near **−88.6**, and `tx` one of exactly two values — **−114.6
    on even pages, −54.6 on odd** — which is the recto/verso binding margin, and *the same two
    constants already sitting in our own SVGs' `matrix(1.3333 0 0 -1.3333 -115 640)` /
    `… -55 …`*. The registration was in the repo the whole time; nobody had put the two frames
    side by side. Marker residual **median 0.104, max 0.506 viewBox units** — at 320–430 px
    that is 0.10–0.63 **device pixels**, so the per-page fit is a check, not a necessity, and
    "vendor the boxes, not the pictures" survives intact with the 67 MB never fetched.
    Two things the fit had to be taught, both recorded because both produced confident wrong
    answers first: **document order is not reading order** (our markers come out reversed on
    p120 and scrambled within a line on p577; pairing on emitted order fits a *mirror*, giving
    a negative x-scale and a residual of 157 on p575), and **the polygons are not under the
    flipping matrix** — registering against them rather than against the ink is what makes this
    a positive scale instead of a flip. Both sides are now sorted into canonical reading order
    before pairing. What the probe found on the way is follow-up 14, and it is a defect in
    **our** data, not theirs.
    **Closed 2026-08-04 — the boxes are vendored, and the plan held.** 378 MB was read to write
    2.2 MB: [`build-words.mjs`](../packages/etl/scripts/build-words.mjs) transfers **91,451**
    word rectangles onto our frame and writes them as 604 shards under
    `apps/web/public/assets/words/hafs-kfqc/` (**886 KB gz**, ceiling 1,792 KB) with a SHA-256
    per upstream page and per shard in
    [`word-boxes.pin.json`](../packages/etl/data/pages/word-boxes.pin.json). The 67 MB was
    never fetched into the repo, not one upstream byte ships, and the pages remain the
    quranpedia print unchanged. Residual over all 604: **median 0.089, max 2.722** — the max
    being p1, which is the override frame and a known-displaced page, so the two ceilings are
    2.0 standard / 3.0 override, measured rather than picked. Three things worth carrying
    forward. **One:** the fit is a *check* and not a necessity, exactly as predicted, but the
    check earns its keep — a handful of pages cannot pair their ornaments and borrow their
    parity group's median transform rather than guess, and they say which. **Two:** the word
    index is the **print's**, not the Quranic Arabic Corpus's, and the two disagree on
    **4,499 of 6,236 ayahs** because the print counts pause marks as words. Painting roots or
    tajweed at word granularity therefore needs an alignment between the two segmentations —
    that is now the one open piece of task #65, and it is a task, not a lookup. **Three, and
    the reason to have fetched a second print at all:** [`gate:words`](../scripts/gate-words.mjs)
    re-measures every box offline against the polygon it claims, with its own parser, and found
    a defect `gate:pages` structurally could not — on p577 the ink of `75:5`'s first word *was*
    covered by a tappable box, the **wrong ayah's**. No orphan ink, so no orphan check could
    ever fire. Of 86,965 lexical words exactly one was misplaced; it is repaired in
    `vendor-pages.mjs` as a fourth defect shape ("the stranded first word") and the count is
    now zero. Two witnesses see what one cannot, which is why both gates run rather than one
    standing in for the other.
    **The alignment landed 2026-08-05, and it is smaller than "a task, not a lookup" implied
    — because the two indices turned out to be monotone.** They never cross; they only group
    differently. Block alignment on a folded consonant skeleton succeeds on **6,232 of 6,236
    ayahs**, and the whole mus'haf reduces to three shapes: **1→1 67,853**, **2→1 9,533** (the
    print splitting a proclitic — وَ بِ لِ فَ — off the rasm), and **1→2 exactly once**, at
    15:7, where QAC holds `لَّوۡ` and `مَا` apart and the print writes them joined. 86,965
    print words ↔ 77,429 QAC words. The four that do not align are **orthographic, not
    segmentational** — 2:72, 12:39, 12:41, 37:130 — each named with its reason in two places
    that a gate holds against each other. The hamza fold is itself measured rather than
    assumed: without it 276 ayahs fail, every sampled one the same shape; with it, 4. Three
    things worth carrying. **One:** the map is stored as a **delta over the shipped word
    shards**, not a table — a table would restate the shards 86,965 times and make it possible
    for the two to disagree, and a delta can only fail to apply. **Two:** it is checked without
    the corpus it came from. The 380 MB upstream is not vendored, so
    [`gate:align`](../scripts/gate-align.mjs) **applies** the delta to the committed shards and
    compares the result against the vendored QAC morphology — a third witness neither side
    controls. That is precisely the shape 12 lacked. **Three:** it is queryable —
    `pnpm align 2:4 [--print N | --qac N]` answers in a second, offline. The record is
    [`docs/design/word-indexing.md`](design/word-indexing.md); what is still open there is
    where the *app* reads the map, and that waits for the first caller.
    **Tajweed was the one consumer this alignment could not serve**, because its offsets
    address a third text — Tanzil's — and not either index here. Measured 2026-08-06 by
    `pnpm probe:tajweed-words`, which reconstructs that text from the print's own `data-hafs`
    instead of vendoring it, and audited to the end on 2026-08-07: **99.86%** on a character
    oracle covering **100% of annotations** (93.65% weighted by what each check risks),
    **83.31%** of annotations inside one print word, **16.69%** across two adjacent
    ones, and an orthographic residual of **ten ayahs — each one named**, one of them
    drifting more than ±2 codepoints and the rest not. Same finding as above and for the same
    reason — the disagreement between two Uthmani segmentations is spelling, not structure —
    and the proof is that two of the ten are the *same* two ayahs `lib/segmentation.mjs` already
    names for the print↔QAC alignment, reached from a third text neither of those involves.
    So the tajweed bake is priced ETL work rather than a corpus hunt.

14. **An ayah polygon does not always cover the ayah.** Found by 13's registration probe, and
    the reason to state it separately is that it is not a word-selection problem — it is wrong
    in the app **today**, at ayah granularity, on pages a reader opens now. With the transform
    fitted, every word on 61 pages was mapped into our frame and its centre tested against its
    own ayah's polygon. 287 of 8017 fall outside. 42 are single waqf/hizb marks (ۖ ۗ ۚ ۛ ۞),
    which the corpus makes separate words that sit superscript above the line so their centres
    land in the line above — benign, counted separately, not a defect in either corpus. The
    remaining 245 are two real defects, and **both are detectable from our own shipped SVGs
    with nothing downloaded at all**, which is what makes them gateable:
    **(a) Missing line fragments.** An ayah's polygon covers only some of the line bands its
    words occupy — always the *leading* ones, always where the ayah flows in from the previous
    page. Ten pages: 2, 431, 545, 551, 554, 564, 566, 575, 594, 599. The worst is **p545**,
    where `58:22` runs across five full lines that carry no polygon whatsoever and the ayah's
    only rect sits on line 6 — 50 words untappable; then **p575** (`73:20`, six lines, 77
    words). Internally the signature is exact: the page's topmost polygon sits a line or more
    below the median 7.3, *and* the first polygon is a mid-surah ayah rather than an `X:1`
    (a genuine surah header also pushes the first polygon down, which is why the second half
    of the test is needed and why a naive "top is low" scan flags 57 pages instead of 10).
    **(b) Pages 1 and 2 are malformed outright.** `1:4` has **zero height** (y 76.2–76.2) and
    can never be hit by anything; `1:5`, `1:6` and `2:2` carry rects running to y 382 and
    x −19.6 inside a **235×235** viewBox. This is Al-Fatiha — the most-opened page in the book.
    It is also why p1 is the worst fit in the probe (residual 2.72 against a median of 0.10):
    the ornament markers it is fitted on are displaced exactly as the polygons are, so the bad
    fit is a *symptom* and not a cause.
    Two further scans came back clean and are recorded so nobody re-runs them: no page has a
    missing *trailing* fragment, and the 42 uniform ~11.8-unit horizontal gaps inside line
    bands are **ayah-end ornaments** sitting in the seam between two polygons — systematic,
    benign, and not a hole (verified on p577, where the gap is exactly where `75:5`'s ornament
    lands).
    **What would answer it:** the defect is upstream in the polygon metadata
    `vendor-pages.mjs` reads, so the fix is either a repair pass there or a re-derivation of
    the missing fragments from the line grid — and either way the check belongs in
    `gate:pages`, which already cross-checks the print but has never once asked whether a
    polygon covers its own ayah. That gate is the deliverable; the numbers above are its
    fixtures. Blocks nothing, breaks reading today.

    **(b) is withdrawn, and half of (a)'s page list with it — 2026-08-04, building the gate.**
    Pages 1 and 2 are fine. `1:4` is a clean quadrilateral 116 × 27 units; nothing on either
    page leaves its viewBox. The report above came from a scan that decomposed every polygon
    into axis-aligned rectangles, which is what the `M…h…v…H…Z` form on nearly every page
    actually is — but **118 polygons in the corpus are general polygons**, L-shaped where an
    ayah wraps mid-line, and 11 of those 118 are on pages 1 and 2, whose surah-frame layout
    uses almost nothing else. Bounding a general polygon by its rectangles invents area it
    does not have and edges it does not have; that is the whole of the finding. The lesson is
    in `subpaths()` in `gate-pages.mjs`, which fails on a curve command rather than guessing:
    a parser that quietly tolerates a shape it was not written for reports the shape, not the
    data. p1's 2.72 residual is unexplained again — 7 markers inside a decorative frame is a
    plausible cause, and it is not a polygon defect.
    **That count read 189 here until 2026-08-04, and the correction is the same lesson a
    second time.** Re-measured against the assets of the commit that first wrote it, it was
    118 there too — so it was never drift, it was float equality. The corpus writes its
    rectangles relative (`M80.6 153h184v36h-184Z`), 80.6 + 184 − 184 is 80.59999999999997,
    and under `===` the closing edge of a perfectly good rectangle is neither horizontal nor
    vertical: 71 of the 189 were rectangles that missed by 3e-14. A parser that quietly
    tolerates a shape it was not written for reports the shape; a comparison that quietly
    demands more precision than the data carries reports the comparison. `gate:pages` now
    counts both figures on every run and prints them, so neither can be carried in prose
    again.
    Rescanned with a parser that reads the polygons as polygons: **zero** zero-area subpaths,
    **zero** slivers, and three subpaths outside the viewBox by 0.8–1.5 units at the bottom
    edge (p187 `9:6`, p429 `34:14`, p515 `49:4`) — rounding at the page foot, not a defect.
    Eleven pages fail, not ten, and the (a)/(b) split was the wrong cut. The right one is by
    **signature**, because that is what a gate can test:
    **leading** — the topmost band sits a full line below where pages start while the first
    polygon is mid-surah: **545, 551, 554, 564, 566, 575, 594, 599**. p545 and p575 are as
    described above and are the two that cost a reader real ayahs.
    **gap** — an uncovered strip between two bands where the band below is not an `X:1`:
    **431** (21 units, `34:23`'s single band straddling two lines instead of tiling them),
    **602** (25.5, `106:4` reduced to two 4.4-unit slivers) and **604** (27.5, `114:6`, the
    same). A surah header leaves a 63–80 unit gap on 64 pages and that is the print; the ayah
    number, not the width, is what separates a header from a hole.
    Page 2 was in the list only through the withdrawn (b). It has no defect.
    **The gate landed 2026-08-04** in `gate-pages.mjs`: the two signatures above, thresholds
    read off the corpus (median page top 7.3, median line height 36) rather than written down,
    and the eleven pages as an *allow-list* — a twelfth fails, and so does a page that stops
    failing, so the repair cannot land without deleting its entry in the same commit.
    **What is still owed:** the repair itself. It is upstream in the polygon metadata
    `vendor-pages.mjs` reads (confirmed against `545.json` at the pinned commit: `58:22` really
    does carry one rect there), so it needs a declared repair pass beside `ID_REPAIRS`, a
    re-vendor, and a re-pin. Blocks nothing, breaks reading today.

    **The repair landed 2026-08-04 — and eleven pages turned out to be seven short.**
    Writing a repair means deciding where a missing rect goes, and that number has to come
    from the page rather than from taste. It comes from the page's **line pitch**, taken as
    the *modal* rect height and not the median: a squashed or stretched rect is itself the
    defect being repaired, so a median would let the defect lead the measurement. Every
    full-size page reads back 36 units — including p227 whose rects are 28.8, p468 whose are
    46.2 and p560 whose are 29.3 — and `(bottom − top)/36` rounds to **15 lines** on 534 of
    602 pages, 13 on the ~40 that open with a surah header. So the top of a page's text block
    is `lastRectBottom − 15 × pitch`, which is what a leading repair extends up to.
    Before writing any of it the *detector* was rebuilt, on the principle that a repair
    validated by the signatures that found the defect proves only that the signatures were
    satisfied. The new one measures the thing itself: map every glyph through the page matrix
    and ask whether its centre falls inside some polygon. Run across the corpus it found
    **seven more pages**, and the reason eight of the original signatures' near-misses got
    through is one line — `bands[0].ayah !== 1` excused any page whose first polygon is an
    `X:1`, on the correct observation that a surah header pushes the first polygon down. It is
    correct about headers and wrong about **542** (`58:1`, one abandoned line), **549**
    (`60:1`, four) and **558** (`65:1`, three), which have a header *and* an abandoned run
    above the ayah's only rect. The other four are a shape the old rule did not model at all:
    a rect off the line grid, so its top edge cuts through a line instead of sitting between
    two — **227**, **294**, **468**, **560**. Repairing one of those moves the neighbouring
    ayah's rect too, since the strip between them belongs to exactly one of them and both
    boxes must agree where; hence 21 edits across 18 pages.
    Two things had to be learnt the hard way and are recorded so they are not re-learnt.
    First, **the left-margin sliver**: upstream gives a surah's `X:1` polygon a ~12-unit rect
    at the *left margin* on the line where the previous surah ended — **above** the header, not
    below it (p106 `5:1` starts at y152.25 while its header band is 188.25–260.25). So "where
    the ayah-1 polygon starts" is not where the surah's text starts, and a furniture window
    anchored there measures 0.00 lines tall and invents 69–99 orphans on p106, p255, p440,
    p467 and p515. Furniture is therefore defined as a *gap in the tiling* that some ayah-1
    rect picks up directly below — no anchor, no page list. Second, **the tolerance is
    measured, not chosen**: benign glyphs sit at most 8.8 units outside their box (a fatha
    rides above the line it belongs to), real defects a median 36 out, so 12 separates them and
    lets the gate demand **zero** rather than carry a count that would absorb the next defect.
    Six other detector designs were tried and discarded — a span/orphan heuristic whose
    margins were 211 against 226, a glyph-count fingerprint that did not survive the full
    corpus, band grouping that double-counts because upstream merges consecutive full-width
    lines into one tall rect.
    `gate-pages.mjs` now carries two tests, ORPHAN and BAND, both demanding zero, and **no
    allow-list at all** — it knows nothing of the repair table, so a regressed repair and a
    newly-broken upstream fail identically. Eighteen pages before, zero after. The repairs are
    `POLYGON_REPAIRS` in `vendor-pages.mjs`, declared as the third transform beside svgo and
    `ID_REPAIRS`, each carrying the exact upstream `d` it replaces so a fixed upstream dies
    loudly; they run *before* svgo, because svgo rewrites path data at `floatPrecision 1` and a
    `from` written against optimized output would be matching our own rounding. The re-vendor
    changed exactly those 18 files and nothing else, the Loop 0 self-test still reproduces
    pages 7, 9 and 19 byte-for-byte, and the pin moved only in its `vendored` hashes.
    **The proof is 13's own probe**, which is where this started: 245 ordinary words adrift
    before, **7** after — all of them on **page 1**, the decorated Fatiha frame, the one page
    with its own override transform and the 2.72 residual noted above as still unexplained. It
    is also the page the coverage gate skips by name, because it is set as a decorated frame
    rather than a fifteen-line block and every line-pitch statement here is false of it.
    Closed.

    **The re-run also explains the 2.72, and the probe's own record needed correcting.**
    Re-running the probe against the repaired corpus and writing the result — because a
    recorded measurement whose subject has changed will, on the next run, raise the alarm it
    exists to raise for a reason that is not "upstream moved" — put the ordinary residue at
    **7 of 8017** and left one hole, `1:4` on page 1. p1's residual was left "unexplained
    again, 7 markers inside a decorative frame is a plausible cause" when (b) was withdrawn.
    The fitted constants now say more than plausible: the override group fits **sx 1.163
    against sy 1.137**, a scale that differs between the axes, where every one of the 59
    standard pages fits 1.3333 in both. The decorated frames are not the fifteen-line block at
    a different offset; they are a different geometry, which is a property of the print and not
    a defect in anything. What did need correcting is the probe result's own `$residue`, which
    still carried (b) as fact and claimed both defects were "filed in docs/backlog.md and
    docs/issues.json" — backlog.md never carried either. It now records the withdrawal beside
    the original, including the detail that makes it worth recording: the false positive was
    produced **twice, by two independently written parsers** — one assuming the axis-aligned
    `M…h…v…H…Z` rect form, one reading svgo's relative commands as absolute pairs — and two
    wrong parsers agreeing is not a confirmation.

15. **Word selection is finger-only, and it is the first thing this app can do that a
    screen-reader user cannot.** Shipped 2026-08-04 with word-C (task #65). Every other way
    of selecting has a keyboard path and an announced result: an ayah is a `role="button"`
    named «الآية ٢:٤٨» that Tab reaches and Enter selects, and a hop announces where it
    landed. The descent to word granularity has neither. It begins with a 350 ms press
    *inside* an already-lit ayah — a gesture with no key that stands for it — and what it
    produces is ink in `#hifth-overlay`, which is decorative by design and adds no node, no
    role and no name to the tree. `e2e/word.spec.ts` asserts exactly that, before and after,
    and the assertion is deliberately double-edged: it protects the ayah buttons from being
    buried under overlay nodes, and it is also the proof that a reader who cannot see the
    page gets nothing from this feature at all.

    **Why it shipped anyway, rather than waiting.** Nothing above the stage consumes a word
    run yet — `onSelectWords` has no listener, because the hop still searches at ayah
    granularity until ⑬'s print-vs-QAC segmentation alignment lands. There is, today,
    no *outcome* to announce; a keyboard path would reach a state that does nothing, and an
    `aria-live` region would read out a phrase and then fall silent. Building the access
    path before the thing it accesses would mean designing the announcement twice.

    **What would answer it,** and the order matters: ⑬'s alignment first, so a word run
    means a refined search rather than a highlight; then the two halves together — a key
    that descends from a selected ayah (Shift+Arrow is the obvious candidate, and it is
    already the shape a reader expects from every text field they have ever used), and an
    announcement of what the run *is* («من «الحمد» إلى «العالمين»» — the first and last
    word, not a count), since «٤ كلمات» tells a memoriser nothing they wanted to know. Both
    are cheap once there is something to say. Indexed as
    `plan-word-selection-is-finger-only` in [`issues.json`](issues.json), owned by an agent,
    blocked by ⑬ rather than by a human.
    [`decisions/word-selection.md`](decisions/word-selection.md) is the record of what the
    gesture is and what proved it.

    **Answered 2026-08-05 by word-D, and the prediction above is half right in a way worth
    keeping.** The order held: ⑬'s alignment landed first (`word-alignment.pin.json`, and
    §11 ① of [`design/word-indexing.md`](design/word-indexing.md) records where the app
    reads it), so a word run now *means* something before it was given a key. The key is a
    second `Enter` on the ayah that is already selected, not `Shift+Arrow` — the reasoning
    above was that a reader expects the text-field grammar, and they do, but `Shift+Arrow`
    is the *extend* half of that grammar, not the *enter* half, and it is what extends a run
    here too. The rule the app teaches is instead the pointer's own: a further action on the
    current selection means words. One sentence for both hands. `←`/`→` carry the run,
    `Shift` grows it, `Escape` climbs exactly one rung.

    **The announcement went the other way, deliberately.** This item asked for «من «الحمد»
    إلى «العالمين»» — the first and last word — on the grounds that «٤ كلمات» tells a
    memoriser nothing they wanted to know. That is right about the count of *words* and it
    is why the shipped announcement does not count them: it says «٧ مواضع مشابهة» — how many
    places in the mus'haf this run turns out to be about. The outcome, not the selection.
    Naming the words would mean reading scripture back to the reader through a UI string,
    which is the one thing the word grain exists not to do (§10 of the word-indexing design,
    and `gate:notext` behind it), and the reader can already see what they selected — what
    they cannot see is the answer. The identity half the alignment unblocked stays unspent.

    **What is proven, and what is still owed.** `apps/web/e2e/word.spec.ts` drives the
    descent from a real focus ring on both devices and asserts that the arrows never reach
    the page-turner underneath; a second test asserts the live region says an outcome. What
    no automated check can say is whether a count is *enough* — that is the ledger's
    `screen-reader-walkthrough`, owned by a human, and it is the only thing that could
    reopen the phrasing. [`decisions/word-search.md`](decisions/word-search.md) is the record
    of what a span claims, why a run has three outcomes rather than two, and what the refined
    search still does not do — the rail beside the page is not filtered, only counted.

16. **The golden baselines predate the spread triage, and twelve shots fail at a clean
    checkout.** Found 2026-09-01 while verifying the settle step of the desktop-triage thread,
    which ran the whole Chromium suite. The phone goldens (`e2e/golden.spec.ts`, Chromium; the
    darwin baselines under `e2e/__screenshots__/darwin`) were last written in `259fde0`
    (2026-08-07). Twelve now fail: the selection, breadcrumb and phrase states on pages 1, 7, 9,
    19 and 604, and the page-7 marquee. The signature is one change, not twelve — the whole
    page sits a few pixels lower after a hop, so every shot taken after a hop differs, from
    2,624 px (0.01 of the image) on the page-9 breadcrumb to 59,475 px (0.12) on the page-7
    selection, and the marquee shot grew one row, 574 → 575 px. Attributed by bisection, one
    build per commit: the page-7 selection shot passes at `7d4402e` and fails at `b90b450`
    with the identical 59,475-pixel count, and every commit since inherits it; the working tree
    adds nothing (the same counts with the whole tree stashed at `ff81f8e`). `b90b450` is the
    spread-triage commit that, among other things, made a hop re-centre the page so the two
    leaves land level — so the shift is most likely that fix reaching the phone framing, which
    is what a golden exists to make *deliberate*, not to forbid. **What would answer it:** the
    owner looking at one diff (`npx playwright show-report` after a `--project golden` run) and
    saying whether the new framing is the wanted one. If it is, `make golden` rewrites the
    darwin baselines and `make golden-linux` the linux ones in the pinned image, in one commit
    that says why; if it is not, the fix goes back into `b90b450`'s stage change. Not
    re-baselined silently: twelve shots changing under a commit that never mentions them is
    exactly the event the goldens are for. The linux baselines were not checked here — they
    run only in the image. Blocks nothing; the rest of the Chromium suite is green (176
    passed, 1 skipped, the iphone project not run — WebKit is not installed on this machine).
    **Closed 2026-09-01.** The owner looked at the diff — the whole page one pixel lower,
    every glyph edge different, the highlight bands themselves unchanged — and accepted the
    framing. Both sets were rewritten in one commit: darwin by `make golden-update`, linux by
    `make golden-linux UPDATE=1` in the pinned Playwright image, twelve shots each, the same
    twelve on both platforms and nothing else. **Closed by**
    [`apps/web/e2e/golden.spec.ts`](../apps/web/e2e/golden.spec.ts) against the new
    baselines: the next shift of the framing fails the same twelve shots again, on both
    platforms, which is the event these exist to make deliberate.

17. **Two ayah boxes are cut short of the line, and the pen draws them thin.** Found
    2026-09-01 by the whole-book box sweep (`pnpm gate:boxes --list`), the first thing it
    flagged that no reader had reported. Of the 12,350 rectangles that make up the 6,236 ayah
    boxes, two are not a whole number of lines tall: 68:3 on page 564 (27.9 units on a 36-unit
    line, 0.77 of a line) and 107:2 on page 602 (28.3 units, 0.79). Both are the same shape —
    an ayah's short tail at the left margin, where the polygon layer cut the box some 8 units
    short of the line and started the *next* ayah's box that much early, so the two boxes
    still tile the column but the seam is in the wrong place. The pen accepts them (they are
    rectangles) and draws a band 0.72 of the *rectangle's* height rather than the line's, so
    the lit tail is a little thinner and sits a little higher than its neighbours; at print
    size in `docs/design/ayah-box-sweep.html` it is hard to see, and a reader would sooner
    notice the next ayah's band starting above its own first word. Every other rectangle in
    the book is on the grid within 0.2 of a line, which is what makes two worth a row: this is
    a print quirk, not a class the pen has to learn. **What would answer it:** either a repair
    in the vendoring step — a `POLYGON_REPAIRS` entry in `scripts/vendor-pages.mjs` that
    stretches each tail to the line and pulls the next box back, then re-vendor and re-pin the
    two pages — with `OFF_GRID_COUNT` in `scripts/gate-boxes.mjs` lowered to 0 in the same
    change; or a decision to tolerate it, written here, in which case the gate keeps holding
    2 so that a third is still an event. Not chosen here because the fix is a corpus edit, and
    corpus edits are owner-visible in the pinned pages. Blocks nothing. **Blocked, 2026-09-01:** the repair entry has to be
    written against the *upstream* polygon, and the upstream page cache is gone — it was a
    symlink into a scratch directory that has since been emptied, so re-vendoring means a
    348 MB fetch first, which nobody starts without asking. Until then the gate holds the
    count at 2 and the two tails ship as the print drew them.

**The half of these a machine cannot run now has a register — and a runbook.** Follow-ups
① (the phone), ② (the browser glance) and ④ (VoiceOver/TalkBack) still wait on a human, and
prose cannot answer "is that still true, on what device, and when?" — ⑤ (does the source
link resolve for a stranger) was answered on 2026-07-29 and is the register's first closed
entry, which is the point: it is *recorded*, with the commit it was true at, rather than
remembered. Each is an entry in
[`docs/validation/ledger.json`](validation/ledger.json) carrying what it blocks, what its
result **tunes**, and the steps to run it with what to expect on screen at each one. That
runbook renders three ways — `make validate CHECK=<id>` here, `make guide` to a phone-shaped
page served over the LAN, and the `validate` skill drives the session — so it is written
once and cannot drift. A fourth reader is also a writer: `make validate-auto` runs the half
of those steps a command can now do and writes down what happened, so nobody walks a step a
machine has already walked. `gate:validation` fails if the ledger starts lying, including a
pending human check nobody could follow. Recording a result is `make record`, not a
paragraph edit here — see §Testing plan.

### Where it deploys

**GitHub Pages, at <https://blog.bytesofpurpose.com/hifth/>, on every push to `main` that
clears all four CI jobs.** Nothing else publishes; there is no path in this repo that serves
bytes no gate has seen. The deploy job downloads the artifact `build-test-gate` uploaded
rather than rebuilding, so what a reader is handed is literally what the budget gate weighed
and the ETL determinism check matched against the committed assets.

Two things made this a workflow file and not a project. **Nothing in the app needed changing
for a `/hifth/` subpath** — `base: "./"`, a `start_url` and `scope` of `"./"`, and hash
routing were all already in place. And the hash routing in particular was chosen for share
links (a teacher pastes one; it cold-opens on the exact view), which happens to mean a deep
link never asks the server for a path it does not have — so GitHub Pages' total lack of
rewrite rules, normally disqualifying for an SPA, costs nothing here. A convention adopted
for one reason decided which hosts Hifth can live on.

**Cloudflare Pages stays available and stays live**, because the host is the kind of decision
that gets revisited and the worst moment to work out how to publish is the moment you need
to. Same workflow, same artifact, chosen rather than automatic: Actions › CI › Run workflow ›
`target: cloudflare`. Off CI entirely there is `make deploy-cloudflare`, which refuses on a
dirty tree — the bundle bakes the commit its reader is offered under §6 (follow-up ⑤ above),
and publishing uncommitted work would offer corresponding source that does not correspond.
The one thing the alternative host has that the default does not is `public/_headers`; the
note in that file explains why losing it costs almost nothing once a service worker is doing
the caching.

---

## 1. How we build: loops, not a waterfall

The build proceeds in **vertical loops**. Each loop is a thin end-to-end slice with a
demoable exit criterion checked on a real phone (or Playwright mobile emulation) before the
next loop starts. Loops are ordered so the riskiest unknowns — inline-SVG performance at
scale, the touch gesture split — surface earliest. The delivery plan's week-numbered
milestones are imported as loop *exit criteria*, not as sequencing.

Loops are allowed to shrink; they are not allowed to skip their exit criterion, and a loop
never ends without an on-device check and a `docs/decisions/loop-<N>.md` writeup of what
was decided, measured, and deferred.

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Repo | Light **pnpm workspace** | `packages/core`, `packages/etl`, `apps/web`; pays for itself when the Capacitor track wraps the same web build |
| Build/dev | Vite + TypeScript (strict) | fast, static output, no server |
| UI | React 18 | component model for rail/popovers/menus; mobile-touch ecosystem |
| Core (L2 highlighter, resolver, router, keys) | **Framework-free TypeScript** in `packages/core` | the spec's L2 speaks DOM element IDs + CSS classes only; keeping it React-free preserves the layer contract and keeps it headless-testable. `Gesture` (vanilla @use-gesture) fits here |
| Gestures | **@use-gesture v10** | drag + pinch on one surface, with `touch-action` + `pinching`/`cancel()` disambiguation (research §4) |
| Stage transform | one combined `translate/scale` on the container | children never re-render on pan/zoom (research §7) |
| State (L3) | Zustand (or React context while small) | selection/trail/skin/edition are a tiny store |
| Styling | CSS modules + **design tokens** (custom properties) | tajweed skin is by spec a stylesheet swap — keep styling in CSS, not JS |
| Tests | Vitest + Playwright (mobile viewport) + fast-check + axe | see §6 |
| ETL | Node/TS in `packages/etl` | offline, output = static JSON; shares the key-grammar code with the app |
| Hosting | Static (Cloudflare Pages) | hash routing is static-host friendly |
| PWA | vite-plugin-pwa | offline pages + installable |

Ship artifacts: `public/assets/` (SVG pages, untouched), `anchors/`, `adj/`, `roots/`,
`skins/`, `registry.json`, and the app bundle. No backend.

## 3. Component architecture

The spec's three layers map to three areas with **enforced boundaries** (ESLint
`import/no-restricted-paths`: `core/` may not import from `components/`; nothing imports
from `assets/`).

```
packages/core/                ← framework-free TS (architecture's L2 + shared grammar)
  keys.ts                     parse/format/compare canonical node-keys (spec §1)
  resolver.ts                 key → {page, elementIds, bbox, markerXY} via anchors JSON
  highlighter.ts              highlight/clear (grouped), navigateTo, setSkin,
                              onSelect/onRangeSelect, serializeState/restoreState (spec §3)
  gestures.ts                 pointer-event splitter: text-marquee vs margin-pan
  view.ts                     the pan/zoom transform math — frame a bbox, and clamp the
                              result so the stage always holds page, never blank paper
  router.ts                   hash-link grammar parse/serialize (spec §7) — same path as share
  adjacency.ts                shard loader + edge bucketing by dir (↻◀▶), popover ordering
  quran-meta.ts               ayah counts, juz and hizb starts — the divisions any per-scope
                              view is labelled by; vendored from Tanzil, checked by a gate

packages/etl/                 ← Node: extract-anchors, build-adjacency, build-roots,
                                build-skins, validate (resolution + licensing gates)

apps/web/
  src/state/                  ← L3 store: selection, trail, skin, active edition
  src/components/             ← React, presentational + thin containers
    PageStage.tsx             SVG mount point, pan/zoom viewport, page load/unload
    HopRail.tsx               chips with counts (↻3 ◀1 ▶2 ⬡12), arc-arrow glyphs
    HopPopover.tsx            target list grouped by direction, lazy-loaded
    DiffView.tsx              token-level mutashabih diff, ctx-continuation line
    HighlightMenu.tsx         post-drag context menu (hop / root lens / copy link / clear)
    RootLens.tsx              root occurrences by page distance, lemma sub-groups
    TrailBeads.tsx            subha-bead breadcrumb strip; every bead a back-hop
    ShareSheet.tsx            link + trail share (serializeState → URL)
    SkinToggle.tsx            plain / tajweed
    ArcArrow.tsx              the one hop glyph (mirrored / closed-loop variants)
    EditionPicker.tsx         edition switch + "view in your mushaf" concordance prompt
  src/App.tsx                 shell: stage + rail + trail, mobile-first RTL layout
  public/assets/              immutable SVG corpus
  public/data/                ETL output: anchors/ adj/ roots/ skins/ registry.json
```

**This tree is the plan, not the map.** It was written before the code and says what
was *intended*; nothing fails when the code moves away from it. For where a feature
actually lives today — the ordered path through it, how to extend it, and which gates
judge it — run `make map` (`make map FEATURE=<id>` for one). That reads
[`docs/map.json`](map.json), whose every pointer is checked by `gate:map` on each push
and by the pre-commit hook on the files you staged, so it is true or the build is red.
The `extend` skill ([`.claude/skills/extend/SKILL.md`](../.claude/skills/extend/SKILL.md))
drives that walkthrough. Same rule as the validation ledger: one source, N renderers, and
this document names the command instead of restating it.

Component rules:
- React components never touch SVG internals. `PageStage` is the only one that hands a DOM
  node to the highlighter; everything else calls the highlighter and renders around the stage.
- Every component gets a fixture (plain Vite page) so it can be built before real data exists.
- The edge-type registry (spec §5) drives `HopRail`/`HopPopover`; reserved types
  (hadith ⚭, tafsir ✎, lexicon) render nothing until their `status` flips.

## 4. Binding design rules (from research)

Full evidence in `docs/research/2026-07-20-mobile-svg-pwa.md`. The rules:

1. **DOM budget is the #1 constraint.** Mount only current + adjacent pages;
   `content-visibility: auto` + `contain-intrinsic-size` off-screen; scope highlight
   toggles to small CSS-contained subtrees. CI check: **no asset page contains `<text>`**
   (Safari content-visibility paint bug; quran-svg uses outlined paths, so we stay safe).
   *Re-checked 2026-07:* Safari 18+ supports `content-visibility` and mid-2026 releases
   fixed several of its bugs (find-in-page in skipped content, visible→hidden repaint —
   see [Safari release notes](https://releasebot.io/updates/apple/safari)), but the
   [SVG-`<text>`-never-paints bug](https://dev.to/bryce/a-gnarly-svg-visibility-bug-2j68)
   has no confirmed fix — the no-`<text>` CI guard stays.
2. **Inline SVG at scale is unproven** (no major Quran app does it). Loop 1 runs a
   real-device perf spike; the architecture keeps a **raster-fallback escape hatch**
   (rasterize glyph layer, keep only the polygon hit layer as DOM) behind the unchanged
   highlighter API.
3. **@use-gesture + mandatory `touch-action`**; apply the `pinching`/`cancel()` split.
4. **Offline: quota is a non-issue (~60% disk); eviction is the issue.** iOS install is a
   prerequisite for durable offline (ITP 7-day deletion; installed apps exempt) → the
   install prompt is a first-class iOS feature. Call `persist()`, verify with
   `persisted()`, degrade gracefully. Detect Chrome's clear-on-exit ~300 MB cap. Ignore
   obsolete "Safari 1 GB / 50 MB" numbers. *Re-verified 2026-07 — still current:* the
   7-day script-storage deletion applies to Safari-tab usage only; Home-Screen web apps
   keep [their own days-of-use counter](https://developer.apple.com/forums/thread/710157)
   and are exempt; [`persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
   is still not documented to stop the ITP timer (see also this
   [2026 iOS-PWA survey](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)),
   so install — not `persist()` — remains the durable-offline mechanism on iOS.
5. **iOS deep-links can't open an installed PWA** — shared links open in Safari tabs;
   pin-a-juz UX lives inside the app; don't promise link-into-app on iOS.
6. **A11y floor:** WCAG 2.2 targets ≥24×24px (our 44px budget clears it); SVG exposed via
   `role="img"` + `aria-labelledby`, per-polygon `aria-label` + `tabindex` for keyboard hops.
7. **Corpus completeness is unverified** — audit quran-svg page-by-page in Loop 0 before
   trusting it as the sole asset source.

## 5. Frontend-design practices

- **Design tokens from Loop 0** (CSS custom properties): paper/ink neutrals so the mushaf
  artwork is the hero; tajweed + plain skins are token layers (matches "skin = stylesheet").
- **Signature element:** the leaping arc-arrow + subha-bead trail (spec §9). One
  orchestrated motion moment — the hop (pan → land → pulse). Everything else quiet.
- **Type:** characterful Arabic display face for chrome (surah names, rail); quiet
  Latin/utility companion; mushaf glyphs are geometry, never restyled.
- **Copy:** user-side vocabulary (Hop, Trail, "Pin this juz"), active voice, one verb per
  flow end-to-end, errors say what to do next, empty states invite action. Arabic-first
  chrome with English support — shipped, and the line worth keeping is where the border
  falls: the UI language moves **chrome only**. The mus'haf, verse text, roots and the
  licence credits stay Arabic and stay RTL in both languages, as does the page-turn
  convention Loop 1 decided — a hafiz whose phone is set to English must not find the book
  running backwards. `make map FEATURE=ui-language` walks it.
- **The chrome's vocabulary is a compiled ICU catalog, not a hand-written table.** The
  original design argued a library would be dead weight for two locales with no plurals to
  negotiate, and it was right about the bundle and wrong about the plurals: Arabic has six
  CLDR categories and `few` is `n % 100 = 3..10`, so the ternary it shipped read «١٠٣ صفحة»
  for 41 of the 603 page distances — grammatical enough that nobody would file it. The fix
  keeps the bundle argument by moving the library to the **build**: catalogs are
  `apps/web/src/messages/*.json` in ICU MessageFormat, `pnpm i18n:build` compiles them to
  committed TypeScript, and the only runtime is twelve lines over `Intl.PluralRules`.
  Measured **+1.8 KB gz** end to end (101.2 → 103.0 of a 150 KB budget) against 9.3–25.2 KB
  for a runtime ICU library. Completeness stays a **build-time** guarantee — each locale is
  `const messages: Catalog`, so a missing key does not compile and there is no fallback
  chain that could render English inside an Arabic sheet — with `gate:i18n` covering what
  `tsc` cannot see. Numerals stay a property of the locale (Arabic-Indic everywhere
  *including* aria-labels, with page numbers Latin in every language, deliberately). The
  forward-looking document, including the checklist for adding a language, is
  `docs/design/i18n.md`; what was decided and measured is `docs/decisions/i18n.md`.
- **The mus'haf fills the stage, always.** A hop centres the ayah it is taking you to, and
  an ayah near the foot of a page cannot be centred without dragging the page past its own
  end — so the reader arrives looking at a fifth of a screen of blank paper, with the last
  line of scripture sitting above it. Framing proposes, `clampView` decides, and it decides
  on *every* write to the transform rather than only on the hop's target: a tween's
  intermediate frames are lerped at a zoom belonging to neither end, and a pan after a
  correct landing would otherwise undo it. The rule this cost is worth writing down: nothing
  in this suite could see it — the ayah was selected, its marks were in the overlay, the
  header and the trail agreed, and the golden shots are cropped to the SVG element, so the
  one thing that was wrong was the space *around* the page. Geometry against geometry is its
  own tier (`e2e/stage-fit.spec.ts`), and the committed baselines had been carrying the
  defect for six loops because a picture of the page cannot show you what is beside it.
- **Quality floor, unannounced:** responsive to 320px, visible focus, reduced-motion
  respected, 44px targets, RTL-native (`dir="rtl"`, logical properties). The logical
  properties are what made the English chrome a one-attribute change — and what makes an
  accidentally *inherited* flip a defect no screenshot would catch, which is why
  `e2e/lang.spec.ts` asserts the computed direction of the stage rather than its markup.
- **Say what the build actually holds.** The page bar (shipped; `make map FEATURE=wayfinding`)
  is the standing example of the rule this project keeps re-learning: its track is the whole
  **604-page print**, because a control that spanned the vendored inventory would quietly
  redefine the mus'haf as whatever is in `public/assets` this week — and *because* the track
  is longer than the build, letting go in the gap lands on the nearest vendored page and
  **announces that it did**, above marks for the stretches it holds and a permanent
  "٣ من ٦٠٤" line. Loop 4b closed the gap, and the line was **kept** rather than deleted —
  the sentence this bullet used to end on ("that caveat is deleted then, not before") had the
  wrong idea of what it is. It is not a warning that expires when the news is good; it is the
  bar saying what is behind it, and it reads "٦٠٤ من ٦٠٤" now
  (`apps/web/e2e/pagebar.spec.ts`). The same failure this codebase has already
  paid for twice — a licence summary that over-restricted (follow-up ②), a header claiming a
  page the stage never loaded — is always the same shape: the UI stating something the build
  cannot back. A gap is a to-do; a gap the interface papers over is a lie.
- **Desktop is room, not permission.** Above `1024×740` the app shows an open mus'haf —
  two leaves and a spine, the lower page number on the right, because the book reads right
  to left. The governing rule, and the thing worth carrying into any later width work: *a
  bigger screen is not a licence to add features, it is room to stop hiding the ones that
  already exist.* Every desktop affordance traces to a named mobile constraint — the
  language switch surfaces in the chrome because `e2e/chrome-fit.spec.ts` holds the header
  inside 320px with seventeen pixels of slack and a sixth control does not fit in seventeen
  pixels; the keyboard map is spoken aloud because a phone has no keyboard and the
  shortcuts have therefore shipped with no discovery surface at all. An addition that
  cannot name its constraint is a new feature and belongs in the loops above, not in a
  media query. Two things about the shape are easy to get wrong later and are written down
  where they are decided: the breakpoint's **binding axis is height**, not width, because a
  mus'haf leaf is portrait and its width is derived from the height the chrome leaves; and
  the spread is gated on **mounting**, not on styling, because a `display: none` leaf still
  fetches its ~170 KB SVG and builds a `Highlighter` — the exact cost follow-up ① is about.
  It also inherits the honesty rule directly above: with pages 7, 9 and 19 vendored and none
  adjacent, *every* spread is one leaf and one hole, and the hole says which page it is and
  how much of the print is here rather than posing as blank paper. The full reasoning, the
  arithmetic behind the breakpoint, and what Loop 4b changes are in
  [`docs/design/desktop.md`](design/desktop.md) — the first document in `docs/design/`,
  which holds what you read *before* touching a feature, as distinct from
  `docs/decisions/`, which records what a finished loop settled. The running per-decision
  table is [`docs/decisions/desktop-vs-mobile.md`](decisions/desktop-vs-mobile.md); future
  width work appends a row there. One later addition is worth naming here because it is a
  correction and not a feature: how many pages are on the desk, and how big, were briefly
  **derived** — the book closed itself when a zoom passed fit — and that derivation leaked
  three ways at once. Both are now explicit controls in the chrome, the wheel navigates and
  never magnifies, and `ctrl`+wheel is bound to nothing on purpose, because on macOS a
  trackpad pinch arrives wearing that modifier. The record is
  [`decisions/wheel-and-zoom.md`](decisions/wheel-and-zoom.md); the general lesson is the
  one the honesty rule above is also about — state with two owners has patches, not fixes.
  `make map FEATURE=desktop-spread` walks the code. Note
  for Track B: the "iPad two-page spread" listed there is now largely a web concern that
  the wrapper inherits, not net-new native work.

## 6. Testing plan

Principle: **the data is scripture — data correctness is tested harder than code.** A
wrong hop or mislabeled ayah is a product-breaking bug for this audience.

### Test pyramid by layer

| Layer | What | Tool | From |
|---|---|---|---|
| `core` unit | keys round-trip (property-based: parse→format→parse); resolver incl. misses; adjacency bucketing (↻◀▶ boundaries: dSurah 0/±1, same-page/juz); every §7 link form round-trips serialize/restore | Vitest + fast-check | Loop 1 |
| Highlighter contract | spec §3 API on fixture pages (jsdom): group isolation (breadcrumb never clobbers selection), navigateTo mounts ≤ current+adjacent, setSkin toggles classes without touching geometry, events carry correct keys/granularity | Vitest + fixtures (mock pages 7/9/19) | Loop 1 |
| Component | each component from fixture data: rail counts match adjacency, popover hifz ordering, diff output for known pairs (2:48 vs 2:123 = شفاعة/عدل), reserved edges render nothing | Vitest + Testing Library | as each lands |
| E2E core loop | scripted hop tours: tap → rail → popover → cross-page hop → bead back; drag → menu → merged hops; cold-open every §7 link and assert restored state | Playwright, iPhone + Android viewports, touch | smoke every push (Loop 2); full nightly |
| Visual regression | golden screenshots, `plain` skin: 5 pages — 1, 7, 9, 19, 604 — each in the highlight states it is *for*, plus a marquee row. Five was always the number; what Loop 7 added is that the five are five geometry classes rather than five pages (`e2e/golden.spec.ts` argues each one), so the fifth can fail in a way the first four cannot. The tajweed half of the axis is live and deliberately empty — follow-up ⑧ | Playwright toHaveScreenshot | Loop 2; the five pages Loop 7 |
| Desktop layout | the one layout no phone project can reach: the spread exists above `1024×740` and does not exist below it (asserted as *absent*, not hidden — a hidden leaf has already paid its ~170 KB), the right-hand leaf carries the lower page number, and the un-vendored facing page reads as absent rather than as blank paper. Geometry against the real RTL flow, because DOM order only becomes *sides* once the flow has run — a `row-reverse` passes every component test and puts the mus'haf on backwards | Playwright `desktop` project, 1440×900 (`e2e/desktop.spec.ts`) | Loop 7 desktop work |
| Stage geometry | the page measured against the stage around it: a hop to either end of a page covers the layer, no drag can uncover it, and at rest the page is centred in the stage rather than flush against an edge. Deliberately not a golden — the crop is the SVG element, so the one thing that can be wrong is outside it | Playwright bounding boxes (`e2e/stage-fit.spec.ts`) | Loop 6a defect fix |
| Perf | Loop 1 spike in CI: trace pan/zoom + highlight-toggle on densest page, assert frame budget; TTI <2.5s throttled; JS <150KB gz; shard <50KB gz | Playwright traces + Lighthouse CI | budgets Loop 0; traces after Loop 1 |
| A11y | axe-core on every screen; keyboard-only hop tour (tab → select → rail → hop → back); manual VoiceOver + TalkBack each loop exit | axe + Playwright + manual | Loop 3 |
| Offline | pin a juz → offline → navigate/hop within it; simulate eviction (clear Cache, keep IndexedDB manifest) → app offers re-pin; persist() denial renders warning | Playwright offline | Loop 6 |

### Data/ETL testing (the scripture layer)

- **Determinism:** two consecutive `pnpm etl` runs are byte-identical (hash outputs in CI).
- **Resolution gate:** 100% of edge endpoints resolve in anchor tables; 100% of SVG
  polygons appear in anchor tables (both directions — no orphans).
- **Cross-source reconciliation:** anchors vs QUL layout DB; any surah/ayah/page
  disagreement fails the build with a diff report.
- **Golden ayahs:** ~30 hand-verified ayahs (first/last of surah, juz boundaries, sajda
  marks, pages 1 and 604) asserted every ETL run.
- **Edge spot-audit (human):** weekly during Loops 4–7, 20 sampled pairs vs a printed
  mushaf; a hafiz signs off mutashabihat diffs before v1.0. Tajweed skin ships behind a
  "beta" flag until hafiz approval. The runbook is `edge-spot-audit` in
  `docs/validation/ledger.json` — read it with `make validate CHECK=edge-spot-audit`.
  Draw with `make audit-edges N=20 SEED=1`: seeded, so a round can be re-run or handed
  to a second reader, and **stratified** by type × provenance × page distance, because
  97% of the corpus is one class and a flat draw of twenty essentially never shows the
  classes no gate covers. `make validate` prints which classes have never been looked at.
- **License gate:** build fails if any source lacks a `SOURCES.md` entry.

### How a manual result becomes a permanent test

The checks a machine cannot run are the expensive ones, and until now their results
lived only as prose in decision records — which cannot answer "is that still true, on
what device, and when?" without reading four documents. Two gates close that loop:

- **`gate:verified-edges`** — every human verdict about an edge, enforced forever.
  `correct` edges must keep shipping; **`wrong` edges must stay gone**, which is the
  half that pays: a rejected edge nobody wrote down returns on the next data refresh
  and costs that reader's time again, and no automated check can tell a wrong edge
  from a right one.
- **`gate:validation`** — the ledger at [`docs/validation/ledger.json`](validation/ledger.json):
  every manual check, what it blocks, what it **tunes**, and the runbook to run it. It does
  *not* fail on outstanding work (a phone nobody has held yet is a fact, not a broken build,
  and a permanently red gate teaches everyone to ignore it); it fails when the ledger lies —
  a `done` with no recorded result, an expired recurring check, a check that tunes nothing,
  or a pending human check with no runbook. `make validate` prints what the project is
  waiting on and what each blocks.

**Running one.** These checks happen with a phone in your hand, so the instructions have to
reach the phone: `make guide` renders the ledger to
[`docs/validation/guide.html`](validation/guide.html) and serves it over the LAN — one card
per check, every step paired with what you should **expect** to see, a screenshot of the
screen the step is describing, and checkboxes that survive a screen lock. The screenshots
are captured from the real build by `make shots`, never pasted in by hand — prose about a
screen is not the screen, and a hand-cropped picture is a second copy of the UI that drifts
silently. `make validate CHECK=<id>` prints the same runbook here;
`make record CHECK=<id> RESULT='…'` banks the verdict, regenerates the guide, and prints the
`tunes` work now owed. One source, three renderers — a runbook restated anywhere else drifts
silently, so this document deliberately names ids instead of steps.

**Run the machine half first.** Parts of these checks stopped needing a human as the
follow-ups landed, and a check may say so: an `evidence` block naming one command, the
runbook step **ids** it discharges, and — required — the `residue` it cannot.
`make validate-auto` runs those commands and writes the real exit code into
`docs/validation/evidence/`, which is what strikes a step off the terminal and the phone.
A run is written, never asserted, and exit 3 ("could not tell") discharges nothing — a
producer that could not reach its subject has proved nothing, and treating that as a pass
is how an automated run comes to look like it did someone's job. The rest is the point:
`gate:validation` rejects an `evidence` block that names no remainder.

**The rule:** a manual result must tighten something automated — a threshold, a
fixture, or a new gate. A check that feeds nothing has to be re-run by hand forever,
and it won't be. The full catalogue of every tier, in cost order, with the traps, is
the `validate` skill: [`.claude/skills/validate/SKILL.md`](../.claude/skills/validate/SKILL.md).

### Device matrix (manual, each loop exit)

Primary: mid-tier Android (the TTI budget device) + iPhone, both installed-PWA and
browser-tab. Secondary each ~2 loops: 320px phone, iPad, desktop. The 8+ day ITP offline
survival test (installed vs tab) runs once in Loop 6.

## 7. The loops

### Loop 0 — Skeleton on a phone (small) — ✅ complete ([loop-0.md](decisions/loop-0.md))
pnpm workspace; ESLint boundaries; Vitest + Playwright mobile; CI (lint, test, **JS-budget
gate**, **license gate** reading `SOURCES.md`); design tokens + `dir="rtl"` shell; PWA
manifest + install-prompt scaffold; Cloudflare Pages deploy. Extract the mock's 3 pages
(7, 9, 19) + polygon metadata from `linker-mock.html` into `public/assets/`; **audit
quran-svg corpus completeness** and record licenses in `SOURCES.md`.
**Exit:** deployed installable shell showing page 7; CI green with gates.

### Loop 1 — Select + the performance verdict (small; de-risks everything) — ✅ interactions complete; perf verdict deferred to on-device ([loop-1.md](decisions/loop-1.md))
`keys.ts`, `resolver.ts` (ayah-polygon adapter over the 3 pages' `verse-N` /
`number="SSSAAA"` attrs); `PageStage` inline SVG; @use-gesture pan/zoom with `touch-action`
+ pinch/drag disambiguation; tap polygon → highlight + `onSelect`.
**Perf spike (the loop's real product):** fps of pan/zoom + highlight toggle on mid/low
Android and an older iPhone across the densest bundled page → decision recorded (inline SVG
everywhere / content-visibility virtualization / raster-glyph fallback). Observe RTL
page-turn conventions in quran.com + Tarteel, record decision.
**Exit:** tap-to-select on-device; written perf verdict + RTL decision in `docs/decisions/`.

### Loop 2 — The hop (medium) ← the product exists after this loop — ✅ complete ([loop-2.md](decisions/loop-2.md))
Adjacency shards for the mock's curated clusters; `adjacency.ts` (dir bucketing, hifz
popover ordering); `HopRail` (arc-arrow chips ↻◀▶ + counts); `HopPopover`; `navigateTo`
(cross-page load, pan, pulse; only current+adjacent mounted); breadcrumb group;
`TrailBeads`. Bottom-sheet popovers <900px; 44px targets.
**Exit:** tap 2:48 → rail → popover → hop to 2:123 cross-page → bead back, one-handed on a phone.
**Shipped it:** `adjacency.ts` + `view.ts` (pure math) in core; the multi-page `PageStage` with
a single-`view` RAF hop-tween (owns the transform); `HopRail`/`HopPopover`/`TrailBeads`;
`build-adjacency.mjs` ETL → committed surah-2 shard, deterministic in CI. Full hop tour green on
WebKit + Chromium. Un-vendored targets surfaced-but-disabled (no ghost page). LRU-6 eviction and
the token DiffView deferred to Loops 4 and 3 respectively.

### Loop 3 — Diffs, share links, a11y pass (medium) — ✅ complete ([loop-3.md](decisions/loop-3.md))
`DiffView` (token diff, twin label, ctx continuation); hash router = spec §7 via
`serializeState`/`restoreState` (same path as live hops); `via`/`trail`/`w`/range forms;
`ShareSheet` (Web Share API + clipboard fallback). A11y: SVG `role="group"` + labels (an `img`
can't hold focusable ayah buttons — axe caught it), per-polygon `aria-label` + keyboard hop path;
VoiceOver/TalkBack on-device check → deferred to follow-up ④ (automated axe + keyboard tour green).
**Exit:** cold-opening a teacher link restores exact view incl. trail; screen reader announces ayahs and hops.

### Loop 4a — Edge-data ETL (medium, pure data work — **ungated**)
*Why the split (2026-07-25 grounding):* edge data is key-space math — it never touches the
rendering hot path, so it does not need the perf verdict (follow-up ①) that gates page
vendoring. Sources verified live:

- **Primary edges:** [Waqar144/Quran_Mutashabihat_Data](https://github.com/Waqar144/Quran_Mutashabihat_Data)
  — `mutashabiha_data.json` with `src` (absolute ayah number or array), `muts` (matching
  absolute ayah numbers), `ctx` (show-context flag; maps to our ctx-continuation line in
  DiffView). License: permissive custom ("free to use as you see fit", attribution
  appreciated) → record verbatim in `SOURCES.md` and put the credit in the app's about
  screen. Battle-tested by the author's own
  [quran_memorization_helper](https://github.com/Waqar144/quran_memorization_helper).
  ETL converts absolute ayah numbers → canonical `quran/<edition>/S:A` keys via the
  known 6236-ayah surah table (already in `keys.ts` domain).
- **Anchor cross-check:** [QUL mushaf layouts](https://qul.tarteel.ai/resources/mushaf-layout)
  (SQLite downloads). Three Madani KFGQPC layouts exist — **V1/1405H (id 15), V2/1421H
  (id 10), V4/1441H (id 19)**; first 4a task is to sample-match our quran-svg pages
  against them to pin *which print* our corpus is, then vendor that layout DB as the
  reconciliation source. Ayah→page agreement is the gate; line-level data is not needed.
- **Demoted: QurSim** ([LREC 2012](https://aclanthology.org/L12-1051/)) — the grounding
  pass showed it is *semantic relatedness* (7,679 verse pairs graded 0/1/2, derived from
  Ibn Kathir), **not** lafẓi mutashabihat, and has no canonical download endpoint. It is
  no longer a Loop 4 source; if it ever lands it is a separate reserved edge type
  (`related ⚯`), someday-scoped.

Work: full-corpus edge ETL → canonical keys → dedupe → dir annotations →
`adj/<surah>.json` shards for all 114 surahs; validation gates (100% of endpoints parse to
valid keys per the surah table — full anchor resolution moves to 4b where the pages exist;
shard <50KB gz; license entries). Edges to un-vendored pages stay surfaced-but-disabled
(the Loop 2 behavior) until 4b vendors the corpus.
**Exit:** `pnpm etl` deterministic in CI over the full mutashabihat dataset; every edge
endpoint a valid canonical key; all shards within budget; hop rail live on real data for
the 3 vendored pages.

### Loop 4b — Page corpus + streaming (large — **complete**, [loop-4b.md](decisions/loop-4b.md))
Vendor all 604 [quran-svg](https://github.com/quranpedia/quran-svg) Hafs/KFQC pages (CC0
overlay + KFQC free-use terms — see follow-up ②); anchors over all 604 pages,
cross-checked against the QUL layout DB pinned in 4a (fail on any surah/ayah/page
mismatch); **asset decision point:** evaluate the word-granular ligature corpus
([MushafDatabase](https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG) is
a candidate) — its resolver adapter fits behind the same L2 API. Page streaming:
fetch-on-demand, LRU ~6 pages, prefetch hop targets + adjacent pages; PWA caching of
visited juz.
**Exit:** every ayah navigable; 100% bidirectional anchor resolution; first-page TTI
<2.5s mid-Android.
**Shipped 2026-08-03.** The asset decision point came out **NO for now, on evidence** — the
vendored corpus is ayah-granular and the candidate does not state its print; follow-up 13
carries the test that decides it. The manifest went the other way from the projection
(1,333 B gz for the whole print, not ~109 KB), which deleted `backlog.md` ⑪ instead of
sharding it. Streaming landed as specified plus a rule the spec did not name: the LRU keeps
recency as well as a ceiling, and the desktop spread splits one budget between its two
leaves rather than taking it twice (`backlog.md` ③ ④).

### Loop 5 — Highlight gesture + root lens (medium)
`gestures.ts` marquee/pan split (touch-action zones + intent thresholds); amber wash;
`HighlightMenu` (merged deduped edges of the range, range-form copy link); roots ETL
([Quranic Arabic Corpus](https://corpus.quran.com/download/) — **GPL + terms of use**,
attribution mandatory; QUL morphology rejected, no license stated) + `RootLens` (page-distance sort, lemma
sub-groups). Word-granularity if Loop 4b adopted the ligature corpus; ayah-fallback
otherwise — Loop 5 can start after 4a (edges exist) and upgrade granularity when 4b lands.
**Exit:** drag 2:47–2:48 → menu → merged hop list; word/ayah → root lens nearest-page-first.

### Loop 6 — Offline + skin + editions (medium)

Split for the same reason Loop 4 was: **pinning a juz is meaningless while three pages are
vendored**, so the pack machinery inherits 4b's gate, while everything else is ungated and
ships now.

#### Loop 6a — Skin, editions, wayfinding, offline foundation (ungated)
Tajweed ETL (rule spans → element-ID class maps → `skins/`); `setSkin` swap; color-blind
palette; **"beta" flag until hafiz sign-off**. `EditionPicker` + concordance. Surah/juz/ayah
jumper; onboarding coach marks; keyboard map (arrows = pages, `/` = jumper). Service worker:
precache shell + registry, runtime-cache visited pages/shards. iOS install-prompt flow (the
ITP 7-day rule makes install a feature, not a nicety). `navigator.storage.persist()` +
`persisted()` with the graceful-denial UI and Chrome clear-on-exit detection — the *API
surface and its failure paths*, which are testable today. Golden-image regression harness
(moved from Loop 5; the amber wash and marquee need it). Lighthouse CI gate. Resolve the ⬡
collision (rail chip = curated shared-root edges vs lens = corpus-wide roots).
**Exit:** instant plain⇄tajweed toggle with identical geometry; jump to any surah/juz/ayah;
visited pages survive a reload offline; Lighthouse ≥90.

#### Loop 6b — Pin-a-juz packs (gated on 4b, i.e. on follow-up ①) — **complete-with-deferral**
Juz packs over Cache Storage + an IndexedDB manifest; eviction detection and re-pin offer;
the **8+ day ITP offline survival test** (installed vs tab); iOS standalone
state-restoration test.
**Exit:** airplane-mode revision of a pinned juz works after 8+ days.

Shipped in five slices — [`loop-6b.md`](decisions/loop-6b.md) — and the exit criterion is
split, deliberately, along the line the loop turned out to be about. *Airplane-mode revision
of a pinned juz works* is done and proven: `e2e/offline.spec.ts` pins juz 1, deletes every
copy outside the pack, kills the network, and opens a page the reader has never visited.
*After 8+ days* cannot be proven by anything in this repo — only a real phone deciding on its
own schedule can answer it, which is `offline-survival-8-day` in
[the validation ledger](validation/ledger.json) — a check that was *unrunnable* until this
loop, because it had no button to press, and whose runbook now names juz 1 as the thing to
pin. What the loop added in place of waiting is the thing that makes that
answer *legible* when it arrives: a pack that a sweep has taken is detected and said out
loud, and a pack a sweep half took is named `torn` rather than left looking kept.

### Loop 7 — Hifz polish + beta (ongoing) → web v1.0
5–10 huffaz/teachers; interview, don't instrument (privacy-respecting counts only). Weekly
data-QA (20 sampled pairs vs printed mushaf, hafiz sign-off on diffs). Popover ordering
tuning (same page → juz → earlier → later); keyboard map (arrows=pages, `/`=jumper);
golden-image tests on 5 pages; perf pass (shard prefetch on selection).
**Exit:** a revision session with a hafiz produces no navigation friction notes → **web v1.0**.

**All four engineering items are in** (2026-08-07): popover ordering is `orderForHifz` /
`hifzRank` in [adjacency.ts](../packages/core/src/adjacency.ts); the keyboard map is
[keymap.ts](../apps/web/src/keymap.ts); the shard prefetch reaches hop *targets*, not only
mounted pages (backlog ⑧); and the golden sweep is five pages. The last of those was the
only one still short — the harness had photographed 7, 9 and 19 since Loop 6a, which was
the whole print at the time it was written and became a sample only when 4b vendored 604
pages. Choosing the other two was therefore a decision nobody had had to make, and it was
made on facts rather than on coverage arithmetic: **page 1** is the only viewBox class
besides the default (`235×235` against `345×550`, so the one width-bound fit among
height-bound baselines) *and* the page `gate:pages` skips by name — the corpus's most
irregular page was its least-checked one, and a picture is the one instrument that asserts
no line pitch; **page 604** is the only structural class with surah headers on it (112,
113 and 114 all begin there), so it is the only shot that can see a band swallowed into the
ayah polygon beneath it, which is the exact shape of the defect PLAN 14 found eighteen
pages of. What is left of this loop is not a loop. It is a person: a hafiz, a mus'haf, and
an hour.

### Track B (gated on stable web beta) — Capacitor iOS, then Android
Wrap `apps/web`; bundle the full corpus in-app (offline by default); native share sheet;
**Universal Links** (links open the app — solves research §6 on iOS); haptics on hop-land
and bead taps; state restoration; iPad two-page spread; App Store review notes lead with
KFGQPC provenance. Android fast-follow (~95% shared code). Do not start until web v1.0.

### Someday — Reserved edges
Hadith/tafsir/lexicon edges: data drop + registry `status` flip only. No UI or highlighter
changes, per the additive-only registry design.

### Someday — Post-Sign-On Use Cases

Every reader-record decision that deferred an option to "the day there is sign-in" collects here,
so the sign-on milestone has one place that lists what it unlocks rather than a promise scattered
across five records. **None of these can be a row in `docs/use-cases.json` yet** — that register
refuses a use case with no runnable proof, and none of these can be proven until an account and
the per-reader cloud file behind them exist. They are recorded as wants with a named gate.

**When can we work on these?** All of them wait on the same thing that does not exist today: a
way for a reader to **sign in**, and the **per-reader cloud file** (in R2) that the
[storage model](decisions/storage-model.md) says a reader's records live in once they do —
written all at once whenever the reader changes something. That account system is not scheduled
into a loop; until it is, every use case below stays here. The app's own tracks bound it: a
personal cloud is only reachable at all from the installed phone app (**Track B**), which is
itself gated on web v1.0 and blocked on a licensing question the project is waiting on advice
for. So the honest answer to "when" is: **after sign-on is built, and sign-on is not yet on the
near-term plan.** Each use case below is already decided in *shape* by the record it points at —
what is missing is only the account and the cloud file to hang it on.

- **As a reader, my bookmarks follow me across devices.** On sign-in the bookmark set keeps my
  own cloud file, so a bookmark I dropped on one device is there on another
  ([bookmark-store, option C](decisions/bookmark-fold.md#what-was-decided-2026-09-02)).
- **As a reader, my notes sync to the cloud.** The notes I author survive a lost phone and appear
  on every device, synced on sign-in
  ([note-persistence, option D](decisions/notes-export.md#what-was-decided-2026-09-02)).
- **As a reader, my confusion map is backed up to the cloud.** The private record of where my
  memory slips keeps a cloud copy once I sign in, so it survives a lost phone
  ([confusion-map-export, option C](decisions/confusion-map-export.md#what-was-decided-2026-09-02)).
- **As a reader, my exported record can live in the cloud.** The portable annotation bundle —
  every note, its anchor and kind, plus the bookmarks — can be kept in my own cloud file, not
  only a file I save by hand
  ([note-export-shape](decisions/notes-export.md#what-was-decided-2026-09-02)).
- **As a reader, my first sign-in merges what I already have.** The set I built on the phone
  before signing in seeds my cloud file; a conflict between two devices is a later question
  ([bookmark-fold, folded-into-the-building](decisions/bookmark-fold.md#what-was-decided-2026-09-02)).
- **As a reader, my private question can gather with others' and reach a scholar.** Once there
  are accounts, similar questions across readers can be gathered and answered with references —
  the scholar use case in the next section, which is post-sign-on for exactly this reason.

### Someday — Questions a scholar could answer
A use-case-shaped want the owner raised alongside the mistake-marking decision, recorded here
because it is unbuilt and so cannot yet be a row in `docs/use-cases.json` — that register refuses
a promise with no runnable proof, and this has none. As the owner put it: **as a reader, I can pin
a *question* to a verse; and when enough readers ask a similar question, an answer from a scholar
(with references to the text) can appear against it.** The near-term, buildable slice is already
decided — the "question" kind of note and its anchor, in
[`mistake-marking.md`](decisions/mistake-marking.md#what-kinds-of-note-are-there-and-does-any-leave-the-phone).
What stays *someday* is everything past one reader's private question: gathering similar questions
across readers (which needs the accounts and the cloud the [storage model](decisions/storage-model.md)
waits on), a **new actor — a scholar** — with a way to answer and cite, and the surface that shows
a reader an answer to a question they did not ask themselves. When it is built it becomes a proper
use case: a `scholar` actor in `docs/use-cases.json`, a `hafiz` use case for asking, and a named
test that proves a cited answer reaches the reader — none of which exists to point at today.

## 8. Cross-loop rules

- **Assets are immutable** — never edited, styled only via CSS classes + the injected
  overlay group (`#hifth-overlay`).
- **Edition in every key, always.** No index arithmetic across editions; concordance only.
- **Licensing gate from Loop 0:** `SOURCES.md` manifest; CI fails on a source without an
  entry (QUL terms vary per resource — record each).
- **Mobile is the acceptance device** for every loop, not a retrofit.
- Each loop ends with: on-device demo → `docs/decisions/loop-<N>.md` → (re)scope next loop.

## 9. Execution convention

Two levels, both living in this repo (the external task tracker is retired —
§Status & tracking is the roadmap of record):
- **Roadmap** — the Status & tracking table. One row per loop (+ Track B); the status
  column carries the sequencing (linear through Loop 2; Loops 3 & 4a open after Loop 2;
  4b gated on follow-up ①; Loop 5 after 4a; Loop 6 after 4b; Loop 7 waits on 3+5+6;
  Track B gated on web v1.0).
  Exactly one loop in flight; a loop flips to complete only when its exit criterion and
  testing-plan tiers pass and both its decision record and the table are updated.
- **Per-loop working list** — created fresh at loop start from that loop's plan section
  (one item per deliverable), tracked in-session, closed as items land. The durable
  residue is the loop's decision record (decided / measured / deferred), not the list.
  Discovered work becomes a list item or an Open follow-up above — never silent scope creep.

### Agent strategy per loop

Guidance, not bureaucracy. Modes: **Explore** (read-only fan-out recon), **Plan**
(implementation-plan design), **general-purpose** (multi-step research + code), and
**Workflow** orchestration (deterministic parallel/pipeline fan-out — opt-in per run).

- **Loop 2** — single-context feature work: code inline; one Plan agent for the
  `navigateTo` cross-page mount/pan/pulse design before building.
- **Loop 3** — inline; run the a11y audit as a separate review-style pass (Explore) over
  the finished screens rather than mid-feature.
- **Loop 4a** — inline ETL code; per-surah shard validation is a small fan-out candidate.
- **Loop 4b** — the natural **Workflow fan-out**: per-surah anchor validation,
  cross-source reconciliation vs the QUL layout DB, and golden-ayah checks parallelize
  cleanly; the ETL pipeline code itself stays inline.
- **Loops 5–6** — inline feature work; Loop 6's offline/eviction matrix is a manual
  device checklist, not an agent job.
- **Loop 7** — inline polish; the 5-page golden-image sweep is a small fan-out candidate.

**Several agents writing one tree at once** — the Loop 6a configuration — has its own
protocol: [`PARALLEL-AGENTS.md`](PARALLEL-AGENTS.md). Two rules carry it (take the lock for
anything that builds or stages; commit by explicit path, never `--no-verify`), and the
merge pass in follow-up ⑦ is the third. Everything in that file is a Loop 6a failure
written down, including the thirty minutes of deadlock and the composition defect that no
single agent could see.

## 10. Non-goals (v1)

Audio, translations, tafsir reading, quizzes, user accounts, server backend,
editing/creating SVG assets, exhaustive phrase matching beyond curated hifz sets.

## 11. How to start a loop

One self-contained prompt per loop:

```
Start Loop <N> of Hifth. Read docs/PLAN.md (§Loop <N>) and docs/reference/linker-spec.md
first. Scope: exactly the Loop <N> deliverables — do not pull work forward. Definition of
done: the Loop <N> exit criterion, the applicable testing-plan tiers passing in CI, and a
demo I can open on my phone. Finish by writing docs/decisions/loop-<N>.md and telling me
exactly what to check on my phone.
```

`docs/PLAN.md` is the single source the prompt points at; each loop's `docs/decisions/`
writeup means the next loop needs no conversation memory.

The `Makefile` makes this executable: `make loop N=<N>` prints the prompt above with that
loop's plan section inlined; `make status` prints the Status & tracking table; `make ci`
mirrors the CI gate sequence locally; `make loop-verify N=<N>` runs the full gate + e2e so
a loop only closes green; `make phone` / `make perf` drive the on-device checks.
