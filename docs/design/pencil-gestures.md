# Can a reader switch Hifth's tools from the Apple Pencil itself?

Research note, 2026-10-05, written with its sister study, [the Notes-style tool bar note](notes-style-toolbar.md). Answers the question: *can a reader using an Apple Pencil on an iPad switch the app's tools from the pencil, and can we put our own tools in the pencil's own menu?*

## The short version

**In plain Safari, or the app saved to the home screen: no.** A web page is never told when the reader double-taps or squeezes the pencil. Apple offers no way for a page to hear it, and WebKit, the engine behind Safari, has no code that passes it on. What a page *can* see is the pencil touching the glass: how hard it presses, how it is tilted, and, on the newer iPads, where the tip is hovering just above the screen.

**In the native app wrapped around the web page: yes.**
- Double-tap works on the 2nd generation pencil and the Pencil Pro.
- Squeeze works on the Pencil Pro only.

The wrapper hears each gesture from the system and hands it to the page with a few lines of code. The page then switches the tool.

**There is no shared "pencil menu" we can add our tools to.** The palette that pops up when you squeeze in Apple Notes is Apple's drawing-tools picker. Since iOS 18 an app can add its own entries to that picker. But it is made for pens, and it expects the app to be a drawing surface. That is a poor fit for Bookmark, Jump or Crop.

**Recommendation.** Build option B below:
- the native wrapper catches double-tap and squeeze;
- it passes them to the page;
- the page draws its own small palette of Hifth's tools right next to the pencil tip.

Respect what the reader picked in the iPad's pencil settings. Where a setting has no match in Hifth, map it to the nearest one: Hifth has no eraser, so "switch to eraser" becomes "swap back to the last tool". Keep the tool bar and the keyboard letters as the way in for everyone else.

**What it changes for a hafiz:** a reader marking mistakes with the pencil while revising stops reaching up to the tool bar. A double-tap flips between Mistake and the last tool they used, so the hand never leaves the page. With a Pencil Pro, a squeeze opens all ten tools under the tip.

### What each pencil can do

| Pencil | Pressure and tilt reach the page | Hover reaches the page | Double-tap | Squeeze | Barrel roll |
|---|---|---|---|---|---|
| 1st generation | yes (web and wrapper) | no | no | no | no |
| USB-C | tilt yes, **no pressure** | yes, on M2-and-later iPad Pro and Air | no | no | no |
| 2nd generation | yes | yes, on M2 iPad Pro only | **wrapper only** | no | no |
| Pencil Pro | yes | yes (all its iPads) | **wrapper only** | **wrapper only** | wrapper only. Hidden from web pages by default. |

"Wrapper only" means the native app can hear it and a web page cannot.

## Words used here

- **Double-tap**: two quick taps with a finger on the flat side of the pencil (2nd generation and Pro).
- **Squeeze**: pinching the pencil's barrel (Pro only). It works only while the pencil is *not* touching the screen.
- **Hover**: the iPad sees the tip when it is about a centimetre above the glass, before it touches.
- **Barrel roll**: turning the pencil in your fingers (Pro only).
- **The wrapper**, or native shell: the planned iPad and Mac app that shows the Hifth web page inside Apple's web view. Apple calls that web view `WKWebView`.
- **The pencil settings**: in the iPad's Settings, under Apple Pencil, the reader picks what double-tap and squeeze do. The choices are Switch between current tool and eraser, Switch between current and last used tool, Show colour palette, Show ink attributes, Show tool palette, Run shortcut, and Off. Undo also shows up in some lists (snippet only, see sources).

---

## What does "the Apple Pencil 2 menu" most likely mean?

There are two likely meanings.

1. **The double-tap action on the 2nd generation pencil.** Its default is "switch between the current tool and the eraser", and the reader can change it in Settings. It is not a menu. It is one switch, and each app decides what it does with it.
2. **The tool palette that appears at the tip when you squeeze a Pencil Pro**, as in Apple Notes. It is easy to call this "the pencil menu", but it belongs to the app, not to the pencil. In Notes it is Apple's drawing-tools picker (PencilKit's `PKToolPicker`). Procreate, GoodNotes and Notability each draw their own.

