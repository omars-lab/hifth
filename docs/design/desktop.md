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

> **No longer true.** Loop 4b vendored all 604 pages, so every spread now has two real
> leaves. The finding is kept in the present tense it was written in — this section records
> what constrained the design, and a finding rewritten after the fact stops explaining why
> the design looks the way it does. §4 *What Loop 4b changes, and what it does not* is the
> live account, including the one prediction in it that turned out wrong.

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

**`(min-width: 1024px) and (min-height: 740px)`** — one query string, exported once from
`apps/web/src/useMediaQuery.ts` as `DESKTOP_QUERY` and repeated as a literal in
`DesktopChrome.module.css`, because a CSS custom property cannot appear inside a media query.

### The finding: the constraint is *height*, not width

This is the one thing writing the arithmetic down changed. A mus'haf leaf is **portrait** —
`viewBox="0 0 345 550"`, aspect **0.627** — so putting two of them side by side is not
primarily a question of horizontal room. Two leaves at the floor need only ~608 px of width,
a figure no laptop misses. What they need is *vertical* room, because each leaf's width is
derived from the height available to it, and the chrome above and below the stage takes a
fixed bite out of that height regardless of how wide the window is. The 1024×900 and
1440×900 rows of the table below say it in one line: 416 px of extra window, and not one
pixel more scripture.

Stated as arithmetic. The chrome above and below the stage is **252 px** — header 72 +
trail 52 + page bar 56 + the shell's own 72. That is a *measurement*, not an allowance: the
first version of this section estimated 220 px, and being 32 px light is what put the
breakpoint below where the criterion below actually requires it.

```
leaf box  =  0.627 × (viewport height − 252)
```

There is no `min()` with a half-width term any more, and that absence is the point: a leaf
is `block-size: 100%` plus `aspect-ratio: 345/550`, so the browser derives its width from
the definite height it has been given. Nothing here is estimated at runtime. The formula
above is for reasoning about the breakpoint on paper; the CSS does not contain it.

Of that box, **14 px** is furniture rather than scripture — the page host's 2×2 px border
and its 10 px `--fore-edge-stack` — so the SVG the reader actually gets is `leaf box − 14`.

### The criterion

> **A spread must never make a leaf narrower than the narrowest supported phone gives the
> single page it replaced.** A spread that shrinks the scripture to fit two pages on screen
> has traded away the only thing the reader came for.

The floor is the 320 px phone `e2e/chrome-fit.spec.ts` supports, and it is **290 px** —
measured, not `320 − 32`. (An iPhone at 390 px gives 360 px; a 320 px phone is the one the
app promises to work on, so it sets the floor.)

**Both sides of that comparison must be the SVG.** Comparing a leaf's *box* against a
phone's *page* is exactly how the first derivation came out 33 px optimistic — it charged
the phone for its furniture and let the desktop off.

Solving for the two axes:

| Axis | Requirement | Chosen |
|---|---|---|
| height | `0.627 × (H − 252) − 14 ≥ 290` ⟹ `H ≥ 737` | **740 px** |
| width | `2 × 290 + 14 + 14 = 608` | **1024 px** |

Measured at the corner and at a typical window:

| window | leaf box | scripture (the SVG) |
|---|---|---|
| 1024×740 (the corner) | ~306 px | ~**292 px** |
| 1024×900 | 407 px | 393 px |
| 1440×900 | 407 px | 393 px |
| 320×568 phone | — | **290 px** — the floor |
| 390×844 phone | — | 360 px |

At the corner a leaf gives 292 px — two above the floor, below what a 390 px phone gives,
which is the honest trade at the very edge. Width is set well above its own 608 px
requirement because that axis is nearly free and buys room for the chrome desktop *adds* in
§5; height is set only 3 px above its requirement because that axis is the scarce one and
every step up excludes real laptops.

**Height was 720 until the leaf was sized to the page it holds.** Under the old estimate the
corner gave 280 px — ten px *under* the floor this criterion exists to hold, unnoticed
because the number was derived rather than measured. The floor is now enforced by a test
rather than by arithmetic in a document: `e2e/desktop.spec.ts` measures a 320 px phone's page
and the corner's leaf in the same run and fails if the spread gives less. A future change to
the chrome's height cannot quietly break the criterion the way a change to the estimate did.

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

### How a leaf is sized in CSS — three boxes, no estimate

The first version of this expressed the cap as arithmetic in a custom property:

```css
--spread-chrome: 220px;                                    /* header + trail + bar + padding */
--leaf-cap: calc(0.627 * (100dvh - var(--spread-chrome))); /* 345/550, the Madani aspect */
```

