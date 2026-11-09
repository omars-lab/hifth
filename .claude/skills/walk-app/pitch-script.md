# The pitch script: what we show The Study Quran's team, tap by tap

*Drafted 2026-11-09 by the agent, from what the pitch build already does. The owner corrects it:
change the passages, the order, or what "right" means, and the walk follows. The goal it serves is
`.claude/goals/study-quran-pitch.md`; its first measure is "how many of these steps pass on the
real iPad".*

This page names verses and taps only. It never quotes the commentary or the translation; to see
what a step shows, open it in the pitch build (`make pitch`).

## The short version

- **Where:** the iPad app, held on its side (two pages open), English interface, pitch build.
  The room may have no internet.
- **How long:** about ten minutes, 16 steps.
- **The passages:** 2:255 (the Throne Verse), 2:48 and its look-alikes, 15:30–31, 18:10–14, the
  long story 18:60–82, and one verse off the path.
- **A step passes** when it works *and* looks right on the first try, with nothing covering the
  verse being talked about. Count passes out of 16.

## The passages, and whether each is demo-ready

A passage is demo-ready when its page, its marks, its look-alikes and its note are all right and
polished on the iPad. Fill in the last two columns after each walk.

| Passage | Why it is in the demo | Ready? | Last walked |
|---|---|---|---|
| 2:255 (page 42) | The verse everyone knows; a long note in 10 paragraphs; 25 related places | not checked | — |
| 2:48 | Look-alikes a hafiz mixes up: 2:122–2:123 and 2:123 | not checked | — |
| 10:15 → 19:73 | A side-by-side comparison with the shared words marked | not checked | — |
| 15:30–31 | Look-alikes in a later surah (surah 38) | not checked | — |
| 18:10–14 | The cave sleepers; slanted Arabic terms in the note | not checked | — |
| 18:60–82 | One long note shared across a whole story, with its own links | not checked | — |

3:84 is a candidate seventh passage; the owner decides whether it is in.

## The steps

Each step: what to do, what "right" looks like, and the command that walks it in the iPad
simulator. The commands start the app sideways in English; add `IPAD='iPad mini (A17 Pro)'` for
the small iPad. On the owner's own iPad, do the same taps by hand.

| # | Do | Right looks like | Walk it |
|---|---|---|---|
| 1 | Open the app | Two pages of the mus'haf, nothing over them, no tour bubble | `make app-shot ROUTE=/hafs-kfqc/p42 TARGET=ipad` |
| 2 | Turn a page by its outer edge, then back | The page follows the finger and settles; no flash | by hand (a made-up finger cannot turn it) |
| 3 | Tap 2:255 | Its note opens beside it; the whole verse stays in sight | `make app-walk ROUTES='/hafs-kfqc/2:255?open=commentary' SIDEWAYS=1` |
| 4 | Read 2:255's note to the end | All 10 paragraphs; the book's slanted words slanted; it ends above the page bar | same route, scroll the note |
| 5 | Open 2:255's related places | 8 cards and a "more"; each card opens its verse | same route, tap the related places |
| 6 | Open 2:255's number menu, then the roots list | The menu stands clear of the verse; the open root group stays open while the rest arrive | `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en "ROUTE=/hafs-kfqc/2:255?view=one&open=roots" EVALFILE=.claude/skills/walk-app/scripts/card-size-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200` |
| 7 | Go to 2:48, open its look-alikes | Every row says why it is there; the passage row reads "2:122–2:123" | `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en "ROUTE=/hafs-kfqc/2:48?open=lookalikes" EVALFILE=.claude/skills/walk-app/scripts/lookalike-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200` |
| 8 | Open the row for 2:123 | The comparison opens with the shared words marked, its name in sight under the title | same as step 7 |
| 9 | Go to 10:15, later surahs, open 19:73 | The opening marked green, the one word spelled differently ochre | `make app-walk ROUTES='/hafs-kfqc/10:15?open=lookalikes' SIDEWAYS=1` |
| 10 | Go to 15:30, later surahs, open the passage in surah 38 | The passage's name stays in sight under the list's title | `make app-walk ROUTES='/hafs-kfqc/15:30?open=lookalikes' SIDEWAYS=1` |
| 11 | Open al-Kahf's introduction from the surah's name (page 293) | It lies over the facing page; the surah's name stays in sight | `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p293 EVALFILE=.claude/skills/walk-app/scripts/intro-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200` |
| 12 | Tap 18:10, read the note | The slanted terms are slanted; no stray box or mark | `make app-walk ROUTES='/hafs-kfqc/18:10?open=commentary' SIDEWAYS=1` |
| 13 | Tap 18:60, follow its link to 18:65 | One note for the whole story; the link lands on 18:65 with it lit; 8 cited places | `make app-walk ROUTES='/hafs-kfqc/18:60?open=commentary' SIDEWAYS=1` |
| 14 | With a note open, play the surah from its corner | It recites; the verse being recited is never under the note | by hand; the browser test is "lies clear of the verse being recited" in `e2e/pitch.spec.ts` |
| 15 | Pick the Mistake pen, tap a word, mark it, then erase it and Undo | The question stands clear of the word; the mark shows, goes, and comes back | `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p7 EVALFILE=.claude/skills/walk-app/scripts/mistake-ask-walk.js DELAY_MS=2500 PROBE_TIMEOUT_S=200` |
| 16 | Tap a verse nobody planned for (say 2:37) | Its note opens like the others, never empty, never a wait that does not end | `make app-walk ROUTES='/hafs-kfqc/2:37?open=commentary' SIDEWAYS=1` |

**Then once with the wifi off**, on the owner's own iPad: steps 1, 3, 7 and 16 again. The notes
and pages must still be there; only recitation may need the internet (unless the surah was kept
on the device). This is a by-hand check, parked on the manual-testing list as
`check-offline-survival`.

## The browser check, one command

`make pitch-script` runs one browser test per step (`apps/web/e2e/pitch-script.spec.ts`), at
the iPad-on-its-side size, in Safari's engine (`HIFTH_PITCH_BROWSER=chromium` for Chrome's).
Each test is named for its step and checks what "right looks like" says: boxes, counts and
labels, never the note's words. Steps 2 and 14 are by hand and show as skipped. It is kept out
of the push check on purpose: a test for a step that is not right yet should fail, and that
must not block a push. A browser pass is not a demo pass; the iPad walk still decides.

## Counting

After a walk, write the count into the goal page's "current numbers" table: steps passing out of
16, and passages ready out of 6, with the date. A step that fails gets a backlog row tagged
`"pitch": true` (see `make issues PITCH=1`), a test, and a line in the walk checklist, as for any
fault.