So "put our tools in the pencil's menu" comes down to one of two things:
- (a) hear double-tap and squeeze, then show *our* palette; or
- (b) put Hifth's tools into Apple's drawing-tools picker.

Both are covered below. A third, smaller route: the reader can set squeeze to "Run shortcut" and pick one of our App Shortcuts (option D).

## What can a plain web page see from the pencil?

**It can see contact.** The pointer events a page already listens to report `pointerType === "pen"` when the pencil touches. They have done so since Safari 13 (MDN compat data, fetched). With them come:
- `pressure` (0 to 1);
- `tiltX` and `tiltY`;
- `altitudeAngle` and `azimuthAngle`, the tilt again given as two angles, since Safari 18.2;
- `getCoalescedEvents` and `getPredictedEvents`, for smooth fast strokes, also since Safari 18.2.

The older touch events also say `touchType === "stylus"`, with `force` and angles, since iOS 10.

**It can see hover, where the iPad supports it.** Safari 16.1 added pencil hover. Hover reaches the page as ordinary `pointermove` and `pointerover` events with `pointerType === "pen"` and `buttons === 0`. I read this in WebKit's source: a hover recogniser limited to the pencil, in the mouse-interaction file. A public bug report agrees (Openlayers issue 16225, fetched). In it, hover events share one pointer id, a touch on the glass gets a new one, and `pointerout` fires when the pencil leaves the hover range.

What hover does **not** carry:
- how high the tip is above the glass;
- the tilt while hovering;
- any pressure.

All the page gets is *where* the tip is.

**It cannot see barrel roll by default.** WebKit can report the roll as the `twist` value. But the setting that allows it (`ExposeRollAngleAsTwistEnabled`) is marked unstable and is off by default in WebKit's own preferences file, which I fetched. A page should assume `twist` is 0.

**It cannot see double-tap or squeeze at all.**
- No web standard covers them.
- WebKit's iPad code that turns system input into page events has no handler for the pencil's tap or squeeze. I searched the file for both and found neither.
- A developer forum question asking for this has no answer from Apple.

**One trap: Scribble.** With iPadOS's handwriting-to-text feature (Scribble) on, the system can eat pencil touches before a page sees them. A developer forum thread from 2020 (thread 662874, fetched) reports pointer-down events going missing. The workaround that worked there: listen for `touchmove` on the drawing area and call `preventDefault()`. Hifth's page areas should be checked for this with a real pencil.

**What this means for Hifth today, without the wrapper:**
- The Zoom tool's magnifier, which cannot follow a finger, *can* follow a hovering pencil.
- The palette can open where the tip last hovered.

Neither is a gesture, so the reader would still open the palette from the tool bar or a key.

## Can the native wrapper hear double-tap and squeeze while the web page fills the screen?

**Yes, very likely. It still has to be checked on a device.**

Apple's way to hear the pencil is `UIPencilInteraction`. You attach it to any view, and the system calls you back when the reader double-taps or squeezes. It is an "interaction", not a touch recogniser. It does not compete with the web view for touches, so it stays inside the shell plan's rule of "no native gesture recognisers on the web view".

