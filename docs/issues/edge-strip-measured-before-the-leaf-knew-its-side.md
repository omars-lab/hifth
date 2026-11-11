# The page-edge strip test that failed on its own in Firefox: the strip measured too early

**2026-11-11.** A browser test checks that each strip you grab to turn the page has the
paper's rounded outer corners. In Firefox it failed now and then with "the left strip's outer
corner is rounded: got 0", passed on the retry, and cost a 13-minute push each time it did not.

## What we first thought

That the test looked too soon: it read the strip once, straight after the first page showed,
and the strip finds its paper a frame later. That was true, but it was not the whole fault.

## What the evidence showed

The test was changed to keep looking for ten seconds. It still failed, about one run in five
once the app's own looking had been changed (below), and the corner stayed square for the whole
ten seconds. So the app was wrong, not only the test.

The strip was then made to write down what it saw each time it measured. Every failing run
ended the same way: both pages were drawn, and the page standing on the left still carried the
right-hand page's label. A page is told which side it is on a moment after it is drawn. The
strip copies its corners from the paper, so it copied the right-hand page's square inner
corner. A few milliseconds later the label was corrected and the paper's corners with it, but
the strip had stopped looking, because it stopped as soon as it had found a page on each side.

A second fault turned up on the way. The strip looked each frame for two seconds at most. With
the facing page's drawing held back for three seconds, that side's strip stayed square until
the next page turn. A reader on a slow connection would see this.

## What replaced it

The strip no longer looks on a timer. It measures again whenever something is added to the
book or a page changes side, at most once a frame, for as long as the opening is on screen.

Two tests hold it: the old one now looks until the strip settles, and a new one holds every
page's drawing back for three seconds but the first and waits for both strips to round. The
new one failed in Chrome and Firefox before the change. After it, both ran 25 times each in
Firefox with no failure. The app's size did not change.

## Left alone

For those few milliseconds the left page itself has the right page's corners. Nobody can see
that, so it was not chased.
