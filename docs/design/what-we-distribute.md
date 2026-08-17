# What do we actually hand people, and through which door?

A licence governs *conveying* — handing someone a copy. So the question "may we ship this?"
has no answer until you say **ship through what**. This project already hands things to
people through two different doors with substantially different contents, and the licensing
map describes only one of them.

This document is about the shape of what gets distributed, as distinct from
[what we depend on](what-we-depend-on.md), which is about where the inputs come from. The
two are easy to confuse and the confusion is expensive: an input's terms constrain the door
it goes through, not every door.

Related: [the licensing map](../../LICENSES.md) is the register this affects;
[Track B](track-b-native.md) is where a third door is being considered.

---

## Which doors are open, and what goes through each?

Measured on the current branch, 2026-08-16.

| Door | What goes through it | Vendored corpora included? |
| --- | --- | --- |
| **The repository** — public, cloneable | 17 vendored input files, 12.3 MB, verbatim; every builder; all our code | **Yes, all of them** |
| **The deployed site** — public, fetched by browsers | ~100 MB of derived assets; the app bundle at 118.3 KB gz | **No. None of them.** |
| **A store binary** — does not exist yet | Would be the site's contents, wrapped | Would inherit the site's answer |

The two live doors carry almost disjoint content, and **that is the fact the whole question
turns on.**

The two most awkward inputs — the morphology corpus at 6.3 MB under a copyleft grant with an
added no-changes clause, and the tajweed annotations at 5.6 MB under a share-alike grant —
are tracked in the repository and **never reach a browser**. What reaches a browser is
derived: 518 KB gz of root shards, 242.6 KB gz of tajweed spans, 73.6 KB gz of pairings, and
26.7 MB gz of page artwork.

Also worth stating because it is easy to assume otherwise: the largest thing this project
reads does not go through either door. The word-geometry work reads a 378 MB page cache that
is excluded from the repository, so it exists only on the machine that built it. It is
already, incidentally, exactly the pattern this document is about.

## Which door does each obligation actually attach to?

Separating the doors makes several previously tangled obligations fall apart cleanly.

**The copyleft obligation is discharged by the repository door, not the site door.** The
requirement is that corresponding source reach the people receiving the derived shards. The
repository carries the builder and the pinned input it derives from; the site tells a
reader where the repository is and pins the commit it was built from. This is already how
`LICENSES.md` argues it, and the door framing is why the argument works: the shards go
through one door and their source through another, and the obligation is satisfied by the
pair, not by either alone.

**The store blocker attaches only to the third door.** Both blocking clauses — the
copyleft licence's prohibition on imposing further restrictions, and the share-alike
licence's prohibition on applying technological measures — are triggered by something the
distribution channel does to the recipient, not by anything the data is. The same bytes go
through the site door today with no such problem, and would go through a store door with
one. **Nothing about the data changes; the door changes.** This is why the audit's
conclusion that swapping to a "more permissive" source does not help is correct — the
problem was never the source's permissiveness.

**The verbatim-vendoring strategy is a door decision that was already made.** The repository
carries each corpus unmodified and derives at build time. That satisfies the no-changes
clause on the repository door, and means the site door carries no copy of the corpus to
satisfy anything about. It was recorded as a way to honour two contradictory readings at
once; it is also, in this framing, the first deliberate separation this project made.

## What goes out through the site door that nobody counted?

Having drawn the doors, the obvious next question is whether the inventory of each one is
right. It is not. Three things go out through the site door that no register here mentions,
and one of them contradicts a rule this project states in twenty different files.

**Twelve verses of scripture are in the app itself.** Not in a data file — in the code,
hand-typed, fully vowelled, forty-eight fragments and 1,414 characters of Arabic. Every one
of them was found byte-for-byte in the build made today. They are not left-over: two live
parts of the app render them, so they survive into every visitor's browser.

The rule they contradict — that no Qur'anic text enters this project — is stated **22 times
across 20 files**, including three of the notices that ship beside the asset trees and a
settled decision where it is the entire answer to a no-derivatives clause. It is the most
repeated factual claim in this repository and it is false.

