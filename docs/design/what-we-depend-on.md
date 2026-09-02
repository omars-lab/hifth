# What does this app depend on, and whose terms come with it?

A dependency audit run on 2026-08-16, in five lanes: the installed package tree, the
vendored corpora, what could replace each of them, what the licences of those replacements
actually say, and what other Quran apps have done about the same problem.

It was commissioned to answer one question — *can Hifth move to more lenient terms, swap a
dependency, or write the thing itself without losing a feature?* — and the short answer is
that the question has a different shape than it looked. Swapping sources does not buy what
it appears to buy, one corpus is doing two unrelated jobs and only one of them is hard to
replace, and three places where somebody else's terms reach a shipped file had never been
written down anywhere.

Numbers below were measured against committed bytes on the branch named at the top, not
read off an upstream README. Where a claim came from a source rather than a measurement, it
is linked. Where nobody looked, it says nobody looked.

Related: [Track B and the store question](track-b-native.md) holds the analysis this audit
was meant to serve; [the licensing map](../../LICENSES.md) is the register these findings
change; [the source register](../../SOURCES.md) is the authority on every upstream's terms.

---

## What does the package tree carry?

Nothing that blocks anything. This lane closed clean and it is the least interesting of the
five.

565 package entries across 12 licence buckets — MIT, ISC, Apache-2.0, BSD-2-Clause,
BSD-3-Clause, CC0-1.0, MIT-0, BlueOak-1.0.0, MPL-2.0, CC-BY-4.0, Python-2.0, and one
dual `MIT OR CC0-1.0`. **Zero copyleft, zero source-available, zero unstated, zero
missing.** The four non-permissive-looking buckets are all several hops inside the lint,
test and build toolchain and never reach a browser.

What actually ships, traced three independent ways — the production filter, React's own
copyright banners in the emitted bundle, and the bundle's sourcemap: `react`,
`react/jsx-runtime`, `scheduler`, `react-dom`, `@use-gesture/core`, `@use-gesture/react`.
MIT throughout.

Two things worth keeping even though the licence answer was "fine":

- **A development dependency is not the same as a build-only dependency.** `workbox-window`
  is declared as a dev dependency and ships anyway, pulled in through the offline-support
  registration in `apps/web/src/pwa.ts`. So does the rest of the service-worker stack, and
  so does `idb`, which no manifest in this repo declares at all. Everything involved is
  permissive, so nothing is wrong today — but any check written over production
  dependencies would have a hole exactly the shape of the code that ships.
- **Nothing checks any of this.** `gate:license`, `gate:license-copy` and `gate:notices`
  were each read in full; none of them looks at `node_modules`. Every licence check in this
  repo is about vendored *data*. A copyleft transitive dependency could arrive tomorrow and
  no gate would say so.

## What do the vendored corpora actually contribute, and what dies without each?

Six vendored sources, and their replaceability is almost inverse to their licence quality.

| Source | Terms | Shipped weight | What ends without it |
| --- | --- | --- | --- |
| KFGQPC page artwork | The Complex's own grant | 26.7 MB gz — 94% of the payload | There is no app |
| Ligature corpus (word geometry) | Use, modify, distribute, commercial; attribution not required | 885 KB gz | Word selection and word geometry |
| Arabic Corpus morphology | GPL, plus a no-changes clause | 518 KB gz | The root lens; word-level hop refinement degrades |
| Tajweed spans | CC BY 4.0, by one README sentence | 242.6 KB gz | The tajweed colouring |
| Mutashabihat pairings | "Free to use as you see fit"; no licence file | 73.6 KB gz | The hop — 3,002 edges become 22 |
| Structural metadata | CC BY 3.0 | Numbers only, hand-carried into code | Nothing at runtime; the check that they are right |

**The corpus with the friendliest terms has the worst replacement story.** Rebuilt without
the mutashabihat pairings, the hop falls from 3,002 edges on 1,521 ayahs to **22 edges on 8
ayahs** — a 99.3% loss of the reason this app exists. Its licence is one README sentence
and it carries an undocumented third-party provenance behind that. Nothing about that is
comfortable, and no alternative improves it.

