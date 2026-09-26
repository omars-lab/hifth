# Which words does the app line look-alikes up on?

**Status:** decided — **D**, by Omar, 2026-09-26. Asked 2026-09-03.

**Decision:** count the look-alike runs in the printed page's own words, with each lone "and" glued
back onto the word after it. It keeps every run the app colours today, on the same words, and reads
only the print, so the corpus's share-alike licence no longer reaches the look-alike feature.

**Why D:** once the owner asked why the two word lists differ, the answer was one habit — the print
leaves a gap after "and" and lists it as a word; the spelling and grammar attach it. With that gap
accounted for, A's only merit (today's runs) and B's only merit (no licence) come together, and
the 150 extra runs B and C would add turn out to be a side effect of counting the gap as a word,
not something a hafiz asked for. The owner: "if we had logic to accomodate for this gap, would that
change our decision" — then "yes record D".

**Done, 2026-09-26:** the app's look-alike runs are now found in the page's own words with "and"
glued back. Every run the corpus gave still comes out, on the same words, plus one new pair
(2:145 and 13:37). The groups of identical verses come from the page's words too and match the
corpus's 74 exactly. So the corpus no longer feeds the look-alike data at all, and its
share-alike licence is off it. A test compares the shipped runs against the corpus on every run of
the unit tests. In the code: the word list is `packages/etl/data/pages/print-word-ids.json`
(numbers only, no text), made by `packages/etl/scripts/build-print-word-ids.mjs`; the build is
`packages/etl/scripts/build-adjacency.mjs`; the test is
`packages/etl/scripts/lib/print-words.test.mjs`.

**Picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/adjacency-span-source.html> — the
two ways of finding the shared runs, each drawn on the real pages where they differ: the runs
both ways agree on, the ones only the printed page finds, and the ones only the word-by-word
reference finds and the printed page loses. Checked in as
[`docs/design/adjacency-span-source.html`](../design/adjacency-span-source.html), rebuilt by
`scripts/build-adjacency-span-source.mjs`, which writes that copy and the published one from the
same pass.

Read the picture first. This file is the reasons; the page is the subject.

## The short version

Both word lists we hold have **the same text, letter for letter**. They differ only in where one
word ends and the next begins, and only at "and" — the letter *waw*. Arabic spells "and he said"
as one word, but *waw* never joins the letter after it, so the page shows a small gap there. The
printed page's list counts that gap as a word break; the word-by-word reference, like every
grammar, does not. The app finds look-alike phrases by counting words, so the two lists pick
slightly different phrases in a few hundred pairs. Counting the page's words while treating that
gap as no break (D) gives exactly today's phrases, without the reference's licence.

## A word on the words

Two verses of the Qur'an often open with the same phrase and then diverge — *mutashabihat*, the
look-alikes a hafiz most often slips between. The app draws each pair with the shared run washed
one colour and the divergent run another, so the eye is taught the seam. To wash a run the app
must know, word for word, where the shared phrase starts and stops on the page.

Those word ranges — the *spans* — are worked out once at build time. The question here is only
which set of words they are counted in: the printed page's own words, or a separate word-by-word
corpus we vendor.

## What this is

The app finds a shared run by taking the longest stretch two look-alike verses have in common and
keeping it only where that stretch sits in exactly one place on each side. Today it counts that
stretch in the words of a vendored word-by-word corpus (the morphology corpus behind
`packages/etl/scripts/morphology.mjs`), then converts each word number into a position on the
printed page through an alignment table (`openAlignment` in `lib/segmentation.mjs`). It keeps
2,544 runs. Those spans are what `DiffView` washes and what the shipped adjacency output carries.

The printed page has its own words. It splits some short joining particles that the corpus writes
joined, so the same phrase is more words on the page than in the corpus — never fewer. The
friendlier-licensed print words are already vendored (`readTheirs` reads them off the outlined
page markup) and already read at build time for other jobs. Counting the runs there instead would
land them in page positions with no conversion table at all, and would take the whole neighbour
tree out from under the corpus's share-alike licence.

## What it costs to leave it

Measured on 2026-09-03 by `scripts/build-adjacency-span-source.mjs --extract`, the same rule run
over the page's own words keeps **2,580** runs against today's 2,544 — but the two sets are not
one inside the other:

| | |
| --- | --- |
| runs both ways agree on | 2,430 |
| runs only the printed page finds | 150 |
| runs only the corpus finds, lost on the page | 114 |
| shared phrases that are more words on the page | 1,414 |
| the same length either way | 1,130 |
| fewer words on the page | 0 |

The churn is the split itself. Because a phrase is never fewer page-words, some runs grow long
enough to become the single place they occur — a new span appears — while a short joining particle
that repeats across the page forges a fresh tie somewhere else and dissolves a span that used to be
unique. The four verses whose two printings cannot be lined up at all take no part in this; it is
the ordinary behaviour of the rule, not an artefact of the hard cases.

So the trade is bounded and it is a trade, not a free gain: **114 runs a reader can land on today
disappear, 150 new ones appear, and the neighbour tree stops being a share-alike derivative.**

The drawn page shows specimens from each of the three buckets, each verse cropped from the page it
sits on with the run washed exactly as `DiffView` washes it, so the 114 lost and the 150 gained are
things a reader can look at rather than numbers to take on trust.

## Why do the two counts disagree at all?

Measured on 2026-09-26 over every page, after the owner asked "why does this happen? is there not
a hybrid option?": the whole difference is **one word**. The print writes "and" (the single letter
*waw*) as a word of its own in 9,533 places, and it is the only word the print writes alone that the
corpus never does. Every other difference between the two word lists is nil.

