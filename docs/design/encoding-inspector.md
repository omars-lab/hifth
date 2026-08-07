# The encoding inspector: four descriptions of one text, on one screen

> A maintainer's instrument, not a feature. It ships nothing, it is not a gate, and the file
> it writes is gitignored on purpose. Read this before changing the fold, and before
> concluding that a tajweed offset is wrong.

**Status:** design of record for the **encoding inspector** — `probe-encodings.mjs`, the
report it generates, and `lib/tajweed-fold.mjs`, the fold arithmetic it shares with
[`probe-tajweed-words.mjs`](../../packages/etl/scripts/probe-tajweed-words.mjs). Built and
run over all 604 pages; §7 records what it found on the first pass, and §9 is what is still
open.

## How to read this, and what it is not

`docs/design/` is the document a reader consults *before* changing a feature. This one
covers a tool with no users but us, which is exactly why it needs writing down: an
instrument you cannot argue with is an instrument that will eventually tell you something
false with great confidence, and the only defence is a written account of what it can and
cannot see.

Its companions, cited rather than restated:

- [`word-indexing.md`](word-indexing.md) — the print↔QAC map: why two indices exist, how the
  block alignment works, the four named exceptions. This document does not re-derive any of
  it; the inspector displays it.
- [`PROVENANCE.md`](../../PROVENANCE.md) and [`SOURCES.md`](../../SOURCES.md) — where each of
  the four encodings comes from and under what licence.
- [`docs/map.json`](../map.json), feature `encoding-inspector` — the code pointers.

**This is not a theory of the text.** Nothing here claims any of the four encodings is more
correct than another. They are four descriptions produced by four groups of people for four
purposes, and the only thing being measured is where they fail to line up.

---

## ① The four encodings, and why each pair disagrees

Every word in this repo is described four times, and no two descriptions are the same shape.

| | what it is | what a unit is | where it lives |
|---|---|---|---|
| **1. the print** | 604 KFGQPC Hafs SVG pages | an anonymous outlined `<path>` | `apps/web/public/assets/pages/` — **vendored** |
| **2. the ligature corpus** | the same pages upstream, annotated | a `<g id="md-word-NNN">` with `data-hafs` | `.cache/words/` — **gitignored** |
| **3. the QAC word index** | Quranic Arabic Corpus morphology | `surah:ayah:word:segment`, Buckwalter | `packages/etl/data/` — **vendored** |
| **4. the tajweed offsets** | rule spans over Tanzil Uthmani | `[start, end)` codepoints into an ayah | `packages/etl/data/tajweed/` — **vendored** |

**The print knows nothing.** It is ink. It has no letters, no words and no ayahs, and every
other encoding exists because somebody wanted to say something about it that it could not
say about itself. Everything downstream of it is a claim about where its ink is.

**1 vs 2** disagree about nothing, which is the point: the ligature corpus is the same
typesetting with names attached. What they disagree about is *availability*. The corpus is
378 MB and gitignored; the print is vendored. That asymmetry is the single most consequential
fact in this document and §3 is entirely about it.

**2 vs 3** disagree about **what a word is**. The print numbers ink: a pause mark is a token
(4,486 of 91,451), and a proclitic that detaches at the rasm is its own box. QAC numbers the
text: `وَبِٱلۡـَٔاخِرَةِ` is one word with four segments. Neither is wrong and no rule converts one
to the other; `word-indexing.md` measured the map and it has three shapes and four
exceptions.

**2 vs 4** disagree about **what the text is**. The tajweed source indexes codepoints into
Tanzil Uthmani — a text this repo does not hold and will not — so its offsets reach nothing
here directly. The only way to use them is to reconstruct the string they index out of the
print's own `data-hafs`, which is what the fold does, and every place the reconstruction is
one codepoint off is a place the two orthographies genuinely differ.

**3 vs 4** have never been compared, because nothing needs them compared. They are related
transitively, through 2, and the inspector is the first place where that composition is
visible on one screen.

## ② The fold, and where it lives