**The corpus with the hardest terms is doing two unrelated jobs.** The morphology is read
for root and lemma annotation, and — entirely separately — as a word-segmented text of the
Quran. Everything the adjacency tree owes it comes from the second job only: the shared
word runs are computed over reconstructed word skeletons and never touch a root tag.

That matters because **a permissively-licensed substitute for the second job is already
vendored and already read at build time.** The ligature corpus carries per-word text under
a grant allowing use, modification and distribution for any lawful purpose including
commercial, with attribution not even required, and the tajweed fold already reconstructs
ayah text from it at 99.86% against an eighteen-rule oracle.

So the adjacency tree could plausibly stop being a copyleft derivative without losing a
feature, by computing its shared runs over the print's own words. It would also delete the
index-conversion step, because the runs would already be in the only index a word box
carries. **What nobody has measured:** the print splits 9,533 proclitics that the morphology
joins, so run lengths change and the uniqueness rule would keep a different number than
2,544. That is an ETL measurement, and until it is run this option has no cost attached and
cannot honestly be drawn on an options page.

The root lens has no such escape. Dropping the morphology entirely removes 1,642 roots,
4,644 lemmas and 44,431 root-ayah pairs, and degrades word-level hop refinement from 15.3%
unplaced to 100% unplaced. **The hop itself survives.** No replacement root corpus exists
(below), and there is no check on root correctness at all, so a wrong root would produce a
plausible lens entry nobody could tell from a right one.

## Where do somebody else's terms reach a file nobody would expect?

This is the lane that found things. Each row below was verified by counting shipped bytes.

| Output | A reader would assume | Actually carries | Known before? |
| --- | --- | --- | --- |
| Adjacency word ranges | Pairings only | Morphology, GPL — 2,544 of 3,002 edges | Yes, fixed 2026-08-16 |
| Adjacency page fields | Pairings and morphology | Page-corpus-derived table — 3,002 of 3,002 | Yes, open |
| **Root shard page numbers** | Morphology only | The same page-derived table — **44,431 of 44,431 occurrences, all 604 pages** | **No** |
| **The asset manifest** | Not covered by any row of the licensing map | The complete 6,236-entry page table, byte-identical to the vendored file | **No** |
| **Adjacency juz flags** | Pairings and morphology | Structural metadata, CC BY — **510 of 3,002 edges** | **No** |
| **The app bundle itself** | No scripture anywhere — this project states that as a rule | Twelve verses, hand-typed, fully vowelled — **1,414 characters, in the build made today** | **No** |
| **The transliteration table** | Our own plumbing | A table its own comment calls copied verbatim from the copyleft corpus's website | **No** |

Five of seven had never been recorded, and the manner of each miss is the finding:

- The root shards were **asserted not to carry a page number**, in a comment in the gate
  that checks exactly this, written the day before this audit. Every occurrence tuple
  carries one, and the builder's own header says so. The gate defers this identical
  question to an open issue for the adjacency tree and answers it wrongly for the root
  tree. Whatever the pagination opinion turns out to be, **it applies to more than one
  tree**, which is the part the open issue is currently scoped too narrowly to say.
- The asset manifest is not in the licensing map's table at all. The table names the four
  asset directories; the manifest sits beside them, at the root, matching no row.
- The juz flags are **invisible to the trace by construction**. The gate does not follow
  imports into the shared core package, and its own header says so. This is the first
  demonstration that the stated blind spot is a real one and not a theoretical one.
- The twelve verses are the one that should not have been possible. They are dealt with
  under [what we hand people](what-we-distribute.md), because the fact that matters about
  them is that they *go out*, not where they came from.
- The transliteration table is different in kind from every other row: nobody derived it,
  somebody typed it. Every argument this project makes about upstream terms runs through a
  build step, and a table typed into a file goes around that argument rather than through
  it. It is fifty-one letter pairs and it may well be a scheme rather than a work — but the
  question has never been asked, and the comment beside it uses the word *verbatim*.

## How much of each source survives being transformed?

Every argument here rests on the word *derived*, and that word covers two very different
things. Measured, on what actually ships:

