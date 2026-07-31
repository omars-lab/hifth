# The desktop experience: an open mus'haf, and the room to stop hiding things

> "A desktop two-page spread, like a real open mus'haf, plus the affordances a desktop
> screen has room for that a phone does not."

**Status:** design of record for the desktop breakpoint. Written before the code, kept in
step with it.

## What `docs/design/` is, and how it differs from `docs/decisions/`

`docs/decisions/loop-*.md` are **retrospective**: a loop finishes, and its record says what
the loop settled and what it cost. They are read to understand why the code is the way it
is, after the fact.

`docs/design/` is **forward-looking**: the document you consult *before* touching a
feature. It states the constraints that decide the shape, the shape they decided, and the
questions still open — so the next person does not have to re-derive the reasoning from
the diff. A design doc that has drifted from the code is a defect in the doc; keep it in
step or delete it.

The per-decision *running* table — mobile does X, desktop does Y, because Z — lives in
[`docs/decisions/desktop-vs-mobile.md`](../decisions/desktop-vs-mobile.md) and is not
duplicated here. That file is the one future work appends a row to. This one is the prose
behind it.

The closest precedent for this document's shape is
[`.claude/plans/interaction-calendar.md`](../../.claude/plans/interaction-calendar.md):
findings first, then a work order.

---

## 1. What a desktop is for here, and what it is not

Hifth is a navigation instrument for huffaz. The page is the interface; the knowledge
graph is the routing table. That does not change with the width of the screen.

**A bigger screen is not a licence to add features. It is room to stop hiding the ones
that already exist.** Every desktop affordance below is traceable to a specific mobile
constraint that forced something into a sheet, into a gesture, or out of the build
entirely — most often to `apps/web/e2e/chrome-fit.spec.ts`, which holds the header inside
320 px with **seventeen pixels** of slack. Seventeen pixels is why the colophon opens from
the wordmark instead of a sixth button, and why the language switch lives inside that
sheet. Neither of those is a good design; both are the correct answer to a phone. On a
1440 px window they are just things that are hard to find.

The test for any desktop addition is therefore: **can I name the mobile constraint that
put this out of reach?** If not, it is a new feature, and new features go through the
PLAN, not through a media query.

What a desktop is *not* for, in this app: a second column of metadata beside the page, a
persistent sidebar of hop results, a reading pane, or anything else that competes with the
mus'haf for the reader's eye. The artwork is the hero at every width (tokens.css, top
comment). The spread doubles the amount of scripture on screen; it does not surround it.

## 2. Findings that constrain the design

Four, and three of them are not guessable from outside the code.

### ① Only pages 7, 9 and 19 are vendored, and they are not adjacent

`apps/web/public/assets/pages/hafs-kfqc/` holds exactly three files. Their facing pages —
6, 8 and 18 — are all absent.

Both halves of that sentence matter. It is not merely that the corpus is thin; it is that
**there is no facing pair anywhere in this build**, so the two-page spread can never today
show two real pages. Every spread this code draws is one leaf and one hole.

That is not a reason to defer the spread, and it is emphatically not a reason to draw a
blank sheet on the empty side. This repo has already paid for that class of mistake and
has an established, better answer: `PageSlider` spans the **print** (604 pages) while its
ticks and count show the **inventory** (3), and it says out loud (`t.nearestPageN`) when a
scrub lands somewhere other than where the thumb was let go. `packages/core/src/pages.ts`
opens with the whole argument.

So: the spread's absent leaf renders as **absent** — a different treatment entirely, not a
blank sheet impersonating paper. See §4.

### ② The mus'haf reads right to left, and the spread pairing is fixed by the print

Within a spread the **lower page number sits on the right**. Spreads pair (1,2), (3,4),
(5,6)… — odd on the right — so Al-Fatiha faces the opening page of Al-Baqarah and the
604-page print divides into 302 complete openings with no orphan leaf. The next page is to
the **left** — which is exactly what `appKeyAction` already encodes (ArrowLeft = +1 page,
`packages/core/src/keymap.ts`) and what `PageSlider` already draws (the next-page button on
the left edge, `▸`/`◂` chosen because they are not `Bidi_Mirrored`).

