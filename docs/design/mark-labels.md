# Does each mark's drawing match the name it was given?

> A companion to [Are the marks in the right place, and how would we know?](mark-registration.md),
> and deliberately not part of it. That document asks whether a rectangle sits on the ink. This
> one asks a question that needs no page, no rectangle and no second printing to answer: the
> corpus drew a shape and, in the same breath, named it — do the two agree?

**Status:** a measurement, and the finding is that there is nothing to find. It has been run over
**every one of the 326,515 marks**, not a sample. Nothing in the app changes as a result. What it
settles is that **not one mark in this corpus is drawn with the strokes of a different name** —
the category of genuine mislabelling is empty — that one specific limit of the method is real and
must never be reported as an error, and that a second limit, which used to produce forty-five
convincing-looking errors, has been found, fixed, and measured.

> **This document was wrong once, and the correction is the most useful thing in it.** An earlier
> version reported forty-five marks "drawn unlike their own name" and asked for a person to review
> them. Every one of the forty-five was an artefact of how the comparison worked, not a fact about
> the corpus. §④ walks through how that was caught and what replaced it, because the same mistake
> is available to anyone who compares two drawings by laying one over the other.

---

## What do the words mean?

- **Mus'haf** — the printed Qur'an. Two different printings of the same one exist in this
  project. **Only one of them appears below**, which is the entire point of this document.
- **Harakah** (plural *harakat*) — the small vowel marks written above and below the letters.
  Twenty-six named kinds appear in this mus'haf. "Mark" below always means one of these.
- **Iqlab** — a recitation rule; three of the twenty-six names are marks written for it, and
  they turn out to matter here out of all proportion to how rare they are.
- **Agreement** — one number between −1 and 1 comparing two drawn shapes: 1 means the same ink
  in the same places, 0 means no more alike than chance. It is the same number used in the
  companion document, and it is chance-corrected, so a mark that is mostly blank space cannot
  score well simply by being mostly blank space. It can go **below zero**, and that turns out to
  matter: below zero means ink landed where the other drawing has nothing, which is worse than
  no resemblance at all.
- **Stroke** — one continuous piece of a drawn mark. Some of the twenty-six names are a single
  stroke; others are two or three written one after another — a vowel above a small letter, or
  two short slashes side by side. Whether a name is one stroke or three is the hinge of this
  whole document.

---

## ① What is being decided?

Whether the names attached to the marks can be trusted, and how anyone would ever know.

This used to be asked as part of the placement question, and asking them together made both
answers worse. The old measurement produced a single figure — "the ink matches the name for
51.15% of marks, or 69.15% if you count look-alikes" — and an eighteen-point swing that depends
on how you choose to count is not one measurement. It was three unrelated things added together:
a rectangle in the wrong place, a pair of names this method is not entitled to separate, and an
actual mislabelling. Only the third is a finding.

So the decision here is narrow: **is there a data-integrity problem in the names, and how big is
it?**

## ② Why is this being asked now?

Because the answer to the placement question depends on it. A measurement of whether the shipped
page's ink matches a mark's name is worthless if the name itself is in doubt — it would report
the same failure twice and call it two pieces of evidence. Separating them lets the placement
probe *exclude* marks whose name is in question, and say how many it excluded.

And because separating them makes the labelling question far easier than it looked. It needs no
page, no fitted transform and no rectangle, which means the large displacement documented next
door **cannot contaminate it**. That is a stronger claim than reporting the two numbers side by
side: the displacement is not an input to this arithmetic at all.

## ③ What happens if nobody decides?

Very little, and that is a real answer rather than a shrug. Nothing is drawn from these names
today. The cost of leaving it is that the placement work carries an unbounded doubt it cannot
resolve from inside itself, and that a future feature which colours a recitation rule inherits
whatever is wrong here without any way to notice.

## ④ What does the app do today, and what does that cost?

### How is anything measured, with only one printing?

Every mark in the corpus is drawn as an outline and carries a name. One real drawing per name is
chosen as that name's canonical example — the instance nearest its own class's average, so the
choice is a property of the class rather than of whichever page happened to be scanned first.
Every drawing in the corpus is then centred on its own middle, stretched so its width and height
match the example's, scored against all twenty-six examples treated the same way, and the winner
compared with the label.

Centring both shapes is what makes this a comparison of *shape alone*. It is also this method's
one unavoidable limit, and the next section measures the size of it rather than asserting it.

