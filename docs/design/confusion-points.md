# The confusion points a hafiz keeps for themselves

**Status:** design only. Nothing here is built. This document is what a later session reads
before turning it into an action plan; it is expected to change as the feature does.

`docs/design/` holds the document you read *before* touching a feature.
`docs/decisions/loop-*.md` are the retrospective records of what a finished loop settled.
This file is the former.

---

## A few words, defined once

- **Ayah** — a verse. Named by its surah and number, e.g. *the 48th ayah of surah 2*.
- **Mus'haf** — the printed Qur'an; the actual pages the app draws.
- **Mutashabihat** (المتشابهات) — verses that resemble each other across the Qur'an. Two
  passages a page apart or twenty juz apart can open with the same words and then part. They
  are the reason a memoriser's tongue takes the wrong turn.
- **Slip** — an *involuntary* wrong turn: you finish one phrase and your memory continues into
  the *wrong* verse, because somewhere else in the book a near-identical passage begins the
  same way. Resemblance pulled your tongue. This is the error the feature warns you about.
- **Jump** — when your memory *leaps* from a word to another place in the book, usually where
  the **same** phrase recurs. A jump can be an error (you skipped ahead) or just a connection
  you noticed — it is the neutral sibling of a slip, and the person gets to say which it was.
- **The seam word** — the exact word where two passages part: the last word they share, or the
  first word that differs. It is where a slip or a jump actually happens, and marking it there
  instead of at the whole ayah is what makes the capture precise.
- **A confusion point** — one recorded slip *or* jump: *from here, my memory went there.* It
  has a place it started (down to the seam word, when marked there), usually a place it went,
  and which of the two kinds it was.
- **The state of a seam** — how alive a confusion point is *right now*, which changes as you
  drill it: one you catch **every pass**, one that catches you **sometimes**, one you **used
  to** slip on and have since beaten, and one you have **dismissed** as not really a problem.
  The state is a note you own — *watch this one*, *you've got this now* — not a score the app
  computes about you.

---

## What is being designed, and why now

Today the app can tell a hafiz which verses *resemble* the one they are looking at — it reads
that off a corpus of mutashabihat that ships with the app. That is a fact about the Qur'an,
true for everyone. It is not a fact about **this reader**.

The thing a hafiz actually needs is narrower and entirely personal: not *which verses could
be confused*, but *which verses I keep confusing* — the three or four seams in the whole book
where my own tongue takes the wrong turn, every time, and the correction never quite sticks.
That set is small, it is different for every person, and no dataset can contain it because it
is a fact about one memory.

An app that only ever shows the shared, public resemblances is a reference. An app that learns
where **you** slip and warns you before you get there is an instrument you come to rely on —
the difference between a dictionary and a coach who has heard you recite. That reliance is the
whole point of building it: a hafiz revising alone, at night, has no teacher to say "careful,
this is the one you always miss." This feature is that sentence, said by the app, at the
moment it matters, because the reader themselves put it there weeks ago.

It is asked now because everything it needs already exists in the app — a way to select an
ayah, a graph of resembling verses to draw candidate slip-targets from, and a proven pattern
for keeping a private per-reader log on the device. What is missing is small and additive.

## What it is not

It is **not** a notebook. Hifth is a navigation instrument, not a place to write. A confusion
point is not a paragraph of reflection; it is two coordinates and a direction — *from here,
toward there* — captured in one gesture and read back as a warning on a page. If a screen in
this feature ever invites the reader to *write*, the design has drifted into an app this one
deliberately is not.

It is **not** a second mutashabihat dataset. It does not try to be complete, and it makes no
claim that the pairs a reader records are the "real" look-alikes. It records exactly what one
person hit, nothing more — and that narrowness is the value, not a shortfall.

It is **not** a score. There is no accuracy percentage, no streak, no "verses mastered." A
number about someone's worship that the data cannot actually support is a mistake this
codebase has already named and refused elsewhere, and it would be the same mistake here. The
per-seam *state* below (*every pass*, *used to*) is the near-miss to watch: it stays a note the
reader owns about one seam, never a total added up across seams — the moment it becomes a count,
it has become the score.

---

## What the experience is

Three moments: catching a slip the instant it happens, being offered the right target so you
rarely have to hunt for it, and being warned near your own known slips ever after.

