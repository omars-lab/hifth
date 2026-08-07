# Word indexing: two numbers for one word, and the map between them

> Read this *before* joining anything to a word box. The number on the box is not the number
> the roots data speaks, and no rule converts one to the other — only a measured map does.

**Status:** design of record for the **print↔QAC word alignment**. Measurement is complete
and the map is built, gated and queryable (§4–§8). What is **not** decided is where the app
reads it from; that is §11 ①, and it is the only thing between here and
[PLAN follow-up 15](../PLAN.md).

## How to read this, and what it is not

`docs/decisions/loop-*.md` record what a finished loop settled. `docs/design/` is the other
half: the document a reader consults *before* changing a feature
([`desktop.md`](desktop.md) says why). This file covers the whole of the word-identity
layer — [`packages/etl/scripts/lib/segmentation.mjs`](../../packages/etl/scripts/lib/segmentation.mjs),
[`build-alignment.mjs`](../../packages/etl/scripts/build-alignment.mjs),
[`scripts/gate-align.mjs`](../../scripts/gate-align.mjs), the pin they write and read, and
the two upstreams neither of them owns.

Its companions, cited rather than restated:

- [`PLAN.md` follow-up 13](../PLAN.md) — how the word *boxes* got here: the print probe,
  the ornament registration, the 604 shards. It ends by naming this document's problem
  ("the two disagree on 4,499 of 6,236 ayahs") and stopping there.
- [`SOURCES.md`](../../SOURCES.md) — the licence and provenance of both upstreams. This
  document links what it needs and does not re-derive their terms.
- [`docs/map.json`](../map.json), feature `word-indexing` — the code pointers.

**This is not a segmentation theory.** Nothing here claims one index is more correct than
the other, and no attempt is made to derive one from a rule about Arabic. Both are given;
what was missing was the correspondence, and a correspondence is measured.

---

## ① Two indices, and neither of them is wrong

Every word in this repo carries two numbers, from two upstreams that never met.

**The print's index** is `data-word-index-in-ayah`, an attribute on
`<g id="md-word-NNN" data-surah data-aya data-word-index-in-ayah data-hafs data-imlaey
data-line-number>` in the ligature corpus. `build-words.mjs` copies it **verbatim** into
`assets/words/hafs-kfqc/<page>.json` as `from` plus a run of contiguous boxes, and drops the
text. It is the number every tappable word box in the app carries, because it is the number
the geometry came with.

**QAC's index** is the word field of `(surah:ayah:word:segment)` in the Quranic Arabic
Corpus morphology. A word there is a group of PREFIX/STEM/SUFFIX segments. It is the number
[`assets/roots/**`](../../apps/web/public/assets/roots), the tajweed ETL and
[`gate:edges`](../../scripts/gate-edges.mjs) already speak, and have since Loop 5.

They disagree because they are counting different things:

|  | the print | QAC |
|---|---|---|
| counts a pause mark as a word | **yes** — 4,486 of 91,451 tokens | no |
| splits at the rasm | **yes** — a proclitic detaches | no — `وَبِٱلۡـَٔاخِرَةِ` is one word |
| what it indexes | **ink on a page** | **the text** |

Neither is a defect. A typesetter numbers what is set; a morphologist numbers what is
inflected. The whole cost of that is 9,534 places where the two differ, and the whole of
this document is the map over them.

---

## ② Where each number comes from

### The print index

- **Corpus:** [MushafDatabase-Ligature-Based-SVG](https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG),
  dataset `SVG V1.01`, pinned at commit
  [`ae5786ab`](https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG/tree/ae5786ab08597f8123575dec4e774f1eca195e0f)
  in [`ligature-svg.probe.json`](../../packages/etl/data/pages/ligature-svg.probe.json).
- **Print:** KFGQPC Hafs, established as **V2/1421H** by
  [`probe-ligature-print.mjs`](../../packages/etl/scripts/probe-ligature-print.mjs) — 56
  pages across all four known V1/V2 divergence bands plus controls, 56/56 matching
  `ayah-pages.json`. PLAN 13 carries that argument.