The fold is the arithmetic that turns the print's per-word `data-hafs` into the string the
tajweed offsets index. Three corrections, each earned by a failed run rather than assumed —
prepend the basmala to ayah 1 of every surah but al-Fatiha and at-Tawba, glue the split
conjunction waw (`data-waw-alatf`, stated by the corpus, not guessed), drop the pause-mark
words. The *evidence* for each is written at the head of
[`probe-tajweed-words.mjs`](../../packages/etl/scripts/probe-tajweed-words.mjs), which is the
document of record for why the fold is what it is.

What changed for this tool is only *where the arithmetic lives*. It moved to
[`lib/tajweed-fold.mjs`](../../packages/etl/scripts/lib/tajweed-fold.mjs), because two
readers applying the same corrections separately is the failure mode this repo has a standing
rule against: the inspector could show a clean screen for a probe that was failing, and
nothing would say which one to believe. The probe's diff for the move is mechanical, and the
numbers it prints are byte-identical before and after — that identity is the whole
verification of the refactor.

**The module imports nothing.** That is not tidiness; it is what allows the generator to
inline its source *verbatim* into the report (stripping only the `export` keywords), so the
browser's correction toggles execute the same bytes the ETL executed. Anything the fold needs
from the corpus is passed in — `mark` is decided by `WAQF` in the caller, because whether a
codepoint is a pause mark is a fact about this print, and the fold is arithmetic over it.

## ③ Web view or generated file — and why it is a generated file

The obvious shape for this is a dev-only route in the app: it is a browsing tool, the app is
already a browser, and the app already draws the pages. It was priced that way and rejected
for four reasons, in descending order of how hard they are to argue with.

**The data is not reachable from L2.** The word text lives in `.cache/words/` — 378 MB,
gitignored, filled by a fetch. `build-words.mjs` reads it and deliberately drops `data-hafs`
before anything ships, because `gate:notext` exists. A dev route would therefore need a
generator step to produce something it *could* fetch — so the generator does not go away, it
just acquires a second half. Given that, the only question left is whether the second half
earns its keep, and it does not.

**The fold is L3 knowledge and the layer rules forbid L2 importing it.** ESLint enforces
`packages/etl` as `.mjs`, deterministic, framework-free, and not an import target for the
app. Putting the fold behind a dev route means either duplicating it into L2 — the exact rule
§2 exists to obey — or punching a hole in the boundary for a maintainer's tool. Neither is
worth a browsing convenience.

**A dev-only route is one import away from shipping.** `gate:budget` guards a number. A
route that is excluded from the production build is excluded by configuration, and
configuration is a thing that gets edited; a 2.8 MB payload of reconstructed Quran text
sitting in `apps/web/src/` is a live hazard against the no-text rule for as long as it exists.
An HTML file in a gitignored directory cannot ship by accident, cannot move `gate:budget`, and
cannot be imported by anything.

**A file is a better artifact than a route.** It opens from `file://` with no server, no
install and no node_modules; it can be attached to an issue; it is diffable against last
month's; and it names its own pins in the About tab so a stale one is identifiable rather
than merely wrong. A route is only ever *now*.

**The cost, stated honestly:** a regeneration is ~90 seconds of reading 604 SVG files, and a
report is 2.8 MB. Neither is close to mattering for a tool run a handful of times per change
to the fold.

**What is NOT given up is liveness**, which is the one thing the route would genuinely have
been better at. The corpus is embedded and the fold is inlined, so the correction toggles are
not a lookup into precomputed answers — every toggle re-folds all 6,236 ayahs and recomputes
every aggregate, in about 30 ms. Precomputing per-combination tables was considered and
rejected for the reason that makes it a trap: it is 2ⁿ tables in the corrections, and it
would go stale silently the first time a fourth correction was added. The number under the
toggle is measured, not remembered.

## ④ What the report shows

Six views, one ayah picker, three checkboxes.

**The ayah view** puts all four encodings on one ruler:

1. the page artwork — **named and never drawn** (§6);
2. the print's words: `data-hafs`, codepoint count, kind (word / split waw / pause mark),
   the half-open span each occupies in the fold, and the QAC word it maps to;
3. the print↔QAC map for the ayah: every QAC word, the folded consonant skeleton the aligner
   actually partitions on, the print word(s) it covers, and which of the three shapes it is;
