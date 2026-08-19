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

About the whole page's **text**. The same displacement can be recovered **without looking at a
single mark**: rasterising the entire second printing of a page — letters and all — and sliding
it against the entire shipped page needs the same shift, around 0.75 across and 1.00 down, with
the two pages' total ink agreeing to within 0.05 percentage points. It is the same print,
displaced. The marks are not wrong; the alignment between the two printings is.

But "whole page" was too generous a word, and the next question says why.

### Is there anything on the page that is *not* displaced?

Yes, and it is the one thing we were already using. Every ayah ends with a small ornament, and
both printings mark them — they are the only objects the two have in common, which is why the
alignment between the printings was built out of them in the first place.

So they can be asked a question nothing else on the page can answer. The alignment was fitted
to the ornaments and knows nothing about the ink; the displacement above was measured from the
ink and has never seen an ornament. Move the text by that displacement, and where do the
ornaments end up?

| | ornaments land this far from their partners |
|---|---|
| under the alignment we ship today | **0.053 units** |
| if the text's displacement were applied to them too | **1.206 units** |
| pages where that makes them worse | **120 of 120** |

Measured on 1,305 ornament pairs across 120 pages.

They were already right, and the correction would break them — by very close to the whole size
of the correction, on every page it was asked. That is the sharpest form of the finding in this
document: **the two printings agree about where their ornaments are and disagree about where
they set their text.** A difference the whole page shared would have read the same on both
lines of that table.

Two things follow, and both are load-bearing. First, this is the only evidence here that does
not come from the same well as the claim — everything else fits a rectangle to agree with ink
and then grades it by agreement with ink, whereas the ornaments could not have been fitted to
and were still asked. Second, whatever correction ships belongs to the *text* — the words and
the marks — and must leave the ayah-end ornaments exactly where they are. Moving everything
together would fix the marks by breaking the one part of the page that is currently right.

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
measured defect in the mark layer is the displacement, and the recommended option in §⑦ is the
whole remedy.

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

### Does any mark go wrong per class in a way this measurement cannot see?

The section above refutes a per-class bias using the ink search. On 2026-08-17 a reader found
one the ink search cannot see, and the two results do not disagree — they are about different
marks.

Two sittings, thirty marks each, drawn not at random but from the **bottom of the marks the
search accepts** — the band where our rectangle and the ink it settled on overlap between 0.55
and 0.65, which begins exactly at the floor below which the search gives up, and the band
immediately above it, 0.65 to 0.75. Being two rather than one is what makes them worth
reporting: each finding below can be read twice, on marks that differ only in how sure the
search was. Nothing here transfers to the 324,638 marks it placed confidently, and that caveat
travels with every number.

**Hamza is about a page unit across, and nothing else is.** Every hamza in both sittings was
moved sideways in the same direction — eleven of eleven — with the size left as drawn.

| | marks | sideways, median | vertical | width |
|---|---|---|---|---|
| overlap 0.55–0.65 | 7 | **1.077** units | 0.015 | 0.000 |
| overlap 0.65–0.75 | 4 | **0.573** units | 0.039 | 0.000 |

In the weaker band six of the seven fall between 1.04 and 1.35; in the better band all four fall
between 0.50 and 0.81. Across every other mark in the weaker sitting the median sideways move is
**0.002 units** — nothing at all. So this is not a page-wide shift surfacing in a small sample.
It is one class, in one direction, at a size a reader sees without being told to look — and it
**halves as the match improves**.

A hamza is the one mark here regularly printed sitting *on* another letter, and the obvious
mechanism is that a search matching ink against a drawing can settle on the seat rather than on
the hamza where the two touch — which would put the rectangle a letter's width across and leave
its size right, which is exactly what the reader corrected. That is a hypothesis, recorded as
one; nothing here tests it.

**Fatha and kasra are drawn too short, and by less when the match is better.** Both were grown
taller with their width left alone: fatha by a median of 0.600 units in the weaker band and
0.065 in the better one, kasra by 0.500 and 0.215, on boxes about 3.9 tall. Nine of the eleven
marks in the weaker sitting that grew by more than 0.2 are one or the other.

**Everything shrinks the same way**, which is the finding that ties the rest together. Between
the two bands the median distance the reader moved a rectangle falls from 0.363 units to 0.276,
and the worst from 5.877 to 2.053 — that worst being a kasra in the weaker band that ended with
essentially no overlap at all with where we drew it. **So the overlap score is doing its job.**
It does not predict whether a reader complains, because a reader who reaches for a mark by
pointing at its ink files a complaint either way (㉑ below); it predicts, quite well, *how far
out we were*.

None of this contradicts the refutation above, and it is worth being exact about why. That one
measured the residue left after correction across every mark in the book, using the ink. This
one measured sixty marks the ink search itself flagged as doubtful, using a person. A class
error living only in the tail the search is unsure about is invisible to an average over the
whole book, and it is the first thing a reader looking at that tail would notice. Both readings
are true.

What to do about it is ㉒ in the open questions below, and the short version is: find out
whether this is a property of the weak tail or a property of hamza, before touching any rule.

## ⑤ What do people outside this project do about this?

Two different questions get asked here, and the outside world answers them very differently.
*How should a box be scored against ink?* — **there is no published precedent for validating
per-mark boxes against the ink**, though two adjacent fields have most of the answer. *Why were
the boxes in the wrong place to begin with?* — that one turns out to be a **published theorem
with a name**, in a field that has been warning about it for twenty years. The claims below were
checked against primary sources; where something could not be established, it is named as such
at the end of the section rather than smoothed over.

### Why the boxes were wrong — somebody proved this, and it has a name

