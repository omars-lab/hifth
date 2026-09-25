# Where does a reader clear many bookmarks at once, and how is clearing all of them confirmed?

**Status:** decided by omar on 2026-09-25, in conversation, from a sketch drawn in chat. The
question put to the owner was about *order*: build bookmarks first and the tidy-up later, build
both together, or leave bookmarks out of the demo. The owner chose **build both together**, and
the sketch attached to that choice is the tidy-up surface recorded here as option A.

## A few words, defined once

- **A bookmark** — a place a reader marks to come back to, drawn as a ribbon on the page. The
  reader can hold many, each with a name. See [the bookmark decision](bookmark-fold.md).
- **The page map** — the sheet that shows, page by page, what the reader has opened and when.
  It is the nearest thing the app has to a calendar of the reader's time with the book.
- **Clearing** — removing bookmarks. One at a time is lifting a ribbon; clearing is removing
  many in one act.

## What is being decided?

Once a reader holds many bookmarks, some go stale. Where does the reader remove them in bulk —
all the ones in one surah, or all of them — and what stands between a tap and losing every
bookmark they have?

## Why is it being asked now?

Bookmarks were decided on 2026-09-02 as *many, dropped and lifted* and *kept on the phone with a
way to carry them off*, but none were built. The owner asked for a way to manage them from the
calendar view, and was asked whether to build the bookmarks first or both together. Building
both together means the tidy-up surface has to be chosen now, before anyone has used a bookmark.

## What happens if nobody decides?

Bookmarks would ship with only one-at-a-time lifting. A reader with thirty stale ribbons lifts
thirty ribbons. That is tolerable for a demo and poor for a year of use.

## What does the app do today?

There are no bookmarks, so there is nothing to clear. The page map exists and shows opened
pages; it has no controls that change anything.

## What do people outside this project do?

I did not look. Browser bookmark managers and e-reader apps commonly group bookmarks and offer a
delete-all behind a confirm, but that is from memory, not a check.

## What have we already decided that constrains this?

- **bookmark-model (B)** — many bookmarks, each named, each with its own drawer. The drawer
  already handles one bookmark; this decision is only about many at once.
- **bookmark-store (C)** and **storage-model** — bookmarks live in the phone's own store and can
  be saved to a file. So a cleared set is gone from the phone; the saved file is the only undo.
  That is why clearing all needs a real confirm.

## What were the options?

- **A. From the page map: a count, the bookmarks grouped by surah with a clear per surah, and a
  "clear all" that asks first.** The ask names the number ("Clear all 14 bookmarks?") and offers
  cancel and clear. Chosen.
- **B. Only from each ribbon's own drawer, one at a time.** Nothing new to build; slow for many.
- **C. Leave bookmarks out of the demo.** Spends nothing; a hafiz trying the demo cannot mark a
  place.

## What was decided, and why?

Option A, with bookmarks built in the same piece of work. The owner chose to have the feature
arrive complete. The cost, stated when asked, was two to three days and a tidy-up surface
designed before real use.

**How the confirm works.** The ask is drawn inside the app, never the browser's own pop-up, and
it names how many bookmarks go. Clearing one surah's bookmarks asks too, since it can also take
several at once.

## What would change the answer?

- Readers never accumulating more than a handful of bookmarks, which makes the per-surah list
  noise and option B enough.
- An undo that restores a cleared set, which would let the confirm become lighter.

## What is this not settling?

- What a bookmark's own timeline records. That stays open under the bookmark decision.
- Syncing bookmarks to a cloud copy once there is sign-in. The storage model owns that.
