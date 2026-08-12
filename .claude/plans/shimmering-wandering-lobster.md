# The correction is confirmed in direction and unresolved in size

## Context

Sixty marks were placed by hand on 2026-08-12 to answer §⑦ of `docs/design/mark-registration.md`
— *how far is our correction still out*. The result was banked as:

> residual (-0.073, -0.110) units against a precision of 0.03 → **adopt with the residual
> applied; only the down component is distinguishable from nought**

Re-interrogating the same transcript shows that second clause does not hold, and that the
session had two structural blind spots nothing in its output mentions. None of this changes
the headline — the correction is confirmed, decisively — but it changes what may be done with
it, and the registers currently overstate the case.

**Outcome:** the record says what the sitting actually established; the scorer stops making the
assumption that produced the overstatement; the answers a person gave come home from a downloads
folder into the repo; and the correction gets measured on all 604 pages instead of 40, which is
the input every remaining question needs.

### What the sitting established, corrected

| | |
|---|---|
| the correction points the right way | **yes, decisively** — 59/60, 98.3% [91.1–99.7] |
| the residual is a real distance | **not established** — see below |
| the correction is the right *size* | **unmeasurable from this session** |
| it generalises to unmeasured pages | **no evidence either way** |

**One.** The scorer treats 60 placements as 60 independent facts. They are 40 pages' worth of
fit, and two marks on one page share that page's error — which the data confirms (page
explains most of the across-axis spread, F ≈ 3.6 on 39,20 df). Clustering by page:

```
down    mean -0.110 · as scored ±0.054 [-0.215, -0.005]
                    · clustered by page ±0.061 [-0.230, +0.009]   crosses zero
```

It was marginal to begin with — the upper bound was −0.005 — so this is *not established at
95%*, not *refuted*. Most of the interval still sits below zero. The 59/60 headline is
untouched; nothing that lopsided is reachable by a clustering adjustment.

The lesson already existed in this repo and did not travel: `probe-mark-ink.mjs:369-383` says
in as many words that two marks on one page are not independent and that a plain interval on
a rate is therefore narrower than the truth. The placing scorer was written without it.

**Two.** `mark-shift.json` covers **40 pages of 604** (`sampled: 4000`, `minMarksPerPage: 20`,
`--pages-n` defaulting to 40 at `probe-mark-ink.mjs:387`). A trial needs a proposed move, so
all 60 placements necessarily came from those same 40 pages. **The session validated the
correction on its own training pages**, and neither the shift file nor the scorer says so.

**Three.** Across those 40 pages the proposed move barely varies — down spans −1.19…−0.81,
sd 0.085 on a mean of −1.0. With that little leverage the size of the correction is
unmeasurable: the gain came out −0.10 ± 0.68, so "exactly right" and "20% short" are
indistinguishable, and brute force will not fix it (~710 placements even sampling only the
extreme deciles). A ~11% gain error and a −0.11 constant are the *same number* on these pages.
They stop being the same number on a page whose correction is a different size — which is
precisely the 564 pages nobody has measured.

The three findings are one finding: **we measured 40 pages and asked those same 40 pages.**

### What was ruled out, and is worth keeping

These are real negative results and they narrow the problem usefully:

- **Not the mark.** Splitting the residual by mark name leaves *more* spread than a single
  number (0.425 vs 0.415 down; 0.545 vs 0.526 across). The rectangle is not anchored wrong
  inside particular glyphs. An early read that shadda drove the residual did not survive the
  model comparison.
- **Not a stretch.** No dependence on where the mark sits on the page (t = −0.5 down), so the
  fit is off by a translation, not a scale.
- **Not the starting point** (slope 0.00) and **not fatigue** (slope 0.000 against trial
  order). The evenly-spread starts and the interleaved repeats both did their job.

So it is a per-page frame error, which is where §⑦ already believed it was.

## Code audit

| where | what is wrong |
|---|---|
| `score-mark-nudge.mjs:122` `meanCI` | independence across placements; needs a page-clustered standard error. Used at `:168-169` for both reported components. |
| `score-mark-nudge.mjs:161` `wilson(...)` | same assumption on the headline rate. Survives it here, but the output should say the denominator is pages-worth-of-fit, not independent trials. |
| `score-mark-nudge.mjs` (absent) | no estimate of whether the correction is the right *size*, and no statement that the sample had no leverage to find out. A silent blind spot is worse than a wide interval. |
| `score-mark-nudge.mjs` (absent) | never says the placements came from the same pages the correction was measured on. The largest limitation of the whole session appears nowhere in its report. |
| `probe-mark-ink.mjs:1136-1148` shift emit | records `sampled` and `minMarksPerPage` but not page coverage. Nothing downstream can tell the file describes 6.6% of the mushaf. |

Nothing is wrong with the arithmetic. Every defect is a **claim the output does not qualify**,
which is the failure mode this project's whole validation shape exists to catch.

## Work