- **Runs gained:** a phrase with an "and" in it is one word longer on the page, which can break a
  tie between two equally long stretches, so a run gets kept that used to be dropped.
- **Runs lost:** a lone "and" repeats everywhere, so counted as a word it can stretch an unrelated
  second match to the same length as the real one, forging a tie that drops a run.

Glue each lone "and" back onto the word after it, reading only the print, and the rule keeps 2,546
runs: all 2,544 of today's, on exactly the same words, and 2 more. That is option D. It never reads
the corpus, so the share-alike thread does not reach it.

## Is the print's split a mistake, or just a different habit?

The whole churn above comes from one thing: the printed page writes a few small attached
particle — the "and" — as its own separate words, where the word-by-word
reference folds each onto the word it belongs to. Before counting the runs in the print's words it
is worth knowing which of the two is the odd one out, because if the split were simply an error the
print had made, option B would be building the neighbour rail on that mistake.

It is not an error. On 2026-09-05 a third, independent grammar of the whole Qur'an — built on a
different edition of the text and split into words on its own terms — was read once as a witness
over the 9,533 places where the two disagree; the full account is under the tenth open question of
the dependency map. It folds the particle at every single one of them: not once in more than
seventy-seven thousand words does it write a bare particle as its own word. Two independent
grammars fold the particle; only the print separates it.

So the print's separated particle is a long-standing typographic habit of the press, not a slip
the reference corrected. That does not decide the question — it frames it honestly. Choosing B
counts the runs in the segmentation we now know to be the outlier of the three, with eyes open
about that, rather than repairing a corpus that was wrong. Whether the outlier is the right thing
to line the app on is still the same licence-and-usefulness trade, unchanged in its 114-for-150
shape above.

## What already decides part of this

- **What the app is allowed to give away, by channel** (not a registered decision — it lives in
  `docs/design/what-we-distribute.md` and `docs/design/what-we-depend-on.md`). The neighbour tree
  is *computed into* something the app ships, not merely read to check it, so whatever licence sits
  under the corpus reaches the reader. On the web the app serves today that share-alike thread costs
  nothing anyone has to act on. In a channel where a store forbids share-alike terms it would, and
  that is the case this option is insurance against. Which trees a store build may carry is not
  settled, and this option only pays off once it is.
- **[When the app shows a verse cut out of the printed page, what should it do about the
  neighbouring verses that come with it?](comparison-crop.md)** — that panel washes its two colours
  off exactly these spans. Change the set and 114 pairs lose the run they land on and 150 gain one.
  That decision took the spans as given and correct and did not reopen them; this is where they are
  reopened, so the two must be read together.

## Prior art

I did not look outside the project for this one, and should say so plainly. The choice is internal:
it is about which of two things *we already hold* to count a run in, and both are vendored here with
their licences known. The public Qur'an-data libraries publish look-alike lists and word-by-word
corpora as separate resources and leave the joining to whoever uses them, which is the reason this
project had to compute the runs itself in the first place — there is no upstream that has made this
particular choice for us to follow.

## The options

| | | |
| --- | --- | --- |
| **A** | Keep counting in the corpus's words | The 2,544 runs that ship today, the conversion table, and the share-alike thread that comes with the corpus. Zero work. |
| **B** | Count in the printed page's own words | 2,580 runs, no conversion table, no share-alike thread. Costs 114 runs a reader can land on today to gain 150 new ones. |
| **C** | Keep every run either count finds | 2,694 runs, none lost. Keeps the corpus and its share-alike thread, and the build carries two counts. |
| **D** | The page's words, with each lone "and" glued back on | 2,546 runs: all of today's on the same words, plus 2. Reads only the print, so no share-alike thread and no conversion table. One small rule in the build; gives up the 150 B and C add. |

For a hafiz: A and D change nothing they see; B takes 114 coloured pairs away and adds 150; C adds
150 and takes none. D is the one that sheds the licence without a hafiz noticing.

Doing nothing is A.

## What else was considered

- **Keep the corpus, fall back to the page only where they disagree.** First set aside for keeping
  the share-alike thread; now on the list as C, since it is the only way to gain the 150 without
  losing the 114, and that is a hafiz's call to weigh.
- **Glue more than "and" back.** There is nothing else to glue: "and" is the only word the print
  writes alone that the corpus never does.
- **Count in the corpus but ship the runs already converted, so the conversion table can be
  dropped.** Removes the table but not the licence thread, which is the larger half of the cost. It
  is a tidy-up of A, not a third answer to the question.

## What would change the answer

- **A channel being chosen where share-alike terms bite** — a store build. Then B's licence gain
  stops being insurance and becomes the reason.
- **A hafiz judging the 114 lost runs.** If the runs the page loses are ones a reader leans on, the
  cost is higher than a count of them says; if they are marginal, lower. Nobody has looked at which
  114 they are, only at how many.
- **The corpus being re-licensed permissively.** Then the licence half of the question dissolves and
  only the 114-for-150 churn is left, which on its own does not obviously favour either side.

## What this is not settling

The licence question itself — whether the corpus binds what we ship, and in which channels — is
asked elsewhere and only pointed at here. Which verses are look-alikes in the first place is not
touched; only which words of an agreed pair get washed. The alignment of the four verses whose two
printings cannot be lined up is not reopened. And nothing here changes what the look-alike panel
*looks* like — only, if B wins, which 114-and-150 of its pairs shift the run they draw.
