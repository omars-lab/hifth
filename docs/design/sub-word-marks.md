# Sub-word marks: the level below a word, and the print that already named it

> Read this before answering "can Hifth highlight the tanween?" with the sentence
> [`skins.ts`](../../packages/core/src/skins.ts) has carried since Loop 6a. That sentence was
> true about the pictures we draw and false about the corpus we measure from, and this
> document is the measurement that settles which.

**Status:** design of record for the **named-mark layer**. The vocabulary and the extraction
are built and measured over all 604 pages (§③–§⑥); **nothing ships**, on purpose (§⑥). What
is not decided is whether a tajweed span corresponds to a mark a reader can be shown, and
whether the shards are worth their bytes — §⑧ ① and ②.

## How to read this, and what it is not

`docs/decisions/loop-*.md` record what a finished loop settled; `docs/design/` is what a
reader consults *before* changing a feature. This file covers
[`packages/core/src/diacritics.ts`](../../packages/core/src/diacritics.ts),
[`packages/etl/scripts/lib/diacritics.mjs`](../../packages/etl/scripts/lib/diacritics.mjs)
and [`probe-diacritics.mjs`](../../packages/etl/scripts/probe-diacritics.mjs).

Its companions, cited rather than restated:

- [`word-indexing.md`](word-indexing.md) — the level above. Its §⑪ ⑤ reconstructs the text
  the tajweed offsets are counted against, and lands 99.86% of 60,057 annotations on the
  letter their rule names. This document is what those annotations would be *painted on*.
- [`encoding-inspector.md`](encoding-inspector.md) — where the boxes get looked at. §⑧ ①
  is owed to it and cannot be answered anywhere else.
- [`SOURCES.md`](../../SOURCES.md) — the ligature corpus's provenance. No new upstream is
  involved here; this reads bytes already accounted for.
- [`docs/map.json`](../map.json), feature `word-geometry` — the code pointers.

**This is not a tajweed feature.** A mark the print draws and a rule a reader applies are
different things indexed against different corpora, and §② is about keeping them apart. It
is also not a text: nothing here holds, reconstructs or ships scripture — it holds
rectangles and integers.

---

## ① The claim this contradicts

`packages/core/src/skins.ts` says the tajweed skin ships at ayah granularity because the
print's "glyphs are anonymous outlined `<path>`s". That is exactly true of
`apps/web/public/assets/pages/**`, which is what the app draws: a page there is outlines,
and an outline does not know it is a fatha.

It is false of the ligature corpus — the second print of the same mus'haf that
[`word-indexing.md`](word-indexing.md) already reads for word boxes. There every mark is
drawn by a `<path data-type="diacritic" data-diacritic="…">` inside its word's group, named
by the publisher, with its own outline. The blocker was never that the marks are anonymous;
it is that they are anonymous *in the file we ship*. Those are different problems with
different costs, and the same comment already anticipated this: it names Loop 4b's ligature
corpus as its own gate.

The honest reading is that §① is a **stale comment**, not a stale design — the geometry it
was waiting for arrived and nothing went back to it. It is filed as such: §⑧ ③.

## ② Two things called a mark

The word shards already carry a field called `marks`:

```json
{"page":3,"words":{"2:6":{"from":1,"boxes":[[x,y,w,h]],"marks":[8]}}}
```

Those are **pause marks** — waqf signs, the sajdah, the juz star — and the integers are
*word* indices, because the print numbers a pause mark as a word of its own.
`gate:words` measures 4,486 of them and checks each one hangs no more than 4 units below
its ayah's polygon.

The marks in this document are a level down: a fatha, a shadda, a superscript alef, drawn
*inside* a word rather than beside it. The collision is why the asset kind is called
`diacritics` and not `marks`, and why `DIACRITICS` deliberately cannot name a waqf sign.
A pause mark is already flagged one level up, where it belongs.

## ③ The vocabulary, and why an integer

Twenty-six names. The number is measured, not chosen: it is the count of distinct
`data-diacritic` values across all 604 pages, in frequency order, with the counts written
into `diacritics.ts` beside each name.

