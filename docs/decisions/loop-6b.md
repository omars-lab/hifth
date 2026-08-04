# Loop 6b — Pin-a-juz packs

**Status:** complete-with-deferral. The half that can be proven here is proven; the half that
needs eight days of a real phone's own schedule is
[`offline-survival-8-day`](../validation/ledger.json) in the ledger, and it is *runnable* for
the first time because of this loop.
**Date:** 2026-08-04.
**Gate it inherited:** Loop 4b, i.e. follow-up ①. Pinning a juz was meaningless while three
pages were vendored — [PLAN §Loop 6](../PLAN.md) split Loop 6 for exactly this reason.
**Exit criterion (PLAN §Loop 6b):** airplane-mode revision of a pinned juz works after 8+ days.
**Result:** *airplane-mode revision of a pinned juz works* — proven, in a browser, with the
network off, on a page the reader has never visited. *After 8+ days* — deferred to the phone,
by construction. `make ci` green (**113.8 KB gz** of 150), `make e2e` **264 passed, 13
skipped**, core **397** unit tests, web **247**.

## What shipped, in five slices

| slice | PR | what |
|---|---|---|
| 6b-A | [#60](https://github.com/omars-lab/hifth/pull/60) | `planPack(juz, pages)` in core — which files a pinned juz is made of |
| 6b-B | [#61](https://github.com/omars-lab/hifth/pull/61) | the pack store: Cache Storage for the bytes, IndexedDB for the claim |
| 6b-C | [#62](https://github.com/omars-lab/hifth/pull/62) | `PackShelf` — the offer, the shelf, and the three states |
| 6b-D | [#63](https://github.com/omars-lab/hifth/pull/63) | the e2e that goes offline and reads the pack |
| 6b-E | this | the registers |

Sequential, not parallel. Loop 6a ran three agents into one tree and spent a merge pass
reconciling them (its own record calls that the most transferable thing in it); this loop is
four dependent layers, and there was nothing to gain by starting the UI before the store it
renders existed.

## The decision the whole loop rests on

**A pack does not live in the service worker's caches.**

The obvious design is the cheap one: page requests already go through workbox's `hifth-pages`
(CacheFirst) and shard requests through `hifth-data`, so "pin a juz" could be "warm those
caches" and the feature would be about fifty lines.

It does not work, and the way it fails is quiet. `hifth-pages` is an **LRU capped at 32
entries**, sized for a browsing trail. A juz is 20–23 pages. Pin juz 30, read twelve pages of
juz 1, and a third of what was pinned is gone — the reader was told they have a juz, the LRU
disagrees, and nobody finds out until the plane. *A pin that shares an eviction policy with
ordinary reading is not a pin.*

So `hifth-pack-v1` is the app's own cache, with **no expiration plugin attached to it**, and
`assets.ts` looks there **before** it reaches for the network (`packedFetch`). Two consequences
worth naming because they are not obvious from the diff:

- Offline works because **the app read its own pack**, not because a service-worker route
  happened to match. That is a stronger claim and a narrower one.
- It is therefore testable **without a service worker at all** — which is why 6b-B could ship
  with real unit coverage rather than waiting for 6b-D.

## Cache Storage for the bytes, IndexedDB for the claim

These are separate on purpose, and the separation is the feature.

Cache Storage holds the responses. IndexedDB (`hifth.packs.v1`) holds the record: *juz 1 was
pinned on the 4th, and these 24 files are what it is made of.* A browser sweep can take either
one. When it takes the cache and leaves the register, **the app can compare them and say so.**

A pack that were only a cache would have nothing to compare against. It would report success
by the only means it had — the files it can still find — and the reader would discover the
loss in aeroplane mode a week later, which is the one moment nothing can be done about it.
This is the same finding `repairShellCache` recorded in Loop 6a about the precache: *eviction
leaves every online signal healthy.*

## Three states, and the middle one is the point

`whole` is what the reader asked for. `gone` is a sweep. **`torn`** is the one that earned its
own vocabulary: a partly swept pack still opens most of its pages, so it is the state most
likely to pass for working, and the difference between it and a real pin only shows up where
nothing can be done about it. It is named, counted (`present` of `total`), said in words
(«ناقص») and not only in colour, and offered the same repair as `gone`.

Re-pinning fetches **the register's own URL list**, not a fresh `planPack`. Re-planning would
be newer; restoring what the reader was actually promised is narrower and more honest — the
offer on screen says *this juz is no longer on this phone*, and the file list that answers it
should be the one that went missing. It also still works when the manifest itself was swept.

## Where the UI went, and where it did not

Inside the revision map, at juz scope. The map at that scope is already the picture of the
thirty, the reader arrived from the page chip so they already know where they are, and the
header has no room for a sixth button — `e2e/chrome-fit` holds it inside 320 px with seventeen
pixels of slack, which is what put the colophon behind the wordmark in the first place.

**The pin state is not painted on the cells.** A corner dot on each pinned juz was the obvious
move and is refused for the reason the map exists: the cells already carry warmth, and
*absent* is already a treatment in kind rather than a shade. A third meaning on the same
square is one too many, and the one that would be misread is exactly the one that matters — a
swept pack looking pinned.

**Absent ayahs are on the label, not in the small print.** `planPack` counts what this build
has no paper for, and the offer says so *before* the download. On today's corpus that count is
zero everywhere, which is precisely when the rule is easiest to drop; silence about a hole
reads as an assurance.

## Two things found by building it

### Escape stopped closing a modal dialog

The revision sheet's Escape handler lived on its own subtree, which quietly assumed focus was
inside it. `PackShelf` broke that assumption in the most ordinary way possible: **keeping a juz
removes the very button the reader just pressed** — the offer disappears when the pack
arrives. Chrome fires **no `blur` and no `focusout` when a focused element is removed**; focus
simply becomes `<body>`. There is no event to catch, nothing to react to, and from `<body>` the
sheet's handler never ran again. The exit was pointer-only.

A reactive fix was tried first — pull focus back when the sheet loses it — and did nothing,
for that reason. It is recorded here because it is the more instructive half: the bug is not
that focus moved, it is that a *dialog's* keyboard exit was made conditional on where focus
happened to be.

The handler now belongs to the **document** while the sheet is open, in capture, with no
`stopPropagation` — `App` already stands down whenever a `[role="dialog"]` is in the DOM, so
the sheet does not need to silence it, and a sheet that did would be leaning on the same
"focus is where I think it is" reasoning that failed.

Nothing in jsdom takes focus away. The e2e tier is the only place this was visible, and it was
found the first time all three pack tests failed on the same line.

### Pinning writes every file twice

`pinPack` fetches through the page, so the service worker sees ordinary page requests and
`hifth-pages` caches the same bytes alongside the pack. Juz 1's ~3.1 MB is paid twice, and 21
of that cache's 32 entries go to duplicates — so the act of *keeping* a juz for later throws
away most of what the reader was reading last week.

Not a correctness bug: `packedFetch` reads the pack first, and every test passes either way.
It is filed as [backlog ⑮](../backlog.md) rather than patched, because both candidate fixes
are worse than the waste today — teaching the worker to recognise a pin puts pack knowledge in
the worker, and sweeping the runtime caches on unpin only tidies up afterwards. The trigger to
act is a second pinned juz.

It mattered immediately for a different reason: **it would have let the offline test pass with
the pack deleted.** `dropOutsidePack` removes the outside copy before the assertion, so only
the pack can answer — which is also the state a pinned juz is genuinely in once ordinary
reading pushes it out of that LRU. The workaround and the real case are the same state.

## What is proven, and by which tier

| claim | where |
|---|---|
| a juz's file list is read off the manifest, not off `JUZ_STARTS` | `packages/core/src/packs.test.ts` |
| the pack survives what a runtime cache would not | `apps/web/src/packs.test.ts` |
| the shelf reports what the store actually holds, including `torn` | `PackShelf.test.tsx`, against a real `fake-indexeddb` |
| **the pack is what serves a never-visited page offline** | `e2e/offline.spec.ts` |
| **a real sweep is noticed across a cold boot, and repairable** | `e2e/offline.spec.ts`, CDP `Storage.clearDataForOrigin` |
| **`torn` is counted against real Cache Storage, not a `Map`** | `e2e/offline.spec.ts` |

The bottom three are the ones no unit tier can make, and they are why 6b-D exists as its own
slice rather than as a paragraph in 6b-C.

## The deferral, stated plainly

*After 8+ days* is not deferred because it is hard. It is deferred because **only a phone can
answer it**, on its own schedule, and no harness can supply the passage of seven days of
browser use. Research ④ already replaced the *eviction* half of that check with CDP, and that
substitution found two real defects. What is left is the one question a machine cannot ask:
whether iOS actually sweeps an uninstalled origin at ~7 days and spares an installed one.

That check was marked **"not runnable yet — there is nothing to pin"** for its entire life
until this loop. Its runbook now names juz 1, the exact button, and what the swept state looks
like on screen, so the only cost left is the waiting.

## Vocabulary this loop added

- **pack** — the files one pinned juz is made of: its pages, its adjacency shards, and the
  manifest. Never "download", which suggests a file the reader owns and manages.
- **whole / torn / gone** — the three things a pack can be. Not "valid/invalid": the whole
  point is that the middle one is neither.
- **the register** — the IndexedDB record of what was pinned, as distinct from the bytes.
  A pack with no register can only ever report success.
