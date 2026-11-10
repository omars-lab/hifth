# iPad crash on touching a verse: raw findings (researcher B)

Written 2026-11-10 by researcher B, one of two independent researchers. This is the raw
record: what each source says, and whether I actually opened the page ("fetched") or only
saw a search-engine summary of it ("snippet only"). The recommendations are in the
companion file, `2026-11-10-ios-crash-troubleshooting-b-design.md`.

A note on how Apple's documentation was read. Apple's documentation pages are drawn by
script, so a plain page fetch returns only the title. I downloaded the same pages as the
data files the site itself loads (`developer.apple.com/tutorials/data/documentation/<page>.json`)
and read the text from those. Those count as fetched below.

Words used once and explained here:

- **Crash report (.ips file)**: the file iPadOS writes when an app dies. Since iOS 15 it is
  JSON with an `.ips` ending.
- **Exception**: an error object a framework throws when something is badly wrong. If
  nothing catches it, the app is stopped on purpose (that is the SIGABRT in our report).
- **Symbolication**: turning the bare memory addresses in a crash report into function
  names and line numbers.
- **Gesture recognizer**: the object UIKit attaches to a view to tell a tap from a swipe
  from a pinch. WebKit adds many of its own to every web view; we add none.
- **Unified log**: the system-wide log every app on Apple devices writes to; read with
  Console.app or the `log` command.

---

## What is known about this exact error?

The error: `NSInternalInconsistencyException`, "Invalid parameter not satisfying:
targetNode", thrown inside `-[UIGestureGraphEdge initWithLabel:sourceNode:targetNode:directed:]`
while UIKit delivers a touch to the gesture recognizers of a window.

### Apple forums thread 61432, "UIGestureGraphEdge Crash" (2016) — fetched

https://developer.apple.com/forums/thread/61432

- Same assertion, same function, on iOS 10. No Apple reply, no confirmed fix.
- One poster (marked "accepted answer"): it crashed "when I tap WKWebView", with exactly our
  reason text. Cause in their app: the WKWebView was created in `+load`, very early at
  launch. Fix: create the web view later (they delayed creation by one second).
- Another poster narrowed their case to the root view controller being created inside the
  app delegate's `init`, before the app finished launching, and reproduced it in a sample app.
- A third: "If I create view and setup gestures in some class's +(void)load method, the issue
  will occur ... I suspect this is due to the UIGestureRecognizer's global environment is not
  set up yet. Solve: Delay the creation of the view."
- Common thread across every workaround: **a view carrying gesture recognizers was built
  before the app had finished launching; building it later stopped the crash.**

### Apple forums thread 784931 (visionOS, May 2025) — fetched

https://developer.apple.com/forums/thread/784931

- Exact same assertion and reason, on a WKWebView, crashing "when I try to interact with the
  web view". No Apple reply.
- Their setup: the WKWebView was created and held by an app-wide model object, and the
  SwiftUI wrapper's `makeUIView` returned that pre-built instance.
- Their fix (they did not know why it worked): let the wrapper create its own `WKWebView()`
  instead of reusing the one the app model held.
- This is the same shape as Hifth's shell (see "What does our own code do" below).

### Apple forums thread 824534 (April 2026) — fetched

https://developer.apple.com/forums/thread/824534

- Title is the same error text; body asks only "How to locate this crash?" with a screenshot
  I could not read. No replies, no OS version, no fix. (The page summariser added its own
  guesses about `require(toFail:)`; those are not from the thread and I do not rely on them.)

### WWDC24 "What's new in UIKit" (session 10118) — fetched (transcript)

https://developer.apple.com/videos/play/wwdc2024/10118/

- "The gesture systems have been unified in UIKit and SwiftUI, and they now adhere to
  consistent rules. In iOS 18, dependencies can be specified between gestures, across both
  frameworks."