### How do you record a slip without breaking your recitation?

The rule the whole capture rests on: **it must cost one gesture from the ayah you are already
on, and it must never make you type a verse number.** A hafiz mid-revision who has to stop,
open a menu, and key in "37:130" will do it twice and never again. So the capture is built
*out of the slip itself*.

Here is the moment. You are reciting; you were on an ayah; your memory just jumped the rails.
That ayah is already selected — selecting it is how you were reading. A single control rides
with the selection:

```
  ┌─────────────────────────────────────────────┐
  │   … the page, with your ayah lit in amber …   │
  │                                               │
  │                      ┌──────────────────────┐ │
  │   selected ayah ▓▓▓  │  ↻  متشابهات      (4) │ │  ← the hop rail, already here
  │                      ├──────────────────────┤ │
  │                      │  ⚠  التبستُ هنا        │ │  ← the one new control: "I slipped here"
  │                      └──────────────────────┘ │
  └─────────────────────────────────────────────┘
```

One tap on *«التبستُ هنا»* (*I slipped here*) opens the capture sheet. It arrives already
knowing where you started, so the only question left is where you *went*:

```
  ┌─────────────────────────────────────────────┐
  │   التبستُ عند   ٢ : ٤٨            [ source ]  │
  │   ذهب حفظي نحو… ?  (my memory ran toward…)   │
  │  ───────────────────────────────────────────│
  │   ↻  ٢ : ١٢٣    …same wording, context differs│ ← candidates, drawn from
  │        وَٱتَّقُواْ يَوْمًا …  ▟ shared words shown  │   the app's resemblance graph
  │   ≈  ٢ : ٢٨١    …opens the same, then parts   │
  │   ↻  ٣ : ٩       …                            │
  │  ───────────────────────────────────────────│
  │   ✎  آية أخرى…  (another verse — pick it)     │ ← escape hatch: the jumper
  │   ?  لستُ متأكدًا بعد  (not sure yet)          │ ← capture source-only, resolve later
  └─────────────────────────────────────────────┘
```

In the common case the verse you slipped toward is **already in the list**, because the verse
you slip toward is, almost by definition, one that resembles the one you were on — which is
exactly what the resemblance graph already knows. So the whole capture is: one tap to open,
one tap on the right candidate. Two taps, no typing, no leaving the page. You are back
reciting in the time it took to notice you were wrong.

Two exits handle the rest. *«آية أخرى»* hands you the existing surah-and-ayah jumper for the
times your slip landed somewhere the graph did not predict. *«لستُ متأكدًا بعد»* records the
source alone — a confusion point with a known start and an open end — so a slip is never lost
just because you could not name where it went in the half-second you had; you resolve it later
from the review list.

And if the same slip happens again next week, capturing it a second time does not make a
duplicate — it deepens the one you have, so the review side can tell a slip you hit once from
a seam you hit every single pass.

### What if I know the exact word — not just the verse?

The ayah-level control above is the fast path: it costs one gesture and asks nothing but *which
verse*. But often you know more — you know the exact word where your tongue took the wrong turn,
because that word *is* the moment it happened. There is a second, more precise way in for that
case, and it costs the app nothing new: **hard-press the word itself.**

The app already has a hold gesture that drops to word granularity — it is the reason the
ayah-level control was deliberately built *not* to collide with it. A firm press on a single
word hangs off that existing hold, which also means the app is already intercepting the touch,
so it sidesteps the phone's own text-selection menu that would otherwise fight for the same
gesture. The press raises a small menu anchored to the word, and the menu is where *slip* and
*jump* part ways:

```
  ┌─────────────────────────────────────────────┐
  │   … وَٱتَّقُواْ  [يَوْمًا]  لَّا  تَجْزِى …            │  ← hard-press one word
  │                 ┌──────────────────────────┐  │
  │                 │  ⚠  التبستُ هنا      slip │  │  ← pulled onto a look-alike (a warning, later)
  │                 │  ↷  قفزتُ من هنا     jump │  │  ← leapt to the same phrase elsewhere
  │                 │  ✎  علّمها…          mark │  │  ← just flag the word, decide which later
  │                 └──────────────────────────┘  │
  └─────────────────────────────────────────────┘
```