| Source | What the transform does | What comes out the other side |
| --- | --- | --- |
| Morphology | Throws away the grammar, keeps the index | **All 1,642 roots**, 4,644 of 4,817 dictionary forms, **all 44,431 word-to-verse links** |
| Pairings | Re-files them and adds word ranges | **All 2,516 pairings**, recoverable one for one |
| Tajweed | Renames eighteen rules into seven, re-files | **60,057 of 60,057 annotations. Nothing dropped.** |
| Page artwork | Nothing — it is passed along | The work itself. This is not a derivation at all |
| Word geometry | Measures where ink sits on the page | Nothing of the source. 91,451 rectangles of our own numbers |

Two of these are **lossless**: a change of filing system, not a summary. Give someone the
tajweed tree and the seven-name mapping and they can rebuild the source. Give them the
pairings tree and they have the pairings. Whatever "derived" means, it does not mean
*diminished* for those two, and any argument that leans on the word should say which row it
is talking about.

The last row is the strongest position this project holds — where ink sits on a printed
page is about as close to a plain fact as this subject offers — and it is also the tree
with no row in the map, no notice, and nothing checking it. **The best-defensible output is
the least documented one**, which is a common shape and worth fixing precisely because the
fix is cheap.

The first row deserves one caveat against itself, because the notice shipped beside it says
the shards carry annotation only and no scripture: **693 of the 4,644 dictionary forms are
spelled exactly like whole words of the text.** A dictionary headword is often the word. On
one reading that is a dictionary and stays one; on another it is 693 words of scripture in a
tree whose notice says there are none. The notice does not distinguish, and neither can we.

## Where does somebody else's work reach our own code?

The licensing map answers this by pointing at the boundary between the app and the data:
the app fetches the shards over the network and never reads a corpus. **That is true** — it
was checked, and there is no read of a vendored file anywhere in the app or the shared
logic. The conclusion drawn from it is that nothing upstream reaches our source.

That does not follow, because the content did not come in over the boundary being guarded.
Somebody typed it. Four routes, worst first:

| What is in our code | Where it came from | How defensible |
| --- | --- | --- |
| Twelve vowelled verses | Unrecorded. Not any source vendored here | **Indefensible as written** — see the other document |
| A fifty-one letter transliteration table | The copyleft corpus's website, per its own comment | Genuinely arguable both ways |
| One hundred and fourteen romanised names | Argued to be proper nouns, source unrecorded | Probably fine; unrecorded is the problem |
| Three hundred and eighteen structural numbers | The share-alike metadata, and **re-derived from it on every build** | Fine, and this is the model |

The last row is how the others should look. Those numbers are checked against their source
by an automated re-derivation every time the project builds, so they are demonstrably facts
verified against a source rather than a block that was copied. That mechanism exists, it
works, and it is applied to exactly one of the four.

The reason this matters beyond tidiness: it decides whether our own code could ever be put
under more permissive terms. Under a strict reading it could not be, as written. Under a
lenient one only the twelve verses are a real problem — and the twelve verses are a problem
under **both** readings, which is why they lead.

## Does moving to a more permissive source solve the store problem?

No, and this is the single most decision-relevant finding in the audit.

The store exposure has been framed as a copyleft problem. It is not — it is a
*downstream-restrictions* problem, and the share-alike family has the same clause.
**CC BY 4.0 §2(a)(5)(B)** forbids applying effective technological measures where doing so
restricts the rights the licence grants, and **CC BY 3.0 §4(a)** says the same in older
words. Store-applied copy protection is such a measure.

[Track B](track-b-native.md) already knows this about the tajweed spans. What this audit
adds is the reach: **every candidate replacement morphology is CC BY**, and the structural
metadata this app already uses is **CC BY 3.0**. Trading the morphology for a "more
permissive" corpus buys nothing at all on the store axis. It would swap one blocked tree
for another blocked tree and cost a feature on the way.

There is a second, quieter finding underneath it. The morphology's no-changes sentence is
**near-verbatim the Quran-text-integrity sentence** from the text project it is built on,
with "this file" substituted for "the Quran text" — and the same clause asks that its
notice be reproduced "in all works derived from" the file, which presupposes derivatives
are permitted. It reads as an inherited text-integrity rule applied to a whole file rather
than a considered restriction on annotation data. That is an argument a lawyer evaluates,
not one this document settles, but it belongs in the record because it materially changes
how hard the hardest blocker is.