4. the fold itself as a **codepoint ruler** — every codepoint its own cell, tinted by which
   print word owns it, indexed every ten, with its Unicode name on hover, and the spaces the
   fold inserted marked as inserted.

Under it, every tajweed annotation on that ayah: its `[start, end)`, what it covers, how many
print words it touches and which, the oracle's verdict, and the signed delta at a miss.
Selecting one lights its span on the ruler and opens a **character-level diff** — the
codepoints either side of the expected offset, each named in full (`U+0640 ARABIC TATWEEL`),
with the offset the source claims and the position the letter actually occupies marked
distinctly.

**The aggregates** are computed over all 6,236 ayahs on every toggle, and every row drills
down to the ayahs behind it: by rule (all eighteen the source emits — see §5), by surah, by
signed delta, by residual class, and by how many print words a span touches.

**The drift views** are the two that find corrections, and they are different instruments:

- **Drift onset** — the words between the last annotation the oracle agreed with and the
  first it did not. This is the useful one, and it is useful because of a property of the
  data: offsets are cumulative, so one divergent codepoint pushes every later annotation in
  its ayah by the same amount. 166 of the 172 residual ayahs carry exactly one delta
  throughout. So a miss says the drift exists, the bracketing hit says where, and everything
  outside the window is *cleared*. The table names each print word standing in such a window,
  how many residual ayahs it stands in, **and how many ayahs it appears in at all** — because
  without that denominator the table is a word-frequency list wearing a lab coat, and «وَ»
  tops it for no reason but being «وَ».
- **Drift shapes** — the codepoints under the miss itself. Narrower, and only correct when
  the divergence is adjacent to the annotation. Kept because that is the right answer when
  there is no earlier hit to bound the window, and because it is what names a *local*
  difference precisely.

**The print↔QAC view** is `word-indexing.md`'s measurement made browsable: the three block
shapes counted over the whole mus'haf, the four named exceptions with their reasons, and
lists of every ayah where the print split a word or covered two.

**The about view** is the pins — corpus commit, tajweed file digest, alignment method,
generation time — plus this document's §6, restated where somebody reading a stale report
will see it.

## ⑤ Rules, not families

`build-tajweed.mjs` maps the source's eighteen rules onto seven paint families (`wasl`,
`madd`, `madd-lazim`, `ghunnah`, `idgham`, `qalqalah`, `silent`). The inspector deliberately
works at the **source rule** grain and does not import that table.

A family is a *rendering* decision — it exists because the app draws colours, and it is the
right grain for a question about the skin. This tool asks whether an offset points where the
source says, and the source says `madd_2` and `madd_246` separately. Collapsing them here
would hide exactly the case worth seeing: two rules from one family disagreeing about the
same word. It also keeps the inspector from importing a build script whose module body runs a
build.

## ⑥ What it is deliberately blind to

Six things, and the last two are the ones that will eventually tempt somebody.

1. **Whether the colours are right.** This is geometry and identity only. The tajweed skin
   stays beta until a hafiz signs off on the palette (`plan-tajweed-golden-row`), and nothing
   in this tool moves that date.
2. **Sixteen of the eighteen rules.** Only `hamzat_wasl` and `lam_shamsiyyah` name a letter
   whose identity is not in doubt, so only they can witness alignment independently of word
   boundaries. That is 15,985 annotations — 26.6% — and the other 73.4% inherit their
   verdict. A report showing 99.81% is showing 99.81% *of the checkable quarter*.
3. **Tanzil's own tokenisation.** The reconstruction is *of the print*, so "two words" here
   always means two print boxes and is never a claim about how Tanzil would count.
4. **The ink.** No glyphs, no boxes, no page geometry. This is the temptation: the boxes are
   right there in `assets/words/**`, and drawing them would make the tool feel complete. It
   would also make it a second renderer of the mus'haf, with a second chance to draw it
   wrong, in a tool whose entire authority rests on being about *identity* rather than
   appearance. The page is named and linked; that is the whole intended relationship.
5. **QAC segment granularity.** A print word maps to a QAC *word*. PREFIX/STEM/SUFFIX is not
   in the alignment and is not shown, because the alignment does not know it.
6. **Any other print, and any other edition of QAC.** Both are pinned. A different pin is a
   new measurement, not an upgrade, and the About tab says which pin the numbers are of so a
   report cannot quietly outlive its corpus.