Consequence for this build: **all three vendored pages are odd**, so all three sit on the
**left** of their spread and the hole is always on the right. Any test that asserts "the
right-hand panel carries the lower number" is, today, also asserting "the right-hand panel
is the absent one". Those are two different claims and the tests keep them separate, or
Loop 4b will land and quietly falsify one of them.

### ③ Direction is pinned, and the spread is furniture

The stage, the hop rail, the trail beads and the page bar are `dir="rtl"` in **both** UI
languages. The comment at `App.tsx:745` is the authority: they are furniture around a
mus'haf, not around a sentence. Only the chrome flips with the UI language.

The spread inherits this and is load-bearing for it in a new way. The spread is laid out
as two panels in a row inside `main[dir="rtl"]`, in DOM order **right leaf first**. The
right-to-left flow direction is what puts the lower page number on the right. This is
deliberate: the alternative — absolute positioning, or `order:`, or a `row-reverse` —
would encode the mus'haf's direction a second time in a second place, and the two would
eventually disagree. There is one direction declaration and the geometry follows from it.

### ④ Each page is a ~170 KB inline SVG, and that is the whole performance story

`7.svg` is 170 107 bytes, `19.svg` 164 279, `9.svg` 140 543. The app's open perf question
(PLAN follow-up ①) is the initial raster of *one* of these on a low-end phone. Two mounted
at once doubles the DOM, the raster, and the re-raster on zoom.

Desktop is where you can afford two. **Mobile is precisely where you cannot.** So the
second mount is gated in **JavaScript**, on `matchMedia`, not in CSS: a `display: none`
panel still fetches its SVG, still parses it, still builds a `Highlighter`, and still costs
the frame budget. Below the breakpoint the facing panel does not exist in the tree.

`pnpm gate:budget` measures shipped JS (150 KB gz budget) and is unaffected by page assets,
which are fetched at runtime — but the gate is the reason the spread adds a component and a
pure helper rather than a library.

## 3. The breakpoint, and why it sits where it does

**`(min-width: 1024px) and (min-height: 720px)`** — one query string, exported once from
`apps/web/src/useMediaQuery.ts` as `DESKTOP_QUERY` and repeated as a literal in
`App.module.css`, because a CSS custom property cannot appear inside a media query.

### The finding: the constraint is *height*, not width

This is the one thing writing the arithmetic down changed. A mus'haf leaf is **portrait** —
`viewBox="0 0 345 550"`, aspect **0.627** — so putting two of them side by side is not
primarily a question of horizontal room. Two leaves need only ~774 px of width. What they
need is *vertical* room, because each leaf's width is derived from the height available to
it, and the chrome above and below the stage takes a fixed bite out of that height
regardless of how wide the window is.

Stated as arithmetic. Call the chrome allowance `C` — header (~72 px) + trail (~52 px) +
page bar (~56 px) + the stage's own padding (~32 px) ≈ **220 px**, and deliberately
rounded *up*, because the stage is `overflow: hidden` and an over-generous estimate clips
the page while a conservative one merely leaves a gutter of air.

```
leaf width  =  min( available half-width , 0.627 × (viewport height − 220) )
```

The second term is almost always the smaller one, at every window a laptop has.

### The criterion

> **A spread must never make a leaf narrower than the narrowest supported phone gives the
> single page it replaced.** A spread that shrinks the scripture to fit two pages on screen
> has traded away the only thing the reader came for.

The floor is the 320 px phone `e2e/chrome-fit.spec.ts` supports: 320 − 32 px of stage
padding = **288 px** of page. (An iPhone 13 at 390 px gives 358 px; a 320 px phone is the
one the app promises to work on, so it sets the floor.)

Solving for the two axes:

| Axis | Requirement | Chosen |
|---|---|---|
| height | `0.627 × (H − 220) ≥ 288` ⟹ `H ≥ 679` | **720 px** |
| width | `2 × 288 + 28 (gutter) + 32 (padding) = 636` | **1024 px** |

