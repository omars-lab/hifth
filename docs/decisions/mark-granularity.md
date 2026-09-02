# One colour a verse, or the letter itself?

**Status:** decided — **option B**, by omar on 2026-08-19.

**Picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/mark-granularity.html> (an earlier copy on another host: <https://claude.ai/code/artifact/5f230dff-e4e8-40c6-9c4e-888786eeef9b>) — three
options drawn over a real page of the mus'haf. Checked in as `mark-granularity.html`, rebuilt
by `node scripts/build-mark-options.mjs`.

Read the picture first. This file is the reasons; the page is the subject.

## What this is

Hifth colours tajweed by verse today: one tint per ayah, chosen for whichever rule is rarest
in it. `docs/design/sub-word-marks.md` measured what that wash actually shows a reader against
what the corpus already knows — a vocabulary of thirty-four drawn shapes, each pinned to one
name by elimination and checked against 62,931 held-out cases the matching never saw — and
found the two a long way apart: 83.29% of what the data knows renders as nothing, because a
verse gives its one colour to whatever rule is rarest and the other three or four rules in it
go unlit.

Three options: leave the verse-level wash as it is (A), colour the exact letter or mark a rule
names (B), or build the vocabulary and ship nothing yet (C). C is already true of the tree —
the vocabulary exists, unshipped, on purpose — so choosing between A and B was the real
question.

## Why B

A verse-level wash cannot get finer without losing legibility of a different kind: ten of the
eighteen rules name a consonant, not a mark, so they have nothing to light at letter
granularity and would need to keep painting the word — the split `sub-word-marks.md` calls
"an answer, not a shortfall." But for the eight rules that do name a mark, the print reaches
one almost every time: 98%+ for the wasla and madd families, 99.8%+ for iqlab. Coarsening
those down to a verse-wide tint throws away a distinction the data already makes correctly,
for no reason but that nobody had wired it up.

Leaving it as it is (A) keeps that loss permanently — not a stage on the way to something
finer, since nothing about shipping the verse wash forces the finer vocabulary to ever get
used. B is the option that spends the thirty-four-token vocabulary on what it was built to
answer.

## What this does not settle

Two questions sub-word-marks.md keeps open and this decision does not close:

- Whether a tajweed span lands on a mark that reads as *that rule* to someone looking at the
  page, rather than merely on a mark that happens to be nearby — still open, and answerable
  only by putting it in front of a reader, not by more arithmetic.
- Whether the corpus is worth the bytes it costs to ship — a probe until there is a shipped
  mark-granular highlight to weigh it against.

Both carry into the implementation task (mark-C on the task board), which this decision
unblocks rather than replaces. [Whose colours are they?](tajweed-colours.md) is the next
question this one opens: a mark-granular highlight is what would make a per-rule colour picker
mean anything finer than the seven groups already visible today.
