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
the ticks and count show the **inventory** (3), and it announces out loud when the
two differ. The gap is a limitation; saying so is what keeps it from being a lie.

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

### ② What the picture should do when tapped · **blocked**

Navigating to a division's first page is the obvious move and is not yet built; with 601 of
604 pages absent it would fail more often than it succeeded. Waits for Loop 4b — not because
the interaction is hard, but because an affordance that usually refuses teaches a reader not
to try it.

### ③ Multi-edition records · **open**

Page ids are only comparable within one edition; juz and hizb ids are comparable everywhere.
`editionOf` exists for the partition, but the picture does not yet use it — so a reader who
switches editions sees one record drawn as though it were two prints' worth.
