# The revision record: what a tap is evidence of, and what it is not

> "how do we add an interaction calendar per page, hizb, juz based on clicks on ayahs?"

Task #88. This plan was written after three attempts to delegate it to a planning
subagent died in the harness; the research below was done directly against the code.

## Context

The want is real and it is the strongest feature idea this app has had since the hop: a
hafiz revising from a mus'haf loses track of what they have *not* touched. Recency is
invisible on paper. A heatmap over the book — this juz was revised Tuesday, that one not
since Ramadan — turns the app from a lookup tool into a revision partner.

Four findings from the code decide the shape, and three of them are constraints nobody
would guess from the outside.

### ① `juzOf` exists. Hizb does not exist anywhere in this repo.

`packages/core/src/quran-meta.ts:68` has `juzOf(surah, ayah)`, backed by `JUZ_STARTS` —
30 Tanzil juz boundaries, already exported from `packages/core/src/index.ts:31`. Juz
rollup is free today.

**Hizb has zero occurrences in `packages/core/src`, `apps/web/src` and
`packages/etl/src`.** Not a constant, not a comment. So "per hizb" is not a rendering
change over data we hold; it is new scripture metadata that has to be sourced, vendored
with a `SOURCES.md` entry and provenance, and gated — the same treatment the mutashabihat
corpus got, and that corpus is the one this project has already been burned by (#80: the
shipped edges were off by one, wrong for 47.8% of hops, and it took a gate to catch).

The tempting shortcut — *a hizb is half a juz, so derive 60 boundaries by splitting each
juz down the middle* — is *wrong*, and wrong in the way this codebase punishes. Hizb
boundaries are their own text division; they do not fall at the arithmetic midpoint of a
juz. A heatmap labelled "الحزب ١٢" that colours the wrong ayahs is the mus'haf equivalent
of the off-by-one, and no test in this repo would catch it. **Do not ship hizb on derived
boundaries.** Either vendor real `HIZB_STARTS` (60 pairs, same Tanzil provenance as
`JUZ_STARTS`, with a unit test pinning known boundaries) or ship page + juz and say hizb
is not here yet.

### ② The data this feature needs is exactly the data iOS deletes.

`apps/web/src/storage.ts` is unusually candid, and its closing paragraph is fatal to the
naïve version of this feature:

> iOS's ITP 7-day script-storage deletion … is not observable from script and `persist()`
> is not documented to stop its timer — on iOS the durable-offline mechanism is
> Home-Screen install.

A revision calendar's entire value proposition is *"you have not touched juz 12 in three
weeks."* On an iOS Safari tab, the record of those three weeks is deleted at day seven
**because** the hafiz did not open the app — the precise condition the feature exists to
report on. It does not decay gracefully; it silently resets to "no history", which reads
as "you have revised nothing", which is a lie told to someone about their own worship.

This is not a reason to abandon the feature. It is a reason that **the calendar must
report the age of its own record**, and that the installed-PWA path is a prerequisite
rather than a nicety. Concretely: store a `since` timestamp alongside the log, and let the
UI say "recording since 3 March" — so a record that has been silently reset announces
itself as a young record instead of an empty book. On iOS-Safari-not-installed, say so
and point at the existing install flow (`pwa.ts`).