What Apple's docs say, all fetched:
- `UIPencilInteraction` has existed since iOS 12.1 and is enabled by default (`isEnabled`).
- New callbacks arrived in **iOS 17.5**: `pencilInteraction(_:didReceiveTap:)` and `pencilInteraction(_:didReceiveSqueeze:)`. The old `pencilInteractionDidTap(_:)` still covers iOS 17.0 to 17.4, which matters because the shell's lowest supported version is 17.0.
- The tap and squeeze events (`UIPencilInteraction.Tap` and `.Squeeze`, iOS 17.5) carry a `hoverPose` when the pencil is held close. It says where the tip is, in the view's own coordinates, plus `zOffset`, `altitudeAngle`, `azimuthAngle` and `rollAngle`. Otherwise `hoverPose` is empty.
- A squeeze has a `phase`: began, changed, ended or cancelled. A quick single squeeze can arrive only as "ended". So act on "ended".
- The reader's own setting can be read at any time from `UIPencilInteraction.preferredTapAction` and `UIPencilInteraction.preferredSqueezeAction` (iOS 17.5). The values are `ignore`, `switchEraser`, `switchPrevious`, `showColorPalette`, `showInkAttributes`, `showContextualPalette` and `runSystemShortcut`. There is no "undo" value.
- **If the reader set squeeze to "Run shortcut", the app is never told about the squeeze.** The system runs the shortcut itself (WWDC24 session 10214, fetched).
- SwiftUI offers the same hooks: `onPencilDoubleTap(perform:)` and `onPencilSqueeze(perform:)` (iOS 17.5), and the environment values `preferredPencilDoubleTapAction` and `preferredPencilSqueezeAction`. Apple's docs warn: "If multiple views with the onPencilSqueeze view modifier are visible, all their action closures will be performed." So put it on one view only.

Evidence that it works over a web view. This rests on forum posts, not Apple's word:
- Forum thread 751880 (iPadOS 17.5, fetched): double-tap stopped working when the last thing tapped was Safari shown inside an app (`SFSafariViewController`). The poster adds that "even webkit view can work". That suggests a plain `WKWebView`, which is what Hifth uses, does not block it. Apple asked for a bug report and gave no fix.
- Forum thread 129093 (fetched): the interaction failed when the screen was shown with a custom presentation style, and worked with full screen. One poster also had to re-pair the pencil.

So attach the interaction to the web view, or to the view that holds it, and show it full screen. Then check on a real iPad that taps still arrive after the reader has tapped into the page, and after a text box inside the page has the keyboard.

### What would the Swift and JavaScript look like?

A sketch, not tested. iOS only, because the Mac app shares this source folder and has no pencil.

```swift
#if os(iOS)
import UIKit
import WebKit

final class PencilBridge: NSObject, UIPencilInteractionDelegate {
  weak var webView: WKWebView?

  func attach(to webView: WKWebView) {
    self.webView = webView
    webView.addInteraction(UIPencilInteraction(delegate: self))
  }

  // iOS 17.5 and later: double-tap, with where the tip is if it is hovering.
  @available(iOS 17.5, *)
  func pencilInteraction(_ i: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap) {
    send("doubleTap", UIPencilInteraction.preferredTapAction, tap.hoverPose?.location)
  }

  // iOS 17.5 and later: squeeze (Pencil Pro). Act once, when it ends.
  @available(iOS 17.5, *)
  func pencilInteraction(_ i: UIPencilInteraction, didReceiveSqueeze s: UIPencilInteraction.Squeeze) {
    guard s.phase == .ended else { return }
    send("squeeze", UIPencilInteraction.preferredSqueezeAction, s.hoverPose?.location)
  }

  // iOS 17.0 to 17.4: the older double-tap call, with no position.
  func pencilInteractionDidTap(_ i: UIPencilInteraction) {
    send("doubleTap", UIPencilInteraction.preferredTapAction, nil)
  }

  private func send(_ kind: String, _ pref: UIPencilPreferredAction, _ at: CGPoint?) {
    guard let webView else { return }
    var event: [String: Any] = ["kind": kind, "pref": name(of: pref)]
    if let at {
      // The point is in the web view's own space. The page is not zoomed by the
      // scroll view (pinch is off in the shell), so it matches the page's CSS
      // pixels once the scroll offset is added.
      event["x"] = at.x + webView.scrollView.contentOffset.x
      event["y"] = at.y + webView.scrollView.contentOffset.y
    }
    // Pass data as arguments, never build a script string (the shell plan's rule).
    webView.callAsyncJavaScript("window.__hifthPencil?.(e)",
                                arguments: ["e": event], in: nil, in: .page) { _ in }
  }

  private func name(of p: UIPencilPreferredAction) -> String {
    switch p {
    case .ignore: return "ignore"
    case .switchEraser: return "eraser"
    case .switchPrevious: return "previous"
    case .showColorPalette: return "colours"
    case .showInkAttributes: return "ink"
    default:
      if #available(iOS 17.5, *) {
        if p == .showContextualPalette { return "palette" }
        if p == .runSystemShortcut { return "shortcut" }
      }
      return "unknown"
    }
  }
}
#endif
```