Two things make it worse rather than better. **Nothing checks it**: the only gate whose name
suggests it might is about something else entirely — that the page drawings use outlines
rather than live text, which is a rendering requirement, not a licensing one. And the
spelling used is not the spelling any corpus here vendors, so the text did not come from any
of them. Where it did come from is unrecorded; the comment above it says only that it is
demonstration data from the third loop, hand-verified, awaiting replacement by a real source
that never arrived.

This is the only finding in either document that is a defect under every reading of every
licence involved, and it is also the cheapest to fix: the feature is a leftover demonstration
serving two popovers, and the text can be removed or re-sourced without anyone noticing.

**Two shipped trees are covered by no row of the licensing map** — the word-geometry tree and
the asset manifest — and the check built to catch that cannot see them, because it compares
two hand-written lists to each other and never reads the folder. That is carried under
[what we depend on](what-we-depend-on.md), item ④.

The shape all three share is worth naming, because it is the argument for organising the map
by door in the first place: **each one is something that goes out, found by looking at what
goes out.** No amount of reading the map would have produced any of them.

## What separation buys, and what it cannot buy

The reason to be careful here is that the same manoeuvre is sound in one direction and
wishful in the other.

**What it genuinely buys.** If an encumbered input is read only to *check* an output, and
never to produce it, the output is not derived from it in any sense and the input goes
through no door at all. The audit already relies on this: three corpora that cannot be
depended on are nonetheless usable as instruments, and the tajweed engine surfaced there
does exactly this from the other side — it verifies itself against a share-alike dataset it
does not ship, so nothing attaches to what it hands a user. **A validator is not a
dependency.** That distinction is real and this project should use it much harder than it
does.

**What it cannot buy.** Moving the *production* of an artifact behind a door does not make
the artifact unencumbered. If a shard is computed from a corpus, it is computed from that
corpus whether the computation happened on a build machine, in a separate repository, or in
somebody else's continuous integration. Build-time derivation changes who holds a copy of
the input; it does not change what the output is made of. This project's derived shards
carry terms forward precisely because that is true, and any argument that starts "but the
corpus never ships" has already been answered — the notices shipped beside those shards
exist because it was answered.

So the honest form of the technique is narrow and worth stating in one line: **separation
helps when the encumbered thing is an instrument, and does not help when it is an
ingredient.** Every candidate manoeuvre should be tested against that sentence first.

**And the research sharpened it in a way worth having.** Every organisation that has written
this down draws the line in the same place, and it is not where the intuition puts it:
**nobody treats "it is only used for testing" as a category that means anything.** The
category every one of them actually uses is **"it is not handed to anybody"**, and build or
test scope is just a convenient stand-in for that. One large company's policy proves it by
contradiction: it permits the copyleft licences internally because their obligations bite
only on things delivered to outsiders, and then bans outright the one variant whose
obligation is triggered by network use instead — same data, same internal use, opposite
answer, because the trigger moved.

That is the same claim this document already makes about doors, arrived at independently,
and it means the instrument/ingredient test is really a proxy for a blunter question:
**does a copy leave?** Which is worth knowing, because the moment a manoeuvre is judged on
whether a copy leaves rather than on what the thing is called, most of the clever ones stop
being available.

## What are the established ways of doing this?

Surveyed, against primary documents rather than summaries. Each one below comes with what
defeats it, because a technique recorded without its defeat is not research. **None of this
is legal advice, and the survey has real holes, listed at the end.**

The single most useful thing it produced is a **better test than the one this document had.**
The instrument-and-ingredient line is right but it is hard to apply, because "did this input
contribute?" answers *yes* for everything and decides nothing. The test that six separate
bodies have independently converged on is sharper:

> **Can somebody recover the input's protected content out of the thing you handed them?**

Not *did it come from there* — **can you get it back out**. That is the question being asked
by the map-data community's rule for telling a finished work from a database, by the US
copyright office and by two European courts about models, and by two of the newer data
licences. They did not coordinate, and the disagreements between them are about outcomes
rather than about the test. Applied here it stops being a philosophical question and becomes
a per-tree measurement — which is exactly what open item ② needs, and it is a measurement we
already have: the tajweed tree is **fully recoverable** and the word-geometry tree contains
nothing of its source at all.

