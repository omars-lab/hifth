# Whose colours are they?

**Status:** decided — **option B, with C offered behind an advanced setting**, by omar on
2026-08-19.
**Date opened:** 2026-08-08.
**Asked as:** *"can we also enable a tajweed rule color coding page where readers can change
the colors of tajweed rules"*.
**The picture:** [`docs/design/tajweed-colours.html`](../design/tajweed-colours.html), built by
`scripts/build-palette-options.mjs`, published at
<https://claude.ai/code/artifact/74b37363-d082-45e7-9651-54c47c328844>.
**Constrains and is constrained by:** [mark granularity](mark-granularity.md) — the question of
whether the app paints a whole verse or the exact letter, decided the same day as this record,
as **B: colour the exact letter**. That is what turns option C below from incoherent into an
advanced surface rather than the default one; see "What decided it".

## The question

Whether a reader can change Hifth's tajweed colours, and how far down the change reaches: the
**seven** groups the app paints, or the **eighteen** rules the shipped data now distinguishes.

Four options, each drawn on three real lines of page 2 in the options page:

| | |
|---|---|
| **A** | Leave the colours fixed — what ships today |
| **B** | A reader recolours the seven groups |
| **C** | A reader recolours all eighteen rules |
| **D** | No picker; a short list of whole ready-made schemes |

## Why it is being asked now

Two things landed in the same week.

The first is ours. Until this week the tajweed shards were keyed by the seven families the app
paints, and the source's own eighteen rule names were discarded at build time — an `ikhfa` and
an `iqlab` were the same byte by the time anything downstream could ask. They are now kept
(`tj-1`, `tj-2`), which cost **+17.5% gzipped** across the 114 shards and bought exactly one
thing: the question "which colours can a reader change" acquired a second possible answer.
Asking it before that widening would have been asking about seven and only seven.

The second is the reader's. Somebody arriving from a colour-coded printed mus'haf arrives with
red-means-elongation already learned. Hifth's palette is Okabe–Ito — chosen to survive the
common kinds of colour blindness on cream paper — and it is not wrong, but it is ours.

## What happens if nobody decides

Nothing breaks, and the app needs no change to stay correct. The cost is narrow and real: a
reader who cannot read one of our seven, or who knows a different convention, has exactly one
control today, and it is the switch that turns the whole colouring off. That is a blunt answer
to a small complaint.

## What the app does today, measured

Seven colours, seven dash patterns and seven Arabic marks, all fixed, all in
`apps/web/src/styles/tokens.css` and `packages/core/src/skins.ts`. One tint per verse, in
whichever group is *rarest* in that verse.

Two numbers decide most of this record:

- **83.29%** of what the data knows renders as nothing. Across the corpus there are 60,057
  annotations on 6,173 verses; 50,023 of them are invisible because the verse already gave its
  one tint to something else. A typical verse carries 3.9 different kinds of rule.
- **10.0%** of coloured verses (620 of 6,173) have a *winning group carried by more than one
  rule* — two kinds of elongation in the same verse, say. At verse granularity, an
  eighteen-colour palette has no non-arbitrary answer for those verses at all.

Per rule, the share of a rule's own verses in which its group also won the tint — i.e. the only
places a per-rule colour could be seen — is brutal for the common rules and generous only for
the rare ones:

| rule | group | verses | where it could show |
| --- | --- | ---: | ---: |
| `hamzat_wasl` | wasl | 4,749 | 5.9% |
| `madd_246` | madd | 4,543 | 2.8% |
| `madd_2` | madd | 4,160 | **1.6%** |
| `ghunnah` | ghunnah | 3,104 | 11.6% |
| `ikhfa` | ghunnah | 2,994 | 10.5% |
| `qalqalah` | qalqalah | 2,641 | 55.1% |
| `idghaam_ghunnah` | idgham | 2,510 | 29.4% |
| `silent` | silent | 2,307 | 98.3% |
| `madd_munfasil` | madd | 2,120 | 0.8% |
| `lam_shamsiyyah` | idgham | 2,013 | 29.4% |
| `madd_muttasil` | madd | 1,486 | 2.8% |
| `idghaam_no_ghunnah` | idgham | 905 | 29.3% |
| `idghaam_shafawi` | idgham | 718 | 22.6% |
| `iqlab` | ghunnah | 506 | 7.1% |
| `ikhfa_shafawi` | ghunnah | 453 | 7.3% |
| `madd_6` | madd-lazim | 128 | 100.0% |
| `idghaam_mutajanisayn` | idgham | 56 | 39.3% |
| `idghaam_mutaqaribayn` | idgham | 13 | 61.5% |

Recomputed from the shipped shards on every build of the options page, not typed here from
memory — but restated here because a record that only points at a generated page stops being
readable the day the generator does.

## What the industry does

**We looked.** Two searches, summarised, with the sources in the options page's §6.

- **Printed colour-coded mus'hafs are fixed, and small.** The Damascus edition most people mean
  by the term uses a handful of colour families — red for the elongations, green for the nasal
  sounds, blue for the echoing letters, grey for the silent letters — and one publisher
  describes covering 28 rules with three of them. Other editions run to about seven. In every
  case the reader is *taught* the colours by a legend at the foot of the page; nobody is asked
  to choose them. That is the strongest argument for D over B: a named scheme is a thing you can
  learn and talk about, a hue you invented is not.
- **In apps, the control is a switch.** Muslim Pro, the Greentech apps, and the long-running
  request on `quran/quran_android` all treat tajweed colour as on-or-off; where a colour is
  interactive, it is to *explain* the rule, not to change it. **We did not find a mus'haf app
  that lets a reader change which colour means which rule.** That is an absence in what we
  searched, not a proof that none exists, and it is stated that way on the page.