| id | name | drawn | | id | name | drawn |
|---:|---|---:|---|---:|---|---:|
| 0 | fatha | 122,948 | | 13 | small waw | 1,257 |
| 1 | kasra | 45,970 | | 14 | small yeh | 995 |
| 2 | damma | 37,320 | | 15 | fathatan | 734 |
| 3 | sukun | 37,148 | | 16 | kasratan | 599 |
| 4 | shadda | 22,678 | | 17 | dammatan | 578 |
| 5 | hamza | 16,385 | | 18 | small meem | 270 |
| 6 | wasla | 13,483 | | 19 | damma iqlab | 134 |
| 7 | superscript alef | 9,726 | | 20 | fatha iqlab | 106 |
| 8 | maddah | 5,376 | | 21 | kasra iqlab | 99 |
| 9 | rounded zero | 3,988 | | 22 | rectangular zero | 66 |
| 10 | successive fathatan | 2,901 | | 23 | small seen | 8 |
| 11 | successive kasratan | 1,935 | | 24 | vowel sign | 3 |
| 12 | successive dammatan | 1,807 | | 25 | small noon | 1 |

A shard would say `0`, not `"fatha"`. A page carries about 540 marks and the names are the
larger half of the bytes, so the integer is the difference between an asset that is worth
shipping and one that is not.

**That makes the array's order load-bearing in a way nothing else in `@hifth/core` is.**
Appending a name is safe. Reordering silently re-labels the entire corpus — every fatha in
604 shards becomes a kasra — and changes no geometry, so no gate that measures rectangles
would notice. `diacritics.test.ts` pins six ids for exactly that reason, and the docblock
says the rule in one line: *appending is safe, reordering is not*.

**What the vocabulary excludes, and why.** The dots. `data-dots` carries three values across
105,269 paths and none of them is in `DIACRITICS`, because i'jam is what distinguishes one
letter from another — it is part of the letter's identity, not a mark a reader is told to
notice. A test asserts `isDiacriticName("two dots")` is false so the exclusion is a decision
rather than an omission. Pause marks are excluded for §②'s reason.

**And what a name is not a claim about.** "damma iqlab" records what the corpus wrote in an
attribute. It is not this repo asserting a recitation rule; nothing here says how any of
these twenty-six are pronounced, and §⑧ ① is where that question is allowed to be asked at
all.

## ④ The containment invariant

`build-words.mjs` computes a word's box as `union(pathBBox(d))` over **every** path in the
word's group — the letters and the marks alike. So a mark's box is inside its word's box by
construction, exactly, before rounding.

That is not a pleasing coincidence; it is what makes this data verifiable offline with no
second opinion. A mark that escapes its word cannot be a *geometry* error, because the
geometry is a subset of the geometry the word box was computed from. It can only be an
**alignment** error — a mark filed under the wrong word — which is the same failure class as
the off-by-one that made 47.8% of hop edges point at the wrong ayah, and the one worth
paying a corpus-wide pass to rule out.

Two things follow, and both are enforced rather than intended:

- **Nothing here fits anything.** `readDiacritics` takes its transform as an argument;
  `applierFromPin` rebuilds it from the four numbers `word-boxes.pin.json` already records
  per page. Re-fitting would create a second transform that could disagree with the first,
  and a mark that disagrees with its own word by a tenth of a unit is indistinguishable from
  a mark on the wrong letter.
- **Containment is checked against the committed shards**, not against boxes computed in the
  same pass. Two sides derived from one computation share their mistakes and agree about
  them.

## ⑤ What was measured

`pnpm probe:diacritics`, all 604 cached pages, 2026-08-07:

| measure | result |
|---|---|
| distinct `data-diacritic` values, all pages | **26 of 26** in `DIACRITICS`; none unknown |
| marks extracted | **326,515** |
| words carrying at least one | 86,964 of 91,451 |
| marks outside their own word's box | **0** (slack 0.2 — see below) |
| words with no box in the committed shard | **0** |
| smallest mark on our frame | 1.8 viewBox units |