The page side is one function the wrapper calls. It lives next to the existing bridge code, which already checks `window.__HIFTH_NATIVE__`:

```ts
// What a pencil gesture does in Hifth, decided from the reader's own setting.
// Pure, so a unit test can cover every case.
export function pencilAction(pref: string): "previous" | "palette" | "pens" | "none" {
  if (pref === "eraser" || pref === "previous") return "previous"; // no eraser in Hifth
  if (pref === "palette") return "palette";
  if (pref === "colours" || pref === "ink") return "pens";          // the highlighter pens
  return "none";                                                     // off, or unknown
}

window.__hifthPencil = (e: { kind: string; pref: string; x?: number; y?: number }) => {
  const a = pencilAction(e.pref);
  if (a === "previous") chooseTool(previousTool.current);
  else if (a === "palette") openToolPalette(e.x ?? lastHover.x, e.y ?? lastHover.y);
  else if (a === "pens") openPenPicker();
};

// Plain web, no wrapper needed: remember where the pencil hovers.
// Used by the Zoom magnifier and as the palette's fallback spot.
addEventListener("pointermove", (e) => {
  if (e.pointerType === "pen" && e.buttons === 0) lastHover = { x: e.clientX, y: e.clientY };
});
```

Hifth's tool switch already goes through one place, `chooseTool(next, lock)` in App.tsx. Tools put themselves down after one use unless locked. So "previous" means the last tool *other than* Select, or a double-tap would keep landing on Select. The app needs a small "last real tool" memory. It has none today.

### How should each of the reader's settings map onto Hifth?

| Reader's setting | What Hifth does | Why |
|---|---|---|
| Switch to eraser (the default for double-tap) | Swap with the last tool used | Hifth has no eraser. Apple's guidelines allow an app-specific mode change when the system meaning does not fit. |
| Switch to last used tool | Swap with the last tool used | Same thing, as named |
| Show colour palette / ink attributes | Open the highlighter's four pens | The nearest match to "colours" |
| Show tool palette (the default for squeeze) | Open Hifth's own palette at the tip | What the reader asked for |
| Run shortcut | Nothing. We are never told. | The system takes it |
| Off | Nothing | Respect it |

## Can we put Hifth's tools into Apple's own pencil palette?

**Yes, since iOS 18. It is a poor fit, though.** All of the following is from Apple's docs and WWDC24, fetched.

- `PKToolPicker(toolItems:)` (iOS 18) builds Apple's picker from a list of items you choose. `PKToolPickerCustomItem` (iOS 18) is your own entry in it. Its `Configuration(identifier:name:)` takes:
  - a default colour, and whether colour can be picked;
  - a default width and width choices;
  - an image (`imageProvider`);
  - an optional panel of your own (`viewControllerProvider`);
  - extra controls (`toolAttributeControls`).
- Apple's words: "your app does the rendering, and PencilKit does the tool picking". The picker can work with "your own drawing canvas". Custom items get squeeze-to-show with no extra code, and the picker positions itself at the hovering tip.
- You learn which item was picked from the observer call `toolPickerSelectedToolItemDidChange(_:)` (iOS 18).
- The picker shows only while a view you registered with `setVisible(_:forFirstResponder:)` is the "first responder", the view the keyboard and system currently treat as focused. It does not appear in the Mac build of an iPad app.

Why it fits Hifth badly:
- Each entry is drawn as a **pen**: a tip, a colour, a width. Bookmark, Jump, Crop and Read are not pens, so they would look wrong in a row of pens.
- The picker needs a native view holding focus. Hifth's Note and Text tools put focus inside the web page for typing, so the two could fight over focus. **Unverified.** It would have to be built to know.
- It adds a native layer the web page cannot style, in a demo whose look is the point.
- It works only on iOS 18 and later.

