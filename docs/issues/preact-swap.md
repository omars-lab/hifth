# What broke when Preact took over from React

**2026-10-03.** The app now draws its screens with Preact's small copy of React instead of React's
own page-drawing library, which takes about 36 KB off what every first visit downloads
(`docs/performance.md` ⑱). The unit tests needed four fixes that changed nothing in the app, and the
browser tests found one real difference in the app itself.

## What broke, and why

- **The tests drew with both libraries at once.** React's testing helper loads React's own library,
  and the app's components ran on Preact, so every component test failed with an error about refs.
  Preact has its own testing helper with the same functions (render, screen, fireEvent, waitFor,
  within, act, renderHook), so the tests import that one now.
- **The gesture library loaded React's own copy.** The test runner picked its old-style build, whose
  way of loading React the Preact plugin cannot redirect. Every test that put a page on screen failed
  with "cannot read useMemo of null". The test settings now point at its modern build by name, and
  have the runner build it (and the testing helper) together with the app.
- **Preact 11 was too new for Preact's testing helper.** Unmounting a hook did not run its cleanup.
  We use the Preact 10 line, which the helper is written for.
- **The helper renames "change" events.** Once it has seen a redraw, Preact's testing helper fires a
  "change" as the every-keystroke "input" event, copying how React's handlers are named. A test that
  meant "the reader let go of the slider" or "a folder was picked" then fired an event nobody listens
  for. Those tests now fire the browser's own "change" by hand, and the tests that type into a box
  fire "input", which is what a browser fires while typing.

## What the browser tests caught in the app

Seven of the 681 browser tests failed the same way: a sheet opened, a key was pressed straight away,
and the key went to the page behind it. Escape did not close the jumper or the similar-verses list,
and Enter on a saved note's pin did not reopen it.

React and Preact both hold back a component's after-drawing work (moving focus into a sheet that just
opened, say) until the next screen frame, so the page paints first. But React made an exception for
a tap, a click or a key: then it did that work at once, before the browser could hand over the next
event. The app was written against that, without saying so anywhere. Under Preact, a reader who
pressed `/` and typed a verse quickly could lose the first letters to the page.

The fix gives Preact React's rule back, in one place (`apps/web/src/input-timing.ts`), switched on
before the app draws anything and in the unit-test setup: a redraw caused by a tap, a click or a key
does its after-drawing work as soon as the drawing is done, and every other redraw still waits for
the frame. Its unit test opens a sheet with a real key event and fails without it; the seven browser
tests are the other half.

Once those passed, one more turned up only on repeats: after holding a verse to pick a word, Escape
is meant to let go of the word and keep the verse, and one time in five it let go of both. Two
listeners hear that Escape, the words' and the app's, and the words' was meant to go first because
it was registered first. But a listener that is set up again goes to the back of the line, and under
Preact that happened often enough to swap them. The words' listener now hears keys on their way down
the page (the browser's capture phase), which always comes before the app's on their way back up, so
the order is a rule and not luck. Main passed that test 16 times in 16; the branch failed it 3 in 16
before the change and passed 224 of 224 runs of the word tests after it.

A third gap showed a day later (2026-10-03), as a phone test that failed once under load. The fix
above hurries the after-drawing work only when a tap or a key caused the drawing. Three sheets load
their code the first time they open: the list of a verse's notes, the bookmark drawer, and the map
of what you have opened. Each is drawn when its code arrives, which is no tap's doing, so its
listening for Escape (and the drawer's cursor in its name field) waited a frame, and an Escape
pressed as the sheet appeared fell on the page. All three now set those up in the same step that
draws them. Each has a browser test that presses Escape inside that step, before any frame; all
three tests failed before the change, and so did the drawer's cursor check.

A fourth the same day: the panel that opens a word into its parts (and the mistake tool's sign
picker, which is the same panel) is drawn hidden, placed a frame later, and only then takes the
keyboard. It heard Escape only while it held the keyboard, and every other Escape in the app
steps aside while a panel is open, so an Escape pressed in that gap did nothing at all. It failed
1 run in 24 alone and both tries under a full push. The panel now hears Escape across the whole
window from the step that draws it; a browser test presses Escape as the panel is added, before
any frame, and failed before the change. After it, 40 of 40 repeats passed.

## What did not change

The components: they still import from "react", and the build points those imports at Preact. Going back is the two plugin lines in the build and test settings, plus the dependencies.
