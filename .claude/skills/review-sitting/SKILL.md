---
name: review-sitting
description: Work through what came out of a by-eye sitting — settle its answers into one row per mark, score it, read what it actually says, route the findings to the registers that own them, and rebuild the sittings nobody has sat yet so the next hour asks a better question. Use after somebody finishes or banks a sitting, when asked what a sitting found, when annotations need normalizing or deduplicating, or when a sitting's numbers look wrong. Every step ends in something checked in.
---

# Reading a sitting back

A sitting is an hour of the scarcest thing this project has. What comes out of it is
a list of events — this rectangle was pushed left, then a little back, then called
the wrong shape as well, then stretched — in a file that is not checked in, in a
format nobody reads, saying nothing anybody can quote.

Turning that into something the project keeps is five steps, and **the order is not
optional**: the first two produce the numbers, the third decides what they mean, and
the last two are the only reason the hour was worth buying. A sitting that ends at
step two has to be re-sat by whoever needs its answer next.

```
  settle    the events become one row per mark          → a ruling, checked in
  score     the rows become rates, per population       → a number with an interval
  read      what does it say, and what is it not saying
  route     each finding goes to the register that owns it
  rebuild   the sittings nobody has sat yet get rebuilt
```

## Words this uses

**Mark** — one vowel sign or other small mark of the print; the thing a rectangle is
drawn around. **Sitting** — one person, one hour, one screen full of marks, one at a
time. **Transcript** — the file a sitting hands over. **Ruling** — what this skill
writes: the settled answer, checked in. **Settle** — collapse everything said about
one mark into what the reader was left saying about it.

---

## ① Settle

```
pnpm report:settle packages/etl/out/<transcript>.json --rows packages/etl/out/mark-rows.line-tilt.json
```

Pass as many transcripts as you like; they are sorted by when they were handed over
and settled oldest-first, so a mark looked at twice settles on the later look. It
writes `docs/validation/rulings/<date>-mark-report-<set>.settled.json` — pass `--out`
if you want it somewhere else, and **always pass `--out` when you are only
experimenting**, or you overwrite a committed ruling.

### What settling does, and why it is not optional

The transcript records the **route**. What the reader said is the **resting place**.

A reader pushes a rectangle a unit left, overshoots, pushes it a unit right, and
moves on. Every scheme that reads the route gets that mark wrong, and the two
obvious ones get it wrong in the two most convincing directions: averaging the
presses says it never moved, adding up their sizes says it moved twice as far as it
did. Neither reads as an error. **This has already cost this project a number** — an
earlier scorer printed *nothing moved* for twenty-six marks that had every one of
them been dragged the better part of two units.

So both position and size settle to the last thing the reader did, and a
left-then-right, a grow-then-shrink, and eleven presses in a row all collapse to
where the rectangle was when they let go of it. Words gather and repeat once —
being called moved eleven times is one complaint, not eleven, and counting it eleven
times lets one stubborn mark outvote a whole page of easy ones.

What the route leaves behind is a separate count, and it is a finding about the
**controls** rather than about the mark: a rectangle that takes nine presses to
settle is one the pad is not letting anybody place. Moving and reshaping are counted
apart, because they are complaints about different controls.

### The two distances, which are never differenced

Each row carries two, and they answer different questions:

- **the reader's hand** — how far they moved the rectangle *we drew them*. This is
  how wrong our correction looked to somebody sitting in front of the print.
- **where they landed against what ships** — measured from the uncorrected box, so
  it carries our correction plus theirs. This is the one to set beside a measurement
  taken off the ink, because that one is measured from the same place.

The gap between them is only the correction already applied. Subtracting one from
the other tells you nothing and looks exactly like finding a discrepancy, which is
why both are written down under separate words.

### It refuses two things

A sitting taken against different displacements from the one on disk, and an answer
that disagrees with the displacements about which of the two placement rules drew a
mark. Both would file answers about marks that were never on the screen, or file
answers about one option against the other, and both come out looking like evidence.
If it refuses, do not work around it — find out which file moved.

---

## ② Score

```
cd packages/etl && node scripts/score-mark-report.mjs out/<transcript>.json --rows out/mark-rows.line-tilt.json
```

The settler writes the record; the scorer computes the rates. It prints them **once
per population and never once overall** — marks placed from their own ink and marks
fallen back to the printed line are two different options being decided between, and
a single rate over both is a fact about whatever mix the sampler happened to draw,
wearing the clothes of a fact about the mus'haf.

Neither script exits non-zero for bad news. A sitting that finds everything wrong
has done its job, and a build that failed for it would teach everybody to stop
sitting them. They exit 2 only when they refuse to read a file.

---

## ③ Read it

Four questions, in this order. The third and fourth are the ones people skip.