Also settled, and worth recording so nobody re-runs it: **the additional-permission route
has no precedent.** The two projects usually cited for it — a messaging app's crypto
libraries and a media player — both got onto stores by *the copyright holder relicensing*
to a weak-copyleft licence, not by bolting a permission onto a copyleft work. A third
frequently-cited project's licence contains a restriction rather than a grant and does not
support the claim at all. And the morphology's copyright now sits with an estate, which is
who such a permission would have to come from.

## What could replace each source?

Three of the five are cleanly solvable. One is solvable by writing it. One is not solvable.

**Structural metadata — solved outright.** A public-domain dedication (the Unlicense) over
a metadata file that is a strict superset of what this app uses: 604 pages, 556 ruku, 240
quarters — which divide into the 60 half-parts the current source is used for — 30 parts,
7 manzil, and 15 prostrations with their obligatory/recommended flags. No attribution, no
share-alike, **no technological-measures clause**. This removes an exposure the repo had
not counted as one, and it costs a build step.

**Tajweed — a real alternative exists, with an adoption risk stated plainly.** An MIT-licensed
engine ships a corpus-free core of about 34 KB: no annotation data and no Quran text is
vendored at all, the output is the same codepoint-range shape, and it **models pause**,
which a precomputed span dataset structurally cannot — a functional upgrade for an app
whose reader stops mid-page. It agrees with the current source at 99.80% across all 6,236
ayahs, with every divergence catalogued. Against that: it was created five weeks ago, is at
version 0.1.1, has two stars and one author. It is MIT, so vendoring the core outright is
permitted and is the obvious mitigation.

The incumbent is also worse than the record says. Its grant is one README sentence covering
*"this data file"*, singular — the classifier that generated it carries no licence at all,
so "just regenerate it ourselves" is **not** an available escape.

**Page geometry — already better than assumed.** The overlay project's own licence splits in
two, and the part this app uses — the ayah hit polygons and per-page geometry — is
**dedicated to the public domain**. The artwork grant beneath it reserves only commercial
*physical printing*, and has no technological-measures clause and no copyleft. The standing
caveat holds: the Complex's own site refused connection again, so that grant is still read
secondhand, which is an open confirmation item this repo already tracks.

**Mutashabihat — write it.** No licensed alternative exists. The largest candidate is bigger
but its data licence is unstated, so adopting it swaps an unstated licence for an unstated
licence. Repeated word runs over the consonantal text are mechanical, and the curation —
which pairs actually trip a hafiz, and the note saying what differs — is the genuinely
authorial part, authored here. That is the strongest licence position available for any
source in this repo. Nobody appears to have published such a pipeline.

**Roots — not solvable.** No complete, permissively-licensed, root-bearing morphology exists
that is not derived from the one already vendored. Four projects come close and each fails
on a different axis: two carry no roots at all (lemma and part-of-speech only); one has
roots but is unreleased pending peer review with no licence announced; and the obvious
lemma-to-root lexicon that would complete the join is published under a **no-derivatives**
grant on the page it is actually downloaded from, which would forbid the join. The
ecosystem norm is the finding: a search for root datasets returned fifteen repositories and
**every one of them was unlicensed**. The only fully permissive route is an algorithmic
stemmer, trading accuracy — against a feature with no correctness check to catch the trade
going wrong.

## Which of these could check our work rather than replace it?

Every source above was assessed as a candidate *replacement*, and that framing threw away
most of their value. A corpus this project cannot ship can still be read at build time, and
**reading a corpus to check a number is a different act from distributing it** — the
tajweed engine named above establishes the pattern from the other side, verifying itself
against a share-alike dataset it does not ship, so no obligation attaches to what it hands
a user.

This matters here because the strongest results this project has came from a second
witness, not from a better first one. The structural tables are hand-typed constants and
are checked by re-deriving them from a vendored file, because that class of error is
invisible — every number stays in range, the list stays ascending, and one corpus shipped
off by one for four loops. And the page-geometry bug on the second-to-last page was
invisible to the check designed for it: the ink was covered, just by the wrong ayah's
polygon, and only a second independent print of the same mus'haf could see it.