**Both lines are gone.** `100dvh` is the *window*, so that `calc` was an estimate of how
much of the window the chrome takes — and an estimate the browser does not need, because it
has already laid the chrome out and knows the answer exactly. Three named boxes replace it:

| box | what it is | how it is sized |
|---|---|---|
| `.spread` — `data-testid="page-spread"` | **the desk**: the full width of the window, and the only thing that paints the field | `flex: 1 1 auto` in the shell column |
| `.book` — `data-testid="page-book"` | **the open book**: the two leaves and nothing else. Carries the gutter, is the fold's portal target, and clips the parked band | shrink-to-fit around its leaves |
| `.leaf` | **one page** | `block-size: 100%` + `aspect-ratio: 345/550` |

A stretched flex item has a *definite* block size, so `aspect-ratio` derives the inline size
from it. The book is then as wide as its two leaves and no wider, which is what makes the
gutter's centre and the seam between the leaves the same x — the property `desktop.spec.ts`
asserts rather than assumes.

The leaf must **not** be `flex: 1 1 0`. That floors the *content* box at zero, so padding is
added on top of a leaf's share even under `box-sizing: border-box` — which is how the two
leaves came to differ by 32 px, and how the live page came to float ~150 px from the crease
while `holdAxis` obediently centred it in a stage far wider than the page.

The stage inside a leaf is turned into a plain container by three custom properties it reads
with fallbacks, so `PageStage` itself is unchanged and the phone keeps its own behaviour:

```css
--stage-field: none;        /* the desk paints the field once; a leaf must not paint a second */
--stage-pad: 0px;           /* the desk is the room around the book, not the stage's inset */
--stage-page-cap: 100%;     /* fill the leaf — the leaf is already exactly a page */
--stage-page-max: 100%;
```

A custom property is the whole coupling: CSS modules hash their class names, so a spread
stylesheet cannot reach into a stage stylesheet, and it should not want to.

**This is also what dissolved the `holdAxis` conflict** recorded in
`docs/design/page-transition.md` §2.4. Once the stage's content box *is* the page's box,
"centred in its stage" and "flush against the spine" are the same sentence, and centring
zero slack is a no-op. No core change was needed.

## 4. The spread

### Geometry

```
.spread — the desk, full window width, paints the field once ─────────────────────
│                                                                                │
│        .book — the two leaves and nothing else, shrink-to-fit                   │
│        ┌───────────────────────────────┬┬───────────────────────────────┐       │
│        │                               ││                               │       │
│        │      RIGHT LEAF               ││      LEFT  LEAF               │       │
│        │      lower page number        ││      higher page number       │       │
│        │      = page 6                 ││      = page 7                 │       │
│        │                               ││                               │       │
│        │      (absent in this build)   ││      the live PageStage       │       │
│        │                               ││                               │       │
│        └───────────────────────────────┴┴───────────────────────────────┘       │
│                                        gutter, centred on the seam              │
└─────────────────────────────────────────────────────────────────────────────────┘
   DOM order: right leaf first. RTL flow does the rest.
   ← ArrowLeft turns forward, toward the left leaf and beyond.
```

Measured at 1440×900: the book runs x 313..1127 (814 wide), each leaf 407, the gutter's
centre at 720 — which is exactly the seam. The live SVG sits 722..1115, two pixels off the
spine, and those two pixels are the page host's border.

The fold portals into **`.book`, not `.spread`**: the desk runs the width of the window, so a
band measured against it would sweep empty field before reaching paper. `.book` also carries
the `overflow: hidden` that keeps the parked band off-screen.

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

**Since Loop 4b this is every leaf**, and what follows was written when it was none of them.
The code path existed and was real before any shipped asset could reach it. The facing
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

That bet was settled the way it was placed: 4b vendored the 601 and this branch was already
under test, so the day it became every reader's path was not the day it was first run. The
defect 4b did find on the spread was one layer down and had nothing to do with the manifest
— an even page is a *left-hand* leaf, and the stage's bound-edge inset was on the wrong side
of it (`e2e/page-turn.spec.ts`, the 7 → 8 turn). Fixture manifests test the branch you knew
to write; they cannot test the geometry you never saw drawn.

### What Loop 4b changes, and what it does not

A reader in six months needs to know which parts of this design were shaped by a temporary
gap. Precisely these:

| Shaped by the gap | What Loop 4b (task #27) changes |
|---|---|
| The absent-leaf treatment (recessed well, dashed edge, inventory caption) | Becomes rare rather than universal — it survives, because a fetch can still fail offline with an evicted cache (`PageStage`'s `status === "error"` path exists for exactly that). It stops being the thing every reader sees. |
| The inventory caption `t.pagesVendored(3, 604)` on the absent leaf | **The prediction here was wrong, and is left standing because it shows how it was reachable.** It read: *"Reads «المتوفّر ٦٠٤ من ٦٠٤», at which point it should be dropped from this surface."* It cannot. The branch that draws the caption is guarded by `available.includes(leafPage)` — the panel only exists when the *facing page is one we do not hold* — so at a complete inventory the caption has no surface to be on. The two cases the panel can still reach both have something true to say: a partially vendored edition, where the count is the point, and an eviction, where the count is what the reader is looking at. Nothing to drop. (The page bar's copy is a different question and was decided the other way — it stays at 604/604; `e2e/pagebar.spec.ts`.) |
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

**They are also the one thing in this section with a second gate** (§8 ③). Everything else here
is hidden on a phone for want of room; the hints are additionally hidden wherever
`(any-hover: none)` holds, because a landscape iPad clears the breakpoint on both axes and has
no keyboard. Room and a keyboard are two premises, and only this control needs the second.

### One page or two, in the chrome

**Mobile constraint:** the bluntest one in this section — below the breakpoint there is no
second leaf, so a switch between one page and two would be a switch between one page and one
page.

**Desktop:** a two-radio group, «واحدة» / «اثنتان», built on the language switch's markup
because it is the same shape of choice: two mutually exclusive states, each named in full to a
screen reader and abbreviated to a word for the eye. A checkbox labelled "two pages" was the
alternative and it is worse, because *checked* would have to mean both "the box is ticked" and
"the book is open" and a listener cannot tell which one it was told.

**It exists because the answer used to be derived.** Zoom past fit and the book closed itself;
zoom back and it opened. Three separate desyncs came out of that one derivation, and the reader
could not say "keep it closed" or "keep it open" at any magnification. §8 ② carries the whole
account; the control is what replaced it.

### The zoom stepper, in the chrome

**Mobile constraint:** a phone has a pinch, and a pinch is a better magnifier than any pair of
buttons — it is continuous, it is anchored where the reader is looking, and it costs no chrome.

**Desktop:** `−` · a readout · `+`, stepping a **ladder** of nine named rungs
(0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5) rather than multiplying. A ladder is what lets the readout
be believed: «١٢٥٪» is a place the reader can return to, where 1.2ⁿ is a number that happens to
be on screen. Pressing from an off-ladder level — a hop lands at 1.55, deliberately between two
rungs — takes the nearest rung *past* where you are in the direction you pressed, so one press
is always enough to get onto the ladder.

A `group` and not a `spinbutton`: the ARIA role would promise arrow-key increments over a
continuous range, and this is nine rungs and two buttons.

**Why buttons at all, on the machine with the best pointer.** Because a laptop's pinch is not
available to us: macOS encodes it as `ctrl`+wheel (§6), so the gesture everyone reaches for
either does nothing or does something violent, and a control that says what it will do before
it does it is the honest answer to that. Session state, not persisted — a preference surface is
a new axis and nobody has asked for one.

**It is disabled while the book is open**, with the toggle beside it as the way out, and the
`title` says so on both buttons. Two magnified leaves lose their edges and read as one
continuous column (§8 ②), and §3's finding is that a leaf in a spread is height-bound at
~398 px, so magnification there buys geometry it cannot use anyway. The disabled state is a
`:disabled` button rather than a hidden one on purpose: a control that vanishes teaches nothing,
and this one has something to teach.

**The readout is not a live region.** The app has exactly one polite announcer and a second in
the header would compete with it for the same reader at the same moment — a page turn and a
zoom both speak. What *landed* is announced through `useAnnouncer` at the App level, with the
level the stage says it applied rather than the one that was asked for.

### Not unlocked, and why

- **A hop-results sidebar.** The rail and popover are correct at every width; a persistent
  panel would compete with the mus'haf (§1).
- **A second column of ayah metadata.** Hifth has no reader features by design (PLAN,
  app identity). Room is not a reason to acquire them.
- **A "turn the leaf" two-page step.** Decided against at Loop 4b — §8 ①. It is a
  refusal now, not an omission and no longer a question: both pages of an opening are
  already in front of the reader, so a ±2 step would turn a leaf to reveal something they
  can already see.

## 6. Keyboard and pointer

The existing model is `appKeyAction` (core, tested) plus `@use-gesture` on the stage. The
spread changes **neither**, and that is a decision rather than an oversight.

**Keyboard.** `ArrowLeft` = +1 page, `ArrowRight` = −1 page, `/` = jumper. On a spread this
still moves *the current page*, not the spread. It is tempting to make an arrow turn the
whole leaf (±2), and it is wrong for this build: with three non-adjacent pages vendored,
`stepPage` walks the **inventory**, not the print, and ±2 over an inventory of three is a
no-op or an overshoot. The keyboard map is core's and is under test there; the spread does
not get to reinterpret it from a component.

> **The verdict stands; that argument for it does not.** Loop 4b vendored all 604, the
> inventory and the print agree, and ±2 lands on a real page from anywhere in the book — so
> the sentence above is now true of nothing. §8 ① is answered on four grounds that outlive
> the corpus, and this paragraph is kept because "±1, because we only have three pages" and
> "±1, because the app's unit is a page" are the same behaviour resting on different ground,
> and only one of them was ever going to survive a complete mus'haf.

`PageDown` = +1 and `PageUp` = −1 turn the page from **anywhere**, including from a focused
ayah, where the arrows belong to the ayah stepper and always will
(`page-turning.md` §7 ⑤). They are the right keys for it twice over: nothing else claims
them, and unlike the arrows they name no direction, so they need no RTL convention to be
read correctly. `Escape` on a focused ayah lets go of it — which is how a reader gets the
arrows back, and the only reason a keyboard-only reader is not stranded by the app's own
central gesture.

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

**The wheel**, which is the one input a desktop has and a phone does not, and which this
section did not mention until `page-turning.md` §7 ③ noticed the omission:

- **Plain wheel turns the page** — down forward, up back, discrete, one turn per gesture.
  Not scroll-snap and not a continuous scroll: this app's unit is a page, and §2.2's finding
  is that a mus'haf reader wants the page boundary preserved, not smoothed over. A `wheel`
  event does not say what produced it, so the separator is time: events arriving inside 100 ms
  of each other are one gesture (a trackpad flick and its momentum tail stream at ~16 ms),
  and 40 px of accumulated travel commits the turn. A mouse notch is 100–120 px and is
  therefore one turn, once. The classification is `packages/core/src/gestures.ts` and is unit
  tested there, beside the pointer splitter it rhymes with.
- **`shift`+wheel jumps a juz** — to the nearest juz *opening page* strictly past the current
  one in the direction of travel, which is the same question a plain wheel asks about pages
  and is therefore the same state machine (`nextWheelTurn`, one implementation, its own rest
  state per axis). Asked in pages rather than in juz numbers on purpose: it disposes of the
  straddling leaf, of a juz with no vendored opening, and of "back from the middle of a juz",
  all of which juz arithmetic would have to special-case. The reader asked for this on `ctrl`;
  see the bullet below for why it could not have it.
- **`ctrl`/`⌘`+wheel does nothing at all.** It used to zoom, `z' = z · 1.2^(−Δy/100)`. It is
  now swallowed — `preventDefault`, no action — and the swallowing is the deliberate part:
  letting it through hands the reader the *browser's* page zoom, which changes CSS px and
  bounces the desktop breakpoint, and "I don't want zoom driven by scrolling" covers that too.
  It cannot carry the juz jump either, for the reason the old bullet gave as a virtue: **a
  macOS trackpad pinch is a synthesised `ctrl`+wheel**, indistinguishable from a real one, so
  binding anything to it means every two-finger pinch on a laptop does that thing. Magnifying
  was a defensible guess at what a pinch means; teleporting twenty pages is not.
- **Only `deltaY` is bound, with one stated exception.** A two-finger horizontal swipe is the
  browser's back/forward gesture on macOS, and taking it would be taking navigation away from
  the reader to do something navigation already does. The exception is the `shift` branch,
  which reads `deltaY || deltaX`: several browsers deliver a *shifted* wheel as `deltaX`, so a
  branch reading only `deltaY` there would be dead on those engines rather than polite.
- **An open sheet keeps its own scroll** — the stage's listener returns before
  `preventDefault` when a dialog is up, matching `keymap.ts` rule 3.

The wheel rows live in `e2e/desktop.spec.ts` and not in the phone specs for a mechanical
reason worth writing down: mobile WebKit cannot be sent a wheel event at all, so a wheel
assertion in a shared spec would be a test that silently never runs on two of three projects.

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

## 8. Open questions, and what would answer each

Named, so they are not mistaken for settled. Every design doc in this repo ends under this
heading, and every item is an `### ⓝ … · **status**` row so `pnpm gate:issues` can read it.
The vocabulary is defined once in [`docs/issues.json`](../issues.json).

### ① Should an arrow key turn the leaf (±2) rather than the page (±1) at desktop? · **answered**

§6 says no for this build because `stepPage` walks a three-page inventory. After Loop 4b the
question is live and the answer is not obvious: a hafiz turning a physical mus'haf turns
a leaf, but the app's page number, URL and announcements are all per-page. Revisit with
4b; whatever is decided belongs in `appKeyAction`, in core, with the reasoning.

**Loop 4b landed, so this is no longer blocked — it is unanswered.** `stepPage` now walks a
604-page inventory, ±1 and ±2 both land somewhere real, and the question is exactly the one
stated above with nothing standing in front of it.

**Answered: ±1. The arrow turns a page, and it turns a page at every width.** The behaviour
does not change, and the *reason* it does not change has changed completely — which is why
this was worth answering rather than leaving to expire. §6's argument was arithmetic about
scarcity (±2 over an inventory of three is a no-op or an overshoot) and Loop 4b deleted it.
Four arguments survive it, and none of them is about how many pages are vendored:

1. **±2 would announce a correction on every press.** `stepPage` names the landing out loud
   whenever it is not the page next door (`page-turning.md` §7 ④, `t.nearestPageN`) — the
   rule that exists so a reader who lands somewhere they did not ask for hears about it.
   A ±2 step is never the page next door, so either the live region speaks a correction on
   every single turn — the noise §7 ⑤ warns is how a reader learns to stop listening — or
   the honesty rule acquires an exception for the commonest case in the app. An honesty rule
   with an exception for the common case is not one.
2. **±2 puts half the print out of the keyboard's reach.** The page number is what the URL
   carries, what the announcer says, what the page chip shows and what the revision record
   counts. Under ±2 a reader who starts on page 7 can make 9, 11, 13… current and never 8,
   without leaving the arrows for the jumper — and the reader being asked to leave the
   arrows is the one with the fewest ways back to them.
3. **The keyboard would stop meaning what the wheel and the finger mean.** A keyed turn, a
   wheel turn and a dragged fold all end in one `stepPage` so they cannot drift (`App.tsx`,
   `PageStage.tsx`). ±2 on the arrows alone makes one input move twice as far as the other
   two on the same device; ±2 on all three contradicts the fold, which draws **one** leaf
   turning (decision row 14, `page-transition.md` §3.4).
4. **`appKeyAction` would have to learn how wide the window is.** It is L1 and `KeyContext`
   holds nothing about layout, deliberately. A ±2-at-desktop rule means a field describing
   the viewport, and a key that moves a different distance after a window resize — the
   reader's keyboard changing under them because they dragged a corner.

**What made ±2 look attractive was a different defect, and it was already fixed.** The pull
was that half the presses on a spread appear to move nothing: 7 → 8 stays inside one opening,
so the paper does not turn. Loop 4b's crease rule settles that from the other direction —
both leaves of the opening are *already open in front of the reader*, so there is nothing to
turn, and `PageStage` suppresses the band rather than sweeping a fold across a book where
nothing changed (`PageStage.tsx:855`, §3.5). Under ±2 the app would turn a leaf in order to
show a page the reader could already see, which is the one thing a physical mus'haf never
does. The header's page chip and the announcer carry the move; the paper is right to sit
still.

**Closed by** `apps/web/e2e/desktop.spec.ts` — *"still turns pages with the arrow keys the
header advertises"* presses ArrowLeft on page 7 and requires the header to read **8**. Under
±2 it reads 9 and the row fails. Its neighbour, *"a turn inside one opening draws no band"*,
holds the other half: the step commits and no fold is swept for it. Both rows exist already;
naming them here is the point of a `closedBy` — a decision whose only evidence is prose is a
decision that gets quietly reversed.

### ② Should the two leaves pan and zoom together? · **fixed**

Unanswerable and untestable until a facing pair is vendored. A shared `View` across two
`PageStage`s is a real change to a component whose correctness argument is "one write path"; do
not start it speculatively.

**Loop 4b vendored every facing pair, so the condition in the first sentence is met.** Two
real leaves is what makes panning one and not the other either right or visibly wrong. The
warning in the second sentence is unaffected and still the reason to answer it deliberately.

**Answered: neither. Above default zoom the book closes to the one leaf being read.** The
question offers two ways for two leaves to behave under a zoom, and the answer is that above
fit there are not two leaves. The reader's own words, and they reframe the question rather
than pick from it:

> why should we zoom into the next page when we are zooming into one page? we should be
> zooming into a single page / only it should be in view when we break default zoom

A spread is an offer of *more of the book at once*. Zooming is the reader declining that
offer in favour of one page, and a facing leaf that stays open beside a page under
magnification is answering a question nobody asked.

**Panning was already answered and nobody had noticed.** `holdAxis` centres any axis that
already fits, so at z ≤ 1 a pan is a measured no-op on both leaves — there is nothing to
drag. The whole of ② was only ever about zoom.

**What the running app was actually doing, before this.** Three things, all reproducible at
1440×900 from a clean checkout, and none of them found by reading the source:

1. **A cold-opened ayah link landed the two leaves at different scales.** `#/hafs-kfqc/2:48`
   puts the live leaf at `DEFAULT_HOP_ZOOM` (1.55) and leaves the facing leaf at 1.0, with no
   gesture involved. The selection band ran to the edge of the page and the gutter cut it in
   half.
2. **Hover silently decided which page moved.** `ctrl`+wheel over the *facing* leaf zoomed
   the facing leaf. Decision row 15 says hover is never load-bearing on this surface, and
   here it was choosing the subject of the gesture.
Closing the book answers both outright: at 1.55 there is one leaf, so there is no second scale
to mismatch and no second leaf for a pointer to land on.

**A third finding was claimed here and it was wrong, so it is recorded as wrong.** From the
screenshots it looked as though any zoom pushed the fore-edge stack outside the stage's clip,
which would have cost a magnified leaf the paper vocabulary §4 gives it. Measured, it does
not: `.host[data-leaf]::after` is a child of the transformed element, so it scales with the
page and travels with it, and at 2.07× on a 1440×900 desk the whole host — fore-edge included
— sits inside the book's box (`298…1141` against `0…1440`). What it does do is *thicken*: 10
layout px drawn at the page's scale is ~21 px at 2×. That is the same thing the leaf's border
does, and `PageStage.module.css` argues for it deliberately. No issue filed.

**Why not the shared `View`.** It was rendered rather than argued about — the live host's
transform copied onto the facing host, which is what one `{x,y,z}` across two stages paints.
The two pages lose their edges and read as one continuous column, which they are not: an
opening is two sheets with a binding between them, and 8 does not continue 7 across the
gutter the way two halves of a broadsheet continue each other. It would also force the zoom
anchor off the pointer — undoing §7 ⑨, which exists because zoom that drifts away from what
you aimed at is the defect readers report — and it is exactly the change to the one-write-path
argument the original warning above says not to make speculatively.

**The size argument that looked decisive and was wrong.** The first case made for closing the
book was that the live leaf would get the whole desk to be read at. It does not. `.leaf` is
height-bound — `aspect-ratio: 345/550` on a full-height box, §3's finding — so at 1440×900 it
is ~398 px of page whether one leaf is on the desk or two. Collapsing the spread buys **zero**
reading size, and a single desktop stage is capped by `--stage-page-max`'s 480 px measure in
any case. That measurement is recorded here beside the decision it failed to support: the
decision rests on the reader's argument, not on this one.

**The gain that does survive is the viewport, not the page.** In solo the *leaf box* drops its
aspect ratio and takes the whole book while the *page* stays height-bound, so a page at 1.55×
(617 px wide) is seen whole instead of through a 398 px slot. That is the phone's geometry
exactly — stage is the window, page is height-bound inside it — which is the point: above fit
a desktop stops being a desktop and becomes a reader.

**How it is built, and the two things that were nearly wrong.**

- `PageStage` gained one prop, `onFitChange(atFit)`, fired from `applyTransform` — the single
  place every view change passes through, so a wheel, a pinch, a hop's tween and a page turn's
  reset all report the same way. On the **flip**, not the frame: `view` is a ref precisely so
  a pan does not re-render a 170 KB inline SVG's parent, and a callback carrying `z` would
  hand that ref straight back to React sixty times a second.
- The threshold is `z ≤ 1 + 1e-3`, not `z > 1`. Every landing is a RAF tween and its last
  frames arrive at 1.0000003; a bare `>` would leave the book shut on a reader who was done.
- `solo` on `PageSpread` is **style, not mount** — the opposite of `enabled`, deliberately.
  `enabled` decides whether a second 170 KB SVG is ever fetched on this device (§2 ④, decision
  row 8); this decides whether it is looked at right now, and a reader zooming in and back out
  must not pay a fetch, a parse and a `Highlighter` rebuild each way. The facing leaf stays
  mounted at zero width, `visibility: hidden`, and `aria-hidden` — hidden from the reading
  order in step with the eye.
- The page stays height-bound in a box that is no longer page-shaped by turning `.book` into a
  size container and handing down `--stage-page-cap: 62.7273cqh` (345/550 of the book's own
  height). `.host` consumes it the same way it does on a phone, so the two stylesheets still
  touch only through custom properties.
- `PageStage` also gained a `ResizeObserver` on its layer. Everything else re-measures at the
  *start* of a gesture, which was correct while only the window could change a leaf's box. It
  stopped being correct here: the leaf widens *because of* a zoom, so the frame after the flip
  would clamp against the box it had just stopped having. A window resize was silently in the
  same position before, one gesture behind the truth.

**Closed by** `apps/web/e2e/desktop.spec.ts` — *"a zoom past fit leaves one leaf on the desk,
and a zoom back reopens"* (both directions of the flip, the facing leaf's `aria-hidden`, the
live leaf taking the book's width, and the page **not** stretching to the desk) and *"a hop
link opens on the leaf it landed in"* (finding 1, with no gesture in it).
`PageSpread.test.tsx` holds the half jsdom can see: the reading order, and that the facing
leaf is still mounted.

**Superseded in the mechanism, upheld in the answer — "The wheel navigates, buttons magnify".**
The paragraphs above stand as the record of what was decided and why; what follows is what
replaced *how*. The answer they argue for is unchanged and is now stated rather than derived:
**one magnified page, never two.** What is gone is `onFitChange`, `atFitRef` and the threshold —
the whole derivation of page mode from zoom.

It had to go because the derivation leaked three ways, all reproducible at 1440×900:

1. **The facing leaf zoomed on its own.** `ctrl`+wheel over it took it to 1.549 while the live
   leaf sat at 0.8 and the book stayed open. Finding 2 above named this and treated it as
   *answered by* closing the book; it was not. The facing leaf mounts a complete `PageStage`
   with its own wheel listener, so it could always reach a scale of its own — and the comment
   at the facing stage's props saying it "never receives a hop or a gesture that could change
   its own scale" was simply untrue, which is why nobody looked.
2. **The mode survived a breakpoint crossing and the zoom did not.** Zoom at 1440, resize to
   800 (the live stage unmounts and its `view` ref goes with it), resize back: `data-solo="true"`
   over a leaf at `scale(1)` — a book closed with nothing to explain it, and no gesture that
   undoes it except zooming in and back out.
3. **Zooming *out* counted as being at fit.** `MIN_ZOOM` is 0.8 and the threshold was
   `z ≤ 1 + 1e-3`, so at 0.8 the book re-opened at a size it had never closed at: a 266 px live
   host beside a 332 px facing leaf.

One cause under all three: **page mode was derived from a gesture**, so it could disagree with
the gesture. The reader's call was to cut the derivation rather than patch its leaks —

> i don't want zoom to be driven by scrolling … id rather a button to toggle between two page
> and 1 pages mode / settings driven zoom

So the reader is asked instead. §5 gains two controls: a page-mode radiogroup and a zoom
stepper, and the stepper is **disabled while the book is open** — the toggle is the gateway to
magnification, which is the same rule as before with the arrow of causation reversed. A hop is
held to it too: with the book open a shared link frames its ayah at fit rather than at
`DEFAULT_HOP_ZOOM`, because 1.55 on the live leaf beside 1 on the facing one is finding 1
arrived at down a different path. The `ResizeObserver` in the last bullet above **stays** — its
reason was independent of the flip and is still true.

The three rows named under "Closed by" are replaced by
*"Hifth · one page or two, and how big"* in the same file, whose five rows are the same three
claims put to the controls: the toggle closes and opens the book, the stepper magnifies the one
leaf and is off while there are two (defects ① and ③), crossing the breakpoint leaves the leaves
agreeing (defect ②), and a hop link lands without magnifying half a book.

### ③ Is `min-width` the right gate for the keyboard hints? · **fixed**

§3 accepts it as a proxy. `(pointer: fine)` or `(any-hover: hover)` describes the reader more
truthfully but splits the desktop story into two media features, and a touchscreen laptop
satisfies both. Revisit if anyone reports the hints on a device that cannot use them.

**No, and it did not need a report — it needed the arithmetic.** The last sentence above was
the mistake. It set the trigger to a bug report from a reader who would have no idea the row
was wrong, when the counter-example is a device sitting on a lot of desks: **iPad Pro 11
landscape is 1194×834 and iPad gen 7 landscape is 1080×810**, so both clear the 1024×740
breakpoint *on both axes* and were being shown a legend for keys they do not have. That is the
same shape as the height derivation in §3 — a number nobody had multiplied out — and it is
worth noticing that a question phrased as "wait for a complaint" is a question that stops being
looked at.

**Closed by `apps/web/e2e/desktop.spec.ts`** — *"has the room for the desktop chrome but is not
offered a keyboard"*, a `test.use({ viewport: 1194×834, hasTouch: true })` block. `.keys` gains
`@media (any-hover: none) { display: none }` in `DesktopChrome.module.css`. Nothing else moves:
the spread, the layout and the language switch stay on `DESKTOP_QUERY` alone, because their
premise really is room.

**The worry about "splitting the desktop story" was answerable by scope.** The second feature is
not applied to the desktop story — it is applied to the one control whose premise is a physical
keyboard rather than a wide window. Room and a keyboard are two claims, and the item read them
as one. And "a touchscreen laptop satisfies both" is not a problem but the correct outcome: a
touchscreen laptop *has* a keyboard, and should keep the hints.

**`any-hover`, not `pointer: fine`, and the difference is a real device.** iPadOS keeps touch as
the *primary* pointer even with a Magic Keyboard attached, so `pointer: fine` would hide the
legend from a tablet that literally has a keyboard and a trackpad — a false negative on a common
configuration. `any-hover` asks whether *some* input here can hover, and its remaining false
positive (a hovering stylus on a keyboardless tablet) needs specific hardware. It is still a
proxy. There is no media feature for "a keyboard is attached", and the honest close for this
item is that we picked the proxy that fails in the rarer direction, not that we found the truth.

**The `keydown` alternative was considered and is worse.** "Reveal the hints the first time a key
is pressed" sounds like proof rather than proxy, and is not: an on-screen keyboard raises
`keydown` too, so a tablet reader typing into the jumper would summon a legend for keys they
still do not have — the same bug, arrived at by a longer route.

**One limit the test cannot cover, named rather than left to be discovered.** Playwright's touch
emulation *replaces* the pointer instead of adding one, so an emulated touchscreen laptop reports
`any-hover: none` exactly as the tablet does. The real device would report `hover`. The tablet row
therefore proves the legend went quiet; the 1440×900 row above it is what proves the legend still
speaks where it should.

### ④ Does the second mount actually hold the frame budget? · **blocked**

It cannot be measured today — nothing vendors a facing pair, so the second stage never mounts a
page. This inherits PLAN follow-up ① and must be re-measured on the day Loop 4b lands, on the
same phone, with the same probe. Until then this design's weight claim is an argument, not a
measurement, and it is written down as such.

### ⑤ Where does the revision map sit at desktop? · **fixed**

It is being wired into the chrome as `styles.pageId` becomes a button. A wide window is the
natural home for a 604-page heatmap and this design deliberately does not reach into it.
Whoever lands both should add the row to `desktop-vs-mobile.md`.

Both landed — `App.tsx`'s `styles.pageId` is a `<button aria-haspopup="dialog">` and the map
is rendered beside it — and the answer to "where does it sit" turned out to be **nowhere in
particular, because nobody wrote the rule**. Every other sheet in the app carries exactly one
`@media (min-width: 900px)` block that turns the phone's full-bleed bottom sheet into a
420–440px card: `Colophon`, `EditionPicker`, `HighlightMenu`, `HopPopover`, `Jumper`,
`RootLens`, `SkinToggle`. `RevisionMap` shipped after that convention was set and carried
none. On a 1440px window it was still a full-width strip pinned to the bottom edge.

**The convention could not be copied, and that is the whole substance of this item.** The
other seven hold a column of controls, which is unreadable at 1440px and correctly narrowed.
This one holds a picture of the whole book, and narrowing it to 420px would have been the same
mistake pointed the other way. So the wide-window rule for this sheet differs in kind, and the
card is the *less* interesting half of it.

**What actually broke was the grid, and it was measured rather than guessed.** `.grid` is
`repeat(auto-fill, minmax(min(var(--cell), 12vw), 1fr))`, so it lays down as many tracks as it
is given room for — and at the coarse scopes there are not many cells to lay. Counted off the
cells' own bounding boxes on the shipped build:

| scope | cells | rows at 1440px | rows at 1024px | rows at 390px |
|---|---|---|---|---|
| page | 604 | 8 | 11 | 31 |
| hizb | 60 | **2** | 2 | 5 |
| juz | 30 | **1** | 2 | 4 |

Thirty juz across a desktop window is a *single line of squares*. That is not a map: it says
nothing about where in the book you are, which is the only thing a hafiz opens this sheet to
see. The bug was invisible on a phone because the phone's narrowness was doing the work.

That is the general shape of the answer, and it is worth stating past this one sheet: **on a
phone the window decides the layout; on a wide window nothing does, so the component has to.**
`auto-fill` is not a layout, it is a deferral — fine while something else is binding, empty
once nothing is. Any component that reaches desktop by relaxing a constraint should be asked
what decides its shape when the constraint is gone.

Here that means a named column count per scope, near √N so the picture stays about as tall as
it is wide: **6×5 juz, 8×8 hizb, 25×25 page**, at fixed cell sizes rather than `1fr` — `1fr`
at juz scope would inflate the cells into 100px slabs — centred inside a card that holds one
620px width across all three scopes, so switching scope redraws the map without moving the
sheet out from under the cursor.

Closed by `apps/web/e2e/desktop.spec.ts` ("stays a map instead of stretching into a strip"),
which asserts both halves: the card is bounded and centred and does not resize with the scope,
and the grid's row count — read from the laid-out cells, not from the CSS — stays above the
strip at juz and hizb and below a too-deep stack at page scope. Verified by inducing the
regression in halves: with the card rule kept and only the grid rules removed, the juz row
assertion fails on its own.

The row this item owed `desktop-vs-mobile.md` is now there.

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
