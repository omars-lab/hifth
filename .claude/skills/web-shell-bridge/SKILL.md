---
name: web-shell-bridge
description: How hifth's SwiftUI shell hosts the web build: use when editing Swift under native/, adding a JS-to-Swift message, changing the hifth-app scheme handler, handling external links, or calling into the web app after it says it is ready.
---

# How the shell hosts the web app

The shell is one `WKWebView`, made once by `ShellModel` and only handed to SwiftUI through a
representable (`WebHost.swift`). Nothing is loaded from `updateUIView`/`updateNSView` — a load
there would reload the page under the reader on every state change. Swift 6, strict
concurrency, everything on the main actor unless it says `nonisolated`.

## Short version

| piece | file | what it does |
|---|---|---|
| the web view and its rules | `native/Hifth/Web/ShellModel.swift` | makes the view, queues routes, handles messages, probe, snapshot |
| serving the build | `native/Hifth/Web/LocalScheme.swift` + `BundleFiles.swift` | `hifth-app://app/…` → a file in `WebBundle/`, with a content type |
| messages page → shell | `native/Hifth/Web/Bridge.swift` ↔ `apps/web/src/native-bridge.ts` | one contract, two files, changed together |
| route grammar | `native/Hifth/Route/Route.swift` | shape check only; the web router owns meaning |
| the SwiftUI wrapper | `native/Hifth/Web/WebHost.swift` | representable + the 1×1 route label the tests read |
| tests | `native/HifthTests/*.swift` (Swift Testing) · `apps/web/src/native-bridge.test.ts` (vitest) | `make app-unit-test` · `pnpm --filter @hifth/web exec vitest run src/native-bridge.test.ts` |

The iOS 26 `WebView`/`WebPage` SwiftUI API is a backlog item; for now stay on `WKWebView` in
a representable, which both platforms share and which gives the scheme handler, message
handler and navigation delegate we need.

## The origin is frozen: `hifth-app://app`

The build is served through a `WKURLSchemeHandler` at `hifth-app://app/index.html`. That
origin is also the **storage origin** — bookmarks, notes, the revision record all live under
it — so changing the scheme or host leaves every reader's data behind. `file://` is not an
option: WebKit refuses `fetch()` of file URLs, and every page of the mus'haf is fetched.

How the handler serves a folder (`BundleFiles`, pure and tested without a web view):

1. Canonicalise the path: drop `.`, resolve `..`, refuse anything that climbs out (403).
2. `/` and a trailing slash mean that folder's `index.html`.
3. Content type by extension from one table; text types get `; charset=utf-8`. Module scripts
   **must** be `text/javascript` — served as anything else the browser refuses them silently
   and the app never boots. Unknown → `application/octet-stream`.
4. Missing file → 404 with the relative path in the body (shows up in the Web Inspector).
5. Raw bytes, `Cache-Control: no-cache`, no compression: the handler cannot say
   `Content-Encoding: gzip` and have WebKit inflate it.

The read happens off the main thread (`Task.detached`), the answer is delivered on it, and
**only if WebKit still wants it**: `LocalSchemeHandler` keeps the live tasks in a dictionary
keyed by identity and drops one on `stop`. Answering a stopped task is an uncatchable
exception, and a fast page turn stops tasks all the time.

Data store: the **default persistent** one. A non-persistent store would wipe bookmarks and
notes every launch; do not "fix" a caching problem by switching it.

## The ready handshake and the three messages

The shell injects `window.__HIFTH_NATIVE__ = {platform, publicBase}` at document start, main
frame only, so `isNative()` is already true when the first module runs. The page posts to one
handler, `webkit.messageHandlers.hifth`:

| message | shape | the shell does |
|---|---|---|
| `ready` | `{type:"ready"}` | marks ready; applies a queued route; runs the probe or snapshot if asked |
| `route` | `{type:"route", hash}` | mirrors it into `currentHash` → window title and the `hifth.route` label |
| `share` | `{type:"share", url, title, text}` | shows the platform share sheet (the page is not a secure context, so `navigator.share` is missing) |

`publicBase` goes the other way: a shared link built from `location.origin` inside the shell
would read `hifth-app://app/…` and be dead for everyone it was sent to.

## Calling into the page

Only after `ready`, and only with arguments bound, never string-built:

```swift
webView.callAsyncJavaScript("location.hash = route;", arguments: ["route": hash], in: nil, in: .page) { _ in }
```

`ShellModel.show(_:)` queues a hash that arrives early and sends it on `ready`. Cold-start
routes never go this way: they ride in the initial URL's fragment. Anything new that talks to
the page follows the same shape: a static script with named arguments, sent through
`callAsyncJavaScript`, never `evaluateJavaScript("… \(value) …")`.

## Navigation policy

`NavigationPolicy` (in `ShellModel.swift`) is both navigation and UI delegate:

- `hifth-app:` and `about:` stay in the web view. Everything else is cancelled and handed to
  `Sharing.openExternally`, which opens `http`, `https` and `mailto` in the system browser and
  drops anything else.
- A page that opens a new window (`target="_blank"`) gets no new web view; the URL goes out
  the same door.
- `didFinish` is where iOS disables the pinch recognizer (belt to the viewport meta's brace).

## Adding a message, both sides, same change

1. **Web** — `apps/web/src/native-bridge.ts`: add the variant to `NativeMessage`, add a
   `postX()` that calls `post(...)`. Test in `apps/web/src/native-bridge.test.ts`: in a
   browser it is a no-op that returns `false`; with a fake `webkit.messageHandlers.hifth` it
   posts exactly that object. Write it first and watch it fail.
2. **Swift** — `native/Hifth/Web/Bridge.swift`: add the case to `BridgeMessage` and decode it
   in `init?(body:)` (refuse a missing required field, return `nil`). Handle it in
   `ShellModel.receive(_:)`.
3. **Swift test** — `native/HifthTests/BridgeTests.swift`: one line in `decode` for the good
   shape, one in `refuses` for the shape with a field missing. `make app-unit-test`.
4. If the shell must answer, go through `callAsyncJavaScript` with bound arguments (above),
   not a string.
5. If a reader could see it, a smoke launch or a Playwright `ipad` test as well
   (repo rule: a fix ships with the test that would have caught it).

## Traps

| trap | why | rule |
|---|---|---|
| `file://` | `fetch()` refused; SVG pages never load | always the scheme handler |
| wrong MIME | module script refused silently; blank app | `.js`/`.mjs` → `text/javascript`; extend the table in `BundleFiles`, with a test |
| answering a stopped task | uncatchable exception | only deliver to tasks still in `live` |
| `allowsMagnification = true` (Mac) | WebKit eats the trackpad pinch as page zoom | keep it `false`; the web stage handles pinch |
| no `UILaunchScreen` in `Info-iOS.plist` | iPadOS letterboxes at iPhone size; desktop layout never appears | keep the (empty) dictionary |
| safe-area inset applied twice | `contentInsetAdjustmentBehavior = .never` **and** `.ignoresSafeArea()` are both needed | change one, change both |
| media playback | inline playback off by default on iOS | `allowsInlineMediaPlayback = true`, `mediaTypesRequiringUserActionForPlayback = []` |
| string-built JS | injection, quoting bugs | `callAsyncJavaScript` with `arguments:` |
| loading in `updateUIView` | reloads on every SwiftUI update | the model makes and loads the view once |
| `simctl openurl` in scripts | a confirmation alert once per install | `SIMCTL_CHILD_HIFTH_ROUTE` env var; terminate before launch |
| copying the web build in an Xcode run-script phase | user-script sandboxing (on) forbids it | `make app-web` copies; `WebBundle/` is a folder reference |
| gzip through the handler | WebKit will not inflate a handler's reply | serve raw bytes |
| non-persistent data store | wipes bookmarks and notes each launch | default store, always |
| a hidden route label | `opacity(0)`/`hidden()` leaves the accessibility tree | 1×1, `.clipped()`, with `accessibilityIdentifier` |
| a route applied before `ready` | parsed into nothing on the far side | queue in `pendingHash` |

## Checking it by eye

`make app-probe` (what the page can see: origin, secure context, caches, share, storage),
`make app-shot` (a PNG of the page), Safari → Develop → the Hifth web view (it is
`isInspectable`). The `native-shell` skill has the run and screenshot targets.

NOTICE: Reworked from rshankras/claude-code-apple-skills `swiftui/webkit` (MIT, Ravi Shankar,
2025), with two corrections: keep the default persistent data store, and stay on `WKWebView`
in a representable until the iOS 26 `WebView`/`WebPage` swap is done.
