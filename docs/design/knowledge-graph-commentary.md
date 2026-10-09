# Folding meaning into the app: context, commentary, and a graph of what a verse is about

> A design of record for how the app could carry not just *where* a verse is and *what it
> sounds like*, but *what it means* — the surah's introduction, the scholar's note on the
> verse, the other verses that note points to, and a map of verses that are about the same
> thing even when they share no words. Read it before adding any of those.

**Status:** open design. Nothing here is decided. It is written now because a large source
of this material has been prepared next door (see "What already exists to build on") and the
owner asked how it could be brought in. It proposes a shape and lays out the choices with
their costs; the choices themselves are left open, and several genuinely hard ones are
flagged as such. Where it reports what exists it says so; where it proposes, it marks the
options.

This restates nothing that already has a home. The tafseer question — *whether* the app
shows a scholar's explanation of a verse and *where that text comes from* — is already
decided; see [`tafseer.md`](../decisions/tafseer.md). The look-alike graph the app hops
along today is recorded in [`loop-2.md`](../decisions/loop-2.md) and
[`loop-4a.md`](../decisions/loop-4a.md). This document is about the layer above all of
that: treating the whole thing as **one map of the book** and asking what else could hang
on it.

## A few words, defined once

- **Verse (ayah)** — one numbered sentence of the Qur'an. 2:48 is the forty-eighth verse of
  the second surah.
- **Surah** — a chapter of the Qur'an. There are 114.
- **Tafseer / commentary** — an explanation, written by a scholar, of what a verse means.
- **Surah introduction** — a short essay at the head of a chapter: when it was revealed,
  what it is about, how it hangs together.
- **Cross-reference** — a pointer a commentary makes from the verse it is discussing to
  another verse elsewhere in the book ("compare 27:30"). It is the author's own link.
- **The map (the knowledge graph)** — the app's picture of the whole book as *places* joined
  by *roads*. A place is a verse (and what is known about it); a road is a reason two verses
  belong together. The app already has one kind of place and one kind of road; this document
  is about adding more of each. "Map" and "the graph" mean the same thing here.
- **A road's kind (edge type)** — *why* two verses are joined. "They sound alike" is one
  kind of road; "the commentary on one points at the other" is another; "they are about the
  same thing" is a third. The app already keeps roads of different kinds apart, so a reader
  can follow one kind at a time.
- **Meaning-fingerprint (embedding)** — a way to turn a piece of writing into a long list of
  numbers such that two pieces about the same thing get similar lists, even when they use no
  words in common. It is made by a language model and is **not** the writing itself; you
  cannot read the original back out of it. It is the tool this document proposes for finding
  verses that are about the same thing.

## What is this document deciding?

Five threads, which the owner named, and which turn out to be four kinds of one thing:

1. **A surah's introduction**, brought into the app at the head of the chapter.
2. **A verse's commentary**, surfaced at the verse.
3. **The cross-references the commentary already makes**, turned into roads a reader can walk.
4. **Per-verse panels ("ayah plugins")** — a way for context, commentary, links, audio and
   whatever comes later to reach a verse through one shared slot rather than each being wired
   in by hand.
5. **A map of verses that mean the same thing** — the app's *own* roads between verses that
   are about the same subject, built by the app, walkable in the reading view, and different
   from both the look-alike roads (which are about *sound*) and the cross-references (which
   are the *author's* links, not ours).

The unifying claim, and the thing this document is really asking the reader to accept or
reject: **these are not five features. They are two kinds of content and two kinds of road on
one map, delivered through one slot.** Introductions and commentary are *what a place holds*.
Cross-references and meaning-roads are *two kinds of road between places*. Plugins are *how
any of it reaches the verse*. If that framing is wrong, the rest is built on sand, so it is
the first thing to disagree with.

## Why is this being asked now?

Because the raw material for four of the five threads has just been prepared, and until it
existed the question was hypothetical. A sibling project has captured a full commentary of
the Qur'an — every surah, every verse — into machine-readable files, including the
cross-references the commentary makes. That capture is what makes threads 1–3 buildable
rather than imagined, and it is the natural seed for thread 5. See the next section for
exactly what is in hand.

There is also a standing invitation in the app already. When the hop feature was built, the
list of *kinds of road* was written down with room left in it: alongside the look-alike roads
that work today, the app reserved a slot named for meaning-roads and a slot named for
commentary, "present so activation is a status flip, not a rebuild" (see
[`loop-2.md`](../decisions/loop-2.md)). Threads 4 and 5 are, in part, the bill for that
foresight coming due.

## What happens if nobody decides?

Nothing breaks, and this can sit for a long time. The app navigates and marks the mus'haf;
none of that needs meaning. The commentary capture next door is not going anywhere, and it
improves whether or not the app reads it. The reserved slots render nothing and cost nothing
while empty.

The one thing that erodes is cheapest to protect now: **if commentary, context and links each
get wired into the verse view by hand as they arrive**, the fourth thread (one shared slot)
gets more expensive to adopt with every feature that lands the old way. So the low-cost move,
even under "decide nothing large," is to decide the *slot* early and let the content threads
land through it whenever they land. That is the one piece with a real cost to deferring.

## What does the app do today, and what does it cost?

Two things bear on this.

**The app already has a map with roads on it.** Tap a verse and the app offers roads to
verses it resembles — same-surah look-alikes and one elsewhere in the book — and hopping a
road turns the mus'haf to that page, drops a bead so you can walk back, and leaves a
breadcrumb. Under the hood the app keeps roads of several kinds apart and can rank them
nearest-first for a reader who is memorising. The roads that are *live* today are about
**sound and shared words** (the look-alikes, "mutashabihat"): roughly three thousand of them
across fifteen hundred verses, built from an outside dataset. This is the machinery thread 5
would extend — but note what it is *not*: two verses that sound alike are not the same as two
verses that mean the same thing, and today the app can only offer the first.

**The tafseer question is settled but narrowly.** It was decided that a verse's sheet can
open a scholar's explanation, shown line by line, looked up **live** from an outside service
rather than shipped in the app, with a trusted link beside each verse. That decision was made
under a hard constraint the reader must hold onto: **the app ships no Qur'an text, and it was
willing to fetch a tafseer on demand but not to bundle one.** See
[`tafseer.md`](../decisions/tafseer.md). What is *not* covered there: surah introductions
(thread 1), the cross-references inside the commentary as walkable roads (thread 3), a
plugin slot (thread 4), or a meaning-map (thread 5). This document picks up exactly where
that one stopped.

The cost of standing still is only the meaning a reader has to leave the app to find, and
the roads they cannot walk because the app does not yet know they exist. No reader has asked
for them yet; the app has no readers yet.

## What already exists to build on

This is a report, not a proposal. A sibling working copy (`../books/`, in
`books/study-quran/`) holds a prepared, machine-readable capture of **The Study Quran**
(HarperOne, 2015 — a single-volume translation and commentary by Seyyed Hossein Nasr and a
team of editors). Its shape, verified by reading the files:

- **One file per surah** (114 of them), plus a coverage report and a reverse-link index.
- **Every verse is present** — 6,236 of the canonical 6,236 — each with the editors'
  translation, and, where the book has one, the commentary paragraph(s) for that verse.
- **Commentary** is captured as blocks of prose attached to a verse or a small run of verses,
  with the verse range each block covers recorded. There are about **6,800 commentary blocks**
  across roughly **4,900 keyed paragraphs**; **5,969 of the 6,236 verses carry at least one**.
- **Surah introductions** are captured as their own text at the head of a surah. About **half
  the surahs (53 of 114) have their introduction captured so far**; the rest are still to do.
- **Cross-references are already extracted as data** — this is the striking part. Every
  "compare 27:30" the commentary makes is a machine-readable pointer from one verse to
  another. There are **81,590 of these directed pointers**, each a clean single-verse
  reference (no ranges to untangle), and a companion **reverse index** already answers the
  other direction: *which verses point at this one.* About **5,000** of the pointers lead to
  a verse that itself has commentary.
- **Provenance and licence are stamped on every file.** Each records its source
  ("study-quran"), its edition ("hafs-kfqc"), a capture timestamp, and a content checksum —
  and, critically, a licence field whose value on every file is **"private."**

How usable is it? As **structure and as a build-time source, extremely** — it is clean,
complete on verses, keyed to the same verse-addressing the app already uses, and the
cross-reference graph is a finished artifact someone would otherwise have to build by hand.
As **text the app could ship, not at all** — see the licence section below, which is the
single most important constraint in this document. The right mental model: this capture is a
**quarry we can measure and take shapes from, not a warehouse we can ship crates out of.**

## What do others do about this, and did I look?

**I did not run a fresh outside survey for this document.** I am not going to pretend the
landscape was re-checked when it was not. What I can honestly report is second-hand and
older, and it should be redone before any of this is built:

- The earlier tafseer decision surveyed where commentary text can come from and under what
  terms — the Tafsir Center's openly-licensed dataset, the Quranic Universal Library's ~108
  tafseers each under its own licence, the Quran Foundation's live service, and several
  English commentaries (Ibn Kathir, al-Jalalayn, al-Sa'di) that reserve all rights. The full
  survey, with links and terms, is in [`tafseer.md`](../decisions/tafseer.md) and should be
  treated as the starting point, not repeated here.
- The app's look-alike roads come from an openly-licensed community dataset (Waqar144's
  mutashabihat data), pinned with its licence; see [`loop-4a.md`](../decisions/loop-4a.md).

**What was *not* looked at, and should be**, before thread 5 in particular is committed:
whether anyone publishes an openly-licensed *meaning*-similarity graph over the Qur'an;
whether existing "thematic index" works (there are classical and modern ones) could seed or
sanity-check ours; and what other reading apps do for "related topics" as opposed to
"similar wording." Treat the meaning-map as unsurveyed until someone does this.

## What have we already decided that constrains this?

- **The app ships no Qur'an text** (a standing rule, restated in every relevant decision).
  This does not forbid meaning features, but it shapes all of them: anything shipped must
  carry no scripture. It is why thread 5 leans on *fingerprints* (which are not text) and why
  thread 2 inherits the tafseer decision's fetch-don't-bundle stance.
- **A verse's explanation is fetched live, not bundled, and shown with its source and a
  trusted link** ([`tafseer.md`](../decisions/tafseer.md)). Thread 2 must live inside this,
  not around it. It also means the *text* of the Study Quran commentary is almost certainly
  not what gets shown to readers even if it seeds our graph — see the licence section.
- **The map already separates roads by kind, and reserved a slot for meaning-roads and one
  for commentary** ([`loop-2.md`](../decisions/loop-2.md)). Thread 5 is meant to fill the
  first reserved slot; thread 2's link-out can fill the second. Turning a reserved slot on
  was designed to be a status change, not a rebuild — so the constraint here is a helpful
  one.
- **The look-alike roads are about sound, and are built from a pinned outside dataset**
  ([`loop-4a.md`](../decisions/loop-4a.md)). Thread 5 must be a *different kind of road*, not
  a replacement — the reader should be able to tell "sounds like" from "means like," and
  follow one without the other.
- **There is a size budget on what the app carries.** The tafseer decision measured only
  about thirty kilobytes of headroom in the app's own code. Anything thread 5 ships (the
  meaning-roads) competes for room with everything else and is fetched per surah, the way the
  look-alike roads already are.

