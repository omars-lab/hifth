# The page transition: an edge, a fold, and the truth about what is between two leaves

> "see the page effect right and left edges and how when we slide to next page we see crease
> or gap if two adjacent pages or not"

**Status:** design of record for the **page transition effect** — the leaf's edges at rest,
the motion of a turn, and what is drawn in the space between two pages. Measurement is
complete; **nothing here is implemented.** §4 is the part this document exists for; §9 says
what it becomes in `PLAN.md` terms and what blocks it.

## How to read this, and what it is not

`docs/design/` is the document you consult *before* touching a feature
([`desktop.md`](desktop.md) says why), and this file follows its shape: what was measured,
the constraints, the shape they decided, what stays open.

This file is the **transition**. Its companion is
[`page-turning.md`](page-turning.md) — the **resting page and its geometry** — which
diagnoses why the leaf currently floats (double centring in `holdAxis` plus a clipped
`.layer`), surveys the paging/scrolling and reduced-motion literature, and specifies the
gesture ladder. That document's findings are **cited here, not restated**. Where this
document disagrees with it, it says so in as many words and gives the argument:

- **§3.4** — `page-turning.md` §4.3's `.leaf` wrapper (a per-page element carrying a
  `translateX` under the finger) is **not needed and is the wrong element to move**. The
  thing that moves in a page turn is the fold, and the fold is not an ancestor of any SVG.
- **§3.1** — the `≤16 px translateX` direction cue in `page-turning.md` §3.1 (a) is
  **withdrawn** for the same reason: it moves glyphs to say something that can be said
  beside them.
- **§8 ①** — the page curl is rejected there partly on **cost** (a 3D transform per frame
  over a rasterized 170 KB SVG, with the perf verdict open). This document rejects it on
  **honesty**, which is an argument that survives the perf verdict going our way.
- **§2.4** — `page-turning.md` §8 says "a shaded gutter darkens real scripture" and rules
  out gutter shading. `PageSpread.module.css:60-75` already ships a 28 px gutter gradient
  that falls on both leaves, and `tokens.css` defends it at length. The blanket rule is
  already contradicted by shipping code; this document narrows it rather than repeating it.

Three conventions this document inherits rather than re-decides:

- **`spreadOf` is the print's pairing** (`packages/core/src/pages.ts`, decision row 9):
  within a spread the lower page number is on the right, spreads pair (2,3), (4,5), (6,7)…,
  page 1 sits alone on the right. Everything in §4 is derived from it. §7 ① records the one
  observation that would falsify it, because the reference app disagrees.
- **The RTL page-turn direction is pinned** ([`loop-1.md`](../decisions/loop-1.md)):
  dragging the page left→right advances. §3.3 shows that the design here honours that half
  exactly and makes the other half ("the next page enters from the right") *moot* rather
  than violated — nothing enters from either side.
- **One leaf per turn on the spread** (decision row 14). Reopens at Loop 4b, not here.

Everything below is either **measured** (a number, with the source stated), **cited** (a
file, a line, a document), or **inferred** (marked as such).

---

## 1. What the reference does

Four screenshots from a third-party Qur'an application, all Al-Kahf / Juz' 15, all
**1290 × 2796 device px = 430 × 932 CSS px at DPR 3**. Every device-pixel figure below is
divided by 3 to give the CSS-px figure a stylesheet would carry. Colours are exact sampled
values, not eyedropper impressions.

| file | state |
| --- | --- |
| `IMG_0692` | page 297, at rest |
| `IMG_0693` | page 298, at rest |
| `IMG_0694` | mid-slide, the two leaves **closed to a crease** |
| `IMG_0695` | mid-slide, the two leaves **open to a gap** |

### 1.1 The palette

**Observed.** Six colours carry the whole effect.

| role | sampled RGB | hex |
| --- | --- | --- |
| paper | 250, 241, 228 | `#FAF1E4` |
| field (the surface the leaf sits on) | 175, 138, 104 | `#AF8A68` |
| fore-edge sliver, first | 233, 218, 195 | `#E9DAC3` |
| fore-edge sliver, second | 215, 198, 173 | `#D7C6AD` |
| the rule at the leaf's outer boundary | 127, 102, 77 | `#7F664D` |
| the crease's core hairline | 101, 86, 67 | `#655643` |

**Observed: there is no drop shadow anywhere.** Sampling a column straight up out of the
leaf's top edge (`x=600`, `IMG_0692`) reads pure field `(175,138,104)` at every row from
`y=150` to `y=158`, then a five-row ramp *downward* into darkness — `(157,124,94)`,
`(142,113,85)`, `(124,98,75)`, `(106,84,63)` — and then paper at `y=165`. That is a **dark
rule**, about 2 CSS px wide with its soft edge, not an elevation halo. The field is a flat
fill; there is no vignette and no gradient in it.

**Inference.** This is the whole anti-floating move and it is worth naming before any of the
geometry: **the leaf is separated from its background by its own boundary, not by a shadow
underneath it.** A shadow says *this object is above that surface*. A dark rule says *this
object ends here*. A leaf of a book is not above anything.

### 1.2 The leaf at rest, and the fore-edge

**Observed (`IMG_0692`, page 297).** The leaf runs `y = 160…2635` device (53.3…878.3 CSS),
so ~53 CSS px of field above and ~54 below — the status-bar and home-indicator bands. It is
**flush to the left screen edge**: paper is sampled at `x = 0`. On the right it stops at
`x = 1259` (419.7 CSS), and the remaining ~10 CSS px carry a stack.

Horizontal profile at `y = 1400`, device px, reading outward from the paper:

```
… 1259   paper            (250,241,228)
  1260   soft dark rule   (169,157,141) → ramping to
  1266–1271  sliver 1     (233,218,195)      band 1260–1271 = 12 dev = 4.0 CSS px
  1272   soft dark rule   (154,143,124) → ramping to
  1277–1283  sliver 2     (215,198,173)      band 1272–1283 = 12 dev = 4.0 CSS px
  1284   outer rule       (127,102,77)  → ramping to
  1289   field            (175,138,105)      band 1284–1288 =  5 dev = 1.7 CSS px
```

**Total beyond the paper: 29 device px = 9.7 CSS px.** Two visible under-leaves, each
**4.0 CSS px**, each darker than the one above it, each separated by a soft dark rule of
about 2 CSS px, and a final rule against the field.

**Observed (`IMG_0693`, page 298).** The identical stack, mirrored: field at `x = 0`, outer
rule at `x ≈ 5`, sliver 2 at `x = 6…17`, sliver 1 at `x = 18…29`, paper from `x = 30`. The
leaf is flush to the **right** screen edge. The stack is on the **left**.

**Observed: the stack exists only on the vertical free edge.** The head and tail of the leaf
carry the plain dark rule and no slivers (measured above; and columns at `x = 5` and
`x = 300` in `IMG_0692` return the identical vertical extent `160…2635`).

**Inference.** The stack is the **fore-edge** of the page block — the cut edges of the
leaves underneath the one you are reading. Drawing it only on the fore-edge and not on the
head and tail is a simplification, and it is the right one: the fore-edge is the edge a
reader's thumb is on.

### 1.3 The corner: rounded on one side, square on the other

**Observed.** Sweeping the rightmost paper pixel per row down from the top edge of
`IMG_0692` (paper top `y = 164`, paper right asymptote `x = 1259`):

| rows below the top edge | rightmost paper px |
| --- | --- |
| 2 | 1206 |
| 8 | 1228 |
| 20 | 1243 |
| 32 | 1250 |
| 56 | 1258 |

