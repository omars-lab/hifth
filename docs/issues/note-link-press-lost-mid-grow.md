# A press on a link in the note was sometimes lost, in the test only

**2026-10-23.** A pitch test failed once in a full push run and passed on its retry: "with the
note up over a recitation, following one of its references to another verse ends the
recitation", in Firefox. It plays page 2, opens the note on 2:3, presses the note's first link
to another verse, and checks the recitation stopped.

## What it looked like

The check that failed was the last one: the recitation was still playing. Run alone 20 times
with no second tries, it failed 2 times; with the old way of turning the page at the edge it
failed 2 times in 30, so the change to that setting the same day had not caused it.

## What the evidence showed

A note on what the page did showed that the hop had never happened. The address still named
2:3, not the verse the link points to. The test's check that the hop had landed ("the address
no longer names page 2") passed anyway, because choosing 2:3 had already changed the address
before the press. So the fault surfaced five seconds later as "still playing" instead of "the
link did nothing".

Logging the press itself: the finger went down on the link, and came up on the note's words.
Tracking the link's place on the screen frame by frame showed why:

1. The short note slides up (about 170 ms) and stands still.
2. Before pressing, Playwright scrolls the link into view inside the note.
3. A scroll inside a short note grows it to the full height, which is how the app is meant to
   work: reading on opens the whole note.
4. The note sat still for one or two frames before it started growing, Playwright took that as
   the link standing still, and pressed. The growth carried the link away between the press
   and the release.

A reader tapping a link they can see does not scroll the note first, so this was the test's
own scroll starting the growth, not something a reader meets.

## What replaced it

A small helper in the pitch tests, used for every press on a "hop to" link inside the note:
scroll the link into view, wait until it has stopped moving (checked a tenth of a second
apart, longer than the pause), then press. The last check now waits for the address to name
the verse the hop came from (`via=2:3`), so a lost press fails at the press. No retries were
added and no waits were lengthened.

After: 60 of 60 runs of the test alone in Firefox, and the whole pitch file in both browsers
(286 passed), with no second tries.