## ⑦ What the first full pass found

Every number below is from one run over all 604 pages at
`mushafdatabase/MushafDatabase-Ligature-Based-SVG@ae5786ab`, and reproduces
`probe-tajweed-words.mjs` exactly — which is the intended proof that the shared fold is in
fact shared.

> **Read this section as dated.** It is the first pass, made against a fold carrying the
> **three** structural corrections, and it is kept in that state on purpose — the point of the
> instrument is what it could see before anyone knew the answer. Four orthographic corrections
> have since been written from exactly these findings, so the residual it describes (172 ayahs,
> 475 misses, 97.03%) is no longer the residual: it is **11 ayahs, 30 misses, 99.81%**. Where a
> paragraph below has been overtaken, a ↳ line under it says what the corrected fold measures,
> and §9 carries the outcome. `CORRECTIONS` in `lib/tajweed-fold.mjs` is the authority on the
> current set.

**Three registered facts were independently confirmed** by a second reader assembling them
from the sources rather than reading the pin: 67,853 1→1 blocks, 9,533 2→1, 1 1→2 (at 15:7),
and no fourth shape; 6,232 of 6,236 ayahs mapped; the four exceptions. The inspector computes
these from the shards and the pin's delta and gets `word-indexing.md`'s numbers.

**The residual is one missing codepoint per ayah, not scattered noise.** This is new. Because
the drift is cumulative and 166/172 ayahs carry a single constant delta, the onset window
localises it, and the words standing in those windows are dominated by a single orthographic
family:

| word in the onset window | residual ayahs | of ayahs it appears in | delta |
|---|---|---|---|
| `ٱلۡأٓخِرَةِ` | 41 | 41 | −1 |
| `ٱلۡأٓخِرِ` | 16 | 16 | −1 |
| `ٱلۡأٓخِرَةَ` | 9 | 9 | −1 |
| `ٱلۡأٓيَٰتُ`, `ٱلۡأٓخِرَ`, `لَأٓتِيَةٞ`, … | 3, 3, 2, … | all | −1 |

Every one contains **`U+0623 ALEF WITH HAMZA ABOVE` + `U+0653 MADDAH ABOVE`** — the print
spells `أٓ` in two codepoints where the Tanzil text the offsets index spells it in three.
100% of the ayahs these words appear in are residual, and every window is bounded on both
sides. That is a **fourth correction**, orthographic, and it accounts for the dominant −1
bucket (275 of 475 misses).

> ↳ **Written, and it held.** `alef-madda` respells `أٓ` → `ءَا`, three codepoints for two, and
> is the largest of the four: 143 → 60 residual ayahs on its own. The inference the paragraph
> above flags as unread — "three codepoints" — is now confirmed the only way it can be, by the
> oracle getting *better* rather than worse.

**A fifth is visible and smaller.** `ٱلۡأُمِّيِّـۧنَ`, `يُحۡـِۧيَ` and `إِبۡرَٰهِـۧمَ` sit in windows at **+1**,
and all contain `U+0640 ARABIC TATWEEL` + `U+06E7 ARABIC SMALL HIGH YEH` — the print carries a
tatweel the Tanzil text does not. `يَسۡجُدُۤ` and `ٱسۡجُدُواْۤ` are a third small family around
`U+06E4 ARABIC SMALL HIGH MADDA`.

> ↳ **Both written, and a fourth found the same way.** `tatweel-carrier` unseats the small high
> mark from its tatweel — `ـۧ` and the rare `ـۨ`, those two carriers only (172 → 143, then a
> last 12 → 11); `small-madda` drops `ۤ` (60 → 19); and reading the windows once more after
> those turned up `hamza-below`, dropping `ٕ` (19 → 12). The narrowness of the tatweel rule is
> measured rather than chosen: stripping *every* `U+0640` scores 94.48%, worse than applying
> nothing at all.

**Twenty-one `lam_shamsiyyah` annotations miss at +1 onto `ٱ`** — the source's offset points
at the alef wasla rather than the lam. That is not a fold error at all; it is the source
being inconsistent with itself about where a `lam_shamsiyyah` span begins. It is recorded
here because it is the kind of finding that would otherwise be absorbed into "residual".