- **How it reached this repo:** never as bytes. 378 MB is read from a disk cache to produce
  2.2 MB of rectangles; not one upstream byte ships, and `data-hafs` is dropped on the way
  through. §10 says why that stays true.
- **Re-pull:** `pnpm align --rebuild --fetch` — the only target here that touches the
  network. §7 has all four.

### The QAC index

- **Corpus:** the [Quranic Arabic Corpus](http://corpus.quran.com) morphology, version 0.4,
  Kais Dukes, University of Leeds, 2011 — vendored at
  `packages/etl/data/roots/quranic-corpus-morphology-0.4.txt`, SHA-256 recorded in the pin
  and re-computed on every rebuild. Its own text layer is
  [Tanzil](https://tanzil.net) Uthmani 1.0.2 (CC BY-ND 3.0), which is why
  [`SOURCES.md`](../../SOURCES.md) carries a nested notice.
- **Size:** 128,219 segments over 6,236/6,236 ayahs; 1,642 roots, 4,644 lemmas, 44,431
  root↔ayah pairs.
- **Notation:** forms are [Buckwalter](http://corpus.quran.com/java/buckwalter.jsp)
  transliteration, which is what makes §4's fold cheap — one ASCII character per Arabic
  letter, and the folding rules are a table lookup rather than Unicode normalisation.

---

## ③ What was measured

Every number below is reproduced by `pnpm align --rebuild` and re-checked offline by
`pnpm gate:align` on every push. They are also in
[`word-alignment.pin.json`](../../packages/etl/data/pages/word-alignment.pin.json)'s
`measured` block, which `gate:align` re-derives rather than trusts.

```
aligned              6,232 / 6,236 ayahs
print words         86,965   (lexical; the 4,486 pause marks are not in the map)
QAC words           77,429
joins                9,533   print words that continue the QAC word before them
splits                   1   print words that cover two QAC words
```

**The block shapes over the whole mus'haf** — the shape of a maximal run that both sides
agree encloses:

| shape | count | what it is |
|---|---|---|
| 1→1 | 67,853 | the ordinary case: one print word, one QAC word |
| 2→1 | 9,533 | the print split at the rasm — `وَ` `بِ` `لِ` `فَ` detached from their host |
| 1→2 | **1** | 15:7, and only 15:7 (§5) |

**The two indices are monotone.** No shape other than the three above occurs. They never
cross; they only group differently. That is the finding this whole design rests on, and it
is what makes a block alignment possible at all rather than an edit-distance score with a
threshold somebody would have to tune.

**The hamza fold is measured, not assumed.** Without folding hamza seats and madda to alif,
276 ayahs fail to align; every sampled failure is `'A` against `A` — an orthographic
difference between the two texts, not a segmentational one. With the fold, 4 fail. Both
numbers are in the pin's `$method` string so a reader who wants to argue with the fold can
see what it bought.

---

## ④ The alignment: monotone blocks on a folded skeleton

The method, in [`segmentation.mjs`](../../packages/etl/scripts/lib/segmentation.mjs):

1. **Reduce both sides to the same alphabet.** The print's `data-hafs` is Arabic; QAC's
   form is Buckwalter. `AR2BW` maps one to the other, `normalise()` (borrowed from
   [`morphology.mjs`](../../packages/etl/scripts/morphology.mjs), not re-implemented) drops
   every diacritic, and `fold()` collapses hamza seats and madda to `A` and runs of alif
   to one.
2. **Concatenate and take cumulative lengths.** For the print's tokens `P` and QAC's `Q`,
   the two concatenations must be identical strings — if they are not, this ayah does not
   align and nothing further is attempted.
3. **A block boundary can only fall where both cumulative lengths agree.** Walk `P`'s
   boundaries; a boundary that also appears in `Q`'s closes a block. `alignBlocks` returns
   the partition, or `null`.

There is **no score and no threshold.** The alignment either partitions both sequences or
does not exist. That is a deliberate property: a fuzzy aligner would have produced a number
for all 6,236 ayahs, four of them wrong, and nothing would have said which four.

The whole of `alignBlocks` is about a dozen lines. The measurement that justifies it — that
the result is monotone, that the shapes are three — is the expensive part, and it lives in
the pin rather than in a comment.

---

## ⑤ The four exceptions, and the one split

### The four that do not align

They are named, with a reason each, in `EXCEPTIONS` in `segmentation.mjs`, and the same four
are in the pin. `gate:align` checks both directions, so widening one without the other fails
CI — the same shape as the `SOURCES.md`↔`Colophon.tsx` licence-copy gate.

| ayah | why |
|---|---|
| `2:72` | print `فَٱدَّٰرَٰءۡتُمۡ` carries a hamza the QAC form does not |
| `12:39` | print `يَٰصَٰحِبَيِ` drops the yaa QAC keeps |
| `12:41` | same word, same ayah pair |
| `37:130` | QAC holds `إِلۡ يَاسِينَ` as **one word containing a space** |

All four are **orthographic**, not segmentational — the two texts spell the word
differently, so no partition of equal strings exists because the strings are not equal.
Three of them are one word appearing three times. §11 ③ says why they are not folded away.

For these four, `Alignment.mapOf()` returns `null` and the CLI says so in words. Both
indices remain valid on those ayahs; what is absent is the relation between them.

### The one 1→2

`15:7`. QAC holds `l~awo` (لَّوۡ, COND) and `maA` (مَا, NEG) as two words; the print writes
them joined and gives them one number. It is the only place in the mus'haf where one print
word covers two QAC words, and it is the reason the encoding carries an `s` field at all:

```
$ pnpm align 15:7
15:7 — 7 print words → 8 QAC words

  print   QAC
      1   1–2  ← one print word, two QAC words
      2     3
      …
```

Special-casing it would have been cheaper by one field and wrong by one word. A map with a
hard-coded exception is a map that cannot be re-derived.

---

## ⑥ The encoding: a delta, not a table

The pin does **not** store `print → qac` for 86,965 words. It stores, per ayah, only what
cannot be recovered from the shards already shipping:

```jsonc
"2:4": { "j": [3, 7, 11] }          // these print indices CONTINUE the previous QAC word
"15:7": { "s": { "1": 2 } }         // this print index covers 2 QAC words
```

An ayah with neither is absent from the file entirely — 4,496 of 6,236 carry a delta, the
rest are 1→1 throughout and need nothing said about them. 212 KB, and it is ETL data: it
lives under `packages/etl/data/`, ships nothing to the browser, and is not counted by
`gate:assets`.

**Why a delta.** Storing the mapping outright would restate the shards 86,965 times and make
it possible for the two to disagree — the shard says an ayah has 15 lexical words, the table
says 14, and now a reader has to decide which register is authoritative. A delta cannot
disagree with its base; it can only **fail to apply**, and failing to apply is something a
gate can detect without knowing anything about Arabic. That is exactly the property
[#80](../issues.md) did not have: the off-by-one in the mutashabihat corpus was a
self-consistent table that nothing could contradict, and it pointed 47.8% of hop edges at
the wrong ayah for four loops.

Reading the delta back is `Alignment.mapOf(key)`: walk the ayah's lexical print indices in
order, carry a running QAC number, and advance it past the previous word's span unless this
index is in `j`.

---

## ⑦ Every target: re-pull, rebuild, look up, validate

Four things anyone might want to do to this map, and the one command each.

| want to | run | needs the network | measured |
|---|---|---|---|
| **re-pull** the upstream print | `pnpm align --rebuild --fetch` | yes — 604 pages, 378 MB, once | bounded by the download |
| **rebuild** the map from a warm cache | `pnpm align --rebuild` | no | 7 s |
| **look one word up** | `pnpm align 2:4 [--print N \| --qac N]` | no | 0.3 s |
| **validate** what is committed | `pnpm gate:align` (in `pnpm gates`, `make ci`, CI) | no | 0.4 s |

Only the first is expensive, and it is opt-in for that reason. `--rebuild` alone reads the
upstream corpus from the gitignored cache under `packages/etl/data/pages/.cache/words` and
fails naming `--fetch` if a page is missing; it never downloads on its own. `--fetch` is
spelled the same way [`build-words.mjs`](../../packages/etl/scripts/build-words.mjs) spells
it, for the same reason — a third of a gigabyte arriving because somebody re-ran a build is a
surprise, and a surprise that size should be asked for.

**Why re-pulling is needed at all:** the print's **text** is the only thing the two indices
can be aligned on, and this repo ships none of it (§2, §10). Nothing else in the four rows
above touches the network; the committed pin and the shipped shards are enough.

**What a re-pull would change.** Nothing, unless a pin moved. Both sides are pinned — the
print by commit in `ligature-svg.probe.json`, QAC by SHA-256 recomputed into the pin on every
rebuild — so a rebuild against unchanged pins rewrites the same bytes. That is the check: if
`pnpm align --rebuild` leaves `word-alignment.pin.json` dirty in `git status`, an input moved,
and the diff says which. Bumping either pin therefore means: bump, `--rebuild --fetch`,
`gate:align`, and read the `measured` diff before committing.

### Looking a word up

```
$ pnpm align 2:4 --print 2
2:4 print 2 → QAC 1
  QAC 1 is print 1 + 2 — the print split it

$ pnpm align 12:39
12:39 — no map: print يَٰصَٰحِبَيِ drops the yaa QAC keeps
This ayah's print and QAC indices are both valid; nothing relates them.
```

Programmatically, the same four questions through
[`Alignment`](../../packages/etl/scripts/lib/segmentation.mjs):

| method | answers |
|---|---|
| `mapOf(key)` | the whole ayah as `[{print, qac, qacSpan}]`, or `null` if excepted |
| `qacWordOf(key, printIndex)` | one box → one QAC word |
| `printWordsOf(key, qacWord)` | one QAC word → the box or boxes carrying it |
| `qacCount(key)` | how many QAC words this ayah has, per the map |
| `exception(key)` | the reason there is no map, or `null` |

This is **L3 only** today. It is ETL-side because the app cannot read it yet — that is §11 ①.

---

## ⑧ `gate:align`: three witnesses, none of them the network

The pin was derived from a corpus CI does not have, which is precisely the situation an
unchecked derived artifact lives in. So the gate does not re-derive it. It **applies** it,
offline, to the two things that are committed, and checks the result against a third:

1. **the shipped word shards** say which print indices exist per ayah and which are pause
   marks — the base the delta is a delta over;
2. **the pin** says which of those continue the previous QAC word, and which covers two;
3. **the vendored QAC morphology** says how many words the ayah actually has.

If applying (2) to (1) does not produce (3) exactly, for all 6,232 mapped ayahs, something
moved and the map is a lie. The third witness is the point: neither the pin nor the shards
control the morphology file, so agreement between them is evidence rather than tautology.

It also checks that `EXCEPTIONS` matches the pin in both directions, that every `j` index is
a real lexical index and never the ayah's first word, that every `s` span exceeds 1, that no
ayah appears in two shards, and that the pin's own `measured` block equals what applying the
map produces — a stale number there is a wrong claim in the record, not a cosmetic drift.

**The delta is applied in the gate's own ten lines** rather than through
`Alignment.mapOf()`. Same rule `gate:words` runs on: a gate that imports the code it is
checking proves only that the code agrees with itself, and what is being checked here is the
*pin*, of which the reader is part of what could be wrong.

Verified by inducing three failures and reverting each: a dropped join (caught twice over —
count mismatch and stale `measured.joins`), a dropped exception, a corrupted `measured`.

---

## ⑨ What the rest of the ecosystem does

Worth knowing before anyone proposes renumbering something.

[QUL](https://qul.tarteel.ai) — Tarteel's Quranic Universal Library, what quran.com renders
from — is the de-facto standard, and its
[mushaf-layout model](https://qul.tarteel.ai/docs/mushaf-layout) treats a layout as a
**positioning layer over one canonical word list**. Each line of each page stores
`first_word_id` / `last_word_id` into a shared word-by-word script, and every print — Madinah
15-line, KFGQPC V4, Indopak — is a different set of coordinates over the *same* word ids.
Word identity is fixed; pagination is the variable.

Hifth is the inverse. Its geometry comes from a print that carries its own numbering, and
its meaning comes from QAC. Nobody publishes a print↔QAC crosswalk, because in the standard
model the question does not arise — you never have two numberings to reconcile, you have one
numbering and many layouts.

Two things follow. First, the map in this document is not a workaround for something the
ecosystem solved; it is the reconciliation the ecosystem avoids by never letting the second
index in. Second, the ecosystem's answer — *one word index at render time, reconciliation
done upstream* — is an argument for §11 ①'s option C rather than against it.

---

## ⑩ Deliberately out of scope

- **Shipping the word's text.** `build-words.mjs` drops `data-hafs` and that stays true. The
  alignment is *derived from* the text; it does not carry it. `gate:notext` exists to keep
  it that way. §11 ② was the one place this looked like it would bite, and word-D answered
  it by announcing what a run is *about* rather than what it says — so the rule has now been
  through the one feature that had a reason to break it, and did not.
- **Renumbering either index.** Both are upstream identifiers. Rewriting the print's would
  break every committed shard and its pin; rewriting QAC's would break `assets/roots/**`,
  `gate:edges` and the tajweed ETL. The map exists so that neither has to move.
- **Segment granularity.** QAC's fourth field (PREFIX/STEM/SUFFIX) is not in the map. A print
  word maps to a QAC *word*; if something later needs a segment, it can ask the morphology
  directly once it knows the word.
- **Other prints.** The map is per-edition (`hafs-kfqc`) by construction — `EDITION` is a
  parameter, and a second print would need its own rebuild, its own exceptions and its own
  measurement. Nothing here generalises for free.
- **Other editions of QAC.** The morphology is pinned by SHA-256. Version 0.5 would be a new
  measurement, not an upgrade.

---

## ⑪ Open questions, and what would answer each

Every design doc in this repo ends under this heading, and every item is an
`### ⓝ … · **status**` row so `pnpm gate:issues` can read it. The vocabulary is defined once
in [`docs/issues.json`](../issues.json).

### ① Where the app reads the alignment · **answered**

**C, shipped 2026-08-05 in word-D.** The caller this item was waiting for arrived — a word
run that refines the hop list — and it picked C exactly as predicted, for the reason
predicted: the app never learns that a second index exists. Nothing in L1 or L2 imports
`Alignment`, because nothing has to; `assets/adj/**` names its spans in print indices and
`assets/roots/**` names each root's `w` in print indices, and the print index is the only
number a word box carries.

Three placements were priced, gzipped, against the shards then shipping:

| | placement | cost priced | cost shipped |
|---|---|---|---|
| **A** | `joins` in `assets/words/**` | 885.6 → 908.9 KB (**+23.3 KB**) | not built |
| **B** | its own `assets/align/**` | **+62.9 KB** over 604 new files | not built |
| **C** | print indices baked into `assets/roots/**` (and the edges) | 199.2 → 208.4 KB (**+9.2 KB**) | 199.2 → 280.8 KB (**+81.6 KB**) |

**C cost 8.9× its estimate, and the gap is structural rather than an arithmetic slip.** The
price above is the price of shipping *the map* — the 9,533 joins, the same delta the pin
carries. What shipped is the map's *answer*: 55,345 print indices, one list per root-ayah
pair on 44,401 of them, plus a span on each side of 2,544 edges. Restating the answer costs
more than shipping the question, always — and buying it is the point. A consumer of `w`
never applies a delta, never reads a pin, and cannot get the application wrong, which is
what "no component learns about a second index" actually means once you build it. Placement
A's number would have moved the same way for the same reason had it been chosen; the
estimate was priced on the wrong artifact, not measured wrongly.

The full corpus cost, as `gate:assets` measures it: the roots tree 450.7 → 532.3 KB gz
(all of it in the per-ayah shards; the reverse index stays ayah-grained), and the adjacency
tree 55.8 → 79.5 KB gz for the spans. Both against ceilings that did not move — see
`scripts/gate-assets.mjs`.

What C's cost buys, and what it does not: a *second* consumer of the alignment still needs
its own baking pass, and the tajweed shards have not had one. B remains the only placement
that would make the map inspectable in a browser, which is still the thing to reach for if a
word-granularity bug ever has to be debugged from a phone.

### ② Announcing a word run needs the word's text, and nothing ships it · **answered**

**Answered by not naming the run at all**, 2026-08-05. The question assumed the announcement
had to identify the words; the shipped one announces the *outcome* — «٧ مواضع مشابهة», how
many places this run turns out to be about — which is the question the reader asked by
selecting it. §10 holds untouched: no phrasing, no roots, no new vendoring, no licence
question, and `gate:notext` never came into it.

That dissolves rather than settles the original three. Reading the selection back through a
UI string would put scripture in the interface layer, which is the one thing the word grain
exists not to do — so the choice between position, roots and shipped text was a choice
between three ways of doing something the design does not want done. The identity half the
alignment unblocked is real and still available; nothing has consumed it.

**What is still owed, and by whom:** a screen-reader walkthrough (validation ledger
`screen-reader-walkthrough`, owned by a human) can still say the count is not enough for a
memoriser. If it does, the three phrasings above are priced and the technical answer to each
is known — but it would reopen §10, not this item.

### ③ The four exceptions are orthographic and could be folded away · **answered**

They could. Widening `fold()` to swallow the medial hamza in `2:72` and the dropped yaa in
`12:39`/`12:41` would take the failure count from 4 to 1, and `37:130`'s space-containing
QAC word could be special-cased into two.

**Not doing it, deliberately.** Every widening of the fold makes the aligner accept more,
including things it should reject, and the fold's whole value is that it is measured — 276
failures without the hamza rule, all of one shape, is evidence; "and also these three" is
not. Four named exceptions with a reason each, checked in two places, is a smaller and more
honest surface than a fold nobody can argue with. Revisit only if a fifth appears, and
revisit by measuring, not by widening.

### ④ The map assumes no ayah spans a page · **answered**

It does assume that, and it is true of this corpus: 6,236 ayahs, 6,236 (page, ayah) pairs,
measured. `gate:align` does not take it on trust — it fails if any ayah appears in two
shards, which is the only way the assumption could break without anyone noticing.

If a future edition breaks it, the map itself is unaffected (it is per-ayah, not per-page);
what would need work is the shard reader, which currently builds one lexical run per ayah
from one file.

### ⑤ Word-granular tajweed painting needs a third text, not a second baking pass · **answered**

①'s last paragraph says a second consumer of the alignment would need its own baking pass
and that the tajweed shards have not had one. That is true, and it is not the whole cost —
which is why this is a row rather than a sentence inside an answered item. Opened
2026-08-06 by a sweep of the catalog, because PLAN follow-up 3 had been carrying this as
*blocked on word geometry* since before the geometry shipped.

**What is no longer in the way.** Geometry: `assets/words/**` holds 91,451 boxes on our own
frame. Identity: the QAC ↔ print alignment shipped in word-D and is baked into
`assets/adj/**` and `assets/roots/**`. Both walls this item used to name are gone.

**What is.** `build-tajweed.mjs` emits, per ayah, `family → [start, end, …]`, and those
numbers are **codepoint offsets into that ayah's Tanzil Uthmani text**. The alignment joins
two *word* indices. Between a codepoint and a word sits a segmentation of a text this repo
does not hold and has a standing rule against holding — *"There is no Quran text in this
repo and there will not be"* (`morphology.mjs`). QAC's Buckwalter segments reconstruct a
word well enough to ask whether two ayahs share phrasing and nowhere near well enough to
count Uthmani codepoints. So the offsets currently resolve against nothing committed here.

**What answered it, and how the heading came out wrong.** `packages/etl/scripts/probe-tajweed-words.mjs`,
run 2026-08-06 over all 604 cached pages and all 6,236 ayahs, and audited a second time on
2026-08-07 until every residual ayah had a name. It does not *find* the third
text — that is still not here and still may not be — it **reconstructs** it, from the print's
own per-word `data-hafs`, the string `build-words.mjs` reads and drops on purpose. That is a
different move from the one this item predicted, and it is why the prediction is false: a
build change with a named exception list, not a design problem.

Eight corrections make the reconstruction agree with Tanzil, in two kinds. Each was earned
by a run that failed without it, and none was guessed — the first three are stated by the
corpus, the last five were **found by bracketing**: for each ayah the oracle got wrong, read
the reconstruction between its last *correct* annotation and its first *wrong* one, and the
drift has to be inside that segment.

*Structural — how the words are joined:*

| # | correction | evidence it was needed |
|---|---|---|
| 1 | prepend the **basmala** to ayah 1 of every surah but 1 and 9 | 2:1's offsets run to 44 against 5 codepoints; 326 annotations out of range → 0 |
| 2 | glue the split **conjunction waw** to its successor | the print flags it itself, `data-waw-alatf="true"`, always on «وَ» |
| 3 | **drop the pause-mark words** — the print numbers them, this text has none | the miss histogram clustered on *even* values and decayed monotonically (0 → 63.4%, +2 → 21.0%, +4 → 7.5%), the signature of one repeated two-codepoint insertion |

*Orthographic — how one grapheme is spelled.* Every one is a case where the two texts render
the **same printed mark** with a different number of codepoints. None is a variant reading:

| # | correction | what the bracket showed | oracle after |
|---|---|---|---|
| 4 | a small high mark on a **tatweel carrier**, «ـۧ» and «ـۨ» → the mark alone | إِبۡرَٰهِـۧم, ٱلنَّبِيِّـۧنَ, نُـۨجِي — the print seats the mark on a stretch of baseline, the offsets count the mark | 97.56% |
| 5 | **«أٓ»** is two codepoints here, three there | ٱلۡأٓخِرَة, ٱلۡأٓيَٰت — the *length* is what is measured, not which three | 98.49% |
| 6 | drop the **small high madda «ۤ»** | يَسۡجُدُۤ, ٱسۡجُدُواْۤ — clustered on the sajdah ayahs, which is confirmation rather than coincidence: the source is Tanzil's *pause-sajdah* edition | 99.64% |
| 7 | drop the **hamza below «ٕ»** on a seat | شَٰطِيِٕ, إِيتَآيِٕ, ٱللُّؤۡلُوِٕ — again a length, not an identity | 99.81% |
| 8 | drop the **small high seen «ۜ»** *where it ends a word* | مَنۡۜ رَاقٖ, بَلۡۜ رَانَ, مَّرۡقَدِنَاۜ — the sakta, which the offsets' text does not carry. Word-*medially* the same codepoint sits over a ص and marks the sin reading (وَيَبۡصُۜطُ), which it does carry — so the substitution is anchored, and unanchored it breaks 52:37 | 99.86% |

**Correction 4's narrowness is measured, not chosen.** Generalised to strip *every* U+0640 it
scores **94.48%** — worse than applying nothing. Most tatweels are in both texts; only these
two carriers are not. That asymmetry is the standing check on overfitting here: the rules
apply to all 6,236 ayahs rather than the ones that motivated them, the oracle tests letter
*identity* at a position no rule touches, and a rule that reaches too far is punished at
once.

**Correction 8 is why the corrections are toggles.** It is the same substitution that was
measured and **rejected** when this section was first written — it gained 1 annotation and
zero ayahs, and 36:52 was recorded as a named exception instead. Nothing about the
substitution changed. What changed is the instrument: re-tried against an oracle that
witnesses all eighteen rules rather than two, it closes three ayahs, because `silent`,
`qalqalah`, `madd_246` and `idghaam_shafawi` had no vote the first time it was weighed. A
correction is only ever rejected *by an instrument*. Re-run the rejects whenever the oracle
widens — which is one line of work precisely because each correction is a flag rather than
an edit to the arithmetic.

③'s discipline applies to the result, so the fold is not trusted on its own output. **All
eighteen** of the source's rules name a letter their annotation must open on: `hamzat_wasl`
on **ٱ**, `lam_shamsiyyah` on **ل**, `qalqalah` on one of **قطب جد**, and so on. All 60,057
annotations can be checked that way with no reference to any word boundary, and that oracle —
not the span arithmetic — is what decides whether the fold is right. Every letter set was
written from the tajweed rule *first* and measured second; reading a set off where the
offsets land and then declaring that they land there is circular and passes on a broken fold.

**Read the coverage as two numbers.** Breadth is free: a rule admitting fifteen codepoints is
satisfied by accident far more often than one admitting a single ٱ. So each check is weighted
by `1 − oracleDensity`, the chance it would have caught a one-codepoint drift in that ayah.
100% of annotations are checked; **93.65%** is what that coverage is worth, and it is the
number to quote. `madd_6` — fifteen letters, 69.6% sensitivity — says in its own `why` that
it is the entry to distrust.

| measure | result |
|---|---|
| oracle lands on the expected letter | **59,975 / 60,057 = 99.86%** |
| annotations the oracle can check | 60,057 / 60,057 = **100%** (93.65% sensitivity-weighted) |
| annotations inside **one** print word | 50,032 / 60,057 = **83.31%** |
| two **adjacent** print words | 10,024 = **16.69%** |
| wider than two | **1** — 12:41, `idghaam_ghunnah` |
| past the end of the text | 0 |

The 16.69% is not misalignment. Idghaam, ikhfa and iqlab are cross-word rules — the whole
point is what happens *between* two words — and both boxes are paintable, so a two-box span
is the correct rendering of a two-word rule rather than a failure to place a one-word one.

Corrections 4–8 were made for *alignment*, and **paintability moved with them without being
asked to**: spans past the end went 2 → 0 and spans wider than two words went 4 → 1. That is
the second reason to believe them. A rule that merely shifted the string to satisfy the
oracle would have no reason to settle arithmetic the oracle cannot see.

**The residual is ③'s shape, and that is the finding.** **10 ayahs of 6,236 (0.16%)** carry a
miss, 82 misses in all, every one but a single outlier within ±2 codepoints and 7 of the 10
ayahs drifting by one constant amount throughout. They are not a rate — each one is **named**
in `tajweed-words.probe.json` under `residual.named`, and three the repo already names
elsewhere:

| ayah(s) | why it drifts |
|---|---|
| 12:39, 12:41 | «يَٰصَٰحِبَيِ» — two of the four print↔QAC exceptions `lib/segmentation.mjs` already names. A **third independent witness** to the same spelling, from a text neither of those two involves |
| 15:7 | «لَّوۡمَا» — the repo's single 1→2 alignment singularity, drifting here for the reason it drifts there |
| 2:181, 8:6, 13:37 | «بَعۡدَ مَا» — the print splits it, the offsets' text joins it. Unlike the waw the corpus does not flag it, so it is not derivable |
| 2:97, 17:7 | a **bare** tatweel carrying no small-high mark, which correction 4 deliberately does not reach. 17:7 also spells ٱلۡءَاخِرَةِ the long way where the same print writes أٓ elsewhere — an inconsistency inside the print itself |
| 95:1, 97:1 | not localisable: the *first* oracle annotation is already drifted, so there is no correct one to bracket against. Not the basmala — 112 surahs take that prefix and only these two drift |

36:52 «مَّرۡقَدِنَاۜ» used to be a row here. It is not one any more: correction 8 closed it,
along with 75:27 and 83:14.

That is orthographic, not structural: the same class as `lib/segmentation.mjs`'s exceptions,
now at a comparable count rather than a larger one. It is also why paintability (99.998%
within two boxes) still beats alignment — a one-codepoint drift inside a seven-codepoint word
rarely changes which box hosts the span. The ten are recorded and are not to be
heuristised away — ③'s rule, unchanged.

**What it does not unblock, still.** The beta label. The palette waits on a hafiz
(`plan-tajweed-golden-row`), and painting a wrong colour per word makes it wronger, not
righter. ① also prices the bake in advance: restating an answer costs more than shipping
the question, so expect the tajweed tree to move the way the roots tree did — 450.7 → 532.3
KB gz, not the estimate — and to need `gate:assets` reviewed rather than assumed. And the
probe is not a gate and will not become one: it reads the gitignored 378 MB page cache, so
on a clean checkout it has nothing to read. Re-run it before writing the bake — the numbers
above are of one pin.
