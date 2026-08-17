---
name: handling-sitting-iteration-feedback
description: Turn what a sitting found into a change in the placement rule — form the hypothesis from the reader's corrections, test it against the ink at corpus scale before believing it, score any candidate fix against the reader's own answers as held-out ground truth, and check it for regressions on the marks that already work. Use after review-sitting has read a sitting, when asked whether a sitting teaches the algorithm anything, when a by-eye pattern needs confirming or refuting, or when someone asks for better initial placement.
---

# Taking a sitting back to the rule

`review-sitting` ends by routing findings to the registers that own them. That is
where a sitting stops being an hour and starts being a record. This skill is the
step after: **does the record change the rule, and how would you know?**

It exists because the obvious way to do this is wrong, and it was done the wrong way
once here at full length before the mistake showed up.

## The trap, stated first

A reader corrects a hundred marks. You sort the corrections by the name of the mark
and a pattern falls out — these move sideways, those move down, these want growing.
It is a real pattern in real data and it is extremely tempting to write it into the
rule as a per-class offset.

**It is almost certainly a fact about which marks got into the sitting, not about the
marks.** A sitting is drawn from a population, and every population this project deals
from is *selected* — the fallback set is by construction the marks the ink search
refused, the bands are by construction the weakest matches. Whatever made them
eligible is the first thing any pattern in them is describing.

Worked example, and the numbers are the ones this file was written from. A part of 106
fallback marks came back sorted into three clean groups: single marks moved sideways
with size untouched, marks above the letter moved downward two to three times as far,
doubled marks barely moved but wanted growing. Coherent, linguistic, and it looked
like a per-class correction waiting to be written.

Fitting the production line rule over all 326,515 marks and measuring what it leaves
behind, class by class, killed it in one command:

```
class                         n   resid x   resid y
fatha                   121,277     0.011     0.013
sukun                    36,616    -0.022    -0.016
superscript alef          9,358    -0.032    -0.054
successive fathatan       2,897     0.001    -0.001
ALL                     322,011     0.004     0.002
```

Every class within 0.09 units of zero, on boxes about 6.3 by 3.4. There is no
per-class offset anywhere in the print. The reader's pattern was the shape of the
refusal criteria, seen from the inside.

## The order

```
  ① hypothesise    read the corrections, say what you think the rule gets wrong
  ② refute         test it against the ink, at corpus scale, before believing it
  ③ relocate       if refuted, the pattern belongs to the selection — go read the criteria
  ④ score          candidate fixes, against the reader's answers as ground truth
  ⑤ regress        what does the fix do to the marks that already work?
  ⑥ escalate       prefer a change that only fires where the old rule failed
```

Steps ② and ⑤ are the ones people skip, and they are the two that stop a plausible
finding shipping as a wrong one.

---

## ① Hypothesise

From the settled ruling, not from the transcript. Read the residual the rule actually
leaves — **`settled` minus `drawn`**, which is what the reader added on top of what
shipped.

Do not read `to`. It is `settled` minus `box`, measured from the *raw* rectangle, so it
contains the correction the rule already applied and will tell you the rule is far more
wrong than it is. Both fields are in every ruling and they differ by about a factor of
two; the whole of one wrong analysis in this repo's history is the two being swapped.

```
settled - box      what the mark needed in total, from raw
drawn   - box      what the rule already did about it
settled - drawn    what the rule still got wrong        <- this one
```

Group by whatever you suspect — the mark's name, the page, the line, where on the line
it sits. Medians, not means; a sitting has a handful of marks that really are somewhere
else and a mean will follow them.

## ② Refute

**Before believing any pattern, ask the ink.** There are 326,515 measured
displacements on disk in `packages/etl/out/mark-rows.line-tilt.json` and the fitter
that ships is importable, so the test costs one script and no reader:

```js
import { correctionFor } from "./lib/registration-grain.mjs";
const { apply } = correctionFor("line-tilt", rows);
// residual = r.dx - apply(r).dx, grouped by whatever you hypothesised
```

Marks with `ink < 0.02` estimate nothing and are dropped — that is what the production
`groupBy` does and your test must do the same or it is measuring a different thing.

Three outcomes, and all three are useful:

- **Confirmed at scale.** Rare, and worth a lot when it happens. Now you can fit the
  correction from 300,000 measurements instead of from a hundred hand-corrections,
  which is both more accurate and free of the pointing artefact.
- **Refuted.** The pattern is a property of the selected population. Go to ③. This is
  the common case and finding it out costs minutes.
- **The ink cannot see it.** Some things are genuinely invisible here — the search
  moves a rectangle but never resizes it, so *size* error does not appear in `dx, dy`
  at all and has to be got at sideways (see below).

## ③ Relocate — read the criteria, not the marks

If a pattern is a fact about the selection, the selection is defined in code and can
be read. For the placement sittings it is in `build-mark-report.mjs`:

```js
const atEdge = (r) => Math.abs(Math.abs(r.dx) - radius) < EPS || ...
const placed = (r) => r.iouBest >= iouFloor && !atEdge(r);
```

Two ways to be refused, and **they are different failures that want different fixes.**
Split the population by them before anything else:

- **hit the search radius** — the true answer is further away than the search looks.
  `dx, dy` is not a measurement, it is a value pinned at the boundary. The direction is
  still information: on 100 such marks the pinned direction agreed with the reader on
  92 across and 99 down. The search quits pointing at the answer.
- **found ink, matched badly** — the search could reach it and still scored under the
  floor. If the movement needed is small and the overlap is capped well below what a
  good match scores, the rectangle is the wrong **size**, and no amount of moving it
  will help. That is invisible to `dx, dy` and shows up instead as a class refused at
  several times the base rate while matching worse even when accepted.

