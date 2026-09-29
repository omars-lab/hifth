# The commentary plumbing is merged, but not on screen

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