Three places where the audit found a witness and nothing is using it:

**The page table has one witness, and a public-domain second one exists.** The table of
which page each ayah falls on is the single most load-bearing derived artefact here — it
reaches three shipped outputs, and whether it carries its source's terms forward is the
open question everything else is waiting on. It is currently derived from one upstream and
corroborated by nothing. The public-domain metadata file named above carries a page number
per ayah, compiled independently. If the two agree across all 6,236, that is worth having
twice over: it is a real correctness check on a table nothing checks today, **and** two
independent compilations agreeing is what a fact about a printing looks like, as against an
authored arrangement — which is the substance of the question being asked. If they
disagree, that is more valuable still and nobody currently would ever find out.

**The word-segmentation disagreement has two witnesses and both are parties to it.** Whether
the shared word ranges can be recomputed from the print turns on 9,533 places where the
print splits a word the morphology joins. Today there are exactly two opinions on that and
they are the two being compared, so a disagreement says only that they differ, never which
is unusual. Two independently annotated corpora surfaced by this audit carry word
segmentation and are not derived from the morphology — neither has roots, which is why both
were set aside as replacements, but segmentation is precisely what they do have. A third
and fourth opinion turns an undecidable comparison into a measurement, and that measurement
is the thing blocking the cheapest licence improvement available.

**Nothing measures what the hop misses.** The pairings corpus is deliberately not
exhaustive — it is the pairs that most commonly confuse huffaz, and that curation is the
reason to prefer it. But there is no number anywhere for what it leaves out, so "3,002
edges" cannot be read as good or bad. A larger curated collection exists whose data licence
is unstated, which rules it out as a dependency and rules it in as a ruler: comparing
against it yields a recall figure without shipping a byte of it. That number would say more
about whether the hop is finished than any other measurement available.

Two limits worth stating rather than discovering later. Validation use is *lighter* than
distribution, not exempt — a no-derivatives grant still governs what may be published from
a comparison, and a repository with no licence at all grants nothing, so nothing of this
kind gets vendored into this repository or shipped. And a second witness that turns out to
be derived from the first is not a second witness; the audit already found that trap, in a
project whose annotations were partly scraped from the corpus it claimed to be independent
of, so provenance has to be established before agreement means anything.

**A third limit, and it is the one that changes how this work should be done.** The research
lane turned up a rule that runs against the whole instinct behind these three ideas: **a
published agreement report can be the evidence against you.** The case that establishes it
is a chip-cloning dispute where the cloner's independently-built part was found to contain
instructions matching ones the original had *deleted* — the court's line was that
unnecessary agreement suggests copying rather than independent creation, and it sits in a
long line of "the shared mistakes are the strongest proof" reasoning. So a report saying
*we recomputed this without the corpus and got 99% the same answer* is, on that authority,
an argument that we copied it.

The way out is not to stop measuring. It is to be careful **which axis** the agreement is
published on, and the model is the metrically-compatible typefaces: they prove they match on
the measurements, which are compelled and not protectable, while looking visibly different
everywhere the designer had a choice. **Prove agreement only where the mus'haf compels the
answer; where the annotator exercised judgement, divergence is the useful result and it is
free to produce.**

Concretely for the three above: page-table agreement is agreement about where ink physically
sits in a printed book, which is the compelled axis and exactly the right thing to publish —
and it is *also* the substance of the open question, since two independent compilations
agreeing is what a fact looks like. Segmentation and recall are the opposite: they are
someone's editorial judgement, so the number is worth computing and worth acting on
internally, and a triumphant published diff against the corpus is the thing not to write.
Worth noting that the research found **no clean-room project anywhere has ever published an
agreement report**, which nobody had explained before and this now explains.

## What this audit did not look at

- **Whether a root, a lemma, or a table of which page an ayah falls on is copyrightable
  expression.** That is the opinion this project is already waiting on. This audit adds
  rows to its scope and answers none of it.