- **The editable-palette idea comes from somewhere else** — code editors and reading apps, where
  a theme is expected to be the reader's. Worth noticing that even there, nobody recolours a
  syntax highlighter one token type at a time; they ship themes.

## What we have already decided that constrains it

- **Mark granularity is decided, as of this same day, as "colour the exact letter."** The app
  still paints one tint per verse until `mark-C` on the task board ships that. Until it does, C
  stays an advanced setting a reader can turn on without yet seeing much from it — the ordering
  this record settles, not a reason to have waited for `mark-C` to land first.
- **Loop 6a settled that the colouring can be turned off entirely.** That control stays;
  everything here is about what happens when it is on.
- **Colour is never the only carrier** (WCAG 1.4.1). Every group has a dash pattern and an
  Arabic mark as well as a hue. This is what makes a picker *safe*: §5 of the options page draws
  two groups set to the identical colour and they are still separable, because the dash patterns
  and the marks are not part of what a reader would be editing. Whatever wins, they stay ours.

## What decided it

Not a fifth option — B and C both, at different depths. A reader gets a picker for the seven
groups by default (B); the eighteen-rule picker (C) is there too, reached through an advanced
or expert setting rather than offered as the first thing shown.

Two of the four arguments against C below survive the granularity decision unchanged: the
colours themselves do not fit — eighteen hues fanned as generously as is honest still produce
pairs closer together than the closest pair in today's seven — and eighteen rule names in two
languages is real weight to hand every reader by default. Those are why C is not the default.

The other two do not survive it. "Most of them cannot be painted" and "620 verses have no
answer" were both a fact about painting at verse granularity, where a colour has to win an
entire ayah against whichever other rule is in it. Once the app paints at letter granularity —
decided the same day, in [mark-granularity.md](mark-granularity.md) — a rule's colour shows
wherever its own letter is, not wherever it happens to win a tie for the verse. The specific
per-rule reach numbers in the table above stop being the right measure of C once that ships;
they were never a measure of B, which is why B was never in question.

So: B ships as the surface most readers see. C ships behind a setting most will never open,
for the reader who already knows what `idghaam_mutajanisayn` is and wants to see it named. That
reader exists — printed colour-coded mus'hafs teach a legend for exactly this — and hiding the
control costs them nothing an advanced setting can't answer, while showing it to everyone by
default would hand the majority eighteen names for a distinction most will never look for.
Lands as `tj-5` on the task board; the eighteen-rule picker itself is unscoped until then.

## Why C is the one option this page argues against

Not by preference — by picture and by arithmetic. Written before mark granularity was decided;
"What decided it" above says which of these four survive that.

1. **The colours do not fit.** Fanning each family's hue in lightness and a little in hue, as
   generously as is honest, still produces **18 pairs closer together than the closest pair in
   today's seven**. Seven is roughly what a qualitative palette can carry on cream paper.
2. **Most of them cannot be painted.** See the table: change the commonest elongation's colour
   and 1.6% of the verses containing it look any different.
3. **620 verses have no answer.** One tint, two rules of the winning group, nothing in the data
   to break the tie.
4. **It costs eighteen names in two languages.** A legend nobody can hold in their head, and the
   per-rule label gate that `tj-3` deliberately deferred.

None of that argues against ever distinguishing eighteen rules. It argues that *colour* is the
wrong instrument for it until the app paints smaller than a verse.

## What else could be considered, and why it is not an option here

- **Choose which rules to show, rather than what colour they are.** Show only the elongations.
  Needs no palette, and unlike C it gets *more* useful the more rules the data distinguishes. It
  is a genuinely good idea and it is not on this list because it is not a colour question — it
  belongs with mark granularity. It survives whichever of A–D wins.
- **One strength slider and nothing else.** Most complaints about a wash are that it is too loud
  or too faint rather than the wrong hue. Cheapest thing in sight, and quite possibly what is
  actually being asked for. If this record is answered A, that is the next thing to build.
- **Adopt the printed convention outright and stop.** Defensible; left off because that
  convention has no colour for two of our seven groups, and because it would trade a palette
  that survives colour blindness for one designed for ink on paper.

## What would change the answer

- **A hafiz naming one of our seven as wrong.** Would reopen B versus D faster than anything on
  the page.
- **One report of a pair that genuinely cannot be separated.** That turns B from a preference
  into an accessibility fix, and then it should not wait behind anything.
- **Schemes turning out to be shareable** — a teacher handing one to a class. D grows a name and
  a link; B does not scale to that at all.

## What this is not settling

How finely the app paints. Whether the colouring is on by default. What the eighteen rules
should be *called* in Arabic and English — necessary the moment anything shows them one at a
time, which is `tj-5`'s problem whichever option wins. Whether touching a colour can explain the
rule. And nothing at all about where the rule data came from, which is
[`packages/etl/data/tajweed/PROVENANCE.md`](../../packages/etl/data/tajweed/PROVENANCE.md).

## Where the numbers come from

`scripts/build-palette-options.mjs` reads the palette out of `tokens.css`, the seven families
out of `packages/core/src/skins.ts`, the eighteen rules out of the shipped
`assets/skins/hafs-kfqc/tajweed/rules.json`, every count out of all 114 shipped shards, and the
picture out of `docs/design/mark-granularity.data.json` plus the print of page 2. Nothing is
cached and there is no extract step, so the page cannot drift from the app. The alternative
palettes in options B and D are the only invented values on it, and they are labelled as
illustrations wherever they appear.