Where it *could* fit, later: the four highlighter pens are real pens, so Apple's picker could hold them, with Hifth doing the drawing. That is a separate, smaller question.

## What are the options?

| | A. Web only | **B. Wrapper hears it, page draws the palette** (recommended) | C. Wrapper plus Apple's picker | D. A shortcut on squeeze |
|---|---|---|---|---|
| **What it is** | Pencil hover drives the Zoom magnifier and places the palette. Tools are still picked from the bar or keys. | The wrapper hears double-tap and squeeze and tells the page. The page swaps tools or opens its own palette at the tip. | Hifth's tools as custom entries in Apple's drawing-tools picker | We publish App Shortcuts such as "Hifth: Mistake tool". A reader can set squeeze to one. |
| **For a hafiz** | The magnifier follows the pencil. Still a reach to the bar to switch. | Switch tools without lifting the pencil off the page: double-tap swaps, squeeze opens all ten. | Same reach-free switch, inside a pen-shaped Apple panel | One fixed tool on squeeze, for that reader only |
| **Pros** | Works today in Safari. No native code. Helps every pencil with hover. | Works on every 2nd generation and Pro pencil. Respects the reader's settings. The palette looks like Hifth and is tested like the rest of the page. | Familiar Apple look. Squeeze and placement come for free. | Very little code. Works even outside the app. |
| **Cons** | No gestures at all | Needs the wrapper. Must be checked by hand on a real iPad and pencil. A "last tool" memory to add. | Pen-shaped entries. Possible focus clash with typing. iOS 18 and later. Cannot be styled. | Device-wide setting, so it takes squeeze from every other app. Hard to explain. One tool only. |
| **What it commits us to** | Nothing new | A small bridge call (`__hifthPencil`) the web app must keep. A palette component. A row on the manual-testing checklist. | A native picker layer to maintain beside the web tool bar, and two places tools are listed | An App Shortcuts list to keep in step with the tools |

Option A is worth doing either way: hover is cheap, and both B and the magnifier need it. **B is the recommendation**, with A underneath it. C and D are not needed for the demo.

**What would change the answer:**
- If a device test shows the interaction does *not* fire over the web view, B falls back to attaching it to the view that holds the web view, and failing that, to option A alone.
- If the owner wants Hifth's pens in Apple's own palette, C becomes a pens-only add-on, not a tools menu.

## Which iPads and pencils does this work on?

From Apple's compatibility and spec pages, fetched.

- **Pencil Pro** (double-tap, squeeze, barrel roll, hover, haptics): iPad Pro M4 and M5, iPad Air M2, M3 and M4, iPad mini (A17 Pro). Squeeze needs iPadOS 17.5 or later.
- **2nd generation** (double-tap; hover only on the M2 iPad Pro, that is 11-inch 4th gen and 12.9-inch 6th gen): iPad mini 6th gen, iPad Air 4th and 5th gen, iPad Pro 12.9-inch 3rd to 6th gen, iPad Pro 11-inch 1st to 4th gen.
- **USB-C** (no pressure, no double-tap; hover on M2-and-later iPad Pro and Air, per its spec page): many current iPads. Apple's "Draw with Apple Pencil" guide leaves USB-C out of its hover list. The spec page is the firmer source.
- **1st generation** (pressure and tilt only): iPad 6th to 10th gen and A16, iPad mini 5th gen, iPad Air 3rd gen, older iPad Pro models.

**For readers with none of these gestures** (1st generation, USB-C, a finger, or plain Safari):
- the tool bar and the keyboard letters stay the way in;
- the existing double-click or long-press to lock a tool still works;
- a pencil that hovers still moves the magnifier.

Nothing about the pencil gesture is the *only* way to do anything.

## What do Apple's guidelines ask?

From the Human Interface Guidelines page on Apple Pencil and Scribble, fetched.

