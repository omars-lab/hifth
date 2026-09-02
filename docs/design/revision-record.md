# The revision record, and the picture of it

**Status:** the record is built (task #90) and the hizb scope landed with #92. The
picture — `RevisionMap.tsx` — is task #91, in progress. The umbrella is #88.

`docs/design/` holds the document you read *before* touching a feature.
`docs/decisions/loop-*.md` are the retrospective records of what a finished loop
settled. This file is the former; it is expected to change as the feature does.

---

## What this feature is

A hafiz taps an ayah to select it. Over weeks those taps accumulate into a fact
nothing else in the app can tell them: **which parts of the mus'haf they have not
opened in a while.** The picture is a map of the book, coloured by how recently
each division was last opened.

## What it is not, and why the name matters

It is **not** a revision calendar. A tap is evidence that someone *looked at* an
ayah. It is not evidence that they recited it, checked it, or corrected it. The
distance between those two is the whole reason this feature is careful, and it is
why the sheet is titled «ما فتحتَه من المصحف» — *what you have opened* — with the
gap said once, plainly, underneath: «النقر دليل على أنّك فتحت الآية، لا على أنّك
راجعتها».

A heatmap titled "revision" over a log of glances is the same class of defect this
codebase has already paid for twice — an interface stating something the data
cannot back. Naming the picture after what it can actually prove is the difference
between an instrument and a flattering one.

---

## The four findings that constrain the design

These came out of the research pass recorded in `.claude/plans/interaction-calendar.md`.

### ① The divisions had to be real before they could be drawn

`juzOf` existed; hizb did not. The tempting derivation — a hizb is half a juz —
agrees with the actual division for **4 of 30** even hizbs and misses by up to
**39 ayahs** (hizb 50, in juz 25; mean absolute deviation 10.6). Tanzil publishes
no `<hizb>` element at all: the division is 240 `<quarter>`, and a hizb is four of
them, so hizb *h* opens at quarter `4h − 3`.

A heatmap labelled «الحزب ١٢» over the wrong ayahs would have been the
mutashabihat off-by-one (#80) all over again, and nothing in the repo would have
caught it. So #92 vendored the quarters, `HIZB_STARTS` was read out of them, and
`gate:quran-meta` now re-derives all three structural tables from the vendored XML
on every push — including a check that fails if anyone regenerates `HIZB_STARTS`
by halving juz. The scope existed only after the boundary was real.

### ② The data this feature needs is exactly what iOS deletes

iOS deletes script-writable storage after seven days without interaction, and
`persist()` is not documented to stop it. So the record of the three weeks a hafiz
did not open the app is deleted *because* they did not open the app. It does not
degrade — it resets to empty, which reads as **"you have revised nothing"**, said
to someone about their own worship.

The defence is that the record knows how old it is. `since` is stored, written the
first time the store is **opened**, not the first time a look is recorded — because
those differ in exactly the case that matters:

- a record that has existed for a month and holds nothing means the reader did not tap;
- a record that has existed since this morning and holds nothing means we lost it.

Deriving `since` from the oldest surviving event would collapse the two and throw
away the only signal that a wipe happened. So the picture always shows
«يُسجَّل منذ …», and an emptied record is visibly a *young* record rather than an
empty book.

### ③ Absent is not cold

Only **3 of 604** pages are vendored (7, 9 and 19; Loop 4b / task #27 vendors the
rest). If the un-visitable 601 render as the same grey as "here, never opened", the
picture says *you have abandoned 99.5% of the Qur'an* — which is false, and cruel,
and entirely an artefact of the build.

So absent gets a **different treatment entirely**, not the same grey at lower
opacity: no fill at all, a dashed hairline, reading as *no paper here* rather than
*paper you neglected*. Absent cells are excluded from every count. The sheet
carries the inventory line in the spirit of the page bar's «المتوفّر ٣ من ٦٠٤ صفحة»,
counted in whatever unit is on screen.

This follows `PageSlider`'s precedent exactly: the track spans the **print** (604),
the inventory runs and the count show what the build **holds** — three when this was
written, 604 since Loop 4b — and it announces out loud when the two differ. The gap
is a limitation; saying so is what keeps it from being a lie. Note what did *not*
happen when the two numbers met: the count stayed. It is not a warning that expires,
it is the surface saying what is behind it.

### ④ Not every selection is a look

`App.tsx handleSelect` also fires on the **second tap of the same ayah**, which
means "dismiss" — recording it would double the score of every ayah the reader
changed their mind about. Hops and share-link arrivals bypass `handleSelect`
entirely, and rightly:

| Event | Recorded? | Why |
|---|---|---|
| Tap to select | **yes** | a deliberate look |
| Marquee release | **yes, once** | one look at a passage, not N looks at N ayahs |
| Toggle a selection off | no | that tap means "dismiss" |
| Arrival by a hop | no | the app moved them; the ayah they were studying is the **source** |
| Arrival by a share link | no | someone else chose that ayah |

Record all of these evenly and the result maps *app usage*, not revision — and the
two diverge precisely where the record was meant to be useful.

---

## Shape

```
packages/core/src/revision.ts      pure, clockless: dayOf · scopesOf · rollUp ·
                                   lastSeen · daysBetween · editionOf
packages/core/src/quran-meta.ts    AYAH_COUNTS · JUZ_STARTS · HIZB_STARTS ·
                                   juzOf · hizbOf   (gate:quran-meta)
apps/web/src/revision-store.ts     the only impure half: IndexedDB, the clock,
                                   `since`, the 400-day window
apps/web/src/components/RevisionMap.tsx   the picture
```

**Clockless core.** Nothing in `revision.ts` reads the current time, so a
day-boundary test is arithmetic rather than a mocked global.

**The timezone rides on the event.** "Which day was that?" is a question about the
clock the reader was living under, not the one they are living under now. A hafiz
who revises at 23:40 and again at 00:20 has revised on two days; one who revises
the night the clocks go back has an hour that happens twice. A single offset
applied at read time silently mis-files every event recorded on the other side of a
DST change or a flight — so each event carries the UTC offset in force when it was
recorded.

**IndexedDB, not localStorage.** Not for size — a look is under a hundred bytes.
localStorage is synchronous on the main thread, and a write on every tap is a write
*inside the gesture*, against an app whose entire performance story is the frame
budget on a low-end phone. And the eviction machinery already in this repo speaks
IndexedDB, so the record is covered by tests that already exist.

**Keyed by day, not by event.** Each tap is durable the moment it lands, with no
in-memory buffer to lose when the tab is killed. The alternative — batch and flush
— loses exactly the taps made just before the app was closed, which on a phone is
most of them.

---

## Privacy

The record is different in kind from everything else this app stores. A language, a
skin, a dismissed notice are preferences. This is a log of **when a particular
person was reading Qur'an, at what time of night, and which passages they kept
going back to.** That is a record of someone's worship, and the promise attached to
it is that it is theirs alone.

A promise like that written in a doc comment is a promise until the first refactor.
The failure mode is not malice, it is convenience: a share sheet that wants to
include "last revised", a URL builder handed one field too many, an analytics call
added to measure engagement. Each is one import away and none looks wrong in
review.

So the promise is `gate:revision-privacy`, with two invariants: a **closed
allow-list** of modules permitted to import the record, and no way out inside the
record's own modules — no `fetch`, no beacon, no WebSocket, no URL construction.
Deliberately a gate and not an ESLint rule: `import/no-restricted-paths` expresses
"this directory may not import that one", which is the wrong shape. The rule here
is a closed list of *importers*, and a gate that is wrong by default is not a gate.

---

## The picture

**Where it opens from.** The page chip «صفحة ٧» in the chrome. The header is at
capacity on a phone — `e2e/chrome-fit` holds it inside 320px with seventeen pixels
to spare, which is why the colophon opens from the wordmark and the language switch
lives inside that sheet. The chip was an inert `div`: pure decoration, the same
starting point the wordmark had. It already means *where am I*; tapping it gives
*where have I been*, with the current page marked. Costs zero header width.

**Default scope: hizb.** Sixty cells is a grid a thumb reads at a glance, and the
hizb is the unit huffaz actually plan revision in. Page (604 cells, 601 absent)
makes the vendoring gap the entire picture; juz (30) is too coarse to show a
pattern. All three are offered.

**Coverage is computed through `scopesOf`**, the same function that files a
recorded look. A vendored page is turned into a pseudo-event spanning its first and
last ayah and passed through the same code path — so the map's "absent" and the
record's "warm" can never disagree about which hizb a page belongs to. Two
implementations of that question would eventually drift, and the drift would be
invisible.

**A cell is one of three things**, and the three are visually distinct in kind, not
merely in intensity:

| State | Meaning | Treatment |
|---|---|---|
| absent | no vendored page falls in this division | no fill, dashed hairline |
| cold | vendored, never opened | filled, the coldest ink |
| warm | opened, shaded by days since last seen | filled, warming with recency |

Recency, not frequency: `lastSeen` is deliberately separate from `rollUp` because
the question the feature exists for — *what have I not touched in weeks* — does not
depend on how many times something was opened, only on when it last was.

---

## Deliberately out of scope

- **A streak counter.** It would reward opening the app, which is not the thing.
- **Any goal, target or completion percentage.** The record cannot see recitation,
  so a progress bar over it would be a number about worship that the data does not
  support.
- **Export or sync.** Both are ways off the device, and `gate:revision-privacy`
  exists to make adding one a deliberate act rather than a convenient one.

## Open questions, and what would answer each

Every design doc in this repo ends under this heading, and every item is an
`### ⓝ … · **status**` row so `pnpm gate:issues` can read it. The vocabulary is defined once
in [`docs/issues.json`](../issues.json).

### ① Warmth thresholds · **blocked**

The day-bands are a first guess. They want a hafiz's judgment, not a developer's — which
makes this a `docs/validation/ledger.json` candidate rather than something to settle here.
The bands decide what "cold" means, and a threshold chosen by whoever wrote the renderer is
a claim about someone else's revision habit.

### ② What the picture should do when tapped · **fixed**

Navigating to a division's first page is the obvious move and is not yet built; with 601 of
604 pages absent it would fail more often than it succeeded. Waits for Loop 4b — not because
the interaction is hard, but because an affordance that usually refuses teaches a reader not
to try it.

**Loop 4b vendored the 601, so the reason to wait is gone.** Every division's first page is in
the build, so the tap has a destination whichever cell it lands on, and what is left is the
design choice — which page, and what the announcer says — rather than a hole to route around.

**Which page: the lowest page of that division this build holds.** Not the division's first
page. `HIZB_STARTS` knows which *ayah* opens a hizb; it does not know which page of *this*
print carries that ayah, or whether this build carries it at all. So the landing is read off
the manifest, through the same `scopesOf` sweep that decides whether the cell is drawn at
all — `coverage` became `holdings` and returns a map from division to page instead of a set,
because the sweep that answers «is there paper here» can answer «and where» for free. A
landing the build cannot show is then unrepresentable rather than a case to remember. Lowest
rather than first-encountered, because nothing in `PageMeta` promises the manifest is
ascending — the same argument that already makes the sweep run per ayah rather than per page
span, and `holdings` has a test that hands it the manifest backwards.

**What the announcer says: the division and the page, at hizb and juz scope only.** «الحزب ٣ ·
صفحة ٢٢» — a reader who pressed a division and heard only a page number would be left to work
out whether it was the right one. At page scope the cell and the landing are the same fact,
so nothing extra is said and `goToPage`'s own `t.pageN` stands. The sentence is one ICU
message rather than two strings joined in the component: `${a} · ${b}` is a word order
decided in TypeScript.

**Absent cells are not controls.** A held cell is a `<button>` inside its `<li>`; an absent
cell stays a plain `<li>` with nothing to press. A button over a division we have no paper
for is the same false claim as drawing it cold, made in the cursor instead of in the fill —
and an affordance that refuses is worse than one that was never offered.

**The press does not write to the record it is displaying.** `recordLook` is called only from
the two honest signals in `App.tsx`; `goToPage` does not record. So opening a cold hizb from
the map does not warm the cell you just pressed, and the picture never draws the reader
looking at it.

**Rejected, and why.**

- *A division-start table.* The obvious source for "hizb 3 starts on page 22" is the print's
  own division table, and it is wrong for exactly the reason this item waited two loops: it
  describes the print, not the build. It would have been right for 604 pages and silently
  wrong for the next edition that ships partial.
- *`role="button"` on the `<li>`.* One element instead of two, and it destroys the list: a
  screen reader announces «list, 604 items» because they are `<li>`s, and a `role` overwrites
  that. The picture is an inventory before it is a set of controls.
- *One tab stop per cell.* 604 tab stops inside a Tab-trapped dialog is a map a keyboard
  reader cannot leave. The grid is a roving `tabindex` instead — one cell at `0`, the rest at
  `-1`, arrows stepping over the paper we do not have, `dir="rtl"` so ArrowLeft advances
  through the book. Which is also why `focusables()` here is no longer Colophon's verbatim
  copy: its `button:not([disabled])` would have collected all 604 and handed the trap a
  `last` element in the middle of the grid.

**WCAG 2.5.8 is met by exception, not by size, and that is worth writing down.** Page-scope
cells are 16px and cannot grow: a 604-cell map at 24px is no longer a map you can see at
once, which is the only thing it is for. Hizb (26px) and juz (40px) clear the threshold
outright. The criterion's *equivalent control* exception carries the page scope — the jumper
in the chrome reaches any page with a text field, and it is not a hidden alternative.

**Closed by** `apps/web/e2e/revision.spec.ts` (`pressing a hizb on the map opens it` — a real
tap, a real page turn, and the announcer read out of the live region) and
`apps/web/src/components/RevisionMap.test.tsx` (the press, the silence at page scope, the
absent cell that is not a control, and the single tab stop). The e2e asserts page **22**
specifically, which is the assertion that would catch a landing computed from a division table
instead of from the pages this build holds — the row below it trims 22–31 out of the manifest,
so the two rows check each other.

### ③ Multi-edition records · **fixed**

Page ids are only comparable within one edition; juz and hizb ids are comparable everywhere.
`editionOf` exists for the partition, but the picture does not yet use it — so a reader who
switches editions sees one record drawn as though it were two prints' worth.

**It is latent, not hypothetical, and the difference matters.** Exactly one edition is
`vendored` in `EDITIONS`, so no reader can build a mixed record today. But an IndexedDB
record outlives the build that wrote it: the looks already stored carry `hafs-kfqc` keys and
page numbers, and the day a second print ships they join the new print's grid without a word.
Which means the fix could not wait for the second edition — by then the wrong squares would
already be drawn, and there is no way to tell a wrong square from a real one after the fact.

**The asymmetry is the whole of it.** Writing the filter is a line; deciding *where* it
applies is the item. A page is a property of the paper — page 7 of the Madani print is not
page 7 of an IndoPak one — so a look at another print's page 7 must not colour this one. A
juz or a hizb is a division of the *text*, identical in every print, so a reader who revised
juz 5 revised juz 5 and filtering there would throw away looks that genuinely land on the
square being drawn. The tempting mistake is to partition uniformly, and it fails in the
quieter and worse direction: it shows a hafiz **less** revision than they did, over a picture
they will read as a statement about their own worship.

So the rule lives in core as `comparableEvents(events, scope, edition)` — filtering at page
scope, deliberately the identity elsewhere — rather than as a sentence in this module's doc
comment telling callers to partition first. It was that sentence before, and the one caller
did not. An unparseable key has no edition and is dropped at page scope, the same rule
`scopesOf` already follows: a gap in the picture is recoverable, a wrong square is not.

`RevisionMap` takes the edition as a prop rather than reading `pages[0].edition`. The pages
say which paper this build holds; the prop says which paper the record is being read against.
Those are two claims with one answer while a single edition is vendored, and deriving one
from the other would erase the distinction on exactly the day it starts to matter.

**Closed by** `packages/core/src/revision.test.ts` (`describe("comparableEvents")`) and
`apps/web/src/components/RevisionMap.test.tsx` — the component pair is the one that would
catch a regression end to end, and the two halves were verified separately by inducing each
failure: dropping the call from `RevisionMap` fails only the page-scope test, and removing
the `scope !== "page"` guard so it filters everywhere fails only the juz one. The fixture
uses `quran/hafs-indopak/2:30` on purpose — an ayah inside hizb 1 and juz 1, divisions this
build does hold paper for, so `absent` cannot answer for either assertion.

### ④ Is the rule "nothing leaves the device," or "nothing leaves unless it serves the reader"? · **open**

The privacy invariant and the *Export or sync* line under **Deliberately out of scope** both
state the stance as an absolute: nothing leaves the device. Reviewing the confusion-map export
decision, the owner sharpened it — the durable rule is not that nothing leaves, but that nothing
leaves *unless it is in the reader's interest, and under their control*. A flat *nothing leaves*
is a promise that breaks the first time the reader's own interest points outward — wanting a
hard-won record to survive a lost phone — and once broken it reads as abandoned; naming the test
instead keeps the promise. This does **not** loosen `gate:revision-privacy`: the gate exists to
make anything leaving a *deliberate* act rather than a convenient one, and "in the reader's
interest, under their control" is exactly the shape of a deliberate act — the gate stays, the
sentence it defends gets the truer wording. **What would answer it:** adopting the sharper
wording here and in the invariant's prose, so a future export/sync question is weighed by whether
it serves the reader rather than refused by reflex. The confusion-map export decision
(`confusion-map-export`, and open question ② in the confusion-points design) is the first place
this is being applied; this item exists so the revision-record framing is revisited against it
rather than left standing as an absolute the app no longer holds.
