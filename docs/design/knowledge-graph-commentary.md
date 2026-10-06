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

Two differences are left. In one note (98:5) a paragraph from somewhere else sits between the
two copies, so joining them would be a guess. And in places the second copy lost a full stop
the book has, so one sentence runs straight into the next with no stop between; the join puts
back the stops it can see, not ones the capture never had.

**What would answer it:** open the printed pages for 98:5 and a few of the run-on sentences
beside what the pitch shows, and either fix the capture or tell the extractor what the print
does there. Nothing here reaches the public site; it is only the pitch.

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
