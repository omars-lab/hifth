# The iPad app closed when a verse was touched

**2026-11-10.** The pitch build, freshly installed on the owner's iPad (iPadOS 18.5), closed by
itself on the first touch of a verse, every time. The walks in the iPad simulator had all passed.

## What the evidence showed

- Crash reports on the iPad, pulled over the cable, all said the same thing. iPadOS stopped the
  app while it was linking the web view's touch handlers together, with the message "Invalid
  parameter not satisfying: targetNode". One end of a link between two handlers was missing.
- The crash reports leave that message out. Opening the app from the laptop with its output
  shown (`devicectl device process launch --console`) printed it.
- Apple's developer forums (threads 61432 and 784931) tie this message to touch-handling
  views built before the app has finished starting up.

## What was tried first, and why it was wrong

The shell switched off the web view's own pinch handler after the page loaded, to stop page
zoom. That looked like the missing end of the link, so the line came out. **The app still
closed on touch without it** (crash at 13:27 that day), so pinch was not the cause. The line
stays out anyway: zoom is blocked by pinning the zoom scale to 1, and
`scripts/native-no-disabled-gestures.test.mjs` keeps a handler from being switched off again.

## The real cause, and the fix

The web view was built inside the app's model, and the model is made by the app's first line
(`@State private var model = ShellModel()`), before iPadOS has finished starting the app. A web
view built that early, with its touch handlers and the Pencil listener already attached, was
left half-linked into iPadOS's touch handling.

The model now builds the web view the first time the screen asks for it
(`ShellModel.webView` is created lazily). `native/HifthTests/WebViewTimingTests.swift` checks
that making the model builds no web view, and that the screen's first request builds exactly
one. It failed before the change and passes after it.

**Checked on the iPad, 2026-11-10:** after the fixed build went on at 14:11, touching verses
no longer closes the app (the owner: "its good now"), the recorded output shows no error, and
no new crash report was written.

## Still owed

- **The touch test cannot run on iPadOS 18.5 in the simulator yet.** The app does not even
  start there: it needs a Swift library for the web view (`libswiftWebKit`) that the 18.5
  simulator does not have, and it links it as required. The real iPad has it. So
  `SmokeTests/testTouchingAVerseKeepsTheAppOpen` waits forever on that simulator. Fix: stop
  depending on that library (use the older form of the four script calls), then run the test.
- **No native test runs before a push.** The pre-push checks cover the web app only. A
  release command should run the iPad checks, install, open the app with its output captured
  and fail on any new crash report, so the next one is caught before anyone holds the iPad.
