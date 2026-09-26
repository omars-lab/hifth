# Should the app take in the whole-verse twins the ruler knows and it does not?

**Status:** decided 2026-09-03 (omar) — **D**. The twins are found in the app's own
already-included word data, shipped as bare verse numbers, and the outside library is used only
to confirm the set is complete. The copy-nothing boundary is not reopened. The answer the record
was first written to weigh — reopening that boundary to take the ruler's pairs in — turned out to
be unnecessary; see "What else could be considered" and the pivot note in
`docs/issues/verbatim-twins-found-in-house.md`.

**Picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/similar-ayah-enrichment.html> — the
twins drawn on the real printed pages, at the size the app shows them, with the counts computed
from the checked-in measurement. Checked in as `similar-ayah-enrichment.html`, rebuilt by
`node scripts/build-similar-ayah-gap.mjs`.

Read the picture first. This file is the reasons; the page is the subject, and no paragraph here
substitutes for seeing two verses that are the same verse, sitting pages apart, now bridged.

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
otherwise, and the two are cross-linked in the register. The honest form of that question is not
"should we add these pairs" but **"are these twins the exception worth reopening the boundary
for."**

**The chosen answer sidesteps this entirely.** Option D finds the twins in the app's *own*
already-vendored word data — the verified Arabic the morphology corpus carries, read only at build
time, never shipped — and writes out nothing but verse numbers. Nothing is taken from the outside
library at all; it is left doing only what the boundary allows, measuring. So the collision above
is the reason A, B and C are on the page, and the reason none of them was chosen.

## What it was costing, and what the choice closed

Computed by the measurement this decision is built on, re-derived whenever that measurement pin is
rebuilt. The first column is what the app shipped before this decision; the second is after the
twins were added:

| | before | after |
| --- | --- | --- |
| look-alike links the app ships | 2,516 | 3,781 |
| of them the ruler also knows | 2.8% | 35.3% |
| strong look-alikes the ruler has that the app lacks | 781 | 149 |
| of those, scored a full word-for-word match | 635 | 3 |
| verses those full matches touch | 384 | — |

The cost of the old status quo was quiet: nothing broke, and a reader was simply not told about
these particular twins. But they are among the hardest verses to keep apart — a verse repeated
whole, in two sūras, with only its surroundings to tell it apart — and the bridge the app exists to
build was exactly the one it was not building there.

The three full matches that remain are not twins the app is missing. Held glyph against glyph they
each differ by at least a word — two by a single letter of spelling, one by a reordered ending — so
they are *near*-pairs, and the app's twin-finder is right to leave them out. They belong to the
open tail below, not to this count.

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
- **D — Find the twins in the app's own word data; use the ruler only to check the set. ← chosen.**
  The app never takes the ruler's pairs in at all. It groups its own already-vendored words by
  their rasm skeleton, at build time, and any two verses whose skeletons match in full are twins —
  the same per-word comparison the app already uses for the pairs it built itself. Only verse
  numbers are written out; no Qur'an text ships. The ruler is then held up beside the result and
  agrees almost exactly (636 pairs found, against its 635), which is what tells us the set is
  complete rather than lucky. Because every word of a twin is shared, the app's existing
  green-and-yellow marking washes the whole verse green with nothing left to build. This is the
  only option that connects the twins **without** reopening the copy-nothing boundary, and it costs
  less than B, not more.

## What else could be considered, and why it is not here

Finding these twins **without the ruler at all** was written into an earlier draft of this record
as the one thing the app could not do — "it ships no Qur'an text, only anonymous page artwork and
numbers, so it has nothing to compare word against word." That was true of what the app *ships* and
false of what it *builds from*. The verified Arabic of the morphology corpus has been vendored for
other work all along, read only at build time and never shipped; comparing verses word against word
there is exactly what it makes possible. The sentence was wrong, the option it dismissed was
available, and it is the one that was chosen — option D. The pivot is written up in full at
`docs/issues/verbatim-twins-found-in-house.md`.

Copying the ruler's verified text and fonts in wholesale was weighed when the boundary was first
drawn and turned down; it is not revived here.

## What would change the answer

The choice rests on the build-time word data being present and trustworthy. If that vendored corpus
were ever removed, the in-house finder would go with it and the question would revert to A/B/C — the
ruler's pairs, and the boundary. If the ruler and the in-house set ever drifted apart on which
verses are whole-verse twins, the disagreement would be the signal to look again; today they agree
to within a pair, which is why D is trusted.

## What this is not settling

Not the word-by-word marking of **near**-pairs — two verses that differ by a word or two, where the
app would mark what they share green and what they part on yellow, as it already does for its own
built pairs. That marking needs a per-word correspondence worked out on the app's own pages
(the ruler's word numbering does not survive the trip to the printed artwork), and it is the open
tail of this decision, not part of what D settled. The three full matches still in the gap are
exactly these near-pairs.

Not whether a verse should announce, on the page you are reading, that it resembles others — that
is a separate question about the reading surface. Not the copy-nothing boundary in general: D was
chosen precisely so that boundary did not have to be touched.