> ↳ **This one was wrong, and the correction is the more interesting record.** Re-measured on
> both folds: on the three-correction fold it reproduces exactly — 90 `lam_shamsiyyah` misses,
> 21 of them beginning on `ٱ`, across 19 ayahs. On the seven-correction fold there are 7 misses
> and **one** onset on `ٱ`, at 36:52, which `NAMED` already carries as a named exception. So the
> source is not inconsistent with itself: the 21 were correction 5's `أٓ` drift arriving at
> `lam_shamsiyyah` annotations, and the 19 ayahs are `ٱلۡأٓخِرَة`/`إِبۡرَٰهِـۧم` territory throughout. The
> failure mode is worth naming because the instrument invites it: a drift shape that is *exactly*
> one letter reads as an off-by-one in whoever wrote the span, and the only thing separating
> that reading from the true one is re-measuring under a different correction set — which is
> the reason the corrections are toggles.

**The tatweel was not the dominant cause, contrary to the standing guess.** Before this tool
existed, the +1 bucket was attributed to `U+0640` on the strength of it occurring 535 times
in the corpus. The onset table says the +1 bucket is heterogeneous and tatweel is a minority
of it. This is exactly what the tool was built to do and it is worth recording that the first
thing it did was correct a plausible, widely-repeated, untested attribution.

**The shards' pause-mark set and `WAQF` agree on all 6,236 ayahs** — two independent answers
to "is this token ink the text does not carry", cross-checked on every run and reported as a
count so a future disagreement surfaces as a number rather than as a wrong screen.

## ⑧ Running it

```
pnpm probe:encodings                 # from the cache, all 604 pages, ~90s
pnpm probe:encodings --fetch         # fill the cache first
pnpm probe:encodings --pages 30      # a fast subset while changing the client
pnpm probe:encodings --out /tmp/x.html
open packages/etl/out/encoding-inspector.html
```

`packages/etl/out/` is gitignored, and that is load-bearing rather than tidy: **there is no
Quran text in this repo and there will not be.** The report is full of Arabic; every
codepoint of it is derived at runtime from the gitignored cache, and committing one would
vendor the mus'haf through the back door past `gate:notext` and `gate:text-sources`. The
directory is ignored wholesale rather than by filename so a second output cannot be added
carelessly.

It is a `probe-`, never a `gate-`, for the reason `check-source-offer.mjs` and
`probe-reference.mjs` are what they are named: it reads a cache that does not exist on a
clean checkout, so in `make ci` it would have nothing to read.

---

## ⑨ Open questions, and what would answer each

Every design doc in this repo ends under this heading, and every item is an
`### ⓝ … · **status**` row so `pnpm gate:issues` can read it. The vocabulary is defined once
in [`docs/issues.json`](../issues.json).

### ① Whether the أٓ correction is written, and by whom · **fixed**

§7 localises a fourth correction to a two-codepoint/three-codepoint spelling difference at
`أٓ`, on evidence as strong as any of the first three: bounded windows, a single delta, and
100% of the ayahs the implicated words appear in. What it did **not** have is the other side
— the Tanzil spelling itself is in a text this repo does not hold, so "three codepoints" was
inferred from the arithmetic and not read.

**Answered by writing it, and by three more.** `alef-madda` is `CORRECTIONS[4]` in
`lib/tajweed-fold.mjs`, and the same windows gave `tatweel-carrier`, `small-madda` and
`hamza-below` beside it. The oracle was the referee exactly as this item said it would be: the
inference was right, so the score went **up** — 97.03% → 99.81%, 172 residual ayahs → 11 — and
paintability moved with it unasked (past-the-end 2 → 0, wider-than-two 4 → 1), which is the
second, independent reason to believe them. The `respell` mechanism is the general form:
corrections 4–7 are pure text substitutions applied per word before the fold counts, so each is
a checkbox in the report rather than an edit to the arithmetic.

What kept this item honest is that the inspector did not write the correction *for* itself. The
finding was published, the bake wrote the rule, and the instrument re-measured — which is why
the number is evidence and not the tool grading its own homework.

### ② Whether `lam_shamsiyyah`'s 21 `+1` misses are a source defect · **answered**