Two things the whole-ayah path cannot give come for free here. First, the pressed word is the
**seam word** — the precise point of divergence — so the capture records not just *from this
verse* but *from this word*, and the candidate list can rank by which verses share the opening
*up to and including that word*. That is exactly the opening-word signal open question ③ worries
about having to *build* an index for: when the reader marks the word, the app is handed the seam
instead of having to infer it. Second, the menu is where the reader **names the kind**:

- ***I slipped* (التبستُ)** — an involuntary wrong turn. This is the one that becomes a private
  *warning* on the page later, and its likely target is a verse that merely *resembles* this one,
  so the sheet ranks resembling verses first.
- ***I jumped* (قفزتُ)** — a leap to another place, usually where the *identical* phrase recurs.
  It may be an error or just a connection worth keeping; its likely target is the word-for-word
  **twin** the graph already flags, so the sheet surfaces twins first. Because a jump is a real
  path the reader's memory takes — not only a mistake — it is the natural candidate to become a
  *navigable* link rather than only a warning (open question ④).
- ***Just mark it*** — flag the word now, choose slip-or-jump and the target later from the
  review list, for the half-second when you cannot say more.

The verb the reader picks is not cosmetic: it decides how the candidate list is ranked, and
which read surface the point feeds — a warning for a slip, a possible edge for a jump. The two
capture paths coexist by design: the visible ayah-level control stays the discoverable default
and the "I only know the verse" path; the hard-press is the precision path for "I know the word,
and I know whether I slipped or jumped."

### Where do the suggested targets come from?

The candidate list is the sharpest part of the experience, so it is worth being exact about
its source. The app already carries, for most ayahs, a set of typed links to verses that
resemble them — the same links the app's core navigation is built on. When you open the
capture sheet on an ayah, those links *are* the candidates. Nothing new is fetched or
computed for the common case; the feature reuses what is already on the device and offline.

The ranking, though, wants to be different from the ranking navigation uses, because a slip is
**directional and happens at a seam**. A memoriser reciting forward slips at the *opening* of
the next phrase — the wrong continuation begins with the same words as the right one. So the
best slip-candidate is not merely the verse that shares the most words *somewhere*; it is the
verse whose *opening* matches, and above all the verse that is **word-for-word identical** to
the one you were on (the graph already flags these — they are the cruelest slips and belong at
the very top of the list).

There is an honest gap here, and the design names it rather than papering over it. The
resemblance graph the app ships is **curated and deliberately not exhaustive** — it covers
roughly a quarter of the book's ayahs, not all of them. For an ayah the graph says nothing
about, the capture sheet would open with an empty candidate list and fall back to the jumper —
workable, but not the one-tap experience. Closing that gap needs a similarity signal the app
does not compute today: an index of **shared opening words** (the first few words of each
ayah's likely continuation), or shared *rasm* (the bare consonant skeleton, which is what the
eye and tongue actually confuse), so that even an un-curated ayah can offer candidates. That
signal is new work, described in *What is it built on* below, and it is the one part of the
smart-suggestion that is not free.

### What is the captured set *for*?

Capturing is worthless if nothing reads it back. The point of writing these down is that *we
are now aware of them* — so the reading side is the feature, and the capture merely feeds it.
Three faces, in rough order of value:

**A quiet marker at the seam — details when you want them.** This is the payoff, and it must
not shout. An earlier draft popped an alert onto the page the instant you landed on a logged
ayah; a reviser found it too intrusive, and they were right — an interruption on every pass is
the fastest way to get a feature switched off. Instead, a small **breakpoint-style marker** rests
right after the word you slip on — like a debugger's breakpoint at the exact line where execution
derails. It sits there quietly, coloured by the seam's state, and interrupts nothing:

```
  ┌─────────────────────────────────────────────┐
  │   … وَٱتَّقُوا۟ يَوْمًا ● لَّا تَجْزِى نَفْسٌ …        │  ← the marker rests after the seam word
  └─────────────────────────────────────────────┘
        tap the marker ↓  (only when you want to dig in)
  ┌─────────────────────────────────────────────┐
  │   recorded slip                    every pass │
  │   you slip at  يَوْمًا  toward  2:123          │
  │   5 times · last time last week               │
  │   [ ↔ compare the seams ]   [ ✓ beat it ]     │
  └─────────────────────────────────────────────┘
```