### A. `score-mark-nudge.mjs` — say what the sample can and cannot support

Four additions. All reporting; the residual itself does not move.

1. **Cluster the interval by page.** Keep `meanCI` for the naive number and add the clustered
   one beside it, so the difference is visible rather than swapped in silently. The verdict
   sentence at the foot reads from the clustered interval.
2. **Report the gain**, by regressing the residual on the proposed move, *with* the spread of
   the proposed moves printed next to it — that spread is what says whether the estimate could
   ever have meant anything.
3. **Report coverage**: how many distinct pages the placements came from, and how many of them
   the shift file covers out of 604. One line.
4. **Print the negative results** — by-name, by-position and by-order — because "we looked and
   found nothing" is the part a later reader will otherwise pay to rediscover. This is where
   the throwaway analysis behind this plan gets a permanent home.

Doc comments carry the reasons, in the register the file already uses. Extend
`lib/adjudication.test.mjs` with a case per new statistic against a hand-built fixture — the
clustered interval must be provably wider than the naive one on clustered input.

### B. Re-score, then correct the record from the scorer's own output

Not from the throwaway analysis behind this plan. `pnpm nudge:score` prints the corrected
numbers, and the registers quote what it printed.

- `docs/validation/ledger.json` — the `result` line of `placement-residual-by-hand`. The check
  stays **done**: it ran, it produced a result, and its result is the corrected reading. A done
  check leaving its question open is a normal outcome and not a contradiction.
- `docs/issues.json` ⑦ `a-preference-does-not-say-how-far` — back to **open**. The question is
  literally *how far*, and the magnitude is unresolved; leaving it `answered` is exactly the
  quiet overstatement this repo's rules exist to prevent. The note records what the sitting
  did establish, so re-opening reads as progress rather than a reversal.
- `docs/issues.json` — **a new row**: the correction covers 40 pages of 604 and has only ever
  been checked on those 40. Distinct question, distinct row.
- `docs/design/mark-registration.md` §⑦ — heading back to **open**, with the sitting's numbers,
  the clustering correction, the three ruled-out explanations, and an explicit statement of
  what the session could not see. §⑩ ① is untouched — the forced choice is a separate
  instrument and its row does not move.

Then `pnpm issues:doc` && `pnpm gate:issues`; `pnpm guide` after the ledger edit.

### C. Measure all 604 pages

No code change — `probe-mark-ink.mjs` already takes `--pages-n` and `--shift-out`, and all four
downstream tools already take `--shift`.

```
node packages/etl/scripts/probe-mark-ink.mjs --pages-n 604 --sample <n> \
     --shift-out packages/etl/out/mark-shift.604.json
```

- **Time a 5-page run first** and multiply. The runtime of a full pass is unknown and opening
  a page is the expensive part.
- **`--sample` must hold `minMarksPerPage: 20`** across 604 pages, so ≥ ~15,000 marks, up from
  4,000. Confirm against the printed per-page counts rather than assuming.
- **Write to `mark-shift.604.json`, never over `mark-shift.json`.** The naming follows
  `mark-exemplars.${N}.json`. This is not tidiness: a forced-choice session is live at 5 of 100
  answers and pinned to fingerprint `c8528da9`; rewriting the file in place makes
  `adjudicate:score` exit 2 and throws those answers away.
- Add page coverage to the emitted file so nothing downstream can read it without knowing.

**Then stop and read it.** The one question that decides everything after: *do the per-page
corrections vary across the full mushaf, or are they all alike?* If they vary, the size of the
correction becomes measurable and another session is worth someone's time. If they are all
alike, a single global number is the right model, the residual is moot, and mark-C can proceed.

### D. The results live in the repo, not in `~/Downloads`

The answers a person gave are the primary evidence for every number in §⑦, and they currently
sit in one person's downloads folder where a browser will eventually clear them. The transcripts
already come home to `docs/validation/sessions/`; the answer files do not, and nothing says
where they should go.

**New directory: `docs/validation/rulings/`** — the raw answer files both scorers read. Named
for what the scorers themselves call them (`const ruling = ...` in both). Distinct from its two
neighbours on purpose, and the README says which is which:

| directory | what it holds |
|---|---|
| `sessions/*.jsonl` | the transcript — what a person did, step by step, as it happened |
| `evidence/<id>.json` | a machine run's exit code, written by `make validate-auto` |
| `rulings/` | **new** — the answers themselves, the input a scorer needs to reproduce a verdict |

Move `~/Downloads/mark-placements-23.json` in as
`docs/validation/rulings/2026-08-12T1650-placement-residual-by-hand.seed23.json`, pairing with
the transcript already committed under the same stem. The seed is in the name because the seed
is load-bearing — it is what rebuilds the answer key.

Audited before proposing it: 11.9 KB, no Arabic anywhere in the file, no NUL bytes, no field
that could carry anything personal — page numbers, mark indices, offsets and millisecond
timings. It is the same class of artifact as the transcript beside it, which
`sessions/README.md` already answers "yes, committed" for.