At the breakpoint corner (1024×720) a leaf is ~**313 px** — above the 288 px floor, below
what a 390 px phone gives, which is the honest trade at the very edge. At a typical
1440×900 window a leaf is ~**426 px**, comfortably wider than any phone. Width is set well
above its own 636 px requirement because that axis is nearly free and buys room for the
chrome desktop *adds* in §5; height is set only 41 px above its requirement because that
axis is the scarce one and every step up excludes real laptops.

**What happens on either side of it.** Above: two panels, the live `PageStage` in the panel
whose number matches the current page, the facing panel beside it. Below (either axis):
exactly what ships today — one `PageStage`, no facing panel in the DOM, no extra fetch, no
behavioural change of any kind. The mobile build is not "the desktop build with things
hidden"; below the breakpoint the desktop code does not run.

**Neither axis describes the reader, only the window.** For the spread that is the right
question — it genuinely is "do two leaves fit at full size". For the keyboard affordances in
§5 the query is a *proxy* for "this reader has a keyboard", and a poor one in principle: a
touch laptop has both. It is accepted because the failure is benign in both directions (a
hint shown to someone with no keyboard is noise; a hint withheld costs discoverability of
shortcuts that still work). Recorded as an open question in §8.

### How the leaf cap is expressed in CSS

The height-derived cap is written out rather than hidden in a tuned magic number, so the
next person can see which of its terms they are changing:

```css
--spread-chrome: 220px;                                    /* header + trail + bar + padding */
--leaf-cap: calc(0.627 * (100dvh - var(--spread-chrome))); /* 345/550, the Madani aspect */
```

`PageStage.module.css` already had a heuristic of exactly this kind — `width: min(100%,
62vh)` on the page host — so the mechanism is not new; it is that heuristic made explicit
and made overridable. The host now reads `min(100%, var(--stage-page-cap, 62vh))`, and the
spread's leaf sets `--stage-page-cap`. A custom property is the whole coupling: CSS modules
hash their class names, so a spread stylesheet cannot reach into a stage stylesheet, and it
should not want to.

## 4. The spread

### Geometry

```
main[dir="rtl"]  ─────────────────────────────────────────────────────────
┌───────────────────────────────┬┬───────────────────────────────┐
│                               ││                               │
│      RIGHT LEAF               ││      LEFT  LEAF               │
│      lower page number        ││      higher page number       │
│      = page 6                 ││      = page 7                 │
│                               ││                               │
│      (absent in this build)   ││      the live PageStage       │
│                               ││                               │
└───────────────────────────────┴┴───────────────────────────────┘
                                gutter
   DOM order: right leaf first. RTL flow does the rest.
   ← ArrowLeft turns forward, toward the left leaf and beyond.
```

The pairing is pure logic and therefore lives in **core**, not in a component:
`spreadOf(page, total)` in `packages/core/src/pages.ts`, beside `nearestPage` and
`pageFraction`, which is where the print-vs-inventory seam already lives.

```
spreadOf(1,   604) → { right: 1,   left: 2   }   // Al-Fatiha faces Al-Baqarah
spreadOf(7,   604) → { right: 7,   left: 8   }
spreadOf(8,   604) → { right: 7,   left: 8   }
spreadOf(604, 604) → { right: 603, left: 604 }   // even-length book: nothing is orphaned
spreadOf(603, 603) → { right: 603, left: null }  // odd-length print: the last leaf is alone
```

`left: null` is a third state and not the same as "left is absent": nothing is missing at
the end of the book, so that panel is empty furniture rather than a hole with a caption.

### The gutter

The signature element, and the only place this design spends any boldness. The two panels
meet at a **spine**: a narrow inner shadow falling onto both facing edges, so the pair
reads as one open book rather than two cards on a shelf. It is drawn once, on the
container, not twice on the leaves — a gutter belongs to the binding.

Everything else stays quiet. The leaves carry no border, no card, no elevation; the paper
token is the background it has always been. Chanel's rule applies and one accessory was
already removed: an earlier sketch put a rosette (۞, borrowed from the colophon head) in
the absent panel, which made a hole look like a decorative page and undid the whole point.