The sanity number to hold: a mark the search is happy with scores about **0.909**.
Anything sitting at 0.45 has a shape problem, not a position problem.

**Then check that the criterion actually fires.** Reading it is not enough — a refusal
test is a claim about a measurement, and the measurement has to be able to support it.
The one here nearly cost the whole result:

```
"the search ran out of room"  ==  its offset came back exactly on the boundary
```

True only if the search cannot return an offset *past* the boundary, and it could —
its refinement pass swept around the coarse winner without being clamped to the
region, so a winner on the boundary let it step a quarter unit beyond. Every mark
that did so stopped looking like a refusal. **2,252 marks, 1,923 of them shipping as
successfully placed**, at a median match of 0.859 against 0.909 — nearly three times
the edge population that was being counted, all on the wrong side of it.

The general shape, and it is worth looking for by name: **a population defined by a
sentinel value is only as trustworthy as the guarantee that produces the sentinel.**
Ask what happens at the boundary, and prove it rather than reading it.

## ④ Score against the reader

This is what the sitting was bought for and it is the one thing the corpus cannot give
you: **a set of marks where a human has said where the box goes.**

Every candidate — including the one that ships — gets scored the same way, as distance
from where the reader put it:

```
hypot(candidate[0] - m.settled[0], candidate[1] - m.settled[1])
```

Report median, p90, and the share within one unit and within half a unit, with the raw
rectangle and the shipped rule as the two baselines. A fix with no baseline beside it
is a number nobody can size.

The one from this file:

```
answer                            median   within 1   within 1/2
the raw rectangle                  4.292          -            -
the printed line, as we ship it    1.974        31%          19%
the ink, searched +/- 3 (today)    1.816        40%          28%
the ink, searched +/- 8            0.099        84%          83%
```

**Ground truth is finite and does not regenerate.** Every candidate you score against
these marks spends a little of their independence. Score the two or three that matter,
not a sweep.

## ⑤ Regress — what does it do to the marks that already work?

**A fix is not measured on the population it was designed for.** The refused marks are
0.57% of the corpus; the other 99.43% have answers today that nothing in the sitting
questioned, and the only way to ship a disaster here is to improve the small half while
quietly moving the large one.

Re-run the candidate over marks that were *already accepted* and compare answers:

```
still accepted:      66,077 of 66,193 (99.82%)
answer moved > 0.5:   3,073 (4.64%)
answer moved > 2:     2,722 (4.11%)   <- the wider window snapping onto the neighbour
```

That 4.11% is the whole reason the fix below is shaped the way it is. A wider search
finds a *better-scoring* match that is the adjacent mark's ink, and it does it
confidently. There is no ground truth on those, so they cannot be adjudicated — only
avoided.

## ⑥ Escalate rather than replace

When a change helps the refused and disturbs the accepted, do not weigh them against
each other. **Make the change fire only where the old rule failed.**

```
search at the current radius, as now
  if that refuses this mark, and only then, search again wider
```

By construction the accepted marks keep their answer bit-for-bit, so the regression
risk is not small, it is zero. The cost is also near zero, because the escalation runs
on the fraction that failed rather than on the corpus.

**Then verify the by-construction claim, because it is a claim about code.** Re-run
and diff the accepted population against its old answers. Here that was 14,398 marks,
of which 14,046 came back byte-identical — and the 352 that did not were every one of
them a mark the old search had reported outside its own boundary, which is the defect
above rather than a breach of the guarantee. That distinction is the whole difference
between "the fix leaked" and "the fix uncovered something", and only the diff can tell
you which you have.

Check that the escalated rule still refuses honestly — a fix that accepts everything
has destroyed the signal that told you which marks to sit:

```
where the wide search accepts:  median error 0.090, 91% within half a unit
where it still refuses:         median error 1.543, 24% within half a unit
```

Its refusals are still the hard marks. That is what makes the next sitting worth
sitting.

---

## What this changes downstream

A fix that recovers most of a sitting population **deletes most of the queue**. That is
the point, and it is not the agent's call: it invalidates the current deal, re-deals
every part nobody has sat, and resets each reader's stored place. Say the size of it
and let somebody choose:

> fixing this shrinks the fallback population from 1,877 to roughly 165 — about 91% of
> the sittings you have queued stop existing, replaced by a smaller set of genuinely
> hard marks

Then finish `review-sitting` ⑤ and ⑥ against the new rows: rebuild the parts, run
`pnpm audit:sittings` with the same `--answered` list, `pnpm sit:index`, and do **not**
restart the server.

The answers already given do not go stale when the rule changes. They stop being a
queue of work and become the ground truth that proved the fix — which is worth more,
and is the only reason any of this could be measured at all.

## Where each finding goes

Same registers as `review-sitting`, and the split is by what kind of claim it is:

| the finding | where |
| --- | --- |
| the rule is wrong in a named way, reproduced, with numbers | `docs/design/mark-registration.md`, `confirmed` |
| something the ink refuted that a sitting suggested | the same item, as the correction — **leave the wrong guess standing beside it** |
| a fix that needs a corpus recompute before it can be judged | `docs/issues.json`, `severity: risk`, `owner: agent` |
| a number a reader has to re-check after the fix | `docs/validation/ledger.json` |

Leaving the refuted guess in the record is the house rule and it is load-bearing here:
the per-class theory was reachable, defensible, and wrong, and the next person to read
a sitting will reach for it again unless the document says out loud that it was tried.

## What this skill will not do

- **Believe a sitting on its own.** A hundred hand-corrections propose; 326,515
  measurements dispose.
- **Fit a correction to the reader's answers and then score it on them.** That is the
  one thing the ground truth cannot survive.
- **Ship a fix that was never run against the marks it was not designed for.**
- **Re-deal a queue without saying what it costs the person holding it.**
