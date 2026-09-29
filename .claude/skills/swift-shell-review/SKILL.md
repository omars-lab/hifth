---
name: swift-shell-review
description: Review or write Swift/SwiftUI in hifth's native shell against iOS 26 / macOS 26 conventions: use before committing Swift changes, when a build warns about a deprecated SwiftUI API, or when adding native chrome around the web view.
---

# Reviewing Swift in the shell

The shell (`native/`) is small on purpose: a web view, a route, three messages, and the
least native chrome that lets the web app feel at home. A review here checks that what is
there is modern, strict-concurrency clean, and reachable by automation — not that it does
more. Targets: iOS 17 / macOS 14 deployment, built with Xcode 26.6, Swift 6 language mode,
strict concurrency, `MainActor` default isolation for the app targets. UI test targets are
Swift 5 mode (XCUITest fights strict concurrency); the app never is.

## Short version

1. Read the three reference files next to this one, then the changed Swift files.
   `api.md` (old → new SwiftUI names, iOS 26 additions) · `swift.md` (concurrency, optionals,
   hygiene) · `accessibility.md` (identifiers, labels, what automation needs).
2. Build with the real target so warnings surface: `make app-unit-test` (Mac, seconds).
3. Report findings **by file**, each with the line, the rule, and a before/after. Skip files
   with nothing to say. End with the two or three changes worth doing first.
4. Anything that changes behaviour ships with a test in the same change: `Swift Testing` in
   `native/HifthTests/` for logic, a smoke launch in `native/HifthUITests/` for what a reader
   would see. Write it first, watch it fail.

Partial review (one file, one concern): load only the reference file that concern needs.

## What to look for, in order

1. **Deprecated API** — `api.md`. The ones this codebase can actually hit: `foregroundColor`
   → `foregroundStyle`, `.navigationBarLeading/Trailing` → `.topBarLeading/Trailing`,
   one-parameter `onChange` → two-parameter, `NavigationView` → `NavigationStack`,
   `cornerRadius` → `clipShape(.rect(cornerRadius:))`.
2. **Concurrency** — `swift.md`. `@Observable` classes that touch UI are main-actor (the
   project default does that; do not add `nonisolated` to fix a warning without reading it).
   Pure helpers (`Route`, `BundleFiles`) are `nonisolated enum`s with only static functions,
   so they can be called from a detached read and tested without a web view. WebKit delegate
   callbacks arrive on the main actor; keep them there. `Task.sleep(for:)`, never
   `nanoseconds:`. Scrutinise every `Task.detached` — the scheme handler's is justified (a
   file read) and hops back with `MainActor.run` to deliver.
3. **Optionals** — no `!` and no `try!` outside a `static let` that is a literal URL. `guard let`
   with an early return and a reason.
4. **Accessibility for automation** — `accessibility.md`. Anything a test waits on has an
   `accessibilityIdentifier` and a label with the value; hidden-by-opacity leaves the tree, so
   a 1×1 clipped frame is the pattern. Buttons carry a text label even if icon-only.
5. **Native chrome** — the Liquid Glass essentials below. Glass only on the navigation layer;
   the web content stays edge to edge.
6. **Hygiene** — one type per file, `#Preview` not `PreviewProvider`, no secrets, comments
   where the reason is not obvious (why `allowsMagnification` is off, why the label is 1×1).
   Explain in plain words; the repo's readers are not Swift people.

## Liquid Glass, for a shell that is mostly a web page

iOS 26 / macOS 26 put system bars, sheets and toolbars on Liquid Glass automatically. The
rules that matter here:

- **Glass belongs to the navigation layer, not to content.** A toolbar, a floating control,
  a share button over the page: glass. The web view is the content and never gets
  `glassEffect`. Do not stack glass on glass.
- **Content extends under bars.** The web view already ignores the safe area edge to edge
  (`.ignoresSafeArea()` plus `contentInsetAdjustmentBehavior = .never` — both, or the top inset
  applies twice). If a native bar is added, let the page run under it rather than shrinking it.
- **Use standard components first.** A `toolbar` with `ToolbarItem` placements
  (`.topBarLeading`, `.topBarTrailing`, `.confirmationAction`) and `ToolbarSpacer` to group
  gets glass for free. Reach for `glassEffect(_:in:)`, `GlassEffectContainer`,
  `buttonStyle(.glass)` / `.glassProminent` only for a custom floating control, sparingly.
- **No custom bar backgrounds.** They fight the system material and the scroll-edge effect.
  `scrollEdgeEffectStyle(_:for:)` and `backgroundExtensionEffect()` exist for native
  scrolling content; the web view scrolls its own stage, so they do not apply to it.
- These are iOS 26 / macOS 26 symbols on a 17 / 14 deployment target: wrap them in
  `if #available(iOS 26, macOS 26, *)` or accept raising the target as a decision, not a drive-by.
- The web app has no `prefers-color-scheme`; its desk colour is the `?field=dark` route
  parameter. Native chrome follows the system (or `HIFTH_APPEARANCE`), and that mismatch is
  known — do not "fix" it in Swift.

## Things that look wrong and are not

| looks like | is |
|---|---|
| a `Text` at 1 pt, 1×1, clipped | the route mirror XCUITest reads (`hifth.route`); hiding it would remove it from the tree |
| `allowsMagnification = false` on the Mac | forwards trackpad pinch to the web app as gesture events |
| `webView.scrollView.isScrollEnabled = false` | the web stage scrolls itself; the outer scroll view would fight it |
| `Task.detached` in the scheme handler | the file read off the main thread; delivery hops back |
| `exit(0)` in the model | the probe and snapshot modes are one-shot command-line tools |
| an empty `UILaunchScreen` dictionary | without it iPadOS letterboxes the app at iPhone size |
| `CODE_SIGN_IDENTITY "-"` everywhere on Mac | ad-hoc signing so Gatekeeper launches the test runner |

## Reporting

Per file: line, rule, before, after, one line of why in plain words. Then a short ranked
list. If a rule in the references is wrong for this codebase, say so and propose the fix to
the reference file rather than working around it.

NOTICE: Reworked from Paul Hudson's swiftui-pro skill (twostraws/SwiftUI-Agent-Skill,
MIT, Paul Hudson, 2026) — trimmed to API, Swift and accessibility, with the Liquid Glass
rules re-read against Apple's "Adopting Liquid Glass" and the iOS 26 SwiftUI docs.