### The absent leaf

A different treatment entirely, per finding ①:

- **Recessed, not paper.** `--paper-sunk` with the gutter shadow still falling on its
  inner edge (the book *is* open; the leaf is what is missing) and a **dashed** hairline on
  its three outer edges — the universal "this is not a thing, this is where a thing goes",
  the same vocabulary the marquee already uses for "in flight, not a result".
- **It says what it is**, in visible text, not in a tooltip and not only to a screen
  reader: the page it would be, and the inventory line the page bar already uses,
  `t.pagesVendored(3, 604)` — «المتوفّر ٣ من ٦٠٤ صفحة». One string, one fact, said the
  same way in both places it appears.
- **It names the page once.** An earlier sketch also printed the folio number at the
  bottom of the well, where a mus'haf prints one. It was cut: the sentence already says
  "page 6", and two instances of the same number in one small panel is the reader doing
  bookkeeping to confirm they agree. One accessory removed.
- **It is not interactive.** No button, no "load this page", no retry. There is nothing to
  retry; the file is not in the build. An affordance that cannot succeed is worse than no
  affordance.
- **It is announced by being read, not by being spoken.** The panel is a labelled region
  with real text in it. It is deliberately *not* pushed through `LiveAnnouncer`: the live
  region already says the page on every turn, and appending "…and the facing page is
  missing" to all 604 of those would train the reader to stop listening. A permanent
  condition belongs in the document, not in a live region.

### When the facing leaf *is* vendored

