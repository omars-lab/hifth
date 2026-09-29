# API: old names → new names, and the iOS 26 additions

Read by the `swift-shell-review` skill. Targets iOS 26 / macOS 26 conventions on an iOS 17 /
macOS 14 deployment target; where a symbol is 26-only that is said.

## Deprecated → modern (all available on our deployment target unless marked)

| deprecated | use instead | note |
|---|---|---|
| `foregroundColor(_:)` | `foregroundStyle(_:)` | also takes hierarchical styles (`.secondary`) |
| `cornerRadius(_:)` | `clipShape(.rect(cornerRadius:))` | `RoundedRectangle` is `.continuous` by default |
| `.navigationBarLeading` / `.navigationBarTrailing` | `.topBarLeading` / `.topBarTrailing` | placements for `ToolbarItem` |
| `onChange(of:) { newValue in }` (one parameter) | `onChange(of:) { old, new in }` or the zero-parameter form | |
| `NavigationView` | `NavigationStack` (or `NavigationSplitView`) | `navigationDestination(for:)`, never mixed with `NavigationLink(destination:)` in one stack |
| `tabItem(_:)` | the `Tab` API inside `TabView` | selection bound to an enum, not an `Int` or `String` |
| `overlay(_:alignment:)` | `overlay(alignment:content:)` | |
| `ScrollView(showsIndicators: false)` | `.scrollIndicators(.hidden)` | |
| `Text("a") + Text("b")` | one `Text` with interpolation | |
| `UIImpactFeedbackGenerator` | `sensoryFeedback(_:trigger:)` | |
| hand-written `EnvironmentKey` | `@Entry` on an `EnvironmentValues` extension | |
| `GeometryReader` for sizing | `containerRelativeFrame(_:)`, `visualEffect`, or a `Layout` | `GeometryReader` only when a real geometry read is needed |
| `ForEach(Array(items.enumerated()), id: \.offset)` | `ForEach(items.enumerated(), id: \.element.id)` | |
| `Image("assetName")` | generated symbol: `Image(.assetName)` | asset catalog symbols |
| `PreviewProvider` | `#Preview { … }` | |
| `ObservableObject` + `@Published` | `@Observable` | `ObservableObject` now needs `import Combine` explicitly |
| `fontWeight(.bold)` | `bold()` | and go easy on weights generally |
| `UIColor` in SwiftUI code | `Color` | |
| `UIScreen.main.bounds` | `containerRelativeFrame`, `visualEffect`, or the view's own frame | |
| `UIGraphicsImageRenderer` for a view | `ImageRenderer` | `takeSnapshot` on the web view is the exception; it is WebKit's |
| hand-wrapped `WKWebView` in a representable | `WebView` / `WebPage` | **iOS 26+ only**; a backlog item here, not a review finding |

## Toolbars and chrome (iOS 26 / macOS 26)

- `ToolbarItem(placement: .topBarLeading)` / `.topBarTrailing` / `.confirmationAction` /
  `.cancellationAction` / `.principal`. On macOS `.primaryAction` and `.navigation` still apply.
- `ToolbarSpacer` (26+) separates groups; grouped items share one glass background. Icons
  monochrome by default. No custom bar background.
- `Button("Share", systemImage: "square.and.arrow.up", action: share)` — text plus symbol,
  `.labelStyle(.iconOnly)` only if the text must not show; the text is still read out.
- `Menu("Options", systemImage: "ellipsis.circle") { … }` over an image-only menu.

## Liquid Glass symbols (26+; wrap in `if #available(iOS 26, macOS 26, *)`)

| symbol | what it is |
|---|---|
| `glassEffect(_:in:)` | apply glass to a custom view, in a shape (`.capsule`, `.rect(cornerRadius:)`) |
| `Glass.regular`, `.interactive()`, `.tint(_:)` | the material and its variants |
| `GlassEffectContainer(spacing:) { … }` | several glass shapes that render as one and morph |
| `glassEffectID(_:in:)`, `glassEffectUnion(id:namespace:)`, `glassEffectTransition(_:)` | identity and transitions between glass shapes |
| `buttonStyle(.glass)` / `.glassProminent` | secondary / primary glass buttons |
| `scrollEdgeEffectStyle(_:for:)` | how native scroll content fades under bars |
| `backgroundExtensionEffect()` | mirror-and-blur a background under a sidebar or inspector |
| `safeAreaBar(edge:alignment:spacing:content:)` | a custom bar beside a view, in the glass layer |

Where they go (Apple, "Adopting Liquid Glass"): the topmost layer, where navigation lives;
sparingly on custom controls; never crowded or layered on each other; content extends under
bars. For this shell: a floating control over the page may be glass; the web view is never.

## SwiftUI on both platforms

- One `WindowGroup`; `.defaultSize(width:height:)` and `.windowResizability` are macOS-only,
  so they sit inside `#if os(macOS)` as they do in `HifthApp.swift`.
- `UIViewRepresentable` on iOS, `NSViewRepresentable` on macOS, same model behind both
  (`WebHost.swift`). Make the view in `make…`, return the model's one instance, do nothing in
  `update…`.
- `import SwiftUI` already gives `UIImage`/`NSImage`; import `UIKit`/`AppKit` only for what
  SwiftUI does not re-export (`UIActivityViewController`, `NSSharingServicePicker`,
  `NSWorkspace`, `NSAppearance`).

NOTICE: Reworked from swiftui-pro `references/api.md` (MIT, Paul Hudson, 2026); iOS 26
symbols checked against developer.apple.com.