- **Whether the app still behaves correctly with a tree removed.** The "N of M is lost"
  figures are counts over shipped bytes, not observations of a running app.
- **The accuracy of any hypothetical in-house stemmer.** There is no probe for it and none
  was invented.
- **Whether upstream terms have changed since they were vendored.** The audit of the
  vendored corpora read this repo's own quotations of them; the alternatives lane read live
  sources for the *replacements* but did not re-verify the incumbents.
- **Anything about the validation pages.** They embed real page ink and carry no notice, but
  they are excluded from the repository and whether they are reachable by anyone but the
  reader they were built for was not determined.

## Open questions, and what would answer each

### ① Whether the pagination question covers three outputs rather than one · **open**

The open question about the adjacency shards carrying a page-derived table is scoped to one
tree. This audit found the identical table reaching **two more** shipped outputs — every one
of 44,431 root-shard occurrence tuples, and the asset manifest verbatim at 6,236 entries.
The licensing opinion being awaited is the same opinion; only its scope is wrong.

**What would answer it:** the opinion already requested, asked about all three outputs
rather than one. Nothing in code changes until it arrives, but the notice and the licensing
map both understate their subject until it does.

### ② The gate states a fact about the root shards that is false · **answered**

The notices gate declares the page table as this project's own for the root bucket, on the
stated ground that no page number reaches a root shard. Measured: **44,431 of 44,431
occurrence tuples carry one**, matching the vendored table on every one, spanning all 604
pages. The builder's own header says it doubles as the page table.

A gate asserting a falsehood is worse than no gate, because it is read as having checked.

**What would answer it:** change the declaration to defer to ① as the adjacency bucket
already does, so the exemption expires when the question closes. Independent of the opinion.

*Closed 2026-09-01, by reading the gate rather than this page.* The declaration was changed
the day after the audit: the roots bucket's read of the page table now defers to ①, in the
same words the adjacency bucket uses, with the false sentence quoted beside the deferral so
the drift stays visible. This item then sat marked confirmed for two weeks, which is the
failure the issue catalogue was built to catch and did not, because the marker and the code
are compared by nobody. It is *answered* and not *fixed*: the deferral itself is guarded — the
gate fails if the question it defers to closes or disappears — but nothing would fail if
someone flipped the verdict back to "ours", and a word that claims a test has to name one.

### ③ Structural metadata reaches the adjacency shards and nothing names it · **open**

**510 of 3,002 shipped edges** carry a same-part flag computed from the CC BY structural
tables. Neither the licensing map's row nor the shipped notice names that upstream. The
trace cannot see it: it does not follow imports into the shared core package, by design and
by its own admission — so this is the blind spot the gate declared, demonstrated.

Attribution rather than copyleft, and the app does credit the source in its colophon, so
the exposure is small. The precedent is not: **a builder can reach a new upstream through
the core package and nothing will notice.**

**What would answer it:** name it in the row and the notice; and decide whether the trace
should follow the core package, which is a real design question because that graph is large
and mostly uninteresting.

*Half closed 2026-09-01.* The row and the notice now name Tanzil: the adjacency bucket in
the notices gate declares the structural metadata as a third source by hand, so the row's
"whose" cell and the shipped notice must both carry the name or the gate fails, and the
adjacency builder writes a paragraph into the notice saying what the flag is derived from.
What stays open is the other half — the trace still does not follow the core package, so the
hand-written declaration is the only thing standing between the next upstream reached that
way and silence. That is a design question, not a defect, and the marker says so now.

### ④ Two shipped things are covered by no row of the licensing map · **fixed**

The manifest ships the complete 6,236-entry page table, byte-identical to the vendored
file. The licensing map's table names four asset directories; the manifest sits at the root
beside them and matches none of them.

**Widened 2026-08-16.** There are six things shipped and the map has rows for four. The
second uncovered one is the word-geometry tree — 604 files, 2.8 MB, shipped since the
seventh loop — which has no row, no notice, and no mention in either register. It is the
tree with the *least* to worry about, and that is exactly why nobody wrote it down.

The manifest is the more urgent of the two for a reason unrelated to its terms: it is stored
on the visitor's device the moment they install the app, while the artwork it was derived
from is only stored when they actually open a page. **The derived table travels further than
the thing it was derived from.**

