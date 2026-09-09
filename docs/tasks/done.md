# Completed tasks

An archive, not a register — the session task tracker (`TaskList`) only shows what's still open,
so a task moves here once it's done rather than staying in that list forever. This file is not
the record of what was decided or found; that lives in the design docs, decisions, and commits
each task fed into. This is a dated pointer back to those, kept so a finished task isn't simply
deleted and forgotten.

Nothing here is hand-restated from those sources beyond a one-line summary — read the linked
commit or design-doc item for the actual reasoning.

## #209 — Rebuild the piece-union candidate script (reach-for-the-ink)

**Done:** 2026-08-19, commit `650ecbd` "Rebuild the piece-union script the doc's numbers came
from, so ㉜ has one".

The "reach for the ink" script behind item ㉘/㉙'s numbers had been run twice and discarded —
never committed, so nothing backed the two aggregate figures on record. Rebuilt as
`packages/etl/scripts/probe-piece-union.mjs`, reusing `readPageInk`/`shapeOf` from
`packages/etl/lib/ink.mjs`. Needed before #210 could test a guard against real per-mark candidate
output rather than two remembered numbers.

## #210 — Score an area-ratio cutoff against the 45 doubled ground-truth marks

**Done:** 2026-08-19, commit `e333652` "The guard ㉜ proposed catches a quarter of what it needs
to; both ways, three in four" — full writeup at
[`docs/design/mark-registration.md` item ㉝](../design/mark-registration.md).

Ran the rebuilt script against all 89 ground-truth marks with a settled reader answer. The guard
exactly as ㉜ proposed it — refuse only when a candidate grows past the shipped rectangle —
catches just 5 of 20 (25%) real disagreements, because 15 of those 20 are candidates that
*shrank*, which a one-sided "too big" test structurally can't see. The same measure read
**symmetrically** (flag both far-too-big and far-too-small) catches 15 of 20 (75%) at one false
flag among 52 good marks (94% precision). Verdict: the guard as literally proposed — kill; the
symmetric reframing — confirmed, and escalated as a revision to ㉜'s own test. Later doubled to
181 marks and re-cut at 1.75/0.571 by item ㉞ — see
[`hifth-continue.md`](../../.claude/prompts/hifth-continue.md) §1 for where that stands now.

## #46 / #47 — Graduate the page-bar decision winners into the app bar

**Done:** 2026-09-02, commit `1872644` "The page bar now does what its two questions decided"
(branch `graduate-page-bar-winners`) — reasoning in
[`docs/decisions/page-bar.md`](../decisions/page-bar.md) and
[`docs/decisions/graduation-losers.md`](../decisions/graduation-losers.md).

Both page-bar questions were settled by the owner to option C. **Detent strategy C**
(`tapButtonDetent`): each juz marker is a tap-to-open button that turns the book to that juz's
opening; on a fine pointer it swells as the cursor nears it (never during a drag, never eating the
drag), and touch gets a plain button. **Boundary-juz rule C** (`labelBoth`): a page a juz seam
cuts names both juz in the bar's bubble only — "Juz 3 → 4" / "الجزء ٣ ← ٤" — while the shelf and
wheel keep one juz each. Per the felt-losers decision (option A) the losing strategies A/B stay in
core and on the decision page; the app bar imports only C. Covered by
`apps/web/src/components/PageSlider.test.tsx` (24 cases) and `apps/web/e2e/pagebar-detents.spec.ts`
(7 cases, desktop project — the growth is a fine-pointer affordance).

## #48 — Tell a pointed correction apart from a hand one in the sitting pipeline (㉑ + ㉗)

**Done:** 2026-09-02 (branch `graduate-page-bar-winners`, not yet committed) — reasoning in
[`docs/design/mark-registration.md`](../design/mark-registration.md) items ㉑ and ㉗, both now
marked **fixed**.

A tap on the ink emits both a `placement` and a `wrong-shape` event carrying `how: "ink"`, but the
settle/report/score half never read `how`, so a single tap was counted as two goes and filed under
both hand words — a word tally read as a fault-gesture tally. `settle()` now stamps each row with a
`pointed` word, a `points` tap-count kept out of the hand `goes`/`reshapes`, and `placedBy`/`sizedBy`
saying which gesture set place and size. The ruling report splits "moved by hand, over N goes" from
"placed by pointing at the ink, one tap each" (with a guarded line that a tap is one statement, not
two); the scorer's word-frequency table now counts settled words rather than raw kinds, and keeps
taps out of the nudges-and-drags line. Guards: `packages/etl/scripts/lib/mark-settle.test.mjs`
(closedBy for ㉑), `packages/etl/scripts/settle-mark-report.test.mjs` (closedBy for ㉗), plus new
cases in `packages/etl/scripts/score-mark-report.test.mjs`. All 77 across the three files pass;
`pnpm gate:issues` accepts both closures.