The slack is 0.1 of arithmetic plus a decimal place of room, and it is **not** a tolerance
for misregistration. Both boxes are written to one decimal, so each edge can move 0.05 and
the two can move in opposite directions; there is nothing else to absorb, because both come
out of one fit applied to paths from one file.

**The 4,487 words with no mark are 4,486 pause marks and one word.** The one is
p312, 20:1 word 1 — «طه», the muqatta'at that opens its surah, which this print writes with
no vowel, no sukun and no maddah. Every other opening of that kind carries at least one.
That the residual came out as *the pause marks, exactly, plus a letter pair that visibly has
nothing on it* is the strongest evidence here that the extraction is filing marks under the
right words: an off-by-one would have scattered the empties.

### The ligature is the join to a letter

Containment (above) files a mark under the right *word*. It says nothing about which
**letter** the mark sits on, and a tajweed rule is a `[start, end)` over codepoints — so
without a letter-level join the app could highlight a rule no finer than the whole word,
which for «بِسۡمِ ٱللَّهِ» is most of a line. The corpus offers exactly one join, and it is
not the one the first attempt assumed.

**The rejected attempt.** Zip a word's mark-bearing codepoints against its `data-diacritic`
paths in document order. That gives **88.79%** count agreement and a visibly wrong pairing
tail (U+064E → shadda, U+0650 → wasla). It fails because the paths are grouped by
*ligature*, and `dots` and `kaf-hamza` paths interleave — so position within the word is not
codepoint order.

**What the markup actually offers** is one level below the word:

```
<g id="md-word-157" data-hafs="شَيۡـٔٗا" data-imlaey="شيئا">
  <g id="md-ligature-157-01">
    <path data-type="text" data-text="شيا"/>          ← the letters this run draws
    <g id="md-diacritic-157-01">
      <path data-type="diacritic" data-diacritic="sukun"/>   ← drawn on those letters
```

So `readDiacritics` returns the ligatures alongside the flat mark list, and
`probe:diacritics` **④** measures whether they partition the word: split `data-hafs` into the
letters the print outlines, walk the ligatures across that partition, compare mark counts.
All 604 pages, 2026-08-07:

| of 91,451 entries the print calls words | | |
|---|---:|---|
| draw no letters at all — pause marks, ۩, ۞ | 4,486 | 4.91% |
| **of the remaining 86,965** | | |
| join cleanly — letters partition, every mark count agrees | **86,962** | **100.00%** |
| no assignment of ligatures to letters exists | 0 | 0.00% |
| partition, but a ligature's mark count disagrees | 3 | 0.00% |

The per-ligature figure is 159,585 of 159,588, but that is conditioned on the partition
above, so the table states the unconditional number instead. Quoting the ligature percentage
alone would silently condition it on a filter the reader cannot see.

**Six print conventions had to be learned to get there**, each read off a markup dump rather
than assumed. Earlier drafts of the join read 88.79%, then 97.75%, then 99.90%; the number
moved each time a dump explained a family, and never because a rule was added to move it.

| the text writes | the print draws | example |
|---|---|---|
| a bare hamza `ء` U+0621 | an outline, like any letter — **not** a named mark | «إِسۡرَٰٓءِيلَ» |
| `\p{Lm}` modifier letters | the tatweel as a tooth folded into its neighbour; the small waw `ۥ` and small yeh `ۦ` as *named marks* | «شَيۡـٔٗا», «بِهِۦ» |
| a vowel then an iqlab meem `ۭ` / `ۢ` | one composite glyph, `kasra iqlab` | «كَافِرِۭ», «رِكۡزَۢا» |
| a seated hamza `أ إ ؤ ئ`, and `ٱ` | a base outline **plus** a named `hamza` / `wasla` path — **always**, whether the ligature spells `ا` or `أ` | «أَنزَلَ», «أَنَّ» |
| the small high madda `ۤ` U+06E4 | `data-type="sajda-line"` — the overline of a sajda ayah, not a diacritic | «خَرُّواْۤ» (19:58) |
| one letter | sometimes **two** ligatures, the second markless; and **not in reading order** | «فَلَا» → `[فلا\|ا]`, «ٱلرَّحِيمِ» → `[لر\|حيم\|ٱ]` |