And the check that exists to catch this cannot: it compares two hand-written lists against
each other and never looks at what is actually in the folder. Anything absent from both
lists is invisible to it by construction, which is why two trees could ship uncovered for
loops without a single failing build.

**What answered it, 2026-08-16.** Both have rows now. The word tree is ours, and the map says
why in a paragraph of its own: no byte of the print those rectangles were fitted from ships,
and the grant behind that print obliges no attribution, so the credit in the colophon is a
courtesy the record marks as one. The manifest is ours too, with the one thing it cannot yet
settle stated rather than glossed — the page table inside it is the same table, and the same
question, as ①.

And the check reads the folder now. Every entry under the shipped assets directory has to be
either a declared tree or a named declaration, and the map has to mention it either way. It was
broken on purpose both ways before being left green — an empty directory added, and the word
tree's row removed from the map — because a check that has only ever passed is a comment.

### ⑤ Nothing checks the licences of the installed package tree · **open**

Every licence gate here is about vendored data. The package tree is unchecked, and the
audit that checked it by hand found it clean — which is the good time to add the check
rather than the bad one.

**What would answer it:** a gate over the licences of what actually *ships*, not what is
declared as a production dependency, since the offline-support package is declared for
development and ships anyway. It would need a proof that it can fail, per the convention
the notices gate set.

### ⑥ Whether to move the structural metadata to a public-domain source · **open**

A superset of what this app uses exists under a public-domain dedication, with no
attribution and no technological-measures clause. The current source is CC BY 3.0, whose
§4(a) carries the same store exposure as the tajweed spans.

**What would answer it:** this is a decision, not a task, and belongs in the decision
register with its options drawn — the numbers agree, so the choice is about trusting a
compiler's dedication versus a named project's licence.

### ⑦ Whether to compute the adjacency word ranges from the print instead · **open**

If the shared runs were computed over the print's own words rather than the morphology's,
the adjacency tree would stop being a copyleft derivative and the index-conversion step
would disappear. The substitute corpus is already vendored under the friendliest terms in
the repo.

**What would answer it:** run the measurement. The print splits 9,533 proclitics the
morphology joins, so the uniqueness rule keeps a different number of runs than the current
2,544 — and until somebody knows whether that number is 2,400 or 900, this option has no
cost attached and cannot be drawn honestly.

### ⑧ Whether the tajweed spans should move to a pause-aware engine · **open**

An MIT engine with a corpus-free core would mean vendoring no annotation data and no Quran
text, agrees with the incumbent at 99.80%, and models pause, which the incumbent
structurally cannot. It is also five weeks old with one author, and the incumbent's
regeneration path is closed because its classifier carries no licence.

**What would answer it:** a hafiz's judgement on the 108 catalogued divergences, which is
the same judgement the colouring is already waiting on — and a decision about depending on
something this new, which vendoring the core would largely dissolve.

### ⑨ The page table is derived from one source and corroborated by none · **open**

The table reaches three shipped outputs and sits at the centre of ①, and nothing checks it.
A metadata file under a public-domain dedication carries a page number per ayah, compiled
independently of the corpus this project derives its table from.

**What would answer it:** compare the two across all 6,236 ayahs. Agreement is a correctness
check on an unchecked table and evidence bearing on ① — two independent compilations
agreeing is what a fact about a printing looks like. Disagreement is worth more and would
never otherwise surface. The source is public domain, so nothing about this is constrained.

### ⑩ The segmentation disagreement has no disinterested witness · **open**

Whether ⑦ is possible turns on 9,533 places where the print splits a word the morphology
joins. The only two opinions are the two being compared, so a disagreement cannot say which
is unusual. Two corpora surfaced by the audit annotate word segmentation independently of
the morphology — both were set aside as replacements for having no roots, which is
irrelevant to this use.

**What would answer it:** segment agreement between each pair, over the disputed positions
only. It converts ⑦ from an argument into a measurement, and ⑦ is the cheapest licence
improvement available. Both are share-alike, so they can be read at build time but must not
be vendored here or shipped. Provenance first: one project the audit examined claimed
independence while having partly scraped the corpus it was being compared to.

