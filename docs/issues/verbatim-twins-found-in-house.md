# The whole-verse twins did not need the ruler after all

**When:** 2026-09-03. **Where it lands:** `docs/decisions/similar-ayah-enrichment.md`
(the record it corrects), `packages/etl/scripts/build-verbatim-twins.mjs` (the new
generator), `packages/etl/scripts/probe-qul-rulers.mjs` (the ruler that now measures the
closed gap).

## What was believed

The `similar-ayah-enrichment` decision, as first written, framed the whole-verse twins as
something the app could only *take in* from the outside library (QUL), and weighed that
against the copy-nothing boundary (`qul-reliance`, decided "copy none of its bytes"). Its
"what else could be considered" section ruled out the obvious alternative in one line:

> Finding these twins without the ruler at all — the app cannot, because it ships no
> Qur'an text, only anonymous page artwork and numbers, so it has nothing to compare word
> against word.

That sentence is why the record's whole argument was about *reopening the boundary*.

## What the evidence showed

The claim is true of **shipped** bytes and false of **build-time** ones. The repository
already vendors the Quranic Arabic Corpus morphology (`packages/etl/data/roots/`, GPL,
provenance recorded there), and the ETL already reads it — `wordsByAyah()` in
`morphology.mjs` reduces every verse to the same rasm skeleton the edge builder compares on.
Grouping all 6,236 verses by that skeleton finds every whole-verse twin directly, at build
time, from our own vendored data. No ruler needed to *find* them; nothing but verse numbers
written out.

Measured against QUL's ayah-similarity corpus (id 74) as a pure ruler, the in-house set
lands almost exactly on the ruler's own "strong" line: floor of four rasm words yields 636
twin pairs where the ruler's whole-verse set has 635. The ruler's verbatim gap against what
we ship fell from **635 to 3** — and all 3 residuals are provably *near*-pairs, not twins:
they differ by at least one word (3:182 vs 8:51 and 17:48 vs 25:9 by a one-letter rasm
variance; 22:62 vs 31:30 by a reordered tail). Our exact-sequence detector correctly
excludes them, producing zero false twins.

## Why the approach changed

The dismissed option turned out to be the available one, and it is strictly better than any
option the record had drawn: it ships only numbers, it does **not** reopen the copy-nothing
boundary (the twins come from our own vendored corpus, not QUL's), and the ruler is left
doing exactly what `qul-reliance` says it may — measuring, not being copied. So the twins are
generated in-house (`build:twins`), joined as `twin` mutashabih edges by the adjacency
builder, and the existing span machinery washes the whole verse green because every word is
shared. QUL's role collapsed from "the source we might copy" to "the ruler that confirms the
set is complete."

## What is not changed by this

The word-by-word marking of **near**-pairs — where two verses differ by a word or two, the
green-and-yellow the app already does for its own built pairs — still needs a per-word
alignment worked out on our own artwork, and is deferred, not solved. That is the open tail
of `similar-ayah-enrichment`. The QAC-vs-print segmentation mismatch the record describes is
real and is what that pass has to cross; it does not touch the whole-verse case, where every
word is shared and the span is the whole verse.