The code path exists and is real, even though no shipped asset can reach it. The facing
panel mounts a second `PageStage` — its own view, its own `Highlighter`, its own gestures —
rather than teaching the existing stage to draw two pages. `PageStage` is built around one
visible host and one imperative transform (`applyTransform` writes
`currentPageRef.current`'s host); making it bi-visible would mean two transforms, two
clamps and two `StageFit`s inside a component whose entire correctness argument is that
there is exactly one write path. Two instances is the cheaper truth.

**This is testable today despite the vendoring gap**, and it is tested: `App.test.tsx`
drives the app from a fixture manifest, so a test can declare pages 6 *and* 7 and assert
that both leaves render pages. What the shipped build lacks is data, not a code path, and
the distinction is worth holding onto — otherwise the branch rots until Loop 4b, and Loop
4b discovers it on the day it vendors 601 pages.

### What Loop 4b changes, and what it does not

A reader in six months needs to know which parts of this design were shaped by a temporary
gap. Precisely these:

| Shaped by the gap | What Loop 4b (task #27) changes |
|---|---|
| The absent-leaf treatment (recessed well, dashed edge, inventory caption) | Becomes rare rather than universal — it survives, because a fetch can still fail offline with an evicted cache (`PageStage`'s `status === "error"` path exists for exactly that). It stops being the thing every reader sees. |
| The inventory caption `t.pagesVendored(3, 604)` on the absent leaf | Reads «المتوفّر ٦٠٤ من ٦٠٤», at which point it should be dropped from this surface — the page bar keeps it. |
| "All vendored pages are odd, so the hole is always on the right" | Stops being true. Tests must already not depend on it (finding ②). |
| The facing panel never fetching anything in practice | Stops being true, and the second ~170 KB mount becomes real. §3's breakpoint arithmetic is unaffected, but the frame budget claim needs re-measuring on the day — see §8. |

Not shaped by the gap, and stable across 4b: the pairing arithmetic, the RTL DOM order, the
gutter, the breakpoint, the JS mount gate, and every affordance in §5.

## 5. The affordances desktop unlocks

Each traced to the mobile constraint that put it out of reach. The full running table is in
[`desktop-vs-mobile.md`](../decisions/desktop-vs-mobile.md).

### The language switch, in the chrome

**Mobile constraint:** `e2e/chrome-fit.spec.ts` holds the header inside 320 px with 17 px
of slack. A sixth control does not fit in 17 px, so the switch went into the colophon sheet
— documented candidly at `Colophon.tsx:113-119`, which also makes the best of it ("the
language is chosen once and then forgotten, like the mus'haf and unlike the skin").

**Desktop:** the pair of radio buttons sits in the header. Not a toggle — the same two-radio
argument `Colophon` makes applies verbatim: a single "switch to English" control is
unreadable to the half of its audience that cannot read the label it is currently wearing.
Each option is written in its own script and marked `lang`.

**It does not move.** It appears in the header *in addition to* its place in the sheet.
A control that relocates as the window resizes is a control the reader has to re-find, and
the sheet's copy already explains itself. Two doors to one setting, one of which only
exists where there is room for it.

### Keyboard shortcut hints, in the chrome

**Mobile constraint:** stronger than headroom — a phone has no keyboard, so
`appKeyAction`'s whole map (ArrowLeft/Right for pages, `/` for the jumper) is
**unreachable**. Showing hints for keys that do not exist would be worse than silence, so
the shortcuts have shipped since Loop 6a with no discovery surface at all.

**Desktop:** a quiet inline row of `kbd` chips in the header naming the three that exist.
Not a dialog, not a "?" that opens one. There are three shortcuts; a dialog to list three
shortcuts is a dialog to avoid writing three words. This also keeps the surface count
where it is — a new sheet would owe a row in `e2e/contrast.spec.ts`'s `SURFACES`
(PLAN follow-up ⑥), and that cost should buy more than three words.

The hints name the keys and their effect in the UI language, and are `aria-hidden`: a
screen-reader user navigating by keyboard does not need a visual legend read aloud between
the wordmark and the page number, and every control they name is already reachable and
labelled.

### Not unlocked, and why

- **A hop-results sidebar.** The rail and popover are correct at every width; a persistent
  panel would compete with the mus'haf (§1).
- **A second column of ayah metadata.** Hifth has no reader features by design (PLAN,
  app identity). Room is not a reason to acquire them.
- **A "turn the leaf" two-page step.** See §8; it is an open question, not an omission.

## 6. Keyboard and pointer

The existing model is `appKeyAction` (core, tested) plus `@use-gesture` on the stage. The
spread changes **neither**, and that is a decision rather than an oversight.

**Keyboard.** `ArrowLeft` = +1 page, `ArrowRight` = −1 page, `/` = jumper. On a spread this
still moves *the current page*, not the spread. It is tempting to make an arrow turn the
whole leaf (±2), and it is wrong for this build: with three non-adjacent pages vendored,
`stepPage` walks the **inventory**, not the print, and ±2 over an inventory of three is a
no-op or an overshoot. The keyboard map is core's and is under test there; the spread does
not get to reinterpret it from a component.

The panels are not focus stops. The live `PageStage` keeps its existing per-polygon
keyboard path (Loop 3), and the absent panel holds nothing focusable — there is nothing to
do to it. A `region` with a label is reachable by landmark navigation, which is the correct
weight for "here is a fact about this build".

**Pointer.** The live leaf keeps pan, pinch and marquee exactly as they are. A desktop
pointer is `pointer: fine`, which the existing gesture thresholds
(`TAP_SLOP_PX`, `LONG_PRESS_MS`) already tolerate — they are tuned for a finger, and a
mouse is strictly more precise than the thing they were tuned for. **No hover-only
affordance is added anywhere in the spread**: hover is unavailable on the acceptance
device, and a control that only exists on desktop *and* only on hover is a control nobody
finds.

When the facing leaf is vendored (Loop 4b), it mounts a second `PageStage` with its own
gesture surface. Two independently pannable leaves in one open book is a real question —
they arguably should pan together — and it is deferred honestly in §8 rather than answered
by a code path nothing can exercise.

## 7. Deliberately out of scope

- **Changing what the header's page number says.** In a spread, two pages are on screen and
  the header names one. It is tempting to make it read «6–7». It is not done: the
  `styles.pageId` element is being turned into a button by concurrent work (the revision
  map), and a merge is not the place to also redefine what it means. The facing leaf names
  itself on its own panel, which is where a reader looks anyway.
- **Making the page bar spread-aware.** It scrubs the print and lands on the inventory;
  that contract is correct at every width and re-stating a spread in it would be a second
  place for the pairing arithmetic to live.
- **A desktop golden-image baseline.** The golden project photographs one SVG element at
  390×844 and every committed baseline is that shape. A desktop baseline is a second
  platform-split image set for a layout that is about to change again at Loop 4b. The
  desktop e2e project asserts *structure* (which panel carries which number, that the
  absent one is announced) rather than pixels, which is the claim that survives 4b.
- **Dark mode, print styles, window-size persistence.** Not asked for, not implied by a
  wider window, and each would be a new axis for every surface in the app.
- **Tablet as a third tier.** One breakpoint, two behaviours. A middle tier would need its
  own answer to "does a leaf stay full size", and the answer at 768 px is no — so it is the
  phone layout, which is the correct layout for it.

## 8. Open questions

Named, so they are not mistaken for settled.

1. **Should an arrow key turn the leaf (±2) rather than the page (±1) at desktop?** §6 says
   no for this build because `stepPage` walks a three-page inventory. After Loop 4b the
   question is live and the answer is not obvious: a hafiz turning a physical mus'haf turns
   a leaf, but the app's page number, URL and announcements are all per-page. Revisit with
   4b; whatever is decided belongs in `appKeyAction`, in core, with the reasoning.
2. **Should the two leaves pan and zoom together?** Unanswerable and untestable until a
   facing pair is vendored. A shared `View` across two `PageStage`s is a real change to a
   component whose correctness argument is "one write path"; do not start it speculatively.
3. **Is `min-width` the right gate for the keyboard hints?** §3 accepts it as a proxy.
   `(pointer: fine)` or `(any-hover: hover)` describes the reader more truthfully but
   splits the desktop story into two media features, and a touchscreen laptop satisfies
   both. Revisit if anyone reports the hints on a device that cannot use them.
4. **Does the second mount actually hold the frame budget?** It cannot be measured today —
   nothing vendors a facing pair, so the second stage never mounts a page. This inherits
   PLAN follow-up ① and must be re-measured on the day Loop 4b lands, on the same phone,
   with the same probe. Until then this design's weight claim is an argument, not a
   measurement, and it is written down as such.
5. **Where does the revision map (concurrent work) sit at desktop?** It is being wired into
   the chrome as `styles.pageId` becomes a button. A wide window is the natural home for a
   604-page heatmap and this design deliberately does not reach into it. Whoever lands both
   should add the row to `desktop-vs-mobile.md`.

## 9. Work order

1. **core** — `spreadOf(page, total)` in `packages/core/src/pages.ts`, exported from
   `index.ts`, unit-tested for: odd/even pairing, the same spread from either leaf, no
   orphan in an even-length book, the last leaf of an odd-length print, and out-of-range
   input.
2. **web** — `useMediaQuery(query)` hook: `matchMedia`, subscribed, SSR/jsdom-safe (no
   `matchMedia` ⇒ `false` ⇒ the mobile layout, which is the safe default).
3. **web** — `PageSpread` component + module CSS: the two panels, the gutter, the absent
   leaf. Takes the live stage as a child so `App` keeps owning `PageStage`'s props.
4. **web** — `App.tsx`: wrap the existing `<PageStage>` in `<PageSpread>` inside `main`.
   One region, localised, so the concurrent revision-map merge stays cheap.
5. **web** — desktop chrome: the language radio pair and the keyboard hints, both behind
   the same breakpoint, both `useT()`-sourced.
6. **i18n** — new strings appended to `Strings` and to *both* `AR` and `EN`, in one
   contiguous block at the end of each (a concurrent migration owns this file's structure).
7. **tests** — core unit tests; component tests for `PageSpread` and the desktop chrome,
   including the vendored-facing-leaf branch via a fixture manifest; a `desktop` Playwright
   project (1440×900) asserting the spread above the breakpoint, its absence below, the
   lower number on the right, and the absent leaf announced rather than blank.
8. **docs** — this file, `desktop-vs-mobile.md`, `docs/map.json`, `docs/use-cases.json`
   (+ `make use-cases-doc`), and the PLAN section.