### What each technique is, and what kills it

**Reading something only to check the answer.** The strongest pattern by a distance, and the
only one with something like agreement behind it — one large foundation states it in a single
sentence, and one distribution builds its whole archive layout around the distinction. **What
kills it:** believing the build machine is the boundary. It is not. The pattern is safe
because *no information flows from the input into the output* — a checker reads the corpus
and emits a yes or a no. The moment the check's result changes a single value in what ships,
you have left the pattern and are somewhere else entirely.

**Shipping the recipe instead of the result.** We already do this, and it does real work — it
is what discharges the obligation to make source available. **What kills it** is expecting it
to do more than that: it does not remove terms from the derived trees, which are still made
of what they are made of. And it has one concrete failure mode worth designing against. In a
recipe-only design **the pins and pointers are the only thing you ship, so they are the only
thing anybody examines.** The most instructive case in the whole survey is a takedown aimed at
a project that contained no copyrighted recording at all — the notice pointed at its **test
fixtures**, because the fixtures named specific works. The hosting platform's stated rule is
that it distinguishes code that *can* be used a certain way from code that is
*preconfigured* to be. So: **describe an input by its checksum, not by its address.** That is
strictly safer and costs nothing.

**Conveying the parts separately.** Half-fits. The clause people reach for turns on whether
the pieces are combined into a larger program — a question about how they relate at runtime,
not about which server they came from or who typed the download command. It supports the
door framing at the level of *what conveying means*; it does not supply a manoeuvre.

**Having the reader fetch it themselves.** **Strike this one.** A large project proposed it
for precisely our reason and rejected it, recording objections that all apply here with full
force — no network in some settings, institutional download policies, a major redesign for
nothing. Both mobile stores forbid it outright, which is fatal given that the store is the
only door with a blocker in the first place. And recipes rot silently: one long-running
example already carried *twelve* fallback addresses per file, all twelve were dead, the
report was closed as unreproducible, and nothing anywhere was watching. Where this pattern
does work, it works because **the rightsholder drew the line**, not because the packager did.

**Clean-room rebuilding, and proving a licence-clean replacement agrees.** Surveyed, and the
finding is sharp enough that it has been written into
[what we depend on](what-we-depend-on.md) instead, because it changes the validation plan
rather than the distribution plan: **a published agreement report can be the evidence against
you.** Also worth knowing here: a clean room is *not* required — an appeal court called it
clearly erroneous to demand one — and it protects against neither a patent nor a promise.

### The three defeats that apply to us whatever we choose

**"We ship no bytes of the source" is an argument that has been made and lost.** A publisher
shipped level files for a game containing no art, no code, and no bytes of anyone's work —
numbers only. It lost, because the numbers described the copyrighted result in exact detail;
the court's analogy was sheet music, which contains no sound. The escape the same judgment
leaves open is the useful part: the description has to be **meaningful against something other
than the one work**. That is a real sorting criterion and it splits our trees cleanly. Root
identifiers keyed to a standard scholarly scheme mean something against any Arabic text — on
the safe side. **Page numbers and bounding boxes derived from one specific printed mus'haf
are useful only against that mus'haf** — on the exposed side. Which is a second, independent
reason the pagination question is the one everything is waiting on.

**"They are only numbers" fails when a person decided them.** Two courts have held numbers
protectable because they were *estimates* rather than observations — the reasoning being that
the compiler did much more than discover and report. So the question is never *are these
facts*; it is **did somebody choose, among more than a few defensible alternatives?** A
morphological parse is a judgement. A tajweed span is a judgement. **Where ink physically sits
on a page is an observation** — which is the strongest thing anyone has yet said in favour of
the tree we have documented least.

