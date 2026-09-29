# Swift: concurrency, optionals, hygiene

Read by the `swift-shell-review` skill. The app targets are Swift 6 language mode with
`SWIFT_STRICT_CONCURRENCY: complete` and `SWIFT_DEFAULT_ACTOR_ISOLATION: MainActor`
(`native/project.yml`). That default is what lets the WebKit delegates compile without
annotations; most rules below follow from it.

## Concurrency

- **Everything is main-actor unless it says otherwise.** A class or struct with no annotation
  is on the main actor. That is right for the model, the views, the delegates and the message
  handler. Do not sprinkle `@MainActor` where the project default already applies it.
- **Pure helpers are `nonisolated enum`s** with only static members: `Route`, `BundleFiles`.
  They have no state, can be called from any thread (the scheme handler's detached read), and
  are tested without a web view. A new helper with no UI and no state follows the same shape.
- **`nonisolated` is a decision, not a warning fix.** If the compiler says a call is not on
  the main actor, ask why the caller is off it first. Marking a function `nonisolated` to
  silence it usually moves the data race, not removes it.
- **`Task.detached` is rare and justified in a comment.** The one in `LocalSchemeHandler`
  reads a file off the main thread and returns with `await MainActor.run { … }` to deliver.
  Anything else that wants `detached` probably wants a plain `Task { }` (inherits the actor)
  or an `async` function.
- **Check `MainActor.run` against the default isolation.** Inside a main-actor type it is a
  no-op and reads as confusion; it earns its place only when hopping back from a detached task.
- **`Sendable` crossing.** Values handed to a detached task or a continuation must be
  `Sendable` — `URL`, `Data`, `String`, a `struct` of those (`BundleFiles.Reply` is marked).
  Never capture the web view in a detached task; capture what it needs.
- **`async`/`await` over completion handlers**, and a `withCheckedContinuation` around a
  WebKit callback that has no async form (`takeSnapshot`). Resume exactly once.
- **No Grand Central Dispatch.** No `DispatchQueue.main.async`; a `Task` on the main actor
  does the same and the compiler can see it.
- **`Task.sleep(for: .milliseconds(n))`**, never `Task.sleep(nanoseconds:)`.
- **Delegate methods keep WebKit's signatures.** `WKNavigationDelegate` and friends are
  called on the main thread; with the project default they compile as main-actor. The
  async `decidePolicyFor` form is preferred over the completion-handler one.
- **Weak self in stored closures.** `bridge.onMessage = { [weak self] … }` — a stored closure
  on a long-lived object captures the model weakly, or the model never dies.

## Optionals and errors

- No force unwrap (`!`) and no `try!` outside a `static let` built from a string literal that
  cannot fail (`URL(string: "hifth-app://app/index.html")!`). Even there, prefer a shape the
  type system checks.
- `guard let x else { return }` with the reason clear from the surrounding line — a bare
  `return` in a method the reader will not guess at gets a comment.
- Shorthand: `if let value {` not `if let value = value {`.
- An error the reader caused is shown to the reader; an error only a developer can act on is
  printed with a prefix that `grep` finds (`probe failed`, `snapshot failed`), and in one-shot
  modes exits non-zero. Never swallow with an empty `catch`.
- `try?` is fine when the fallback is the right answer (`removingPercentEncoding ?? requestPath`).

## Foundation and strings

- Swift-native string APIs: `replacing(_:with:)`, `split(separator:)`, `hasPrefix`, never
  `NSString` bridging or `String(format:)`.
- `URL.appending(path:)` / `appendingPathComponent(_:)`; `FileManager` only to test existence
  and directories. `Data(contentsOf:options: .mappedIfSafe)` for large files.
- `Date.now`; `FormatStyle` for anything shown to a person.
- Static member lookup (`.userInitiated`, `.page`, `.darkAqua`), not the type spelled out.
- `Double` over `CGFloat` unless an API forces it.

## Hygiene

- One type per file, the file named for the type. Small private helpers may share a file
  with the type they serve (`NavigationPolicy`, `Sharing` live with `ShellModel` because they
  are its two delegates; splitting them is fine when they grow).
- A stored value with a reason gets the reason in a comment, in plain words:
  why `allowsMagnification` is off, why the origin is frozen, why the label is 1×1. The
  repo's readers are not Swift people; say the thing the code stands for.
- No secrets in the repository; no `@AppStorage` for anything sensitive.
- `#Preview` for a view that is worth previewing; the web view is not (needs the bundle).
- Magic numbers are named or explained: `defaultSize(width: 1280, height: 860)` carries the
  comment that the web app's desktop layout begins at 1024×740.
- `#if os(iOS)` / `#else` blocks stay small and symmetric; if a platform difference grows
  past a few lines, it becomes a type per platform behind one protocol.
- Build warnings are findings. `make app-unit-test` builds the Mac target with the same
  settings as the app; a clean build is the bar.
- Tests: `Swift Testing` (`@Suite`, `@Test`, `#expect`, `#require`) in `native/HifthTests/`
  for logic; XCUITest in `native/HifthUITests/` only for what a reader would see. UI test
  targets are Swift 5 mode — do not port strict-concurrency idioms into them.

NOTICE: Reworked from swiftui-pro `references/swift.md` and `references/hygiene.md`
(MIT, Paul Hudson, 2026), narrowed to what a Swift 6 strict-concurrency shell hits.