**And the file it must be scored against.** `packages/etl/out/mark-shift.json` is gitignored,
so a committed ruling still cannot be re-scored on a clean checkout — the verdict is auditable
only by someone who can rebuild the shift file first. That is a real gap and it is worth
closing in the same move: the shift file is 40 rows of page number and offset, derived from the
gitignored ligature cache but containing no ink and no scripture. **Proposal: commit
`mark-shift.604.json` from C** into `docs/validation/rulings/` beside the ruling it explains,
so the banked verdict re-derives from committed bytes the way everything else here does.

This runs against `probe-mark-ink.mjs:1129-1131`, which says the shift file "lands beside the
evidence page, which is not checked in" — but the reason given there is that the evidence page
draws the mus'haf's own artwork, and the shift file draws nothing. Flagged rather than assumed;
strike it and the rulings still come home, just less useful.

### E. The links

- `docs/design/mark-registration.md` "Where does this live?" — `score-mark-nudge.mjs` gains the
  clustering and coverage statements; the coverage caveat gets named where the commands are.
- `docs/map.json` — hand-edited. The existing rows for `score-mark-nudge.mjs` and
  `probe-mark-ink.mjs` gain the two facts a future reader needs before trusting either:
  placements cluster by page, and the shift file describes a sample of pages.
- `packages/etl/data/pages/PROVENANCE.md` — the coverage number belongs beside the data it is
  about, the way `probe-reference`'s 568/36/0 already does.
- `docs/validation/sessions/README.md` — points at `rulings/` so the pair is findable from
  either end, the same reason `docs/decisions.json` insists a relation is stated in both rows.
- `docs/validation/ledger.json` — the `save-the-placements` runbook step of
  `placement-residual-by-hand` currently ends at a downloads folder. It should end in the repo,
  or the next session's answers go the same way these nearly did.

## The next session, pre-registered but not built

Captured here so the design survives; **built only after C is read.**

- **Block 1, coverage** — ~40 marks, one each from 40 **held-out** pages: pages with a
  correction from the 604-pass that were not among the original 40. Answers *does it work where
  no eye has been?*
- **Block 2, structure** — ~20 marks over 5 pages, 4 each. Answers *how much of the spread is
  the page and how much is the hand*, which is what the clustered interval needs and what 40
  pages × 1.5 marks could never give.
- **A second reader** — ~20 marks drawn from reader A's set, same build, placed independently.
  This is the only thing that separates *the print is off by this much* from *this reader
  places boxes this way*. Needs a reader field in the session and the scorer. Agreement within
  ~0.05 says it is the print; a larger gap says a global residual should not be applied at all.
- Repeats stay as they are — the existing 15% mechanism measured 0.03 and worked.
- **The prediction goes in the ledger before the sitting**, so it can fail: applying
  (−0.073, −0.110) should return a residual of 0 ± 0.06 with "nearer ours" ≥ 90%. The same
  −0.11 again means it was applied to the wrong thing. +0.11 means it was fitted to one hand.

## What this means for mark-C

**Unblocked, with one constraint.** The per-page correction is confirmed in direction at 98.3%
and may be applied as measured. The extra residual is **not** applied — it is unresolved, and
0.11 units spread over 326,515 rectangles is a number that would have to be bought again.
mark-C needs the 604-page file from C first regardless, since it ships shards for every page.

## Verification

1. `pnpm nudge:score docs/validation/rulings/2026-08-12T1650-placement-residual-by-hand.seed23.json`
   — the corrected numbers, from the shipped tool, read from the repo rather than from a
   downloads folder. Every figure quoted into a register comes from this output, and the run
   itself is the proof the moved file is intact.
2. `pnpm --filter @hifth/etl test` (or the repo's vitest path) — the new statistics against the
   fixture, including the clustered-vs-naive assertion.
3. `pnpm issues:doc && pnpm gate:issues`, `pnpm gate:validation` after `pnpm guide`.
4. `git add -A && make ci`.
5. `adjudicate:score` on the live forced-choice ruling still exits without a fingerprint
   complaint — proof the 604-pass did not disturb it.
6. Commit code and docs separately.

## Operational

- `cd /Users/omareid/Workspace/git/hifth && ./scripts/with-lock.sh <label> "sh -c '<cmd>'"`, and
  re-export `PATH` inside the quoted command every time.
- Registers are hand-edited, never generated.
- Never `--no-verify`.

## Not doing

- **Applying the residual.** Unresolved, and the point of the plan.
- **Re-running `probe-mark-ink.mjs` over `mark-shift.json`.** A live session depends on it.
- **Building the next placing session.** Designed above, deferred until C is read.
- **Touching the forced-choice instrument** — `score-mark-adjudication.mjs` and §⑩ ①. Its
  headline is a rate over a lopsided count and does not depend on the assumption corrected
  here; it gets the same clustering treatment only if its own numbers ever come out close.