**Contract beats all of the copyright analysis, and this is the finding that most deserves to
be here.** A court once assumed a database was uncopyrightable *and enforced the licence over
it anyway*, reasoning that copyright is a right against the world while a contract binds only
its parties — so it is not the same kind of thing at all. A European ruling reaches the
matching result from the other side: the user protections that override restrictive terms
apply only to databases that are protected in the first place. **Winning the argument that
something is just facts can strengthen the claim against you rather than defeat it.** Ours is
not a hypothetical: the no-changes clause on the morphology corpus is a term we accepted in
order to obtain it, and whether a downstream recipient could strip it is a *different*
question from whether it binds us. The only judicial word anywhere on stripping such a clause
is an unpublished decision on a different statute, routinely cited for far more than it holds.

### One argument we can make that nobody else seems to have made

Available from the grants we already hold, in their own words. Both the morphology and the
structural metadata require their notice to be reproduced in all works **derived from** the
file. So the terms **contemplate derived works and impose only a notice obligation on them** —
while the no-changes clause attaches, by its own sentence, to *this file*. Those are two
different objects, and the grant itself distinguishes them. This is close to what our own
licensing map already does in practice, and it is worth putting to whoever gives the opinion,
because it is an argument from the text rather than from our convenience.

### What this survey did not cover, and one thing it could not reach

Said plainly rather than papered over, and none of it should be treated as checked.

**Not covered at all:** the app store that builds every submission from source and labels its
encumbrances — which is **the distributor closest to our situation** and the largest hole
here; three other package channels; and one industry licensing standard. **Partly covered:**
how one distribution treats *data* as against *code*, where the archive rule is media-neutral
and the specifically-data material was not reached.

**Unreachable:** the mus'haf printer's own site refused every connection, so their actual
grant is still unread and everything this project says about the artwork's terms still comes
from a third party's summary. This is not a gap in the survey — it is already carried as a
standing human check, on the finding that the host is unreachable from automation at the
network layer rather than behind anything a request could talk past. **The research is now
the third unrelated network to fail the same way**, which has been recorded against that
check; it is the strongest confirmation yet that it will only ever be done by a person with
an ordinary browser. Separately, one licence steward's site was unreachable all session, so
**its positions on build tools are simply absent** from this survey rather than negative —
nobody should later fill that gap from memory.

**Things that appear not to exist**, having been looked for: no decided case anywhere on
whether a positional index of a text is a derivative work; none on morphological or
grammatical annotation of a text; none on bounding boxes or character offsets taken from a
printed page; none on a copyleft grant with a no-changes clause bolted on. **And no
distributor anywhere writes down a legal theory for build-time separation** — every policy
found states the rule and not the reason. That is worth knowing before leaning hard on any of
this: the practice is settled, the theory behind it is nobody's.

### And a discrepancy found in passing

The structural metadata's grant is stated three times on three surfaces and the three do not
match — the terms page names one licence, the download page shows the same permission text
with no licence named at all, and the notice inside the copy we vendored names a *third*,
more restrictive one. Not our defect, but it is the file our own register describes with a
version number, and it bears on the question of moving to a public-domain source. Recorded
against that question rather than opened separately.

## Open questions, and what would answer each

### ① The licensing map describes one door and is read as describing all of them · **confirmed**

The map's table is organised by path, which silently means *the site door* — the derived
asset trees. It says nothing about the repository door, which is where every vendored
corpus actually is and where the copyleft obligation is discharged, and nothing about a
store door. A reader asking "may this be distributed?" gets an answer without being told
which distribution it answers for.

This is not a hypothetical confusion: the audit found the asset manifest, shipped through
the site door, covered by no row at all, and the argument that the corpus never ships is
sound about one door and irrelevant to the question of what the shards are made of.

**What would answer it:** a map organised by door and then by path, so each row says what
goes out, through which channel, under whose terms. No opinion needed; it is a restatement
of facts already established.

### ② Which encumbered inputs are ingredients and which are only instruments · **open**

The distinction above is the whole of the technique, and this project has never sorted its
inputs by it. Some are unambiguous — the pairings and the page artwork are ingredients, the
comparison corpora identified in the audit are instruments. At least one is genuinely
undecided: the morphology corpus is an ingredient for the root lens and, for the adjacency
tree, may be replaceable by an instrument if the recomputation the audit proposes works.

