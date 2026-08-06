# The wheel navigates, buttons magnify

## Context

**The reported bug:** on the desktop spread, the two leaves get out of sync in zoom when
crossing between one-page and two-page modes. Reproduced in Chrome at 1440×900 against a
local build, it is **three** distinct defects, not one:

1. **The facing leaf zooms on its own.** `ctrl`+wheel over it took it to `scale(1.549)`
   while the live leaf sat at `0.8` and the book stayed open. The comment at
   `App.tsx:1189` justifying why the facing stage gets no `onFitChange` — *"the facing leaf
   … never receives a hop or a gesture that could change its own scale"* — is **false**: the
   facing leaf mounts a complete `PageStage` with its own wheel listener and its own pinch
   handler. That untrue comment is why this went unnoticed.
2. **The mode survives a breakpoint crossing; the zoom does not.** Zoom in at 1440 → resize
   to 800 (the live stage remounts, view resets to `scale(1)`) → resize back to 1440 leaves
   `data-solo="true"` with the host at `scale(1)`: a book closed onto one leaf at fit, with
   no zoom to explain it. Recovery requires zooming in and back out.
3. **Zooming *out* counts as "at fit".** `atFit = z <= 1 + 1e-3` and `MIN_ZOOM = 0.8`, so at
   `0.8` the book reopens with the live host at 266 px beside the facing leaf's 332 px.

All three are symptoms of one thing: **`soloLeaf` is derived from zoom**, and zoom lives on
a gesture. The user's call is to cut the derivation rather than patch its three leaks —

> i don't want zoom to be driven by scrolling … id rather a button to toggle between two
> page and 1 pages mode / settings driven zoom

— which also composes with the earlier request to make ctrl+scrolling flip juz.

**Outcome:** the wheel becomes navigation-only; magnification becomes an explicit control;
one-page/two-page becomes an explicit toggle with no derived state behind it.

## The three answers

| Fork | Answer |
|---|---|
| What does `ctrl`+wheel do? | **Nothing.** Swallowed (`preventDefault`, no action). Juz-flipping moves to **`Shift`+wheel** |
| Where does zoom live? | A **− / 100% / +** stepper in the desktop chrome. Session state, not persisted |
| Does zoom still auto-close the book? | **No.** The toggle is the sole source of truth for page mode |

**Why `ctrl` cannot carry the juz jump**, even though it was asked for: a macOS trackpad
pinch *is* a `ctrl`+wheel — the OS synthesises the modifier, and the browser cannot tell it
from a real `ctrl`+scroll (`PageStage.tsx:1940-1943`). Binding juz to it means every
two-finger pinch on a laptop teleports the reader ~20 pages. `Shift`+wheel is unclaimed
here and costs nothing.

**What this does not cost:** touch pinch is a separate path — `onPinch` via `@use-gesture`
with `pinchOnWheel: false` (`PageStage.tsx:1896`, `1924`). Phones and tablets are untouched
by every change below.

## Work

### A. `packages/core` — one lookup, no new arithmetic

`juzPageIndex(pages)` → 30 entries, the first page of each juz, built on the existing
`juzOf` (the repo already forbids a second membership implementation — `packs.ts:107-109`).
Computed once and memoised at the App level, so a wheel flick is an array index rather than
a 604-page scan. `nextWheelTurn` (`gestures.ts:443`) is reused **unchanged** for the juz
axis with its own `WheelTurnState` ref — the state machine is already exactly right.

### B. `PageStage.tsx` — the wheel loses zoom, the handle gains it

- **Wheel handler** (`1930-2004`): the `ctrl`/`meta` branch stops zooming and returns having
  only `preventDefault`ed. Swallowing rather than passing through to the browser's own page
  zoom is deliberate — "I don't want zoom driven by scrolling" covers browser zoom too, and
  letting it through would bounce the desktop breakpoint as CSS px change. One line to
  reverse if that reads wrong in the hand.
- **New `Shift` branch → `onJuzTurn?: (step: 1 | -1) => void`.** Hazard to handle: several
  browsers deliver `Shift`+wheel as **`deltaX`**, so this branch reads `deltaY || deltaX`.
  §6's "only `deltaY` is bound" rule keeps its reason (the horizontal swipe is the browser's
  back/forward) and gains this stated exception. Wired on **both** leaves, for the reason
  §6 already gives `onTurn`: a wheel over the facing leaf that did nothing reads as a dead
  half of the page.
- **Handle gains `setZoom(z): number`** — clamps to `MIN_ZOOM…MAX_ZOOM`, anchors at the
  stage centre through the existing `zoomAbout` (`639-653`), returns what it applied. No
  second copy of the anchor arithmetic; §7 ⑨'s fix stays the only one.
- **`onFitChange` and `atFitRef` are deleted.** The `ResizeObserver` added alongside them
  **stays** — §8 ② records an independent reason (a window resize was one gesture behind
  the truth).

### C. `App.tsx` — explicit state, one write path