- Respect the reader's double-tap and squeeze settings where they make sense in your app. If they do not, it is fine to use double-tap to change mode in a way that suits the app.
- Offer custom gesture behaviour as an *option*, not switched on by default.
- Avoid using the gestures for actions that change content. Prefer actions that are easy to undo. Swapping tools and opening a palette are both harmless.
- Treat squeeze as one single action. Show what it opens near the pencil tip.
- Use barrel roll only to change the mark being made, never for moving around or for controls. Hifth has no use for it now.
- Use hover to preview what a touch will do (as the magnifier would). Do not let hover *start* an action. Showing a menu near the tip is suggested. Keep hover previews for the pencil, not for a trackpad pointer.

So Hifth's in-app setting should default to following the reader's iPad setting. It can offer one choice beyond that, such as "double-tap toggles Mistake". It should not invent a new default.

## Can we test it without an iPad in hand?

**Not the gesture itself.** The iOS Simulator has no way to send a pencil double-tap or squeeze. I searched the local Xcode 26.6 Simulator app and its support framework for "pencil" and "squeeze" and found nothing for them, only a cursor setting. Other developers say the same (secondary sources). The installed Simulator runtime is also only 17.4, below the 17.5 the new calls need.

Apple gives the tap and squeeze event types no public way to make one. So a test cannot fake the real event object either.

What can be automated:
1. **The mapping, in Swift.** Pull the setting-to-name step into a plain function and unit-test every case with Swift Testing.
2. **The page side, in vitest.** Test `pencilAction` for every setting name.
3. **The page side, in Playwright.** Call `window.__hifthPencil({kind:"squeeze", pref:"palette", x, y})` and check that the palette opens at that spot. Call it with `pref:"eraser"` and check the tool swaps back. Send a fake `pointermove` with `pointerType:"pen"` and `buttons:0` and check the magnifier follows.
4. **The Mac build still compiles,** with the pencil code fenced to iOS.

What must go on the manual-testing checklist, on a real iPad with a 2nd generation pencil and a Pencil Pro:
- double-tap under each double-tap setting;
- squeeze under tool palette, run shortcut (Hifth should do nothing) and off;
- the palette opens at the tip when hovering, and somewhere sensible when not;
- gestures still arrive after tapping into the page, after a Note or Text box has the keyboard, and after the share sheet or a sheet has been shown and closed;
- the haptic tap on squeeze feels right;
- Scribble on: pencil strokes on the page are not lost;
- a 1st generation or USB-C pencil, and a finger: nothing breaks, and the tool bar still works.

Each verdict should become a test where it can.

## What do other pencil apps do?

Only where a source exists.