**Our headline finding is a theorem.** In medical image registration, the error measured at the
landmarks an alignment was fitted to has a name, and so does the error at the thing you actually
care about — and Fitzpatrick's
[*Fiducial registration error and target registration error are uncorrelated*](https://spie.org/Publications/Proceedings/Paper/10.1117/12.813601)
(SPIE Medical Imaging 2009;
[abstract](https://ui.adsabs.harvard.edu/abs/2009SPIE.7261E..02F/abstract),
[Semantic Scholar](https://www.semanticscholar.org/paper/8ff408ad2d79dc5d8121bed0a702eb6d70a4e258))
shows the two are **uncorrelated**. How well the fit closed where it was fitted tells you nothing
about how wrong it is where it was used. Our ayah-end ornaments are the landmarks, our marks are
the target, and the correlation of **0.117** in §④ is that result reproduced in a mus'haf.

Three things follow, and they are why this is worth reading rather than merely citing.

It is a **trap people keep falling into**, not an exotic case: the literature says in as many
words that practitioners still fight the intuition that a tight fit at the landmarks means a
good alignment, and somebody built
[a teaching tool specifically to break that intuition](https://pmc.ncbi.nlm.nih.gov/articles/PMC7612039/).
Three sessions of this project went into arguing about that residual. That is the trap, and we
were in it.

Worse, the residual is not merely uninformative — it is
[weakly *anti*-correlated in theory](https://www.sciencedirect.com/science/article/abs/pii/S1361841511000028),
because a fit can close tighter at its landmarks by absorbing their noise and be worse
everywhere else. So "this page fits its ornaments to a tenth of a unit" was never evidence in our
favour at all.

And the remedy that field reaches for is the one §④ now uses: **hold out a target the fit never
saw**. [SimpleITK's registration-error notebook](http://insightsoftwareconsortium.github.io/SimpleITK-Notebooks/Python_html/68_Registration_Errors.html)
is the worked version. Turning the ornaments from the thing we fit on into the thing we check
is that recipe, inverted.

**The mechanism is a typography one, and it predicted the line before we measured it.** Two
renderings of one text diverge because their glyph advance widths and line metrics differ, which
slides every glyph along a line and changes where lines break and how they justify — documented
for PDF in [inconsistent glyph width information](http://martin.hoppenheit.info/blog/2018/pdfa-validation-and-inconsistent-glyph-width-information/),
in [how substituted metrics move line breaks and spacing](https://www.syncfusion.com/blogs/post/pdf-font-issues-javascript-pdf-viewer),
in [line metrics as a font-development concern](https://silnrsi.github.io/FDBP/en-US/Line_Metrics.html),
and most sharply in
[*Story Beyond the Eye: Glyph Positions Break PDF Text Redaction*](https://arxiv.org/pdf/2206.02285),
where per-glyph positions carry enough information to leak redacted words. Error that
accumulates **along a line** and resets at the next one is the expected signature of two prints
of one text. That is an argument for the printed line as the unit of the correction, and it was
arrived at without looking at our own numbers.

**It has since been tested, and it held.** That order matters more than the result: a prediction
made from somebody else's literature, written down, and only then measured is a different kind
of evidence from a pattern noticed in our own data and explained afterwards — the second is
always available and is worth very little. Correcting line by line takes badly-placed rectangles
from about one in five to about one in nineteen, and letting each line tilt is what does most of
that, which is the specific shape the typographic argument predicts: not a constant offset a
line, but an error that accumulates *along* it. §⑦ carries the figures and the controls.

**And the standard fix is local rather than global, which is well-trodden ground.** Thin-plate
splines pair a global part with a local warp
([Chui & Rangarajan](https://www.cise.ufl.edu/~anand/pdf/rangarajan_cviu_si_final.pdf));
[non-rigid registration](https://www.sciencedirect.com/topics/computer-science/nonrigid-registration)
generally treats a good global fit as the *prerequisite* for a local stage rather than as the
answer. For documents specifically, ICDAR 2024's
[coarse-to-fine document image registration](https://dl.acm.org/doi/10.1007/978-3-031-70546-5_20)
learns a global transform and then a local one, and there is a patent family on
[line-based registration for transferring annotations between images](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10503868)
— *annotation transfer*, which is exactly what we do with mark rectangles.

**Where we looked and found nothing — said plainly, because a search that came back empty is a
different thing from a search nobody ran.** We found nobody publishing on our actual case:
registering two independently typeset editions of the *same* text at glyph level, where both
sides are vector outlines with no pixels and no recognition involved. The document work we found
is about photographs of paper, where the distortion is physical. Nor did we find a published
version of the inversion above — *fit on the text, validate on the landmarks* — which follows
straightforwardly from Fitzpatrick but which nobody appears to have written up as a recipe.
Searched: non-rigid document registration and piecewise text-line alignment; Fitzpatrick's
result; document registration and cross-image annotation transfer; justification, line breaking
and glyph-metric differences between two renderings. **Not searched:** Arabic-script-specific
typesetting corpora, and the Qur'anic-computing literature — either could hold something, and
neither was opened.

### How a box should be scored — the part with no precedent

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

Every option below is measured the same way, by the same instrument, on the same marks — and
on marks it was **not allowed to see while it was being worked out**. That last part is what
makes these numbers comparable at all, and it is worth one plain sentence before the table.

A correction is worked out by looking at where the marks actually sit and moving the rectangles
to match. Grade it on those same marks and it will always look better, including when it has
learnt nothing and simply memorised them — and the more elaborate the correction, the more
flattering that is. So each page's marks are split down the middle at random: the correction is
worked out from one half and graded on the other half, which it never saw. A correction that
only memorises does well on the half it was given and no better than the simpler ones on the
half it was not. Everything below is the half it was not.

The numbers: 120 pages, about 63,600 marks, half of them held back — so every figure in the
table is 31,700 marks the correction was blind to.

| what it records | marks badly out | how much ink a rectangle covers | clears its control by | beats a deliberately wrong placement |
|---|---|---|---|---|
| A · nothing | 96.63% | 0.015 | **−0.234** — fails | 13.4% |
| B · one move per page | 18.38% | 0.494 | +0.282 | 76.2% |
| E · one move per printed line | 11.77% | 0.584 | +0.383 | 83.4% |
| **F · a printed line allowed to tilt** | **5.24%** | **0.681** | **+0.491** | **90.6%** |

*Badly out* means further than 0.75 units from the mark's own ink, on marks about 5.6 wide and
3.6 tall. *How much ink a rectangle covers* runs 0 to 1 and cannot exceed **0.909** for these
rectangles even when they are placed perfectly, so read 0.681 against 0.909 rather than against
1. *Clears its control* is the gap between a rectangle and a deliberately wrong one; below 0.25
nothing else in the row means anything.

**The same split run over the whole book gives the same answer, and it is worth saying that it
did.** The table above is 120 pages measured by the scorer in full, which is where the last two
columns come from — ink overlap and control separation both need a re-score against the page's
own ink at the corrected position, and no table of displacements can reconstruct them. The first
column can be reconstructed, so it was, over all 604 pages and 326,515 marks on the identical
half-and-half split: **96.44% → 18.20% → 11.84% → 4.95%**, against 96.63 → 18.38 → 11.77 → 5.24
here. Four independent rungs, five times the pages, and nothing moves by a third of a point.
Those are the figures the drawn page carries, because it can carry all 604 pages honestly and
this table cannot; the two are not in conflict, they are the same measurement at two widths.

**Option I is a fifth rung on that reconstruction and deliberately not a fifth row in the table
above.** It was worked out after the 120-page scoring run and only the first column can be
reconstructed without re-scoring every page against its own ink, so what is known about it is
**4.12%** badly out on the whole book, on the same held-back half — and the other three columns
are honestly blank rather than estimated. Adding a row of dashes to a table a reader scans
downward would read as a worse score than F rather than as an unrun measurement, so it is stated
here in a sentence instead. The Option I section below carries the rest.

The options are lettered in the order they were first written, not in order of preference — the
table above is the order of preference, and the recommendation moved.

**These options are also drawn, and the drawing is the thing to send anybody who has to choose.**
Six of the nine — A, B, F, G, I and H — are rendered on a real page of the mus'haf at the size a
phone actually draws it, each one beside the printer's own ink, because a displacement of one
unit is a number here and a picture there, and only one of those settles anything. The page is
[`mark-placement.html`](mark-placement.html), rebuilt by
[`scripts/build-placement-options.mjs`](../../scripts/build-placement-options.mjs), and published
for a reader with no repository at
<https://claude.ai/code/artifact/7652b2f5-61a1-4072-bfab-ef3b649e55f5>. C and D are not drawn
because there is nothing in them to look at: one is a stretch too small to see and the other puts
these same rectangles on the page and forbids using them. E appears in the drawn page's table of
numbers but has no picture of its own, because F is E with one thing added and drawing both would
ask a reader to spot the difference between two nearly identical pages. The same letters mean the
same options in both places, though the drawn page puts I next to F rather than last, because the
two differ by one thing and seeing that difference is the whole reason I is drawn at all; the
register row is `mark-placement` in
[`docs/decisions.json`](../decisions.json).

### Option A — change nothing, and do not draw marks

The rectangles stay as they are and no feature is built on them. Honest, and it costs
nothing today.

Measured consequence: the mark layer is permanently unusable for pointing at anything. 96.63%
of rectangles are further than 0.75 units from where their own ink is; the median rectangle
misses its mark's ink almost entirely (overlap 0.015); and a rectangle picked at random from
elsewhere on the page describes the ink *better* than the right one does.

### Option B — record one displacement per page, measured from the ink · **superseded by F**

Each page's fit gains a small correction, derived as the median displacement of that page's
marks and recorded alongside the four numbers already stored per page. It is written down
once, exactly like the fit itself, and read thereafter — so the existing rule against
re-fitting at call sites is respected rather than broken.

Measured consequence: badly-placed rectangles fall from 96.63% to **18.38%**, blank ones to
0.08%, the median overlap rises from 0.015 to 0.494, and the measure clears its own control by
0.282 where it previously failed it by 0.234. Two numbers per page, both derived offline from
committed bytes, and the derivation is reproducible byte-for-byte.

**Why this is no longer the recommendation, and it is not a close call.** Two things were
learned after it was written, and each on its own would be enough.

The first is that **it fails the threshold this very section proposes for it**. Read down to
"What thresholds would go with this" and the number is *no more than 2% of rectangles further
than 0.75 units*. This option delivers 18.38%, and on the very same pages it delivers 18.12% on
the marks it was worked out from — so this was true the day it was written and nobody put the
two figures side by side. One rectangle in five badly out is not a threshold being narrowly
missed; it is a model the threshold refuses outright. Those two figures are worth keeping
together for a second reason: a quarter of a percentage point between grading a model on its own
marks and grading it on marks it never saw is what *no overfitting at all* looks like, which is
the baseline the finer options have to be read against.

The second is that **the family this option belongs to is exhausted**, which §④ measures. Every
option that moves a whole page as one rigid thing — whether by shifting it, stretching it, or
re-deriving it from scratch — leaves about 0.44 units of scatter across the page and 0.34 down,
because the two printings do not disagree about the page *as a page*. They disagree about where
each printed line of text sits. No amount of care spent on a per-page number reaches inside
that, which is why two sessions of careful measurement moved the figure and never the problem.

Cost, if it were adopted anyway: the correction is derived from the ink, so it must be
re-derived if either printing changes — which is what a gate is for, and §⑩ ② is that gate.
That cost is unchanged for E and F below; it is a property of correcting from the ink at all,
not of the grain.

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

### Option E — record one displacement per printed line

Each printed line of the page gets its own small move, recorded on top of its page's. A page
holds fifteen lines, so this is thirty numbers a page rather than two, all of them derived the
same way and written down once exactly as the page's own move is.

**Why a line, and not something else.** This is not our own numbers suggesting it — it was
predicted before they were looked at, and by an argument that has nothing to do with this
project. Two printings of one text disagree because their letters are set to slightly different
widths. Widths accumulate *along* a line and start over at the next one, so error that grows
across a line and resets at the beginning of the following one is exactly the signature two
independent settings of the same text produce. §⑤ carries that literature. The line is also the
only unit here that is both meaningful and populous enough to measure: a printed line carries
about 36 marks — thirty at the sparsest, forty-three at the densest — and a move worked out from
36 observations is a measurement, where a move worked out from the 3.7 marks on a word would be
a fit to noise wearing the costume of a correction.

Measured consequence: badly-placed rectangles fall from 18.38% to **11.77%**, overlap rises
0.494 → 0.584, the control gap widens 0.282 → 0.383, and the share of rectangles beating a
deliberately wrong placement goes 76.2% → 83.4%. The tail moves too, which is the part a median
hides: the 95th-percentile miss drops from 1.417 units to 1.008.

Cost: the correction no longer fits in the four numbers a page already carries, so it needs a
small table of its own beside them, and everything that places a rectangle has to read it. That
is the real price of E and F both, and it is what §⑩ ⑨ is holding open.

### Option F — record a printed line that is allowed to tilt · **recommended**

The same as E, except that a line's move is permitted to change gradually from one end of the
line to the other rather than being one number for the whole line. Four numbers a line instead
of two.

This is the same typographic prediction as E, taken one step further and to its actual claim.
If the disagreement really is letters set to different widths, then it does not merely differ
between lines — it *grows along* each one, so the far end of a line is further out than the
near end. E can only record where a line sits on average. F records the growth, which is the
thing the mechanism actually predicts, and it is why F was written down before it was measured
rather than being found by trying things.

Measured consequence, and it is the largest single step on the whole ladder: badly-placed
rectangles fall from 11.77% to **5.24%**, overlap 0.584 → **0.681** against a ceiling of 0.909,
the control gap 0.383 → **0.491**, and 90.6% of rectangles now beat a deliberately wrong
placement. The typical miss is 0.225 units — well under a tenth of a mark's width — and the
95th-percentile miss is 0.755, meaning nineteen rectangles in twenty now land inside the
distance §⑦'s own error budget allows.

**The control that makes this believable.** A model with sixty numbers a page can flatter itself
in a way a two-number one cannot, so it was given a test designed to catch exactly that: every
line was made to wear some *other* line's correction, at random. If the per-line numbers were
absorbed noise, wearing the wrong one would be about as good as wearing the right one. Instead
the shuffle scores **31.2% badly out** — far worse than doing nothing per-line at all, and six
times worse than F. A line's correction is a fact about that line.

Cost, and one honest reservation. The table is twice the size of E's, and a line with too few
marks to fit a tilt has to fall back to its line's plain move and then to its page's, so what
ships is a small ladder rather than one number — which is more machinery to get wrong. And the
5.24% left over is **not** simply the tail of a tight scatter: a bell curve of the same width
would leave about 3.1%, so there is a minority of rectangles still badly out for some reason of
their own rather than every rectangle being slightly out. That difference is a real finding and
it is deliberately not averaged into the headline: it says a further question exists, and it is
not the question this section is answering. §⑩ ⑨ carries it.

That question has since been asked, and half of it has an answer: the rectangles F leaves badly
out are concentrated on whole printed lines that have gone wrong together, and a line can go
wrong in a way a steady change from end to end cannot follow. Option I is that finding turned
into an option. The other half is still open — a rectangle at either *end* of a printed line
remains about twice as likely to be badly out as one in the middle, under F and under I alike,
and nothing here explains why.

### Option G — the same, applied to the marks and not to the words

The correction from F, carried onto the mark rectangles only. Word rectangles stay exactly where
they ship today.

This is a separate question wearing the same letter-shaped clothes, and it is written down as an
option because it was quietly being assumed rather than chosen. The four numbers this whole
document is about do not place marks; they place *everything on the page*, word rectangles
included — a word box is derived from the same fit, in the same file, by the same line of
arithmetic. So a correction that moves the marks and not the words is not the cheaper half of F.
It is a decision that the two layers may drift apart, made once and then true forever.

Measured consequence: **identical to F for every number in the table above**, because every
number in the table is measured on marks. That is exactly what makes this option dangerous to
compare — it costs nothing by the only measure on this page, and everything it costs is
somewhere the page does not look.

What it costs is elsewhere and is real: a word rectangle is what a reader's finger actually lands
on when they pick out words, so leaving it on a fit we have now measured as about one unit wrong
is knowingly shipping the error we just spent this document establishing, in the one layer a
finger touches. Against that, a word box is roughly 22 units wide against a mark's 5.6, so the
same absolute error is a far smaller fraction of it — which is an argument about priority, not
about correctness.

The reason to draw it rather than argue it: on the page, G and F are the same picture except for
the word rectangles, and whether that difference matters is a thing to look at rather than a
thing to reason about.

Cost: two geometries fitted from one set of measurements and free to disagree, which needs a gate
holding them to each other or it rots silently — and rebuilding the word shards is the work F
requires anyway, so choosing G to avoid a rebuild does not avoid it.

### Option H — put each mark where its own ink is, and line up the rest

Instead of working out a move for a page or a line and applying it to every rectangle inside it,
look at each mark individually, find where its own printed strokes actually are, and write that
down. A mark whose strokes cannot be found convincingly does not get this treatment; it inherits
its printed line's move from F. Word rectangles and verse-end circles have no such measurement of
their own, so they inherit F as well.

**This is the idea §⑧ opens by refusing, brought back with two refusals built into it**, and the
refusals are the option. A search is trusted only where it has evidence. It is not trusted where
the best match it found was poor — there it is chasing noise rather than finding a mark — and it
is not trusted where the answer sits on the very edge of how far the search was allowed to look,
because that is a search which has run out of room rather than one which has found something.
Over the whole book those two refusals hand back **1,877 rectangles, 0.57% of the mus'haf** —
1,210 poor matches and 730 that ran out of room — and accept **324,638, or 99.43%**.

**What killed the original objection, and it is worth reading rather than taking on trust.** The
first version of §⑧ refused this idea partly on the grounds that adjacent marks sit about as far
apart as the error is large, so a search for the nearest ink would sometimes settle neatly onto
the *neighbour's* — manufacturing exactly the complaint that started all of this. That was a
guess, it was measured, and it was wrong by an order of magnitude. The nearest mark of any name
is a median **8.32 units** away and the nearest one that looks the same is **24.80**, against a
search reaching 3 units and an error near 1. Across all 326,515 marks the search lands nearer
some other mark 1.08% of the time and nearer an identical-looking one **0.014%** — 47 marks in
the whole mus'haf.

Measured consequence, and the shape of it matters more than the number. Counting only the marks
this option refuses to place from ink — the ones it hands to F — **0.42%** of the whole book is
badly out, against F's 4.95%. On the page drawn throughout the options record it is **zero**.

**And that number cannot be read the way the others can.** Every other option in this section is
graded by holding half of each page's marks back and marking the correction on marks it never
saw. This one has nothing to hold back: each mark carries its own two numbers, so there is no
second half of anything, and the 99.43% it accepts score zero by construction — a zero that
carries no information whatever, because the thing being graded and the thing grading it are the
same measurement. That is why it is not in the table above and why its 0.42% is stated as *the
part of it that is a model*. This is the trade the option asks for: far fewer rectangles out of
place, and no way for this instrument to prove it.

Cost, and it is the largest on the page. Two numbers for every mark in the mus'haf — a table
bigger than the mark data it corrects, expressible in no version of the small per-page table the
app reads today, and needing a file of its own beside it. It records rather than explains, so it
says nothing at all about a printing nobody has measured, which is the one thing a per-line model
does offer. And the word rectangles still move, are still rebuilt and still re-checked, exactly
as under F — choosing H does not avoid that work.

What it needs before it could ship is not another measurement. It is a person looking at a sample
of the rectangles it places and saying whether they sit right, because that is the only witness
that is not made of the same ink the option was measured against. §⑩ ① is the sitting; §⑩ ⑩ is
the question of what the ones it hands back actually are.

That sitting now exists, in two halves, and it is worth being exact about what each half can and
cannot buy. Sixty rectangles are drawn from the 99.43% this option places and sixty from the
0.57% it hands back, and they are read apart and never pooled — the two populations differ in
size by a factor of 173, so a single rate over both would be a fact about how many of each the
sample happened to contain. The reader answers in words rather than distances, and passing a
rectangle is itself the answer that nothing is wrong with it, so the rate is faults over
rectangles-looked-at and the page keeps that count for exactly that reason. **A clean sixty is
not a zero.** Sixty rectangles with no fault in them bound the failure rate at about one in
twenty, which over 324,638 marks is up to sixteen thousand of them — so the sitting can say *not
more than this* and can never say *none*, and the interval rather than the percentage is the
finding. What it can do, and nothing else here can, is notice a fault that is confidently
identical everywhere: three or four faults in sixty is a few per cent of almost the whole book,
which is a statement about the mus'haf, where the same share in the tail is a rounding error.

### Option I — record a printed line that is allowed to bend

The same as F, except that a line's move may bend along the line rather than only grow at a
steady rate from one end to the other. Six numbers a line instead of four.

**Where it came from matters, because it is the one option on this page that was not reasoned
out in advance.** F was written down before it was measured, from a claim about how the two
printings set their letters. I was not: it came from asking what F's leftover rectangles have in
common, and the answer was each other. Of the marks F still leaves badly out, **54%** sit on the
one printed line in fifteen that has gone wrong as a whole — 590 lines out of 8,817 — rather than
being spread evenly over the book. Lines fail together, and a line that fails does so in a shape
a straight change from end to end cannot follow. So this option is a fit to an observation, and
that is a weaker kind of reason than F has. What makes it believable is not the story but the
half of the marks it was never shown.

Measured consequence, on the whole book and on the held-back half: badly out **4.95% → 4.12%**,
and the typical miss **0.224 → 0.198** units, over 326,515 marks and 8,702 printed lines. The
other columns of §⑦'s table are not filled in for this option, for the reason given above it.

**The control, run again because a bend has more room to flatter itself than a tilt does.** Every
line was made to wear some other line's bend, at random. That scores **34.40%** badly out —
worse than wearing another line's tilt, and far worse than the 18.20% for no per-line correction
at all. A line's bend is a fact about that line, not absorbed noise.

**And the rung above it was refused, which is how a ladder is meant to end.** A shape freer still,
allowed to change direction twice along a line rather than bend once, was fitted the same way and
rejected: better on the marks it was fitted from and worse on the marks it was not, which is what
an allowance with nothing left to find looks like. Each extra freedom also raises the number of
marks a line needs before it may use it, so the freer shape abandons the short lines, which are
already the ones going worst. That comparison was made off this ladder and is **not reproducible
from what is checked in**; the four rungs above are.

Cost: half as much table again as F, six numbers a printed line rather than four, and a deeper
fallback ladder — a line too thin to carry a bend takes its tilt, then its plain move, then its
page's. Everything F disturbs, I disturbs identically: the word rectangles move too, are rebuilt,
and are re-checked. Nothing new has to be learnt to read it, because it is the same table shape
with more numbers in each row.

The honest reservation: **it fixes the middle of a line and barely touches the ends.** The middle
goes from 4.34% badly out to 2.94%, while the two ends go from 6.58% and 6.95% to 5.97% and
6.02%. So the concentration this option was built from is only half accounted for, and the half
left standing is the half this whole enquiry started from. That is left as an open question in
§⑩ ⑨ rather than chased with a seventh rung nobody can justify in advance.

### What thresholds would go with the recommended option, and are they enforced?

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

**The second of those three is not met by any option this instrument can grade, and that has to
be said before anything else about it.** The recommended option leaves 5.24% beyond 0.75 units
against a threshold of 2%. The blank threshold is met with room to spare (0.03% against 0.5%) and
so is the control threshold (0.491 against 0.25); it is the middle one, and only the middle one,
that refuses every option including the recommended one.

**Option H appears to clear it and that appearance is exactly what the threshold cannot check.**
Its attributable figure is 0.42%, comfortably inside 2% — but the 99.43% of rectangles it places
directly are not being tested by anything, because the number the threshold measures against is
the number H ships. A threshold is a claim that something independent would agree; here nothing
independent has been asked. So the honest statement is that H is untested against this threshold
rather than that it passes it, and what would change that is a person looking, not a re-run.

**Somebody has now looked at sixty of them, and it moves the statement without settling it.**
Sixty crops drawn reproducibly from the marks H places directly, sat in one go on 2026-08-14:
every one explicitly vouched for, no fault of any kind reported, no printing oddity raised. Read
strictly, sixty clean answers put an upper bound of about **5%** on how often a reader would find
something wrong there — not zero, because sixty is sixty. Read honestly, it says less than that,
and the caveat has to travel with the number wherever it goes: those sixty are drawn from the
population *defined by* a match of 0.55 or better and a displacement under three units on a mark
roughly 5.6 by 3.6, so a gross error was structurally impossible on those cards before the reader
arrived. Sixty clean answers from a population that cannot contain the fault being looked for is
weak evidence about the fault and strong evidence about something else: that the instrument works
and a reader can sit it. The threshold stays untested. What tests it is the other population, the
one the correction refuses and falls back for, and all 1,877 of those are now dealt out to be
seen rather than sampled.

There is an obvious and dishonest way out, which is to notice that the 0.75 came from a budget
whose first term was *the scatter left after the fit* — 0.46 units under a per-page model — and
that the recommended option leaves 0.34, so the budget recomputes to about 0.50 and the
threshold could be re-derived and then re-declared met. That would be moving the target to
where the arrow landed, and doing it inside a document whose whole purpose is to be checkable
by somebody who was not here. So: the threshold as written stands, it is not met, and
re-deriving it is a decision that belongs to whoever adopts a correction — made in the open,
with the old number and the new one both visible, and not folded into this paragraph.

What the recommended option can say for itself against that threshold is narrower and true:
nineteen rectangles in twenty land within 0.755 units, so the budget describes the *typical*
rectangle accurately and the argument is entirely about how long a tail is tolerable when there
are 326,515 of them. That is a judgement, and §⑩ ① is where a person makes it.

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

**Unguarded per-mark local search — the version of option H that was excluded, and why the
guarded one is not.** This entry was written first as a three-part refusal of shipping
`bestPlacement`'s own output. One of the three parts was an assertion that had never been
measured, and measuring it killed it. The refusal is left here rather than deleted, because the
part that died is the reason option H exists at all.

*It is unfalsifiable — this part stands.* Those per-mark displacements are the reference every
figure in §⑦ is scored against: the residual under a correction is `(dx, dy)` minus what the
correction proposes. Ship them and the residual is identically zero, `far` is 0%, and no
split-half, null control or held-out page can say otherwise, because the grader and the candidate
are the same object. Split-half is not merely inconvenient here, it is structurally impossible —
each mark carries one observation and the model spends two parameters on it, so there is no
half to hold back. That does **not** make the option wrong; it makes it one this instrument
cannot rule on, which is a statement about the instrument. The check it needs is §⑩ ⑨.

*It manufactures the wrong-mark symptom — this part was false.* The claim was that adjacent marks
sit roughly a unit apart while the error is roughly a unit, so a search for the nearest ink would
often find the neighbour's and centre a rectangle on the wrong mark. The first half was a guess and
it was wrong by an order of magnitude. Measured over all 326,515 marks, per page, centre to centre:
the nearest mark of *any* name is a median **8.32** units away and the nearest one bearing the
**same** name is **24.80**, against a search that reaches 3 units and an error near 1. Counting
landings that end up closer to another mark's centre than to their own: **1.08%** for any
neighbour and **0.014%** — 47 marks in the whole mus'haf — for one that would look identical. The
symptom the 2026-08-12 sitting reported is displacement being misread, exactly as §④ concluded; it
is not this. `neighbour` in `mark-placement.data.json` carries the figures, computed in the same
pass as everything else on the options page.

*It is not a model — this part stands, and is a cost rather than a disqualification.* A per-page
translation is two numbers, `line-tilt` about sixty a page. This is 326,515 pairs, a table larger
than the mark data it corrects, expressible in no version of `word-boxes.pin.json`, and silent
about every page the probe never sampled. It says nothing about *why* the prints differ, so it
cannot generalise, which is the whole point of §④'s finding that the difference is systematic. It
is re-derivable — the probe is deterministic and the correction rungs are fitted from the same run
— but re-deriving it is not the same as predicting anything.

What the measurement *did* refuse is narrower than the original entry and sharper. The search is
trustworthy exactly where it has evidence, and two populations have none:

- **Weak matches.** Grouped by `iouBest`, the search's departure from `line-tilt`'s answer is a
  median 1.79 / 2.77 / 1.72 units below 0.15 / 0.15–0.35 / 0.35–0.55, throwing 44.6% / 71.7% /
  44.3% of marks past 2 units. At `iouBest ≥ 0.55` — 325,305 marks, 99.63% — the median departure
  is **0.21** and only **0.2%** go past 2. Below that threshold the search is chasing noise.
- **Clamped searches.** 730 marks (0.22%) come back with a component sitting exactly on the ±3-unit
  edge of `bestPlacement`'s window. Their `dx, dy` are not a finding about ink, they are a fact
  about the window, and they are a caveat on those marks' figures in §⑦ since their *grading
  target* is clamped. At this scale it is a rounding error rather than an argument for a wider
  `RADIUS`, but the wider run is cheap and settles it.

  **The first version of this bullet said 9,569 marks, and the arithmetic behind it was wrong.**
  It asked whether the straight-line distance `hypot(dx, dy)` exceeded the radius. The search
  slides the outline over a *square* window — ±3 in each axis, independently — so that test draws
  a circle inside the square and condemns every corner of it. It discarded **8,358 marks whose
  median overlap was 0.905 against an achievable 0.909**: placements sitting essentially perfectly
  on their ink, thrown out under a label saying the search had run out of room when it had not
  come near its edge. Distance travelled is not evidence of a bad placement. The test is per axis
  now, and the error is left written down here because every H figure published before this
  correction was built on it.

Option H is this idea with those two refusals built in: place from ink where `iouBest ≥ 0.55` and
neither component of the search's answer sits on its boundary, inherit `line-tilt` otherwise. That
accepts **324,638 marks (99.43%)** from direct evidence and hands back **1,877 (0.57%)** — 1,210
weak matches and 730 clamped. The fallback set scores 73.2% badly out under `line-tilt`, far worse
than the corpus, which is what a set selected for having no usable ink evidence should look like.
Since the accepted marks' zero carries no information, the only figure honestly attributable to H
is that fallback share of the whole book: **0.42%**, against `line-tilt`'s 4.95%. On page 179, the
page drawn throughout the options record, it is **zero**.

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

**What "the corrected rectangle" means has moved, and it moves two things here.** When this
section was written there was one candidate, and it moved every mark on a page by the same
amount. The recommended one now moves each printed line by its own amount, and the two
consequences pull in opposite directions. The first is unwelcome: the difference a reader is
being asked to see is now typically about a fifth of a unit rather than two fifths, which is
half the size, on a mark under four units tall — so the ceiling this session measures with its
same-distance decoys stops being a formality and becomes the number the headline lives or dies
by. The second is a gift, and it arrived by accident: the old worry that a reader would learn
the rule within twenty trials rested on the error pointing the same way on every page, and it
does not point the same way on every *line*. A learned rule is worth much less against a
correction that changes direction down the page, which means the decoys are doing less work
holding the session honest and more work measuring what an eye can actually resolve.

Neither of those is a reason to sit it sooner. It is the opposite: a session built against the
per-page move would be measuring a candidate nobody intends to ship, at a difference twice the
size of the real one, and would come back more favourable than the truth. Whatever ships gets
built into the trials first.

The runbook is `placement-correction-by-eye` in
[`docs/validation/ledger.json`](../validation/ledger.json); it takes about twenty minutes and
needs no mushaf, no phone and no network. If the same person is going to sit the placing
session as well, this one goes first: dragging rectangles onto marks for twenty minutes is the
most efficient way there is to learn where our correction tends to sit, and a reader who has
learned it is answering these hundred trials from the rule rather than from the ink. The
reverse order costs nothing, because knowing which of two rectangles you preferred does not
tell you where to drag anything.

### ② Is there anything stopping the correction going stale · **open**

If any correction in §⑦ is adopted, it is data derived from two printings, and nothing
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
reader puts them. That is a number a correction can be edited by, where ① can only say whether
to adopt it at all.

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

**What a sitting said**, recorded in full in
[`docs/validation/rulings/2026-08-12T1650-placement-residual-by-hand.seed23.json`](../validation/rulings/2026-08-12T1650-placement-residual-by-hand.seed23.json).
Sixty marks, placed by one reader in about seven seconds each.
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

**What has changed since, and it changes what this sitting is for.** The sitting's own summary
was *the direction is settled and the distance is not*, and it tested three explanations for
the leftover distance — the mark's name, a stretch across the page, and the reader's starting
point — and rejected all three. It could not test a fourth, because a sitting with sixty marks
on forty pages has no way to look inside a page. The machine has since looked: the leftover is
organised by **printed line**, and correcting line by line removes most of it. So the sitting
was right that it is not the mark, not the reader and not a stretch of the whole page — and the
thing it was left with is a stretch of each *line*, which is both smaller than a page and larger
than a mark, and sits in the one place sixty trials could not reach.

That does not retire this question; it sharpens what it is worth asking. Re-asking *is the
correction far enough* about a per-page move is now spending a reader's half hour on a model
nobody intends to ship. Asked about the correction that does ship, on pages it was never fitted
to, it is the only instrument here that is not made of ink at all — and the leftover it would
measure is now expected to be small, which makes the hand's own repeatability the thing that
decides whether the sitting can say anything. That floor was 0.03 units. Whatever ships should
be built into the trials before anybody sits them; the runbook says so in as many words.

**And what the leftover is made of, which until now this section could only size.** A second
kind of sitting asks the other half of the question: not *how far out* but *what kind of
wrong*, one mark at a time, in words rather than in a distance. It is being sat over the marks
the machine could not place from their own ink — 1,877 of them, every one to be seen — and 160
have been looked at so far. **158 came back carrying a complaint.** Named: 158 said the
rectangle is in the wrong place, 37 said it is also the wrong shape, 15 said the printed mark
itself is odd, and 2 said nothing was wrong. On the largest single sitting the share is 99.0%
with a 95% interval of 94.6% to 99.8%, over 101 marks once the ones that questioned the print
are held out.

**Read that as a fact about the population before reading it as a fact about the print.** These
are by construction the marks nothing could place, so a near-total fault rate is what the set
was selected to produce and is not news. What *is* news is the composition. Only 15 of 160 were
called odd in the print, so the leftover here is overwhelmingly ours to fix rather than the
printer's — the opposite of the comfortable reading. And the direction agrees with the ink:
where the reader left those rectangles, measured from the box before any correction, runs about
3.3 units across and 2.6 units down in medians, which is the same way and roughly the same size
as the machine's own measurement, arrived at by an instrument made of nobody's arithmetic.

**Two of the six things a reader can say were never said once**, across 564 answers: that the
rectangle is round the wrong ink, and that something else is wrong here. A word nobody uses is
usually a word that should go — but the first of those only became cheap to say in the same
week the sittings resumed, when tapping the ink became the way to say it, so this is a reading
to take again after the next few sittings rather than a licence to delete anything now.

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

**Most of that remainder has since been named, and naming it changes what this question is
asking.** It is not scatter. It is organised by printed line, and correcting line by line takes
one mark in five down to one in nineteen — §⑦ carries the figures and the options. Two things
follow for this section. The generous one: nothing above needed revising, because a page that is
displaced is still displaced, and the finer model is applied on top of the per-page move rather
than instead of it, so every reading here about how the pages vary from one another still holds
exactly as measured. The uncomfortable one: **a per-line correction is many times more numbers,
and this section's question is precisely the one that gets harder the more numbers there are.**
Six hundred pages carrying two numbers each can be sanity-checked by looking at the spread of
1,200 numbers. Nine thousand printed lines carrying four each cannot be eyeballed by anybody.

Two of the four questions §⑦'s options are scored on exist for exactly this reason, and both
were asked. Every figure quoted there is measured on marks the correction never saw — each
page's marks are split down the middle at random, the move is worked out from one half and
graded on the other — which is the only construction under which a model with more numbers can
honestly be compared against one with fewer. And every line was made to wear another line's
correction: that is **worse than applying no per-line correction at all**, six times worse than
the real one, which is what a genuine per-line signal is obliged to look like and what fitting
to noise could not have produced.

What neither answers is the thing this section's title actually asks, and it should be said
plainly rather than left to be inferred. **Splitting a page's marks in half holds out marks, not
pages.** Every rung, including the recommended one, is still fitted on every page it is applied
to, so no page in the mus'haf is a held-out page in the sense meant above. There is no version
of this correction that generalises to a page it has not measured, because it has no model of a
page — it has a table. That is not a flaw to fix; a table measured on all 604 pages is a
perfectly good thing to ship. It does mean the four pages that carry no measurement — 1, 2, 603
and 604 — are the whole of the generalisation question, and the fallback they get is the whole
of the answer.

### ⑨ Why the marks were ever in the wrong place, and what has to change · **open**

Every question above this one asks how far out the marks are. This one asks why, and the answer
turned out to be a single thing that explains all of it — including why two careful sittings
moved the number and never the problem.

**The alignment between the two printings was built by matching ayah-end ornaments, and then
used to place text.** The ornaments are the only objects both printings label, so they were the
only thing available to match on, and matching on them works: they land within a tenth of a unit
of each other. But nothing was ever checked at the marks. On the page this document draws
throughout, the ornaments agree to **0.09 units** while the text is out by about **a whole
mark's height**. Across the whole book, how tightly the ornaments closed predicts almost nothing
about how wrong the text is — and against the downward component, which is the larger half of
the error, it predicts *nothing at all*.

That one sentence accounts for every complaint the reader made when the sitting was stopped: the
rectangle is off its mark, the wrong size, on the neighbouring mark, and biting the mark next to
it. There is nothing between the ink and the screen except that alignment. A wrong size term
reads as the wrong size *and* as a shift that grows toward the edge of the page; a shift larger
than the gap between two marks reads as being on the wrong one. The count that rules out the
alternative is elsewhere in this document: of 326,515 marks, the number whose name is genuinely
wrong is **zero**. It is all displacement.

**And this is a known trap with a name, in a field that has been falling into it for twenty
years.** §⑤ has the citation and the mechanism. The short version is that how well an alignment
closes at the points it was fitted to is famously uninformative about how wrong it is anywhere
else — so "the ornaments fit to 0.09" was never the evidence in our favour we read it as, and
three sessions spent arguing about that number were three sessions spent inside the trap.

Three things are now settled, and they are what this question hands to whatever ships:

- **A better whole-page alignment cannot fix it.** The best transform that could possibly be
  fitted to a page, using the ink itself, still leaves about one mark in six badly out. Adding a
  size term to it buys under two per cent and makes a third of pages worse. The whole-page family
  is exhausted, and that also retires the wrong-size complaint: the size is off by about a tenth
  of a per cent, which nobody can see.
- **The error is organised by printed line, and correcting line by line is most of the repair.**
  Held out — fitted on half of each page's marks and scored on the half it never saw — the share
  of marks badly out falls from **one in five** (18.4%) to **one in eight and a half** (11.8%)
  when each printed line gets its own move, and to **one in nineteen** (5.2%) once a line is
  allowed to tilt along its length. Wearing another line's correction instead leaves 31.2% badly
  out — worse than doing nothing per-line at all — which is what says these are facts about lines
  rather than noise being absorbed. §⑦ has the full table and what each column means.

  These figures were first worked out as arithmetic on the raw displacements and then measured
  again by re-scoring every rectangle through the same instrument every other number in this
  document comes from. The two ways of asking agree to within half a percentage point, which is
  worth more than either on its own: the arithmetic could have been wrong about how much ink a
  moved rectangle then covers, and it was not.

- **What is left after the best correction is not simply a smaller version of the same error.**
  A bell curve of the measured width would leave about 3.1% badly out and the measurement finds
  5.2%, so the remainder is a minority of rectangles wrong for some reason of their own rather
  than every rectangle being slightly out. That is a separate question from this one and it is
  not averaged into the figures above; naming it is what stops the next session from re-measuring
  the whole book to rediscover it.

  **It was asked, and half of it now has an answer.** The rectangles still badly out are not
  scattered through the book. More than half of them sit on the one printed line in fifteen that
  has gone wrong as a whole, so lines go wrong rather than marks going wrong here and there. And
  a rectangle at either end of a line is about twice as likely to be badly out as one in the
  middle. That is what a disagreement looks like when it grows along a line but does not grow at
  a steady rate — and a correction that can only tilt has no freedom to follow it, because a
  slope that splits the difference is wrong in the same direction at both ends.

  So the correction was allowed to **bend** along a line rather than only tilt. Measured the same
  way as everything else here, on the half of the marks the correction never saw and across the
  whole book: badly out **4.95% → 4.12%**, and the typical miss 0.224 → **0.198** units. The same
  control was run again and holds — a line made to wear another line's bend leaves 34.4% badly
  out, against 18.2% for correcting nothing per-line at all — so a line's bend is a fact about
  that line and not a shape absorbed from noise. A freer shape still — one allowed to change
  direction twice along a line rather than bend once — was tried and refused: it is better on the
  marks it was fitted to and worse on the marks it was not, which is what an allowance with
  nothing to find looks like. The ladder stops where it stops being paid for, not where the
  arithmetic stops improving.

  **The other half is still unexplained, and it is the half this started from.** Bending fixes
  the middle of a line — 4.3% badly out down to 2.9% — and barely touches the ends: 6.6% → 6.0%
  and 7.0% → 6.0%. A rectangle at the end of a printed line is *still* about twice as likely to
  be badly out as one in the middle, so whatever is doing that is not a shape in where along the
  line a mark sits, and no amount of bending will reach it. That is left standing on purpose. The
  question below this one is the other candidate for it, and it is the one a reader can settle.
- **Whatever ships must move the text and leave the ornaments alone.** The question two sections
  above measures that directly, on the one object the correction could not have been fitted to.

What stays open is what to actually do about it: which correction ships, whether the word boxes
move with the marks or the two are allowed to drift apart, and what the four pages that never
carry enough marks to measure should fall back to. Those are a decision and not a measurement,
and they have now been written up as one — §⑦'s options A, B, F and G, drawn on a real page in
[`mark-placement.html`](mark-placement.html) and open in the register as `mark-placement`. The
word-box half is option G specifically, which was the half most at risk of being settled by
nobody: it costs nothing by any measurement on this page, because every measurement on this page
is made on marks.

### ⑩ Whether what is left over is even ours to fix · **open**

Every measurement above answers in a distance: how far the rectangle is from the ink it should
be sitting on. That is the right currency right up to the moment the correction starts placing
most rectangles from their own ink — and then it stops being, because the rectangles that are
left are not mostly *far* from their ink. A great many of them have no ink under them at all.

The count, over the whole book. Where a rectangle was placed from its own ink, the printed
strokes fill about a fifth of it and roughly one in eighty is effectively bare. Where the search
found only a weak match, that falls to about a ninth, and **more than a quarter are bare**. Where
the best match the search could find sat on the very edge of how far it was allowed to look, it
is a twentieth, and **more than a third are bare**. So about a third of what the best correction
leaves behind is a rectangle drawn over blank paper.

A distance cannot say why. It cannot say *there is nothing in this place at all*, and it cannot
separate a rectangle in the right place at the wrong size from one of the right size in the
wrong place — the two have different repairs in different parts of the pipeline, and a size
complaint written down as a displacement is a wrong number that looks like a right one. Nor can
it say the fourth thing, which is the one this question is really about: **that the printed page
itself does something unusual there, and nothing is wrong on our side.** We did not draw those
pages. Counted as a placement failure, a printing oddity makes the correction look worse than it
is; counted the other way, better. Both are wrong and nobody has ever been asked which.

So the answer has to come from a reader looking at one rectangle at a time and saying which kind
of wrong it is, in words rather than in a number — and saying more than one thing where more than
one is true, because a reader forced to pick just one picks the most obvious and the second fault
is never recorded by anybody. The page that asks it, and the sitting that would answer it, are in
the validation register as *what kind of wrong*. Answers of the fourth kind — the printing, not
us — become rows of their own in [`docs/issues.json`](../issues.json), which is the only route by
which a reader's eye reaches the catalog at all.

What would settle it: a sitting. If most of the remainder turns out to be the print, then the
placement work is finished and this document's numbers are an overstatement of our own error by
whatever that share is. If most of it turns out to be rectangles that could have been placed and
were not, the search that places them is too timid and that is a change to make rather than a
fact to accept. Until somebody sits it, both readings of the tail in ⑨ are open, and the honest
statement is that we do not know which we are looking at.

### ⑪ Whether the reader could see the rectangle they were vouching for · **fixed**

The page that asks ⑩ draws a crop of the print's own artwork, and that paper is deliberately
never re-themed: a page of the mus'haf stays on white whatever theme the reader's phone is in.
The two rectangles drawn on top of it were themed. Under a dark theme our rectangle's line fell
from 5.05:1 against that paper to **2.49:1**, and the reader's own rectangle from 4.89:1 to
**1.70:1**, at a constant stroke of about one and a half pixels.

That is not an ugliness finding, and the reason is the same one that made ① of this section
worth rewriting. The commonest honest answer on that page is *nothing is wrong with this one*.
A reader who cannot make out the rectangle at all gives exactly that answer, and it arrives in
the transcript as an affirmation indistinguishable from one somebody looked at. The failure
comes back looking like success, and in the direction that flatters us.

What closed it is a rule rather than a colour: **nothing drawn on the paper is themed.** The
paper, the ink, and the four colours of the two rectangles are stated once and never restated
for a dark theme; the controls around them stay themed, because they sit on the app's own
surface rather than on the print. The two rectangles are also told apart by a dash pattern and
not by hue alone, so the distinction survives colour blindness and survives anybody re-theming
the palette later. A test asserts that the dark theme redefines none of the six, and that both
rectangle lines clear 3:1 against the paper — twelve lines, no browser, and precisely the
invariant that broke.

The caveat that has to travel with the sixty answers already banked: nothing in a transcript
records which theme it was sat in, and nothing does now either. Those sixty were drawn from the
population where the placement was already made from the mark's own ink, so a gross error was
structurally impossible on those cards whatever the reader could see — but that is an argument
about the cards, not evidence about the screen.

### ⑫ Whether the placing distances were ever the reader's own hand · **fixed**

The scorer that reads the placing answers printed **0.000 across and 0.000 down** for
twenty-six marks the reader had visibly dragged. Two faults arriving as one number.

**It averaged increments, and increments cancel.** Every move the page records — from the nudge
pad or from a drag — is written down as a step, with the running total beside it. Taking the
middle of every step across every move is arithmetic on the wrong column: a nudge one way and a
nudge back are two steps that cancel to nothing, and one mark corrected forty-four times outvotes
twenty-five marks corrected once.

**And the total beside it is not the hand either.** It is measured from the rectangle as
shipped, so it already contains the correction this document's own fit applied. That is a real
quantity and worth printing — where the reader put the box, against what the app draws today —
but it is not how far the reader themselves moved anything, which is that same total less the
correction. Collapsed into one number it was neither.

Three figures, all real, and until this was fixed the page printed the first:

| question | across | down |
|---|---|---|
| what was printed | 0.000 | 0.000 |
| where the reader put it, against what ships | −3.569 | −3.134 |
| **how far the reader's own hand moved it** | **−2.468** | **−2.010** |

The middle row is the one worth the trouble: it points the same way and is roughly the same size
as the ink measurement in §④, where the print sets its text lower and further across than the
ornament fit predicts on 599 of 600 pages. Two instruments built from different evidence,
agreeing. A scorer printing zero said the reader's hand agreed with nothing.

What closed it: one row per mark, reading only where the rectangle finally rests. The two
distances are printed under two separately worded sentences, and the prose says outright that
the gap between them is only the correction already applied — otherwise a reader subtracts one
from the other and believes they have found a discrepancy. It also says how many marks, and how
many separate goes those marks took: twenty-six marks over two hundred and five goes is a
finding about the nudge controls rather than about the print, and it is stated as one. Distances
and counts are never combined. The fixture that would have caught the original is now in the
scorer's tests: one mark nudged one way, back, and out again, and a second moved once, asserting
the printed middle is the distance and the count is two marks rather than four steps.

### ⑬ Whether a sitting counts the marks it looked at or the marks it has left · **fixed**

Every rate this section reports is a count of complaints over a count of marks looked at. The
page that asks the questions was writing the wrong number into the second one: when a reader
handed their work over, it banked how many marks were **still to go** rather than how many they
had been through. On the sitting that found it, 115 marks were seen and the file said 19.

A denominator too small does not produce a wrong-looking number, it produces an impossible one,
and only because it was impossible did anybody notice: the rates came out at **600.0%**,
**2280.0%** and `NaN%`. Had the reader stopped four fifths of the way instead of at the end, the
same defect would have produced a plausible figure — a believable error rate over a denominator
nothing in the file admitted was wrong — and it would have been quoted.

What closed it is the count being written from what was answered rather than from what was left,
and a second guard either side of it, because a page can always be got wrong again: both readers
of a transcript now take the number of marks actually spoken about as a floor, and when they
raise a claimed count to it they **print the file's name while doing it**. A reader who sees that
line is being told there is a defect in the page, not a quirk of one file. It is a warning rather
than a refusal on purpose — the sitting's answers are still good, and throwing an hour away over
a miscounted header would be the more expensive mistake.

The direction is the thing to remember. A count of marks somebody has looked at can only ever go
up, so a count that falls is never a fact about the reader.

### ⑭ Whether the marks a reader called odd are odd in the print or odd in our reading of it · **open**

Fifteen marks, on fifteen separate pages, were set aside by a reader as *odd — I cannot say
how*: not our rectangle in the wrong place, but something about the printed mark itself they
could not read as ordinary. They are six fathas, four successive kasratans, two successive
dammatans, one damma and two hamzas — a spread across the vocabulary rather than one name
behaving badly, which is the first thing that would have made this our problem instead.

They are held out of the denominator of that sitting's error rate, and being held out is exactly
what leaves them unsettled: they are neither counted against the correction nor evidence for it,
and a category that costs nothing either way is a category that quietly grows. Nothing here can
answer it. Every instrument in this document reads the same bytes the reader was shown, so a
reading that is wrong about what the print contains is wrong identically in all of them, and the
question is settled only by holding those pages against another copy of this print.

What would answer it: the pages, checked by eye against a second printing. Either the oddity is
in the print — in which case it is a defect in vendored data and belongs upstream, and the marks
stay out of every rate on purpose — or it is in our rendering of it, in which case fifteen marks
are the visible end of something that is also silently wrong on marks nobody flagged.

**Two more arrived on 2026-08-17, and they matter out of proportion to their number.** A
superscript alef on page 86 and a wasla on page 463, called odd in the same words. The first
fifteen all came from marks the correction could not place at all, which left the cheapest
explanation open: that a mark nothing can find the ink for and a mark that looks strange to a
reader are the same marks for the same reason, and the oddity is downstream of whatever defeats
the search. These two are not those. They come from marks the correction placed **from their own
printed ink**, and matched well enough to clear the bar — so whatever the reader is seeing
survives a successful match, and cannot be explained by the search having failed. Seventeen
marks now, on seventeen pages, across two populations that share nothing but the print.

**Fifteen more on 2026-08-17, from a full part of a hundred and six**, which is the first
number here worth calling a rate: fourteen in every hundred marks looked at, against nine in
the hundred and sixty sat before it. They are three fathas, two kasras, two hamzas, two
fathatans, two successive fathatans, a shadda, a successive kasratan, a successive dammatan
and a kasratan, on fourteen pages between 60 and 593. Thirty-two marks in all now, and the
spread across the vocabulary has held through every sitting — still no name behaving badly,
still no page carrying more than two.

That the rate did not fall as the instrument improved is the part worth noticing. Every other
figure from that sitting moved in the direction the fixes predicted, and this one did not
move at all. So whatever a reader is seeing when they say *odd* is not something the page was
doing to them, and the cost of leaving it open is now visible: at fourteen in a hundred, a
full pass over what is left would set aside something like two hundred and forty marks on the
grounds that nobody could say what was wrong with them.

**Eleven more on 2026-08-17, and this time they are not spread across the vocabulary.** They
are five fathas, three hamzas, two kasras and one successive dammatan, on eleven pages
between 333 and 596, no page carrying two. Forty-three marks now. What is new is that ten of
the eleven are marks printed as a single piece of ink, and the sitting they came from was
half doubled marks — thirty-three doubled against twenty-eight single among the marks
answered. So *odd* was said about roughly one single mark in three and one doubled mark in
thirty, a difference too large to be nothing in a sitting this size.

Two readings of that, and the page cannot separate them. Either single marks really do carry
more of whatever the oddity is — or *odd* is simply the button left when a reader has no word
for what is wrong, and a doubled mark always gives them one: its rectangle is visibly the
wrong size, which is a complaint with a name and its own button. On that second reading the
gap says nothing about the print and everything about which complaints were available, which
is the same instrument fault ㉗ describes from the other end. Nothing here decides between
them, and the check that would is unchanged: hold the pages against a second printing.

### ⑮ Whether an answer given by pointing is the same evidence as one given by hand · **open**

The sittings held so far measured what correcting a rectangle by hand costs. Of the 160 marks
the reader worked through, **158 were moved**, over **350 separate goes**, a median of **2.105**
units of travel and a worst of **12.229** on a mark that is 5.6 by 3.6. Every one of those goes
is a person doing two different jobs at once: deciding which mark is meant, which only a person
can do, and then deciding how far across and how far down, which the print already knows.

So the second job was handed back to the print. The ink inside the window is cut into its
separate pieces, and a tap on a piece puts the rectangle round it — round both, when a mark is
printed in two parts and the reader taps each. The rectangle moves and takes its size from the
ink in one gesture instead of a dozen presses.

**And that makes two kinds of answer that must never be pooled.** The words are the same either
way, because the reader is saying the same thing: the rectangle belongs somewhere else, and it
is the wrong size. What differs is who measured it. A hand-placed answer is an eye's estimate of
where a mark sits, and its spread is partly the eye's. A pointed answer is the reader choosing
which ink — still the judgement — with the extent taken off the printed outlines, and its spread
is the grain the ink was cut at. Averaged together, the second tightens the first, and the
tighter number would read as *the reader agrees with us more closely than we thought* when it
means nothing of the kind. Every answer now records which way it was given, and a press on top
of a pointed answer gives up the claim: the moment a reader adjusts by hand what a tap placed,
the answer is a hand-finished one again.

Two things this does not settle, and one of them is new. The marks already answered were
answered on the older instrument, so any rate quoted across both is a fact about the mix of the
two — the same trap this section's ⑬ is about, in a different column. And making a correction
cheaper is a change to the one ratio these sittings exist to measure: complaining and affirming
still cost a single tap each, which is the constraint the page is built to, but *finishing* a
complaint no longer costs a dozen. A reader who would have shrugged and affirmed rather than
push a rectangle across the card may now say what they actually think. That is the point of the
change and it is also a reason the two halves are not one population.

What would answer it: the same marks answered both ways, by the same reader, far enough apart
that they are not remembering. Until then the two are read apart and never averaged.

### ⑯ Whether a finger resting on the rectangle was banked as a placement · **fixed**

Reaching for the ink under the rectangle is the commonest gesture on that page, and until
2026-08-15 it could bank a placement nobody made.

Two boundaries, in two different units, decided what a gesture was. A tap had to end within ten
screen pixels of where it started **and** inside 600 ms. A drag banked a placement once it had
moved more than 0.05 page units. At the framing that shows the whole word, ten screen pixels is
about **1.5 page units** — thirty times that floor — so the two boundaries left a gap, and a
finger that rested for three-quarters of a second with a few pixels of tremor fell straight into
it: too slow to be a tap, far too far to be nothing. What it banked was a placement of nearly
half a unit, on a mark that is 5.6 by 3.6, and there is no way to see it in the file afterwards.
A phantom placement is a well-formed placement.

The repair is one boundary, in one unit, with no clock. Ten screen pixels decides, and both the
600 ms and the page-unit floor are gone. The clock never asked anything worth knowing — a slow
tap is still a tap, and a reader steadying their hand is not making a different statement — and
only distance can answer whether a finger stayed still. Screen pixels rather than page units
because a finger is the same size on every card and a page unit is not.

**What this does not clear.** Every transcript banked before the fix carries whatever it
produced, and nothing distinguishes those placements from real ones. The affected marks are the
ones a reader reached for by tapping the ink, which is also the population ⑮ says must be read
apart from hand-placed answers — so the same caveat covers both, and the rates quoted for the
sittings sat before this date are quoted with it.

The same audit corrected two smaller things about the same gesture. Which piece of ink a tap
reaches was decided by area alone across everything within a fingertip of slack, so a finger
squarely inside a large piece could be answered with a small piece it had merely come near:
aiming at the dead centre of a piece returned a **different** piece on 3.7% of aims at the wide
framing, and 2.3% of taps on blank paper reached past nearer ink to something smaller further
away. Ranking landed-on above came-near takes the first to 1.2% and ends the second. And a tap
that reaches no ink at all now says so, because saying nothing is indistinguishable from a tap
the page never received, and a reader who cannot tell those apart stops pointing at ink.

### ⑰ Whether the sittings on disk are the ones anybody should still be sitting · **fixed**

Rebuilding the unsat sittings after a round of answers is the step that makes the next hour
better than the last one, and it was the only step in that whole routine that ended in an
instruction rather than a command: *confirm the deal did not move — same number of parts, same
total, and no mark that has been answered coming back round again.* Sixteen files, by eye, at
the end of an hour of somebody else's work. In practice that meant nobody confirmed anything.

Both ways it goes wrong are invisible from inside a sitting. If the rebuild is skipped — or run
with one handed-over transcript left out of the list — the parts still open, still count down,
still bank answers, and re-ask questions somebody already answered; a page you have seen before
looks exactly like a page you have not. If the rebuild runs against a different measurement of
where the marks sit, every rectangle in every part is drawn from displacements that are not the
ones on disk, so every answer is about a picture nobody can reconstruct afterwards. That one is
worse, because the answers are wrong rather than merely wasted.

Neither needed a person, as it turns out. A built sitting already says what it was built from,
because it has to: the reader's place is stored under a key made of the measurements'
fingerprint, the set, the slice and the seed, and the set of answers already given is folded
into that key so that shrinking the pool cannot silently strand somebody at card ninety of a
hundred and seventeen. A part that disagrees with the tree announces itself — to anything that
asks. Nothing asked.

**Closed by** `pnpm audit:sittings`, which reads every built part back and holds it to its own
account of itself: the measurements match the ones on disk, every part knows about every answer
given, nothing already answered is asked again, no mark is dealt into two parts and none into
nobody's, and the count the reader is shown describes the population it claims to. Eleven tests
build each of those failures on purpose, because an auditor that only passes the clean case is
indistinguishable from one that always says yes. The routine's last step now names it.

The one reading of the word *answered* is shared with the rebuild rather than written twice —
two readings of it drift, and the drift surfaces as a mark the rebuild drops and the audit still
counts, with neither obviously wrong. Extracting it left every built part byte-identical.

**What it found on the first run**, which is the answer to the question this entry opens with:
nothing. The sixteen parts hold 1,710 marks between them, 167 already answered, 1,877 in all,
all drawn from the same measurement now on disk. The deal had not moved. That is worth stating
because it was not knowable before, and "we assumed so" and "we checked" are different claims.

**It is not a gate and will not become one.** The parts are build products and the answers
accumulate on whichever machine served them, so in a clean checkout it would pass by being
unable to look — which is the failure mode this repo already refuses in the register that tracks
what has been published. It runs where the evidence is.

### ⑱ Whether pressing the same nudge button twice was answering or zooming · **fixed**

Reported from a phone, mid-sitting: *when I click the same nudge button twice it zooms in*.
That is the browser's double-tap-to-zoom, and it fires on any two taps close enough together
in time and space — the same arrow twice, or two different arrows a centimetre apart. Between
them, that is most of what placing a rectangle consists of.

The magnification is not the cost. The cost is that the card walks off the screen in the middle
of an answer, so the next press lands somewhere the reader did not aim and the transcript
records a placement nobody made. A reader who cannot keep the rectangle still is also a reader
who stops nudging and affirms, which biases the one ratio the sitting exists to measure.

The page had been carrying `touch-action` since the drag was wired, but only on the stage: the
crop got `pan-y`, and `none` while a selection was being drawn. The chrome — the dock, the
buttons, the body — had none at all, so the default applied to every control on the page.

**Closed by** `touch-action: manipulation` on the body, which is the ordinary behaviour minus
that one gesture, with three tests in `build-mark-report.test.mjs`. On the body rather than on
the buttons deliberately: two taps on *adjacent* buttons trigger it as readily as two on one
button, so a per-button rule would leave the commonest case — left, then up — unfixed. It costs
nothing anybody could use, because `touch-action` is intersected down the ancestor chain rather
than inherited, so the stage's stricter values still win, and `pan-y` already excluded
double-tap zoom on the print. Pinch still zooms everywhere, which is the gesture a reader
actually reaches for on a page of the mus'haf.

### ⑲ Whether a sitting could be reached from anything but the machine serving it · **fixed**

The sittings are served from one laptop, and the serving side bound the loopback address by
default — reachable from exactly that laptop and nothing else. Every sitting anybody has ever
sat on a phone therefore depended on somebody remembering to pass a flag, and **the flag was
written down nowhere**: not in the routine that runs the sittings, not in a script, not in the
Makefile, not in any document. The arrangement this project had chosen worked only for whoever
already knew the incantation, and that person was going to be asked to recall it in six months.

Underneath it sits a sharper hazard, which is why this is a defect and not an ergonomic
grumble. A reader's place, and every rectangle they have moved, is kept by the browser against
an **origin** — scheme, host and port, with the host half compared as text. So the laptop
reached by its name and the same laptop reached by its number are two separate memories of the
same sitting, with nothing on screen to say so: the page simply opens at card one as though the
last hour had not happened. That has already happened once, and cost an hour of somebody's
confidence before the recovery was built.

**Closed by** a module that decides the one address — `packages/etl/scripts/lib/tailnet.mjs`,
with sixteen tests — plus two named commands, `pnpm sit:serve` and `pnpm sit:index`, and a step
⑥ in the sitting routine that says to run them. The address is read off this machine's own
network interfaces rather than asked of a program, because the private network hands out
addresses from a range no home or office network uses, so an interface holding one *is* that
network. The server now binds it by default — that network only, not every interface, because a
sitting carries a write endpoint and the café's wifi is an interface too — and prints one
address with the others named as things not to use. The front door says the same thing on screen
when it notices it is being read at another spelling of this machine.

### ⑳ Whether the front door could say which sitting you were in the middle of · **fixed**

The front door listed sixteen parts as sixteen bare numbered tiles. Every question a reader
actually arrives with — *where was I, which of these have I finished, is there any point
opening number nine* — was unanswerable from it, so the way to find out was to open parts until
one looked familiar. On a phone that is sixteen page loads of a megabyte and a third each.

The reason it had never been fixed is that the obvious fix does not work. A rebuild drops every
mark carrying a standing answer, so at the moment the front door is built every part is
untouched and every progress bar reads zero. The only place the live figure exists is the log
the serving side has been appending to since the first answer.

**Closed by** a rewritten front door with eleven tests. Each tile carries the marks its part
holds, the page fetches everything this machine has heard and counts the overlap, and a banner
at the top names the part to carry on with — the one already begun and unfinished, because a
part left half-done is the only place the re-deal cannot help. Answers in the log for marks in
no part on the page are ignored rather than added: one log covers every deal there has ever
been, and counting those again would take the remaining figure below zero.

The rule for which answers still stand is **not** restated in the generated page. That function
is written closed over nothing for exactly this reason and its own source text is inlined, so
there is one reading of the word *answered* running in two places; a test pulls the copy back
out of the built page, evaluates it with nothing in scope, and makes it agree with the module it
came from. The same discipline put the reading of a built sitting into one place shared with the
auditor, so the front door and the audit cannot disagree about how many parts exist.

### ㉑ Whether a mark reached by pointing can ever be called only one kind of wrong · **confirmed**

Sixty marks were sat on 2026-08-17, in
[two sittings](../validation/rulings/2026-08-17-placement-what-kind-of-wrong-placed.seed23.settled.json),
and every one came back saying both *the
rectangle is in the wrong place* and *the rectangle is the wrong size*. Sixty out of sixty, for
both words, with no mark anywhere saying one without the other. That is not what the reader was
asked and it is not what they did.

Nearly all of them were answered by pointing at the ink. Pointing is one gesture and it
sets the whole rectangle at once — it moves to the ink and takes its size from the ink in the
same act — so afterwards both the position and the size differ from what was drawn, essentially
always, because two rectangles fitted independently to the same ink are never identical to the
last decimal. The page files a complaint for each of them whenever the difference is anything
other than exactly nothing, and *exactly nothing* here means the smallest difference a
computer can represent. So both words fire on every point, together, forever.

**This is a row rather than an ergonomics note because it made a number wrong.** The
mark-level rate is fine and stands: the reader has confirmed that every one of those taps was
a correction they meant, so sixty of sixty marks carrying a fault is a real measurement of
those two bands. What is not a measurement is the split between the two words. In the weaker
band alone, four of the thirty were filed as the wrong *size* while their size changed by less
than a twentieth of a unit, and four were filed as in the wrong *place* while moving less than
a twentieth. Anyone reading "thirty-seven wrong-size statements" as thirty-seven marks judged
the wrong size is reading an artefact of the gesture.

**Why the fix is not a threshold.** The tempting repair is to pick a distance below which a
change does not count, and it would be wrong twice over. It would be a number chosen rather
than derived — the extents a point snaps to are taken from the printed outlines and are not
rounded to any grain, so there is no natural floor to borrow. And it would still be answering
the wrong question, because a reader who points at ink has not made two statements that we are
failing to tell apart. They have made **one**: *the rectangle belongs around this ink.* The
vocabulary has no word for that, so the page spends the two words it has. That is the same
observation ⑮ makes about mixing pointed answers with hand-placed ones, one level further in:
⑮ says the two kinds cannot share a rate, and this says the words themselves stop meaning
different things once the answer was pointed.

**What would close it:** a word for what a point actually says, with the existing two reserved
for what a hand says, and the settler reading pointed and hand-placed answers under separate
headings rather than pooling their words. Until then, the word-level counts from any sitting
worked by pointing are not quoted, and the mark-level rate is.

**[A hundred and six more marks on 2026-08-17](../validation/rulings/2026-08-14-placement-what-kind-of-wrong-fallback.seed23.settled.json)
said how big the distortion is, and it is not
fixed.** That sitting worked the marks the correction could not place at all, where the
rectangle starts far from the ink rather than nearly on it, and the artefact all but vanished:
one mark in a hundred and six was filed as in the wrong place while moving less than a
twentieth of a unit, and seven in a hundred and four were filed the wrong size while their
size changed by less than that — against four in thirty for each of those in the bands. Two
marks came back saying *moved* and not *wrong size*, which are the first anywhere to carry one
word without the other and which retire the word *forever* above.

So the size of the distortion is a property of **how close the rectangle already was**, not of
the gesture. Point at ink two units away and both words are earned; point at ink a hundredth
of a unit away and both words fire on a mark nobody would say was wrong. That sharpens the
open question rather than closing it — the reader still made one statement and there is still
no word for it — but it says where the damage is, and it is the opposite of where a reader
would guess: the sittings whose numbers are least trustworthy are the ones where the
correction was already working.

Two consequences follow and are worth stating before somebody reads a rate the wrong way. The
word-level counts from the fallback sittings can be quoted with the caveat attached, and those
from the band sittings still cannot. And a sitting drawn from marks the correction places well
cannot be scored on words at all — which is most of the book, and is the population any future
sitting checking a *good* rule would have to be drawn from.

### ㉒ Whether the weakest matches go wrong by class rather than at random · **open**

The correction places each mark from its own printed ink and accepts the match when the
rectangle and the ink overlap by more than 0.55. The marks that clear that bar only just have
never been looked at as a group, and §④ now records what happened when
[sixty of them were](../validation/rulings/2026-08-17-placement-what-kind-of-wrong-placed.seed23.settled.json), in
two bands of thirty: **every hamza in both, eleven of eleven, was about a page unit across in
the same direction with its size correct** — a median of 1.077 units in the weaker band and
0.573 in the better one, against two thousandths of a unit for every other mark. Fatha and
kasra came back too short in both, and by less in the better one.

That is a per-class error in a population where §④'s own refutation of per-class error does not
reach, and it matters because of its shape rather than its size. A residue spread evenly over
every class is the price of correcting by a median and there is nothing to do about it. A whole
class in one direction is either a bug in what the search matches against or a case for a
per-class term, and both are actionable. The halving between the two bands is the strongest
thing here: it ties the error to how sure the search was, which is what an argument about the
search predicts and what a fixed per-class offset does not.

**What would answer it.** Two things, in order, and neither needs a reader. First, and nearly
free: re-measure the sideways displacement for hamza alone across the whole book rather than
across these eleven, which separates a property of the weak tail from a property of hamza. Then,
if it is the tail, test whether the search is settling on the letter a hamza sits on rather than
on the hamza — which §④ names as the mechanism and does not test.

What this must **not** do is become a per-class correction fitted to sixty marks. Eleven hamzas
from two bands are enough to say *look here*; they are not enough to edit the placement of
326,515 marks.

### ㉓ Whether the marks we cannot place from ink are wrong in one way or in two · **answered**

[A full part of a hundred and six was sat on 2026-08-17](../validation/rulings/2026-08-14-placement-what-kind-of-wrong-fallback.seed23.settled.json) — every mark in it one the correction
could not place from its own ink, so the rectangle was inherited from the printed line
instead. All hundred and six came back faulted, which is what that population is selected to
produce and says nothing. What it did produce is a split nobody had looked for: **the two
things a rectangle can get wrong are not going wrong on the same marks.**

Across the whole sitting the reader moved the rectangle a median of 1.479 units and changed
its size by 0.130 — an order of magnitude apart on a box about 6.3 by 3.4. The rule inherited
from the line is getting the size very nearly right and the position badly wrong. But sorted
by the name of the mark, that single sentence turns into three different findings:

- **The single marks are misplaced and correctly sized.** Fatha, kasra, damma, shadda and
  hamza — seventy-eight of the hundred and six — moved about a unit sideways and barely at all
  downward, with their size left alone to within a tenth of a unit. Hamza moved least of the
  five, which is the opposite of what the bands found in ㉒ and is the first evidence that
  ㉒'s hamza finding belongs to the weak tail of the *placed* population rather than to hamza.
- **The marks that sit above the letter are misplaced downward too, and by much more.** Sukun,
  twelve of them, moved 2.280 across and 2.151 down; the two rounded zeros moved 2.079 and
  3.043; the two maddahs 0.214 and 1.254. Every other class moved downward by less than half a
  unit. Whatever the printed line is being used for, it carries no information about how high
  above the letter a mark that is not a vowel sits.
- **The doubled marks are placed nearly right and drawn far too small.** The ten tanwin and
  successive marks moved a few tenths at most and were grown by 0.5 to 1.4 units in width and
  height — the only marks in the sitting whose size changed by more than a fifth of a unit.
  A doubled mark is two of something, and the box is being drawn for one.

The third of those is the most actionable and the least dependent on the reader's aim: growing
a box is a statement about extent, which the print itself can be asked about, and it does not
need anybody's opinion of where the centre is.

**Why this is not yet a fix.** Ten doubled marks and sixteen above-the-letter marks are enough
to say *look here* and nowhere near enough to edit the placement of anything, which is the same
line ㉒ draws for the same reason. And a hundred and six marks from one part of sixteen is one
draw from a shuffle: this could be a property of the population or a property of these pages.

**What would answer it, and none of it needs a reader.** Re-measure size against the ink for
every doubled mark in the book, which is the whole claim of the third finding and is free.
Then check whether the marks that sit above the letter have a different vertical relationship
to the line than the vowels do, over all 326,515 rather than over sixteen. If either holds at
book scale, the fallback rule needs splitting by what kind of mark it is placing rather than
tuning; if neither does, this was one part of sixteen telling us about itself.

**Answered on 2026-08-17, and it was the second thing: this was one part of sixteen telling
us about itself.** The two position findings are gone; the size finding survives and has moved
to ㉖. Both halves of the test above were run, and everything above this paragraph is left
standing on purpose, because the theory was reachable, internally consistent and wrong, and
the next person to read a sitting will reach for it again.

Fitting the line correction over all 326,515 marks and measuring what it leaves behind, class
by class, leaves nothing anywhere:

| class | n | residue across | residue down |
| --- | ---: | ---: | ---: |
| fatha | 121,277 | 0.011 | 0.013 |
| sukun | 36,616 | −0.022 | −0.016 |
| superscript alef | 9,358 | −0.032 | −0.054 |
| successive fathatan | 2,897 | 0.001 | −0.001 |
| every class together | 322,011 | 0.004 | 0.002 |

Every class within nine hundredths of a unit of zero, on a box about 6.3 by 3.4. There is no
per-class offset in this print, and in particular the marks that sit above the letter do not
have a different vertical relationship to the line — the second finding above is contradicted
directly, on 36,616 sukun against twelve.

**So where did a pattern that clean come from?** From the selection, which is the general trap
and is worth naming: **this sitting is drawn from the marks the search refused, so the first
thing any pattern in it describes is the refusal.** A mark is refused for one of two unrelated
reasons — the ink was further away than the search was allowed to look, or the search reached
it and did not like the match — and those two are not evenly spread across the classes. Sorting
that population by the name of the mark sorts it, mostly, by which of the two refusals it
suffered. The reader's three groups are three views of the refusal rule, seen from inside it.

That relocation is the useful half of this item: the fault is not in what the rectangle knows
about each kind of mark, it is in the rule that decides a rectangle cannot be placed at all.
㉔ and ㉕ are what was found there, and both are fixed.

### ㉔ The search was not allowed to look as far as the marks actually are · **fixed**

Relocated from ㉓ and then measured against the one thing that can settle it: 272 marks a
person placed by hand.

The search looks three units in each direction for the ink a rectangle should be sitting on,
and gives up if the best it finds is out at that boundary. **The reader's answers say the
marks it gives up on are a median of 4.292 units away, and 230 of the 272 are further out than
three.** The search was being asked to find something it was forbidden to reach. Where it ran
out of room it was already pointing the right way — on a hundred such marks the direction it
was straining in agreed with the reader 92 times across and 99 times down — so it knew where
the answer was and was stopped short of saying so.

Scored against those 272 hand-placed marks, as distance from where the reader put the box:

| what places the box | median | within a unit | within half |
| --- | ---: | ---: | ---: |
| the raw rectangle | 4.292 | — | — |
| the printed line, as we ship it | 1.974 | 31% | 19% |
| its own ink, searched three units | 1.816 | 40% | 28% |
| its own ink, searched eight units | 0.099 | 84% | 83% |

**Why the fix is not simply a wider search.** Widening it for every mark keeps 99.82% of them
accepted, and moves 4.11% of the already-accepted ones — 2,722 marks — by more than two units,
worst 13.528. A wider window finds a better-scoring match that is the *neighbouring* mark's
ink, and does it confidently. There is no ground truth on those and there never will be, so
they cannot be adjudicated, only avoided.

**Closed by escalating instead of widening.** Search three units as before; only where that
refuses, search again at eight. Marks the ordinary search placed keep their measured
displacement byte for byte, so the risk to the 99.43% is not small, it is zero by construction
— checked on 14,398 accepted marks over 28 pages, of which 14,046 came back identical and the
other 352 were all marks the search had reported *outside* its own boundary, which is ㉕. The
cost is near nothing, because the wide search runs on the half-percent that failed rather than
on the book.

One thing that guarantee does **not** cover, and it is worth stating rather than being found
later. The correction is *fitted* from these measured displacements, so a mark whose
displacement was previously pinned at the boundary was contributing a truncated number to the
fit and now contributes a true one. That moves the fit, and therefore moves where every mark
on that printed line is drawn — by very little, since the correction is a median over roughly
thirty-six marks a line and this changes well under one in a hundred of them, but not by
nothing. The bit-for-bit claim is about what the search measured. What the reader finally sees
is that measurement plus a fit, and the fit got better inputs.

**What recomputing the corpus costs, and it is not nothing.** The two rulings a person has
already given are stamped with a fingerprint of the displacements they were given against, and
the scorer refuses to read a ruling against a different set — correctly, because a verdict about
where a box should go means nothing if the box has moved underneath it. Replacing the
displacements changes that fingerprint. The old file is kept here under its own fingerprint so
those two rulings stay scorable on this laptop, but the file is far too large to commit and
never was committed, so on any other machine the only way back to those bytes is to check out
the code as it stood before this fix and re-run the sweep, which is an hour and a half. The
answers themselves are safe either way: what a person said about a mark is stored against the
mark, not against the measurement, so a new deal inherits every answer already banked.

It still refuses honestly, which is the point of keeping it: on those pages 1,227 marks are
refused by the first look, 1,124 are placed by the second, and the 103 left over match at a
median of 0.894 against the 0.909 a good match scores — they are marks whose ink is genuinely
eight or more units from where the rectangle claims to be, not marks the rule has quietly
started accepting. The refusals stay the population worth a person's hour.

*Closed by `packages/etl/scripts/lib/mark-ink.test.mjs` — six assertions that a wider answer is
taken only where the first look refused, only when the wider look does not itself refuse, and
only when it matches better, and that a mark the first look placed is returned unchanged.*

### ㉕ The search could report an answer it had never checked · **fixed**

Found while fixing ㉔, and it is older and quieter than ㉔ is.

The search runs in two passes: a coarse sweep of the whole allowed region, then a fine sweep
around whatever the coarse one liked. The fine sweep was not bounded by the region — so when
the coarse winner sat on the boundary, the refinement was free to step a quarter unit past it,
and the answer that came back was one the search had never scored the surroundings of. It
could not have known it was the best, because it never looked further out.

The damage is not the quarter unit. It is that **the only way anything downstream can tell a
mark ran out of room is that its offset came back sitting exactly on the boundary** — so every
mark that slipped past became invisible as a refusal. In the shipped corpus that is 2,252
marks, of which **1,923 were being accepted and shipped as placed from their own ink**, at a
median match of 0.859 against the 0.909 a good match scores. Nearly three times the size of
the edge population we were counting, and all of it counted on the wrong side.

*Closed by clamping the fine sweep to the region, so an offset on the boundary means what
everything downstream reads it as meaning, and by the same test file: four cases asserting the
answer never exceeds the distance given, at four different distances, plus one asserting it
lands on the boundary exactly when the ink is out of reach.*

### ㉖ The doubled marks are drawn too small, and no amount of moving them will help · **confirmed**

The one finding of ㉓ that survived the corpus, and it survived because it is not about
position at all. Carried out of ㉓ so that the refuted part and the confirmed part stop
travelling together.

A doubled mark is two of something, and the rectangle is being drawn for one. That shows up
as a mark that is refused far more often than any other and matches worse even when accepted:
they are refused at 2.42% against a base rate of 0.45 to 0.54%, and where they are accepted
they match at 0.889 against 0.909. Where they are refused they match at 0.457 — half of what
a good match scores, and a number no rectangle in the right place can produce.

**It is a size fault, and the evidence that it is one is that distance was never the problem.**
These marks need 2.14 units of movement, against 4.292 for the refused population as a whole,
and only 17% of them ever reach the search boundary. ㉔'s escalation recovers most of the
book and recovers only 45% of these, exactly as it should: a rectangle too small to contain
its mark caps the overlap below the floor wherever you put it, so a fix that only moves things
cannot reach it.

**What would answer it, and it does not need a reader.** Measure the extent of the ink under
every doubled mark in the book against the width and height we draw, which the print can be
asked about directly. If the shortfall is a consistent multiple, the box for a doubled mark is
being computed from one component of it and the repair is arithmetic; if it varies, the extent
has to be measured per mark. Either way this is a change to what the rectangle *is*, not to
where it goes, and it belongs in a different part of the pipeline from ㉔.

#### A reader answered the question above on 2026-08-17, and the answer is *it varies*

[Ninety of these marks were put in front of somebody](../validation/rulings/2026-08-17-placement-weak-size-part1.seed23.settled.json), drawn from the badly-matched population
of the recomputed corpus; sixty-one came back with a correction, thirty-three of them doubled
marks and twenty-eight single. That link is the sitting in its finished, ninety-of-ninety form —
㉚ below says what changed once it was sat the rest of the way; the sixty-one-mark counts in
this item are left standing as they were first read, not edited to match. This is the first time this item has had ground truth rather
than an inference from match scores, and it settles the branch above and breaks the headline.

**The population claim gets stronger, not weaker.** Doubled marks are 8,554 of the 326,515
marks in the book — 2.6% — and 160 of the 329 the search refuses for matching badly, which is
48.6%. Nineteen times their share. The rates, one row per kind, against a base rate that is
essentially zero for anything single:

| mark | in the book | refused | rate |
| --- | ---: | ---: | ---: |
| successive kasratan | 1,935 | 61 | 3.15% |
| fathatan | 734 | 21 | 2.86% |
| kasratan | 599 | 11 | 1.84% |
| successive fathatan | 2,901 | 45 | 1.55% |
| successive dammatan | 1,807 | 20 | 1.11% |
| fatha | 122,948 | 67 | 0.05% |
| kasra | 45,970 | 25 | 0.05% |
| sukun | 37,148 | 1 | 0.00% |
| shadda | 22,678 | 1 | 0.00% |

**The heading of this item is wrong and is left standing.** *Drawn too small* was a prediction
from the shape of the theory — two of something, a box for one — and the reader's rectangles do
not support it. Of the thirty-three doubled marks, fourteen were made wider and nineteen
narrower; the middle change in width is −0.13 units while the middle change *ignoring direction*
is 0.57. The error is four times larger than its own average, which is another way of saying
there is no average. Height is the same shape: +0.23 against a magnitude of 0.51.

So it is the second branch. **The extent is not a multiple of anything and has to be measured
per mark**, and the arithmetic repair the paragraph above hoped for does not exist.

**Where in the rectangle the fault sits, which nobody had asked.** Measure each edge separately
and the two populations come apart cleanly. For a doubled mark the near edge is nearly right and
the far edge is not:

| | left edge | right edge | top | bottom |
| --- | ---: | ---: | ---: | ---: |
| doubled marks | 0.209 | 0.549 | 0.220 | 0.471 |
| single marks | 0.672 | 0.586 | 0.211 | 0.447 |

A single mark's whole box slides — both side edges move about the same distance, which is what
a placement error looks like. A doubled mark's box is anchored where it should be and runs to
the wrong place, its far edge wrong by two and a half times its near edge. That is an extent
fault in the plainest form the measurement can produce, and it is the strongest evidence this
item has. Whether the near edge is the one the reading starts from is a guess worth checking
rather than a claim; the geometry above does not know which way the line is read.

**What each kind of fix could possibly buy, scored against the rectangles the reader settled
on.** Every row is a ceiling — three of them are built from the reader's own answer and so
cannot be reached by any rule, which is the point: they bound what is worth building.

| what we draw | doubled | single |
| --- | ---: | ---: |
| the printed line, as we ship it today | 0.788 | 0.623 |
| our rectangle, given the reader's size about our centre | 0.796 | 0.722 |
| our rectangle, moved perfectly, at our size | 0.852 | 0.744 |
| our rectangle, given the reader's size from our near edge | **0.868** | 0.711 |

Read the columns and the split is the whole finding. **For a doubled mark the best thing that
can be done is to fix the size and leave the position alone; for a single mark it is the exact
reverse**, and a rule that treated the refused population as one thing would spend its effort
on the wrong half of it either way.

**And the refusal itself is vindicated.** The answer the search found and rejected is *worse*
than what we ship in its place — 0.596 against 0.715 in overlap, and its centre 1.065 units
from the reader's against 0.664. The search is not failing to notice a good answer here. It
looked, found nothing it liked, and said so, and the rule that draws from the printed line
instead was right to. These are hard marks and the queue is honest.

**Two theories this sitting suggested and the corpus killed, both worth naming because both
were reachable.** The thirteen hamza in the sitting all shipped at one size, 4.00 by 3.90,
while hamza ships twenty-one sizes across the book — which looked like a class drawn from a
constant. It is not: that size is 16,214 of the 16,385 hamza in the book, so the sitting was
uniform because the book is, and that size is refused at 0.43%, which is the class's own rate
to two decimal places. The second was the same idea one level down — that some particular size
is the one that fails. Broken out by size, nothing stands out anywhere; successive kasratan
ships 323 distinct sizes across 1,935 marks, which is very nearly one per mark, and the sizes
that fail worst are the ones with the fewest marks under them. Both theories were the selected
population describing its own selection, again.

**One thing this cannot say.** Every measurement here is over marks the search refused. That
the size is noisy among *refused* doubled marks does not establish it is noisy among the
accepted ones, and no reader can settle that — it needs the ink extent measured under all
8,554 of them, which is the free half of the paragraph above and is still owed.

### ㉗ Counting what a reader pressed stopped meaning anything when tapping the ink was added · **confirmed**

[The sitting above](../validation/rulings/2026-08-17-placement-weak-size-part1.seed23.settled.json)
reports eighty-five presses of *the rectangle is the wrong shape*, across
sixty of the sixty-one marks somebody answered. Read as opinions that is overwhelming, and it
is the first thing anybody reading the summary sees.

Fifty-seven of those sixty marks also carry a tap on the ink. Tapping the ink puts the
rectangle around what was tapped, which changes its size, and a size that changed is recorded
as the shape having been called wrong — so the press was the tap, not a second judgement.
**Three of the sixty are a shape complaint somebody made on its own.** Ninety-two placements
split the same way: sixty-five came from a tap and twenty-seven from the arrows.

This is not a reason to distrust the sitting, and the distinction matters. The rectangles the
reader settled on are exactly as good as they were — a tap is a statement about where the box
goes, made faster. What is broken is the **tally**: every count of how often a fault was named
is now a count of how often a gesture was used, and the two stopped being the same thing the
day the tap landed. The summary printed at the end of settling says *60 were reshaped, over 85
separate goes* and means something much weaker than it sounds.

**What would answer it.** Record what the reader did *and* how they did it, and count them
apart — a shape called wrong by hand is a different row from a size that moved because a tap
put the box somewhere. The transcript already carries the distinction on every placement; it
is the shape events that do not, and nothing downstream separates them.

**Why this is worth an item rather than a footnote.** A count that overstates a fault by twenty
to one is the kind of number that gets quoted into a decision, and this one very nearly was:
the doubled-mark finding above was reached from the geometry of the corrections, but *the rate*
at which shape was called wrong is what suggested looking there, and on its own it would have
pointed at every mark in the sitting equally.

### ㉘ A rule that reaches for the ink, rather than resizing toward it, was checked against the whole book · **confirmed**

Item ㉖ found that doubled marks want their size fixed and their position left alone, and
scored candidates that resize the shipped rectangle toward the reader's own. But fifty-seven
of the sixty-one marks in
[that sitting](../validation/rulings/2026-08-17-placement-weak-size-part1.seed23.settled.json)
were placed by the reader *tapping the ink itself* —
which means the reader's rectangle was already close to a much simpler rule: **take the ink
under the window, not a resized guess about it.**

That rule was checked two ways. First, against what the reader actually chose: of the pieces
of ink in each mark's window, taking every piece whose middle falls inside the shipped
rectangle reproduces the exact set the reader tapped on 96% of the fifty-seven — 94% of the
doubled marks, 100% of the single ones. The rectangle it draws scores 0.847 against the
reader's own on doubled marks and 0.769 on single ones, both above what ships today (0.788 and
0.623) and above every resized-guess candidate ㉖ scored — because this one is not guessing a
size, it is reading one off the print.

Second, against the marks nobody is arguing about: the same rule was run over every mark on
sixty pages spread through the book — 31,805 marks, about a tenth of the corpus, of which
31,773 are marks the ink search already places with confidence today. On those, the rule's
answer sits a median of 0.077 units from what ships, with 99.2% moving less than half a unit —
close enough to call it the same answer. The 791 already-accepted doubled marks among them
show the same thing from the other side: their size barely moves (width −0.075, height −0.088,
against the several-unit corrections the refused doubled marks needed), which is the direct
answer to what ㉖ left owed — the accepted doubled marks were not secretly wrong all along, so
a fix aimed at the refused eighteenth of a percent will not quietly move the rest.

The 32 refused marks in the same sixty pages moved the way ㉖ predicted: a median of 1.47
units, four in five moving more than half a unit.

**What this is not.** It is not a shipped fix, and it is not scored on marks nobody has looked
at by eye except through this rule's own selection — the check above says the rule *agrees
with the reader where a reader has looked*, not that it is right where nobody has. It has not
been run as an escalation (fire only where the current rule refuses) and diffed against the
production output the way ㉔ and ㉕ were, which is the check that would make the safety claim
about the accepted 99.9% a guarantee rather than a sample. That is the next step, tracked
alongside the rest of this item's population split.

### ㉙ Run as an escalation over every mark the book currently refuses, the rule mostly holds up and one way it does not · **confirmed**

The step ㉘ left owed. The current corpus refuses exactly 329 marks — the same population ㉖'s
table counts, so nothing has drifted between the two — and the rule was run as an escalation:
fired only where the shipped rule already refuses, never touching the other 326,186. That gate
is a fact about the code, not a sample of it, so **the accepted population's answers are
unchanged by construction**, not by having been checked and found unchanged.

Of the 329, the rule finds ink to draw from for 304. The other **25 have nothing under them
that the rule can point to** — no piece of print whose middle falls inside the rectangle we
already ship — and would have to keep today's rectangle rather than take a guess. Eleven of
those twenty-five are hamza, out of seventy-one hamza in the refused population; four are marks
already named in the print-oddities list above, which is the same kind of cross-check ㉖ ran
against its own two killed theories — the marks the rule cannot answer for are disproportionately
the marks something is already known to be wrong with, not a random slice.

**Checked against the one place a reader's own answer exists for this exact population** — the
thirty-three doubled marks from
[㉖'s sitting](../validation/rulings/2026-08-17-placement-weak-size-part1.seed23.settled.json),
matched mark for mark rather than compared as two
separate averages. Typical agreement is close: half of the thirty-three land within 0.064 units
of what the reader drew, on both width and height together. But five do not, and one is not a
near miss — on one mark the reader barely touched the size (0.04, −0.20) and the rule proposes
growing it by (4.79, 12.35), more than a whole extra mark's worth of print. That is the union
sweeping in a piece of ink the reader did not mean to include, and nothing in the rule as
written would have stopped it. Four more disagree by two to four units, in both directions —
sometimes the rule grows where the reader shrank.

**What this changes about shipping it.** The zero-regression claim now holds as a guarantee, not
a sample — that part of ㉘'s open question is answered. The other part is not: the rule needs
something that refuses a piece union that has grown implausibly large relative to what we
already ship, the same way it already refuses to guess when it finds no ink at all, before the
outlier above stops being a risk on every mark rather than a known one on this one.

### ㉚ The same sitting, sat the rest of the way, says the outlier in ㉙ was not one mark · **confirmed**

The sitting behind ㉖ and ㉙ was only two thirds sat — sixty-one of its ninety marks. It has
since been finished: the same reader, the same report, continued rather than re-dealt,
[ninety of ninety now settled](../validation/rulings/2026-08-17-placement-weak-size-part1.seed23.settled.json) —
the file this paragraph names is that finished state, and everything from ㉖ through ㉙ above
was written against the sixty-one-mark state it replaces. **Do not re-read ㉙'s numbers as wrong** — they were an honest count of
a smaller population, and this is what the fuller count says instead.

The doubled marks with a reader's answer in this population grew from thirty-three to
forty-five. Matched the same way, mark for mark: the worst case is the same mark ㉙ already
named (`274:59`, reader (0.04, −0.20) against the rule's (4.79, 12.35)) — nothing new sat
disagreed worse than that one already on record. But it is no longer alone in the way ㉙
suggested. Where ㉙ counted five of thirty-three disagreeing by two units or more, the finished
count is **seventeen of forty-five** — the union sweeping in ink the reader did not draw
happens on more than a third of doubled marks, not one in six. Single marks stayed as solid as
before: two of forty-four disagree by that much, and the typical single mark is within half a
unit on eighty-nine of them.

**What this changes.** ㉙ already said the rule was not shippable without a guard against an
implausibly large piece union. This does not change that conclusion — it changes how load-
bearing the guard is. A problem on one mark in six can be shipped cautiously and watched; a
problem on more than one mark in three cannot ship at all until the guard exists, because it is
no longer the tail of the distribution, it is a third of it.

**The same sitting also caught four more marks a reader called odd in the print** rather than
in our rectangle — one successive dammatan, one hamza, one small yeh, one successive
fathatan, on four pages between 115 and 260. Folded into the running note on item ⑭ above,
which they extend rather than reopen: nothing here says the answer, only that it is still being
asked in the same shape.

### ㉛ The marks that ran out of room and still shipped as placed were never looked at, until now · **confirmed**

㉕ found the code bug: a mark whose search ran out of room could still slip past the check meant
to catch that and ship as if its own ink had confidently answered. The bug is fixed, but fixing
it never asked the question it makes askable for the first time — of the marks that still run
out of room and still clear the bar today, are the rectangles actually right? Nothing had looked.
That population, on the corpus as it stands today, is 339 marks.

Two sittings, drawn the same way as ㉖'s and ㉙'s, forty marks each, eighty of the 339 seen so
far. **Every one of the eighty carries a complaint.** Unlike ㉗'s tally, where a tap set both
words at once and inflated the count, here the movement is mostly real: seventy-nine of the
eighty moved the rectangle by half a tenth of a unit or more, seventy-three had their size
genuinely changed, and seventy-two needed both. This is not the tap artefact ㉗ named — it is
eighty separate readers' judgements that the box was actually wrong.

**But it is a small kind of wrong, not the fallback population's kind.** The reader moved these
by a median of 0.676 units, worst 3.231 — real, but far short of the fallback set's multi-unit
corrections. The size change is smaller still: a median of 0.07 to 0.09 units either way on
boxes some five units across. Nobody called a page odd in the print, and nobody banked a mark as
unclassifiable. These are rectangles that are a little off, on almost every mark, not rectangles
that are badly out on a few.

**What this says about ㉕'s own number.** ㉕ reported that the boundary-hit marks it had been
undercounting matched at a median of 0.859 against 0.909 for a mark the search is happy with —
close enough to read as *nearly as good*. A reader now says that gap is not nothing: it is a
rectangle every one of eighty checked wanted moved and reshaped, just not by much. A search
score near the floor was never a guarantee, and this is the first direct evidence of what the
gap between 0.859 and 0.909 actually costs a reader.

**What is not yet known.** 259 of the 339 have not been sat. Whether the fault holds at the same
rate and the same size across the rest of the population, or whether these eighty happened to be
the worst of it, is exactly what the next sitting would answer — and unlike the fallback
population, which is already known to be almost entirely wrong, this is a population that ships
today as trusted and has never had a rate put on it at all.

**Where the eighty answers actually are.**
[`docs/validation/rulings/2026-08-17-placement-edge-still-placed.seed23.settled.json`](../validation/rulings/2026-08-17-placement-edge-still-placed.seed23.settled.json)
carries all eighty, mark by mark — the box we ship, the box the reader settled on, and how far
apart the two are. It has no ink and no scripture in it, only page numbers, mark indices and
offsets, which is what a ruling is allowed to hold. It cannot show the rectangle sitting on the
mark; only a page that draws the print itself could do that, and the next section says plainly
that no such page exists yet for this document to point to.

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
  recorded. A per-line one does not fit in it and needs a table beside it; §⑩ ⑨ holds that open.
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