- `soloLeaf` → `pageMode: "one" | "two"` (default `"two"`), `solo={desktop && pageMode === "one"}`.
- `zoom` state holds the **requested** level; the stepper calls `stageRef.current.setZoom`
  and stores what it returns. No per-frame callback — §8 ② refused one for a good reason
  (`view` is a ref precisely so a pan does not re-render a 170 KB SVG's parent).
- **Every landing resets `zoom` to 1** in the same place it calls `navigateTo`/`showPage`/
  `turnTo` — App is the sole caller of all three, so there is one place to keep in step.
  Crossing the breakpoint resets it too, which is defect ② closed by construction.
- Remove `onFitChange` from the live stage.

### D. `DesktopChrome.tsx` — two controls beside the language switch

- A **page-mode `radiogroup`** («صفحة واحدة» / «صفحتان»), mirroring the existing `langRow`
  at line 57 — same markup, same keyboard behaviour, no new pattern.
- A **zoom stepper**: `−` · readout · `+`, stepping by `1.2×` so it keeps the wheel's old
  multiplicative feel (the same proportion at 0.8× as at 5×).
- **The stepper is disabled in two-page mode**, with the toggle beside it as the way out.
  §8 ② rendered two magnified leaves and found they lose their edges and read as one
  continuous column; and §3's finding is that a leaf is height-bound at ~398 px in a spread,
  so zoom there buys nothing anyway. The toggle is the gateway to magnification.
- New strings in `messages/ar.json` + `en.json`, `.gen.ts` regenerated; `gate:i18n` already
  enforces parity.

### E. Tests and registers

- **`e2e/desktop.spec.ts`** — the "`ctrl`+wheel zooms by a step" test (`709`) and the whole
  *"the book closes above fit"* describe (`751-806`) assert behaviour that is being removed;
  they are **rewritten, not deleted**: `ctrl`+wheel now turns nothing *and* zooms nothing,
  the toggle closes and opens the book, the stepper zooms the live leaf only, `Shift`+wheel
  lands on the next juz's first page. Plus a new row for defect ②: zoom at 1440 → 800 →
  1440, and assert the two leaves agree.
- **Unit** — `juzPageIndex` in core; `PageSpread.test.tsx` unchanged in substance (`solo`
  was always a prop); `DesktopChrome.test.tsx` gains the two controls.
- **Docs** — `desktop.md` §8 ② is `fixed`, so it gets a superseding note rather than an
  edit-in-place (its *outcome* survives; its *mechanism* is replaced); §6's wheel bullets
  rewritten; §5 gains the two controls. `page-turning.md` §7 ③'s `ctrl`+wheel half is
  superseded and says so. A row in `decisions/desktop-vs-mobile.md`, a new
  `docs/decisions/` doc, `docs/issues.json` (+ `pnpm issues:doc`), `docs/use-cases.json`
  (+ `make use-cases-doc`), and `docs/map.json` **hand-edited, never generated**.

### Files

| File | Change |
|---|---|
| `packages/core/src/packs.ts` (+ test) | `juzPageIndex` |
| `apps/web/src/components/PageStage.tsx` | wheel: −zoom, +`Shift`→juz; handle `setZoom`; −`onFitChange` |
| `apps/web/src/App.tsx` | `pageMode` + `zoom` state, landings reset zoom, juz wiring |
| `apps/web/src/components/DesktopChrome.tsx` (+ css, test) | mode radiogroup + zoom stepper |
| `apps/web/src/messages/{ar,en}.json` + `.gen.ts` | the new strings |
| `apps/web/e2e/desktop.spec.ts` | four rows rewritten, one added |
| `docs/design/desktop.md`, `docs/design/page-turning.md` | §8 ② superseded, §6 and §7 ③ rewritten |
| `docs/decisions/desktop-vs-mobile.md` + a new decision doc | the row and the record |
| `docs/issues.json`, `docs/use-cases.json`, `docs/map.json` | the registers |

## Verification

1. `pnpm issues:doc` && `make use-cases-doc`, then `git add -A` && `make ci` green.
2. `make e2e` — the rewritten desktop rows.
3. **Manual, Chrome at 1440×900**, re-running the three original reproductions and asserting
   each is gone: `ctrl`+wheel over the facing leaf changes nothing; zoom → resize to 800 →
   resize back leaves both leaves agreeing; the stepper at its floor no longer flips the
   book. Then `Shift`+wheel lands on a juz boundary and announces it.
4. Commit code and docs separately.

## Not doing

- **The per-page "touch bar" strip.** Separate feature, and it has a hard blocker worth
  stating: its colour-coded "self-reported mistakes" need a signal that does not exist —
  `revision.ts` stores *looks* only, and its doc comment explicitly forbids quietly
  absorbing other meanings into a `RevisionEvent`. It needs its own design pass.
- **Persisting zoom across reloads** — a preference surface is a new axis; the stepper is
  session state until someone asks otherwise.
- **Any mobile change**, and **any shared `View` across the two leaves** (§8 ② rendered it
  and rejected it).