The last row is why the check is no longer a left-to-right walk. `align` matches ligature
text to letters by **content**, as a search over which ligature draws which run, so a
ligature emitted last is assigned the letters it actually spells. That is strictly stronger
than the length comparison it replaced: «ٱلرَّحِيمِ» used to *pass* — six letters, six drawn
— and then misassign every mark while the totals balanced.

**Three entries remain, and all three are the corpus disagreeing with itself.** They are
named rather than absorbed, because a rule for either would be a rule for one word:

1. **«أَيۡدِيهِمۡ» at 21:28 and 22:76** — the word occurs 26 times. Twenty-four draw
   `hamza, fatha, sukun, kasra, kasra, sukun`; these two draw the same list without the
   `hamza`. Same spelling, same everything else.
2. **«لِيَسُـُٔواْ» at 17:7** — the print draws a `small waw` and a `maddah` its own
   `data-hafs` writes no codepoint for. It is the only word in the corpus where a `small
   waw` path appears without a `U+06E5`.

None of the three is an alignment error — ② already proves every mark sits inside its own
word — and none costs anything downstream, because ② is what decides whether the geometry is
shippable and ② is exact. What ④ bounds is how much of the corpus a *letter*-level highlight
can be offered on, and that bound is now the whole of it. That is the input to §⑧ ①, not its
answer: see §⑦ for what a count still cannot say.

## ⑥ What it would weigh, and why nothing shipped

Measured as the shard text `build-words.mjs` would actually write — a `from` and a dense
per-word list per ayah, empties kept because position *is* the word index:

**7.35 MB raw / 2.28 MB gz across 604 shards.**

Against `gate:assets`'s `MAX_MUSHAF_GZ` of 32 MB with the corpus at 27.87 MB today, that
fits. It is also 2.28 MB nobody has asked for yet, and shipping an asset with no reader is
the precise failure that gate already names for a non-vendored edition: *the download is
paid for and unreachable*. So mark-A ships **nothing** to `apps/web/public/assets`, and the
order is:

1. **mark-A** *(this)* — the vocabulary, the extraction, the corpus-wide measurement.
2. **mark-B** — draw the marks in the encoding inspector, beside the three encodings it
   already reconciles, and answer §⑧ ① with an eye on them.
3. **mark-C** — only then `build-words.mjs` emits `assets/diacritics/**` from the same
   per-page fit, `gate:words` gains the containment check, `gate:assets` gains a ceiling.

That order is also the answer the user gave when asked where the marks should appear first:
**the inspector, then the app**.

## ⑦ What this cannot answer

Whether a mark is on the *right letter*.

§⑤'s ligature join narrows this and does not close it. It shows that a ligature drawing
three letters carries the number of marks those three letters call for, for all but three
words in the corpus — which is what makes a letter-level highlight arithmetically possible
at all. But **counts are necessary and not sufficient**: agreement on three does not
establish that the second mark is over the second letter rather than the third. A word whose
marks were internally permuted would pass ④ exactly as a correct one does.

The probe prints the evidence for this against itself. Its `codepoint → name` tally is built
*only* from ligatures whose counts agree, and it still carries **611 pairings of `U+06E1` (a
sukun) with a path named `hamza`**. «بِٱلۡأٓخِرَةِ» on p2 is one of them: the run `لأ` is
written `ۡ` then `أ` then `ٓ`, and drawn `hamza`, `sukun`, `fatha`. Three marks wanted, three
marks drawn, ④ passes — and all three pairings are wrong, the third doubly so, since the
print names the madda glyph `fatha`.

