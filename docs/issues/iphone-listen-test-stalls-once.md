# One iPhone recitation test stalled once in a full run, and would not do it again

**2026-10-16.** In a full push run (1183 desktop and 290 phone tests passed), one phone test failed
on its first try and passed on its retry: "once the connection is back, a second tap fetches the
verse again", in the recitation tests. It cuts the connection, taps Listen, waits for it to say
Offline, brings the connection back and taps again.

## What the log showed

The failure was the first tap. Playwright waits for a button to stop moving before it taps it, and
it checks that once per drawn frame. In 60 seconds it managed only about three checks, each saying
"element is not stable", and the whole test took 2.9 minutes before it gave up. Other phone tests
running at the same moment passed at their usual speed. Three checks in a minute does not mean the
button was moving; it means that one page stopped drawing frames almost entirely.

## What we first thought

That the connection was cut while the page was still fetching the verse's recitation in the
background, so the button was caught half way through changing and kept shifting.

## What the evidence showed

It would not happen again:

- 30 of 30 runs of the test alone.
- 75 of 75 runs of the whole recitation file, ten at a time, to load the laptop as a full run does.
- 6 of 6 runs with the recitation's answer held back by half a second, so the cut landed in the
  middle of the fetch every time (the page had asked for it once before going offline in each run).
  This rules out the half-way idea: a cut mid-fetch leaves the button still and the test green.

So the likeliest cause is the phone browser's page itself stalling once, which no change to the
test can mend.

## What replaced it

Nothing was found to fix. The one difference from its passing neighbour (the test just above it
waits for the Listen button to be on screen before cutting the connection; this one did not) is
removed, so the two now start the same way. That is a tidy-up, not a proven cause, and the test was
not watched failing first because the failure cannot be made to happen. No retries were added and
no waits were lengthened.

## What to grab if it comes back

Before running anything else, copy the failed test's folder
(`apps/web/test-results/audio-…-iphone/`, with its trace and picture) to the scratch folder. The
next run empties `test-results/`, which is how the first one's trace was lost. Open the trace and
look at whether the page drew any frames in that minute, and what the page was doing when it stopped.