Nothing opens until you tap the marker. Then the recorded slippage: where your memory goes, how
often and how recently, the seam's state, and two actions — hop to the verse you confuse it with
so you can compare the two seams deliberately (the correction a teacher would walk you through),
or mark it *beaten* the day you stop slipping on it. The marker's colour alone already carries the
one bit that matters — how live the seam is — so even unopened it earns its place. This is the
reliance argument made concrete: the app knows your weak point and marks it, without ever getting
in your way.

**A list to review.** Every confusion point, browsable — sorted by how often you hit it (the
seams you slip on *every* pass float to the top) and by how recently. Each row names both ends
and jumps to either. This is the pre-revision glance: *these are my known weak points; let me
drill them before I start.*

**A map of your own weak seams.** A picture of the mus'haf coloured by where your slips
cluster — the personal twin of the resemblance map the app already draws for everyone. It
tells a hafiz something no dataset can: *my confusions are all in the last third*, or *they
cluster around the stories that repeat*. This is the most speculative of the three and the
last to build; the warning and the list carry the feature on their own.

### Not every seam is equally alive — the state a confusion point moves through

A flat list of everywhere you ever slipped is the wrong thing to read back. What a reviser
needs to know is which seams are still live — and, just as much, which ones they have *beaten*,
because that is the progress the feature exists to earn. So every confusion point carries a
**state**, and the state changes as the reader works the seam:

- **Every pass** — this one catches you each time. It warns loudest, sorts to the top of the
  list, and burns hottest on the map. It is the *this is the one you always miss* the feature
  was built to say.
- **Sometimes** — it catches you on some passes and not others. A quieter warning, mid-weight
  on the list and map. Most seams live here.
- **Used to** — you slipped here, and you have since beaten it. It stops nagging: no warning, or
  at most a faint *you beat this one — still solid?* It stays visible on the list and the map,
  in the calm colour, because a seam you conquered is a thing worth seeing. This is the
  encouraging half of the whole feature — the app remembers your wins, not only your weak spots.
- **Dismissed** — you flagged it (or a single stray capture did) and it is not, on reflection, a
  real problem. It goes quiet and drops off the list. Distinct from *used to*: nothing was
  beaten, it simply was not a seam. (The true "I never slip here" is the seam you never logged
  at all — this state only exists to retire a false flag so it stops nagging.)

The state moves along a natural arc. A new capture is born **sometimes**. Capturing it again and
again may nudge it toward **every pass**. And the moment that matters most is the good one: you
land on a seam, the warning fires, and this time you *don't* slip — a single tap on *«beat it»*
retires it to **used to**. A flag you decide is noise gets **dismissed**. The three read
surfaces all read the state: the warning changes weight by it, the list groups by it (live seams
to drill up top, beaten seams below), and the map colours by it, adding a calm fourth colour for
the seams you have conquered.

Two guards, because this is exactly the shape that decays into a score. First, **the reader owns
the state.** *Every pass* / *used to* are notes a person sets about themselves, the way a teacher
writes *watch this* or *you've got this now* in a margin — not a rate the app computes, which it
could not honestly compute anyway, since it sees your *captures*, never your recitation. The app
may at most **nudge** — *nothing logged here in six weeks; retire it?* — and never assert. Second,
**the states are never added up.** There is no "seams beaten: 12", no percentage, no streak
across seams; each state describes one seam's own standing and stops there. The instant a state
becomes a number about the reader, it has become the score this feature refused.

---

## What is it built on?

*(This section names files and symbols; it is the one section that does. Everything above and
below is meant to be followed by someone who has never opened the repository.)*

Most of this feature is assembly of parts the app already has. The honest split:

### Reused, essentially as-is

- **Selecting the ayah you slipped on, and pressing the seam word.** `packages/core/src/resolver.ts`
  (`class Resolver`) turns a point on the page into an ayah key like `quran/hafs-kfqc/2:48`;
  `pointerIntent` in `packages/core/src/gestures.ts` already classifies taps, holds, and
  marquees. Both capture paths reuse this and add no gesture: the ayah-level control hangs off
  the existing selection, and the word-level hard-press reuses the **hold that already drops to
  word granularity** — the menu is new UI on an existing gesture, not a new gesture, and because
  `pointerIntent` already claims that hold, the word menu does not fight the phone's native
  text-selection callout.