- **Procreate** (handbook, fetched): double-tap and squeeze are each set in Procreate's own gesture settings. The choices include its own QuickMenu, the eyedropper and QuickShape. It shows a brush outline on hover and uses barrel roll for brushes. *It draws its own palette rather than Apple's.*
- **GoodNotes** (MacRumors, 2024-05-15, fetched): squeeze opens its own "Dynamic Ink Palette". It also uses barrel roll and a hover preview of the stroke.
- **Notability** (snippet only, from a post on X I could not open): squeeze switches to the eraser while held, and returns to the previous tool on release.
- **Apple Notes** (WWDC24 and Apple's Draw guide, fetched): squeeze shows Apple's tool picker at the tip. Barrel roll works with the highlighter and fountain pen. Double-tap switches tools in supported apps such as Notes.

The pattern among the big third-party apps is option B: hear the gesture and show **their own** palette, not Apple's.

## Where did all this come from?

"Fetched" means I opened the page and read it. "Snippet" means I only saw a search-result excerpt. Claims resting on a snippet are marked so where they are made above.

**Apple developer documentation** (all fetched, through Apple's documentation JSON at `developer.apple.com/tutorials/data/documentation/...`):
- UIKit: UIPencilInteraction; UIPencilInteraction.Tap; UIPencilInteraction.Squeeze; UIPencilInteraction.Squeeze.Phase; UIPencilHoverPose; UIPencilPreferredAction, including showContextualPalette and runSystemShortcut; UIPencilInteractionDelegate; pencilInteraction(_:didReceiveTap:); preferredTapAction; preferredSqueezeAction; isEnabled.
- Apple Pencil articles: "Handling squeezes from Apple Pencil" and "Handling double taps from Apple Pencil".
- SwiftUI: onPencilSqueeze(perform:); onPencilDoubleTap(perform:); PencilHoverPose; PencilSqueezeGesturePhase.
- PencilKit: PKToolPicker; PKToolPicker init(toolItems:); PKToolPickerCustomItem; PKToolPickerCustomItem.Configuration; PKToolPickerObserver; toolPickerSelectedToolItemDidChange(_:); setVisible(_:forFirstResponder:).

**Apple, other pages:**
- WWDC24 session 10214, "Squeeze the most out of Apple Pencil": fetched.
- Human Interface Guidelines, "Apple Pencil and Scribble": fetched.
- Apple Support 108937 (pencil compatibility), 111889 (2nd gen specs), 121318 (USB-C specs) and 120123 (Pencil Pro specs): fetched.
- iPad User Guide, "Draw with Apple Pencil" and the pencil accessibility settings page: fetched, downloaded and read as text.
- apple.com/apple-pencil: fetched.
- Apple Newsroom, October 2023, USB-C pencil: fetched.
- Apple Developer news, "Spotlight on: Apple Pencil hover": fetched.
- Developer forum threads 751880 (double-tap broken after SFSafariViewController, iPadOS 17.5), 129093 (interaction fails under a custom presentation) and 730985: fetched.
- Developer forum thread 662874 (Scribble swallowing pointer events, workaround with touchmove): fetched.

**WebKit:**
- WebKit blog, Safari 16.1 release notes (pencil hover): fetched.
- WebKit blog, Safari 26.2: fetched; nothing about the pencil.
- WebKit source on GitHub (main), all fetched and read: WKMouseInteraction.mm (pencil hover recogniser), WKTouchEventsGestureRecognizer.mm (pressure and angles, roll as twist only behind a setting), WKContentViewInteraction.h/.mm (no pencil tap or squeeze handling), and UnifiedWebPreferences.yaml (`ExposeRollAngleAsTwistEnabled`, unstable, off).
- MDN browser-compat-data for PointerEvent and Touch: fetched.

**Others:**
- Openlayers issue 16225 (pencil hover events in Safari): fetched.
- olena pull request 289 (twist claim; its author had not tested it on hardware): fetched.
- Procreate Handbook, Apple Pencil page: fetched.
- MacRumors, 2024-05-15, GoodNotes Pencil Pro update: fetched.
- Speaker Deck talk on pencil hover: fetched; nothing on the Simulator.
- Local search of the Xcode 26.6 Simulator app and SimulatorKit for pencil and squeeze: done by hand here.

**Snippet only:**
- Notability on X (squeeze holds the eraser): snippet; the page returned an error.
- The list of choices in the iPad's squeeze setting, including "Undo": snippet, from PDF Expert help and Apple Community results.
- MacRumors article on Safari 16.1 hover: snippet; the WebKit blog, fetched, covers the same claim.
- dev.to article on pencil pressure in the browser: snippet; MDN, fetched, covers it.
- A search summary claiming a WKWebView double-tap regression in 17.5: snippet, and **contradicted** by the forum thread itself, which says the web view works. Not relied on.

**What I did not look at:**
- any Apple sample code that uses `UIPencilInteraction` over a `WKWebView`;
- WebKit's bug tracker for a request to expose double-tap or squeeze to pages.

## Open questions, and what would answer each

### ① Should the native app catch the pencil's double-tap and squeeze, and open Hifth's own tools at the tip? · **open**

Option B above is recommended. It waits on the native app, which is planned and not yet built,
and on the tool bar's own shape, which [the Notes-style tool bar note](notes-style-toolbar.md)
is still settling. What would answer it: the native app running on a real iPad with a 2nd
generation pencil or a Pencil Pro, because the simulator cannot send either gesture. That
by-hand check goes on the manual testing list when the wrapper exists.
