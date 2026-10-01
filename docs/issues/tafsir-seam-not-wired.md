# The commentary plumbing is merged, but not on screen (joined 2026-09-30)

**2026-09-29.** Work from 2026-09-09 let a verse show commentary from any source behind one
shape: a book the reader owns and loads into their own browser, or a live public tafsir service.
It sat unmerged on its own branch. When every branch was brought back to main, this one clashed
with something main had built since: the private pitch build's own commentary drawer for The
Study Quran.

## What clashed

Both add a commentary drawer to the same verse, opened by the same ✎ button and the same "is the
commentary open" switch in the main screen. Main's drawer opens by itself when the selected verse
has a note; the branch's closes itself whenever the verse changes. Put together, one would undo
the other on every verse. The branch also adds a "load your book" control to the settings page,
which would change the public app for readers.

## What was done

Everything the branch built was merged and its tests run: the shared shape for a commentary
source, the loaded-book source, the live-service source, the two panels, the wording in both
languages, and the decision record (tafsir-provider). Only the joining-up was left out: the main
screen and the settings page are main's, unchanged. So a reader sees nothing new, and the public
build ships no commentary text, as before.

Nothing was dropped. The joining-up is in the branch's commit, which the merge keeps in main's
history for good:

```
git show 60db1dc -- apps/web/src/App.tsx apps/web/src/components/Colophon.tsx
```

## What is left

Decide how the pitch drawer and this plumbing become one thing. The likely shape is that the
pitch's Study Quran notes become one more source behind the same shape, so there is one drawer
and one ✎, not two. That is part of the coming refactor, not this merge.

## How it was joined (2026-09-30)

The "coming refactor" this waited on was never planned, so it was done on its own. The pitch's
Study Quran notes became one more source behind the shared shape, under the name "The Study
Quran", and the pitch's drawer became the one drawer. It is handed a note — the verse, its
translation, its paragraphs, and on a surah's opening verse the surah's introduction — and the
name and credit of whoever wrote it. It never learns which source that was.

- **What the reader sees in the pitch:** nothing changed. The same drawer opens on the same
  verses, with the same words; the browser tests for the pitch all still pass.
- **What the reader sees in the public app:** nothing changed. The drawer is only built into an
  app that has a source: the pitch, or a public app set up for the live tafsir service. Neither
  is true of the public site today, so the drawer is left out of it entirely, and the size
  check refuses a build where it slips back in.
- **What was deleted:** the branch's second panel, which never reached the screen. The pitch's
  drawer was the one people had already seen and judged, so it was kept.
- **Which source wins when more than one is on:** a held or loaded book over the live service,
  until readers are offered a choice. Only one is ever on today.
- **What is left:** the drawer's own words are English only and it reads left to right, both
  fine for The Study Quran and wrong for an Arabic source. That is item 24 in the plan, owed
  before any other source is switched on.
