# The tajweed switch "changed the page's shapes" — the test looked before the verse mark landed

**2026-10-06.** The browser test that switches tajweed on and off and checks that not one shape on
the page moved failed now and then, once on the Android phone size during a push, and passed on
retry.

## What the evidence showed

Running it 300 times, sixteen at once, failed it twice (both on the iPhone size this time). Both
failures said the same thing: the shapes after the switch held **two more** outlines than the
shapes before it, and nothing else differed. Those two outlines are the highlighter marks across
the two lines of 2:38, the verse the test opens on. The app paints that mark a moment after the
page shows, and fits it to the letters again once they are laid out. On a busy machine the test
took its "before" reading in that gap. The switch itself never moved a shape.

## What replaced it

The test now waits for both marks, then reads the page until two readings in a row agree, and
only then takes its "before". 300 of 300 runs pass under the same load.

Nothing in the app changed: a verse mark arriving just after the page is how the app is meant to
open on a verse.
