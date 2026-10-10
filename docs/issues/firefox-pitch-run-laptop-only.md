# The pitch suite in Firefox runs only its laptop-sized tests

**2026-10-09.** Firefox is the owner's own browser, and it had already broken one thing the other two
browsers did not (the tajweed key's web address, cut in two). So the whole pitch suite was run in
Firefox to see what else it would find.

## What the evidence showed

107 of 115 tests passed. All eight failures were at phone or iPad sizes. Every laptop- and
desktop-sized test passed, including the demo path: a verse's note, its look-alikes, the links in
a note, the number menu and the tajweed key.

The eight split three ways:

- **Two were the test measuring wrongly.** One counted a verse named in a note as two lines because
  Firefox makes the box around the words a few pixels taller than the words, so their bottoms
  differ while they sit on one line. The other counted the drawer's close mark as "cut short"
  because Firefox reads that glyph a hair wider than its box. The pictures showed both whole. Both
  tests now measure what they mean (boxes that share some height; only the row of tools), and both
  still fail on a line forced to wrap.
- **Five were the test tool, not the app.** Playwright says its phone setting "is not supported
  in Firefox". Three tests hung trying to turn a phone sideways; a long press never landed. Two more
  showed a list over the verse's last line on a sideways phone. They passed in Firefox once the
  phone setting was dropped, and pass in Chromium and WebKit with it, so the tool was not making a
  phone, not the app placing the list wrongly.
- **One more failed once and passed five times in a row** in both browsers, a phone test under
  the load of a full run.

## What replaced it

A second pitch run, `pitch-firefox`, goes with every push: the same tests in Firefox at a
laptop size, with the phone and iPad tests left out by name. It takes about thirty seconds. The
phone and iPad tests run in Chromium (and in WebKit on request), which is what a phone or an iPad
in the room would be. Firefox on a phone is checked by eye on a walk, not by this suite.
