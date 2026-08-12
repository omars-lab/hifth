# Are the marks in the right place, and how would we know?

> Read this before drawing a single mark on a page for a reader. The app knows where 326,515
> marks are to a tenth of a unit, and until now nothing had ever checked that the ink is
> underneath. It is not. This document is that measurement and what follows from it.

> **This document is about placement only.** Whether each mark's drawing matches the *name* it
> was given is a different question with a different answer, and it lives in
> [Does each mark's drawing match the name it was given?](mark-labels.md). The two used to be
> one document and one number, and that was a mistake: the merged figure moved eighteen points
> depending on how you chose to count, because it had a displacement, a look-alike and a real
> mislabelling stacked inside it. They are measured apart now, and the naming question needs
> no page and no rectangle at all — so a displacement cannot contaminate it.

**Status:** a finding and a proposal. The measurement is built, run and reproducible; the
remedy is **not applied** and the thresholds below are **not enforced anywhere**. Nothing in
the app changes as a result of this document. What it settles is that the rectangles are
displaced by a large, consistent, *correctable* amount, and that the correction is worth
making before anything is drawn for a reader.

---

## What do the words mean?

Six words are used throughout and each is defined once, here.

- **Mus'haf** — the printed Qur'an. Two different printings of the same one are involved
  below, and the whole document is about whether they agree.
- **Harakah** (plural *harakat*) — the small vowel marks written above and below the
  letters. Twenty-six named kinds appear in this mus'haf; *fatha*, *kasra*, *damma*,
  *sukun*, *shadda* and *tanween* are among them. "Mark" below always means one of these.
- **Ligature** — a cluster of letters drawn as a single joined shape. Marks are drawn onto
  ligatures, not onto isolated letters, which is why a mark's position is a fact about the
  drawing rather than about the spelling.
- **Tajweed** — the rules of recitation the app can colour. The reason any of this matters:
  colouring a rule means pointing at the mark the rule is about.
- **Page unit** — the coordinate the page is drawn in. A page is 345 units across and 550
  down (the opening two pages are a 235-unit square instead). A mark of middling size is
  **5.6 units wide and 3.6 tall**, so a unit is a substantial fraction of a mark and a
  tenth of a unit is a hairline.
- **Agreement** and **overlap** — the two numbers used to compare a drawn shape with the
  ink on the page. They are defined and justified in §④, because what they physically mean
  is the whole argument and cannot be relegated to a glossary.

---

## ① What is being decided?

Two things, and they are separable.

**First: are the mark rectangles correct enough to point at?** The app holds one rectangle
per mark. It has never been compared against the picture a reader actually sees. Every check
that exists compares the marks against *other numbers* — against the word that contains
them, against the letters that carry them, against a reconstructed text. All of those would
pass unchanged if the whole page of rectangles were slid a centimetre to the left.

**Second: by what method would anybody ever know?** A rectangle can be wrong in two
different ways — it can be in the wrong *place*, or it can be in the right place with the
wrong *name*. These fail independently, they cost differently, and any method that adds them
into one score cannot tell a print that is slightly out of register from one that is
mislabelled. So they are not added: the naming question is measured in a
[separate document](mark-labels.md) by a measurement that takes no page, no fit and no
rectangle as input, and this document answers placement and then uses that result only to
decide which marks it is entitled to ask about at all. What follows is the placement method,
what it found, and what to do about it.

## ② Why is this being asked now?

Because the next step in this area is drawing marks for a human to look at, and a picture
drawn from unverified geometry is not evidence about anything — it is a picture of our own
assumption. The existing design of record for the mark layer says so itself, in the section
that names what it cannot answer:

> §⑤ closes *identity* — that a given path is the sukun and not the hamza — and via R1 it
> predicts which box carries which name for 99.56% of multi-mark runs. Every step of that is
> a correspondence between a reconstructed text and the corpus's own attributes. None of it
> looks at the picture. A print that named its paths correctly and *placed* one of them a
> letter to the left would satisfy ①–⑤ exactly as a correct one does, because nothing here
> ever asks where the outline sits relative to the letter that wrote it.
>
> That is not a gap arithmetic can close from inside the file, and it does not need to be
> large to matter: a tanween highlight that lights the letter beside the tanween is worse
> than no highlight, because a hafiz would trust it.

That paragraph named the risk and left it standing. This is the measurement it asked for,
and the answer is worse than the paragraph feared: the marks are not *occasionally* a letter
out, they are *systematically* out, on every page but a handful, by very nearly the same
amount.

## ③ What happens if nobody decides?

Nothing breaks today, because nothing draws a mark today. That is exactly why this is cheap
to fix now and expensive later. Three things happen if it is left:

- The next feature to draw marks draws them in the wrong place, and it will look almost
  right — off by a fraction of a letter — which is the failure mode a reader trusts.
- A human review of a drawn page becomes a review of the displacement rather than of the
  data, and thirty minutes of a hafiz's attention gets spent finding something a machine
  found in fifty seconds.
- The displacement stays invisible to every check we have, because the number the pipeline
  already records about how well the two printings were fitted together **does not know
  about it**: across forty pages the correlation between that recorded quality number and
  the actual error is **0.117**, which is no relationship at all.

## ④ What does the app do today, and what does that cost?

### How is anything measured at all?

The app ships one printing of the mus'haf as outlines — shapes with no names. A second
printing of the same mus'haf, held only as working data, draws every mark separately and
*names* it. The rectangles come from the second printing, carried onto the first by a
per-page fit. So the question "is the mark under the box" has a direct form: take the mark's
own outline as the second printing drew it, put it where the rectangle claims it is, and ask
how much of it lands on ink.

Both shapes are turned into grids of on/off samples at **16 samples per page unit**, which
puts about 90 by 58 samples on a mark of middling size. Two numbers are then computed.

**Overlap** is shared area over combined area — the same quantity object detection has
scored boxes with for fifteen years. It is reported because it is legible: 0.6 means three
fifths of the shape and the ink coincide. It is deliberately **not** used to choose anything,
because it rewards a placement for simply finding more ink.

**Agreement** is the ordinary correlation between the two grids. Because both are on/off,
this is exactly what normalised cross-correlation reduces to, and it has the property
overlap lacks: it is scored against what would be expected *by chance at that ink density*.
A shape dragged onto a solid black letter scores near zero, not near one. That is what stops
a search sliding downhill into the nearest heavy stroke, and it is why both numbers are here
rather than one.

Agreement of 1 is an exact match, 0 is exactly chance, and negative means the shape landed
where the ink is not. On a mark 3.6 units tall, one sample is a fifty-eighth of its height,
so the finest displacement this can resolve is finer than the tenth-of-a-unit the rectangles
are rounded to — which is the precision the answer is allowed to claim.

Alongside the score where the rectangle claims to be, the mark's outline is **searched**
through every position within three units, and the best position is recorded. That turns one
number into three — how well it fits where it claims, how well it *could* fit, and how far it
had to move — and only the third can tell "slightly out of register" from "wrong letter".

### Does the measure measure anything? — the control

This is the single most important number in the document, and it comes before every other
one. A score that cannot separate the true pairing from a deliberately wrong one is not
measuring the pairing. So every mark is also scored in three places it is known **not** to
be: one mark-width to the left, one mark-width to the right, and on a different mark's
rectangle elsewhere on the same page. The best of those three — the generous reading, the one
that makes us look worst — is the number the true placement has to beat.

On 4,000 marks:

| | as shipped |
|---|---|
| agreement where the rectangle claims to be | **−0.127** ± 0.164 |
| agreement at a deliberately wrong place | **+0.116** ± 0.135 |
| separation | **−0.242** |
| marks that beat their own wrong place | **508 of 4,000 — 12.7%** |

The separation is *negative*. A rectangle chosen at random from elsewhere on the same page is
a **better** description of where this mark's ink is than the rectangle we hold for it. Seven
marks in eight lose to their own control. Nothing downstream of a number like that is worth
reading, and the probe says so in those words before it prints anything else.

This is also, incidentally, how a real bug in the measurement was caught: an early version
scored one control at 5.509, and a correlation cannot exceed 1. The shared area and the ink
were being counted over two slightly different regions whenever a displacement pushed part of
the shape off the edge of what had been drawn. It now refuses to return a value outside the
possible range rather than reporting one, because an impossible score looks like an excellent
match and gets believed.

### What is the actual error, and is it correctable?

The displacements are not scattered. On every page sampled they point the same way and are
very nearly the same size. Each `o` is one of forty pages; `O` and `#` are two and three
pages landing on the same spot. The `+` is where a correct page would be.

```
how far down
                                          ·
 -1.5                                     ·
                   o                      ·
                 o o o o o                ·
                 oo oOOOoOo               ·
 -1.0               OooOo#O#              ·
                                          ·
                                          ·
                                          ·
 -0.5                                     ·
                                          ·
                                          ·
                                          ·
  0.0 ····································+············
                                          ·
                                          ·
                                          ·
      |           |           |           |           |
    -1.5        -1.0        -0.5         0.0        +0.5
                       how far across  →
```

Across forty pages the mean displacement is **0.79 units across and 1.07 units down**, with a
page-to-page spread of only 0.11 and 0.10 units — a range of −1.04 to −0.61 and −1.40 to
−0.93. Not one page is near zero.

For scale: a mark is 5.6 by 3.6 units and is drawn with a thin stroke. Being 1.07 units low
is being about a third of the mark's height out, which for a thin stroke means the rectangle
and the ink barely touch. The measured overlap where the rectangle claims to be is **0.011**.

And the shapes are otherwise *right*. Once each page is moved by its own single displacement,
the overlap achievable per page is **0.901 to 0.913** across all forty — a figure that cannot
arise by accident. The outlines are the correct shape and the correct size; they are simply
in the wrong place.

### What happens if each page is moved by one number?

The displacement is taken per page as the **median** of its marks — median rather than mean so
that a handful of genuinely misplaced marks cannot drag the correction — and every number is
recomputed. Nothing is applied to any shipped data; this is a second pass of the same
measurement.

| | as shipped | corrected |
|---|---|---|
| agreement where the rectangle claims to be | −0.127 | **0.466** |
| separation from a deliberately wrong place | −0.242 | **0.287** |
| marks beating their own wrong place | 12.7% | **76.8%** |
| mean ink inside the rectangle | 19.3% | 26.9% |
| rectangles essentially blank | 1.15% (0.86–1.53%) | **0.10%** (0.04–0.26%) |
| further than 0.75 units from the best fit | 97.80% (97.29–98.21%) | **18.27%** (17.10–19.50%) |
| displacement left over, middle / 95th | 1.24 / 2.41 units | **0.38 / 1.37 units** |
| overlap with the ink, middle | 0.011 | **0.507** |

Ranges are 95% score intervals. Every rate in this document carries one, because a rate drawn
from a sample and printed without one is a number with no scale on it.

There is deliberately **no row here for "the ink matches the name"**. An earlier version had
one, at 51.15% before look-alikes and 69.15% after, and the eighteen points between those two
figures were doing the work of an argument. That number added three unrelated things together —
a rectangle in the wrong place, a pair this method cannot separate, and a genuine mislabelling —
and the first of the three is what this whole table is about, so it appeared on both sides of
its own comparison. The three are counted separately now: the naming half in
[its own document](mark-labels.md), and what is left over under *Is there anything left over
once the displacement is taken out?* below.

One displacement per page moves the measure from "worse than random" to "clearly right", and
it does so on every page. That is the finding.

### Is this a fact about the marks, or about the whole page?

About the whole page. The same displacement can be recovered **without looking at a single
mark**: rasterising the entire second printing of a page — letters and all — and sliding it
against the entire shipped page needs the same shift, around 0.75 across and 1.00 down, with
the two pages' total ink agreeing to within 0.05 percentage points. It is the same print,
displaced. The marks are not wrong; the alignment between the two printings is.

### Is the error systematic or random, and would correcting it help?

Separating the two is the difference between a fixable bug and an irreducible noise floor.

The **systematic** part is the per-page displacement above: tight, one-directional, and
recoverable to about a tenth of a unit. Correcting it is what the second column of the table
buys.

The **random** part is what is left after it: marks scatter about their own page's
displacement by 0.48 units across and 0.35 down. That does not go away, and it is why the
corrected column reads 18.27% rather than zero — the remainder is genuine per-mark variation,
not a second bias waiting to be removed.

Re-deriving the whole fit between the two printings from the ink rather than from the page
ornaments gives scales of **1.33188 ± 0.00112** across and **1.33375 ± 0.00066** down, against
a recorded 1.3334 and 1.3336. So the error is overwhelmingly a *shift*, with only a whisper of
scale in it — and the arithmetic confirms it: allowing the scale to move as well leaves 0.46
and 0.34 units of scatter, against 0.48 and 0.35 for a shift alone. The scale term buys
two-hundredths of a unit and is not worth the complexity.

### Does the pipeline's own quality number know about any of this?

No, and this is the most transferable lesson here. Each page's fit already records a residual
— a number meant to say how well the two printings were matched. Across the forty pages it
ranges from 0.030 to 0.336, and its correlation with the actual displacement is **0.117**. A
page with an excellent recorded residual is just as displaced as a page with a poor one. The
residual measures how well a handful of ornament positions were fitted; it says nothing about
where the ink ended up, and it was quietly trusted to.

### How confident is any of this, and how much would settle more?

The 4,000 marks are drawn in two stages — forty pages first, then marks on them — because
half of what is reported is a *per-page* quantity and a page with four marks on it cannot say
anything about its own alignment. The price is that marks on one page are not independent, so
a plain interval on a rate is a little narrower than the truth; the per-page spread is printed
beside every rate for exactly that reason.

To resolve a rate near 2% to within half a percentage point takes **2,985 marks**; to within a
tenth of a point, **61,185**. The 4,000 used here comfortably settle the first and cannot
settle the second, and no claim below is made to a tenth of a point.

An earlier, cruder look at this used a different rasteriser inside a browser and found 46 of
2,494 rectangles essentially blank. Retro-fitting an interval onto that measurement gives
**1.84% (1.39–2.45%)**; this probe's own rasteriser on the same 2,494 gives 53, or **2.13%
(1.63–2.77%)**. The intervals overlap, so the two independent implementations agree — which is
the point of stating the interval rather than the two bare percentages, which look like a 16%
disagreement.

The whole run is reproducible: two runs of the same command produce byte-identical output.

### Is there anything left over once the displacement is taken out?

There is one more thing this measurement can ask, and it has to be asked very carefully,
because it is the question that used to be reported as a single "identity" percentage and was
not one measurement at all. Stated precisely: **on marks where the rectangle is demonstrably in
the right place, and where the corpus's own drawing demonstrably matches its own name, does the
ink on the page the app ships look like the same mark?** If it does not, the two printings
genuinely differ, which would be a more serious thing than a displacement.

That question is only meaningful on marks that have earned it, so four conditions apply and
each one exists to stop something else being counted as a disagreement:

| condition | why | set aside |
|---|---|---|
| there is ink in the rectangle at all | nothing to look at otherwise | 4 |
| the rectangle is within 0.75 units of its ink, after correction | a rectangle a unit low is scoring partly the letter underneath, which is exactly what makes a fatha "look like" something else | 730 |
| the placement beat a deliberately wrong one | if it did not, the score is not about this mark | 997 |
| the drawing already matches its own name | otherwise the doubt belongs to the [naming question](mark-labels.md), and asking here would report the same doubt twice | 462 |

That leaves **1,807 of 4,000** marks eligible. The exclusions are published because a filtered
rate whose filter is not published is a rate somebody chose. Three counts on that set, and
they are **never added together**:

| what the shipped ink looks like at that spot | marks | share | 95% CI |
|---|---|---|---|
| the same name | 1,525 | **84.39%** | 82.65–85.99% |
| a name this print draws as the *same shape* | 174 | **9.63%** | 8.35–11.08% |
| a genuinely different shape | 108 | **5.98%** | 4.97–7.17% |

> **These three numbers moved slightly, and the reason is worth stating.** The naming question
> was re-measured after a defect was found in how it compared two drawings, and the last row of
> the table above — which marks have a name in doubt — is that measurement's output. So the
> naming work does reach this section, in exactly one direction and through exactly one door:
> it can change *who is eligible*, never what the ink shows. An earlier draft claimed the two
> could not touch each other at all; that was too strong. The eligible set moved by 19 marks in
> 4,000, every share moved by less than a tenth of a point, and no conclusion below changed.
> **The independence that mattered still held**: a defect in the naming arithmetic could not
> reach the displacement finding, which is the number this document exists for.

The middle row is the method's own blind spot, measured in the naming document: **fatha and
kasra are the same shape (0.968), and so are fathatan and kasratan (0.914)**. What separates
them is which side of the letter they sit on, and a comparison that centres two shapes on each
other has thrown that away before it starts. So this method is not *entitled* to tell those
pairs apart, and counting the middle row as an error would be measuring the question rather
than the data.

**And the bottom row empties out, which is the result.** Each of the 108 was scored again at the
placement the search itself preferred — a fraction of a unit away — and **only one still
disagrees**. That one is a mark labelled *successive fathatan* whose ink resembles a plain
*fathatan* by 0.522 against 0.505: a margin of seventeen thousandths, which is a coin toss. It
is the same mark that survived before the naming measurement was corrected, at the same two
scores.

So 107 of the 108 are the last sixteenth of a unit of residual placement, and the survivor is
indistinguishable from noise. **There is no evidence here that the two printings disagree about
what any mark is.** This section was written expecting to find something and found nothing, and
saying so plainly is the honest result rather than a wasted section — it means the entire
measured defect in the mark layer is the displacement, and Option B below is the whole remedy.

That also settles what the remaining work is. Separating fatha from kasra is a *positional*
feature — where the mark sits relative to the letter carrying it — and not a better shape
comparison. A better shape comparison cannot help, and the 0.968 is why.

### Did the suspicion that kasra is biased downward hold?

**No.** It was a reasonable guess — kasra is written *below* the letter while most marks are
written above, so a systematic vertical error might well have shown up in kasra alone. It does
not. After correction, kasra's mean vertical displacement is **−0.091** units; fatha's is
−0.059, damma's −0.091, sukun's −0.087, shadda's −0.134 and superscript alef's −0.156. Kasra
is neither the largest nor distinguishable from the others; every class shows the same small
residue, which is a known artefact of correcting by a median rather than a mean. The
hypothesis is refuted, and refuting it is what makes the single page-wide displacement the
right correction rather than a per-class one.

## ⑤ What do people outside this project do about this?

Enough of the answer is surprising that it is worth stating up front: **there is no published
precedent for validating per-mark boxes against the ink.** Two adjacent fields have most of
the answer, and neither does quite this. The claims below were checked against primary
sources; where something could not be established, it is named as such at the end of the
section rather than smoothed over.

**Object detection has a conventional threshold, and it was set for the opposite reason.** The
familiar 0.5 overlap comes from the PASCAL VOC challenge, whose own paper says why: *"The
threshold of 50% was set deliberately low to account for inaccuracies in bounding boxes in the
ground truth data."*
([paper](https://homepages.inf.ed.ac.uk/ckiw/postscript/ijcv_voc09.pdf), §4.2.) It is a slack
budget for untrustworthy labels. We are *testing* the labels, so inheriting a number designed
to conceal label error is exactly backwards.

**Overlap is measurably broken at this size anyway.** The Normalized Gaussian Wasserstein
Distance paper measures it directly: a six-by-six object shifted **one pixel diagonally** has
its overlap fall from 0.53 to 0.06, where a thirty-six-by-thirty-six object shifted the same
one pixel falls only from 0.90 to 0.65 ([arXiv 2110.13389](https://arxiv.org/abs/2110.13389)).
An overlap threshold on objects this small measures the rasteriser's rounding, not the labels.
Honest caveat: the field responded by changing the metric used to *assign* boxes during
training, not the one used to *evaluate* them — no benchmark was found that lowered its
evaluation threshold below 0.5.

**Document layout analysis had the better idea fifteen years ago.** The PRImA performance
evaluation work argues that errors should be quantified by **foreground area**, not by
bounding area, and gives the reason plainly: different methods wrap regions more loosely or
more tightly, still marking the region correctly, and using only the foreground ignores the
difference ([paper](https://www.primaresearch.org/www/assets/papers/ICDAR2011_Clausner_PerformanceEvaluation.pdf)).
A generous rectangle and a tight rectangle around the same mark are the same answer. That is
precisely why this document scores the *outline* against the *ink* and reports the rectangle's
own area nowhere.

**Establishing your own ceiling before setting a threshold is standard practice.** DocLayNet
double- and triple-annotated thousands of pages specifically to measure how well two humans
agree, and found agreement between 60% and 91% depending on the class
([arXiv 2206.01062](https://arxiv.org/abs/2206.01062)). That is the precedent for the
representative-against-representative table in §④: a threshold set above your own ceiling is a
threshold that fails on correct data.

**"Fix the labels" is a recognised discipline, and the payoff is large.** AI-TOD-v2 exists
because v1's boxes were wrong; the authors found out by rendering hits and misses over the
existing labels and looking, then added 52,133 instances, and report that the annotation
change alone exceeds most published method improvements
([arXiv 2206.13996](https://arxiv.org/abs/2206.13996)). The label-error literature also names
our exact second failure: the "swapped class" score in ObjectLab looks for a nearby box
confidently predicting a *different* class
([arXiv 2309.00832](https://arxiv.org/abs/2309.00832)).

**Where geometry cannot be trusted, count instead.** The CRAFT text detector validates
machine-generated character boxes not by geometry at all but by **cardinality** — does the
number of boxes match the known length of the word
([arXiv 1904.01941](https://arxiv.org/abs/1904.01941))? That check is orthogonal to everything
here, far cheaper, and would catch a class of error no score can. It is listed as an open item.

**The font world does this routinely, and compares outlines rather than pixels.** Google's
font regression tools compare the *serialised shaping result* as an exact string with no
numeric tolerance at all; where they do compare pictures, they count **differing pixels rather
than a percentage**, with a written rationale that applies here verbatim — a percentage lets a
real difference hide inside a large shape
([diffenator3](https://github.com/googlefonts/diffenator3)). Noto's own shape-difference tool
takes the boolean **exclusive-or of two sets of contours** and measures the leftover area
([source](https://github.com/notofonts/nototools/blob/main/nototools/shape_diff.py)) — the
purest form of the comparison this document makes.

**And the rendering world concluded that pixel determinism across machines is unattainable.**
FreeType's own change log records releases that "inevitably lead to different rendering
results" and an environment variable that changes rasterisation at run time
([changes](https://github.com/freetype/freetype/blob/master/docs/CHANGES)); Chromium keeps
per-platform baselines and adjusts the display colour profile so its pixel tests reproduce;
Skia solves it by substituting a controlled typeface and comparing against human-approved
hashes ([testing](https://skia.org/docs/dev/testing/)). Two of the best-funded rendering test
systems in existence gave up on cross-platform pixel equality. That is a strong argument
against depending on somebody else's rasteriser, and it is why the one used here is our own
integer scanline fill — see §⑥.

**On reading the page with a text recogniser.** The register holds no decision on this, and it
should: it is the first idea anyone has. The evidence says it cannot work, for a reason that
is not the obvious one. Recognition and localisation have separated into disjoint tool sets —
the engines that read harakat well emit no coordinates, and the engines that emit
character coordinates emit vertical strips. Concretely: the best published result for reading
diacritised Arabic emits **no coordinates of any kind**
([arXiv 2506.02295](https://arxiv.org/abs/2506.02295)); Tesseract's Arabic character set
contains only 8 of our 26 marks, so the rest are not even representable in its output, and its
maintainers state that its recogniser "does not actually output bounding boxes, but rather a
simple x coordinate per character"
([issue](https://github.com/tesseract-ocr/tesseract/issues/3477)); the one engine documenting
genuine per-character boxes derives them from the same vertical-strip mechanism, and its
ecosystem's Arabic training data omits vocalisation as a matter of policy
([arXiv 2402.10943](https://arxiv.org/abs/2402.10943)); forced alignment is defined by its own
maintainers as producing *"approximate character locations"*
([documentation](https://kraken.re/main/user_guide/api.html)) and cuts a line horizontally,
which cannot separate a mark from the letter it sits on top of. Worst of all, the benchmark
most Arabic recognition results are quoted against **strips the diacritics before scoring**
([arXiv 2502.14949](https://arxiv.org/abs/2502.14949)), so most published accuracy figures say
nothing whatever about the thing we care about. A recogniser would also be a model download, a
non-deterministic step, and a second opinion that is *worse informed* than the one we already
have — because we already possess the publisher's own drawing of every mark, which is better
evidence than any recogniser's guess at it.

**What was not established.** Whether one commercial cloud service preserves the marks and
returns per-symbol boxes — it is the only system with symbol-level boxes as a documented
output and it would settle in one call, but no call was made and no credible published report
either way was found. How tight the one engine with genuine per-character boxes actually is —
documented to exist, never measured by anyone, and not run here. Whether a particular Rust
rasteriser's claim of bit-identical output across processor architectures holds — it is
claimed upstream, no published cross-architecture comparison exists, and none was run.

## ⑥ What have we already decided that this has to live inside?

Three standing commitments constrain any answer, and each rules something out.

**The data pipeline is deterministic and offline.** A gate re-derives the shipped data from
committed bytes with no network and no model, and fails on any drift. Anything proposed here
that needed a downloaded model, a native binary compiled at install time, or a third-party
rasteriser whose output changes with its version would break that — not in principle, but on
the first day CI ran on a different machine. This is why the measurement uses a rasteriser
written for it: an integer scanline fill with no floating-point rounding in the coverage
decision, no dependencies, and no system libraries. It is also why the run being
byte-identical twice is reported as a result rather than assumed.

**The fit between the two printings is recorded once and read, never re-derived.** The
existing rule is that re-fitting at a call site creates a second transform that can disagree
with the one the data was built with, and a mark that disagrees with its own word by a tenth
of a unit is indistinguishable from a mark on the wrong letter. This document **obeys** that
rule — it re-derives the fit only to *report* what it would have been, and applies nothing —
but §⑦ is precisely a proposal to change what gets recorded, which is the correct place to
change it.

**Nothing ships until a human has looked.** The agreed order for this area is: build the
vocabulary and measure it, then draw the marks for a person, and only then emit anything an
app downloads. That order is the reason this document exists before anything was drawn, and it
is why §⑦'s recommendation is a change to working data and not to a shipped asset.

**And one constraint that is not ours.** The publisher's font — the obvious source of a
"correct" reference shape — is distributed free of charge but under terms that forbid
modification, alteration, reverse engineering and decompilation. Subsetting a font is
arguably alteration. That makes any method requiring the font to be embedded, subset or
queried a licensing question before it is a technical one, and there is already an open item
in the validation register to read the publisher's terms at the source. Nothing proposed here
touches the font.

## ⑦ What are the options?

Every option below was measured on the same 4,000 marks, so the numbers are comparable.

### Option A — change nothing, and do not draw marks

The rectangles stay as they are and no feature is built on them. Honest, and it costs
nothing today.

Measured consequence: the mark layer is permanently unusable for pointing at anything. 97.80%
of rectangles are further than 0.75 units from where their own ink is; the median rectangle
misses its mark's ink almost entirely (overlap 0.011); and a rectangle picked at random from
elsewhere on the page describes the ink *better* than the right one does.

### Option B — record one displacement per page, measured from the ink · **recommended**

Each page's fit gains a small correction, derived as the median displacement of that page's
marks and recorded alongside the four numbers already stored per page. It is written down
once, exactly like the fit itself, and read thereafter — so the existing rule against
re-fitting at call sites is respected rather than broken.

Measured consequence — the second column of §④'s table. Blank rectangles fall from 1.15% to
**0.10%**; badly-placed rectangles from 97.80% to **18.27%**; the median overlap with the ink
rises from 0.011 to 0.507; and the measure clears its own control by 0.287 where it previously
failed it by 0.242. Two numbers per page, both derived offline from committed bytes, and the
derivation is reproducible byte-for-byte.

Cost: the correction is derived from the ink, so it must be re-derived if either printing
changes — which is what a gate is for, and §⑩ ② is that gate.

### Option C — re-derive the whole fit from the ink, scale and all

Rather than adding a shift, replace the per-page fit entirely with one least-squares fitted to
the ink.

Measured consequence: it works, and it is not worth it. The re-derived scales are 1.33188 ±
0.00112 and 1.33375 ± 0.00066 against a recorded 1.3334 and 1.3336, and allowing scale to move
leaves 0.46 and 0.34 units of scatter against 0.48 and 0.35 for a shift alone. Two-hundredths
of a unit, in exchange for discarding a fit that a gate already re-derives and checks, and for
a much larger surface of things that could silently change. Rejected on the evidence, not on
principle.

### Option D — keep the marks but never point at one

Use the mark layer only in aggregate — how many marks a word has, which names occur — and
never draw a rectangle.

Measured consequence: everything in §④ becomes irrelevant, and so does the feature. The whole
reason to hold 326,515 rectangles is to point at one. This is Option A with extra steps.

### What thresholds would go with Option B, and are they enforced?

Proposed, and deliberately **not enforced anywhere** — not in the build, not in continuous
integration, not in any gate:

- The measure must clear its own control by at least **0.25**. Below that, nothing else in the
  report means anything, and the report says so instead of printing numbers.
- No more than **2%** of rectangles further than **0.75 units** from where their own ink is.
  That figure is an error budget, not a preference: 0.46 units of scatter left after the fit,
  0.10 for the tenth-of-a-unit rounding the rectangles are stored at, and 0.06 for one sample
  of the grid — about 0.62, rounded up.
- No more than **0.5%** of rectangles essentially blank, against a measured 0.10% after
  correction and two independent measurements agreeing on roughly 2% before it.

The measurement exits with a failure code when a threshold is breached, so that it *could*
become an enforced check later. It is not one today, and making it one has a named
prerequisite: somebody has to look, under conditions where looking can actually settle it.
The prerequisite used to be written as *agreeing with a sample of its verdicts*, and that was
the wrong instrument — a person shown a verdict agrees with it, and what comes back is this
document's own opinion with a reader's name on it. It is now a forced choice between two
rectangles with nothing on the screen saying which one is ours, and it takes about twenty
minutes. §⑩ ① is the question and the runbook is `placement-correction-by-eye` in
[`docs/validation/ledger.json`](../validation/ledger.json).

A forced choice can only ever say whether the proposed move beats the one alternative it was
shown against, so it cannot say whether the move is far *enough* — and the numbers above are a
claim about magnitude, not about direction. §⑩ ⑦ is that second question, asked by having a
reader place the rectangles themselves; its runbook is `placement-residual-by-hand`. Either
answer releases these thresholds; only that one can change them.

## ⑧ What else could be considered, and why is it not here?

**A borrowed overlap threshold.** The obvious method: rasterise, compute overlap, fail below
0.5. Rejected for the two reasons in §⑤ — the conventional threshold was set to *hide* label
error rather than find it, and overlap collapses under sub-pixel displacement at this object
size. It is still *reported* here, because it is the number a reader understands; it is just
not allowed to decide anything.

**Distance-based shape matching.** Chamfer matching and its identical twin from the
Hausdorff-distance literature both degrade *smoothly* with misalignment where overlap falls
off a cliff, which is genuinely attractive at this size, and both are exactly computable on
integer distance transforms so determinism is not an obstacle. Rejected on cost-benefit: the
correlation used here already degrades smoothly, is chance-corrected at local ink density
(which chamfer is not), and needs no distance transform per window. Chamfer's other property —
tolerance of small rotations and deformations — is worth nothing when both shapes come from
printings of the same mus'haf. It would be the right answer if the shapes differed; they do
not.

**Moment invariants.** Seven or a few dozen scalars per shape, invariant to translation,
scale, rotation and reflection. Rejected twice over. First, rotation invariance is actively
harmful for typographic marks — a mark and a rotated mark are different marks — so the method's
headline property is a defect here. Second, and decisively, the standard form requires a
logarithmic rescaling, and the floating-point standard only *recommends* correct rounding for
logarithms rather than requiring it, so the same input can give different answers on different
machines. That is disqualifying for a check meant to be re-derivable offline.

**Point-correspondence shape matching.** The classic method for comparing outlines by sampling
points and solving an assignment problem. Rejected: its power is in modelling *deformation*,
there is no deformation here, and it would cost a cubic-time assignment per comparison,
326,515 times, to solve a problem we do not have. Its log-polar binning would also destroy
exactly the fine positional information that separates our confusable names.

**An off-the-shelf rasteriser.** Several exist and one makes an explicit promise of
pixel-identical output on every platform. Rejected, and this was the closest call in the
document. Against it: two of the three widely-used ones fetch a binary from the network at
install time and fall back to compiling, which breaks an offline install outright; the one
based on a system imaging library inherits an entire text-rendering stack for 18 MB; the pure
JavaScript one implements *neither* standard fill rule correctly, which was verified by
measurement — a shape whose two rings run the same way should fill to 6,400 or 4,800 samples
under one rule or the other, and it produced 5,600. And the strongest candidate's determinism
claim, though credible and explicitly made upstream, has no published cross-architecture test
behind it. Weighed against that, the rasteriser needed here fills two-dimensional polygons with
integer arithmetic and is a few hundred lines; writing it costs less than defending a
dependency, and it is the only route where the determinism claim is ours to verify.

**Asking the font instead of the picture.** The cheapest correct oracle in principle: shape
the text with a layout engine, read each mark's extents in font units, compare. No rasteriser,
exact integers, machine-independent, and orders of magnitude faster. It was measured and it
fails on this mus'haf for three specific reasons. Five marks — including fatha and damma —
have **no separate glyph at all** when they follow a shadda; the two are drawn as one
inseparable shape with one shared box, so a per-mark claim over them has no referent to
compare against. Six more take a contextual variant whose *outline* differs from the standalone
one, not merely its position, so a naive reference render is out by roughly a tenth of the
glyph's height. And if these pages were produced from the publisher's per-page fonts, the
smallest addressable unit in them is **a whole word**, not a mark, and no reference render can
exist at all. Rejected as a primary method; kept as a cross-check worth running once, and named
in §⑩.

**A recogniser reading the printed page.** Covered in §⑤ and rejected on evidence: the tools
that read the marks return no coordinates, the tools that return coordinates cannot represent
most of the marks, and we already hold better evidence than any of them could produce — the
publisher's own drawing.

## ⑨ What would change the answer?

- **A human disagreeing with the verdicts.** The whole argument rests on a score that has been
  validated against a control but never against a person. A sample of worst-first verdicts
  reviewed by someone who can read the page would either confirm the method or end it. This is
  the single highest-value thing anyone could do next, and it is written up as a proposed
  validation-register entry rather than performed here.
- **Either printing changing.** The correction is measured from the ink of two specific
  printings. If either is revised, the correction is stale and silently wrong — which is
  exactly the failure this document is about, one layer up.
- **The two look-alike pairs turning out to matter.** If a feature needs to distinguish fatha
  from kasra by shape, the answer is that it cannot, and the work is a positional feature
  rather than a better comparison. Whether that work is needed depends on what gets built.
- **The one surviving disagreement between the printings turning into many.** On this sample
  exactly one mark still looks like a different shape once its placement is corrected, and it
  wins by seventeen thousandths. On a larger sample that could be a handful or it could be
  nothing; it is currently indistinguishable from nothing, and a run over the whole corpus
  would say which.
- **A cardinality check disagreeing.** Counting the marks a page should have and comparing
  against the marks it does have is cheap, orthogonal, and would catch a whole class of error
  no geometric score can. If it disagreed, something is wrong that none of this would find.
- **The remaining 18% concentrating somewhere.** After correction, roughly one mark in six is
  still further than 0.75 units from its ink. If those turn out to share a page, a name, or a
  position on the line, that is a second effect and this document has found only the first.

## ⑩ Open questions, and what would answer each

What this document does *not* settle. Each is stated so that the answer would be recognisable
when it arrives, and each is indexed in [`docs/issues.json`](../issues.json), which is the only
place that counts them.

### ① Would a person pick our rectangle over the one we ship · **open**

Nothing here has been checked by a human, and until something is, the thresholds in §⑦ stay
unenforced.

The question was first written as *does a person agree with the machine's verdicts*, and the
page of worst-first verdicts was built to answer it. That page cannot: it ranks the marks by
this document's own score, draws the outline it expects beside the rectangle it claims, and
then asks whether the reader agrees. A reader agrees. What comes back is this document's
opinion with somebody else's name on it, which is worth nothing and is very hard to notice is
worth nothing.

So the question is asked a different way. One mark, drawn twice side by side, one rectangle on
each, and the only thing asked is which rectangle sits on the mark. Usually one of them is the
corrected placement and the other is what the app draws today; nothing on the screen says
which, and no answer key exists anywhere — the session is a function of a seed, and the key is
rebuilt from that seed only when the answers are scored. So there is nothing to peek at, and
nobody has to be trusted not to.

Three things are asked alongside it, mixed in and indistinguishable while working, because the
headline number is unreadable without them. Some trials put the corrected rectangle against
one displaced *the same distance in a different direction*: that measures whether an eye can
resolve a shift this small at all, which is the ceiling the headline has to be read against —
and it also breaks the pattern, since the error points the same way on every page and a person
would otherwise be answering from a learned rule within twenty trials. Some put it against a
rectangle a whole letter away, which anybody looking gets right and a distracted session does
not. And some show the same rectangle twice, where "I can't tell" is the only honest answer,
which is what catches a person who always picks something.

The outcome that would be worth the most is the one that refuses: if the same-distance decoys
are seen clearly and our correction is *still* not preferred, then the correction is wrong
rather than the difference being invisible — and no amount of ink arithmetic could have told
us that.

The first reader to sit down with it hit something none of the four kinds of trial could say:
on some marks **neither** rectangle closes around the mark, because the mark pokes out of both
copies. That is not this question. Where a rectangle sits and how big it is are two faults with
two repairs — one is fixed by moving the box, the other by measuring it again — and the whole
argument of this document is that they were measured together for months and produced a number
that meant nothing. So the page grew a tick rather than a fourth answer: the reader says
*neither closes around it* and then still says which of the two is *closer*, which is a question
that survives both being wrong. The tick is counted on its own line, the marks that got one are
named so somebody can go and look at those boxes, and the headline's denominator does not move.
A run of them is a finding about extent, and it belongs in §④ with the residuals rather than
here.

One thing about it changed after §⑧, and it changed for a reason that had nothing to do with
the question and everything to do with which pages could be asked about. A trial cannot be
built for a page with no proposed move, so while the measurement covered forty pages, every
question this session could put came from one of the forty the correction had been fitted to.
A hundred trials would have bought a very precise answer about the pages the correction was
made from, and the correction is going to ship on all six hundred and four. Now the trials are
drawn from forty pages the fit has never seen, spread evenly through the print rather than
taken from its extremes — the placing session wants the extremes because it is measuring how
far, and this one is only ever asking which of two is closer, so what it has to lose by
bunching at the ends is being about the mus'haf at all.

The runbook is `placement-correction-by-eye` in
[`docs/validation/ledger.json`](../validation/ledger.json); it takes about twenty minutes and
needs no mushaf, no phone and no network. If the same person is going to sit the placing
session as well, this one goes first: dragging rectangles onto marks for twenty minutes is the
most efficient way there is to learn where our correction tends to sit, and a reader who has
learned it is answering these hundred trials from the rule rather than from the ink. The
reverse order costs nothing, because knowing which of two rectangles you preferred does not
tell you where to drag anything.

### ② Is there anything stopping the correction going stale · **open**

If Option B is adopted, the correction is data derived from two printings, and nothing
re-derives it or checks it. That is the same shape of problem as the fit residual in §④ — a
recorded number nobody re-validates — and it deserves the same answer a gate gives everything
else here: re-derive offline from committed bytes and fail on drift.

### ③ Do the pages count the marks they should · **open**

An entirely separate and much cheaper check, borrowed from §⑤: does each page carry the number
of marks of each name that the text says it should, in the order it says? It would catch
missing and duplicated marks, which no geometric score can, and it is a few hours of work.

### ④ Which of the two printings' fonts produced the pages · **open**

If the shipped pages came from the publisher's per-page fonts, the smallest thing addressable
in that source is a whole word, and one of the cross-checks in §⑧ is impossible in principle
rather than merely awkward. The two candidate sources differ in a single readable number, so
this is settled by looking, not by arguing.

### ⑤ What separates the look-alike pairs · **open**

Fatha from kasra, fathatan from kasratan: shape does not separate them and never will, and the
[naming document](mark-labels.md) measures exactly how far that limit reaches. Whether the
position of the mark relative to the letter that carries it separates them — and whether
anything needs it to — is unexamined, and it is answerable only after placement is corrected,
because it needs to know where the letter is.

### ⑥ Whether the names on the marks are right · **answered**

Not this document's question, and deliberately so — it is answered, and answered next door. It is
measured over the whole corpus in
[Does each mark's drawing match the name it was given?](mark-labels.md), which finds that **no
mark in the corpus is drawn with the strokes of a different name** — the category is empty. Five
drawings out of 326,515 still match another name overall, and all five are shown there to be the
right strokes set an unusual distance apart. It is named here only so that nobody reads this
document's silence on it as a claim.

### ⑦ How far is our correction still out · **open**

① can only settle a preference. It offers two placements and asks which is better, so a
correction that points the right way and falls a third short wins every single trial and
nothing in that session can say so. The measurement proposes a specific move; whether that
move is *far enough* is a different question, and it needs a different instrument.

So the same marks get asked the other way round. One panel, one rectangle, starting plainly
displaced in a random direction, and the reader drags it onto the mark. Nothing on the screen
says where we think it goes — the proposed move is stripped out before the trials reach the
page — so the landing is a placement rather than an agreement. Subtracting our move from it
leaves the **residual**: a distance, in page units, that would put our rectangles where a
reader puts them. That is a number Option B can be edited by, where ① can only say whether to
adopt it at all.

A hand-measured number is worth nothing without the hand's own noise measured beside it. A
residual of a fifth of a unit is a finding if the reader is repeatable to a fiftieth and it is
nothing at all if they wander by half a unit between two goes at the same mark, so some marks
come round a second time from an independent starting point and the spread between the two
landings is the floor everything else is read against. A residual inside that floor is reported
as *not distinguishable from the hand* — which is a result, and is not the same as our
correction being right.

Two properties of the design are load-bearing rather than incidental. The starting positions
are spread evenly around the rectangle the app draws today, so the pull every hand exerts back
toward wherever it started cancels in the average instead of being recorded as a fact about the
boxes; the pull is measured and printed anyway, because "should cancel" is a claim. And the
drag cannot be offered inside ①'s trials: dragging a box to fit and then comparing the landing
to the two starting positions *is* the answer key, and offering the drag after each answer
teaches the correction's direction — it points the same way on almost every page — within
twenty trials. For the same reason the two sessions should not be worked back to back by the
same person.

A third property was learned the hard way, after the first sitting. A crop of print this size
holds several marks and often two of the same name, so a trial that only says "put the box on
the mark" is a trial about whichever mark the reader picked. That is not a small error: a
placement on the neighbouring mark is a whole letter out, and the residual would record a
whole letter of registration error that has nothing to do with registration. So each trial now
names its mark — the name, the letters it belongs to, and, when those letters carry more than
one of that name, which of them counting from the right — and it points at those letters in
the picture.

The first attempt at pointing was a mistake worth writing down, because it would have quietly
destroyed the measurement rather than breaking it. The letters were drawn crisply, in colour,
over the print. But the crisp letters come from the other printing's drawing, carried onto our
frame by exactly the fit that places the rectangle — so the visible gap between those letters
and the ink underneath them *is* the correction being measured, about a page unit, which at
the size these panels are worked is a finger's width on screen. A reader would have spent an
hour looking at the answer and their landings would have been a tracing of it. The fix is to
point softly: the letters sit under a wide blurred wash whose edge is a gradient several times
wider than the correction, and which looks the same whether the fit is right or a unit out. It
says *these letters* and refuses to say anything finer. The mark itself is never washed and
never outlined.

If ① and ⑦ disagree, that is the most valuable outcome either can produce and neither can
produce alone: two instruments looking at the same rectangles from opposite directions,
one of them wrong, and a reason to re-measure before three hundred thousand rectangles move.

**What a sitting said.** Sixty marks, placed by one reader in about seven seconds each.
Fifty-nine of the sixty landed nearer the corrected rectangle than the one the app draws
today — 98%, and the interval around it reaches down only to 91%, so it clears half by a
wide margin and **the correction points the right way**. The typical miss from today's
rectangle was 1.15 page units and from the corrected one 0.39, which is the same statement in
a second form. Nine marks came round twice from independent starting points and the two
landings agreed to 0.03 units, so that is the floor everything else is read against.

What is left over once our move is subtracted is 0.07 units left and 0.11 units up — about
four times that floor, so it is bigger than the hand's own wobble. That was first read as
*therefore real*, and it is not, for a reason that took a second look to see. The sixty
placements sit on forty pages, and two marks on one page are not two facts about the fit: they
share that page's frame, so whatever is wrong with it is wrong for both of them, in the same
direction, by nearly the same amount. Counted as forty pages rather than as sixty independent
trials, the vertical part runs from 0.23 units up to 0.01 units *down* — it no longer excludes
nothing. It was marginal before that correction and it is not established after it. Most of
the range still sits on one side, so this says our correction **may** be short; it does not
say that it is.

Two further limits the sitting could not see past, neither of which appeared anywhere in its
own numbers until now:

- **It was asked on its own pages.** A trial needs a proposed move to start from, and moves
  had been measured for only forty of the mus'haf's 604 pages — so every mark placed came from
  a page the correction had already been fitted to. Nothing here says whether it holds on a
  page nobody has measured. That is §⑧, below.
- **The size was never measurable.** Across those forty pages the proposed move barely varies,
  and with that little to compare against, "exactly right" and "a fifth short" produce the same
  landings. The sitting's estimate of the correction's *scale* spans from the wrong sign to
  two and a half times too much. More trials would not fix it: the limit is the forty pages,
  not the sixty answers. **That limit has since been lifted** — the whole mus'haf has now been
  measured, and it holds pages whose corrections differ far more widely than those forty did.
  §⑧ says what that changes and how a sitting would have to be drawn to use it.

Three explanations were tested and none of them survived, which is worth not buying a second
time. It is **not the mark**: a separate number per mark name leaves more spread than one
number for all of them, over eleven names, so the rectangle is not anchored wrong inside
particular shapes. It is **not a stretch**: what is left over does not depend on where the mark
sits on the page, so the fit is out by a shift and not by a scale. And it is **not the starting
point** and **not fatigue**: the pull back toward wherever each rectangle started came out at
effectively nil, which is what the evenly-spread starting positions were for, and nothing
drifted as the sitting wore on.

So the answer to this section's question is: **the direction is settled and the distance is
not.** Adopt the correction as measured; do not apply what is left over on top of it. A tenth
of a unit spread over three hundred thousand rectangles is a move that would have to be bought
again the first time anybody asked how it was known. What would settle it is a second sitting
on pages the correction was *not* fitted to, several marks on each page so the page and the
hand can be told apart, and a second reader — whose disagreement by more than 0.03 units would
mean this is a fact about a person and not about the print. **Every page that sitting needs now
exists**, which was not true when this section was first written; what it still needs is
somebody's half hour.

The runbook is `placement-residual-by-hand` in
[`docs/validation/ledger.json`](../validation/ledger.json); about twenty-five minutes, and it
needs no mushaf, no phone and no network either.

### ⑧ Does the correction hold on a page nobody measured · **open**

When this question was written the per-page correction existed for **forty pages of 604**. It
had been measured by sampling pages and requiring enough marks on each to be worth fitting, and
forty was the number that sitting needed; the other 564 pages had no measured move at all,
while the app shipped rectangles on all of them.

That was a gap in coverage, and §⑦ made it a gap in evidence too: because a trial cannot be
built for a page with no proposed move, every placement a reader has ever judged came from one
of those same forty. The correction had been checked, and only ever where it was fitted.
Nothing measured then distinguished *the print is displaced this way* from *these forty pages
are displaced this way*.

The first half of the answer was arithmetic rather than judgement and needed nobody's time:
measure all 604. **That has now been done — 30,000 marks, 2026-08-12 — and the coverage half
of this question is closed.** Six hundred pages of 604 carry a measured correction. The four
that do not are pages 1, 2, 603 and 604, the short ornamental frames, which never carry enough
marks to be worth fitting; they need a stated fallback rather than a silent one, and the
average of everything else is the honest choice.

**The corrections do vary, and the first forty pages hid it.** Two things came out of the full
pass, and they point in opposite directions. The forty were representative in the *middle* —
their average correction is indistinguishable from the other 560 — which is reassuring and was
not guaranteed. But they understated the *variation* by more than half, and worse, most of what
variation they did show was never real: measuring those same forty pages twice, from different
samples of their marks, disagrees by about as much as the pages differ from each other. What
looked like forty slightly different pages was largely the same page measured noisily forty
times, which is exactly why the sitting built on them could confirm the direction of the
correction and never its size.

Across the whole mus'haf the real variation is around a tenth of a unit — the same size as the
leftover distance §⑦ could not settle, which is precisely why it could not be settled. And the
variation is **not the same on both axes**: nineteen pages in twenty need a downward move
inside the range the first forty spanned, so down behaves almost like a single number for the
whole print. Sideways it does not. Only about half of all pages fall inside the sideways range
the first forty covered, roughly nine pages need essentially **no** sideways move at all while
still needing the usual downward one, and one page — 113 — wants to move the *opposite* way
down from every other page in the book.

**So the second sitting is worth someone's half hour, and it must not draw its marks at
random.** The first forty offered about a third of a unit of difference between the largest and
smallest move they proposed, nearly all of it noise, which is why the size came back
undecidable. Across all 604 that span is over one and a half units. A sitting that deliberately
takes marks from both ends of it gets several times the leverage per placement — enough to tell
a correction that is exactly right from one that is a fifth short, which no number of
placements on the original forty could ever have done. The handful of pages needing no sideways
move, and page 113, are worth the most of all: they are where *one number for the whole print*
and *a number per page* disagree most loudly, so they are where a reader's eye settles it
fastest.

The second half is still open, and it is the half only a person can answer: a sitting on
**held-out** pages — marks from pages the correction was measured on but which no reader has
judged. Everything a reader has judged so far came from the pages the correction was fitted to.
That is the only thing that separates a fit from a finding.

**That sitting now exists and nobody has sat it.** It is two short blocks. The first is
forty-seven rectangles from forty pages that were not among the original forty, drawn on purpose
from the pages wanting the largest and the smallest moves rather than at random — which is what
buys the leverage described above, and it does: across those forty pages the proposed moves
differ by nearly two units sideways and over three down, against a third of a unit before. The
second is twenty-three rectangles over five further pages, four or five on each, and it exists
because no sitting so far has ever put enough rectangles on one page to tell how much of the
leftover distance belongs to the page and how much to the hand holding the mouse. The five pages
are none of the forty, so the two blocks can disagree with each other.

Neither block has the correction applied to it. Applying it first would have measured the
leftover distance on top of itself, where a genuine nought and a lucky cancellation look the
same — and it would have built a number this project has not settled into the instrument
meant to settle it.

Two things about that sitting are worth saying plainly, because they are what make it evidence
rather than an exercise. **What it expects is written down before anybody places a rectangle**,
in the validation register, four statements about numbers that do not exist yet, each one saying
what its own failure would mean — a result read afterwards can always be made to sound like a
confirmation, and one predicted beforehand can fail. And **one hand cannot tell a print that is
off by this much from one reader who places rectangles this way.** Those two produce the
identical number, and nothing in a single sitting's output distinguishes them.

**So there is a third page now, and a second person may sit it.** It is the first block again —
the same forty-seven rectangles, the same order, the same starting points — worked independently
by somebody else. Only whose hand it is changes, and that is the one thing about the sitting that
never reaches a trial: if the second person saw different marks, or the same marks from different
starting points, the two hands would not be comparable and the whole reason for asking a second
one would be gone. It is folded into the name of the file that comes back and into how a
half-finished sitting resumes, because two people working the same build would otherwise share
both, and the second would resume into the first one's answers.

The two sittings are then read against each other rather than each on its own: how far the two
hands are from each other, mark by mark — never average against average, since two people a fifth
of a unit apart on every rectangle in alternating directions have identical averages and have
agreed about nothing — against how far each hand is from itself, which each of them measures from
the marks they were shown twice. There is no threshold; what two hands on this screen actually
manage is the number that belongs there. Agreement inside their own wobble is what would make a
further correction something that may be applied to all 604 pages. A wider gap says the leftover
distance belongs to whoever was sitting there and may be applied to nothing — not to one of them,
not to the average of the two.

This half is optional and it is about ten minutes of a second person's time. If nobody sits it,
whatever leftover distance the sitting banks is one hand's leftover distance, and must be
recorded in those words.

One limit the full pass added rather than removed: taking each page's own displacement out
repairs most of this error and measurably not all of it. About one mark in five is still further
out than it should be afterwards, and the agreement reached by correcting a whole page stays
well short of what the best placement of each individual mark would reach. Whatever that
remainder is, it is not a per-page shift, and §⑦'s leftover distance is not the same quantity —
that one is a further move *of* the correction, this one is scatter the correction cannot
reach. Neither is applied.

## How can someone look at this for themselves?

The measurement writes a page of evidence: the worst verdicts first, each one drawn at a size
a person can judge — the real ink from the page the app ships, the rectangle we claim in red,
the outline the other printing drew in green, and where it actually fits in dashed blue —
filterable by name, by page and by verdict, and addressable so a single mark can be linked to.
It opens in any browser and needs nothing running.

**That list answers one question only: is the rectangle on the mark?** The handful of marks
where the two printings appear to disagree about *what* the mark is are shown further down the
same page, under their own heading, and are never mixed into the ranked list above — one list
sorted by a score that means two different things for different rows is how the two questions
got confused in the first place. The naming question has a page of its own again, built by its
own measurement.

That page is **not** checked in, and deliberately: it contains crops of the mus'haf's own
artwork, and the standing rule is that no scripture is committed to this repository. It is
written into the working output directory, which is not tracked, and rebuilt by the command
named in the next section.

It is a new surface rather than an addition to the existing inspector, and the reason is
concrete rather than aesthetic. The existing inspector draws abstract rectangles against a
synthetic outline and **never renders the shipped page's ink at all** — the page artwork is
not in its payload in any form, so there is nothing on it against which a displacement could
be seen. It is also addressed by verse rather than ordered by score, which is the wrong axis
for a worst-first review, and its payload is already several megabytes before adding page
crops. The new surface borrows the inspector's visual language deliberately, so that the two
read as one family.

### And how can someone check it rather than read it?

Reading that page tells you what this measurement thinks. It cannot tell you whether this
measurement is right, for the reason §⑩ ① gives: every row on it shows the verdict beside the
evidence, so looking at it is agreeing with it.

There is a second page for checking, and it shows no verdicts at all. It puts one mark on the
screen twice, draws a rectangle on each, and asks which rectangle sits on the mark — a hundred
times, in about twenty minutes, on marks drawn from every page that has a measured
displacement. Usually one of the two is the corrected placement and the other is what the app
draws today. Nothing on the screen says which, and nothing on disk knows: the session comes
from a seed, and the answers are rebuilt from that seed afterwards, by a second command, when
the answering is over.

It carries its own controls, so a session can fail in a way that is legible rather than just
disappointing — some pairs differ by the same distance in a *different* direction, which
measures whether the difference is visible at all; some differ by a whole letter, which
anybody looking gets right; and some are the same rectangle twice, where "I can't tell" is the
only honest answer. The scorer reports all four numbers, and refuses to score at all if the
displacements were re-measured after the page was built.

```
pnpm adjudicate:marks --seed 11 --count 100 \
  --shift docs/validation/rulings/mark-shift.604pages.c849e72d.json \
  --exclude docs/validation/rulings/mark-shift.40pages.c8528da9.json --pages 40 \
  --out packages/etl/out/mark-adjudication.heldout.html
# work that page in a browser, save the ruling it offers
# then move it into docs/validation/rulings/ and score it from there
pnpm adjudicate:score docs/validation/rulings/<the file you just moved> \
  --shift docs/validation/rulings/mark-shift.604pages.c849e72d.json
```

**Read the middle line carefully, because everything else inherits what it decides.** A session
can only offer a mark on a page that has a proposed move, so for as long as the correction
covered forty pages, every by-eye answer anybody could give was about those forty — the pages
the correction was fitted to. That is the same limit §⑧ exists to fix for the placing session,
and it applies here just as hard: the correction is going to ship on six hundred and four
pages, so the useful question is whether a reader prefers it on pages the fit has never seen.
Holding out the fitted forty and keeping forty of the rest is what those two flags do.

Both commands name the corrections file rather than taking whatever is loose in the build
directory, and they name the same one. A ruling's answers belong to the displacements it was
worked against; both scorers refuse a ruling whose displacements have moved underneath it, and
the scorer refuses a second time if the file it is handed has no row for a page the sitting
actually used — a file can carry the right fingerprint and still be the wrong file for these
pages.

That fuller pass has since run over all 604 pages, so a session can now be built on pages the
correction was never checked against: the placing builder takes the pages to draw from as an
argument, and will hold out the pages an earlier session used by reading that session's own
record of which pages it drew from. Its scorer replays that recorded list rather than choosing
again, so improving how pages are picked can never quietly re-score a sitting somebody has
already worked. It refuses on either of two fingerprints — the displacements, and the pages —
and refuses a third time if the displacements it is handed have no row for a page the sitting
used, because a file can carry the right fingerprint and still be the wrong file for these
pages.

Like the evidence page, that page is written to the untracked output directory and never
committed, for the same reason: it draws the mus'haf's own ink. What a reader *answers* does
come home, to [`docs/validation/rulings/`](../validation/rulings/) — page numbers, mark indices
and offsets, no ink and no scripture — because a verdict whose working lives in one person's
downloads folder is a verdict nobody else can argue with.

## Where does this live?

The reasons above are the document; these are the pointers, kept here so the prose stays
readable without them.

- `packages/etl/scripts/probe-mark-ink.mjs` — the measurement. Not a gate and not wired into
  `make ci` or the Makefile; run it directly or via `pnpm probe:mark-ink`.
- `packages/etl/scripts/lib/ink.mjs` — the rasteriser: path flattening, transform composition,
  integer scanline fill with both fill rules, summed-area tables.
- `packages/etl/scripts/lib/mark-ink.mjs` — the two scores, the placement search, the score
  interval and sample-size arithmetic, and the representative-shape selection.
- `packages/etl/scripts/lib/adjudication.mjs` — the by-eye session: which marks, shown how,
  and which rectangle was ours. A pure function of the seed and the measured displacements, so
  no answer key is ever written down.
- `packages/etl/scripts/build-mark-adjudication.mjs` — renders that session to one page,
  carrying no verdicts, no answers and a fingerprint of the displacements it was built from.
  `--exclude` names the sittings or fits whose pages must be held out and `--pages` how many of
  the rest to keep, both handed to `selectPages` with `even` rather than `extremes`; the list it
  settles on goes into the page's own head with its own fingerprint, and that fingerprint is
  folded into the resume key and the download name, because two sittings from one seed that
  asked about different pages would otherwise share both.
- `packages/etl/scripts/score-mark-adjudication.mjs` — rebuilds the key from the seed and
  reports the four numbers. This is the first moment anybody knows what the answers were. It
  replays the recorded page list rather than choosing again: the trials are rebuilt here, so a
  session narrowed at build time and scored unnarrowed would put every trial index against a
  different mark and throw nothing.
- `packages/etl/scripts/lib/marks.mjs` — one reader for a page's marks, shared by the
  measurement and the session so the two cannot disagree about what a mark is.
- `packages/etl/scripts/lib/adjudication.mjs`, `planNudge` — the placing session: which
  marks, how far out each rectangle starts, and which ones come round twice. Same shape as
  the session above, and for the same reason: rebuilt from the seed, so the correction it is
  measured against is never written down anywhere the reader could reach.
- `packages/etl/scripts/lib/adjudication.mjs`, `selectPages` — which pages a sitting may draw
  from: hold out the ones an earlier sitting used, then take from the ends of the spread on
  both axes rather than at random, because leverage and not sample size is what makes the size
  of the correction readable. The pages it returns are written into the session and replayed
  when it is scored, so changing this function cannot re-score a sitting somebody has worked.
- `packages/etl/scripts/build-mark-nudge.mjs` — renders that session to one page. It carries
  the ink, the rectangle and where the rectangle starts; the proposed correction reaches no
  markup, no attribute and no comment on it. `--exclude` takes the sittings whose pages must be
  held out, `--pages` how many to keep; it writes a companion file naming the pages it drew
  from, in the same shape a displacements file uses, so the next sitting can exclude it with no
  second format. The pages chosen carry their own fingerprint, folded into the key the browser
  resumes from — two sittings from the same displacements and seed but different pages would
  otherwise have stacked one's answers onto the other's trials. `--reader` names whoever is
  sitting it and is the only thing here that never reaches a trial: a second hand is only
  evidence if it saw the same marks in the same order from the same starting points. It is
  folded into that same resume key and into the name of the file that lands in the downloads
  folder, for the reason the pages were — otherwise the second person resumes into the first
  one's answers and their download arrives as a copy of it.
- `packages/etl/scripts/score-mark-nudge.mjs` — subtracts the proposed correction from where
  each rectangle was put and reports what is left, beside the precision of the hand that put
  them, so a residual smaller than the wobble is called what it is. It opens with **how many
  of the 604 pages the correction covers**, and whether any placement was made on a page
  outside them, because §⑧ is the limit every other number it prints has to be read against.
  Each residual is reported twice, once counting every placement as its own fact and once
  counting pages, and the verdict at the foot reads the second — see the library below. It
  also reports whether the correction is the right *size*, with the spread of the proposed
  moves beside it so a meaningless estimate is legible as one, and it prints what was ruled
  out, so nobody buys those answers twice. Handed a second person's sitting on the identical
  build, it also reports how far the two hands are from each other — mark by mark, against each
  hand's own wobble, with no threshold — because that comparison is the only thing that
  separates a print that is off by this much from one reader who places rectangles this way. It
  refuses a second file from a different build, and refuses the same reader twice, which would
  compare a hand with itself and come back looking like perfect agreement.
- `packages/etl/scripts/lib/placement-stats.mjs` — the arithmetic, kept apart so it can be
  tested against data whose answer is known by construction. Two marks on one page are not two
  facts about the fit: they share that page's frame, so an interval that counts them separately
  is narrower than the truth. The measurement above had said so about its own sampling since
  the day it was written; the scorer was built without it, and a residual was banked as real on
  an interval that counting pages puts across nothing. `agreementOf` is the one estimator here
  that compares two people rather than describing one, and it takes their difference mark by
  mark for a reason: an average against an average calls two hands that alternate either side
  of each other perfectly agreed. If either of them repeated nothing there is no wobble to read
  the gap against, and it says so rather than inventing one.
- `packages/etl/scripts/lib/adjudication.mjs`, `sameBuild` — what has to match before two
  sittings may be compared: same seed, same length, same displacements, same pages. It names
  every mismatch rather than the first, and it refuses two sittings by the same person, which is
  a hand compared with itself and the one failure here that nothing in the printed output would
  betray.
- `packages/etl/scripts/lib/placement-stats.test.mjs` — where that is proved rather than
  asserted: on ten pages of six identical values the honest interval must come out about two
  and a half times the naive one, and on values that share no page the two must agree. Two more
  are built to fail the tempting implementation of the agreement number — a disagreement that
  alternates in sign must not average itself away, and a hand whose wobble was never measured
  must come back as *cannot say* rather than as agreement.
- [`docs/validation/ledger.json`](../validation/ledger.json), `placement-correction-by-eye` —
  the runbook of record for §⑩ ①, and where its verdict gets banked.
- [`docs/validation/ledger.json`](../validation/ledger.json), `placement-residual-by-hand` —
  the same, for §⑩ ⑦.
- [`docs/validation/ledger.json`](../validation/ledger.json),
  `placement-holds-off-its-own-pages` — the same, for §⑩ ⑧, and the one place its five
  predictions are written down before anybody places a rectangle.
- [`docs/validation/rulings/`](../validation/rulings/) — the answers themselves, and beside
  them the two displacement files a verdict has to be scored against: the forty-page
  measurement both earlier sittings were built from, and the full 604-page pass everything
  built afterwards uses. Committed because a ruling that can only be re-scored by somebody who
  can first rebuild a gitignored file is a verdict nobody else can check.
- `packages/etl/scripts/lib/mark-shape.mjs` — the canonical examples and the shape comparison,
  shared with the naming measurement so that both use one library of examples rather than two
  that could drift apart. This document uses it only to decide which marks are eligible.
- [`mark-labels.md`](mark-labels.md) — the naming question, and why it is a different document.
- `packages/etl/scripts/lib/diacritics.mjs` — `readMarkOutlines` returns the publisher's own
  drawing of each mark beside the rectangles `readDiacritics` returns, sharing the same walk so
  the two cannot drift.
- `packages/etl/data/pages/word-boxes.pin.json` — where a per-page correction would be
  recorded under Option B.
- [`sub-word-marks.md`](sub-word-marks.md) §⑦ — the question this answers.
- [`encoding-inspector.md`](encoding-inspector.md) — the existing surface, and why this is
  beside it rather than inside it.
- [`docs/map.json`](../map.json), feature `word-geometry` — the code pointers of record.

Reproduce every number in this document with:

```
node packages/etl/scripts/probe-mark-ink.mjs --sample 4000 --seed 7 --pages-n 40
```

It takes about fifty seconds, reaches no network, downloads nothing, and exits with a failure
code today — by design, because the thresholds it checks are breached and §⑦ is the proposal
to stop breaching them.
