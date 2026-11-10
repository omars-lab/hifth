# iPad crash on touch: what outside sources say (researcher A, raw findings)

Written 2026-11-10 by researcher A, one of two independent passes. This is the raw record:
every claim names its source and says whether the page was **fetched** (opened and read) or
seen only as a **search snippet** (not opened, so weaker). The recommendations are in the
companion file, `2026-11-10-ios-crash-troubleshooting-a-design.md`.

Apple's documentation pages are drawn by JavaScript, so a plain fetch returns only the title.
Their text was read through the JSON copy Apple serves for each page
(`https://developer.apple.com/tutorials/data/documentation/<path>.json`). Those count as
fetched below; the human-readable address is given.

## A few words used throughout

- **Crash report (.ips file):** the file iOS writes when an app dies. Since iOS 15 it is JSON
  inside; Console and Xcode turn it into readable text.
- **Symbolication:** turning the raw memory addresses in a crash report back into function
  names and line numbers. It needs the **dSYM**, a side file Xcode writes at build time that
  holds those names for one exact build.
- **Uncaught exception:** an Objective-C error object (an `NSException`) that Apple's own code
  "throws" when it finds something impossible. If nobody catches it, the app is stopped on
  purpose (SIGABRT).
- **Unified log:** the system-wide log every Apple device keeps. Our app can write to it with
  `Logger`; the laptop can read it from Console.app or the `log` command.
- **MetricKit:** an Apple framework that hands the app, on its next launch, a summary of its
  own last crash.

## Question 1. What is known about this exact crash, and how do you dig into one like it?

### 1a. The assertion itself: "Invalid parameter not satisfying: targetNode"

| # | Source | Fetched? | What it says |
| --- | --- | --- | --- |
| 1 | Apple Developer Forums 61432, "UIGestureGraphEdge Crash" — https://developer.apple.com/forums/thread/61432 | **Fetched** | Same assertion (`-[UIGestureGraphEdge initWithLabel:sourceNode:targetNode:directed:]`, `NSInternalInconsistencyException`, reason `Invalid parameter not satisfying: targetNode`), first seen on iOS 10 betas (2016). Triggers reported: tapping a navigation bar, swiping scroll views, and **tapping a WKWebView**. Two causes were narrowed down by posters, both the same shape: **a view that uses gestures was created before UIKit had finished starting up.** One poster created a WKWebView in `+load` (runs before the app launches) — it crashed on tap; creating it one second later fixed it (accepted answer). Another reproduced it in a sample app by building the window and root view controller inside the app delegate's `init` (before launch); moving it later fixed it. A third: a view with gesture recognizers set up in `+load` "aborts on touch down"; suspected cause "the gesture environment isn't initialized yet"; fix was to create the view in `applicationDidFinishLaunching`. No Apple staff reply. |
| 2 | Apple Developer Forums 784931, "Using a WKWebView inside RealityView attachment causes crashes" — https://developer.apple.com/forums/thread/784931 | **Fetched** | visionOS, May 2025. Same exception and reason, thrown at `UIGestureGraphEdge.m:28`, on touching the web view. The poster's web view was **created ahead of time, held by a model object and handed in** to the attachment. Their own fix (not confirmed by Apple, and they say "Not sure what is different"): let the attachment's view wrapper create a fresh `WKWebView` itself. No Apple reply, no feedback number. |
| 3 | Apple Developer Forums 824534, "NSInternalInconsistencyException" — https://developer.apple.com/forums/thread/824534 | **Fetched** | April 2026. Same message, asks how to locate the crash. No OS version, no trigger, no replies. Shows the crash is still being met on current systems. |
| 4 | Apple Developer Forums 764352, iOS 18.0 crash in `_delayTouchesForEvent:inPhase:` — https://developer.apple.com/forums/thread/764352 | **Fetched** | iOS 18.0. A *different* message (`insertObject:atIndex: object cannot be nil`) but from the same UIKit gesture code (`_UIGestureEnvironmentUpdate`, `-[UIGestureEnvironment _deliverEvent:toGestureRecognizers:usingBlock:]`, `-[UIWindow sendEvent:]`). An Apple engineer asked only for a small sample project and a feedback number. Unresolved. Shows iOS 18's gesture code can hit a missing ("nil") gesture during touch delivery. |
| 5 | WWDC24 "What's new in UIKit" (session 10118) — https://developer.apple.com/videos/play/wwdc2024/10118/ | Snippet only | iOS 18 merged the SwiftUI and UIKit gesture systems into one, with dependencies allowed between gestures of both kinds. **Our inference, not stated anywhere:** this rewrite is a plausible reason an iOS 10-era failure shape could come back on iOS 18 in a SwiftUI app. |
| 6 | WebKit bug 246823, "MobileMail sometimes crashes underneath -[WKContentView(WKInteraction) deferringGestures]" — https://bugs.webkit.org/show_bug.cgi?id=246823 | **Fetched** | 2022, fixed same day. Page has no details beyond the title. A search snippet (not on the page) said UIKit can call WebKit's gesture delegate methods "before setup has run". Shows WebKit's own gesture setup has had ordering crashes before. Not this bug. |
| 7 | Search for WebKit bugs naming `UIGestureGraph` or `targetNode` | Searched | **Nothing found** in WebKit's tracker. No Apple acknowledgement of the assertion found anywhere. |
| 8 | Search for `UIPencilInteraction` + WKWebView crash | Searched | **Nothing found.** No report ties a pencil interaction on a web view to this crash. |