## #49 — Measure ink extent under all 8,554 doubled marks vs drawn size (㉖ free half)

**Done:** 2026-09-02 (branch `graduate-page-bar-winners`, not yet committed) — the measurement
and its reading are recorded in [`docs/design/mark-registration.md`](../design/mark-registration.md)
item ㉖, which stays **confirmed**: this discharges the free half it said was owed, it is not a
code fix.

㉖'s free half asked for the one thing every placement pass could not: measure the ink extent
under *all* 8,554 doubled marks against the box we draw, accepted marks included, not just the
refused slice. Done by teaching `probe-piece-union.mjs` a `--set doubled` population and a
width/height + accepted-vs-refused breakdown, then running it over the whole-book rows (8,463 of
8,554 resolve to an ink piece). Finding: across the population the box is **not** too small —
84.7% sit within half a unit of their ink in both axes, the median box is a hair larger than the
ink, only 2.5% have ink past the box by more than half a unit, and the gap varies rather than
being one constant, confirming the reader's "varying branch" a second time and by a different
instrument. "Drawn too small" is confined to the refusal: accepted doubled marks 2.0% too-small,
refused 24.3% (a floor, since the middle-inside-box union drops a too-small box's far stroke).
Per-mark candidates written to `packages/etl/out/doubled-ink.json`; rebuilt any time by
`probe-piece-union.mjs --set doubled`. The item stays open because the per-mark size repair for
refused doubled marks is still unbuilt and untested — the free half only bounds its target and
forbids it from touching the accepted marks.

## #73 — Graduate H: auto-place trusted marks on their ink, hand-place the hard core

**Done:** 2026-09-03, commit `cab8c42` "Each mark ships where its own ink is, and the hard core
keeps the hand that placed it" (branch `graduate-page-bar-winners`) — reasoning in
[`docs/decisions/mark-placement.md`](../decisions/mark-placement.md) (decided H) and
[`docs/design/mark-registration.md`](../design/mark-registration.md).

## #74 — Fold both refused-mark refinements into the placement asset

**Done:** 2026-09-04, commit `d8443f3` "A refused mark reaches for its own ink, guarded, instead
of only tilting" (branch `graduate-page-bar-winners`) — item ㉜'s symmetric guard and the reach
correction, in [`docs/design/mark-registration.md`](../design/mark-registration.md).

## #75 — Reconcile the option-H decision page with the ship asset's per-mark reach (㊱)

**Done:** 2026-09-04, commit `a87e64b` "The decision page reads each mark's own reach, as the
ship asset does" (branch `graduate-page-bar-winners`).

## #76 — Sit the remaining 259 boundary-hit marks, or decide they ship as-is (㉛)

**Done:** 2026-09-05, commits `65671e3`, `77e7007` and `1db1b6b` "A hafiz sits the 259 edge marks
by hand; the code owes nothing more" (branch `graduate-page-bar-winners`) — item ㉛ in
[`docs/design/mark-registration.md`](../design/mark-registration.md).

## #78 — Corroborate the word-segmentation split against a disinterested third corpus (⑩)

**Done:** 2026-09-05, commits `5aacec0` "A third grammar reads the split the same way both
incumbents already do" and `d4c59f4` (branch `graduate-page-bar-winners`). The technique — count
the tag-independent split signature in a corpus that has no stake in either reading — is kept in
the `validate` skill.

## #79 / #80 / #81 / #82 — Reopen the page-curl question as live, felt options

**Done:** 2026-09-04, commit `f465818` "Reopen the page-curl question on a board where each turn
is felt by hand" (branch `graduate-page-bar-winners`) — the four steps (study the turn machinery,
build the option components behind one interface, the on-site options page, the register row and
§8① reopened in the record) landed together.

## #83 — Repair two off-grid ayah boxes (PLAN 17: 68:3 on page 564, 107:2 on page 602)

**Done:** 2026-09-06, commit `4d33246` "Stretch two short ayah tails to the foot of their line"
(branch `graduate-page-bar-winners`) — follow-up ⑰ in [`docs/PLAN.md`](../PLAN.md).

## #84 / #85 / #86 — Design the outside-library page toggle and open its two decisions

**Done:** 2026-09-06 and 2026-09-07, commits `51567fd` "Open two questions about the other page
library: check it, and draw from it in dev", `a5a4ebc` "Fold the hosted-database store into the
page-source design" and `1ced08b` (branch `graduate-page-bar-winners`). The two rows —
*qul-dev-draw-toggle* and *qul-page-cross-check* — live only on that branch; follow-up ⑲ in
[`docs/PLAN.md`](../PLAN.md) says how they are reconciled when the branches meet.

## #87 / #88 / #89 / #90 / #91 / #92 / #93 — The held copy of the outside library: what it is for, what it holds, and how it is drawn