### ⑪ Nothing measures what the hop does not contain · **open**

The pairings corpus is deliberately not exhaustive and that is the reason to prefer it, but
no number exists for what it omits, so 3,002 edges cannot be read as sufficient or thin. A
larger curated collection exists under an unstated data licence — unusable as a dependency,
usable as a ruler.

**What would answer it:** a recall figure against it, computed at build time, shipping
nothing. It bears directly on whether the hop is finished, which no other measurement here
speaks to.

### ⑫ A table in our own code is described in its own comment as copied verbatim · **fixed**

Fifty-one letter pairs, used to turn the corpus's ASCII spellings back into Arabic, sit in
one of our build scripts under a comment naming the copyleft corpus's website as the source
and using the word *verbatim*. Every other claim this project makes about that corpus runs
through a build step and rests on the shards being derived rather than copied. This one goes
around that argument, because it is not derived from anything — somebody typed it in.

It may well be fine. The scheme it encodes was published by someone else years before the
corpus adopted it, it has very few ways it could reasonably be written given that it has to
be typeable and reversible, and a mapping between two alphabets is close to an idea. But
that is an argument nobody has made, and the comment as written concedes the opposite.

**What answered it, 2026-08-16.** The comment did. It named the corpus's own web page as the
source and used the word *verbatim*, and neither was the right description of what is in the
file. The scheme is the original publisher's, released with a widely-used morphological
analyser; the rows past the plain letters are its ASCII-safe variants together with the extra
symbols the corpus needs for a mus'haf's pause, madd and small-letter marks, which the corpus
documents. What sits in our script is a correspondence between two alphabets that has to match
theirs exactly or the roots come out wrong — a constraint, not a copy. The comment says that
now, and the concession it used to make is gone. Whether our code could be put under more
permissive terms at all is still ⑭'s question; this closes one of the four routes it turns on.

### ⑬ The artwork pipeline is documented as applying two changes and applies three · **fixed**

The register says the page pipeline applies exactly two declared changes; the pipeline's own
header says three, and all three are real — an optimiser that rewrites every coordinate at
reduced precision, two identifier repairs, and **23 shape repairs across 19 pages**. The
licensing map separately calls the artwork reproduced unmodified, which at reduced coordinate
precision it is not.

This is worth more than a typo, for one specific reason. The whole answer to the corpus's
no-changes clause is that this project vendors upstream files untouched and derives at build
time. That answer depends on *vendored verbatim* being a practice a reader can trust. A
second tree that says verbatim and is not undermines the practice rather than the tree — the
artwork's terms are not the corpus's terms and nothing here breaches them.

**What answered it, 2026-08-16.** Both sentences say three and list them — the optimiser at
its pinned settings, the two identifier repairs, and the twenty-three shape repairs across
nineteen pages, with what each is for. The register says outright that it claimed two for as
long as there were three, and that the pipeline's own header was right throughout. The
licensing map no longer calls the artwork unmodified; it says what is applied and keeps the
promise that was actually being made, which is that nothing is hand-edited — and that is the
promise the corpus's no-changes clause rests on, so it comes through the correction intact.

### ⑭ Whether our own code could be put under more permissive terms at all · **open**

Worth separating from every other question here, because it is the one somebody may want an
answer to for reasons that have nothing to do with app stores — a reader wanting to build a
different mus'haf on this engine, for instance. The map's stated reason to think the answer
is yes rests on a boundary that the content did not cross. What actually decides it is the
four typed-in routes above.

Note what the choice is not. Moving our code to permissive terms does nothing about the data,
and permissive code sitting beside copyleft data in one deploy is precisely the unresolved
question of whether the two are one work or two things shipped together. It is also worth
knowing that a middle option exists and is usually skipped: terms that keep changes to *our*
files coming back while letting somebody embed the engine in something closed. If the motive
is "let people use this" rather than "let people take this", that is the shape that fits.

**What would answer it:** ⑫ resolved, the twelve verses removed or sourced, and then a
licensing opinion — which is the same opinion ① and the store question are already waiting
on, and worth asking as one question rather than four.