Solving `x = 1259 − R + √(R² − (R−d)²)` at `d = 8` and `d = 20` both give **R ≈ 61 device
px = 20.3 CSS px**; at `d = 56` the same fit returns 67.6, so the arc is **not** a single
circle. **Inference:** a continuous ("squircle") corner, the iOS default, rather than
`border-radius`. For our purposes the number that matters is the visual radius, **≈ 20 CSS
px**, and a plain `border-radius: 20px` is within a pixel or two of it everywhere.

**Observed.** Page 297 is rounded on the **right**; page 298 is rounded on the **left**. On
each leaf the rounded side is the side carrying the fore-edge stack, and the opposite side
is square and runs off the screen. Corner treatment therefore **encodes which half of a
spread the leaf is** — and it flips with page parity.

### 1.4 The crease (`IMG_0694`)

**Observed.** Both leaves are on screen. Reading `y = 2500` (below the last line of script,
so the profile is clean), the left leaf is page 298 and the right leaf is page 297 — read
off the visible line fragments: the left leaf opens «وَدَخَلَ جَنَّتَهُ وَهُوَ ظَالِمٌ» (298's first line),
the right leaf ends «عُونَ رَبَّهُم بِٱلْغَدَوٰةِ وَٱلْعَشِىِّ» (297's first line).

**No field colour appears anywhere in the row.** `x = 0` and `x = 1289` are both paper. What
separates the two leaves is:

- a **core hairline** at `x = 634…636` — 3 device px = **1.0 CSS px** — at `(101,86,67)`;
- a **symmetric ramp** falling into it from both sides: paper is untouched out to
  `x = 594` and `x = 673`, i.e. **40 device px = 13.3 CSS px on each side, 26.7 CSS px
  total**, sagging from `(250,241,228)` to `(218,205,184)` at the hairline's shoulder.

Expressed as an alpha of a warm dark over paper, that shoulder is **α ≈ 0.15–0.22** and the
hairline is **α ≈ 0.70**. There is no rounded corner and no sliver stack at the crease: the
two leaves meet square.

**Observed: the leaves do not scale.** The vertical extent at the crease and at `x = 200` is
`160…2635` — **identical to the at-rest leaf**. Nothing shrinks, lifts, or tilts during the
slide.

### 1.5 The gap (`IMG_0695`)

**Observed.** The left leaf is page 297 (its first line and its «1/2 Hizb 30» footer), the
right leaf is page 296 (Al-Kahf 21–27). Between them, at `y = 2500`:

- the left leaf's fore-edge stack — sliver 1, sliver 2, outer rule — running out to
  `x = 577`;
- **pure field `(175,138,104)` from `x = 582` to `x = 661`** — 80 device px = **26.7 CSS
  px**; outer-rule-to-outer-rule is 89 device = **29.7 CSS px**;
- the right leaf's fore-edge stack, mirrored, paper resuming at `x = 691`.

Each facing edge carries **both** a rounded corner and the full two-sliver stack. Sampling
the gap column top to bottom finds nothing but field (and the home indicator at
`y = 2757…2771`) — **no shadow is cast into the gap by either leaf.**

### 1.6 The inference that decides everything

Two mid-slide frames, two different treatments. The tempting reading is that the gap is a
function of slide distance and `IMG_0694` was simply caught earlier. **That reading is
wrong,** and the argument is short: in a horizontally-scrolled ribbon the spacing between
item *i* and item *i+1* is a layout constant; scrolling changes the offset, not the gutter.
The two frames show **different boundaries** — 298 | 297 in one, 297 | 296 in the other —
and it is the boundary, not the phase of the motion, that differs.

So: **the reference alternates crease and gap by page parity, and it does so because a
crease is a gutter (two facing pages of one opening) and a gap is the outside of the book
(two leaves belonging to different openings).** It is a genuine model of a codex flattened
into a ribbon, and the vocabulary is the thing worth taking.

**One inference that must be flagged, because §4 depends on it.** The reference draws the
crease at **297 | 298** and the gap at **296 | 297**. It therefore pairs *(odd, even)* into a
spread. `spreadOf` pairs *(even, odd)* — even on the right (decision row 9,
`packages/core/src/pages.ts`, `docs/design/desktop.md` §2 ②). **The two conventions are one
leaf out of phase and they cannot both describe the Madani print.** §7 ① names the
observation that settles it and the argument that currently favours `spreadOf`. Nothing in
this design hard-codes a parity; §4's whole point is that the predicate is a call into core.

---

## 2. The edge vocabulary at rest

This is where "floating" is actually cured, and it is worth being blunt about why: **the
transition is a few hundred milliseconds and the resting page is the other twenty-four
hours.** A turn effect grafted onto a card that hovers on a vignette will still look like a
card that hovers on a vignette.

### 2.1 What ships today, and what each part of it is doing wrong

`apps/web/src/components/PageStage.module.css`:

```css
.stage { padding: var(--space-4);
         background: radial-gradient(120% 90% at 50% 0%, var(--paper-raised), var(--paper) 60%); }
.host  { filter: drop-shadow(var(--shadow-2));
         border-radius: var(--radius-sm);
         background: var(--paper-raised); }
```

Four separate mistakes, and the reference falsifies each of them independently:

| ships today | the reference | why the reference is right |
| --- | --- | --- |
| `filter: drop-shadow(--shadow-2)` (`:47`) | **no shadow at all** — flat field up to a 2 CSS px dark rule (§1.1) | A shadow claims elevation. A leaf is not elevated. It also costs ~1.1 ms/frame over an identical `box-shadow` (`page-turning.md` §5, measured) — the app's whole recorded frame headroom. |
| `border-radius: --radius-sm` (6 px) on **four** corners (`:48`) | **≈20 CSS px on two corners**, square on the other two (§1.3) | A leaf has two free corners and two bound ones. Four equal corners draw a loose sheet. And the current radius is invisible anyway: the SVG's box exactly equals the host's and paints over it (`page-turning.md` §7 ⑦, measured). |
| `background: --paper-raised` on `.host` (`:49`) *and* `--paper-raised` as the vignette's inner stop (`:19`) | field `#AF8A68` — nothing like paper | The page's top edge currently has **no contrast with the field behind it**. The only thing separating page from stage is the shadow, which is the thing that has to go. |
| `.stage` padded equally on four sides (`:6`) | the leaf **bleeds off the screen** on its bound side (§1.2) | Air on all four sides is the single strongest "this is a card on a desk" cue. A leaf continues into a binding. |

### 2.2 The system, and where each side comes from

Four marks. Every one of them sits **beside the paper, never on it** — no glyph is
overpainted, which is the constraint `page-turning.md` §8 was protecting.

1. **The boundary rule.** ~2 CSS px, warm dark, on all four sides. Not `--hairline`: that
   token is documented in `tokens.css` as being for "rules nobody reads", and this is the
   edge of the object. Proposed token **`--leaf-edge`**.
2. **The fore-edge stack**, on the **free** side only: two bands of 4 CSS px, stepping
   darker, separated by soft rules — 10 CSS px in total. Proposed tokens **`--fore-edge`**
   and **`--fore-edge-deep`**, following the existing `--gutter-shadow` /
   `--gutter-shadow-deep` pair, plus **`--fore-edge-width: 4px`**.
3. **An asymmetric corner radius**, ≈20 CSS px on the **free** side, square on the bound
   side. Proposed token **`--radius-leaf`**. It is a *role* token, not a step on the
   `--radius-sm/md/lg` scale, in the same way `--touch-min` and `--gutter-shadow` are role
   tokens.
4. **A field the page is not.** `page-turning.md` §3.1 ④ already proposes `--paper-sunk`
   (`#ece4d6`) and that is the right first move — it is in the palette, it needs no contrast
   review, and it stops the vignette's inner stop from being the page's own colour. The
   reference's field is a full step further out (`#AF8A68`, a saturated tan). Adopting
   anything like it is a **colour decision**, not a layout one, and §7 ④ names what would
   have to be run first.

### 2.3 Which side is free, and how the stylesheet is allowed to know

**The free side is a fact about the print, and it is already in core.** For a page *p*:

```
spreadOf(p, total).right === p   →  the leaf is the right-hand leaf  →  free edge RIGHT
otherwise                        →  the leaf is the left-hand leaf   →  free edge LEFT
```

`PageStage` writes `data-leaf="right"` or `data-leaf="left"` on the host and the stylesheet
keys off it. **It must not be a `:nth-child`, a parity check in CSS, or a logical property.**
Decision row 9 states the rule this obeys — "encoded once… declaring the direction twice is
how two declarations eventually disagree" — and there is a second reason here: the free side
flips with *page parity*, not with *reading direction*, so `inline-start`/`inline-end` are
exactly the wrong tools. They would flip the fore-edge when the UI language changes, which
is meaningless.

**A consequence worth stating loudly, because it constrains what can be shipped and what
can be shot as a golden.** `spreadOf(7) = {right: 6, left: 7}`; likewise 9 and 19. **All
three vendored pages are left-hand leaves.** The right-rounded form — the reference's page
297 — is **unreachable in this build**. Whatever is written for it cannot be seen until
Loop 4b vendors an even page.

### 2.4 The bound edge, and the desktop spread

On a phone one leaf is on screen. Its bound side runs off the screen edge: **`.stage`'s
padding goes to zero on the bound side** and stays `--space-4` on the other three. That is
the mark that makes it a leaf rather than a sheet. It has a cost, and the cost must be
named: `stage-fit.spec.ts` documents that padding as "a gutter by design and the clamp must
never eat it", and `measureFit` reads the **layer**, so asymmetric padding changes the box
`clampView` reasons in. It is one declaration and one test row, not a rewrite — but it is
not free, and §6 covers it.

**No fake gutter on the phone.** A shaded gutter down the bound side of a single leaf would
assert a facing page that is not on screen. The fore-edge stack is honest — the block of
pages under the leaf is real, and it is on the side where a real one would be. A gutter
would not be. This is the same rule as §4, applied to the resting state.

**On the desktop spread the bound edges face each other and the crease is already built.**
`PageSpread` mounts exactly one `spreadOf` pair, emits them right-leaf-first inside
`main[dir="rtl"]`, and draws `.gutter` between them: a 28 px band,
`transparent → --gutter-shadow 42% → --gutter-shadow-deep 50% → --gutter-shadow 58% →
transparent` (`PageSpread.module.css:60-75`).

Measure that against §1.4 and the convergence is striking:

| | reference | Hifth today |
| --- | --- | --- |
| total ramp width | **26.7 CSS px** | **28 px** |
| alpha at the shoulder | **≈0.15–0.22** of a warm dark | `--gutter-shadow-deep` = **0.18** of `rgba(38,32,26,…)` |
| core hairline | **1.0 CSS px at α ≈ 0.70** | *absent* — the gradient's deepest stop is 0.18 |

Two independent designs landing within 1.3 px and 0.02 alpha of each other is the strongest
evidence in this document that the existing gutter is right. **The one change worth making
is the core hairline** — a 1 px darkest stop at the centre of `.gutter`. `tokens.css` already
argues that a spine "darkens toward its centre"; the reference darkens ~3.5× further than
0.18 for exactly one pixel, and that pixel is what makes a fold read as a fold rather than
as a soft band. Proposed token **`--gutter-core`**. **This is a taste call informed by one
measured reference and it is labelled as one.**

So the spread becomes: rounded outer edge with a fore-edge stack, square inner edge, crease,
square inner edge, rounded outer edge with a fore-edge stack. That is a picture of an open
book, and it costs two pseudo-elements and one gradient stop.

---

## 3. The transition

### 3.1 The constraint that shapes it, and the one page-turning.md missed

**`.host`'s `transform` is the view.** `applyTransform` writes
`translate3d(x,y,0) scale(z)` through `clampView` on every frame
(`PageStage.tsx:209-221`), and pan, pinch and hop all own it. `page-turning.md` §3.1
concluded from this that **opacity is the only free channel** on `.host`, and recommended a
~120 ms cross-fade. That conclusion is correct and this document does not overturn it.

What it missed is that **the free channel does not have to be on `.host` at all.** The
turning leaf in a physical book is not either of the two pages you are looking at — it is a
third object that passes over them. Both pages stay exactly where they are; only the leaf
moves. So the element that carries the motion should be a **third element that contains no
page**, and the view loop has no opinion about it because it is not in `.layer`.

Call it the **fold**. One absolutely-positioned `<div>`, a sibling of `.layer` inside
`.stage`, `pointer-events: none`, `aria-hidden="true"`, no children, its whole appearance a
`linear-gradient` background. It owns `transform: translateX()` and `opacity` and nothing
else owns either.

This is why `page-turning.md` §4.3's `.leaf` wrapper is withdrawn (§3.4) and why §3.1's
`≤16 px translateX` direction cue is withdrawn: both put a second transform on an **ancestor
of a 170 KB inline SVG**, which is the composited layer we are least able to afford to
promote twice, and both move glyphs in order to say something that can be said beside them.
The axiom in `page-turning.md` §1.5 — *anything that moves an ayah's on-screen position
between visits is actively harmful* — is answered here in the strongest possible form:
**during a turn, no glyph moves at all.**

### 3.2 The state machine

Five states. Names are proposed for the `data-turn` attribute on `.stage`.

```
  rest ──drag latches "turn"──▶ tracking ──release below threshold──▶ retreating ──▶ rest
    │                              │
    │                              └──release above threshold──┐
    │                                                          ▼
    └──key / button / wheel───────────────────────────────▶ crossing ──▶ landing ──▶ rest
                                                               │
                                                    destination not mounted
                                                               ▼
                                                            stalled ──arrives──▶ crossing
                                                               └──fails──▶ retreating
```

**rest.** The fold does not exist in the DOM. `.stage` has no `data-turn`.

**tracking** (finger only). The gesture ladder is `page-turning.md` §4.2's, unchanged: a
`"turn"` verdict below `"pinch"` and `"marquee"`, gated on `fits` (at z = 1 a horizontal
drag is a measured no-op, so the slot is empty), with the 24 px iOS back-swipe exclusion of
§4.4. What changes is what the finger drags. The fold is inserted at the leading screen edge
and tracks the finger **linearly, 1:1, no easing** — direct manipulation of the fold. The
pages do not move and do not fade. The fold's *appearance* is already resolved (§4) from the
pair the drag would land on, so the reader can see, before committing, whether this turn
crosses a fold or a hole.

**retreating.** Below `page-turning.md` §4.3's commit threshold (25 % of stage width or a
flick), the fold slides back out the way it came over `--dur-fast` and is removed. Nothing
else happened, because nothing else had happened yet.

**crossing.** The fold travels from the leading edge to the trailing edge over
`--dur-med` (240 ms), eased with `--ease-hop`. This is the whole animation.

**landing.** The fold is removed; `data-turn` is cleared. The view is carried across
unchanged (`page-turning.md` §4.5 — mushaf pages are geometrically congruent, so a reader
zoomed into line 4 stays on line 4); the existing `LiveAnnouncer` speaks.

**The page swap happens under the fold.** The outgoing host goes to `opacity: 0` and the
incoming to `opacity: 1` over `--dur-fast` (120 ms), timed so its midpoint coincides with
the fold's centre crossing the leaf's centre: with a 240 ms sweep that is **start at 60 ms,
end at 180 ms**.

That timing is the point of the whole design. A bare cross-fade between two mushaf pages
double-exposes two nearly-identical grids of black script; the moment of maximum ambiguity
is t = 0.5, and it is the moment the reader is looking hardest. **The fold covers exactly
that moment.** Everything else about the cross-fade — that it needs both pages mounted, that
it is a compositing cost and not a raster cost because both hosts are already rasterized —
is `page-turning.md` §5's accounting, inherited unchanged.

Durations come from `page-turning.md` §2.4's survey: Material's 300 ms mobile / 375 ms
large-full-screen / "400 ms starts to feel slow", NN/g's 200–300 ms for substantial screen
changes. `--dur-med` is 240 ms and already exists. **Material's separate 150–200 ms desktop
guidance argues for a shorter desktop sweep; a new duration token for a 40 ms difference is
not worth its own row, and the 240-vs-200 question is unmeasured — noted in §7 ③.**

### 3.3 Direction, and the seam in `loop-1.md`

`loop-1.md` pinned two clauses: *"dragging the page left→right advances to the next page"*
and *"the next page enters from the right"*. `page-turning.md` §3.1 found that no translating
design can satisfy both — a carousel that moves rightward brings content in from the left —
and used it as an argument against the slide. That finding stands and is not re-litigated.

**The fold satisfies the first clause literally and makes the second moot.** The fold moves
left→right for the next page: the thing under the finger moves with the finger, at 1:1,
which is the strongest possible reading of the drag clause. And **nothing enters from
either side** — no page pixel translates, so there is no entrance to get wrong. This is not
a way of dodging the second clause; it is a design in which the second clause has nothing to
describe. That is worth writing down, because the next person to propose a slide will hit
the same contradiction and should find it already recorded twice.

### 3.4 Interruption — the common case

A hafiz turning three pages does not wait 240 ms between presses. Four rules:

1. **One fold, ever.** A second turn **re-targets** the existing element rather than
   inserting another. Same direction: the fold does not restart from the edge, it continues
   from where it is toward the trailing edge, and the swap under it is re-pointed at the new
   destination. Opposite direction: it reverses from its current position.
2. **The fold's appearance is recomputed on re-target.** A crease that becomes a hole
   mid-travel is **correct, not a glitch** — the pair changed, and the fold is telling the
   truth about the new pair. §4's predicate is a pure function precisely so this is a
   re-evaluation and not a state machine.
3. **At most one host above `opacity: 0` besides the incoming one.** A new turn sets every
   other mounted host to `opacity: 0` with the transition suppressed. Held-down arrow repeat
   then costs one composited layer, not N. This matters because `pagesRef` is unbounded
   today (`App.tsx:286-307`, backlog ③) and a fade that touched every mounted host would
   make the unbounded set a per-frame cost.
4. **Interrupting never leaves the page half-turned.** The current page is whatever the last
   commit named; the fold is decoration over a `setCurrentPage` that has already happened or
   has not.

`page-turning.md` §4.3's `.leaf` wrapper cannot do (1) or (3): a per-page wrapper means N
wrappers with N transforms and a turn is a negotiation between them. One fold is one
element with one animation.

### 3.5 Desktop

Everything above applies, with one change that falls out of `spreadOf` rather than being
decided:

**A turn between two facing pages animates nothing on the paper, because nothing on the
paper changed.** Above the breakpoint the spread mounts both leaves of one `spreadOf` pair.
A turn from 6 to 7 is a turn *within* that pair: both leaves are already on screen, both
stay, and the only thing that moves is which leaf is live — the selection, the gestures,
the header's page number. **No fold, no cross-fade, no motion on the stage.** The crease
between them is already drawn and is already the correct statement.

A turn that leaves the pair — 7 to 8, or today 7 to 9 — changes **both** panels, so the fold
sweeps the **whole spread**, not one leaf, and its appearance is resolved from the two
*spreads*, not the two pages.

This is decision row 20 (§9), and it is the good kind of desktop difference: not a feature
the phone cannot have, but the same rule producing a different answer because the desktop
already shows more of the book.

---

## 4. Crease vs gap, decided

### 4.1 The rule

> **A crease says "one opening."**
> **A gap says "one leaf turned."**
> **Sunk paper behind a dashed edge says "there is a leaf here and this build does not have
> it."**
> **Nothing at all says "this was not a turn."**

And the predicate is **not parity in a stylesheet**. It is a pure function in
`packages/core`, beside `spreadOf` and `nearestPage`, read at turn time:

```ts
export type Fold = "crease" | "gap" | "hole" | "none";

/**
 * What lies between two pages, told truthfully.
 *
 *   crease — the two pages face each other in the print: one opening, one gutter.
 *   gap    — consecutive in the print, but different openings: a leaf turned.
 *   hole   — the print has pages between these two and this build does not.
 *   none   — not a turn at all (a hop, a scrub, the same page).
 */
export function foldBetween(
  from: number,
  to: number,
  total: number,
  vendored: readonly number[],
): Fold;
```

The body is four lines and every one of them defers to something already pinned:

- `from === to`, or either page invalid → `"none"`.
- `spreadOf(from, total).right === spreadOf(to, total).right` → `"crease"`.
- `Math.abs(from − to) === 1` → `"gap"`.
- otherwise → `"hole"`.

`"none"` for a *jump* is the caller's to pass, not the function's to infer: `foldBetween`
cannot see whether the reader pressed an arrow or tapped a hop chip, and that distinction is
the one `page-turning.md` §4.5 already drew — *a turn is continuous reading; a jump is a
relocation*. `App.tsx`'s `stepPage` passes the real pair; `goToPage` from a hop or a scrub
passes `"none"`.

Two consequences fall out for free, and both are the reason to derive rather than hard-code:

- **Page 1 is handled without a special case.** `spreadOf(1) = {right: 1, left: null}` and
  `spreadOf(2) = {right: 2, left: 3}` are different spreads, so 1 | 2 is a `"gap"` — correct,
  because page 1 faces nothing and getting to page 2 turns a leaf.
- **If §7 ①'s observation goes against `spreadOf`, one line in `pages.ts` fixes every crease
  in the application.** A parity rule written into `PageStage.module.css` would have to be
  found and corrected separately, and it would be found by somebody noticing that the folds
  looked wrong.

### 4.2 What each one looks like, and what it tells the reader

All four are the same 100 %-height band, differing only in width and fill.

**Crease — width 28 px.** The `.gutter` gradient of §2.4, reused verbatim, plus the
`--gutter-core` hairline: `transparent → --gutter-shadow 42% → --gutter-core at 50% →
--gutter-shadow 58% → transparent`. **No field colour shows.** The two leaves are edge to
edge behind it.

*The reader is told:* these two pages sit side by side in the mushaf; what you crossed is a
fold, not a leaf. Nothing was turned — your eye moved from the right page to the left one.

**Gap — width 30 px.** A band of the field colour, with the fore-edge stack of §2.2 mirrored
on each side of it: sliver, sliver, rule, **field**, rule, sliver, sliver. Measured at
26.7 CSS px of pure field and 29.7 edge-to-edge (§1.5); 30 px is that, rounded, and it is
within 2 px of the crease so the two treatments are the same *size* of event.

*The reader is told:* a leaf turned. You were in one opening and you are now in another. The
cut edges you can see are the outsides of two different openings of the book.

**Hole — width 30 px, and a different kind of thing.** Not a wider gap. `--paper-sunk` fill,
with a **dashed** hairline on each side rather than the fore-edge stack.

This is not a new idea; it is the app's existing word for absence, and it has been argued
twice already. `PageSpread.module.css:87-110` renders the absent leaf on `--paper-sunk` with
`border: 1px dashed var(--hairline)`, and says why: *"Dashes are already this app's word for
'this is not a result yet' — the marquee in flight uses them — and a hole in the inventory is
the same kind of statement."* `docs/design/revision-record.md` reaches the identical
conclusion for the map: absent gets "a **different treatment entirely**, not the same grey at
lower opacity" — no fill, dashed hairline — because *"grey at lower opacity would tell a
hafiz they had abandoned 99.5 % of the Qur'an, which is false and entirely an artefact of the
build."*

*The reader is told:* the print has pages between these two and this build does not hold
them. What you crossed is not one fold.

**None — no band, no fold, no cross-fade change.** A hop keeps its existing choreography
(`frameBboxToView` + `tweenTo` at `--dur-hop`, `--ease-hop`), which is the app's one
orchestrated moment and is already correct. A page-bar scrub lands and announces.

*The reader is told:* you did not turn a page, you went somewhere. A fold drawn across a hop
from page 19 to page 7 would claim they are neighbours, which is the exact class of claim
this rule exists to refuse.

### 4.3 Why the adjacency clause is the whole point

The repo's standing rule, from `PLAN.md:458`:

> **A gap is a to-do; a gap the interface papers over is a lie.**

An interface that draws a bound-book crease between page 7 and page 9 asserts that they are
consecutive leaves. They are not. This is the same shape as the two failures the project has
already paid for and written up — a licence summary that over-restricted (follow-up ②), and
a header claiming a page the stage never loaded — and it is the shape `revision-record.md`
and `PageSpread` were both built to refuse. **The UI stating something the build cannot
back.**

So the conditional is not decoration on the effect. It is the effect's only claim to being
true.

### 4.4 What this means for the build that exists today

**Only pages 7, 9 and 19 are vendored, and no two of them are adjacent.** Therefore, in the
shipped build:

| turn | `foldBetween` | drawn |
| --- | --- | --- |
| 7 → 9 | `"hole"` (page 8 is in the print, not in `public/assets`) | sunk paper, dashed |
| 9 → 19 | `"hole"` (nine pages) | sunk paper, dashed |
| any hop | `"none"` | nothing |

**Every turn in the shipped build is a hole. No crease and no gap can be drawn until Loop
4b.** That is not a limitation of the design; it is the design working. The honest picture
of a three-page build is that you never turn one leaf, and a reader who sees the same dashed
band on every turn has been told something true and useful about what they are holding.

It also means the visual half of this rule is the twin of `page-turning.md` §7 ④ — *"A turn
across an absent page is silent"*, where `stepPage` walks the inventory and announces only
the landing, so «صفحة ٨» is never mentioned even though `nearestPageN` already exists in both
catalogues. **They are one statement in two channels and they should land together.** Ship
the band without the announcement and the interface tells a sighted reader something it
withholds from a screen-reader user.

### 4.5 The four cases the brief asks about, answered

| case | `foldBetween` | drawn | why |
| --- | --- | --- | --- |
| **Adjacent, facing** (6 → 7) | `crease` | 28 px gutter gradient + core hairline; no field | One opening. On desktop, *nothing animates at all* (§3.5) — both leaves are already on screen and neither changed. |
| **Adjacent, not facing** (7 → 8) | `gap` | 30 px field between two fore-edge stacks | A leaf turned; two different openings. The cut edges are honest — they are what you would see. |
| **Non-adjacent** (7 → 9, today's only case) | `hole` | 30 px `--paper-sunk`, dashed hairline each side | The print has a leaf here and this build does not. Not a wider gap: a different kind of thing, per the precedent in `PageSpread` and `revision-record.md`. |
| **A hop to a distant page** (2:47 on p7 → its mutashabih on p19) | `none` | nothing; the hop keeps `frameBboxToView` + `--dur-hop` | It is not a turn. A fold implies a book-order relationship between the two pages, and a mutashabihat edge is precisely *not* one. |

### 4.6 What is deliberately not encoded

- **Gap width does not scale with distance.** 7 → 9 and 7 → 19 draw the same hole. Scaling
  would invent a metric the mushaf does not have: is nineteen twelve gaps from seven, or one
  absence? Neither, and the interface should not pick.
- **The fore-edge stack does not thin as you read.** A real fore-edge block shrinks as the
  read pages accumulate on the other side, and the reference does not model it either (§7 ⑤
  records that we only have one sample). It **must not** be modelled here, and the reason is
  the axiom: a fore-edge whose width varied by page would change the leaf's width by page,
  which would move every ayah on it. Page-image memory forbids it. A free wayfinding channel
  is not worth a moving page.

---

## 5. Degradation

### 5.1 `prefers-reduced-motion`

The relevant standards are surveyed in `page-turning.md` §2.5 and are not restated; three of
its findings decide this section. WCAG's normative definition excludes opacity from "motion
animation" entirely. WCAG 2.3.3, the criterion that names page-flipping, is Level **AAA** —
no Level A or AA criterion governs a page turn, so honouring the preference here is
voluntarily meeting a AAA bar. And the correct response is **replace, not remove** (MDN,
Apple's HIG, WebKit's James Craig: *"removing the animation entirely may make the interface
confusing or unusable"*).

The fold's `translateX` **is** motion animation — it changes the perceived position of an
element — so it must be replaced.

**The replacement is a hard cut, and the thing being replaced loses no information.** Under
`prefers-reduced-motion: reduce`:

- The fold is **not inserted at all.** Not inserted-and-instant: a band that appears and
  vanishes within one frame is a flash, which is worse than nothing.
- `--dur-fast` and `--dur-med` are already `0ms` (`tokens.css:155-159`), so the cross-fade is
  a swap. This is exactly today's behaviour and needs no new code — `page-turning.md` §7 ⑪
  makes the same observation.

This is normally where a design has to argue that the reduced-motion path is "good enough".
This one does not, and the reason is §2: **the fold's information is also carried at rest.**
The leaf's rounded side says which half of a spread you are on. The fore-edge stack says
there is a block of pages under you. The announcer names the landing. The page bar's thumb
and ticks show the inventory. A reader who never sees a fold has not been told less about
adjacency — they have been told it by furniture that does not move, which is what
`docs/design/revision-record.md` calls a permanent condition belonging in the document rather
than in a live region.

**A design that degrades to zero without lying is the test this one has to pass, and §2 is
why it passes it.**

### 5.2 The unknown-performance path

`perf-verdict-on-device` (`docs/validation/ledger.json`, `backlog.md` §0 ①) is **open**, and
it decides which of three rendering strategies ships. This design must not presuppose the
answer. Three honest statements:

1. **The fold is the cheapest part.** One `<div>`, no children, no text, no SVG, a
   `linear-gradient` background, animating `transform` and `opacity` only. It promotes one
   small composited layer. It is not the thing to worry about.
2. **The cross-fade under it requires both pages painted simultaneously, and this design
   inherits that risk from `page-turning.md` §5 unchanged.** Both pages are already *mounted*
   (the mounted set is unbounded, backlog ③), so this adds a second painted layer for 120 ms,
   not a second raster. **But if the verdict picks `content-visibility` virtualization, the
   outgoing page may be `content-visibility: hidden` when the fade starts, and the fade would
   force it back into rendering.** That is a real risk and it is named, not solved.
3. **The degraded path is the fold *without* the cross-fade.** This is the lever the fold
   buys and it is the reason to prefer this design over a bare cross-fade even on perf
   grounds: because the swap happens under an opaque band at the moment the band covers the
   leaf's centre, **the cross-fade can be dropped to a hard cut and the turn remains
   legible.** A bare cross-fade has no such fallback — remove the fade and there is no
   transition. So the ordering under pressure is:

   | budget | what runs |
   | --- | --- |
   | full | fold sweep + 120 ms cross-fade |
   | constrained (verdict says two painted layers are too dear, or the device is slow) | fold sweep + **hard cut** at the fold's centre |
   | `prefers-reduced-motion` | **nothing** — hard cut, §5.1 |

   The middle row is the one that did not exist before, and it costs one boolean.

**What would measure it:** the probe already has a `pan` segment
(`apps/web/src/perf/probe.ts`, `make phone-perf`). Add a `turn` segment that drives N turns
and reports frame time, and run it in both the full and constrained configurations. Nobody
has run it; it is §7 ③.

### 5.3 The destination page has not loaded

This is real, not hypothetical: pages are fetched assets, `mountPage` awaits `loadPageSvg`
and **returns `null` on failure** (`PageStage.tsx`), and Loop 4b makes streaming the normal
case rather than the exception.

- **A turn does not start until the destination host exists and has painted.** A fold that
  lands on nothing is a fold over blank stage, which is the failure `stage-fit.spec.ts` was
  written for.
- **If the fetch is still in flight when the fold reaches the leaf's centre, the fold
  stalls there.** `.layer` already carries `aria-busy`; the stalled fold is its visual. A
  fold that stops mid-crossing is honest — it says *the leaf is still coming*, which is what
  is happening.
- **If the fetch fails — offline, unvendored, a 404 — the fold retreats the way it came and
  the page does not change.** The existing `t.nearestPageN` announcement speaks. It must
  never land: landing on an empty host paints `--paper-sunk` where scripture should be, and
  a reader who does not look closely has been shown a blank mushaf page.
- **How long may it stall before it reads as broken?** Unknown. NN/g's 1 s "flow of thought"
  boundary is the obvious candidate and this document declines to assert it as measured.
  §7 ③.

---

## 6. What would fail if we broke it

This repo verifies by **inducing the failure and reverting**, so each row names the induced
failure and what it would look like.

### 6.1 Unit, `packages/core`

`foldBetween` is a pure function over integers and it is where the whole rule lives, so this
is the cheapest and most valuable tier.

| assertion | induced failure |
| --- | --- |
| `foldBetween(6, 7, 604, …) === "crease"` | Flip the comparison to `spreadOf(from).left === spreadOf(to).left`. 6\|7 becomes a gap and 7\|8 becomes a crease — the phase error of §7 ①, caught by a test rather than by a reader. |
| `foldBetween(7, 8, 604, …) === "gap"` | Return `"crease"` for every `abs(from−to) === 1`. Consecutive-but-not-facing pages claim to share a gutter. |
| `foldBetween(7, 9, 604, [7,9,19]) === "hole"` | Treat "consecutive in `vendored`" as adjacency. **This is the defect the whole document exists to prevent** and it is one wrong array in the predicate. |
| `foldBetween(1, 2, …) === "gap"` | Special-case page 1 to `"crease"` on the theory that it "opens the book". It faces nothing; `spreadOf` already knows. |
| `foldBetween(p, p, …) === "none"`, and invalid pages → `"none"` | Drop the guard. A re-render at the same page inserts a fold. |
| `foldBetween(604, 605, …) === "none"` | Drop the `total` bound. The last page turns into a hole that is off the end of the book. |

### 6.2 e2e — `stage-fit.spec.ts` needs two rows it does not have

`stage-fit.spec.ts` runs on the **`iphone` and `android` projects only** — the `desktop`
project is `testMatch: /desktop\.spec\.ts/` and both phone projects carry
`testIgnore: /(golden|shots|desktop)\.spec\.ts/` (`playwright.config.ts:162-178`). Those are
exactly the two viewports where `host.width === layer.width` and the double-centring defect
is zero. `page-turning.md` §7 ② established this; it is restated here only because §2.4
**changes the box** the spec measures, so shipping the asymmetric padding without these rows
would remove the last thing watching the geometry.

| claim | test | induced failure |
| --- | --- | --- |
| The leaf is centred against the **stage** on every viewport | a `desktop`-project row asserting `\|left−right\| ≤ 1` after the stage's bound-side padding is removed from the expectation | Restore symmetric padding without updating the expectation, or restore `place-items: center` on `.layer` — fails at 1440×900 by ~246 px (`page-turning.md` §1.2, measured). |
| No part of the page is unreachable at the 320 px floor | a 320×568 row asserting `host.bottom ≤ stage.bottom + 1` | Remove `min-block-size: 0` from `.layer` — 169.4 px of leaf below the fold, drag refused (measured). |
| **The fore-edge stack is beside the paper, not over it** | assert the *SVG's* box, not the host's, covers the layer minus the stack | Draw the stack inside the host's padding box. Coverage still passes while 10 px of scripture sits under the page block. **This is the new failure §2 introduces and nothing today would see it.** |

### 6.3 e2e — a new `page-turn.spec.ts`

| claim | test | induced failure |
| --- | --- | --- |
| The fold says what core says | read `[data-fold]` off the band and compare against `foldBetween` for the same pair, across every turn the inventory allows | Hard-code parity in `PageStage.module.css` instead of reading the attribute. The CSS and core disagree the moment `spreadOf` is corrected, and only this row notices. |
| In this build, every turn is a hole | 7 → 9 and 9 → 19 both yield `data-fold="hole"`; **no** turn yields `"crease"` | Map `"gap"` onto any turn between two *vendored* pages. The interface asserts 7 and 9 are neighbours. |
| A hop draws no fold | tap 2:47, hop to p19, assert no band was ever inserted | Route hops through `stepPage`. A mutashabihat jump claims book adjacency. |
| No glyph moves during a turn | mark a glyph, sample its client rect at 0/60/120/180/240 ms, assert it never moves | Reintroduce `page-turning.md` §3.1 (a)'s 16 px `translateX`. Fails by 16 px — which is the point of withdrawing it. |
| Interruption leaves one fold and one visible page | three `←` inside 100 ms; assert exactly one band element and exactly one host at `opacity: 1` | Insert a fold per turn. Three bands overlap, and every mounted host is mid-fade. |
| Reduced motion inserts no fold | with `prefers-reduced-motion: reduce`, turn and assert no band element ever exists and the swap completes in one frame | Insert the band and rely on the duration token being 0. A one-frame band is a flash. |
| A turn to an unloaded page does not land | `page.route` blocks the target SVG; turn; assert the page number is unchanged and the announcer spoke; unblock; assert it lands | Let `setCurrentPage` run before the mount resolves. The stage shows `--paper-sunk` where a page should be. |
| The marquee is never eaten | `marquee.spec.ts` unchanged, plus press → hold 400 ms → drag 200 px horizontally → marquee, not a turn | Reorder `page-turning.md` §4.2's ladder so `"turn"` precedes `"marquee"`. |

### 6.4 Golden images

`golden.spec.ts` shoots **the page SVG element only** and deliberately not the chrome. The
leaf's edges, the field and the fold are all **outside** the SVG, so **no existing baseline
changes.** That is worth stating plainly: a design that silently invalidated five committed
baselines would be a different-sized change, and this one does not.

A *new* shot is needed for the edge system, and it has a limit worth recording: `SHOTS`
would need one leaf of each parity, and **all three vendored pages are left-hand leaves**
(§2.3). The right-rounded form cannot be shot until Loop 4b vendors an even page. Desktop
has no golden baselines by policy (decision row 17) and this does not change that — the
spread's crease is structure and `desktop.spec.ts` can assert it by attribute.

---

## 7. Open questions, and what would answer each

**① The spread's phase — and it is the one that could make every crease in the app wrong.**
`spreadOf` pairs (even, odd) with even on the right. The reference app pairs (odd, even)
(§1.6). They are one leaf out of phase.

The argument currently favouring `spreadOf`: every juz' after the first begins on pages 22,
42, 62, 82 … — all **even** — and the well-known property is that **every juz' begins on a
right-hand page**. Even = right ⇒ spreads are (even, odd). `page-turning.md` §2.1 records the
same, verified against two Qur'an APIs, and `desktop.md` §2 ② and decision row 9 both pin it.

**That is an argument, not an observation, and it is the kind of argument this repo has
learned to distrust.** What would settle it in ten seconds: **open a physical KFGQPC Madani
mushaf and photograph any opening, then read the two page numbers.** If the right-hand number
is even, `spreadOf` is right and the reference is one leaf out. If it is odd, `spreadOf` is
wrong and one line in `pages.ts` corrects every crease, every spread and every fold at once —
which is the payoff for §4.1's insistence that the predicate live in core. It is a **ledger
check**, human-only, and it costs nothing.

**② Does the fold read at all?** The claim in §3.2 — that a 28–30 px band crossing in 240 ms
is legible as a fold and does mask the cross-fade's ambiguous midpoint — is a design
judgement with no evidence behind it. What would answer it: build it and put it in front of a
hafiz on the acceptance phone. There is no cheaper instrument, and no measurement substitutes
for it.

**③ Everything gated on `perf-verdict-on-device` (backlog ① / `PLAN.md` follow-up ①).**
Three sub-questions, all needing the same hardware:
- Does a second painted layer for 120 ms cost anything measurable on a mid-tier Android
  beside a 170 KB inline SVG? **Measure:** a `turn` segment in `apps/web/src/perf/probe.ts`
  beside the existing `pan` / `pinch` / `highlight`, run via `make phone-perf`.
- If the verdict picks `content-visibility`, does fading an outgoing page that is
  `content-visibility: hidden` force a re-render, and what does that cost? Same instrument.
- Is 240 ms right, or does Material's 150–200 ms desktop guidance win on a desktop? A 40 ms
  difference is below the threshold at which a new duration token pays for itself; it needs
  someone to look at both.

Also unmeasured: **how long a stalled fold (§5.3) may hold before it reads as broken.**

**④ The field colour.** §2.2 proposes `--paper-sunk` because it is already in the palette.
The reference's `#AF8A68` is a full step further and separates the leaf far more decisively.
Adopting anything like it is a colour decision, and this repo has a specific instrument for
those: `e2e/contrast.spec.ts` walks eleven surfaces with real luminance compositing, and
**"any new sheet or popover needs a row in `SURFACES` or nothing is checking it"**
(`PLAN.md` follow-up ⑥). A darker field changes what the page bar, the coach marks and the
hint text sit against. **Answer it by adding the row before the token, not after.**

**⑤ Does a real fore-edge stack vary?** We have exactly one sample — page 297 of 604, drawn
with two slivers. Whether the reference thins it near the ends of the book is unknown.
**Measure:** capture the same application at page 5 and page 600 and compare the stack width.
§4.6 says it must be constant here regardless of the answer, so this is curiosity rather
than a blocker — but if it *does* vary, that is a design the reference got wrong for a
memoriser and worth recording as such.

**⑥ Inherited, not reopened.** `page-turning.md` §4.2's `|dx| > 2·|dy|` latch ratio and
§4.3's 25 %/velocity commit thresholds are all unmeasured there and remain unmeasured here.
They belong to the gesture, and the gesture is that document's.

---

## 8. Alternatives rejected

### ① The page curl — and the reason is honesty, not cost

`page-turning.md` §2.3 did the survey and it is the fairest treatment of the curl I have
read: it was an iPad-launch feature, Apple removed it in iOS 16 and restored it as an option
in 16.4 after real objection, **there is no published research showing it harms reading**,
and Google Play Books still ships the toggle — so the aesthetic constituency is genuine.
§8 rejected it for this codebase on cost (a 3D transform per frame over a rasterized 170 KB
inline SVG, precisely the re-raster risk backlog ① exists to measure) plus the observation
that a build with three non-adjacent pages has no leaf beneath to reveal.

**Those reasons are correct and they are contingent.** The perf verdict could come back fine;
Loop 4b will vendor the leaf beneath. So the curl deserves an argument that survives both,
and the measurement in §1 supplies two:

1. **A curl necessarily moves the page image.** The curling leaf's glyphs translate,
   foreshorten and rotate through the whole animation. That is the one motion
   `page-turning.md` §1.5's axiom forbids, and it is not a matter of degree — a curl with no
   glyph movement is not a curl. The fold moves *over* stationary glyphs; the curl *is* the
   glyphs moving.
2. **A curl asserts adjacency by construction.** You cannot curl page 7 to reveal page 9
   without drawing the fiction that 9 is the leaf underneath 7. There is no curl vocabulary
   for "there is a leaf here and we do not have it" — the geometry has no room for a third
   state. §4's whole rule becomes undrawable. And the mushaf case is not marginal: after 4b
   the *hole* disappears, but the crease/gap distinction remains, and a curl cannot express
   "these two pages are one opening and nothing turned" either, because a curl always turns
   something.

**And the reference does not curl.** It is a flat ribbon with a fold, and it is the artefact
the user asked to mimic. Rejecting the curl here is not overruling the request; it is reading
it.

**Rejected. Reconsider only if someone can draw a curl that expresses `Fold`'s four states.**

### ② The others

| alternative | why not |
| --- | --- |
| **Full horizontal slide / carousel** | `page-turning.md` §3.1's two reasons stand: it moves the page image, and it cannot honour both halves of `loop-1.md`. A third from this document: in a ribbon the gap width is a *layout* constant, so a non-adjacent pair must be drawn with either a fixed gap (a lie — 7 and 9 are not neighbours) or a scaled one (a metric the mushaf does not have, §4.6). The fold is a ribbon's fold without a ribbon's arithmetic. |
| **A bare cross-fade with no fold** (`page-turning.md` §3.1's recommendation) | **Not rejected — adopted as the substrate.** The fold is an addition on top, and if §7 ② goes against it the cross-fade alone remains correct and shippable. What the fold adds is (a) covering the double-exposure at t = 0.5, which is the cross-fade's one weakness on a mushaf specifically, (b) a direction cue that moves no glyph, and (c) the constrained-budget fallback of §5.2, which a bare cross-fade does not have. |
| **`page-turning.md` §4.3's `.leaf` wrapper** | A per-page element carrying `translateX` is a second transform on an ancestor of a 170 KB SVG, it promotes N layers for N mounted pages, and it cannot express §3.4's one-fold-ever rule. One element that contains no page does the same job. |
| **The `≤16 px translateX` direction cue** (`page-turning.md` §3.1 (a)) | Same root. It moves glyphs — a little — to say something the fold says beside them for free. 16 px is small, and the axiom does not have a small-print exemption. |
| **Mounting a real second leaf and sliding it** | The true skeuomorphic turn, and it needs two full pages composited and translating simultaneously. That is backlog ① and ③ at once, and today it would slide a leaf that does not exist. |
| **A fake gutter down one side of a phone's single leaf** | It asserts a facing page that is not on screen. §2.4. |
| **Gap width proportional to page distance** | Invents a metric. §4.6. |
| **A settings surface for turn style** (Curl / Fold / None) | `page-turning.md` §8: the header fits 320 px with seventeen pixels of slack and there is nowhere to put it. With one transition and one reduced-motion substitute there is nothing to choose between. |
| **Animating `clip-path` on the incoming host to wipe it in** | It would satisfy `loop-1.md`'s "enters from the right" literally. It is a per-frame repaint of a 170 KB SVG layer, which is the single most expensive thing available on this stage. Rejected on cost, and the cost is not marginal. |

---

## 9. Sequencing

### 9.1 What this is, in loop terms

**It is not a loop.** It is a body of work that splits cleanly in two, and the split matters
because one half is shippable now and the other is not:

- **§2 — the resting edge system.** Independent of the perf verdict, independent of Loop 4b,
  visible immediately, and it is the half that answers the actual complaint ("I don't
  currently like the floating page"). It is CSS, one `data-leaf` attribute written from
  `spreadOf`, three tokens and one gradient stop. It should be sequenced **with**
  `page-turning.md` §7's hardening list — the same files, the same tests, and §2.4's
  asymmetric padding needs §6.2's spec rows anyway.
- **§3–§4 — the fold.** Gated. It needs `foldBetween` in core (small), the fold element and
  its state machine in `apps/web` (medium), and it depends on two open things: the perf
  verdict (`PLAN.md` follow-up ①) for whether the cross-fade under it is affordable, and a
  ceiling on the mounted set (backlog ③) for whether §3.4 rule 3 is cheap. Neither is this
  work's to close.

**And the whole of §4 is worth more after Loop 4b than before.** Today every turn is a hole
(§4.4); the crease and the gap are code with no reachable input. That is an argument for
building `foldBetween` and its unit tests now — they are pure and they are where the rule
lives — and for landing the *drawing* alongside 4b.

### 9.2 Proposed `PLAN.md` follow-up

**This document does not edit `PLAN.md`, and the reason is a numbering collision, not
timidity.** `main` ends at follow-up ⑨; the unmerged branch `docs/page-turning-design` adds
**⑩**. Appending ⑩ here would conflict, and appending ⑪ on a branch where ⑩ does not exist
would leave a hole. So the text is here, ready to paste, and it lands as **⑪** if
`docs/page-turning-design` merges first and **⑩** if it does not.

> ⑪. **A page turn should say what is between the two pages, and today it says nothing.**
> The transition effect — the leaf's edges at rest and the fold that crosses during a turn —
> is designed in [`docs/design/page-transition.md`](design/page-transition.md), measured
> against a reference mushaf application at 430×932 CSS px. Two halves, sequenced apart.
> The **resting edge system** (§2) is what actually cures the floating leaf: no drop shadow,
> an asymmetric ≈20 px corner radius on the free side only, a 10 px fore-edge stack on the
> free side, the bound side bled off the screen, and a field the page is not. It is
> independent of every open gate and belongs with follow-up ⑩'s hardening list. The **fold**
> (§3–§4) is gated on follow-up ① and on a ceiling for the mounted set
> ([`backlog.md`](backlog.md) §2 ③). Its rule is the part worth reading: **a crease means the
> two pages face each other in the print, a gap means a leaf turned, sunk paper behind a
> dashed edge means the print has a leaf here and this build does not, and nothing at all
> means it was not a turn** — resolved by `foldBetween` in `packages/core` from `spreadOf`
> and the manifest, never by parity in a stylesheet, so a correction to the print's pairing
> corrects every fold at once. With three non-adjacent pages vendored, **every turn in the
> shipped build is a hole and no crease can be drawn until Loop 4b** — which is the design
> working, not a limitation. The visual half is the twin of follow-up ⑩'s §7 ④ (the turn is
> silent about the page it skipped) and they should land together. One human check is opened
> and it is ten seconds long: §7 ① — photograph any opening of a physical Madani mushaf and
> read whether the **right-hand** page number is even. `spreadOf` says it is; the reference
> application says it is not; one line in `pages.ts` settles it either way.

### 9.3 Proposed rows for `docs/decisions/desktop-vs-mobile.md`

Same collision — `docs/page-turning-design` adds rows 18–19 — so these are proposed, not
appended. They are 20–21 after that branch merges, 18–19 if it does not.

> | 20 | **What a turn between two *facing* pages does** | Cross-fades under a fold, like any other turn — one leaf is on screen and it changed | **Nothing at all** — both leaves of the `spreadOf` pair are already mounted and neither changed; only which leaf is live moves | Not a taste split and not a desktop feature: the same rule (`foldBetween`) reading a screen that already shows more of the book. A crease is drawn between facing pages, and on desktop it is drawn **permanently** by `PageSpread`'s gutter rather than transiently by a fold. Animating a leaf that did not turn is the failure. `page-transition.md` §3.5 |
> | 21 | **What is drawn between two pages during a turn** | A 28–30 px band whose fill states the relationship: crease / gap / sunk-and-dashed / nothing | **The same band, sweeping the whole spread**, since a turn that leaves the pair changes both panels | The rule is identical; only the extent differs, and it differs because the desktop turn changes two leaves where the phone's changes one. The predicate is `foldBetween` in core at both widths — decision row 9's "encoded once" applied to the fold. `page-transition.md` §4 |

### 9.4 What blocks what

| this | blocked by | why |
| --- | --- | --- |
| §2 resting edge system | **nothing** | CSS + one attribute. Wants `page-turning.md` §7 ①②'s geometry fixes first only because they touch the same files. |
| `foldBetween` + unit tests | **nothing** | Pure core. Buildable today; its output is unreachable today, which is fine. |
| The fold element and its sweep | `PLAN.md` follow-up ① (perf verdict) | Decides whether the cross-fade under it is affordable, and whether an outgoing page is even rendering. §5.2 gives the constrained fallback so the answer is a configuration, not a redesign. |
| §3.4's one-fold-ever + one-visible-host rules | `backlog.md` §2 ③ (mounted-set ceiling) | Cheap today only because the set can never exceed three. |
| Drawing a crease or a gap at all | **Loop 4b** | No two vendored pages are adjacent, so `"crease"` and `"gap"` have no reachable input. |
| The golden shot of a right-hand leaf | **Loop 4b** | All three vendored pages are left-hand leaves (§2.3). |
| §7 ①'s phase check | **a human and a physical mushaf** | Ten seconds, no hardware, and it decides whether every crease is drawn one leaf off. |
