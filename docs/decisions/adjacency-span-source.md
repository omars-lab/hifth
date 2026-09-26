# Which words does the app line look-alikes up on?

**Status:** open — asked 2026-09-03.

**Picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/adjacency-span-source.html> — the
two ways of finding the shared runs, each drawn on the real pages where they differ: the runs
both ways agree on, the ones only the printed page finds, and the ones only the word-by-word
reference finds and the printed page loses. Checked in as
[`docs/design/adjacency-span-source.html`](../design/adjacency-span-source.html), rebuilt by
`scripts/build-adjacency-span-source.mjs`, which writes that copy and the published one from the
same pass.

Read the picture first. This file is the reasons; the page is the subject.

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

## Is the print's split a mistake, or just a different habit?

The whole churn above comes from one thing: the printed page writes a few small attached
particles — the "and", the "the", the "in" — as their own separate words, where the word-by-word
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

Doing nothing is A.

## What else was considered

- **Keep the corpus, fall back to the page only where they disagree.** Keeps the share-alike thread
  — the whole gain is shedding it — so it buys the churn without the payoff. Out.
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