- Relevance (my inference, not Apple's words): the code that builds the gesture "graph"
  changed in iOS 18, which is a plausible reason an old "built too early" fault could come
  back on iPadOS 18.x for a SwiftUI app hosting a web view.

### WebKit bug tracker and other searches — snippet only

- Searches of WebKit's bug tracker and the Apple forums for the reason text together with
  iOS 18, WKWebView, Apple Pencil or `UIPencilInteraction` found **no matching WebKit bug
  and no Pencil-related report**. Several other iOS 18 WKWebView crashes exist (keyboard
  hiding, reloads, input methods), none with this message.
- WebKit has its own "deferring" gesture recognizers and a "consistency enforcer" that resets
  them (WebKit bugs 204748, 222216; source file `GestureRecognizerConsistencyEnforcer.mm`).
  Seen only as search results; not tied to this crash.
- Apple forums thread 764352: a different UIKit gesture crash on iOS 18.0
  (`-[UIGestureRecognizer _delayTouchesForEvent:inPhase:]`). Snippet only.

### What does our own code do? (read in this repository, not an outside source)

- `native/Hifth/App/HifthApp.swift`: `@State private var model = ShellModel()` on the `App`
  itself. The `App` value is made at the very start of the process, before any window
  exists.
- `native/Hifth/Web/ShellModel.swift`, in `init`: builds the `WKWebView`, turns off scrolling
  and bounce, adds the `UIPencilInteraction`, and starts loading. So the web view and all of
  WebKit's gesture recognizers exist before there is a window or scene.
- `native/Hifth/Web/WebHost.swift`: `makeUIView` returns that pre-built `model.webView`.
- This matches both forum patterns above (built before launch finished; app model hands a
  pre-built web view to the wrapper).
- History: the app entry and wrapper date from 2026-09-29; the Pencil interaction was added
  on 2026-10-13 (commit `17dac555`).
- Test coverage: the iPad simulator used by `make app-test` is "iPad Pro 13-inch (M5)" on
  **iOS 26.5**, and the iPhone one is on iOS 26.5 too. The owner's iPad runs **18.5**. An
  "iPad Pro 11-inch (M4)" simulator on iOS 18.5 is installed on the laptop but no make target
  uses it. No UI test taps a verse; the taps in `SmokeTests.swift` are on toolbar buttons.

---

## How do you read a crash like this and get the missing reason?

### Apple, "Addressing language exception crashes" — fetched

https://developer.apple.com/documentation/xcode/addressing-language-exception-crashes

- A crash from an uncaught exception shows `EXC_CRASH (SIGABRT)` with
  `EXC_CORPSE_NOTIFY`, and has a "Last Exception Backtrace". That is our crash.
- Read the Last Exception Backtrace from the top: the throwing frames first, then the API
  that threw, then (further down) whichever of your own functions called it. In our report
  none of our functions appear, because the touch went straight from the window into UIKit.
- Key line for us: **"The crash report excludes the exception message for some errors to
  prevent disclosing private information about the person using the app."** That is why our
  `.ips` had no reason, and why we had to see it live on the console.
- "The uncaught exception handler provided by the operating system logs the exception message
  to the console before terminating the process." So the reason is in the device's log.
- With Xcode attached, an exception breakpoint stops at the throw; add the debugger action
  `po $arg1` to print the exception.
- If you cannot reproduce: "use all of the thread backtraces (not just the exception
  backtrace) as clues about what your app was doing".

### Apple, "Interpreting the JSON format of a crash report" — fetched

https://developer.apple.com/documentation/xcode/interpreting-the-json-format-of-a-crash-report