So the tally's head is trustworthy and its tail is not, and no arithmetic distinguishes
them. That is precisely why mark-B puts the boxes on the page for a human before mark-C
ships anything that claims to know which letter a mark is on.

Nothing in this repo closes that gap offline, because it is a correspondence between a
codepoint in a reconstructed text and an outline on a page, and in the end only a reader's
eye settles it. Containment proves a mark belongs to its word; the ligature join proves the
counts work out per run; neither says the *k*-th mark is on the *k*-th letter. That is the
inspector's job, and it is why mark-B exists as a separate step rather than a review of
mark-C.

---

## ⑧ Open questions, and what would answer each

Every design doc in this repo ends under this heading, and every item is an
`### ⓝ … · **status**` row so `pnpm gate:issues` can read it. The vocabulary is defined once
in [`docs/issues.json`](../issues.json).

### ① Does a tajweed span land on a mark a reader can be shown · **open**

[`word-indexing.md`](word-indexing.md) §⑪ ⑤ puts 60,057 tajweed annotations on the letter
their rule names, 99.86% of the time, and 83.31% of them inside a single print word. This
document puts 326,515 named marks inside those same words. The question is whether the two
meet: when `madd_246` opens at a codepoint, is there a `maddah` box there — and if there is,
is highlighting *it* a truer rendering of the rule than washing the whole word?

**What would answer it:** the encoding inspector (mark-B). It already reconciles the print,
the ligature corpus, QAC and the tajweed offsets on one screen for one page; adding the mark
boxes puts all four descriptions and the geometry in one place where a human can see whether
a span and a mark coincide. Nothing offline can do this — the correspondence is between a
codepoint in a reconstructed text and an outline on a page, and only an eye closes that gap.

**What must not happen instead:** deriving the correspondence from the fact that both
numbers exist. Reading a mapping off where the offsets happen to land and then declaring
they land there is the circularity §⑪ ⑤ names about its own oracle, and it passes on a
broken answer.

### ② Are the shards worth 2.28 MB, and against what ceiling · **open**

§⑥ prices the tree. It fits under `MAX_MUSHAF_GZ` and it is still the second-largest asset
kind this repo would own, behind the pages themselves.

**What would answer it:** a caller. If mark-B shows that a mark-granular highlight reads
better than a word wash, the bytes buy something and mark-C spends them; if it does not,
this stays a probe and the corpus stays uncosted, which is a legitimate outcome and not a
failure. `word-indexing.md` §⑪ ① is the standing warning about the arithmetic: shipping an
*answer* costs multiples of shipping the *question*, so a `diacritics` ceiling must be set
from a build rather than from the 2.28 MB above, and `gate:assets` reviewed rather than
assumed — a kind it has never heard of fails it outright.

### ③ `skins.ts` still says the print's glyphs are anonymous · **confirmed**

`packages/core/src/skins.ts` justifies ayah-granular tajweed painting with the claim that
the print's glyphs are anonymous outlined `<path>`s. §① is why that is a half-truth, and
§⑤ is 326,515 counterexamples in the corpus the same comment names as its own gate.

Left as a defect rather than edited in place, deliberately: the comment is load-bearing
prose about why a shipped feature has the granularity it has, and rewriting it before the
replacement granularity exists would leave the file claiming a capability the app does not
have. It is closed by mark-C, in the commit that gives the skin something finer to paint —
or, if §⑧ ② answers "not worth it", by a correction that says the marks are named and
measured and still not shipped, which is a different sentence from the one there now.

### ④ A mark id is only meaningful against an array's order · **open**

`DIACRITICS`'s order is a wire format with no version in it. Today one test pins six ids and
one docblock states the rule; both are inside the package that would be doing the
reordering.

**What would answer it:** either a gate that reads the committed shards and asserts the
vocabulary they were written against — cheap once shards exist, meaningless before — or a
decision that the test is enough because the ETL rebuilds every shard from source in one
pass and a stale shard cannot survive a build. Deferred to mark-C on purpose: the risk does
not exist until something is shipped that an id can be stale *in*.
