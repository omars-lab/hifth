# Should the app take in the whole-verse twins the ruler knows and it does not?

**Status:** open — no option chosen. Recorded 2026-09-03.

**Picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/similar-ayah-enrichment.html> — the
missing twins drawn on the real printed pages, at the size the app would show them, with the
counts computed from the checked-in measurement. Checked in as `similar-ayah-enrichment.html`,
rebuilt by `node scripts/build-similar-ayah-gap.mjs`.

Read the picture first. This file is the reasons; the page is the subject, and no paragraph here
substitutes for seeing two verses that are the same verse, sitting pages apart, that the app
connects with nothing.

## What this is

The app carries a set of look-alike verse pairs — the mutashābihāt a memoriser confuses — and
offers a bridge from one to the other. That set was built from *recurring phrases*: short
sequences of words that turn up in many places.

A separate library of Qur'an data, brought in only as a ruler to check the app's own numbers,
carries a *different* kind of look-alike: whole verses repeated word for word in two places. Held
up against the ruler, the app's set turned out to cover almost none of these. The two sets were
built to catch different things, and they succeed at different things; they barely intersect.

This question is whether the app should take the ruler's whole-verse pairs in — as **bare verse
numbers and no Qur'an text** — so a reader on one twin is offered the other.

## Why this collides with an earlier decision

The app already settled how it may lean on that outside library: it measures against it and links
out to it, and it **copies none of its bytes**. When that boundary was drawn, copying even the
library's bare layout numbers was on the table and was turned down.

Bringing the library's look-alike pairs in — even as nothing but pairs of verse numbers, which is
about as far from "its bytes" as a derived fact can get — is still taking a computed result out of
that library and shipping it. It reopens the copy-nothing decision. This record does not pretend
otherwise, and the two are cross-linked in the register. The honest form of the question is not
"should we add these pairs" but **"are these twins the exception worth reopening the boundary
for."**

## The cost of leaving it

Computed by the measurement this decision is built on, re-derived whenever that measurement pin is
rebuilt:

| | |
| --- | --- |
| look-alike links the app ships today | 2,516 |
| of them the ruler also knows | 2.8% |
| strong look-alikes the ruler has that the app lacks | 781 |
| of those, scored a full word-for-word match | 635 |
| verses those full matches touch | 384 |

The cost of the status quo is quiet: nothing breaks, and a reader is simply not told about these
particular twins. But they are among the hardest verses to keep apart — a verse repeated whole, in
two sūras, with only its surroundings to tell it apart — and the bridge the app exists to build is
exactly the one it is not building here. Nothing else is blocked behind this decision; it can sit
open indefinitely at no cost to anything else.

## What the ruler cannot tell us, and why it matters

The ruler numbers the words of a verse more coarsely than the printed page draws them: a verse the
page sets in seventeen word-shapes the ruler counts as fifteen, because the page splits some words
the ruler keeps whole. So the ruler's per-word match ranges **cannot** be laid over the app's
artwork — they would mark the wrong words.

This is why the option to take the pairs in splits in two. The app can always show *that* two
verses resemble each other (it crops both out of its own pages). Marking *where* they part — the
green-and-yellow the app already does for the pairs it built itself — needs a word-by-word
correspondence the app would have to work out on its own pages, because the ruler's numbering will
not survive the trip. The drawn page shows this directly: the identical twins are marked green in
full; the near-twins are shown resembling each other with no divergence marked, because that mark
is precisely what is not available for free.

## What was verified by eye

The ruler scoring a pair a "full match" is not proof the two verses are identical — the checked-in
counts are a machine's, and a machine cannot see the page. Every pair drawn on the picture was
looked at against the printed mus'haf before it was shown.

That check earned its keep. One pair — the verse about making the religion prevail, in its two
places — reads at a glance as differing in its last word, because the verse *before* it in both
places happens to end in that other word. Fade the neighbours and the two are plainly identical.
Had the pairs been drawn from the ruler's score alone, that one would have been mislabelled. The
generator draws only eye-checked pairs for this reason, and fades the neighbouring verses so the
verse's own words are the only ones that read.

## What people outside this project do

Not surveyed for this record. The mutashābihāt are a long tradition with printed indexes and
several apps that surface them, and a proper prior-art pass belongs here before the boundary is
actually reopened — it is not done yet, and this line is here so the absence is not mistaken for
"nobody does this." What *is* established is the one comparison that bears on the boundary: the
ruler's own set, measured against ours, which is what this whole page rests on.

## The options

Drawn on the picture; summarised here.

- **A — Leave the set as it is.** Keep the copy-nothing boundary whole. Costs nothing to build;
  the 635 twins stay unconnected. The status quo, and a legitimate answer: the boundary was drawn
  deliberately and these twins have sat unconnected without complaint.
- **B — Take in the pair numbers only.** Bring the twins in as bare verse-number pairs; offer each
  from the other, drawn from the app's own pages. Reopens the boundary the least. Does not give the
  word-by-word marking, for the reason above.
- **C — Take in the pairs and align the words too.** As B, plus the app computes the word-by-word
  correspondence on its own pages so the shared-and-differing marking works on these twins as it
  does on the app's own. Full parity; the most work; the alignment has to be eye-checked where a
  verse's word count differs between page and ruler.

## What else could be considered, and why it is not here

Finding these twins **without the ruler at all** — the app cannot, because it ships no Qur'an text,
only anonymous page artwork and numbers, so it has nothing to compare word against word. Copying
the ruler's verified text and fonts in wholesale was weighed when the boundary was first drawn and
turned down; it is not revived here.

## What would change the answer

If the app ever gained a text-bearing collection of its own, for any reason, the twins could be
computed in-house and the boundary would not need reopening. If the word-by-word alignment proves
cheap and reliable, C stops costing much more than B, and the choice collapses to "reopen the
boundary or not."

## What this is not settling

Not whether a verse should announce, on the page you are reading, that it resembles others — that
is a separate question about the reading surface. Not the exact shape imported numbers would take.
Not the copy-nothing boundary in general: only whether these twins are the exception worth making.