**What this means for us (inference, to be tested):** our app's one web view is created inside
`ShellModel.init`, and `ShellModel` is created by `@State private var model = ShellModel()` in
the `@main` app struct (`native/Hifth/App/HifthApp.swift`). Apple's own `State` documentation
(fetched: https://developer.apple.com/documentation/swiftui/state) says "A `State` property
always instantiates its default value when SwiftUI instantiates the view", and warns against
side effects there, suggesting `.task` to defer creation. The app struct is built at the very
start of the program, so the web view, its pencil interaction and its scroll-view changes are
likely all made **before the app has finished launching** — the exact shape threads 1 and 2
describe. This is a hypothesis: no source says SwiftUI's `@State` on an `App` struct triggers
this crash, and it has been our code since the first shell commit (2026-09-29), so if the app
ever took finger taps on this iPad without closing, the hypothesis weakens.

### 1b. Reading the crash report and getting the reason

| # | Source | Fetched? | What it says |
| --- | --- | --- | --- |
| 9 | Apple, "Addressing language exception crashes" — https://developer.apple.com/documentation/xcode/addressing-language-exception-crashes | **Fetched** | An uncaught exception shows as `EXC_CRASH (SIGABRT)` with a `Last Exception Backtrace`. Read down that backtrace to find the API that threw and the first frame of **your** code that called it. "The crash report excludes the exception message for some errors to prevent disclosing private information" — which is why our .ips had no reason. The reason is printed to the console by the system's handler, so reproduce with a console attached. In Xcode, an exception breakpoint with the action `po $arg1` prints it. If no frame of your code is in the backtrace, "use all of the thread backtraces … as clues about what your app was doing". |
| 10 | Apple, "Interpreting the JSON format of a crash report" — https://developer.apple.com/documentation/xcode/interpreting-the-json-format-of-a-crash-report | **Fetched** | .ips is JSON since iOS 15. Fields to read: `lastExceptionBacktrace` (where it was thrown) and `asi` (application-specific information: the framework's last words, shown as "Application Specific Information"). |
| 11 | Apple, "Examining the fields in a crash report" — https://developer.apple.com/documentation/xcode/examining-the-fields-in-a-crash-report | **Fetched** | "Application Specific Information is sometimes elided from a crash report to avoid logging privacy-sensitive information." |
| 12 | Apple, "Adding identifiable symbol names to a crash report" — https://developer.apple.com/documentation/xcode/adding-identifiable-symbol-names-to-a-crash-report | **Fetched** | Xcode symbolicates automatically when it has the dSYM. By hand: `python3 CrashSymbolicator.py <report.ips> -d <App.app.dSYM> -o <out.ips>`, or one address at a time: `atos -arch arm64 -o <App.app.dSYM>/Contents/Resources/DWARF/<App> -l <load-address> -i <address>`. Apple's own frames (UIKit, WebKit) are named already when the report reaches a Mac that has the matching device support files. |
| 13 | Apple, "Acquiring crash reports and diagnostic logs" — https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs | **Fetched** | On the device: Settings › Analytics & Improvements › Analytics Data, find `<AppName>_<date>`, share it. From the Mac: Xcode's Devices window, or Console.app with the device selected, "reproduce the issue and note the exact time". If the debugger catches the crash, "detach the debugger" so the system writes the full report. When asking Apple for help, post the whole `.ips`, symbolicated. |
| 14 | Apple, "Diagnosing issues using crash reports and device logs" — https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs | **Fetched** | The order: build with symbols and keep the archive → get the report → symbolicate → match it to a known crash pattern → fix → "Add tests … to ensure the issue doesn't reoccur". |
| 15 | `xcrun devicectl device process launch --help` (Xcode 26.6, run on this laptop) | **Verified locally** | `--console` "Attaches the application to the console and waits for it to exit" — this is how the reason was obtained today. `--terminate-existing` stops an older copy first. Environment variables pass as `DEVICECTL_CHILD_<NAME>`. |
| 16 | `xcrun devicectl device copy from --help` (run locally) | **Verified locally** | Domains: `temporary`, `appDataContainer` (with the bundle id as `--domain-identifier`), `appGroupDataContainer`, `systemCrashLogs`. So a file the app writes into its own Documents folder can be pulled off the iPad the same way the .ips was. |
| 17 | `log help collect` (run locally) | **Verified locally** | `log collect --device-name "<name>" --last 1h --output <file>.logarchive` copies the device's unified log to the laptop (also `--device`, `--start`, `--size`, `--predicate`). Read it with `log show --archive <file>.logarchive --predicate 'subsystem == "…"'` or open it in Console. Device must be unlocked and paired (from snippet, item 18). |
| 18 | mac4n6 and ElcomSoft blog posts on `log collect` from iPhones — https://www.mac4n6.com/blog/tag/sysdiagnose, https://blog.elcomsoft.com/2025/06/extracting-and-analyzing-apple-unified-logs/ | Snippet only | `sudo log collect --device-udid … --last 10m` works on iPhones; may need the device unlocked and trusted; one author saw partial archives on Apple Watch. Logs cover up to about the last ten days. |
| 19 | Quinn (Apple DTS), "Using a Sysdiagnose Log to Debug a Hard-to-Reproduce Problem" — https://developer.apple.com/forums/thread/739560 | **Fetched** | Add your own log lines first, bracketing the operation, so you can find the moment. A sysdiagnose is a `.tar.gz`; the key file is `system_logs.logarchive`. Search it in Console with `subsystem:<your subsystem>`, then work backwards through the system's entries. The button combination to trigger one is on Apple's Bug Reporting › Profiles and Logs page (not repeated in the post). |
| 20 | Quinn (Apple DTS), "Your Friend the System Log" — https://developer.apple.com/forums/thread/705868 | **Fetched** | `sudo log collect --last 5m` for a snapshot; Console.app reads an attached iOS device live and opens `.logarchive` files. Debug and info entries are not kept by default; turn them on for a subsystem with an Apple logging profile or an `OSLogPreferences` key in the app's Info.plist. `NSLog`/`print` are effectively superseded by the system log. On iOS, the app can read back only its own entries (`OSLogStore`, current process scope). |
| 21 | Apple Developer Forums 756393 and a Capacitor skills reference (via search) | Snippet only | `devicectl … launch --console` captures the app's stdout and stderr and forwards Ctrl+C; without it, nothing the app prints reaches the laptop. Early Xcode 15 builds sometimes refused it. |

## Question 2. What can our own code catch, and what can it not?

| # | Source | Fetched? | What it says |
| --- | --- | --- | --- |
| 22 | Quinn (Apple DTS) and others, "Swift Exception Handling in Apple OSes" — https://developer.apple.com/forums/thread/767645 | **Fetched** | Four kinds of failure. (1) Swift `throw` errors: caught with `do`/`catch`. (2) Swift runtime traps (out of bounds, force-unwrap of nil, divide by zero): not catchable safely; they become machine exceptions. (3) Objective-C exceptions (`NSException`, like ours): only `NSSetUncaughtExceptionHandler`, and "the exception mechanisms of Objective-C and Swift are totally separate"; "Exceptions are supposed to crash the app." (4) Signals (SIGSEGV etc.): a signal handler is possible but "super hard" to do safely. |
| 23 | Quinn (Apple DTS), "Implementing Your Own Crash Reporter" — https://developer.apple.com/forums/thread/113742 | **Fetched** | "strongly advise[s] against implementing your own crash reporter." An in-process reporter can never be fully reliable. It must not disturb Apple's report, because "some fraction of your crashes will not be caused by your code but by problems in framework code" — exactly our case. Never call `exit` (it "completely suppresses the Apple crash report"). Signal handlers may use only async-signal-safe calls, so no Swift, no Objective-C, no `malloc`. Recommends Apple's tools and MetricKit's `MXCrashDiagnostic` instead. The 2026 revision adds that iOS 27 brings an out-of-process `CrashReportExtension` framework. |
| 24 | Stack Overflow answers mirrored on kiwix, Apple forum 114812 (via search) | Snippet only | `NSSetUncaughtExceptionHandler` sees only Objective-C exceptions; the handler must be a closure that captures nothing; it runs on whatever thread threw. |
| 25 | Apple, `MXCrashDiagnostic.exceptionReason` and `MXCrashDiagnosticObjectiveCExceptionReason` — https://developer.apple.com/documentation/metrickit/mxcrashdiagnosticobjectivecexceptionreason | **Fetched** (doc JSON, including its platform list) | Available **iOS/iPadOS 17.0+** (our deployment target is 17.0). For an uncaught Objective-C exception it carries `className`, `exceptionName`, `composedMessage` (the reason text), `formatString`, `arguments`, `exceptionType`, and `jsonRepresentation()`. Marked deprecated from 27.3 in favour of a newer `CrashDiagnostic.ObjectiveCExceptionReason`. So MetricKit would have handed us today's reason on the next launch, with no cable. |
| 26 | Apple, MetricKit overview — https://developer.apple.com/documentation/metrickit | **Fetched** | "Diagnostic reports arrive immediately in iOS 15 and later" (meaning on the next launch, per item 27); metric reports at most once a day. iOS 27 adds `MetricManager` with async sequences. |
| 27 | WWDC21 "Triage TestFlight crashes in Xcode Organizer" (10203) — https://developer.apple.com/videos/play/wwdc2021/10203/ | **Fetched** | Crash diagnostics now arrive "on the next launch of your app". Shows the subscriber shape: `MXMetricManagerSubscriber`, `didReceive(_ payloads: [MXDiagnosticPayload])`, read `crashDiagnostics`. |
| 28 | WWDC20 "What's new in MetricKit" (10081) — https://developer.apple.com/videos/play/wwdc2020/10081/ | **Fetched** | `MXCrashDiagnostic` holds "the exception information, termination reason, virtual memory region information … and the backtrace". Call stacks "are unsymbolicated and designed for off-device processing" (they carry binary UUIDs and offsets for `atos`). Also hang, CPU and disk-write diagnostics. Register with `MXMetricManager.shared.add(self)`. |
| 29 | Apple Developer Forums 806457 (via search) | Snippet only | Reports that crash and hang diagnostics were not delivered on next launch on iOS 17.2–17.5. Apple asked for a sample. Not our OS (18.5). |
| 30 | A third-party library's docs (ChimeHQ Meter, via search) | Snippet only | Says MetricKit captures uncaught NSExceptions from iOS 17. Consistent with item 25, which is the primary source. |
| 31 | Apple, `webViewWebContentProcessDidTerminate(_:)` — https://developer.apple.com/documentation/webkit/wknavigationdelegate/webviewwebcontentprocessdidterminate(_:) | **Fetched** | "Web views use a separate process to render and manage web content. WebKit calls this method when the process … terminates for any reason." Without it, a dead page process leaves a blank or frozen page and no trace. **Our code does not implement it** (checked: `NavigationPolicy` in `ShellModel.swift`). Note: this does *not* cover today's crash, which killed the app process itself, not the page process. |
| 32 | WebKit blog, "Enabling the Inspection of Web Content in Apps" — https://webkit.org/blog/13936/enabling-the-inspection-of-web-content-in-apps/ | **Fetched** | `isInspectable = true` (iOS 16.4+) lets Safari's Develop menu attach Web Inspector to the app's web view on a device, once Web Inspector is turned on in the iPad's Settings › Safari › Advanced. Shows the page's console and lets you step JavaScript. Our shell already sets `isInspectable = true`. |
| 33 | innoq blog, xjavascript guide, Apple forum 125603 (via search) on forwarding `console.log` | Snippet only | Common pattern: injected script wraps `console.log` and posts each message through a `WKScriptMessageHandler`; keep calling the original so Web Inspector still shows it. No source found with code for `window.onerror` / `unhandledrejection`; that part we would write ourselves (standard browser events, no outside source needed). Our bridge (`native/Hifth/Web/Bridge.swift`) today knows only `ready`, `route` and `share`. |

## Question 3. Better logging

| # | Source | Fetched? | What it says |
| --- | --- | --- | --- |
| 34 | Apple, "Generating log messages from your code" — https://developer.apple.com/documentation/os/generating-log-messages-from-your-code | **Fetched** | Levels: debug (memory only), info (memory only unless configured), notice/default (written to disk), error, fault (written, with extra process-chain capture). Debug is very cheap. **Privacy:** dynamic strings and objects are redacted by default (show as `<private>`); numbers and booleans are not; mark a value `privacy: .public` to see it. "Limit your log messages to static strings and numbers that you define." |
| 35 | Quinn, "Your Friend the System Log" (item 20) | **Fetched** | Use the Swift `Logger`, one subsystem and a few categories ("One is fine, ten is OK, 100 is too much"). Leave most log points on in release builds. Don't wrap the API in your own formatter. |
| 36 | Apple, "Diagnosing issues using crash reports and device logs" (item 14) | **Fetched** | "Don't include privacy-sensitive information in your logs." Log lines help trace "the interaction between your app and one of its app extensions" — by the same logic, between the app and its web page. |
| 37 | Our own code | **Read locally** | `ShellModel.subsystem = "com.bytesofpurpose.hifth"` is declared but nothing uses it; every message is `print()`, which on the iPad reaches the laptop only while `devicectl … --console` is attached. `make app-logs` runs `log stream --predicate 'process == "Hifth"'`, which reads the Mac's own log (Mac app, simulator), not the iPad's. |
| 38 | Signposts (`OSSignposter`) | Not looked up | Known API for timing intervals in Instruments; not researched in this pass. Said so rather than guessed. |

## Question 4. Getting crash reports and logs from devices that are not ours

| # | Source | Fetched? | What it says |
| --- | --- | --- | --- |
| 39 | Apple, "Acquiring crash reports and diagnostic logs" (item 13) | **Fetched** | TestFlight and App Store builds: reports appear in Xcode's Crashes organizer. "TestFlight users of your app automatically share crash reports with you, regardless of the device settings." App Store users must have turned on sharing. Not delivered through the organizer: watchdog (slow launch), bad code-signature, overheating, out-of-memory ("jetsam") events — get those from the device. Anyone can email a report from Settings › Analytics & Improvements › Analytics Data. |
| 40 | Apple, "Building your app to include debugging information" — https://developer.apple.com/documentation/xcode/building-your-app-to-include-debugging-information | **Fetched** | Set Debug Information Format to "DWARF with dSYM File"; include symbols when uploading to App Store Connect so reports arrive with names. "You must retain the Xcode archive for each build of your app you distribute." Each binary and its dSYM share a build UUID and only match each other. |
| 41 | WWDC21 10203 (item 27) | **Fetched** | TestFlight crashes reach the organizer "just moments later"; tester comments, device model, battery and free disk come with them; "Open in Project" jumps to the line. Works by signing into Xcode with the developer account. |
| 42 | App Store Connect Help, "View tester feedback" — https://developer.apple.com/help/app-store-connect/test-a-beta-version/view-tester-feedback | Snippet only | Testers on TestFlight 2.3+ send screenshots and crash comments; they show under the app's TestFlight tab; the crash log can be downloaded. |
| 43 | Xcode Help, "Share crash, energy, and metrics data with developers" — https://help.apple.com/xcode/mac/current/en.lproj/deve2819c518.html | Snippet only | The setting on iPad: Settings › Privacy & Security › Analytics & Improvements › Share With App Developers. Up to about three days before reports from a new build show. |
| 44 | Apple Developer Forums 765935, 681414 (via search) | Snippet only | Some developers saw TestFlight crash logs on the device that never reached App Store Connect. |
| 45 | This repo: `TESTFLIGHT_GATE` in `native/Makefile.native`, `docs/research/2026-11-09-testflight-own-devices.md` | **Read locally** | Uploads are refused until the TestFlight licence decision is settled. So today only the owner's own devices exist; items 39–44 apply once that decision lands. |

## Question 5. Testing so this is caught before a device

| # | Source | Fetched? | What it says |
| --- | --- | --- | --- |
| 46 | Apple, "Running your app on simulated or physical devices" — https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices | **Fetched** | Simulators "don't replicate the performance or features of a physical device. To verify that your app runs exactly as intended, run it on one or more physical devices." Some hardware features are missing in simulators. |
| 47 | `man xcodebuild` (Xcode 26.6, read locally) | **Verified locally** | Tests can run on a real device by name: `-destination 'platform=iOS,name=My iPad'`, and on a simulator and a device in the same run. `-allowProvisioningUpdates` lets it fetch signing. |
| 48 | Tauk blog, "Running XCTests from the Command Line" — https://medium.com/tauk-blog/running-xctests-from-the-command-line-f2e5ce0b4bfd | Snippet only | Same `platform=iOS,id=…` / `name=…` form for physical devices. |
| 49 | Apple Developer Forums 838433, 846533 (via search) | Snippet only | Xcode 27's "Device Hub" cannot yet send two-finger touches to a simulator; earlier Xcode used Option-drag. (We run Xcode 26.6.) |
| 50 | Search for Apple Pencil / hover in Simulator | Searched | **No Apple page found** on what the Simulator does with Pencil. Treat Pencil (and squeeze, double-tap, hover) as device-only. |
| 51 | Our own setup | **Read locally** | `xcrun simctl list runtimes` shows iOS 17.4, 18.5 and 26.5. The Makefile's default test iPad is "iPad Pro 13-inch (M5)", which exists only on **26.5**, so `make app-test` and the walks never run on 18.5, the owner's iPad's version. An 18.5 iPad Pro 11-inch (M4) simulator exists. |

## What was looked for and not found

- Any Apple statement, WebKit bug, or fix for the `targetNode` assertion on iOS 18.
- Any report tying `UIPencilInteraction` on a web view to a crash.
- Apple's own page on what the Simulator does with Apple Pencil.
- Code from an outside source for forwarding `window.onerror` to native.
