# The wheel navigates, buttons magnify

**Status:** complete.
**Date:** 2026-08-06.
**What it is:** not a loop — a defect pass that ended in a design change, on the branch that
had been sweeping up after Loop 4b. It closes
[`desktop.md` §8 ②](../design/desktop.md) in the mechanism while upholding its answer, and
supersedes half of [`page-turning.md` §7 ③](../design/page-turning.md).
**Reported as:** *"when zooming in/out between 1 page and two page modes, zoom can get out of
sync"*, with a link to a live hop —
`#/hafs-kfqc/26:62?via=26:15`.
**Result:** `make ci` green, `make e2e` **282 passed, 15 skipped**, web **257** unit tests.

## One report, three defects

Reproduced in Chrome at 1440×900 against a local build. The report is one sentence and the
sentence is right, but "out of sync" turned out to name three separate failures that happen
to share a cause:

| | what you do | what happens |
|---|---|---|
| ① | `ctrl`+wheel over the **facing** leaf | it zooms alone to `scale(1.549)` while the live leaf sits at `0.8`, and the book stays open |
| ② | zoom in at 1440 → resize to 800 → resize back to 1440 | `data-solo="true"` over `scale(1)` — a book closed onto one leaf at fit, with no zoom left to explain it. Recovery needs a zoom in and back out |
| ③ | step the zoom **down** to the floor | the book reopens with the live host at 266 px beside a facing leaf at 332 px |

① is the one worth dwelling on, because it had a comment defending it. `App.tsx` said the
facing stage needs no `onFitChange` since it *"never receives a hop or a gesture that could
change its own scale"* — and that is false on its face: the facing leaf mounts a complete
`PageStage`, with its own wheel listener and its own pinch handler. **An untrue comment is
why nobody looked.** ③ is arithmetic: `atFit` was `z <= 1 + 1e-3` while `MIN_ZOOM` was `0.8`,
so the whole range below fit reads as "at fit". ② is a lifecycle: crossing the breakpoint
remounts the live stage and resets its view, and the mode — living in React state — survives
what the view did not.

## The decision

All three are the same thing: **`soloLeaf` was derived from zoom, and zoom lives on a
gesture.** One state with two owners does not have a fix, it has patches; ①②③ are three
patches waiting to be written and a fourth waiting to be found.

The reader's call cut the derivation instead:

> i don't want zoom to be driven by scrolling … id rather a button to toggle between two page
> and 1 pages mode / settings driven zoom

So: **the wheel navigates, buttons magnify.** Three forks fell out of it, and each was put to
the reader rather than guessed:

| fork | answer |
|---|---|
| What does `ctrl`+wheel do now? | **Nothing at all** — swallowed |
| Where does magnification live? | A **stepper in the desktop chrome**, session state |
| Does zoom still close the book? | **No.** The toggle is the only thing that decides page mode |

## Why `ctrl` could not keep the juz jump it was promised

An earlier request — *"can we make scrolling flop pages, and control scrolling flip juz"* —
had already claimed `ctrl`+wheel for a 20-page jump. It cannot have it, for a reason that has
nothing to do with this bug:

**A macOS trackpad pinch *is* a `ctrl`+wheel.** The OS synthesises the modifier and the
browser cannot tell it from a real `ctrl`+scroll. Bind juz to it and every two-finger pinch on
a laptop teleports the reader out of the surah they were reading. So the jump moved to
**`Shift`+wheel**, which nothing here had claimed.

That leaves `ctrl` bound to nothing — and *nothing* is a real choice, not a gap. Letting it
through to the browser's own page zoom would change what a CSS pixel is, which bounces the
`1024×740` breakpoint this whole feature lives above: a pinch would close the book by
un-desktopping the window. It is `preventDefault`ed and dropped. One line to reverse if that
ever reads wrong in the hand.

**What none of this costs a phone:** touch pinch is a separate path — `onPinch` via
`@use-gesture` with `pinchOnWheel: false`. Removing wheel zoom is invisible below the
breakpoint, which is the whole reason this could be a desktop-only change.

## A ladder, not a multiplier

`ZOOM_STEPS = [0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5]`, and `rung(z, ±1)` returns the nearest
rung strictly past where you are.

The wheel's old behaviour was a ratio, and a ratio is right for a wheel: a continuous input
deserves a continuous response, and `×1.2` feels the same at `0.8` as at `5`. A button is not
continuous. It is pressed a countable number of times, and each press should land somewhere
nameable — `١٠٠٪`, `١٢٥٪`, `٢٠٠٪` — rather than at `2.0736` because that is what `1.2⁴` comes
to. The rungs are spaced by roughly the same proportion the ratio had, so the *feel* is
inherited and only the landings are pinned.