- **The candidate slip-targets.** `packages/core/src/adjacency.ts` is the reuse that makes the
  smart suggestion nearly free. Its `Edge` interface already carries everything the capture
  sheet needs: `type` (`"mutashabih" | "related-meaning" | "shared-root"`), `to` (the target
  key), `page`, a precomputed `dir`, an optional `span`/`toSpan` (which words overlap), and —
  crucially — `twin` (identical wording, the sharpest slip). The per-ayah shards live at
  `apps/web/public/assets/adj/hafs-kfqc/`, already on the device and offline. `bucketEdges`
  and especially `orderForHifz` are the starting point for the slip-candidate ranking.
- **Showing which words two look-alike ayahs share.** `packages/core/src/verse-diff.ts`
  (`wordDiff`) already computes the diff as arithmetic on word indices — no scripture text in
  the bundle. The capture sheet's "shared words shown" line and the warning's compare-hop reuse
  it directly.
- **The escape-hatch jumper.** The `wayfinding` feature's surah/ayah jumper is the "another
  verse…" path.
- **The persistence pattern, wholesale.** `apps/web/src/revision-store.ts` +
  `packages/core/src/revision.ts` are the exact template: a **pure, clockless core module**
  and a single **impure store** over IndexedDB, with a `since` stamp written when the store is
  first opened, a once-per-day prune, and a privacy gate (`gate:revision-privacy`) that holds a
  closed allow-list of modules permitted to import it and forbids any `fetch`/URL construction
  inside it. `apps/web/src/storage.ts` already owns the durability/eviction story this store
  inherits.

### New, and honestly costed

- **The personal confusion store.** A new pure module (say `packages/core/src/confusion.ts`)
  and its store (`apps/web/src/confusion-store.ts`), following revision-record beat for beat. A
  confusion point is small — a *from* key, an optional *to* key, an optional **seam-word span**
  (filled when captured by hard-press on a word, empty when captured at the ayah), a **`kind`**
  of `"slip" | "jump"` (the verb the reader chose, which routes ranking and read-surface), a
  first-seen and last-seen stamp, a hit `count`, and a reader-owned **`state`** of
  `"sometimes" | "every-pass" | "retired" | "dismissed"` (default `"sometimes"` on first
  capture) that drives warning weight, list grouping and map colour; keyed by the *(from, to,
  kind)* triple so re-capturing the same slip increments `count` rather than duplicating, while a
  slip and a jump between the same pair stay distinct. The `state` is set by the reader, never
  computed — the store may surface a nudge from `count` + last-seen but writes `state` only on an
  explicit act. Plus its own privacy gate, `gate:confusion-privacy`, the same shape as
  revision's.
- **The slip-candidate ranking.** New, but small: an ordering over existing `Edge`s that puts
  `twin` first, then opening-word overlap, then longest shared run. It lives beside
  `orderForHifz`, not inside the store.
- **The opening-word / rasm similarity signal** — the only genuinely new *data* work, and only
  needed to give candidates for ayahs the curated corpus does not cover. Options range from a
  build-time index of each ayah's opening n-gram (ETL, beside `build-adjacency.mjs`) to a
  runtime rasm comparison. Deferrable: phase 1 ships with corpus-only candidates and the jumper
  fallback, and this signal is what later makes the empty-list case rare.
- **The three read surfaces** — the at-selection warning (a new chip near the selection,
  wired in `apps/web/src/App.tsx` the way the revision `since` line is), the review list, and
  the personal map (a near-clone of `apps/web/src/components/RevisionMap.tsx`).

---

## What we already know that constrains this

- **The resemblance corpus is deliberately partial.** It is curated, covers roughly a quarter
  of the book's ayahs, and its maintainers chose selectivity on purpose. So corpus-only
  candidates will sometimes come up empty, and the design must degrade to the jumper without
  apology — the same way the app already degrades a hop whose target page is not vendored.
- **On-device storage is not permanent on iOS.** iOS deletes script-writable storage after
  seven days without interaction, and `navigator.storage.persist()` is not documented to stop
  it. The revision record met this by stamping `since` so an emptied log reads as *young*
  rather than as *you have revised nothing*. A confusion map is **more** painful to lose than a
  glance log — it is weeks of hard-won self-knowledge — which sharpens rather than settles the
  open question about durability below. On iOS the real defence is Home-Screen install, which
  the app already treats as a feature.