**What share of marks came back with a complaint?** Take it from the scorer, not the
settler: the settler's share is over the marks somebody *said something about*, and
the rate is over the marks they *looked at*, because passing a mark in silence is
itself a verdict that nothing is wrong with it.

**Is the interval narrow enough to mean anything?** Sixty marks cannot tell 2% from
14%. The interval is the finding, not the point estimate.

**Is this a measurement of the print, or of the sitting?** A population selected for
being hard comes back mostly wrong no matter how good the correction is. So does a
card that makes affirming cost more than faulting. Both are facts about the
instrument and both look exactly like a result. If every settled mark carries a
complaint, the settler says so out loud — read that as a prompt, not as a footnote.

**Did the count claimed match the answers given?** You cannot say something about a
mark you never looked at. The sitting page got this wrong once — it banked what was
*left* rather than what had been *seen* — and nothing caught it until the rates went
past a hundred per cent. Both readers now raise a low count to the floor and say the
file's name when they do. **That warning means a defect in the page, not a quirk of
the file**: go and find it.

---

## ④ Route the findings

Each kind of answer belongs somewhere different, and the routing is the point of
having a vocabulary of six words rather than one.

| what the reader said | where it goes |
| --- | --- |
| our rectangle is in the wrong place, or the wrong shape, or around the wrong ink | the correction itself — the rate is the evidence for whether the current rule stays |
| the print is odd here | `docs/issues.json` — a defect in vendored data, and the only route by which a reader's eye reaches the catalog |
| banked, could not say | read the notes; a run of these sharing a fault with no button is a measured statement that the vocabulary is wrong |
| it took nine goes to settle this one | the sitting page's controls, not the correction |

`pnpm report:settle … --issues` drafts the register row for the odd-in-the-print
marks and **prints it rather than writing it**. Paste it in by hand, edited. Every
register in this repo is hand-edited, always — a script that wrote to one would be
the second thing claiming authorship of a register meant to have exactly one. Then:

```
pnpm issues:doc && pnpm gate:issues
```

Anything that **distorted a measurement** gets a row of its own, whoever's fault it
was — ours included. That is this repo's line for a review tool: findings about
ergonomics do not get rows, findings that made a number wrong do.

### Then bank the check itself

```
make record CHECK=placement-what-kind-of-wrong RESULT='<the verdict, in words>'
```

The words are the artifact: a check marked done with no result is indistinguishable
from a check nobody ran. **Then do what its `tunes` step printed** — a manual result
has to end up tightening something automated, or it has to be bought again by hand
forever. The `validate` skill is the whole of that contract.

---

## ⑤ Rebuild what nobody has sat yet

This is the step that makes the next hour better than the last one, and it is the
one most likely to be forgotten because nothing fails when it is skipped.

Rebuilding does two things at once. It drops every mark that now carries a standing
answer, so the count actually falls — without that, a reader who has answered two
hundred marks is handed the same sittings with the same numbers on them and no
evidence anywhere that they did anything, which is a bad way to ask somebody for
forty more hours. And it picks up whatever step ④ changed about the page itself.

```
cd packages/etl
for n in $(seq 1 16); do
  node scripts/build-mark-report.mjs --rows out/mark-rows.line-tilt.json \
    --set fallback --seed 23 --part $n/16 \
    --answered out/mark-answers.jsonl,out/<transcript>.json \
    --out out/sit.fallback-$n-of-16.html
done
```

`--answered` takes the running log the serving side appends to *and* any handed-over
transcript, in any mix — they carry the same statements in the same shape, and a
reader should never be punished for having banked their work one way rather than the
other. A retraction takes a mark back out of the answered set.

**Do not restart the server to pick up a rebuild.** It reads each file fresh per
request, so a rebuilt sitting is live immediately; restarting mints a new token and
every page a reader already has open quietly stops banking answers.

Confirm the deal did not move: same number of parts, same total, and no mark that
has been answered coming back round again.

---

## What this skill will not do for you

**It will not decide whether the correction is good enough.** That is an open
decision with a record and an options page, and a rate is one input to it.

**It will not write to a register.** Every one of them is hand-edited. The scripts
draft; a person pastes.

**It will not settle sittings taken against different rectangles.** Two people
answering about different pictures is two sets of statements, not one, and merging
them produces a document that is wrong in a way nothing downstream can detect.

## The traps, in one place

- Pass `--out` on any run you are not intending to commit, or you overwrite a ruling.
- The two distances are never subtracted from each other.
- The share the settler prints is not the rate. The scorer's is.
- A count of marks looked at can only ever go up. If it went down, the page is wrong.
- The registers are hand-edited. All of them. Always.
- No Arabic text and no crop of the print is ever committed — the sitting pages draw
  the mus'haf's own artwork and stay in the gitignored output directory.