**Done:** 2026-09-07 and 2026-09-08 on branch `qul-page-diff`, the run of commits from `2f15b32`
"Reopen the copy-none boundary for a store we hold, not the bytes we ship" to `a94052c` "The store
draws itself now, on our own site". In order: the store built text-free and gated where a byte
would be held (`f645acb`); the purpose of the held copy settled and the store pointed at the V4
pair (`68ccb0a`, decision [`qul-store-purpose`](../decisions/qul-store-purpose.md), #88 and #90);
every Qur'an-data source entering by one plugin interface (`24b783d`, decision
[`qul-etl-plugins`](../decisions/qul-etl-plugins.md)); the held copy's own licence check
(`d0a910a`, #92) and the reads banked in `SOURCES.md` (`69ddbfb`, `abb493f`, `d624371`); the whole
library drawn as one entity diagram with keys and counts (`e0b8daa`, #91) and the join map
graduated into [`docs/design/qul-data-join-map.html`](../design/qul-data-join-map.html) (#87, #89);
the copy loaded and the map saying so (`8c45b71`, `3b4bdcf`); and the full diagram plus the store's
own schema rendered on the site as
[`docs/design/qul-data-erd.html`](../design/qul-data-erd.html) (`a94052c`, #93).

## #94 — Build the dev page-diff workbench: the print beside the store's page, drawn in the library's font

**Done:** 2026-09-08 (branch `qul-page-diff`, not yet committed) — the story is follow-up ⑲ in
[`docs/PLAN.md`](../PLAN.md); the wrong turn and its fix are in
[`docs/issues/qul-diff-render-needs-font.md`](../issues/qul-diff-render-needs-font.md).

A reader pulls one page out of the held store into a gitignored fixture; a development-only page
that is not a build input stands the shipped print beside the store's page; each line carries the
verse and word run and a medallion where an ayah ends, and above it the words drawn in the print's
own font. Pages 1 and 300 register line for line, word for word. The font turned out to be one
file per page (each printed word is a single private character only its own page's file can
draw), so the library's general text face — fetched first — drew every word wrong; the
page-by-page pack (604 files) replaced it, served in dev only from the building tools' gitignored
cache. The owner's standing permission to fetch from the library while signed in was given here.
What is still owed — the shared component, the in-app overlay, the bundle gate, the tappable-area
comparison (follow-up ⑳) and the harakat question (follow-up ㉑) — is tracked in
[`docs/tasks.md`](../tasks.md).

## #95 / #96 — One drawing of the store's page, and the in-app overlay behind a build-time flag

**Done:** 2026-09-08 (branch `qul-page-diff`) — the story is follow-up ⑲ in
[`docs/PLAN.md`](../PLAN.md); where it lives is the `qul-page-diff` row of the code map.

The side-by-side workbench and the running app now mount the same drawing of the store's page.
In the app it is an overlay, not a swap: a pill in the corner flips print / store / both while the
tappable ayah shapes, the highlighter and the marks keep working underneath, and the whole road in
is one build-time flag (`make dev-qul`) so every normal build drops it. The store's lines are placed
from the app's own word boxes — the boxes fall into rows, the rows are the print's lines — and the
letters are sized by measuring the drawing once it is on the page, not by a number tuned by hand.
Two things the eye-check caught and the code now knows: the small signs in the gutter between two
lines are not a word tall and were bridging two rows into one on page 300; and the two opening pages
set every line to its own width, so a paired line takes its own row's measure, not the page's.
Checked on pages 1, 2, 3, 300 and 604 in both rooms.

## #97 — Gate the built public bundle: no held letters, no store loader, no dev-fixture path

**Done:** 2026-09-09 (branch `qul-page-diff`) — the story is follow-up ⑲ in
[`docs/PLAN.md`](../PLAN.md); where it lives is the `qul-page-diff` row of the code map.

The overlay is meant to compile out of every public build, and until now nothing looked at the
built bytes to prove it did. A new check weighs the shipped app — the entry page, the service
worker, and the hashed script and style files — and fails on the two things that can only be the
store. It does **not** fail on Arabic: the app's own interface has an Arabic locale (licence
notices, the printing's name, provenance), and a gate that refused that would be switched off in a
week. It fails on the store's held letters — the per-page font encodes each printed word as one
private character (a presentation form or a private-use code point), which the interface's locale
never uses — and on the loader's own words: the dev-fixture route, the overlay module, the dev
font family, the build-time flag, none of which survive a normal build because the branch that
names them is dropped. Calibrated against a real build (zero of both), and proved to bite by
planting a fake glyph and route and watching it fail, then reverting. Wired into all three places a
gate runs here (the quick sweep, the local mirror, the blocking job), which the wiring gate
confirms — thirty gates now, each in all three.