## Thread 1 — How would a surah's introduction reach the reader?

The content exists (for about half the surahs so far) and is node content: it belongs to the
*place that is the whole chapter*, not to any one verse. The question is where it surfaces and
whether its text is ours to show.

- **A · A short "about this surah" panel at the head of the chapter.** When a reader opens a
  surah's first page, a panel offers the introduction. *Gets* the reader the chapter's frame
  before they read it. *Costs* the same licence problem as commentary if the shown text is
  the Study Quran's — so in practice the *shipped* version would be either our own short
  summary or a fetched, openly-licensed introduction, with the Study Quran capture used only
  to *check* ours.
- **B · Fold the introduction into the verse panel of the first verse**, with no chapter-level
  surface of its own. *Gets* one fewer place to design. *Costs* legibility — an introduction
  is about the chapter, and hanging it on verse 1 misfiles it.
- **C · Do nothing for now.** *Gets* time. *Costs* the cheapest, most self-contained piece
  of meaning the app could offer, and the one least entangled with per-verse licensing.

Open question: what is the *shipped* introduction — our own plain summary, an openly-licensed
one, or a live fetch like the tafseer? The Study Quran text answers "what should it say" but
not "what may we show."

## Thread 2 — How would a verse's commentary reach the reader?

This thread is mostly *already decided* and this document's job is to not re-open it. The
tafseer decision settled that commentary is fetched live and shown line-by-line with its
source. The only additions here:

- The Study Quran capture is a strong candidate as a **source for our own cross-references and
  meaning-map** (threads 3 and 5), and as a **private reviewer's aid**, but its commentary
  *text* is a poor candidate for the shown tafseer because of its licence. The live-fetch
  sources from the tafseer decision remain the ones to show.
- The reserved commentary slot in the road registry gives thread 2 its natural home: a
  "commentary" road/panel that, when turned on, opens the fetched text.

No new options are proposed here; thread 2 is a pointer to
[`tafseer.md`](../decisions/tafseer.md) plus the note that our derived artifacts may learn
from the Study Quran even where the shown text may not be it.

## Thread 3 — How would the commentary's own cross-references become roads?

This is the highest-value, lowest-risk thread, because the data is finished and the machinery
exists. The commentary's 81,590 "compare that verse" pointers are exactly *roads of a new
kind*: the author's own links between verses. They are not about sound (unlike today's roads)
and not derived by us (unlike thread 5) — they are editorial fact.

- **A · Add cross-references as a road kind, walkable like the look-alikes.** Tap a verse,
  and among its roads are "the commentary here points at these verses"; hop one and the book
  turns there, with a bead back, exactly as look-alike hops work today. The reverse index
  already built means the app can *also* offer "verses whose commentary points *here*,"
  which is often the more interesting direction for a memoriser. *Gets* a rich, human-made web
  of connections for the cost of loading it into the existing road machinery. *Costs* a
  loading step, per-surah road files that compete for the size budget, and a licence judgment
  (below) on whether the *list of pointers* is ours to ship.
- **B · Show the cross-references only inside the commentary panel, as tappable verse
  numbers, not as first-class roads.** *Gets* the links where the reader is already reading
  meaning, with less new machinery. *Costs* the ability to walk them from the map without
  opening prose, and the reverse direction.
- **C · Do nothing.** *Gets* time. *Costs* the single largest ready-made body of connections
  the app could offer.

The licence judgment this thread turns on: **a bare list of "verse X refers to verse Y"
pointers is closer to fact than to creative text** — but the *selection* of which references
to make is an editorial act, and reproducing the Study Quran's selection wholesale may carry
some of the book's protection with it. This needs a real answer (see the licence section); a
safe middle path is to use the pointers to *seed and check* our own reference set rather than
shipping theirs verbatim, the same pattern the project has used before for derived data.

## Thread 4 — What is an "ayah plugin," and how do several live on one verse?

This is the structural heart of the document. The other four threads each want to put
*something* on a verse — a summary, a fetched tafseer, a set of roads, an audio clip later.
The proposal: **stop wiring each one in by hand, and define one slot they all plug into.**

