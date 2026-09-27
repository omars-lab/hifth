# After following a related verse from inside The Study Quran's note, how does a reader get back?

**Decided: B**, by Claude as a working assumption, 2026-09-27; Omar asked for it to be recorded and may
reopen it. The note carries a small "Back to" line under its heading, naming the verse the reader came
from. Built and shipped in the private demo build only (#123). Nothing was built for A or C, so there is
nothing to delete.

## What is being decided?

The note on a verse lists the verses The Study Quran connects it to, and a tap on one goes there and
opens that verse's note. On a phone the note covers the bar at the bottom where the trail of visited
verses sits. This decides how the reader returns to where they started.

**For a hafiz:** following a connection is a detour from the verse under revision; the way back has to be
one tap, or the detour costs them their place.

## Why now?

Found walking the demo as a scholar would: from 1:6 to 6:153 on a phone, the only way back was to close
the note first, then tap the trail. It is the kind of stumble that breaks the flow in front of the
people we are showing it to.

## What happens if nobody decides?

A: it still works, in two taps and with the note closed.

## What does the app do today?

Before this change: close the note, then tap the previous verse on the trail. On a phone the note
always covers the trail. On a computer it covers it too whenever the note stands on the right-hand
page, since the trail sits at the bottom right; only a note on the left-hand page leaves it in sight.

## What do others do?

We did not look.

## What already constrains it?

- ayah-drawer = D: on a phone the verse's drawers are bottom sheets over the page; on a spread they
  stand on the opposite leaf.
- Only one drawer is open at a time.

## The options

- **A · Leave it.** Close the note, then use the trail. Nothing to build; two taps and the note is gone.
- **B · A back line inside the note (chosen).** One tap, and the note stays whole, on a phone and on
  a computer alike. When the trail happens to be in sight too, the line repeats it, which does no harm.
- **C · Keep the trail in sight above the note.** One way back on every screen, but it takes height
  from a note that is already short on a small screen, and on a computer the trail would have to move
  out from under a note on the right-hand page.

No picture is checked in: the renders carry The Study Quran's own text, which stays out of the public
docs. The behaviour is held by a test in the demo build's tests: follow 1:6 to 6:153 on a phone, then back.

## What would change the answer?

If a reader wants the trail itself in sight while reading the note, C; if the line is overlooked, it
could become a button rather than a link.

## What is this not settling?

The trail's own design, or anything in the public build.
