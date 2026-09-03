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
