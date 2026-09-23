# Could a developer draw a page from the other library without a reader ever receiving it?

**Status:** decided — B, by the owner, 2026-09-08. Asked 2026-09-06. See
[So what was decided](#so-what-was-decided) at the foot.

**Picture:**
<https://blog.bytesofpurpose.com/hifth/docs/design/qul-page-source-and-diff.html> — the whole
map of what stands between us and both halves of this idea: drawing a page from the other
library, and checking ours against it. This record is the drawing half, narrowed to the one
version of it that could be built without any Qur'an text reaching a reader. Checked in as
[`docs/design/qul-page-source-and-diff.html`](../design/qul-page-source-and-diff.html), rebuilt
from its authored source by `scripts/build-qul-page-source-and-diff.mjs`.

Read the picture first. This file is the reasons for one of the two decisions it maps; its
sibling is [the fine cross-check](qul-page-cross-check.md).

## What is being decided

Whether a developer running the app on their own machine should be able to draw a page of the
mus'haf from the other library's words and word-shapes, while the app that readers receive
stays exactly as it is today — our own drawn pages, the library a witness only, and not one
Qur'an letter shipped.

This is the middle answer between two we already know. Keeping the library a check-only
witness ships nothing and settles nothing new. Building the reader's page out of the library
would carry its terms — and its word-shapes, which are Qur'an text in the only sense that
matters — all the way to the reader, which the no-text rule forbids and nothing today
justifies. The development-only draw is the third answer: reachable, useful, and kept off the
reader by construction.

## Why it is being asked now

It pairs with the cross-check. The cleanest way to *see* a disagreement between our page and
the library's is to draw the library's page beside ours while developing — a picture, not a
list of word numbers. That want is what makes this worth opening; without it, the drawing half
stays a large, always-shut question.

## What happens if nobody decides

Nothing breaks. The library stays a witness, the reader's page stays ours, and a developer who
wants to see the library's page drawn cannot. The cost of leaving it is only that
side-by-side.

## What we do today, and what that costs

The no-text rule holds today for free: our pages are outline drawings, and the library's
word-shapes never enter the tree, so no check has to work to keep them out. That "for free" is
exactly what this option spends — it asks the rule to be enforced on purpose instead.

## The rule it needs, and what keeps it honest

The no-text rule is really three surfaces, and this option splits them: the checked-in files
carry zero Qur'an text, ever, unchanged; the public build carries zero Qur'an text, now
enforced on purpose rather than for free; and the running app, while a developer uses it, may
load the words and shapes at run time from the outside library.

The project's own line is that the rule is kept by the shipped bytes, not by policy — so a
toggle merely *promised* to be development-only is the policy-not-bytes version the project
distrusts. Three legs make it bytes again: the words and shapes never enter the checked-in
files (loaded from an ignored local cache or live, never committed); the development path is
compiled out of the public build behind a build switch; and a new check reads the built public
bundle and fails if any Arabic letter, or the loader that reaches for the library, appears in
it. That last check is what turns "development-only" from a promise into a fact.

## What people outside this project do

I looked only inside the project for this scoping pass, and should say so plainly. A real
decision to draw from the library should pull forward the dependency audit's survey of how
other mus'haf apps source their pages, rather than take my word that it exists.

## What already constrains it

- **We ship no Qur'an text**, and the block here is *ours*, not the library's — the library
  publishes its fonts openly, so a page is a download away; what stops us shipping one is our
  own rule, which means we can reword it on purpose.
- **Read-to-check, copy-nothing**, and attribution owed even when zero bytes ship. A licence
  reading for the page map and the word-shapes is owed before even a development build loads a
  byte — the development-only route shrinks the *stakes* of that reading, not the need for it.

## The options

| | | |
| --- | --- | --- |
| **A** | Keep the other library a check only, never a source | Nothing to build, nothing to reword; a developer cannot see the library's page drawn. |
| **B** | Let a development build draw from it, with the public build kept clear by a new rule and a new check | Buys the side-by-side. Costs a reworded tenet, one new bundle-reading check, a development-only mark on the printing registry, and one ignore rule for the local cache. |

Doing nothing is A. The public-source version — drawing the *reader's* page from the library —
is named on the picture but deliberately not offered here; it has no forcing reason to reach
the reader today.

## What else could be considered, and is not here

Making the safety checks speak more than one printing is a cost of the public-source path, not
of this one: a development-only draw commits no per-printing files, so it trips none of the
existing per-printing checks — it *adds* the bundle-reading check rather than needing the old
ones generalised. That work is held on the picture, against the day a public second printing is
actually wanted.

## What would change the answer

Wanting the side-by-side is what makes this pay for itself. Wanting a second printing *on offer
to readers* is a different, larger want — the forcing question behind the public-source option
— and it is the only thing that would reopen B on the picture into a reader-facing source.

## What this is not settling

It does not decide whether we ever draw the reader's page from the library, does not read any
licence, and does not build the cross-check — that is the sibling decision. It reworks the
no-text rule only if this option is chosen; today the rule stands exactly as written.

## So what was decided

Decided (2026-09-08): **B.** The owner gave the direction in one breath — add the faithful
letters to the held copy now, and draw from it behind a development-only switch — and the
sibling question of what the held copy is *for* was settled the day before as
[the held copy is both the feeder and a drawable page](qul-store-purpose.md): the drawn page
stands beside the shipped page for the building tools to check, and never ships. This record
is that decision applied to the switch itself. The choice was made in conversation and only
written here on 2026-09-23, when the branch that carried it merged; no line in the plan
records it, so this record and its sibling are the whole written trail.
