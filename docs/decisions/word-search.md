# A run of words asks a question, and the answer is a number

**Status:** shipped (word-D — the spans, the refinement, the key and the sentence).
**Date:** 2026-08-05.
**Task:** #65, delivered as word-D1 (spans in the edges), word-D2 (print indices in the
roots), word-D3 (the L1 refinement), word-D4 (the key and the announcement), word-D5 (this
and the registers).
**Map:** [`the-hop`](../map.json), [`word-selection`](../map.json),
[`word-indexing`](../map.json) — where to change each part.
**Use case:** `narrow-down-to-the-words-i-mean` — what it is for.
**Supersedes nothing; completes** [`word-selection.md`](word-selection.md), whose last
section said this app had shipped something a screen-reader user could not reach.

The alignment this rides on is [`docs/design/word-indexing.md`](../design/word-indexing.md);
the forward-looking half is [`PLAN.md`](../PLAN.md) ⑮. Neither is repeated here.

## The decision

**A word run is a question about the edges, and what it gets back is how many of them it is
about.** Drag or arrow out a phrase inside a selected ayah and the hop list narrows to the
edges whose own words overlap it; the app says «٧ مواضع مشابهة» and changes nothing else.

Two things that could each have been the feature are deliberately not: it does not say
*which* words, and it does not navigate. Naming the run would mean printing scripture from a
UI string, which is the one thing the word grain exists not to do — §10 of the design doc,
unbroken by the first feature that had a reason to break it. Navigating would answer a
question the reader did not ask; they refined a selection, they did not choose a destination.

## What a span claims, and when it refuses to claim it

**A `span` is the print word range a mutashabih edge is about, on each side.** The rule that
produces it is a definition and not a threshold: **emit a span only when the longest shared
run occurs in exactly one place on both sides.** Where it occurs twice, "which words is this
pair about" has more than one true answer, and picking the first is a coin flip dressed as a
claim.

The rule needs no length floor, and the measurement is why. Ambiguity falls off with length —
65.2% of 1-word runs tie for longest, 17.6% at 2, 12.8% at 3, 3.8% at 4, 1.0% at 5, and none
from 6 up — so uniqueness keeps 2,544 of the 2,994 shipped mutashabih edges (85.0%), and the
floor a threshold would have imposed is what the rule already implies. The 450 it does not
keep split two ways: 118 share no run at all, and 332 have a longest run that occurs twice.

Both ends are converted from QAC word numbers to print indices in ETL, through
`word-alignment.pin.json`, because a print index is what a word box carries and therefore the
only number the app can paint. The four ayahs the alignment excepts get no span on either
side of any edge, and — measured — they block none of the 2,544.

## Three outcomes, not two

`refineByWords` returns `about`, `unplaced` and a count of the `excluded`. The third list is
the whole honesty of the feature.

An edge that carries no span makes **no claim** about words. Dropping it would invent a claim
the ETL explicitly refused to make; keeping it beside the edges the run really is about would
say the selection matched when nobody asked. So it goes in its own list, and the caller
decides how loudly to say "and these, which are about the whole ayah". The announcement does
say it — «… ووصلة لا تسمّي كلمات» — because a reader told "seven" when the truthful answer is
"seven, and three we cannot place" has been told something false about the corpus.

**Shared-root edges are judged only when the caller asks the roots.** `Adjacency` holds no
root shards and is not going to acquire them, so `hopsForWords` takes `options.roots` from
`Roots.rootsForWords`. Omit it and every shared-root edge lands in `unplaced` — "nobody asked
the roots", which is true — rather than silently passing, which would overstate the match.

## Where the alignment ended up, and what it cost

**Placement C: the ETL applies the map and ships its answer.** `assets/adj/**` names spans in
print indices and `assets/roots/**` names each root's `w` in print indices, so nothing in L1
or L2 imports `Alignment` and no client can apply a delta wrongly — it never sees one.