- **A private log must stay private by construction, not by good intentions.** The revision
  record's privacy is enforced by a gate, not a doc comment, precisely because "add it to the
  share sheet" is always one convenient import away. This feature inherits that stance
  unchanged: a record of where a particular person's memory fails is at least as sensitive as a
  record of when they read.
- **An annotation layer must not ride along inside a shared link.** A past loop already settled
  that a beta annotation layer stays *out* of the URL parameters, so that opening someone else's
  shared link can never silently switch a personal layer on for a reader who never chose it
  (`docs/decisions/loop-6a.md`). A confusion map is exactly such a layer, and it inherits that
  rule: the warning, the list and the map are reached from the app's own chrome, never encoded
  in a link.

## What people outside this project do about it — and a caveat

**I did not do a fresh external scan for this design.** Known mutashabihat study tools exist
(the problem is old — there are printed books and a handful of apps organised around it), and
the app's own vendored resemblance corpus, itself a Qari's hand-curated confusion list, is
prior art for *the public half* of the problem. There is also relevant prior art **already in
this repo**: an earlier decision looked at a larger external mutashabihat collection and at the
W3C Web Annotation Data Model as a way to structure annotations
(`docs/decisions/comparison-crop.md`), which the personal-note shape here should be checked
against before it is fixed. What I did *not* survey is how existing tools handle the
*personal-capture* half — one-tap logging, and warning at the point of risk — so that is owed a
proper look before the plan is costed, and the review-list and map designs above should be
checked against whatever it turns up. Flagging it rather than pretending I looked.

## Deliberately out of scope

- **Free-text notes of any length.** At most a short optional label; never a journal. See
  *What it is not.*
- **Any score, streak, or completion metric.** The data cannot see recitation, so a number
  over it would be a claim about worship the record does not support.
- **Turning your personal slips into shared navigation edges** — i.e. feeding captured pairs
  back into the hop rail everyone sees. That blurs a private log into the public routing table
  and is a privacy and provenance decision, not a default. Listed as an open question, not
  built.

## Open questions, and what would answer each

Every design doc in this repo ends under this heading, and each item is an
`### ⓝ … · **status**` row so the issues gate can read it. The status vocabulary is defined in
`docs/issues.json`.

### ① How durable must a confusion map be, given iOS wipes it? · **open**

Following revision-record's pattern gives IndexedDB plus a `since` stamp — enough to keep an
emptied log from lying about itself, not enough to keep it from emptying. For a glance log that
is an accepted cost. A confusion map is different in weight: it is the distilled product of
months of revision, and losing it silently is a real harm to the exact reliance this feature
is built to earn. **What would answer it:** a human's call on whether `since` + Home-Screen
install is a sufficient defence, or whether this feature is the one that finally justifies an
export/backup path (see ②) — and if the latter, that changes the privacy stance below. This is
the sharpest question and the one most worth settling before code.

**Owner's direction (2026-08-29):** reviewing the walkthrough, the owner asked that the map be
*durable storage* on the web that survives a cache flush, *with the option of backing up to a
downloaded file and re-uploading it*, and — longer term — saved to iCloud once there is a mobile
app. That is a clear lean toward "yes, this justifies a backup path," which moves the answer here
and hands the privacy question in ② its leading option. Captured, not yet settled: the file-backup
half is now being opened as a full decision (see ②), and the iCloud/sync half rides on the mobile
track, which is gated elsewhere.

### ② Should a confusion map ever leave the device? · **open**

Revision-record's settled stance is that anything off the device is a *deliberate* act, guarded
by a gate — no export, no sync. Two real pulls argue the other way here: a hafiz wants to back
up something this precious (question ①), and a **teacher** wants to see a student's confusion
map to drill them on it, which is a genuinely valuable use this app's navigation nature does
not otherwise serve. Against both: a record of where a person's memory of the Qur'an fails is
intimate, and "export" is the first step of every privacy erosion. **What would answer it:** a
decision, and because it is a genuine either/or with a privacy cost, it wants a decision record
and a published options page — see the register note below. It is not settled here.

**Owner's direction (2026-08-29), and the two mechanisms it names.** The owner leans toward
letting the map leave the device, and named two distinct ways of doing it, which this question
must keep apart because they carry very different privacy costs:

- **A user-controlled file backup** — export to a downloaded file, re-upload to restore. Nothing
  leaves the device unless the reader deliberately saves the file, and it goes only where they put
  it. This is the lighter-cost mechanism and the leading option; it is the half now being opened as
  a full decision.
- **Automatic cloud/iCloud sync** — the map copies itself to a third-party cloud so it survives a
  lost phone and follows the reader across devices. Materially heavier: an intimate record now lives
  on someone else's server continuously, not only when the reader chooses. On the web this is not
  directly reachable at all (a browser app cannot sync to iCloud); native iCloud/CloudKit needs the
  **mobile-app wrap**, which is roadmap Track B and gated on the app-store licensing question
  (`gpl-and-the-app-store`). So this mechanism is not a near-term option and is tracked as riding on
  that track, not opened here.

The teacher-sharing pull above is a *third* mechanism again and stays part of this question. The
decision being opened covers the file-backup option first; sync and sharing are named in it as the
heavier options it is deliberately not taking yet.

### ③ How are slip-candidates ranked, and is the opening-word signal worth building? · **open**

Phase 1 can ship with corpus edges ranked `twin` → shared-run and the jumper as the fallback
for un-covered ayahs. Whether that is *good enough*, or whether the opening-word / rasm signal
is needed to make the common case truly one-tap, is a judgment about how often real slips land
on ayahs the curated corpus omits. **What would answer it:** a hafiz trying capture on their
own real slips and reporting how often the right target was absent from the list — a
validation-ledger candidate, not something to settle from the renderer. The ranking order
itself (does opening-word overlap beat longest-shared-run for *slip* prediction?) wants the
same human judgment. Note that hard-press capture *changes the shape of this question*: when the
reader marks the seam word, they hand the app the opening-word signal directly, so the built
opening-word / rasm index is needed only for ayahs captured at the *whole-verse* level — which
shrinks, but does not remove, the case for building it.

### ④ Does a captured slip become navigable like a corpus edge? · **open**

Should your own confusion points appear in the hop rail as a fourth kind of link — *your*
edges, alongside the corpus's — so the app you navigate is shaped by your own history? It is
appealing and it is a privacy/provenance question: it mixes a private log into the surface that
draws public, sourced links, and the store's whole privacy gate is built to keep those apart.
**What would answer it:** a decision on whether the warning-at-selection surface (which keeps
the log private) already delivers this value without merging the two, which is the current
design's bet. The slip/jump distinction narrows the question usefully: a **slip** is an error
and belongs on the warning surface, where the current bet keeps it; a **jump** is a real path
the reader's memory takes, which is a far more natural thing to make navigable. So the sharper
form of this question is *whether jumps — not all confusion points — become edges*, and slips
stay warnings regardless.

### ⑤ Who sets a seam's state — the reader, or the app's guess from the data? · **open**

Each confusion point carries a state — *every pass*, *sometimes*, *used to*, *dismissed* — and
the question is who writes it. The design's bet is **the reader owns it**, because the store sees
*captures*, not recitation: silence at a seam could mean *I beat it* or *I stopped logging*, and
the app cannot tell which, so a state it computed would be the very score this feature refused.
The counter-pull is friction: a reader who never taps *«beat it»* leaves conquered seams warning
forever, and a gentle inference (*nothing here in six weeks — retire it?*) would spare them. **What
would answer it:** a human's call on how strong the nudge may be — whether the app is allowed to
*suggest* a state change from `count` + recency (and how loudly), while the write itself stays an
explicit act — or whether even a suggestion leans too far toward measuring worship. Leaning
reader-owned-with-a-quiet-nudge, but the line between *nudge* and *assertion* is the thing to
settle, and it echoes the durability and score stances above.

### ⑥ Should a student be able to hand their confusion map to a teacher? · **open**

A hafiz revises with a teacher, and the teacher's whole job is to drill the student exactly
where they are weak — which is precisely what the confusion map records. So there is a real
pull to let a student *share* their map with a teacher, and the owner has said yes to it as a
thing worth having, and asked that it be its own feature rather than folded into anything else.
It is kept apart from the backup question on purpose: a backup is a reader keeping their own
copy safe, while sharing sends an intimate record — where *this person's* memory of the Qur'an
fails — to *another person*, which is a larger privacy step and a different consent. **What
would answer it:** its own decision, drawn like any other — who initiates the share and who can
undo it, whether the teacher sees a live map or a snapshot the student chose, and whether this
rides on the file-backup mechanism (a student sends a teacher the file they already can save)
or wants something built for it. It should not borrow the export decision's answer; that
decision deliberately does not settle this.

