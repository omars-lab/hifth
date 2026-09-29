# Accessibility: what automation reads, what a person hears

Read by the `swift-shell-review` skill. In this shell almost everything a reader touches is
inside the web view, and the web app carries its own accessibility (axe and the keyboard hop
tour, in the web e2e). What is native is small, and its accessibility has two customers:
XCUITest, which finds elements by identifier, and VoiceOver, which reads labels.

## Identifiers and labels for automation

- **Every element a test waits on has an `accessibilityIdentifier`**, namespaced
  `hifth.<thing>`: `hifth.route` (the current hash), `hifth.ready` (present once the page
  has said ready). A new control the smoke test will tap gets one before the test is written.
- **The value goes in the label.** `Text(model.currentHash)` alone is not enough for a
  predicate wait; `.accessibilityLabel(model.currentHash)` is what
  `NSPredicate(format: "label == %@", hash)` reads.
- **Hidden is absent.** `opacity(0)`, `hidden()` and `accessibilityHidden(true)` all remove
  the element from the tree, and the test never finds it. To keep an element readable but
  invisible: a 1×1 frame, `.clipped()`, a 1 pt font. That is why the route label looks odd.
- **`Color.clear` with an identifier** is the cheapest "this state is on" flag (`hifth.ready`).
- **Identifiers are stable names, not copy.** Never derive one from a localized string.
- Find them from the test side with `app.staticTexts["hifth.route"]`,
  `app.buttons["hifth.share"]`, `app.otherElements["hifth.ready"]`; wait with an
  expectation on a predicate, never a fixed sleep.

## Labels for a person

- **Buttons carry text**, even icon-only: `Button("Share", systemImage: "square.and.arrow.up", action: share)`,
  then `.labelStyle(.iconOnly)` if the text must not show. VoiceOver reads "Share"; a bare
  `Image` button reads the symbol name.
- **Images**: decorative → `Image(decorative:)` or `.accessibilityHidden(true)`; meaningful →
  `.accessibilityLabel("…")` in plain words.
- **Tap targets 44×44 pt minimum** for anything native and tappable. The 1×1 route label is
  not tappable and not for people; that is the one exception, and it is why it is `Text`, not
  a button.
- **`onTapGesture` is for taps that need a location or a count.** Everything else is a
  `Button`. If a gesture is unavoidable, add `.accessibilityAddTraits(.isButton)`.
- **Menus**: `Menu("Options", systemImage: "ellipsis.circle")`, not an image-only menu.
- **Dynamic Type**: system text styles (`.body`, `.headline`); `@ScaledMetric` for a custom
  size on iOS 17–18, `.font(.body.scaled(by:))` from iOS 26. The 1 pt route label is exempt
  (not for reading).
- **Reduce Motion**: any native animation added around the web view checks
  `accessibilityReduceMotion` and falls back to opacity. (The web app's own page turn is the
  web app's business.)
- **Differentiate Without Color**: a native state shown by colour also gets a symbol or a
  stroke.

## The share sheet

`Sharing.present` is the one native surface a reader interacts with: `UIActivityViewController`
on iOS (anchored to the web view's bottom edge — an iPad popover needs an anchor or it
crashes), `NSSharingServicePicker` on macOS. The items are the text and the link. VoiceOver
handles the sheet itself; what we owe it is a sensible anchor and a title in the share text.

## What the shell does not own

- The page's own headings, roles, focus order and hop announcements: the web app, tested by
  axe and Playwright in `apps/web/e2e/`.
- The system appearance of the web desk: the web app has no `prefers-color-scheme`; the desk
  colour is the `?field=dark` route parameter. `HIFTH_APPEARANCE` and the system setting only
  reach native chrome.
- Screen-reader gesture walkthroughs on a real iPad: parked in the manual-testing checklist,
  never pushed at the owner mid-work.

## Checklist for a change to native chrome

1. Identifier on anything a test will find; label carries the value a test will compare.
2. Text on every button, symbol or not.
3. 44×44 for tappables; nothing hidden by opacity that a test still needs.
4. Reduce Motion honoured on any animation.
5. A smoke test that finds the new element by identifier — written first, watched failing.

NOTICE: Reworked from swiftui-pro `references/accessibility.md` (MIT, Paul Hudson, 2026),
narrowed to a web-hosting shell whose native surface is a label, a share sheet and toolbars.