- `.ips` files are JSON since iOS 15; Console.app shows them translated.
- Fields that matter: `exception` (the Mach type and signal; "doesn't refer to language
  exceptions"), `lastExceptionBacktrace` (the stack where the exception was thrown), `asi`
  (application-specific information, where a reason appears when it is kept), `threads`
  (with `triggered: true` on the crashing thread), and the binary-image list used for
  symbolication.

### Apple, "Adding identifiable symbol names to a crash report" — fetched

https://developer.apple.com/documentation/xcode/adding-identifiable-symbol-names-to-a-crash-report

- Opening an `.ips` in Xcode symbolicates it; if system frames stay as addresses, download
  the device symbols for that OS version.
- Command line: `CrashSymbolicator.py` in
  `Xcode.app/Contents/SharedFrameworks/CoreSymbolicationDT.framework/Resources` handles the
  JSON format; `atos -arch arm64 -o <app>.dSYM/Contents/Resources/DWARF/<app> -l <load address> -i <address>`
  for single addresses.

### Apple, "Acquiring crash reports and diagnostic logs" — fetched

https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs

- Devices you can plug in: Xcode's Devices window lists their crash reports and logs.
- For issues that are not crashes, connect the device, open Console.app, select the device,
  reproduce, and read the log around that time.
- If a crash happens while Xcode's debugger is attached, detach (`detach`) to let the system
  write the full crash report.
- On the device itself: Settings > Privacy & Security > Analytics & Improvements > Analytics
  Data lists crash files by app name and date; each can be shared by mail.
- When asking Apple for help, post the `.ips` (renamed `.txt` if needed), symbolicated, with
  the app name redacted.

### Local tool help on this laptop — read directly

- `log collect --device | --device-name <name> | --device-udid <id>`, with `--last 10m`,
  `--start`, `--output x.logarchive`, `--predicate`. Builds a log archive from a plugged-in
  device that Console.app or `log show` can open.
- `xcrun devicectl device` has subcommands `copy`, `info`, `install`, `process`, `sysdiagnose`,
  and others. `devicectl device process launch` has `--console` (attach to the app's output
  and wait for it to exit), `--start-stopped`, `--terminate-existing`, and
  `-e/--environment-variables`; variables in the caller's environment prefixed
  `DEVICECTL_CHILD_` are passed through. `--json-output <file>` is "the ONLY supported
  interface for scripts".

### Apple forums thread 756393, devicectl `--console` — fetched

https://developer.apple.com/forums/thread/756393

- Apple staff: `--console` arrived in Xcode 16 ("capture standard output and standard error
  from the launched app and to wait until the app exits"). It shows what the app prints, not
  the whole unified log.

---

## What can our own code catch, and what can't it?

### Apple, `NSSetUncaughtExceptionHandler` — fetched

https://developer.apple.com/documentation/foundation/nssetuncaughtexceptionhandler(_:)

- "Sets the top-level error-handling function where you can perform last-minute logging
  before the program terminates." It can log; it cannot rescue the app.
- My note: this covers Objective-C exceptions like ours. It does not cover Swift runtime
  traps (force-unwrapping nil, array out of range) or memory faults; those are signals, not
  exceptions.

### Quinn (Apple DTS), "Implementing your own crash reporter", forums thread 113742 — fetched

https://developer.apple.com/forums/thread/113742

- "I strongly advise against implementing your own crash reporter." Lean on Apple's crash
  reports (Xcode Organizer) and MetricKit instead.
- If you do catch signals: only async-signal-safe calls (no Swift, no Objective-C, no
  `malloc`); write with `open`/`write`/`close`; never call `exit` (it "completely suppresses
  the Apple crash report"); better to reset the handler to the default and return so the
  system still writes its report.
- Mentions a new `CrashReportExtension` framework in the iOS 27 beta for out-of-process crash
  reporting. (I did not open its documentation.)

### Apple, MetricKit — fetched (symbol pages)

- `MXCrashDiagnostic`: https://developer.apple.com/documentation/metrickit/mxcrashdiagnostic —
  carries `callStackTree`, `exceptionType`, `signal`, `terminationReason`,
  `exceptionReason`.
- `MXCrashDiagnosticObjectiveCExceptionReason`:
  https://developer.apple.com/documentation/metrickit/mxcrashdiagnosticobjectivecexceptionreason
  — "The crash report for an uncaught Objective-C NSException can contain detailed
  information about the type, name and description of the exception object." Properties
  include `exceptionName`, `composedMessage`, `className`. Available from iOS 17, so on our
  iOS 17.0 minimum. This is the field that would have given us the reason the `.ips` left out
  (my inference; I have not seen one delivered).
- Both pages now list these as deprecated from iOS 27.3 in favour of new names
  (`CrashDiagnostic.ObjectiveCExceptionReason`, `MetricManager`). Still usable on 17–26.
- `MXMetricManager`: https://developer.apple.com/documentation/metrickit/mxmetricmanager —
  `add(_:)` to subscribe; `pastDiagnosticPayloads` for reports since the manager was made.

### WWDC21 "Triage TestFlight crashes in Xcode Organizer" (session 10203) — fetched

https://developer.apple.com/videos/play/wwdc2021/10203/

- Shows the MetricKit subscriber code and says crash diagnostics "are now delivered on the
  next launch of your app" rather than once a day.

### Quinn, "Is MetricKit automatically on all devices?", forums thread 784399 — fetched

https://developer.apple.com/forums/thread/784399

- Apple staff tested it: with "Share With App Developers" off, and then with "Share iPhone
  Analytics" off too, "I _still_ get crash diagnostics." Launch from the Home screen, not from
  Xcode, when testing this. Silent on TestFlight.

### Apple, `webViewWebContentProcessDidTerminate(_:)` — fetched

https://developer.apple.com/documentation/webkit/wknavigationdelegate/webviewwebcontentprocessdidterminate(_:)

- "Web views use a separate process to render and manage web content. WebKit calls this
  method when the process for the specified web view terminates for any reason."
- My note: our crash is in the app's own process, not WebKit's page process, so this callback
  would not have fired. It is still worth having: a dead page process otherwise leaves a blank
  screen with no record.

### Forwarding the page's JavaScript errors

- No outside source fetched. The standard approach is a `window.onerror` and
  `unhandledrejection` listener that posts to a `WKScriptMessageHandler`; our shell already has
  one message channel (the `Bridge`), so this is a small addition.

### WebKit blog, "Enabling the Inspection of Web Content in Apps" (2023) — fetched

https://webkit.org/blog/13936/enabling-the-inspection-of-web-content-in-apps/

- `isInspectable` (iOS 16.4+) lets Safari's Web Inspector attach to the app's web view on a
  device or simulator; on a device, turn on Web Inspector under Settings > Safari > Advanced.
  Our shell already sets it.

---

## How should the app log?

### Apple, "Generating log messages from your code" — fetched

https://developer.apple.com/documentation/os/generating-log-messages-from-your-code

- Use `Logger(subsystem:category:)`; subsystem in reverse-DNS form, category per area.
- Levels: debug (memory only), info (memory only unless collected with the `log` tool),
  notice/default, error, fault (all written to disk, up to a storage limit). So **anything we
  want to read after a crash must be notice level or above.**
- Privacy: numbers and booleans are shown; dynamic strings and objects are hidden by default
  unless marked `.public`. Mark only non-sensitive values (route, page number, event kind)
  public.
- Suggested points to log: start and end of important tasks, interesting events, errors, rare
  code paths, each step of a multi-step task.

### Apple, "Viewing log messages" — fetched

https://developer.apple.com/documentation/os/viewing-log-messages

- Read with Console.app, the `log` command, Xcode's console when attached, or the `OSLog`
  framework from inside the app.

### Apple, "Recording performance data" (signposts) — fetched, read only the opening

https://developer.apple.com/documentation/os/recording-performance-data

- `OSSignposter` marks the start and end of tasks with the same subsystem and category as
  logging, shown on a timeline in Instruments. I did not research signposts further.

---

## How do crash reports reach us from iPads that are not ours?

### Apple, App Store Connect Help, "View tester feedback" — fetched

https://developer.apple.com/help/app-store-connect/test-a-beta-version/view-tester-feedback

- TestFlight testers (TestFlight 2.3+) can send crash feedback with comments; it appears under
  the app's TestFlight tab > Feedback > Crashes; downloadable as a zip with the crash report;
  kept 120 days. "If an app becomes unresponsive due to a crash, a crash report won't be
  included in the .zip file." There is an App Store Connect API endpoint for it (link seen on
  the page, not opened).

### Apple, "Acquiring crash reports..." (above) — fetched

- "TestFlight users of your app automatically share crash reports with you, regardless of the
  device settings for sharing diagnostic and use data." App Store users' crashes reach the
  Organizer only if they share analytics with developers.
- Not in the Organizer: watchdog (slow launch), code-signature, thermal and memory (jetsam)
  events; those must be pulled from the device.
- Organizer symbolicates automatically when the upload included debug symbols.

### WWDC21 session 10203 — fetched

- TestFlight crashes reach Xcode Organizer "just moments later"; each feedback carries device
  model, build, battery and disk space; "work out of the box by simply signing into Xcode".

### "Share With App Developers" setting — snippet only

- Apple support and Xcode help pages (help.apple.com/xcode/mac/current/en.lproj/deve2819c518.html)
  say the switch lives in Settings > Privacy & Security > Analytics & Improvements, and that
  turning off device analytics turns it off too. Snippet only.

---

## How do we test so this is caught before an iPad?

- **Running UI tests on a real device from the command line** — snippet only (Appium and
  community docs; `man xcodebuild` not opened):
  `xcodebuild test -destination 'platform=iOS,id=<device id>' -allowProvisioningUpdates DEVELOPMENT_TEAM=<team>`.
  Developer Mode must be on (iPadOS 16+). One community page warns that the id
  `devicectl` prints may not be the id `xcodebuild` wants; check with
  `xcodebuild -showdestinations`.
- **Apple Pencil in the simulator** — snippet only: no Apple page found saying the simulator
  can produce Pencil touches, double-tap or squeeze; squeeze needs Apple Pencil Pro hardware.
  XCUITest has no stylus API that I could find. Lyft's open-source "Hammer" library can
  synthesise stylus touches on an iPad (https://github.com/lyft/Hammer, snippet only).
- **Real touch vs synthesised touch**: no source found that says the simulator's touch path
  differs from a device's for gesture recognizers. Unknown, not assumed.

---

## What did I not look at?

- Apple's `man xcodebuild` page for device testing (relied on community snippets).
- Any WebKit source for how WKWebView builds its gesture recognizers on iOS 18.
- The iOS 27 `CrashReportExtension` documentation.
- Third-party crash services (Sentry, Firebase Crashlytics): left out on purpose, as Apple's
  own advice is to lean on its crash reports and MetricKit, and the pitch build is private.