**What a plugin is, in plain terms:** a small, self-contained provider of *one panel for one
verse*. It knows how to answer three questions about any verse: *do you have anything for this
verse?* — *what should your chip say (an icon, a short label, a count)?* — *what do you show
when the reader opens you?* Everything else about it (where its data comes from, whether it
fetches or ships, what it draws) is the plugin's own business, hidden behind those three
answers.

**How several coexist:** the verse's sheet already lists roads and rows. With plugins, that
list is *assembled* — the sheet asks each registered plugin "anything for this verse?" and
lays out a chip for each that says yes, in a fixed order, each opening its own panel. A verse
with a commentary, three cross-references and a meaning-road shows three chips; a bare verse
shows none. Adding a feature later (say, recitation audio) is registering a new plugin, not
editing the sheet.

**The interface, stated once (this is the "how it's built" part, and the only place internal
names appear):** a plugin is an object implementing something like
`{ id, kind, has(verseKey), chip(verseKey), panel(verseKey) }`, registered into the same
kind-of-road registry that already exists in `packages/core/adjacency.ts`. Road-shaped
plugins (cross-references, meaning-roads) reuse the existing hop/bead/breadcrumb machinery;
content-shaped plugins (introduction, commentary) render a panel in the sheet. The registry
already distinguishes *active* from *reserved* kinds, so a plugin can ship dark and light up
later — which is exactly the behaviour thread 5 and thread 2 need.

Options are about *how much* to commit to the abstraction now:

- **A · Build the slot first, migrate the existing rows and roads onto it, then add threads
  1–3 and 5 as plugins.** *Gets* every future meaning feature for the price of registration,
  and one consistent verse sheet. *Costs* an up-front refactor of the working sheet and road
  code before any new content ships — real work with no visible payoff on day one.
- **B · Add threads 1–3 the direct way, and only extract the slot once a third or fourth
  thing wants onto the verse.** *Gets* meaning to readers sooner. *Costs* the migration later,
  at higher price, and the risk the abstraction is shaped by whatever landed first rather than
  by the full set.
- **C · No shared slot; each feature wires itself in.** *Gets* simplicity per feature.
  *Costs* a verse sheet that grows by accretion and gets harder to reason about with each
  addition — the failure this thread exists to prevent.

Recommendation to weigh (not a decision): the registry already exists and already has the
active/reserved distinction, so option A is *cheaper here than it would normally be* — much of
the slot is built. But it is still a refactor of working code, and the honest trade is
"consistency and cheap future features" against "meaning in readers' hands sooner."

## Thread 5 — Could the app have its own map of verses that mean the same thing?

This is the most ambitious and least certain thread, and the one most worth getting right,
because it is the app doing something no printed mus'haf and few apps do: offering a road from
a verse to another verse *about the same thing*, even when they share no words.

**What "means the same thing" should mean here.** Deliberately not "shares words" (that is the
look-alike roads already) and not "the author linked them" (that is thread 3). It should mean
one of, and the document leaves open which:

- *About the same subject* — patience, the Day of Judgment, a named prophet, charity. Two
  verses that never repeat a phrase but are both about trusting God through hardship.
- *One builds on another* — a verse that develops, qualifies, or answers a theme another
  states. This is directional and much harder to derive.
- *Same rhetorical move* — both are oaths, both are parables of a garden, both address the
  hypocrites. Useful to some readers, noise to others.

Picking which of these the road means is itself a decision, and probably the first one thread
5 has to make, because it changes how the graph is built and how it is judged.

**How it could be derived** (each with a cost, none yet chosen):

- **A · Meaning-fingerprints of translations and/or commentary.** Turn each verse's
  translation (and/or its commentary) into a fingerprint with a language model, then join
  verses whose fingerprints are close. *Gets* full coverage automatically and needs no hand
  labelling. *Costs*: the fingerprints are built from *someone's* translation/commentary, so
  the licence of that input matters even though the fingerprint is not readable text (see
  below); "close fingerprints" catches subject overlap well and "builds on" poorly; and it
  will confidently join verses that a scholar would not, so it needs a human gate before it is
  offered as a road.
