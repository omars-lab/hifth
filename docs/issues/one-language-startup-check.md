# Loading one language made the start-up check fail, then froze the page

**2026-09-29.** Splitting the interface text so a reader downloads only their language (PR #148)
passed every browser test, but the start-up timing check failed it: 2553 ms against a limit of
2500 ms, where main measured 2104–2254 ms.

## What the evidence showed

Each language file imported a 266-byte shared helper (the one that picks "1 ayah" or "2 ayahs"),
and the build shipped that helper as a file of its own. So a reader's first visit asked for two
extra files, not one. The page already asks for the language file early, but the helper was one
more request on the way to the first paint.

Folding the helper into the main script fixed the extra request and broke the page: the check
reported that nothing was ever drawn. The main script paused at the top, waiting for the language
file, and the language file now imported the main script for the helper, so each waited for the
other forever.

## What replaced it

- The build folds any shared file under 2 KB into the main script, and refuses to build if a
  language file still needs a separate file of its own (so the extra request cannot come back
  unnoticed).
- The main script loads the language, then draws the page, instead of pausing at the top. That
  removes the freeze. A reader sees the same thing.

## What is still true

The check runs five times and takes the middle. Its runs fall into two groups, about 2100 ms and
about 2550 ms, with the same real network timings in both. In the slow group the largest drawing
lands about 10 ms later in real time, after the page image request has started, and the check's
simulated slow phone then counts that download too. Main shows the same split with a 150 ms step;
this branch's step is 450 ms. Two runs after the fix gave middles of 2103 and 2104 ms (6 of 10
runs fast). If the check starts failing by hand runs, this split is the first thing to look at.