It cost 8.9× the estimate, and the gap is structural rather than an arithmetic slip. The
price was for shipping *the map* (9,533 joins); what shipped is the map's *answer* (55,345
print indices across 44,401 root-ayah pairs, plus spans on 2,544 edges). Restating an answer
always costs more than shipping the question — the roots tree went 450.7 → 532.3 KB gz and
the adjacency tree 55.8 → 79.5 KB, all of the roots growth in the per-ayah shards. Buying
that is the point, and `gate:assets`' ceilings did not move to accommodate it: headroom spent
deliberately is not a reason to re-double a ceiling, or the gate becomes a ratchet that can
only ever be satisfied.

## The keyboard path is the same sentence as the finger's

`Tab` reaches an ayah, `Enter` selects it, **`Enter` again descends** to its first word;
`←`/`→` carry the run (`←` is forward — the line runs right to left), `Shift+←` extends it,
`Escape` climbs one rung to the whole ayah and `Escape` again lets go. It is the finger's
grammar with keys: the second press of the same key means "finer", exactly as the second
350 ms of the same hold does.

**It is implemented as a capture-phase listener on `window`**, above the highlighter's own
bubble-phase listener on the SVG. That ordering is the entire mechanism — it lets the stage
claim `Enter` on an already-selected ayah and claim the arrows while a run is in hand, with
**zero L1 changes**, and it is why the arrows do not fall through to the page-turner
underneath.

## What proved it

**ETL** — `gate:edges`, whose second half is four checks and none of them re-derives the
span, because a check that recomputes the artifact only proves the code is self-consistent:
every endpoint is a lexical word of that ayah in the *word shards* (a separate artifact from
the pin the span was converted through); the print range is at least as wide as the QAC run
and at most twice it (measured: `printWidth − run` is 0 to 6 across all 5,088 span sides,
never negative); only mutashabih edges may carry spans, and both sides or neither; and a
reverse edge that carries spans carries the mirror of them. 2,544 edges, 2,544 mirrors.

**Unit** — `refineByWords` over a hand-built adjacency: overlap at both ends and past both
ends, the shared-root branch with the roots supplied and withheld, an absent adjacency, and
`hopsForWords` refusing every key that is not a run. `rootsForWords` over a hand-built shard,
including a word that carries no root at all.

**E2E** — two new tests in `word.spec.ts`, on both viewports, because both are about things
only a browser has: capture-phase ordering between two listeners on two nodes with real focus
on a polygon, and a live region that must contain «مشابه» and must never contain the run. The
second is a negative assertion the pixel goldens and the DOM assertions would both walk past.

**Still asserted, and now for a happier reason:** laying word ink leaves the stage's
accessibility tree byte-identical. That test was written as the proof of a gap. It is now the
proof that the gap was closed without burying the ayah buttons under overlay nodes — the
announcement goes through the app's one live region, outside the stage subtree.

## What it does not do

**The refinement is spoken, not shown.** The rail beside the page still lists every edge the
whole ayah has, so a reader is told the answer narrowed and then has to find the narrowed
ones themselves. Filtering the rail is a UI decision with a real cost — a rail that changes
under the reader mid-drag is a worse experience than one that does not — and it wanted its
own look rather than a rider on this one.

**The ⬡ root lens is still ayah-wide**, even though the data under it is now word-granular.
`rootsForWords` exists and is used to judge edges; narrowing the lens itself is the same UI
question as the rail.

**The tajweed shards never had a baking pass.** Placement C is per-consumer by construction:
a second consumer of the alignment needs its own pass in ETL, not a browser-side reader.

**Whether a count is enough is not ours to decide.** A memoriser who cannot see the page is
told how many places, never which — the validation ledger's `screen-reader-walkthrough` is
the only thing that can say that is sufficient, and it is owned by a human. If it says no,
the three phrasings the design doc priced are still priced, and §10 is what would be reopened,
not this.