- **B · Concept extraction, then join on shared concepts.** Pull named subjects/themes from
  commentary (patience, the Hereafter, a prophet's name), attach them to verses, and join
  verses that share concepts. *Gets* roads a reader can *understand the reason for* ("both
  about patience") and a natural filter. *Costs* an extraction step whose quality varies, and
  a vocabulary of concepts to maintain.
- **C · Seed from the cross-references (thread 3), then grow.** Treat the commentary's own
  "compare that verse" links as the first, human-made meaning-roads, and use A or B only to
  *suggest additions* a human confirms. *Gets* a graph that starts trustworthy because it
  starts human-made, and a clean division between "editorial fact" and "our suggestion."
  *Costs* limited reach at first (only where the commentary already links), growing as
  suggestions are confirmed.
- **D · Do nothing / wait for an openly-licensed thematic graph to exist.** *Gets* no risk.
  *Costs* the feature, indefinitely.

**What ships, and the held-copy line.** This is the reassuring part: **the roads themselves
are just pairs of verse numbers with a strength and a reason — no scripture, no commentary
text.** A meaning-road file is "verse 2:153 relates to verse 3:200, strength 0.8, reason:
patience," which carries no Qur'an text at all and ships cleanly under the no-text rule, the
same way the look-alike road files do today. The *fingerprints* need not ship either — they
are a build-time tool for finding the pairs, and only the pairs need to reach the app. So
thread 5's output is held-copy-safe by construction; the licence questions are all about its
*inputs* (whose translation/commentary the fingerprints are built from), not its outputs.

**How a reader would walk it.** Exactly like the roads that exist: a verse's sheet gains a
"related in meaning" road kind (the reserved slot), distinct in label and icon from
"look-alikes." Tap it, see a nearest-first list with a one-line reason each, hop one, get a
bead back. The crucial UX point: **"sounds like" and "means like" must be visibly different
roads**, because a memoriser uses look-alikes to *stop confusing* two verses and meaning-roads
to *understand* one — opposite jobs, and merging them would serve neither.

**How it differs from and complements the cross-references.** The cross-references (thread 3)
are the *author's* links: sparse, deliberate, trustworthy, and limited to what one commentary
chose to note. The meaning-map (thread 5) is *ours*: dense, derived, fallible, and able to
reach connections no single author wrote down. They complement each other precisely — the
cross-references are the high-precision seed and the human gate's yardstick; the meaning-map
is the high-recall net. Keeping them as two road kinds, not one blended list, lets a reader
trust the first absolutely and treat the second as suggestion.

## How the five threads are one thing

- **Places (nodes):** a verse, and — for the chapter — a surah. What a place *holds*:
  the translation the app already knows, the surah introduction (thread 1), the fetched
  commentary (thread 2).
- **Roads (edges), by kind:** *sounds like* (built, live today), *the author linked them*
  (thread 3, ready to build), *means the same thing* (thread 5, to be derived). One more
  reserved kind (from a saying of the Prophet) waits behind the same door.
- **The slot (plugins, thread 4):** how any place-content or road reaches the verse sheet
  without the sheet being rebuilt each time.

Said in one line: **threads 1–2 fill the places, threads 3 and 5 lay two kinds of road, and
thread 4 is the doorway all of them come through.** A reader disagreeing with this document
should say which of those three sentences is wrong.

## The licence line, drawn honestly

The Study Quran is a **copyrighted commercial book** (HarperOne / HarperCollins, 2015). The
capture next door marks every file **"private,"** which is the correct and conservative
stamp. The separation this document insists on:

- **Text we may not ship, or show as ours.** The Study Quran's translation, its commentary
  prose, and its surah introductions are protected. They may sit in a build-time source and a
  private reviewer's aid; they may not be bundled into the app, and showing them to readers
  would need permission the project does not have. This is *stricter* than the general no-text
  rule — it is not only "no Qur'an text," it is "no HarperOne text."
- **Structure and ideas we can learn from freely.** That commentary attaches to verses in
  runs; that a thematic graph is worth having; how introductions are shaped; the *existence*
  of a connection between two verses — these are not the book's to own, and shape our design.
- **The grey middle, to get a real answer on.** The *list of cross-reference pointers* is
  closer to fact than to prose, but the *selection* of them is editorial. The safe pattern,
  and the one the project has used before for derived data, is to use the Study Quran's
  pointers to **seed and check** our own reference set and our own meaning-map, and to ship
  *our derived artifacts* (verse-number pairs, fingerprints' *outputs*) rather than the book's
  text or its verbatim selection. Derived numbers are ours; the prose they were derived from
  is not.
- **Attribution regardless.** Even where we ship only derived data, if the Study Quran
  materially shaped it, it earns a line in the dependency and licence register, the way every
  other source does.

If any single thing in this document needs a lawyer's eye rather than an engineer's, it is
the grey middle. Nothing in threads 3 or 5 should ship on the strength of "it's probably
just facts."

## What would change the answer?

- **A clear licence answer on the cross-reference list** would move thread 3 from "seed and
  check" to "ship directly," or confirm it must stay seed-only.
- **An openly-licensed meaning-graph or thematic index** existing would change thread 5 from
  "derive it ourselves" (options A–C) to "vendor it," the way the look-alike roads are
  vendored.
- **A measurement of how often derived meaning-roads are wrong** — a human sampling of, say,
  a few hundred suggested pairs — would decide whether thread 5 can be offered as a road at
  all, or only as a private suggestion behind a gate. This measurement does not exist yet and
  is the single most important missing number.
- **A real reader wanting one of these** would reorder the whole list; today there are none.
- **The commentary capture finishing its surah introductions** (currently about half) would
  unblock thread 1 fully.

## What is this document not settling?

- It does not decide *any* of the five threads. Every option list is open.
- It does not settle which meaning of "means the same thing" thread 5 should use — that is a
  prerequisite decision inside thread 5.
- It does not re-open the tafseer decision; thread 2 lives inside it.
- It does not resolve the licence grey middle — it flags it as needing an answer above an
  engineer's pay grade.
- It does not measure how good a derived meaning-map would be; it says that measurement is the
  gate and does not yet exist.
- It gives no build order beyond one observation: the plugin slot is the cheapest thing to
  decide early and the most expensive to defer, and thread 3 is the highest value for the
  lowest risk once its licence line is drawn.

## Open questions, gathered

1. Is the framing right — two kinds of content, two kinds of road, one slot?
2. Thread 4: build the slot first (refactor now), or extract it once a third thing wants on
   the verse?
3. Thread 3: ship the cross-references directly, or use them only to seed and check our own?
   (Turns on the licence line.)
4. Thread 5: what does "related in meaning" mean — same subject, builds-on, or same move?
5. Thread 5: derive from fingerprints, from concepts, or seed from the cross-references and
   grow? And what error rate is acceptable before it is offered as a road rather than a
   private suggestion?
6. Thread 1: what is the *shipped* surah introduction — our summary, an openly-licensed one,
   or a live fetch?
7. The licence grey middle on the cross-reference *selection* — needs a real answer, not an
   engineer's guess.

## Open questions, and what would answer each

### ① Where does the commentary the pitch shows still differ from the printed book? · **open**

The private pitch reads The Study Quran's commentary from a capture of the book, page by page.
Walking the pitch on 2026-10-05 found that where a paragraph ran over the foot of a printed
page, the capture kept the part on the first page and then the whole paragraph again on the
next, so Ayat al-Kursi's note, and 124 others, read the same passage twice. The pitch's
extractor now joins those paragraphs, and after a re-run 124 of the 125 read once.

**Second pass, 2026-10-07:**

- **Sentences run together.** Where a paragraph started at the top of a printed column, the
  capture lost both the new paragraph and the full stop before it. 30 such places were read off
  the page images and are now put back. The list of places is kept with the extractor, and the
  extractor refuses to run if one of them stops matching.
- **Stray letters from the transliteration.** The small raised letters of a few Arabic words were
  set down as words of their own at the start of a sentence (3 verses). They are dropped.
- **The verse printed again as the note's first lines.** The book prints each verse in bold above
  its note, and in 47 notes the capture took that in as the note's opening, sometimes with the
  next verses too. It is dropped, so the verse shows once, above its note. A note that quotes only
  part of its verse is left as it is.
- **Pieces that are not the note.** The page's margin column of verse references became
  paragraphs, or was glued to the front of one (4 verses); single stray letters became paragraphs
  (7 verses); and 98:5 carried a piece of 98:4's note and a cut-short copy of its own. All dropped.
- **Verses the capture lost.** Where the book prints a note before or inside its verse, the
  capture took the note as the verse (85:12, 87:1, 88:11 to 88:14, and 4:107, whose verse ran on
  into the note shared by 4:105 to 4:107). Three more verses were cut at the foot of a page
  (3:119, 3:167, 46:11). These ten verses were read again off the page pictures into a private
  file kept beside the capture; each note now sits under its verse, and 4:105 and 4:106 have the
  shared note too.
- **Paragraphs cut in two.** Where a sentence ran over the foot of a column or a page, the
  capture started a new paragraph part way through it, sometimes in the middle of a word
  (a word like "merchants" left as "mer" and "chants"), and sometimes dropped the last letter before the break or added the
  page's margin numbers. 83 paragraphs inside notes stopped part way through a sentence. A
  paragraph that does not end its sentence and is followed by one that starts in lower case is now
  joined to it, without a space when the two halves only make a word together. The 18 places
  that needed more than that (a lost letter, a leftover number, a full stop that belonged there)
  were read off the page pictures; that list is kept with the extractor, and it refuses to run if
  one of them stops matching. None of the 83 is left.

**Third pass, 2026-10-07:**

- **Notes the capture cut short.** A second reading of the book's pages filled in notes the first
  capture had cut short or missed, so verses with no note at all fell from 258 to 44.
- **Margin references left after the last sentence.** The margin's verse references and stray
  letters were also glued to the *end* of a paragraph, after its last full stop. They are
  dropped; a paragraph's own last words ("in v. 155", "See 2:41") stay.
- **The last full stop lost.** 111 notes ended with no full stop where the printed page has one
  — checked against the page pictures, and only where the page shows the next note's number,
  the end of the surah or the section mark right after it. That list is kept with the extractor
  (it holds no words of the note), and the extractor refuses to run if one of them stops matching.

**Fourth pass, 2026-10-08:**

- **The 23 read by hand.** Read off the page pictures: 19 had only lost their stop (one of them a
  question mark) and are on the list; two were really cut short, and the rest of each was read
  off the page into a private file beside the capture, never into this repository, which the
  extractor adds back; two end exactly as the page does.
- **The stop after a closing bracket.** Where a note ends on a bracketed source or reference,
  the book usually sets the full stop after the bracket, and the capture lost it there too. The
  page readings show it for 97 of them, and those are on the same list. The page readings could
  not settle 29 more, so each was found on its page picture by its verse and read by eye: 25 show
  the stop and joined the list, and 4 have none in the book and stay as printed. A note whose
  sentence stopped inside the bracket is left alone.
- **A note set aside.** The capture filed one note, shared by the first two verses of a surah,
  with the blocks it could not place, because a stray reference sat in front of its verse
  number, so both verses showed nothing. It is put back from a list that holds a fingerprint of
  the block, never its words.
- **Sentences run together, searched wider.** The first search looked for the common sentence
  openings. A wider one looked for any word that usually opens a sentence in these notes but
  sat mid-sentence: 135 spots. The page readings show the book itself runs 103 of them on, nearly
  all a verse quoted straight into the sentence. The rest were looked at, on the page pictures
  where the readings could not say: four had lost a full stop and a new paragraph, and are on the
  list; one of them also had the long-vowel marks of the line above set down as stray letters,
  which are now dropped wherever two or more such lone vowels open a sentence.
- **Verses with no note.** The 42 verses still without a note were each looked for on the pages.
  The book has none for them: where it prints a run of verses together, the note carries only
  the last verse's number.

**What is still different:** Words the book sets in italics (a term being defined, a
book's title) show upright in the panel: neither the capture nor the page readings record
the slant. One shortcut was tried and set aside: the book often sets in italics a note's
quotation of its own verse, so a run of the verse's words inside its note could be slanted
without reading the slant at all. About 4,000 notes have such a run, but checked against the
page pictures, a sample of 25 was right only about three times in four; the misses were
quotations the book sets upright in quotation marks, runs that reach past the slanted words,
and plain phrases that happen to repeat the verse. Terms and titles, the other italics, cannot
be found from the words at all. A panel that slants the wrong words a quarter of the time reads
worse than one that slants none, so the words stay upright. Nothing here reaches the public
site; it is only the pitch.

**What would answer it:** a way to read the slant off the page pictures themselves. The shortcut is written up in
[the italics note](../issues/italics-from-quoted-verse-words.md). Why the bracket endings had to be read off the pictures rather than the page
readings is written up in [the bracket endings note](../issues/bracket-endings-read-from-the-pictures.md).

### ② On a phone, can the roots and similar-verses lists keep their verse in sight, as the note does? · **fixed**

On a phone the note opens on the lower part of the screen and lifts the page, so the verse it is
about stays in sight above it. The roots list and the similar-verses list do not: they rise over
most of the screen behind a dimmed page, and the verse is under them. Walking the pitch on
2026-10-06, Ayat al-Kursi's roots list (picked from its number's menu) covered the whole verse,
leaving only the page's first three lines showing.

**What would answer it:** the same short opening and lifted page the note has, tried on a phone
with a long list (2:255's roots) and a short one (36:31's later look-alike), and looked at.

**Fixed, 2026-10-06:** both lists now open on the lower part of the screen with no veil over the
page, and the page moves up so the verse sits above them, as it does under the note. Tried on
2:255's roots and 36:31's look-alikes on a phone, and a test opens each list from the verse's
number and checks its first line stays in sight above it.

### ③ With one page open on a laptop or an iPad, can the reader still reach the page bar while a note is open? · **fixed**

With two pages open the note lies over the facing page. With one page open it is a card in the
corner, and that card stood a fixed gap off the bottom of the window, so it ran down over the
full-screen button, the verse's chip and the page bar. A reader could not move to another page
without closing the note first. Found walking the pitch on 2026-10-06, on a laptop and on an iPad
held upright, with Ya-Sin 36:12 open.

**What would answer it:** the card ending above the bars at both sizes, still tall enough to
read, and the verse it is about still in sight.

**Fixed, 2026-10-06:** the app measures the room the page has and every card in the corner (the
note, the roots list, the similar-verses list, a marked passage's menu) stands inside it. The
note also measures what it covers from its own new foot, so the page still lifts the verse clear
of it. A test opens 36:12 on one page at both sizes and checks the card ends above the bars and
covers none of the verse.

### ④ Does an iPad held upright open on one page the reader can read? · **fixed**

An iPad held upright is tall and narrow, but the app opened it on two pages side by side, each
small enough that the verse lines were hard to read and the note had to squeeze in beneath
them. A reader had to find the One/Two switch before the page was usable. Found walking the
pitch on 2026-10-06.

**What would answer it:** an upright iPad opening on one page, turning the iPad on its side
opening the book to two, and a reader's own pick of one or two staying put when they turn it.

**Fixed, 2026-10-06:** the app opens on one page when the screen is taller than it is wide and
on two when it is wider, and follows the screen when it turns, until the reader picks one or two
themselves; from then on their pick stays. Two tests turn an iPad-sized window: one checks it
opens on one page upright and on two sideways, the other that a reader's pick of two survives
turning it there and back.

### ⑤ On a large iPad showing one page, can a finger turn it? · **fixed**

A large iPad is wide enough to get the laptop's layout, and there a page turns by grabbing its
outer edge, not by a swipe across it, so a drag through the text is free to select or move the
page. But the edges to grab are only drawn when two pages are open. With one page showing there
was nothing to grab and the swipe was switched off, so the only way to turn was the small arrows
at the ends of the page bar. Found walking the pitch on 2026-10-06, right after item ④ made one
page the way an upright iPad opens.

**What would answer it:** a swipe across the one page turning it on a touch screen, as it does
on a phone, while a laptop's mouse keeps the edge-grab rule.

**Fixed, 2026-10-06:** with one page open on a screen whose main pointer is a finger, a swipe
turns the page. Two pages on an iPad still turn by their edges, and a laptop is unchanged. A test
on an iPad-sized window in the iPad's own browser engine swipes page 8 and checks page 9 comes
up.

### ⑥ With two pages open, does a verse's note hide its look-alike chips? · **fixed**

With two pages open, a verse's note opens on the facing page so the verse itself stays in
sight. The chips that lead to the verse's look-alikes were always drawn beside the page that
turns next, whichever page the verse was on. So for a verse on the right-hand page, the note
opened on the left and sat right on top of the chips, which also stand on the left. The note is
wider than a page and reaches out over the table, so the chips were fully covered. Found walking
the pitch on 2026-10-06, on a laptop and on an iPad on its side.

**What would answer it:** the chips standing beside the chosen verse's own page, on the side its
note does not cover.

**Fixed, 2026-10-06:** while a note is open beside two pages, the chips stand on the far side
from the note, next to the verse they belong to. With no note open they stay where they were. A
test on a laptop-sized window and an iPad-sized one opens a verse on the right-hand page and
checks that the note does not cover the first chip, and that the chip is on the right.

### ⑦ Does pressing a verse's number open two lists of the same tools? · **fixed**

A press on a verse's number opens a small menu beside it: the commentary, the look-alike
verses, the same roots, listening, the surah's introduction. The same press also chose the
verse, and a chosen verse brings up its row of tools under the page, which offers most of the
same things. So one press put two lists of the same choices on screen at once, and the lower
one sat over the page bar. Found walking the pitch on 2026-10-06, on a laptop and on an iPad on
its side.

**What would answer it:** one list at a time. While the number's menu is up, the row under the
page waits.

**Fixed, 2026-10-06:** the row of tools under the page stays away while the number's menu is
open, and comes back the moment the menu closes. A test presses a number, checks that only the
menu shows, closes it with Escape, and checks that the row is back.

### ⑧ Should the "later surahs" arrow point left, the way the book runs? · **open**

The look-alike signs use an arrow to say where the other verse is: "≈←" for an earlier surah
and "≈→" for a later one. But the book, and the page bar under it, run right to left: page 1 is
at the right, and later pages lie to the left. So the arrow for "later" points the opposite way
from where a reader's eye would go to find a later page. The owner looked over these signs on
2026-10-04 and kept them; this asks only about the direction, which was not raised then.

**What would answer it:** the owner choosing, from the two arrows drawn on a real page, whether
"later" points left (with the book) or right (as now, the way most English readers expect
"next").

### ⑨ Deep in a list of roots or look-alikes, can the reader still close it? · **fixed**

On a phone the roots list and the look-alike list rise from the bottom of the screen. Scrolling
down either one carried its title and its close button up and out of sight with the first rows,
so the reader had to scroll all the way back to put it away. The note had the same fault and was
fixed on its own; these two lists are built the same way and were missed. Found walking the
pitch on a phone on 2026-10-06.

**Fixed, 2026-10-06:** both lists keep their title and close button pinned to the top edge, over
the rows as they pass. A test scrolls each list to its end and checks that the close button and
the title are still inside the list and on top of the rows.

### ⑩ Does every look-alike row that offers to open have something to show? · **fixed**

A look-alike row can open out to show the two verses side by side, with the words they share
washed green. Some pairs match in more than one place, so no particular words are named and
there is nothing to show; 452 of the 2,996 pairs are like this. Their rows offered to open
anyway: the arrow turned, and nothing came, which reads as broken. Found on 2026-10-06 with
Ya-Sin 36:31 and its look-alike in Sad.

**Fixed, 2026-10-06:** a row offers to open only when its pair names the words they share. The
others keep their label and their button to go there. A unit test draws one row of each kind and
checks that only the first can open.

### ⑪ With a note up on a phone, do the look-alike buttons cover any words? · **fixed**

On a phone the look-alike buttons stand in the empty strip at the top of the page, above its
first line. Opening a note slides the page up so the verse shows above the note, and that strip
slid up out of sight with it, but the buttons stayed where they were: on top of the words of an
earlier verse. Found on 2026-10-06 with Fatir 35:44, where they sat on a line of 35:40.

**Fixed, 2026-10-06:** while a note, a list of look-alikes or roots, or the share tray is up, the
buttons move down onto its top row, beside its handle, and that row is made tall enough that they
never touch its title or its close button. When the note is grown to fill the screen, they step
back under it. Four tests on a phone: no button on any line of the page with the note up, none
drawn over the grown note, none on a list's title or close button at rest or scrolled, and none
on the share tray's title in Arabic.

### ⑫ On a phone held sideways, do the look-alike buttons cover the note's close button? · **fixed**

Held sideways, a phone is wider than the width at which the buttons lie flat in a row, so on the
note's top row they stood in a column of full-size buttons, and they came down onto the note's
close button. Found on 2026-10-06 with Fatir 35:44.

**Fixed, 2026-10-06:** on a sheet's top row the buttons always lie in one slim row, whatever the
width of the screen. A test holds the phone sideways and checks both buttons share one row, above
the close button and clear of it.

### ⑬ Turning a phone sideways with a note open, does the note cover its verse? · **fixed**

Upright, the note slides the page up so its verse shows above it. Turned sideways, the screen is
far shorter, and the page settled back to where it rests: the note covered all but the verse's
first line. Found on 2026-10-06 with Fatir 35:44.

**Fixed, 2026-10-06:** when the screen changes size with a note up, the page slides its verse up
above the note again, the same way it does when the note first comes up. A test opens the note
upright, turns the phone, and checks every line of the verse is above the note.

### ⑭ On a phone, do the verse's tools leave scraps of the bar showing? · **fixed**

A verse's tools rise over the bar under the page and its slider. On every phone they stopped a
few pixels short of the bar's top, so a thin strip of its buttons showed above them; held
sideways they were narrower than the screen, and their edge cut the selected verse's button in
half. Found on 2026-10-06 with Fatir 35:44.

**Fixed, 2026-10-06:** on a phone the tools cover the bar whole, upright and sideways, reaching
exactly to its top. A wider screen keeps them as a card in the middle, with the bar's ends clear
beside it. A test on four phone sizes checks every button of the bar is either wholly under the
tools or wholly clear of them.

### ⑮ Turning a phone the moment a link opens a verse, is the verse still marked? · **fixed**

A link that opens a verse slides the page to it, and marks the verse once the page gets there.
Turning the phone during that slide starts a new one, to fit the new screen, and the first slide
was cut off without ever saying it had ended — so the verse was never marked at all. Found on
2026-10-06 with Fatir 35:44, and it came in with the fix for ⑬.

**Fixed, 2026-10-06:** a slide cut short still says it is over, so whatever was waiting on it
runs. A test opens a verse from a link upright, turns the phone straight away, and checks the
verse is marked.

### ⑯ On a phone held sideways, does a list opened on a verse cover its last line? · **fixed**

Sideways, the verse's link buttons stand in a column at the screen's side, and the page keeps the
verse below where that column ends. Opening the roots or look-alike list moves those buttons onto
the list's top row, but the page stayed where the column had put it — low enough that the list
covered the foot of the verse's last line. Found on 2026-10-06 with Fatir 35:44.

**Fixed, 2026-10-06:** once the buttons move, the page is placed again, with the verse above the
list. A test reads upright, turns sideways, drags the page a little lower, opens each list, and
checks every line of the verse is above it.

### ⑰ At a desk, does the first screen tell a visitor to tap? · **fixed**

The one line a first visit reads, under the page, said to tap a verse to read its note — on a
computer too, where the visitor holds a mouse. Found on 2026-10-06 on the desktop spread.

**Fixed, 2026-10-06:** with a mouse it says click, in English and in Arabic; on a phone or an iPad
it still says tap. Tests check the desktop wording in both languages, and the phone's.

### ⑱ On a phone, do the verse's tools line up? · **fixed**

The row of tools under the page — listen, commentary, same roots, share, bookmark, the verse on
QUL — showed the same-roots icon higher than its neighbours, because its word wraps to two lines
and each tool was centred up and down in its cell. The share icon then sat a little lower than
the rest once the row grew taller. Found on 2026-10-06 on an upright phone.

**Fixed, 2026-10-06:** each tool starts at the top of its cell, and the share button fills its
cell's height like the others, so every icon sits on one line whatever its word does. A test
checks it in English and in Arabic.

### ⑲ Can a reader tell whose commentary a note is citing? · **fixed**

The book cites the commentators it draws on by initials in brackets after each claim, and says
who they are only in a key of about forty names at the front of the volume. A reader in the app
never sees the front of the volume, so the initials were letters nobody could read: the note
showed *that* the book had sources, and not *which* ones. A scholar would ask at once.

**Fixed, 2026-10-06:** each initial in a bracket that the key has is now a quiet, dotted button.
A tap (or a click) opens a small card under it with the commentator's name, when they died, and
the work the book draws on, with a line saying it comes from the book's own key. A press anywhere
else or Escape puts it away and leaves the note open. Initials the key does not have, and capital
letters in the prose, stay plain text.

The key itself is the book's, so it is held like the rest of it: it was typed by hand from the
pictures of the captured pages, because the machine-read text garbled its accents, and it lives
beside the capture and in the private pitch data, never in this repository. The tests name no
commentator.

### ⑳ Can a reader follow the verses a surah's introduction, or a note, points to? · **fixed**

The book names a verse of the surah it is in without the surah, as "v. 25" or "vv. 9–26", about
four thousand times across the introductions and the notes. Only a full citation, with its surah,
was a link, so the outline at the head of a surah (where each story begins and ends) could not be
followed, and a note pointing a few verses on was plain text. The introduction also drew its
prose bare: its commentators' initials did not open the key, though the same initials in a note
did.

**Fixed, 2026-10-06:** a "v." or "vv." is a link to that verse of the note's own surah, and goes
on through a list the same way a full citation does. The introduction is drawn the way a note is,
so its initials open the key and its citations are links. A link now also keeps the bracket or
comma touching it on its line, as a word would: on a phone the line used to break between "("
and the link, leaving the bracket alone at the end of the line above.

### ㉑ Should a note's mention of its own verse be a link? · **fixed**

A note often names the verse it is about: the note on 18:13 points to verse 13. Once "v." became
a link, that one went nowhere: tapping it opened the note the reader was already reading. It looked
like a way onward and was not one.

**Fixed, 2026-10-06:** in a note, its own verse is drawn as words, like the text around it. Every
other verse it names stays a link. The surah's introduction is not changed: there, the opening
verse is somewhere new to go.

### ㉒ When a surah's introduction opens, can the reader still see the surah's name? · **fixed**

When a reader opens a verse's note, the page slides up so the verse stays in sight above the
note. An introduction opened from the surah's name did not do that. On an upright iPad, where the
note card covers the lower part of the page, it covered half of Al-Kahf's name and its first
verses: the reader lost sight of the very thing the note is about.

**Fixed, 2026-10-06:** the surah's name is treated like the selected verse. When its introduction
opens, the page slides up so the name and the lines under it sit above the card. On a phone,
where the card is shorter, nothing changes.

### ㉓ Can a note's mention of its own verse split across two lines? · **fixed**

Once a note's own verse was drawn as words (item ㉑), it lost what the links around it have: a
link is one piece in the line, but plain words can break anywhere there is a space. On a sideways
iPad, 18:60's note broke its own verse between "v." and the number, with the number and the
closing bracket starting the next line.

**Fixed, 2026-10-06:** the mention is kept in one piece, brackets included, the same way the
links beside it are.

### ㉔ On a phone, what shows when a reader presses and holds a verse? · **fixed**

A press and hold on a verse opens a small menu of things to do with it: play from it, mark it,
write a note, copy, jump. In the demo it also opened the book's note for that verse, at the same
moment. On a phone, where the note is a card over the bottom of the screen, the two stacked: the
menu over the page, the note under it, and the page squeezed into a strip between them. The note
rising also slid the page up, so the menu no longer sat by the verse it was about.

The menu on the verse's number already had a rule for this: the note waits while the menu is up,
and comes back when it closes. **Fixed, 2026-10-06:** the press-and-hold menu follows the same
rule on a phone and an upright iPad. On a computer or a sideways iPad, where the note stands
beside the pages and covers nothing, both still show together.

### ㉕ On a phone, can a reader tap the initials that name the book's commentators? · **fixed**

The book cites its commentators by initials in brackets, often several together, such as four
initials for four commentators who agree. Each opens its line of the book's key. On a phone each
initial was a letter or two wide, a comma from the next, far narrower than a fingertip, so a tap
meant for one opened its neighbour, or landed on the comma and did nothing.

**Fixed, 2026-10-07:** a tap on any initial in a bracket now shows the key for the whole bracket,
which is also how the book means it read: these commentators together. The one tapped is marked
with a bar on the side its entry starts from, the left even in the Arabic app, since the entries
are in English. Each initial also takes taps over the comma beside it and a little above and below
its line, without moving a word of the prose.

### ㉖ With two pages open and a note beside them, can the reader turn the page by its edge? · **open**

On a computer or an iPad on its side, the book turns when the reader grabs a page's outer edge and drags it. A note opens
on the facing page, so its verse stays in sight, and the note is wider than that page: it covers
the page's outer edge too. For a verse on the right-hand page, the note sits on the left one,
and the left edge is the one that turns forward. Grabbing it there selects the note's words
instead of turning. Found walking the pitch on 2026-10-07, on a laptop and on an iPad on its side.

The arrow keys and the arrows under the page still turn it, and a turn closes the note, since its
verse has left the page. So nothing is lost, only the turn a reader reaches for first.

**What would answer it:** one of these, each tried with a hand on it before it is chosen.

- **Leave it.** Keys and the arrows under the page are the way to turn with a note open.
  Costs nothing; the edge just does not answer while the note covers it.
- **A narrower note that stops short of the edge.** The edge stays free. The note's lines get
  short, about 300 points on a laptop, which reads worse than the card does now.
- **Close the note on a press at its outer margin, and start the turn.** The edge keeps working
  in the same place. A press on the note's margin doing two things at once may surprise.

**Built, 2026-10-08, as a setting to try — still open.** Settings now has "Turning with a card
open", with all three ways in it. Leaving it as it is stays the default until one is chosen. It
covers every card that lies over the facing page (the note, the roots, the similar verses and a
highlight's menu), so they all behave the same. What having a hand on each showed:

- **Card stops short of the edge.** The edge is free and turns as usual. But a strip of the
  facing page shows beside the card, its words cut off at the card's edge — the very thing laying
  the note over the whole page fixed. On a laptop the note's lines come to about 300 points.
- **Grab the edge through the card.** The note keeps its full width, and a drag that starts on
  the page's edge, through the note, closes the note and turns the page. A still press there does
  nothing, and the note's own buttons, links and scrollbar stay the note's even where they sit
  over the edge. A hand cursor over that strip of the note says the edge is there. The catch: the
  page edge cannot be seen under the note, so the reader has to know it is there.

To choose, open settings on a two-page spread, try each with a note open, then record the choice
here and make it the default; the others stay as settings.

### ㉗ With two pages open, where does a surah's introduction open? · **fixed**

A verse's note lies over the facing page, so the verse stays in sight. A surah's introduction,
opened by pressing the surah's name, came up from the foot of the screen instead, the way a
phone's card does, over the page the name is on. It also lifted that page by itself, so its top
slid under the toolbar and it no longer lined up with the page beside it. Found walking the pitch
on 2026-10-07, on an iPad on its side and on a laptop: the app chooses the facing page from the
verse the reader picked, and pressing a name picks no verse.

**Fixed, 2026-10-07:** an open introduction counts as being about its surah's first verse, which
is on the page the name heads. It now lies over the facing page like a note, and both pages stay
level with the name in full view.

### ㉘ When a surah's introduction is open, do the verse's tools stay up as well? · **fixed**

Picking "Surah introduction" from a verse number's menu opened the introduction, and the verse's
row of tools (listen, note, share, bookmark) rose along the foot of the screen at the same time,
over the page slider. Two panels about one verse at once, and the slider out of reach. Opening the
verse's own note from the same menu already put the tools aside. Found walking the pitch on an
iPad on its side, 2026-10-07: the rule that puts the tools aside listed the note but not the
introduction.

**Fixed, 2026-10-07:** an open introduction puts the tools aside the way a note does, and they
come back when it closes.

### ㉙ Beside a page, do the similar-verses and roots lists still show a drag bar? · **fixed**

On a phone these lists rise from the foot of the screen as a card with a short grey bar at its
top, the sign that a card can be pulled. On a spread they lie over the facing page instead, where
nothing about them drags or grows, yet they still drew the bar. The note in the same place had
already dropped it. The same was true of the menu for a highlighted passage. Found walking the
pitch on an iPad on its side, 2026-10-07.

**Fixed, 2026-10-07:** all three draw the bar only as a phone card, never beside a page.

### ㉚ Opened from a verse deep in a surah, does the introduction lie over the facing page like the note? · **fixed**

On a spread, a verse's note lies over the facing page, and so does a surah's introduction opened
from the surah's name. Opened from the menu on a verse's number pages into the surah (Ayat
al-Kursi, on page 42), the introduction instead floated in the bottom corner, hanging past the
book's edge, with a drag bar nothing could drag. It was placed by the surah's first verse, which
was pages away, so it had no page to lie beside. Found walking the pitch on an iPad on its side,
2026-10-07.

**Fixed, 2026-10-07:** the introduction lies beside the surah's first verse when that verse is
open, and beside the verse it was opened from otherwise, the same place that verse's note takes.

### ㉛ With one page open on a laptop, does a link straight to a verse leave that verse in sight beside its note? · **fixed**

About one time in four, opening a link to Ya-Sin 36:12 with one page showing left the corner note
sitting on the verse it was about: the right-hand ends of both of the verse's lines were under the
card, and the page never slid up out from under it. The check written for ③ kept catching it and
passing on a retry, which is how it showed up, on 2026-10-08.

**Why it happened:** two things, each depending on what loaded first. The note judges whether it
covers the page by comparing its own box with the page's. A link first shows its page at the
whole-page size, clear of the corner, so the note said it covered nothing; the page then zoomed in
to frame the verse and ran under the card, and nothing judged again. And when the note did count
as covering, it asked the page to slide up the moment it opened, which is often before the page
has loaded: that ask found no page and was dropped.

**Fixed, 2026-10-08:** the note judges again whenever the page moves or zooms, not only when the
window changes size, and a page that arrives by a link or a jump while a note is up slides clear
of it once it is there. A new test holds the page back so the note always opens first; it failed
every time before the fix and passed 24 times running after it, as did ③'s test.


### ㉜ On a phone, does the settings sheet ask only what a phone can use, and draw cleanly? · **fixed**

Walking the app in Arabic on a phone on 2026-10-08 turned up two things in the settings sheet. The
choice from ㉖ — what an open card does at the facing page's outer edge — was offered on a phone,
where only one page ever shows and there is no facing page for a card to cover; its own description
starts "with two pages open". And the sheet opened with an empty band between two lines under its
title, in every language and on every screen: the title row draws a line under itself, and the
first section drew another above itself a few pixels lower.

**Fixed, 2026-10-08:** the card-edge choice is offered only where two pages can face each other (a
computer, or an iPad held sideways), the same rule the pens' placement already follows; and the
first section under the title no longer draws a line of its own. A unit test checks the choice is
absent without two pages, and a phone browser test checks there is one line under the title, not
two; both failed before the change.

### ㉝ On an iPad held upright, does the note read as the page's own, or stand in a corner beside nothing? · **fixed**

Walking the pitch inside the iPad app on 2026-10-08: held upright, the iPad shows one page that fills
the screen's width. The note, and the lists of roots and look-alikes, still opened as the narrow card
made for sitting beside a page, in the bottom right corner, with an empty brown block to its left.
There was nothing for it to sit beside, so it looked misplaced rather than placed.

**Fixed, 2026-10-08:** with one page on a screen held upright, the note and the lists lie across the
page under it, edge to edge, and the note's lines keep the same comfortable reading length as before.
Two pages side by side keep their card over the facing page. A browser test at the iPad's upright
size checks the note and the roots list each reach both edges of the page while a line of the note
stays short; it failed before the change (the note started 540 pixels in).

### ㉞ In the iPad app held sideways, do the two pages fill the screen, or shrink to a strip? · **fixed**

Same walk, iPad turned on its side: the app opened on two pages drawn as a strip about 28 points wide
in the middle of an empty brown desk, a little taller than a thumbnail and no wider than a pencil.
The same page in the browsers we test with, at the same size, held sideways, showed both pages full
height. Measured from inside the app, each page was 14 points wide: the iPad's own browser engine,
inside the app, could not work out a page's width from its height the way the page asked it to.

**Fixed, 2026-10-08:** each page now takes its width straight from the desk's measured height (and
never more than half the desk's width), which every engine reads the same way. Held sideways, the
app shows both pages filling the height between the bars. A test on the iPad simulator turns the
iPad, opens page 45, and checks the pages cover more than 40% of the screen's width across the
middle; it failed before the change ("the two pages cover 0%"). A browser test turns an iPad from
upright to sideways with a note open and checks the note's page is still there at full size. The
walk of the app in the simulator is now written into the native-shell skill, step by step.

### ㉟ Open a verse's number menu from the keyboard and press Down straight away: where does the keyboard land? · **fixed**

Found running the pitch tests in Safari's engine, the one the iPad and Mac apps use, on 2026-10-08.
The menu fills in a line at a time as the verse's note, look-alikes and roots arrive. Two things went
wrong when a key was pressed while it was still filling. The top line's words change when the book's
name arrives, and the menu treated new words as a new line: the button under the keyboard was thrown
away and the keyboard fell off the menu for a moment, so a key pressed then did nothing. And each time
the top line changed, the menu put the keyboard back on it, even after the reader had moved down.

**Fixed, 2026-10-08:** each line keeps a fixed name while the menu is open, so new words do not make a
new button, and once the reader has moved through the menu, a line arriving leaves them where they are.
Unit tests check both (each failed before its change); the browser test that found it now waits for the
menu to fill before pressing keys, and passed sixteen runs in a row in Safari's engine.

### ㊱ Does the book open on pages the same size as the rest, or does it jump at the first turn? · **fixed**

Found walking the pitch as a first visitor, 2026-10-08. The print draws its first two pages, Al-Fatihah
and the opening of Al-Baqarah, as a small square block of text with no page around it, and the app cut
the paper to that square. So the book opened on two squat cards, and at the first turn it jumped taller
to the page shape every other page has. The first thing a visitor does was the first thing that looked
wrong.

Three ways were drawn side by side on the real spread: leave it; page-shaped paper with the opening text
shrunk to the size of type every other page uses; and page-shaped paper with the opening text kept as
large as it was, centred top to bottom. The owner picked the third: a printed copy gives its opening
pages room, and the shrunk text looked lost on a large empty page.

**Fixed, 2026-10-08:** the two opening pages now sit on paper the size and shape of every other page,
the text across the page's full width and centred top to bottom, and a tap on a verse there still picks
that verse. A browser test opens page 3, then page 1, and checks both opening pages match page 3's paper
and are centred; it failed before the change (page 1's paper was 217 pixels short). The saved picture of
page 1 was retaken on the owner's pick. A frame like the print's ornament, to fill the space above and
below, is not built.

**The other way kept, 2026-10-08:** the runner-up, the opening text at the size of type every other page
uses, is a setting in the info panel ("The first two pages": large text, the default, or usual size), so
a reader who wants the opening to match the rest can have it. A browser test switches it in the panel,
checks the opening text then matches page 3's size of type and stays centred, that the choice survives a
reload, and that a click on a verse there still picks that verse; it failed before the setting existed.

### ㊲ On an iPad held upright, does the look-alikes list leave its verse in sight? · **fixed**

Found re-walking the iPad app on 2026-10-08, and the same in a browser at that size: a link to 2:48
with its look-alikes open magnified the page onto the verse and then put the list over it; only the
top of the verse's highlight peeked out above the list. The note on the same screen slid its verse
clear. The lists only said how high they reached on screens under 900 points wide, where they are a
band across the foot; an upright iPad is wider, so there the list is a card at the page's foot,
said nothing, and the page never moved.

**The fix:** the lists say where they start at every width, measured from the card's own foot, by
the same rule the note already used (now one shared piece both use). A card standing beside the
page, as on the two-page laptop view, still covers nothing and moves nothing. A browser test opens
the link on an upright iPad and on a phone and checks every line of the verse is above the list;
the iPad one failed first (the verse's last line 92 points under the list).

### ㊳ With the tips open, does the screen say the same thing twice? · **fixed**

Found walking an English first visit on 2026-10-08, on a phone, a laptop and an iPad: with the
three tips opened from settings, the first tip teaches tapping a verse to read its note, and the
line at the foot of the screen said the same thing at the same time.

**The fix:** the foot line stays quiet while the tips are up and comes back when they are put away,
the same turn-taking the storage notice already follows with the tips. A browser test opens the
tips, checks the line is gone, skips them and checks it is back; it failed first.

The same walk also saw the phone page keep its size under the tips, so its foot slides below the
bar. That is the phone's page rule working as meant (the page is sized from the screen's height and
a taller page can be dragged), no verse is covered, and the strip is gone after three taps; not
changed.