`rung` takes the nearest rung **strictly past** `z` (with a `1e-3` tolerance) rather than
"the next index", because zoom does not only arrive from this control: a hop lands at
`DEFAULT_HOP_ZOOM = 1.55`, which is not on the ladder. Pressing `−` from there should go to
`1.5`, not to whatever index someone last stored.

## The stepper is disabled while the book is open

This is where §8 ②'s answer survives its mechanism. That section rendered a magnified spread
and found what it looks like: two pages under one transform lose their edges and read as one
continuous column, which an opening is not. And §3 measured a leaf as **height**-bound at
~398 px in a spread, so magnifying inside one buys no reading size at all.

Both findings still hold. What changed is that they are now expressed as an **ordering of two
controls** — the toggle is the way to magnification — instead of as a derivation that ran
behind the reader's back. The `−` and `+` buttons carry a `title` saying so
(«التكبير يحتاج صفحة واحدة — بدّل إلى صفحة واحدة أولًا») rather than being silently inert.

## Two smaller decisions, both about not having two of something

**One announcer, not two.** The readout beside the buttons is plain text. It is *not* a live
region, even though it is the thing that changes when you press. The app has exactly one
polite region (`useAnnouncer`), and a page turn and a zoom can happen a beat apart to the same
reader; two regions racing is how a screen reader ends up reading neither. The zoom
announcement goes through App like every other one. The visible readout and the spoken one
carry the same digits by design, which is why `e2e/desktop.spec.ts` scopes its assertions to
the stepper's `role="group"` rather than matching `١٢٥٪` on the page — a bare match finds both,
and *which* one is the point of each assertion.

**`setZoom` is a getter's twin, not a subscription.** The stepper asks for a level and stores
what came back; there is no per-frame zoom callback, because `view` is a ref precisely so a
pan does not re-render a 170 KB inline SVG's parent. And `setZoom` anchors at the **layer**
centre through the existing `zoomAbout` — the one implementation of §7 ⑨'s anchor arithmetic.
No second copy. This matters more than it did yesterday: `ctrl`+wheel was the second caller of
that function and the only one an e2e could drive at a phone viewport, where `--stage-pad` is
16 px and a stage-vs-layer mistake is visible. A spread zeroes that padding, so the desktop
test can no longer see that particular drift — it still catches an anchor converted against
the host, the stage or the viewport, and `zoomAbout`'s comment now says which is which.

## What the goldens caught

The first cut gated the hop's magnification on `pageMode === "two"`. Ten golden images failed:
expected 559×890, received 360×575 — a ratio of exactly `1.55`.

`pageMode` is real state at **every** width, because the reader's choice has to survive a
resize (that is defect ②, closed by construction). But it defaults to `"two"`, and below the
breakpoint nothing renders a spread — so the default described a book that was not there, and
every phone in the suite silently lost the hop's magnification. *A deep link landing at fit is
the reported defect this pass exists to remove, inflicted on the platform that never had it.*

The fix is one clause — `desktop && pageMode === "two"` — kept in a ref rather than read
through a dependency, because `stage` is memoised on `[]` on purpose and a `stage` that
changed identity with the mode would re-run the zoom-resetting effects on every toggle.

Worth stating plainly: the golden images earned their keep here. Nothing else in the suite was
looking at a phone while a desktop control was being built.

## What is not in this

- **The per-page "touch bar" strip** asked for in the same conversation. It has a hard
  blocker: its colour-coded "self-reported mistakes" need a signal that does not exist —
  `revision.ts` stores *looks* only, and its doc comment explicitly forbids quietly absorbing
  other meanings into a `RevisionEvent`. Its own design pass, not a rider on this one.
- **Persisting zoom across reloads.** A preference surface is a new axis with its own storage,
  its own migration and its own place in the colophon. Session state until someone asks.
- **Any mobile change**, and **any shared `View` across the two leaves** — §8 ② built the
  shared view and rejected it, and nothing here reopens that.

## See also

- [`desktop.md` §5, §6, §8 ②](../design/desktop.md) — the controls, the wheel's bindings, and
  the superseded derivation
- [`page-turning.md` §7 ③](../design/page-turning.md) — the calibrated `ctrl`+wheel curve, why
  the calibration was right, and why it is gone anyway
- [`desktop-vs-mobile.md`](desktop-vs-mobile.md) rows **23, 25, 26, 27**