### ⑦ Should the app learn where *most* readers slip, not just where you do? · **open**

Every reader's map is a record of the places the same few look-alike verses trip people up,
and across many readers those places would cluster — there are verses the whole tradition warns
about. The owner has asked whether the app could do that analysis: pool what many readers slip
on to find where people most commonly slip. The value is real — it could seed a new reader's
warnings before they have slipped even once, and it could tell us which verses the resemblance
model most needs to cover. But it is a sharp turn away from everything else this feature is:
every other part keeps one reader's map on one reader's phone and lets nothing leave without a
deliberate act, and this asks to gather many readers' maps in one place. That is not an
extension of the private design; it is close to its opposite, and it carries the heaviest
privacy question the project has yet raised — an intimate record, pooled, off-device, by
default. **What would answer it:** a decision that treats the pooling itself as the thing being
weighed — whether it can be done only with data a reader knowingly contributes, whether what is
pooled can be stripped of anything identifying and still be useful, and whether the app needs a
server at all to get the benefit, or whether the common slip points are already knowable from
the corpus without touching anyone's map. Named here so it is not lost; built by nobody until
that decision is made.

---

## A rough plan, in order — not yet costed

An implementer would likely proceed in these phases. Ordered by dependency, not committed to
dates; each phase is useful shipped alone.

1. **Settle the stance (a decision, not code).** Answer open questions ① and ② at least
   provisionally, because they decide whether the store needs an export path and how strict the
   privacy gate is. Register the feature and open the export/share decision (see below).
2. **Capture, corpus-only.** The pure confusion model and its IndexedDB store, the privacy
   gate, the `since` stamp and daily prune — all cloned from revision-record. The one-tap
   *«التبستُ هنا»* control on the selection, and the capture sheet drawing candidates straight
   from the existing resemblance edges with the `twin`-first ranking. Jumper fallback for
   empty-candidate ayahs. This is a whole, useful feature on its own: slips get recorded.
3. **The warning at the point of risk, and the review list.** Wire the at-selection warning
   chip in the app shell, reusing the verse-diff for the compare-hop; build the review list
   with jump-to-either-end and the hit-count sort. This is where capture starts paying back —
   arguably the real v1.
4. **The personal confusion map.** The picture, a near-clone of the revision map, coloured by
   slip clusters. Highest polish, lowest urgency.
5. **(Gated on question ③) The opening-word / rasm similarity signal.** Only if phase-2
   validation shows corpus-only candidates come up empty too often. New ETL or runtime work to
   give candidates for un-curated ayahs.
6. **(Gated on question ② saying yes) Export / teacher-share.** Only if the decision goes that
   way, and built as the deliberate, gated act the privacy stance demands.

## Where a row would go (recommendation only — nothing edited here)

- **`docs/map.json`** — a new `features` row, `confusion-points`, layer `L1 core`, pointing at
  the new pure module, its store, the ranking, and the read surfaces, in the same shape as the
  `revision-record` row.
- **`docs/issues.json`** — the seven open questions above become rows: ①, ②, ⑤, ⑥ and ⑦ as
  `question` severity (owner likely `user`), ③ as a validation-ledger-linked `risk`, ④ as a
  `question`. Two of them, ② and ⑥, are the kind that want a full drawn decision, not just a
  row; ⑦ is heavier still and is flagged as the project's sharpest privacy question to date.
- **`docs/decisions.json`** — open question ② (does a confusion map leave the device?) is a
  genuine either/or with a privacy cost and is the one that wants a full decision record. Note
  the gate's requirement: an *open* decision row must carry both a published `artifact` page and
  a checked-in `page`, drawn on a real mus'haf, or the decisions gate fails — so opening this row
  means producing that options page, not just adding a line.
- **`docs/use-cases.json`** — a new hafiz case, roughly *"I keep slipping from this ayah into
  that one — let me record it so the app warns me next time,"* which is the personal companion to
  the existing `hop-to-something-that-resembles-it` case.
</content>