No. It was correction 5 arriving.

Twenty-one annotations put the span's start on `ٱ` rather than the `ل`, in 19 ayahs, and this
item suspected an inconsistency upstream in `tajweed.hafs.uthmani-pause-sajdah.json`. Measured
on both folds rather than reasoned about:

| fold | `lam_shamsiyyah` misses | of which begin on `ٱ` | ayahs |
|---|---|---|---|
| the three structural corrections | 90 | 21 | 19 |
| all seven | 7 | **1** | **1** — 36:52 |

The 21/19 reproduces exactly, so the observation was sound; the *attribution* was not. Those 19
ayahs are `ٱلۡأٓخِرَة`/`إِبۡرَٰهِـۧم` territory, and what looked like a span starting one letter early was the
`أٓ` drift already accumulated by the time the fold reached them. The one survivor, 36:52, is
already in `probe-tajweed-words.mjs`'s `NAMED` list on other grounds. Nothing is owed in the
source and nothing is owed in the bake.

**The lesson is worth more than the item.** A drift of exactly one letter reads as an off-by-one
in whoever wrote the span — it is the most available explanation, and it points away from your
own code. The only thing that separates it from the true reading is re-measuring under a
different correction set, which is precisely what making the corrections a toggle set buys.
Before assuming any future finding is upstream, switch corrections off and watch whether it
grows.

### ③ Whether the oracle's 26.6% coverage should be widened · **open**

Only two of eighteen rules name a letter, so 73.4% of annotations inherit a verdict they
cannot witness. Several of the remaining sixteen have *nearly* characteristic letters —
`qalqalah` on ق ط ب ج د, `idghaam_ghunnah` on ي ن م و — and admitting them would raise
coverage substantially.

**What would answer it:** it is measurable rather than arguable. Add a candidate rule to
`ORACLE` with its letter set, re-run, and read the hit rate: a rule whose oracle lands at the
same ~99.8% as the two incumbents is witnessing alignment; one that lands at 60% is witnessing
its own bad letter set. The reason it is not already done is that a *wrong* letter set makes
the oracle worse at exactly the job it exists for, and the two incumbents were chosen because
their letters are not in doubt at all. Widening is only worth it if the existing residual stops
being enough to find corrections with — and §7 is four corrections' worth of evidence that it
had not stopped. It is closer to stopping now: 11 ayahs and 30 misses is a thin seam to read an
eighth correction out of, so the case for widening is stronger than it was when this was
written, and the argument against it is unchanged.

### ④ Whether the report should be able to show a page's boxes · **open**

§6.4 says the tool draws no ink, deliberately. The counter-argument is real: a maintainer
looking at a 2→1 block at word 3 usually wants to see *which two boxes*, and the shards are
right there.

**What would answer it:** a caller. If someone using the inspector reaches for the app to
answer "which box", the blindness is costing more than it saves and a box outline — geometry
only, no glyphs, no page raster — is a bounded addition. Until then it is speculative work
against a stated principle, and the principle is the reason the tool can be trusted about
identity. Owned by whoever next uses it in anger.

### ⑤ Whether the `probe:tajweed-words` drift label reads backwards · **answered**

`probe-tajweed-words.mjs` prints its histogram under "distance to the expected letter
(negative = the fold ran long)". The sign convention in `oracleOf` — and the tests that pin
it — is the opposite: delta is *actual minus stated*, so **positive** means the letter sits
later than the offsets say, i.e. the fold ran long. The numbers are unaffected; the sentence
above them is inverted.

**Answered: the label now reads forwards.** The convention is documented and tested in
`lib/tajweed-fold.mjs`; the one-line fix was deliberately not made in the commit that found it,
because `probe-tajweed-words.mjs` was owned by another session and a one-word edit that
collides is worse than a filed item. It has since been made, and the line above the histogram
carries a note saying which way the sign runs and that it read the other way for as long as it
existed.

It is `answered` rather than `fixed` on purpose: what changed is a `console.log` string, and
there is no test that would fail if somebody inverted it again. The correctness that *is*
tested is `oracleOf`'s sign convention, which was never wrong. Recording that gap is more use
than claiming a closure this repo's definition of `fixed` would not support.