The stretching is not decoration and it was not there at first. §④'s section *[Where did the
forty-five go?](#where-did-the-forty-five-go)* is the account of what happened without it.

### Which names does this print draw as the same shape?

Not a list somebody wrote down. Every canonical example was scored against every other — the
whole twenty-six by twenty-six square — and any pair reaching **0.85** was joined:

| this name | and this one | agreement |
|---|---|---|
| fatha | kasra | 0.968 |
| fathatan | kasratan | 0.914 |

**Two groups, and nothing else comes close.** The nearest pairs that were *not* joined sit at
0.627 and 0.494 — a gap of nearly three tenths of the scale, so the threshold is not doing
delicate work:

| threshold | groups it gives |
|---|---|
| 0.70 | fatha·kasra   ·   fathatan·kasratan |
| 0.75 | fatha·kasra   ·   fathatan·kasratan |
| 0.80 | fatha·kasra   ·   fathatan·kasratan |
| **0.85** | **fatha·kasra   ·   fathatan·kasratan** |
| 0.90 | fatha·kasra   ·   fathatan·kasratan |
| 0.95 | fatha·kasra |

**The same two groups across every threshold from 0.70 to 0.90** — a five-fold widening of the
band, with no change in the answer.

That stability is itself a repaired result, and it is worth showing both readings side by side,
because the earlier one looked stable and was not. Before the drawings were put on a common box,
four other pairs sat within a tenth of the line:

| pair | before | after |
|---|---|---|
| fatha ~ kasra | 0.917 · joined | 0.968 · joined |
| fathatan ~ kasratan | 0.970 · joined | 0.914 · joined |
| fathatan ~ successive fathatan | 0.785 | 0.533 |
| kasratan ~ successive fathatan | 0.763 | 0.505 |
| kasratan ~ successive kasratan | 0.746 | 0.494 |
| rounded zero ~ rectangular zero | 0.560 | 0.627 |

The two real groups barely moved. The four near-misses fell away, and the reason is exactly the
reason §④'s repair exists: *successive fathatan* is two short slashes with a gap between them,
and comparing it to *fathatan* at whatever size each happened to be drawn was scoring the gap
rather than the slashes. **So the answer to "are the shape groups an artefact of the same
arithmetic?" is no — but the pairs that used to sit just outside them were.**

The whole square is printed in the measurement's own output and is reproduced at the end of this
document, because it is the thing that decides which disagreements get excused and an excuse
nobody can audit is one that will eventually be believed for the wrong reason.

What separates a fatha from a kasra is that one sits above the letter and one below. A comparison
that centres both has thrown that away before it starts. **So this method is not entitled to tell
those two pairs apart, and a case where it "sees a kasra" on a mark labelled fatha is a limit of
the question, not a disagreement about the data.** It is never counted as one below.

### Does the measure measure anything? — three planted labels

The winner is chosen without ever looking at the label, so a wrong label can be planted for free
and the answer is known in advance. Three plants, over the whole corpus:

| what was planted instead of the real name | flagged | should be |
|---|---|---|
| a random name from outside the label's shape group | **100.00%** (326,514 of 326,515) | ~100% |
| **the nearest name from outside the shape group** | **100.00%** (326,511 of 326,515) | ~100% |
| a name from *inside* the shape group | **0.00%** (1 of 170,251) | ~0% |

The second row is the one that matters: it is the hardest wrong answer available, and it was
caught every time but four. The third row is the other half of the same claim — the excuse in
the middle column of the results is not a hole through which real errors escape, because a
deliberately planted within-group error is *supposed* to escape, and this measurement's own
report of it is honest about that.

These three rows are also the guard on the repair described below. A change that made the
comparison more forgiving would show up here first, as a wrong name that stopped being caught.
Stretching every example onto the drawing's own box moved the second row by three marks out of
326,515 and the third by one. The repair did not buy its result by lowering the bar.

### So how often does a drawing match its name — and why is that three numbers, not one?

Every mark in the cache, so these are counts of the whole population and carry no sampling error
and therefore no confidence interval:

| outcome | marks | share |
|---|---|---|
| the drawing's best match is its own name | 256,948 | **78.69%** |
| best match is a name this print draws as the same shape | 69,562 | **21.30%** |
| **best match is outside the label's shape group** | **5** | **0.00%** |

The middle row is entirely fatha/kasra and fathatan/kasratan, and it is a statement about the
method. The bottom row is the only one that could be a finding — and §④'s last two sections show
that it is not one either.

**No number in this document adds those rows together, and none should.** A combined figure would
mean "however much of this method's own blind spot you feel like forgiving today", which is what
made the old single percentage unusable.

### Where did the forty-five go?

An earlier run of this same measurement put forty-five marks in that bottom row and this document
reported them as a small data-integrity finding. They were not one. What follows is how that was
caught, because the way it was caught is more reusable than the result.

**It was caught by looking at the top card.** The evidence page draws every disagreement three
times: the mark as the print drew it, the example of the name it was given, and the example of
the name it was matched to. On one card the first two pictures were two parallel diagonal strokes
and so were the second two — plainly the same glyph to anyone's eye — and the number between them
was **−0.096**. Not a weak match: an *anti*-correlation, beaten by a name it resembles not at all.

A negative number between two drawings a reader calls identical is not a fact about the corpus.
It is the comparison failing, and no amount of careful reporting downstream repairs it.

**What was actually wrong.** The comparison laid each drawing over each example at whatever size
each happened to have been drawn. But this print does not draw a name at one size — it sets a
mark smaller under a crowded word and larger under an open one. Measured across the whole corpus,
the gap between the tenth and the ninetieth percentile of a name's own width runs to a third of
the mark's width for the commonest names:

| how variably the print sizes this name | names | how often they disagreed |
|---|---|---|
| barely at all (under 2% spread) | shadda, sukun, wasla, damma, dammatan, hamza, maddah, small meem, small noon, small yeh, small waw, superscript alef, rectangular zero, rounded zero, successive dammatan | 0.00%, except two marks |
| a great deal (10% to 34% spread) | fatha, kasra, fathatan, kasratan, small seen, vowel sign, successive fathatan, successive kasratan, and all three iqlab marks | every disagreement in the corpus |

**And the size alone is not the mechanism — it is size *and* strokes.** A name drawn as one
stroke, laid over a copy of itself a fifth too large, still overlaps itself down the middle and
scores respectably. A name drawn as two or three strokes does not: when it grows, the gaps
between its strokes grow too, so each stroke lands on the paper *between* the example's strokes.
Ink on gap is what drives agreement below zero. That is why fatha, the most size-variable name in
the corpus, never disagreed once, while the three iqlab marks — a vowel above a small letter,
which is two strokes and sometimes three — supplied thirty-nine of the forty-five.

**The repair.** Before scoring, each example is stretched so its width and its height match the
drawing's. Both axes rather than one, because matching the diagonal alone — a single isotropic
number — recovered 32 of the 45 while matching both recovered 42. Three other repairs were
tested and rejected on evidence, in §⑧.

The stretch is decided **by the drawing alone**, never by the label, which is what keeps the
planted-label controls above meaningful: every example is put on the same box, so the name the
corpus wrote gets no say in how any candidate is drawn.

**What it cost and what it bought.** The full three-way split moved from 79.57 / 20.42 / 45 to
78.69 / 21.30 / 5. The shape groups did not change. The planted controls moved by four marks in
326,515. The two directions of the twenty-six by twenty-six square, which used to differ because
each was scored over a different rectangle, are now near enough identical — both are still
computed and reported rather than one being assumed from the other.

### Are those last five the right strokes, or the right name?

Five marks still match a name outside their own group. They are not five mislabels, and this is
measured rather than argued.

Each of the five was taken apart into the strokes the print drew it from, and each stroke scored
against the stroke in the same position of its own name's example. Separately, the distances
between stroke centres were compared, in units of the mark's own size:

| mark | strokes | whole picture | worst single stroke | spacing differs by |
|---|---|---|---|---|
| p315 mark 257 · successive kasratan | 2 | **−0.142** | **0.948** | **0.797** |
| p58 mark 79 · damma iqlab | 3 | 0.409 | 0.993 | 0.141 |
| p108 mark 353 · damma iqlab | 3 | 0.443 | 0.998 | 0.113 |
| p74 mark 124 · successive kasratan | 2 | 0.686 | 0.832 | 0.102 |
| p82 mark 321 · kasratan | 2 | 0.643 | 0.943 | 0.090 |

And, so those columns have something to be read against, the same two numbers for every *other*
drawing of those three names:

| name | other drawings | worst stroke, typical | spacing, typical | spacing, 95th percentile |
|---|---|---|---|---|
| damma iqlab | 132 | 0.992 | 0.031 | 0.093 |
| successive kasratan | 1,933 | 0.985 | 0.038 | 0.084 |
| kasratan | 598 | 0.985 | 0.064 | 0.817 |

**All five of the five have every stroke matching their own name's stroke at 0.83 or better**,
while the whole-picture score falls as low as −0.142. The first row is the extreme case: two
strokes that are, to three decimal places, the canonical strokes of a successive kasratan — and
the print set them nearly twice as far apart as usual, ten times its own class's ninety-fifth
percentile.

So the honest count of marks in this corpus whose drawing carries the wrong name is **zero**. Not
"five, pending review". Zero. **The category emptied out**, and an empty category is the result,
not a gap in the work.

What the remaining five measure is that a whole-picture comparison charges a mark for where the
print chose to put its own pieces. That could be repaired too — score stroke against stroke and
ignore the arrangement — but it must not be, and §⑧ says why: the arrangement is the *only* thing
separating fathatan from successive fathatan, and a comparison that discards it would trade five
false alarms for four thousand real confusions.

### How firm are the five?

Each was re-scored at eight neighbouring centrings, one sample away in each direction, to see
whether the verdict is about the mark or about where the middle was judged to be. **2 of the 5
still disagree at all eight; none survives at zero of eight.** The stroke-by-stroke table above
supersedes this check rather than depending on it, and it is kept because a verdict that flipped
under a half-sample would have been a third thing wrong and worth knowing about.

### Or is the example itself the problem?

Each name is judged against *one* real drawing. For most names that costs nothing — the print
draws them identically every time, and the median instance agrees with its own example at 0.99 or
better. For a few it does not:

| name | drawings | median agreement with its own example | 5th percentile | disagreeing |
|---|---|---|---|---|
| kasra iqlab | 99 | **0.737** | 0.437 | 0.00% |
| fatha iqlab | 106 | **0.764** | 0.461 | 0.00% |
| successive fathatan | 2,901 | **0.816** | 0.603 | 0.00% |
| small seen | 8 | **0.847** | 0.628 | 0.00% |
| damma iqlab | 134 | **0.849** | 0.581 | 1.49% |
| fathatan | 734 | 0.865 | 0.701 | 0.00% |

Every name at the top of that list is a name drawn from two or three strokes, and what holds its
median down is the spacing measured in the previous section, not any doubt about what it is. One
example can stand in for a name's strokes; it cannot stand in for every distance the print sets
them at. **Note also that five of the six now disagree zero times** — before the repair, four of
them supplied every disagreement in the corpus. The correlation that made this section look
alarming was between a name being multi-stroke and the old comparison being wrong about it.

## ⑤ What do people outside this project do about this?

The general shape of the practice is well established: to find wrong labels in a labelled
dataset, score every item with something that never saw its label, rank the disagreements, and
have a person read the top of the list. The best-known demonstration of it found label errors in
the standard machine-learning benchmarks that everyone had been reporting scores against for
years — which is the relevant lesson here, that a dataset can be wrong in a way no amount of
using it reveals.

The specific choices below are borrowed from that practice: separating the classes a method
cannot distinguish from the ones it can before counting anything, and ranking by how far the
winner beat the label rather than by the winner's score alone.

**What was not checked in this pass, stated plainly rather than smoothed over:** no primary
source was re-read for this document, and no survey was done of how Arabic typographic corpora in
particular audit their own diacritic labels. The companion document's §⑤ contains the literature
search that *was* done, and it was about placement, not naming. If this becomes a question anyone
has to defend, that search still needs doing.

## ⑥ What have we already decided that this has to live inside?

- **No scripture is committed to this repository.** The evidence page draws marks and is written
  to the untracked working directory, never to `docs/`. Everything in this document is reported
  by page number, mark index and diacritic name.
- **Derived data is derived offline from committed bytes, deterministically.** Two runs of the
  command below produce identical output; it reaches no network and needs nothing installed.
- **Measurements are not gates until a person has agreed with them.** This one exits with a
  failure code when a threshold is breached so that it *could* become a check, and it is wired
  into nothing.
- Whichever correction the companion document adopts is unaffected by anything here, which is
  the useful consequence of the two being independent. Its recommendation has since moved from
  one displacement per page to one per printed line, and nothing on this page moved with it.

## ⑦ What are the options?

The question these answer has changed since the first draft. It is no longer "what do we do about
the forty-five", because there are no forty-five. It is "we now know the names are clean — what,
if anything, is worth building on top of that".

### Option A — record the two limits, change no data, ask nobody to review anything · **recommended**

Write down that shape cannot separate fatha from kasra or fathatan from kasratan, so that no
future work claims it can; write down that a whole-picture comparison also cannot judge how far
apart a print sets a mark's own strokes; and stop there.

Measured consequence: the first limit is bounded and known — it touches 21.30% of marks and is
entirely two pairs. The second is bounded at five marks in 326,515, every one of them shown to be
the right strokes at an unusual spacing. **Nothing is asked of a person**, and that is the point
of the option rather than an omission: the earlier draft of this document asked for an afternoon
of human review of forty-five marks, and every one of the forty-five would have been a wasted
judgement. Attention is the one resource here that cannot be regenerated by re-running anything.

### Option B — correct the labels · **rejected on the measurement**

Kept in the list because an earlier draft recommended a version of it, and a rejected option that
disappears leaves the next reader wondering whether it was ever considered.

Measured consequence: there is nothing to correct. Zero marks in 326,515 are drawn with the
strokes of a different name. If the corpus is ever replaced, this option comes back — but it
comes back needing the same evidence, which is a stroke-by-stroke table, not a ranked list of
whole-picture scores.

### Option C — add more than one example per name

Several examples per name, a drawing matching if it resembles any of them.

Measured consequence: it would raise the "own name" column for the multi-stroke names, whose
median agreement with their single example still sits at 0.74–0.87 for reasons §④ explains. It
would not change any verdict — those names now disagree zero times — so it buys a prettier
number and nothing else, at the price of making the method harder to explain and weakening the
planted-label control, since more templates means more chances for a wrong name to win. **Not
worth doing.** This is a firmer answer than the earlier draft could give, which deferred it
pending a review.

### Option D — separate the look-alike pairs by where they sit

Fatha above the letter, kasra below. Shape cannot see it; position relative to the carrying letter
can.

Measured consequence: it would close the 21.30% column, and it is the *only* thing that would — a
better shape comparison cannot help, and that is settled by the 0.968 between two names this
document is otherwise confident about. But it needs the placement question answered first, because
it needs to know where the letter is. Deferred rather than rejected, and it is carried as an open
item in one place only — [`mark-registration.md`](mark-registration.md) §⑩ ⑤ — because it is one
question and a copy of it here would be a second thing to keep in step.

### What thresholds would go with this, and are they enforced?

Proposed and **not enforced anywhere**:

- Disagreements outside the shape groups no higher than **0.5%** of drawings, against a measured
  **0.00%** (5 marks).
- The nearest-wrong-name control flagged at least **95%** of the time, against a measured
  **100.00%**.
- The within-group control flagging no more than **0.5%**, against a measured **0.00%** — this is
  the one that would catch the shape groups being drawn too generously.
- **Every disagreement's worst single stroke at or above 0.80**, against a measured 5 of 5. This
  one is new and it is the important one: it is the threshold that fails if a real mislabelling
  ever appears, and it is the only proposed threshold whose breach would mean the *corpus* is
  wrong rather than this method.

## ⑧ What else could be considered, and why is it not here?

**Comparing each drawing to its class average rather than to one real drawing.** An average of
many outlines is blurred at the edges, and everything then scores against it slightly worse in the
same way, which flattens exactly the distinction being measured. A real instance keeps sharp
edges, and the cost of choosing one — that the choice might be unrepresentative — is measured
directly in §④ rather than hidden.

**Scoring against every drawing of a name rather than one.** Correct, and 326,515 by 326,515. The
single-example version runs the whole corpus in fifty seconds, and §④ shows where its weakness
is, which is enough to decide what to do next.

**Three other repairs for the size problem, all tested, all rejected on the numbers.** These were
run against each other rather than chosen by preference, and the losers are listed because a
repair with no rejected alternatives beside it is one nobody can check:

| what was tried | of the 45, how many turned out to be their own name | why not |
|---|---|---|
| try each example at ten sizes, keep the best | 22 | Taking the best of several sizes can only ever *raise* a score, never lower one, so it cannot separate anything — it can only merge. The near-miss pairs in the square stayed exactly where they were, and one new pair rose. A repair that is mathematically incapable of finding a difference is not a measurement. |
| match the diagonals — one size number, shape kept in proportion | 32 | Better, and it does lower scores as well as raise them. But the print stretches some marks along one axis only, and thirteen of the forty-five stayed wrong. |
| widen the window to cover both drawings, without resizing | 24 | This fixes a different real defect — a small example laid inside a big drawing used to be scored only where it sat, so it was never charged for the ink it failed to explain. Worth knowing, but once both drawings are put on the same box the two windows coincide and the question disappears. It is subsumed, not dismissed. |
| **match width and height separately** | **42** | **Chosen.** Also collapsed the four near-miss pairs in the square, which none of the others did. |

**Scoring stroke against stroke and ignoring the arrangement.** This would take the last five to
zero. It must not be done, and the reason is a number: *fathatan* and *successive fathatan* are
the same two strokes, and the only thing distinguishing them is how far apart the print sets
them. Discarding arrangement would merge them, and they are 3,635 marks against the five it would
save. The measurement of stroke spacing therefore lives beside the whole-picture score as
evidence for reading a verdict, and is deliberately not folded into the verdict itself.

**Anything that learns.** A trained classifier would answer this better and would not be
reproducible from committed bytes without pinning weights, a runtime and a numerical library.
Nothing here needs it: the classes are typographic, the print draws each one nearly identically,
and the measured evidence for that is the 0.99-and-above column.

**Reading the Arabic character each mark carries.** The corpus names its marks and also carries
the text they belong to, so the name could be cross-checked against the text rather than against
the drawing. That is a genuinely independent check and a good one — but it compares one record
against another record, and every mark in this corpus would pass it while still being drawn
wrongly. It answers a different question, and it should be done as well, not instead.

## ⑨ What would change the answer?

- **A disagreement whose worst stroke scores badly.** This is the one to watch. Today all five
  disagreements have every stroke matching their own name at 0.83 or better, which is what makes
  them arrangement rather than error. A disagreement with a stroke below 0.80 would be the first
  real candidate for a wrong name this corpus has produced, and it is worth a person's afternoon
  the moment one appears — which is precisely what the earlier draft could not tell you, because
  it was ranking whole-picture scores that were meaningless for exactly these marks.
- **The shape groups being wrong.** They are derived at 0.85 and identical at every threshold from
  0.70 to 0.90 — but if some third pair belongs together, the middle column grows and the bottom
  row shrinks.
- **The corpus changing.** Every number here is a census of one specific set of bytes.
- **The multi-stroke names becoming load-bearing.** No name disagrees more than 1.49% now, so
  nothing here blocks anything. But the names whose single example represents them worst are the
  iqlab marks and the doubled vowels, and a feature that colours a recitation rule would be
  leaning on exactly those. It would be worth re-reading §④'s spacing measurement first.

## ⑩ Open questions, and what would answer each

What this document does *not* settle, stated so that each answer would be recognisable when it
arrives. Both are indexed in [`docs/issues.json`](../issues.json), which is the only place that
counts them.

### ① Whether a spacing-aware comparison is worth building · **open**

The five remaining disagreements are the right strokes at an unusual distance apart. A comparison
that scored strokes and arrangement as two numbers instead of one would report them correctly
rather than merely explain them afterwards. §⑧ says why the naive version of that must not be
built. Nothing depends on the answer today, which is why this is open rather than urgent.

### ② Whether the names agree with the text they belong to · **open**

The check described in §⑧ — name against carried text rather than name against drawing — has not
been done. It is cheap, it is independent of everything here, and it would catch a class of error
this document is blind to.

## How can someone look at this for themselves?

The measurement writes a page of evidence, and it is a **separate** page from the placement one
on purpose — one ranked list mixing "the rectangle is in the wrong place" with "the name is wrong"
is how the two got confused in the first place. It shows the corpus's own drawing beside the
canonical example of the name it was given and the canonical example of the name it was matched
as, worst-first by how far the winner beat the label, filterable by name and by verdict.

Each card also carries the two numbers from §④'s stroke table — the worst single stroke, and how
far the spacing differs — with that name's typical values beside them, and says in one sentence
which of the two the card is about. **That line is on the card because of what happened without
it.** The first version of this page showed three pictures and a score, a reader compared the
first two pictures, saw the same glyph twice, and only the score disagreed. A card that shows a
verdict without showing what the verdict is made of teaches a reader to distrust the page rather
than to find the defect.

That page is **not** checked in: it contains the mus'haf's own artwork, and no scripture is
committed here. It is written to the untracked working directory and rebuilt by the command below.

## Where does this live?

- `packages/etl/scripts/probe-mark-labels.mjs` — the measurement. Not a gate, not wired into
  `make ci` or the Makefile; run it directly or via `pnpm probe:mark-labels`.
- `packages/etl/scripts/lib/mark-shape.mjs` — the canonical examples, the whole-square comparison,
  the shape groups derived from it, and the three-way verdict. Shared with the placement probe so
  that both use one library of examples rather than two that could drift apart.
- `packages/etl/scripts/lib/mark-ink.mjs` — the agreement score and the example selection.
- [`mark-registration.md`](mark-registration.md) — the placement question, and why it is a
  different document.
- [`docs/map.json`](../map.json), feature `word-geometry` — the code pointers of record.

Reproduce every number here with:

```
node packages/etl/scripts/probe-mark-labels.mjs
```

It takes about fifty seconds over all 604 pages, reaches no network, and passes its own thresholds
today. Two consecutive runs produce a byte-identical evidence page.

---

## Appendix: how alike is every name to every other?

Every canonical example scored against every other, each one stretched onto the box of the one it
is being scored against. Rows are the drawing being matched; columns the example being tried.
Both directions are computed and printed rather than one being assumed from the other; now that
both drawings sit on a common box the two agree to within **0.042** everywhere, where before they
were measured over different rectangles and could differ a great deal.

Only the two cells at 0.85 or above join anything, and they are marked in bold. **The largest cell
anywhere else in the square is 0.627**, so the threshold that decides the shape groups has nearly
a quarter of the scale of clear air beneath it.

| | damma | damma iqlab | dammatan | fatha | fatha iqlab | fathatan | hamza | kasra | kasra iqlab | kasratan | maddah | rect zero | round zero | shadda | sm meem | sm noon | sm seen | sm waw | sm yeh | succ dammatan | succ fathatan | succ kasratan | sukun | sup alef | vowel sign | wasla |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| damma | 1.00 | 0.02 | 0.28 | 0.02 | -0.06 | 0.33 | -0.00 | 0.01 | 0.02 | 0.30 | 0.12 | -0.08 | 0.03 | 0.08 | -0.00 | -0.04 | 0.22 | 0.02 | 0.01 | 0.12 | 0.27 | 0.18 | 0.36 | 0.13 | 0.16 | 0.17 |
| damma iqlab | 0.01 | 1.00 | 0.07 | 0.19 | 0.25 | 0.04 | -0.05 | 0.19 | 0.21 | 0.04 | 0.02 | 0.11 | 0.13 | -0.06 | 0.14 | -0.10 | 0.05 | 0.05 | -0.08 | 0.07 | -0.09 | -0.01 | 0.15 | -0.03 | 0.08 | -0.01 |
| dammatan | 0.25 | 0.08 | 1.00 | 0.02 | 0.05 | 0.15 | 0.25 | 0.02 | 0.13 | 0.14 | 0.18 | -0.09 | -0.03 | 0.10 | 0.08 | -0.17 | 0.04 | -0.01 | -0.03 | 0.05 | 0.10 | 0.06 | 0.24 | -0.00 | 0.09 | 0.15 |
| fatha | 0.00 | 0.17 | 0.02 | 1.00 | 0.15 | -0.19 | -0.10 | **0.96** | -0.05 | -0.11 | 0.31 | -0.16 | -0.16 | 0.16 | -0.05 | -0.10 | 0.19 | -0.01 | -0.09 | 0.11 | -0.32 | 0.12 | -0.15 | -0.12 | 0.06 | 0.33 |
| fatha iqlab | -0.06 | 0.24 | 0.04 | 0.15 | 1.00 | -0.19 | -0.08 | 0.15 | 0.15 | -0.19 | -0.12 | 0.07 | -0.05 | -0.06 | 0.03 | -0.05 | 0.05 | -0.10 | -0.10 | 0.00 | -0.17 | -0.11 | 0.06 | 0.15 | 0.04 | -0.12 |
| fathatan | 0.33 | 0.04 | 0.14 | -0.21 | -0.20 | 1.00 | 0.28 | -0.20 | 0.12 | **0.91** | 0.04 | -0.02 | 0.19 | 0.23 | 0.10 | -0.13 | -0.00 | -0.06 | 0.00 | 0.14 | 0.35 | 0.39 | 0.27 | -0.06 | 0.21 | 0.26 |
| hamza | -0.03 | -0.05 | 0.22 | -0.08 | -0.08 | 0.27 | 1.00 | -0.09 | 0.00 | 0.28 | 0.17 | 0.14 | 0.24 | 0.18 | 0.26 | -0.13 | -0.12 | -0.19 | -0.06 | -0.04 | 0.13 | 0.10 | 0.23 | -0.10 | 0.37 | 0.17 |
| kasra | 0.01 | 0.19 | 0.02 | **0.97** | 0.15 | -0.20 | -0.10 | 1.00 | -0.05 | -0.14 | 0.33 | -0.18 | -0.18 | 0.14 | -0.02 | -0.12 | 0.19 | -0.03 | -0.08 | 0.13 | -0.33 | 0.18 | -0.18 | -0.13 | 0.06 | 0.33 |
| kasra iqlab | 0.03 | 0.20 | 0.13 | -0.05 | 0.15 | 0.11 | -0.01 | -0.05 | 1.00 | 0.09 | -0.12 | 0.09 | 0.05 | -0.05 | -0.04 | -0.03 | -0.09 | -0.14 | 0.03 | 0.09 | 0.09 | 0.02 | -0.07 | -0.04 | 0.08 | -0.12 |
| kasratan | 0.29 | 0.04 | 0.12 | -0.13 | -0.19 | **0.91** | 0.25 | -0.12 | 0.10 | 1.00 | 0.03 | -0.07 | 0.15 | 0.27 | 0.08 | -0.12 | -0.04 | -0.06 | -0.02 | 0.15 | 0.32 | 0.49 | 0.23 | -0.06 | 0.16 | 0.27 |
| maddah | 0.10 | 0.03 | 0.18 | 0.31 | -0.13 | 0.05 | 0.19 | 0.32 | -0.13 | 0.02 | 1.00 | -0.16 | -0.22 | 0.19 | -0.02 | -0.12 | 0.02 | -0.12 | -0.17 | -0.05 | 0.21 | 0.06 | 0.01 | -0.18 | 0.20 | 0.33 |
| rect zero | -0.09 | 0.13 | -0.11 | -0.16 | 0.09 | -0.04 | 0.12 | -0.17 | 0.10 | -0.07 | -0.18 | 1.00 | 0.61 | -0.04 | 0.29 | 0.33 | -0.08 | 0.21 | 0.06 | 0.08 | -0.09 | -0.21 | 0.14 | -0.06 | 0.44 | -0.15 |
| round zero | 0.04 | 0.13 | -0.01 | -0.17 | -0.07 | 0.16 | 0.27 | -0.18 | 0.06 | 0.18 | -0.26 | 0.63 | 1.00 | 0.07 | 0.25 | 0.32 | 0.07 | 0.25 | 0.10 | 0.12 | 0.12 | -0.07 | 0.32 | -0.05 | 0.38 | -0.10 |
| shadda | 0.08 | -0.05 | 0.10 | 0.17 | -0.05 | 0.24 | 0.20 | 0.14 | -0.05 | 0.28 | 0.18 | -0.03 | 0.09 | 1.00 | -0.17 | 0.00 | 0.26 | 0.06 | -0.14 | -0.09 | 0.07 | 0.21 | 0.06 | -0.10 | 0.11 | 0.36 |
| sm meem | 0.00 | 0.13 | 0.07 | -0.01 | 0.03 | 0.10 | 0.28 | -0.01 | -0.05 | 0.09 | -0.02 | 0.29 | 0.26 | -0.16 | 1.00 | -0.11 | -0.14 | -0.10 | -0.02 | -0.01 | -0.02 | 0.05 | 0.32 | -0.10 | 0.19 | 0.08 |
| sm noon | -0.04 | -0.10 | -0.18 | -0.11 | -0.05 | -0.13 | -0.14 | -0.11 | -0.04 | -0.13 | -0.13 | 0.34 | 0.36 | 0.01 | -0.11 | 1.00 | 0.26 | 0.21 | 0.25 | 0.05 | -0.03 | -0.14 | -0.06 | -0.00 | 0.04 | -0.24 |
| sm seen | 0.22 | 0.06 | 0.04 | 0.19 | 0.05 | -0.03 | -0.10 | 0.19 | -0.10 | -0.03 | 0.03 | -0.06 | 0.09 | 0.25 | -0.11 | 0.26 | 1.00 | 0.15 | 0.18 | -0.07 | 0.08 | 0.03 | 0.17 | -0.09 | -0.02 | -0.01 |
| sm waw | 0.01 | 0.05 | -0.03 | -0.01 | -0.10 | -0.05 | -0.19 | -0.01 | -0.15 | -0.05 | -0.12 | 0.20 | 0.24 | 0.10 | -0.08 | 0.22 | 0.16 | 1.00 | 0.18 | 0.28 | -0.13 | -0.05 | -0.01 | -0.03 | -0.05 | 0.01 |
| sm yeh | 0.00 | -0.08 | -0.03 | -0.08 | -0.10 | -0.01 | -0.07 | -0.08 | 0.03 | -0.03 | -0.16 | 0.06 | 0.12 | -0.15 | -0.01 | 0.27 | 0.16 | 0.19 | 1.00 | -0.04 | 0.04 | 0.07 | -0.12 | -0.12 | 0.02 | -0.22 |
| succ dammatan | 0.11 | 0.07 | 0.05 | 0.12 | 0.00 | 0.14 | -0.02 | 0.14 | 0.08 | 0.15 | -0.05 | 0.09 | 0.16 | -0.04 | -0.02 | 0.04 | -0.08 | 0.26 | -0.03 | 1.00 | 0.01 | 0.13 | 0.12 | 0.07 | 0.18 | 0.11 |
| succ fathatan | 0.28 | -0.09 | 0.08 | -0.32 | -0.17 | 0.35 | 0.12 | -0.33 | 0.09 | 0.30 | 0.21 | -0.07 | 0.12 | 0.07 | -0.01 | -0.04 | 0.08 | -0.12 | 0.04 | 0.01 | 1.00 | -0.01 | 0.26 | 0.00 | 0.25 | 0.10 |
| succ kasratan | 0.19 | -0.00 | 0.07 | 0.16 | -0.11 | 0.41 | 0.10 | 0.18 | 0.01 | 0.49 | 0.04 | -0.20 | -0.05 | 0.22 | 0.05 | -0.14 | 0.03 | -0.04 | 0.07 | 0.13 | -0.02 | 1.00 | 0.08 | -0.11 | 0.01 | 0.32 |
| sukun | 0.35 | 0.15 | 0.25 | -0.18 | 0.06 | 0.25 | 0.27 | -0.18 | -0.08 | 0.22 | 0.02 | 0.18 | 0.33 | 0.06 | 0.28 | -0.05 | 0.15 | -0.03 | -0.15 | 0.13 | 0.25 | 0.07 | 1.00 | 0.13 | 0.38 | 0.14 |
| sup alef | 0.11 | -0.00 | -0.01 | -0.16 | 0.14 | -0.05 | -0.09 | -0.15 | -0.06 | -0.06 | -0.14 | -0.06 | -0.04 | -0.14 | -0.13 | -0.03 | -0.11 | -0.04 | -0.12 | 0.10 | 0.02 | -0.07 | 0.16 | 1.00 | 0.06 | -0.17 |
| vowel sign | 0.13 | 0.13 | 0.07 | 0.06 | 0.01 | 0.20 | 0.38 | 0.07 | 0.06 | 0.16 | 0.19 | 0.44 | 0.40 | 0.11 | 0.17 | 0.04 | -0.05 | -0.04 | -0.02 | 0.19 | 0.24 | 0.01 | 0.39 | 0.06 | 1.00 | 0.10 |
| wasla | 0.16 | 0.01 | 0.16 | 0.33 | -0.13 | 0.25 | 0.16 | 0.34 | -0.11 | 0.27 | 0.33 | -0.16 | -0.07 | 0.35 | 0.08 | -0.25 | -0.00 | 0.01 | -0.22 | 0.10 | 0.10 | 0.31 | 0.14 | -0.21 | 0.09 | 1.00 |