There is a second, non-iOS eviction path already handled elsewhere in the repo: #77
("eviction is permanent") and the CDP-based eviction e2e (#69, #76). Whatever this feature
writes has to survive the same test, or explicitly declare that it does not.

### ③ Only 3 of 604 pages exist, and a calendar makes that gap *worse*, not neutral

The page bar (just shipped, #87) hit this and answered it: the track is the print, the
landing is the inventory, and it announces when they differ. A calendar is harder. A
heatmap of the mus'haf where 601 pages are permanently cold is not a caveat — it is a
picture that says "you have abandoned 99.5% of the Qur'an", and it says it to someone
doing hifz. The greyscale itself becomes the lie.

So the honest v1 is a heatmap **of what the build can show you** — page 7, 9, 19, and the
juz they fall in — with the unvisitable remainder rendered as *absent*, visibly and
differently from *cold*. Not the same grey at a lower opacity. A different treatment
entirely, captioned, in the same spirit as «المتوفّر ٣ من ٦٠٤ صفحة».

Which is the real conclusion: **this feature is worth building and worth gating on Loop
4b.** Build the recording now (it is cheap, it is pure, and every day it is not recording
is a day of history that does not exist later); build the *picture* when there is a book
to draw it over.

### ④ There is exactly one place to hook, and it does not mean what it looks like

`apps/web/src/App.tsx:447`, `handleSelect(key)` — one callback, already the funnel for
taps. But note line 451: it also fires on **toggle-off**, and `handleHop`/`handleJump`
(lines ~490, ~506) reach `setSelectedKey` without passing through it. So "clicks on
ayahs" is not one thing:

| signal | what it is evidence of |
|---|---|
| tap to select | the hafiz looked at this ayah |
| tap the same ayah again (toggle off) | they dismissed it — **not** a second look |
| arriving via a hop | the *app* moved them there; they were revising the source |
| arriving via a share link | someone else chose this ayah |
| a marquee over 12 ayahs | one gesture, not twelve revisions |

Recording all of these as equal "interactions" produces a heatmap of *app usage*, not of
revision, and the two diverge exactly where the feature is supposed to be useful. Record
the deliberate ones: a tap-to-select and a marquee release. Count a marquee as one event
over a span, not N events. Ignore toggle-off. Treat a hop arrival as a visit to the
*source*, not the destination.

**And say all this in the UI, once.** The honest label is not "revision calendar" — it is
closer to "what you have opened". The gap between "I tapped this ayah" and "I revised this
page" is real, and this codebase's whole character is refusing to paper over exactly that
kind of gap.

## The shape

```
packages/core/src/revision.ts        ← pure: events → per-day, per-scope tallies
  RevisionEvent { key, at }            (no storage, no DOM, no Date.now() inside)
  rollUp(events, scope, tz)          → Map<dayStamp, Map<scopeId, count>>
  lastSeen(events, scope)            → Map<scopeId, dayStamp>
  scopeOf(key, "page"|"juz")         → uses resolver's manifest for page, juzOf for juz

apps/web/src/revision-store.ts       ← the only impure part: read, append, prune, `since`
                                       IndexedDB (not localStorage — see below)

apps/web/src/components/RevisionMap.tsx  ← the picture. Gated on 4b for the full book;
                                           v1 shows the vendored pages + their juz.
```

**Storage: IndexedDB, not localStorage.** Not for size — the log is tiny (an event is
~16 bytes packed; a year of heavy use is well under a megabyte). For two other reasons:
localStorage is synchronous on the main thread and this app's whole perf story is frame
budget on a low-end phone (follow-up ①); and the existing eviction machinery and its e2e
already speak IndexedDB. Key by day, not by event, and merge in memory — an append-per-tap
write pattern is a write amplification problem on flash storage nobody will notice until a
field test.

**Privacy.** This is a log of when a person was reading Qur'an, which is a record of
worship. It never leaves the device: no fetch, no query string, no share link, no
`serializeState`. That is not a promise to make in a comment — it is a `gate:*` script of
the kind this repo already writes six of: fail the build if the revision module is
imported by `router.ts`, `ShareSheet.tsx`, or anything that constructs a URL. The existing
ESLint `import/no-restricted-paths` boundary is the natural place. Add it in the same
commit as the store, not after.

## Work, in order

1. **`packages/core/src/revision.ts` + tests.** Pure, framework-free, no clock inside —
   the caller passes `now`. This is where `rollUp`, `lastSeen` and `scopeOf` live, and it
   is testable to the day boundary, which matters because "today" is a timezone question
   and a hafiz who revises at 11pm and again at 1am has revised on two days.
2. **`apps/web/src/revision-store.ts` + tests + the import gate.** Append, read, `since`,
   and a prune policy stated up front (rolling 400 days — enough for "this time last
   year", bounded forever).
3. **Wire the two honest signals** in `App.tsx` — `handleSelect` (excluding toggle-off)
   and `handleSelectRange` (one event per release).
4. **`docs/use-cases.json`**: a `hafiz` use case, phrased as the want — *"show me what I
   have not touched in a while"* — with a `gap` field naming exactly what the proof does
   not cover, because on iOS-Safari it genuinely does not.
5. **`docs/validation/ledger.json`**: a `pending`, `owner: "user"` check with a runbook —
   revise on a phone across two days, confirm the calendar shows two days. No machine in
   this repo can prove a multi-day record survives a real device; that is what the ledger
   is for.
6. **The picture** (`RevisionMap.tsx`) — **after Loop 4b.** Steps 1–3 ship first and start
   recording; the map is drawn when there is a book to draw it on.

## Verification

- Unit: day-boundary and timezone cases in `revision.ts`; a marquee is one event; toggle-off
  is none; a hop credits the source.
- Component: the map renders "absent" differently from "cold", and says `since`.
- E2E: tap, reload, and the record survives — then run it through the existing eviction
  spec (#69/#76) and assert the app says the record was lost rather than showing an empty
  calendar as if it were a true one.
- Manual (ledger): the two-day test above, on a phone, installed and not installed.

## Deliberately not doing

- **Hizb on derived boundaries.** Ship page + juz; hizb waits for vendored `HIZB_STARTS`.
- **Streaks, goals, targets, badges.** A "you broke your 12-day streak" notification about
  Qur'an revision is a machine editorialising about someone's worship. The app shows what
  happened; the hafiz draws the conclusion.
- **Any sync, backup, or account.** See privacy.
- **Inferring "revised" from "looked at".** The label says what was recorded.