**What would answer it:** classify each input, and for the undecided one, the measurement
already tracked. The classification is cheap and would say immediately which of the
separation patterns are even available.

### ③ Whether a store build should carry every tree · **open**

The store door is the only one with a blocker, and it does not have to carry what the site
door carries. The audit has the feature-loss numbers for omitting each tree, and they are
very uneven — one omission costs a whole lens, another costs colouring and nothing else,
and a third would end the app.

**What would answer it:** this is a decision, not a task, and needs its options drawn
against real feature loss rather than argued. It should not be opened until the
classification in ② exists, because ② may remove the blocker from one of the trees
entirely and change what the options are.

### ④ Twelve verses of scripture go out through the site door · **fixed**

Described above. Forty-eight fragments, 1,414 vowelled characters, in the shipped build,
rendered by two live parts of the app, against a rule stated 22 times across 20 files —
including three shipped notices and the load-bearing sentence of a settled decision.
Provenance unrecorded and not matching any source vendored here. Nothing checks the rule.

**The research raised this from a tidiness problem to the most urgent item in either
document.** A scripture publisher ran a takedown campaign of eleven notices over two months
last year, and roughly half of them were **scoped to a path inside a code repository** —
naming a data directory, and in one case a **test-fixtures directory**. So the thing that
determines the blast radius of a complaint is not what the project is or what the text is
for. **It is which directory the text sits in.** Twelve verses living in the app's own source,
rather than in a data tree with a notice beside it, is precisely the shape those notices
reached — and unlike every other question here, this one does not wait on an opinion from
anybody.

**What answered it, 2026-08-16.** They are gone, and the comparison view they existed to
demonstrate is better than it was. The transcription was never needed: every look-alike pair
already ships with the matching word run recorded on both sides, in the same numbering the
page's own word boxes use, so the panel now crops both ayahs straight out of the printed page
and washes the words outside the shared run. It covers 2,544 pairs where the table covered
twelve, and it fixes a defect the table had all along — the typed spelling was plainer than
the mus'haf on screen, so a reader comparing the two saw different letters in each.

**A second site, which this item did not know about.** The check written for this one was run
over the whole tree before anything was fixed, rather than at the file that motivated it, and
it named a second: a pipeline test holding a four-word phrase as a fixture. It does not ship —
and by the research above, that is not the point. The blast radius follows the directory, and a
test-fixtures directory is one of the places those notices actually reached. Fixed the same
day, by giving the test bare letters, which is all its arithmetic ever reads.

**The check.** A run of three or more consecutive fully-vowelled Arabic words anywhere in the
tree now fails the build. Three is not a taste call: measured across every file, the two
offenders ran to eleven words and five, and everything else in the repository — our own
interface Arabic, the domain words, the single specimen words a pipeline test needs — sat at
one or two. **Nothing at all sat at three or four.** The threshold is placed in a gap the tree
itself provides, and the header records the measurement so a later reader can re-derive the
number rather than nudge it. Single-specimen files are named in an allowlist with a reason
each, so ninety-odd lone vowelled words read as reviewed rather than unnoticed — and the
phrase rule overrides the allowlist, so no entry in it can ever admit a passage.

**The one remaining Arabic that goes out was measured rather than assumed.** Each look-alike
pair ships with a short hand-written note beside it, and some of those notes name the two words
that differ — so they are Arabic, and they cross the site door. They were written here, by us,
to say something the source dataset does not say; and across all 114 shipped shards the check
scores **zero**, because they are written without vowel marks. Not one word in them reaches even
the specimen threshold, let alone the passage one. That is a measurement, not a reassurance: the
same run that named the two offenders was pointed at every shard that ships.

**And the rule itself was rewritten**, in the nine places that stated it without a scope. It
had been *"there is no Quran text in this repo and there will not be"*, which was false about
the repository and true about the thing it was defending. It now says that nothing this project
vendors and nothing it ships is Quran text, and every site names the check. The settled decision
that leans on it was re-read as this item asked: its sentence is about what the shards emit,
which was scoped and true throughout, so nothing there needed to move.
