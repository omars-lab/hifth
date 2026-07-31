# Turning a page: the leaf, the field it sits in, and the gesture that changes it

> "I don't currently like the floating pages."

**Status:** design of record for the page/stage presentation and the page-turn gesture.
Research and measurement are complete; **nothing here is implemented.** The hardening list
in §7 is the part with a schedule attached (PLAN follow-up ⑩); the rest waits on the perf
verdict named in §5.

## How to read this, and what it is not

`docs/design/` is the document you consult *before* touching a feature —
[`desktop.md`](desktop.md) says why, and this file follows its shape: constraints, the
shape they decided, what stays open. The running per-decision table lives in
[`docs/decisions/desktop-vs-mobile.md`](../decisions/desktop-vs-mobile.md) and is not
duplicated here; §3 and §4 add rows 18–19 to it and this file is the prose behind them.

Two conventions this document inherits rather than re-decides:

- **The RTL page-turn direction is pinned** ([`loop-1.md` §RTL page-turn
  convention](../decisions/loop-1.md)): dragging the page left→right advances to
  the next page; `←` = +1, `→` = −1. §4 builds on it and, in one place, finds a seam in it.
- **The arrow-key precedence ladder is pinned**
  (`packages/core/src/keymap.ts:1-38`). §7 ⑤ proposes an addition to it, not a change.

Everything below is either **measured** (a number, taken against a production `vite
preview` build, with the viewport stated), **cited** (a source, linked), or **inferred**
(marked as such). Where a claim needs a measurement nobody has taken, it says so and names
the measurement.

---

## 1. The problem, stated precisely

### 1.1 What "floating" is a description of

`apps/web/src/components/PageStage.module.css:31-54` styles the mushaf leaf as a **card**:

```css
.host {
  width: min(100%, var(--stage-page-cap, 62vh));
  max-width: 480px;
  filter: drop-shadow(var(--shadow-2));
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
}
```

…dropped into a field that is `display: grid; place-items: center` with `padding:
var(--space-4)` and a `radial-gradient(…, var(--paper-raised), var(--paper) 60%)`
background (`:1-20`). Elevation, a rounded corner, a raised fill, a soft vignette, and air
on every side. That is the Material card recipe applied to a bound leaf, and a bound leaf
is not a card: it has a spine edge it is attached along, it is never flat, and it does not
hover above the desk.

So the complaint is legible on its face. But taking it at face value would have produced a
restyle, and a restyle would have fixed the smaller half of the problem.

### 1.2 Interrogating it: the page is not floating in the centre, it is falling into a corner

The stage has **two centring mechanisms and they both fire.**

`.layer` is `display: grid; place-items: center` (`PageStage.module.css:24-29`), so the CSS
grid centres the host in the layer. Then `clampView` writes a transform whose value, for an
axis that fits, is `(available - scaled) / 2` — an **absolute top-left coordinate**
(`packages/core/src/view.ts:71-78`):

```ts
function holdAxis(available: number, scaled: number, value: number): number {
  if (!(scaled > 0) || !(available > 0)) return value;
  if (scaled <= available) return (available - scaled) / 2;   // ← absolute, not a delta
  return Math.min(0, Math.max(available - scaled, value));
}
```

`translate3d(0,0,0)` does not put the host at the layer's top-left. It puts it wherever the
grid already centred it. So the centring offset is applied **twice**, and the page ends up
flush against the far edge of the space it was supposed to be centred in.

Measured on p7, at rest, z=1, production build (numbers are the gap between the host box
and the layer box, in CSS px):

| viewport | left | right | top | bottom | where the leaf actually sits |
| --- | --- | --- | --- | --- | --- |
| 390 × 844 | 0 | 0 | 53.1 | 0.1 | flush against the **bottom** |
| 834 × 1194 | 322 | 0 | 208.9 | −0.1 | **bottom-right corner** of a vast field |
| 1023 × 900 | 511 | 0 | 0.1 | −0.1 | flush **right**, full height |
| 1440 × 900 | 245.8 | −0.2 | 0 | 0 | flush **left** — against the spine |
| 1440 × 700 | 974 | 0 | 0 | 0 | flush **left**, 974 px of empty stage |
| 1920 × 1080 | 432 | 0 | 92.9 | −0.1 | bottom-right |

The arithmetic closes exactly. At 390 × 844: layer 358 × 624, host 358 × 570.7. Grid
centring contributes `(624 − 570.7) / 2 = 26.65`; the computed transform reads
`matrix(1,0,0,1,0,26.5)`; the observed top gap is 53.1 ≈ 26.65 + 26.5. At 1440 × 900: layer
672 wide, host 426.4; grid contributes `(672 − 426.4) / 2 = 122.8`, the transform reads
`translateX(123)`, the observed left gap is 245.8. Two halves, added.

A phone escapes the horizontal case only because the host is `width: min(100%, …)` and
100% resolves to the layer — so on a phone `host.width === layer.width`, the slack is zero,
and zero doubled is zero.

**The vertical case escapes too, but only by falling into the other failure.** The table
above was measured in a state where the stage is *taller* than the leaf — there the layer
keeps its `block-size: 100%`, there is real vertical slack, and the slack doubles. Shorten
the stage past the leaf's height and the layer's automatic minimum size takes over: the
layer grows to the content, `layer.height === host.height`, the slack is zero, and the
doubling vanishes. Nothing is fixed by that. The excess is now outside the stage and
`overflow: hidden` cuts it, which is §1.3.

An independent measurement pass, run against the same production build in a
shorter-stage chrome state, recorded exactly that: at 390 × 844, `layer.height ===
host.height === 570.7` against a 555.2 stage — **zero top gap, zero doubling, and 31.5 px
clipped instead**; at 1440 × 900, `gapLeft 245.8` against `gapRight −0.2`, reproducing the
horizontal doubling in the table above to the tenth of a pixel.

So the two faces are not independent defects and they do not co-occur at full strength.
They trade off along stage height, and **which one a given reader meets depends on how much
chrome is showing** — the coach strip, the offline-storage notice, the page bar. Both tables
in this section are therefore true of the state they were taken in, and neither is the
number to quote on its own. The common root is the one thing worth carrying forward: the
layer is not the viewport, and `holdAxis` returns an absolute where the grid has already
placed one.

This is a regression of a defect the repo has already fixed once. `centerCurrent`'s comment
says so in as many words (`apps/web/src/components/PageStage.tsx:344-354`):

> "The hand-rolled `(stageWidth - contentWidth) / 2` that used to live here read the *stage*
> rect — padding included — and translated a host the stage had already centred, so the page
> sat one padding to the right of centre with its far edge flush against the screen."

The fix deleted the arithmetic from `centerCurrent` and delegated to `clampView`. But
`clampView` contains **the same expression**. Moving the measurement from the stage rect to
the layer rect removed the 16 px padding term; it did not remove the centring term. The
comment at `PageStage.tsx:347-349` — "clampView answers 'centred' for an axis that fits —
so asking for the origin and letting the clamp have it is the whole reset" — is the false
premise, stated confidently, in the file.

### 1.3 The same root cause has two more faces

**The layer is not the viewport, so part of the page cannot be reached.** *(Fixed — §3.1 ②;
the reading below is what it was. Post-fix, `.layer` is the stage's content box on both axes
at every viewport: measured at 320 × 568 the layer is 273.8 px tall against a 459.1 px leaf,
so the 185.3 px of overhang is now slack the reader pans over rather than paper cut off
behind `overflow: hidden`.)* `.layer` is
`block-size: 100%` with no `min-block-size: 0` and no `overflow`
(`PageStage.module.css:24-29`). A grid item's automatic minimum size is its content's
min-content size, so when the host is taller than the stage the *layer grows past the
stage* and the excess is cut by the stage's `overflow: hidden` (`:17`). `measureFit` reads
the **layer** (`PageStage.tsx:194-207`), so `clampView` is told the page fits, forces the
"centre", and refuses to pan. Measured, returning-reader state (coach dismissed, storage
persisted):

| viewport | page hidden below the stage | visible | can the reader drag to it? |
| --- | --- | --- | --- |
| 320 × 568 | 108.4 px | 76.4 % | **no** — a 200 px upward drag moves nothing |
| 320 × 658 | 18.4 px | 96.9 % | no |
| 1440 × 700 | 195.9 px | 71.7 % | no |

With the offline-storage notice showing — an ordinary first-run state, not a contrivance —
iPhone 13 hides 94.3 px (83.5 % visible) and 320 × 568 hides 271.9 px, leaving **40.8 % of
the leaf reachable**. On a mushaf page that is roughly the bottom six of fifteen lines.

An independent pass measured **169.4 px hidden at 320 × 568 — about 37 % of the leaf — with
a 200 px upward drag refused** (the transform read `0.0625` before and after). That sits
between the two rows recorded here, which is the point: the hidden height is a function of
how much chrome is up, and across the ordinary range of first-run and returning-reader
states it spans roughly **108–272 px at 320 × 568**. No single figure characterises it. What
does not vary is the part that matters — *whatever* is hidden cannot be dragged to, because
`measureFit` reads the layer and the layer grew to match the content.

**Zoom does not anchor where the fingers are.** `onPinch` computes its focal point against
the **stage** rect (`PageStage.tsx:647`, `px = ox - rect.left`) while `view.x/y` are
layer-relative and the host is additionally offset by the grid. Three coordinate spaces,
one transform. Measured by marking a glyph, putting the cursor exactly on it, and zooming
1.0 → 1.6:

| viewport | landmark should move | landmark moved |
| --- | --- | --- |
| 390 × 844 | 0, 0 | −9.4, −25.2 |
| 1440 × 900 | 0, 0 | −7.3, −9.3 |

The horizontal error is the stage's 16 px padding times `k − 1` (`16 × 0.6 = 9.6`); the
vertical error at 390 is `(16 + 26.65) × 0.6 = 25.6`, i.e. the padding **plus the
double-centred offset**. The drift is the same bug, seen through the zoom.

*(The second term is gone — §3.1 ①/② removed the double centring, and the vertical error
should now be the padding alone, the same `16 × (k − 1)` as the horizontal. The numbers in
that table have not been re-measured, so treat them as the pre-fix reading; §7 ⑨ is still
open and owns re-measuring them. What does not change is the conclusion: one focal point
computed against the stage rect, applied to a transform expressed against the layer, cannot
anchor.)*

### 1.4 The verdict on the framing

**"Floating" does not survive as a styling complaint, and it does survive as a report.**

Three things are true at once, and they compound:

1. The leaf is **mis-positioned** — off-centre by construction, flush to an edge, on every
   viewport where the page is narrower or shorter than the space around it (§1.2).
2. The leaf is **card-styled** — shadow, radius, raised fill — against a vignette whose
   inner stop is `--paper-raised`, *the page's own colour* (`PageStage.module.css:18-19`,
   `tokens.css:17`). So the top edge of the leaf has no contrast with the field behind it,
   and the only thing separating page from stage is a downward Material elevation halo. A
   card lit from above, hovering, with no edge.
3. `docs/design/desktop.md:241` already says the leaves should carry **"no border, no card,
   no elevation; the paper token is the background it has always been."** The code
   contradicts the design of record. Nobody decided to make it a card; it drifted.

An off-centre object with a drop shadow and no visible edge reads as *adrift*. Correcting
the coordinate model removes "adrift"; removing the card removes "floating". Doing only the
second would leave a flat page still sitting in the wrong place.

### 1.5 The constraint that decides everything downstream

**Huffaz navigate by page-image memory.** The Madani mushaf is 604 pages of 15 lines each;
every page begins and ends on a complete ayah, and a hafiz recalls "the second line from
the bottom on the left-hand page" as a spatial fact. This is a universal folk and
pedagogical claim, and — stated plainly — **there is no direct experimental test of it in
the literature.** What exists is strongly consistent supporting work (§2.2). Treat it as a
design axiom this project has already adopted, not as a finding.

Its consequence is sharp: **anything that changes where an ayah sits on screen between
visits is actively harmful.** That is a constraint on the *resting* presentation first
(§1.2 is a violation of it — the page's position depends on viewport slack) and on the
*transition* second (§3).

---

## 2. What the research found

Sources are linked. Claims are labelled **[cited]**, **[secondary]** (trade press or
community only), or **[inference]** (mine, no source).

### 2.1 The physical book and the mushaf

**[cited]** The Madani mushaf is 604 pages, 15 lines per page, and **every page begins and
ends on a complete ayah** — verified against two independent Qur'an APIs. The binding is
RTL: the spine is on the right and the next page is reached by turning leftward.

**[corrected — see below]** This section previously said that even page numbers fall on the
right-hand leaf and odd on the left, labelled **[cited]**. That label was wrong: the Qur'an
APIs consulted return the *page number* a juz' begins on, and no API returns which side of
an opening a leaf sits on. The side was an inference — from "every juz' begins on a
right-hand page" plus the observation that juz' 2, 3, 4 … begin on pages 22, 42, 62, all
even — and it was recorded as an observation.

**[cited — direct observation of a physical KFGQPC Madani mushaf]** **Odd page numbers fall
on the right-hand leaf, even on the left.** Al-Fatiha is page 1 and sits on the **right**,
facing the first page of Al-Baqarah — page 2 — on the **left**. Openings therefore pair
`(odd, odd + 1)` with the odd page on the right, and the whole print divides into exactly
302 complete openings with no orphan leaf at either end. The previous phase produced two
orphans, page 1 and page 604, which should have been the tell.

Two things survive the correction unchanged, and it is worth being explicit that they do,
because both are pinned elsewhere. **The lower page number is still on the right** — 1 faces
2, 21 faces 22 — so `PLAN.md`'s desktop rule is untouched. And the RTL turn direction is
untouched. What moves is only *parity*, and `spreadOf` in `packages/core/src/pages.ts`
implements the old phase, so it is one leaf out and every spread it has ever drawn has
paired the wrong two leaves. That is a defect, not a preference, and it is corrected
alongside this document.

**[cited]** Pages carry juz'/hizb markers in the margin and the page number at the foot.
These are wayfinding, and they are part of the page image.

**[inference]** A leaf in a bound codex is never flat: it curves toward the spine, so the
gutter-side margin is foreshortened and the outer edge is the flat part. The current
presentation gives the leaf four equal, square, shadowed sides — it is a loose sheet, not a
bound one. This is a real difference from the physical object, but it is **not** the defect
the complaint is about, and §8 explains why this document does not propose simulating it.

### 2.2 Paging vs scrolling: what the evidence actually supports

This is the strongest-evidenced part of the research and it points somewhere slightly
unexpected.

**[cited] Lovelace & Southall (1983)**, *Memory & Cognition* 11(5):429–434,
doi:10.3758/BF03196979 — the single most useful paper here and almost never cited in this
debate. N=60, three conditions: continuous scroll / continuous scroll **with visible page
breaks, page numbers and rules** / a real bound booklet. Recall: .22 continuous vs .29
continuous-with-pages, t(38)=2.14, η²=.108 — and continuous-with-pages was **statistically
indistinguishable from the physical booklet** on recall, location accuracy, and every
conditional probability. Experiment 2: reinstating within-page location at test raised
recall ~38 %, t(38)=3.30, η²=.223. **The harm comes from losing page boundaries, not from
scrolling as a mechanism.** The paper closes by citing Stratton (1917) on the *Shass
Pollak*, who could name any word in the Talmud from a page number and a position on the
page — memorisation-by-page-image, inside a peer-reviewed source.

**[cited] Sanchez & Wiley (2009)**, *Human Factors* 51(5):730–738,
doi:10.1177/0018720809352788. Paged beat scrolled on comprehension (2.50 vs 1.40 concepts;
format R²=.31, β=.52, p<.01), and within scrolling, working-memory capacity predicted
comprehension (β=.57) while within paging it did not (R²=.00). Their mechanism, verbatim:
*"scrolling pages lack a static 'place on the page' location for information."* Their
caveat is the constraint: pagination helps when the page breaks are **meaningful**. Piolat
et al. (1997) split pages by line count and got a weaker, partly non-significant effect;
Sanchez & Wiley preserved section boundaries and got a large one. **The mushaf page is the
maximally meaningful boundary** — it is the unit the memoriser already holds.

**[cited] Delgado et al. (2018)**, *Educational Research Review* 25:23–38: 54 studies,
171,055 participants, pooled g = −0.21 for paper; the scrolling moderator was g = −.25 when
scrolling was needed vs −.13 when it was not — **but the moderating effect itself was not
significant.**

**[cited] The best counter-evidence, and it should be cited to stay honest — Salmerón et
al. (2024)**, *J. Educational Psychology*, doi:10.1037/edu0000830. Restricted to
**handheld** devices, the paper effect halves (g ≈ −.11) and, on navigation: *"no difference
was found between horizontal paging and vertical scrolling"* on handhelds. They note only 5
effect sizes used scrolling.

**Honest bottom line:** paging beats scrolling on desktop-era interfaces (well replicated);
on modern handhelds the difference is untested-to-null. What *is* well supported is that
**visible page boundaries carry the effect** — and Lovelace & Southall showed the boundary
can be kept inside a scroll. This app is already paginated and should stay paginated, but
the evidence for that is "the boundary is load-bearing", not "scrolling is bad".

### 2.3 The page curl: what happened, and why

**[cited]** The curl was an iPad-launch feature (iBooks, April 2010) and an OS-level private
API before it was a public one; `UIPageViewController.TransitionStyle.pageCurl` still
exposes **no duration property and documents no timing**.

**[cited]** Apple **removed** the curl in iOS 16 (Sept 2022), replacing it with a slide, and
**restored it as an option** in iOS 16.4 (Feb 2023) after visible user objection — the
Themes & Settings panel then offered Curl / Slide / None. *(The brief's premise that this
happened in iOS 10 is wrong; correcting it here so nobody re-derives it.)* Whether Curl is
now the default could not be resolved against an Apple primary source — **unverified.**

**[cited]** `turn.js`, the canonical web page-flip library, has 34 commits total, 385 open
issues, is a jQuery plugin, and declares support for "Chrome 12, Safari 5, Firefox 10, IE
9". It is not a viable dependency.

**[cited] There is no published research showing the curl harms reading.** What can be
evidenced is: the iOS 7 flattening of the design language (2013); Apple's own HIG now saying
*"generally avoid adding motion to UI interactions that occur frequently"* and *"let people
cancel motion … especially if they have to experience the animation more than once"*; and
WebKit's accessibility guidance naming "dimensionality / plane shifting (2.5D)" and
peripheral horizontal motion as vestibular trigger classes.

**[cited]** In the Qur'an-app space specifically: **no serious mushaf application examined
in source uses a page curl.** quran.com's web reader is a virtualized vertical scroll;
`quran_android` and `quran-ios` both use horizontal pagers. Google Play Books retains a "3D
effect for page turns" toggle, so the aesthetic constituency is real, but it is a toggle.

**[inference]** The curl did not lose on evidence. It lost on fashion, then on
frequency-cost ergonomics. The defensible position is *offer it, don't default to it* — and
§8 explains why this document does not even propose offering it yet.

### 2.4 Duration and easing

**[cited]** Material 1, the only major guidance that speaks directly to full-screen
transitions: 300 ms typical on mobile, 375 ms for large complex full-screen transitions,
**400 ms is where it starts to feel slow**, and — directly relevant — **150–200 ms on
desktop**, because "complex web transitions often result in dropped frames". Material 2:
"the shortest duration possible that isn't abrupt"; dialog fade **in 150 ms / out 75 ms**;
exits always shorter than entrances.

**[cited]** NN/g (Laubheimer 2020): 200–300 ms for substantial screen changes; 100–400 ms
overall; *"at 500 ms, animations start to feel like a real drag."*

**[cited]** CSS View Transitions Level 1's UA stylesheet sets `animation-duration: 0.25s`,
and the spec calls the out-of-the-box result *"the default transition of a quick
cross-fade."*

**[cited] Apple publishes no durations at all.** The widely-repeated "0.35 s
UINavigationController push" is folklore with no Apple source. The only shipping paginated
reader found with a documented default is Adobe's eCatalog viewer: `"slide,0.3"` — 300 ms.

**[inference]** For a full-viewport turn the defensible band is 250–350 ms on mobile and
~200 ms on desktop. For an **opacity-only** cross-fade the band is much shorter —
100–150 ms — supportable from NN/g's "100 ms is the lower end of perceivable motion" plus
Material 2's 150/75 dialog fade, but no primary source specifies a cross-fade duration for
a page turn. This is a judgement call and is labelled as one.

### 2.5 Reduced motion, and what the standards actually require

**[cited]** WCAG's normative definition: *"Motion animation does not include changes of
color, blurring, or opacity which do not change the perceived size, shape, or position of
the element."* **An opacity cross-fade is not "motion animation" under WCAG at all.**

**[cited]** WCAG 2.3.3 (Animation from Interactions) — the criterion that names
page-flipping — is **Level AAA**. WCAG 2.2.2 does not apply: it governs content that starts
*automatically* and lasts over five seconds.

**[inference, and worth stating plainly] no Level A or AA success criterion governs
page-turn animation.** Honouring `prefers-reduced-motion` here is voluntarily meeting a AAA
bar, which this repo already does (`tokens.css:155-159` zeroes all three duration tokens).

**[cited]** The correct reduced-motion response is **replace, not remove.** MDN: the setting
means an interface that *"removes, reduces, or **replaces** motion-based animations"*.
Apple's HIG names the substitution explicitly: *"replacing transitions in x-, y-, and z-axes
with fades to avoid motion"*, and iOS does exactly that itself. WebKit's James Craig
(2017 — **not** Dean Jackson; the attribution is commonly wrong): *"removing the animation
entirely may make the interface confusing or unusable … consider serving an alternate,
simpler animation."*

**[cited]** WCAG **2.5.1 Pointer Gestures is Level A** and requires that any path-based
gesture have a single-pointer alternative. This app already has one: the page bar's visible
prev/next buttons (`apps/web/src/components/PageSlider.tsx:149-161, 217-225`). A
swipe-to-turn is therefore permissible; it would not have been without them.

### 2.6 Gesture conflict in zoom-capable readers

**[cited]** The convergent pattern across PDF and comic readers is **turn-only-at-fit-zoom**:
while zoomed in, a horizontal drag pans; the turn is reached by panning to the edge and
continuing (edge handoff), or by an explicit control.

**[cited]** Xodo preserves **zoom level and scroll position across a page turn**. For a
mushaf this is the most transferable idea in the whole survey, because mushaf pages are
geometrically congruent: same viewBox, same 15 lines, same margins. A reader zoomed into
line 4 who turns the page should still be looking at line 4.

**[cited]** Mihon/Tachiyomi exposes this as two named settings — `navigateToPan` (a tap in a
turn zone pans first if there is pan left to do) and `zoomStart` (where a new page opens).

**[cited]** Tap zones are near-universally **asymmetric** and the asymmetry is a frequency
argument, not a handedness one: Kindle's EasyReach gives ~80 % of the screen to *next* and a
narrow left strip to *previous*; KOReader's defaults are literally `DTAP_ZONE_FORWARD =
{x=1/4, w=3/4}` and `DTAP_ZONE_BACKWARD = {x=0, w=1/4}`. Chrome placement diverges: Kindle
and KOReader put it on the **edges** (top/bottom bands), Kobo and Instapaper put it in the
**centre**. There is no single convention to inherit.

**[cited]** Instapaper (2010) is the best published rationale: top/bottom zones with the
bottom larger *"since 'next page' is a much more common action"*, and a deliberate central
dead zone because *"paging should be deliberate, never accidental."*

**[cited]** A **two-finger** swipe-to-turn is unproven and would violate WCAG 2.5.1 as a
sole mechanism.

**[cited]** iOS 13.4+ edge-gates `preventDefault` on the back-swipe: a touch beginning within
~20 px of the leading screen edge is contended by Safari's interactive back gesture. Under
RTL, the *forward* page turn (finger moving rightward) begins near the **left** edge — which
is precisely that zone. This is a real hazard for a swipe-to-turn and §4 handles it.

**[cited]** Direction belongs to the **book**, not the UI locale: EPUB spines, Material's
"don't mirror physical objects" rule, KOReader's per-document setting. `quran-ios` pins its
pager `.rightToLeft` unconditionally and restores the ambient direction for content.
`quran_android` forces LTR and hand-reverses the index — a warning, not a model.

**[cited]** In an RTL scroll-snap container, never read or write `scrollLeft`: the sign
convention differs across engines and specification revisions.

### 2.7 Screen readers

**[cited]** The ARIA Authoring Practices guidance for paged content: announce the change via
`aria-live="polite"`, and **next/previous controls must not move focus**. This app already
has `LiveAnnouncer`/`useAnnouncer` and already announces (`App.tsx:403-436`). §7 ④ is about
*what* it says, not whether it speaks.

---

## 3. The recommendation

### 3.1 Mobile

**Presentation.** Make the leaf a leaf.

1. **One centring mechanism, not two.** Delete `place-items: center` from `.layer` and let
   `clampView` be the only thing that positions the host — the code already believes it is.
   The alternative (keep the CSS centring and make `holdAxis` return a delta of 0 for a
   fitting axis) is wrong because `holdAxis` also has to produce legal values for the
   *overflow* regime, which are genuinely absolute; splitting one function across two
   coordinate conventions is how this defect got here. **Layer: `packages/core` keeps
   `holdAxis` exactly as it is; `apps/web` drops the CSS centring.** ~~This is the whole
   fix.~~ **Done, and that last sentence was wrong** — deleting the centring alone moves the
   leaf 240 px *past* the layer's right edge, because the grid's default `justify-items:
   normal` in a `dir="rtl"` subtree lays the host out flush to the inline start, which is
   the right. `place-items: center` had been hiding that. See §7 ① for the correction and
   the invariant that replaced it.
2. **`.layer` gets `min-block-size: 0`** so it stops growing past the stage, and
   `measureFit` becomes truthful without changing. **Done** — §7 ①.
3. **Drop the card.** No `border-radius`, no `filter: drop-shadow`, no `background:
   --paper-raised` on `.host`. This restores `docs/design/desktop.md:241` — it is not a new
   opinion, it is the design of record. **Done, except the last clause, which was wrong.**
   The shadow and the four equal corners went; the `--paper-raised` background stayed, and
   had to. The vendored page SVGs carry **no background rect** — open `7.svg` and it is
   glyph paths and nothing else — so `.host`'s background is not a card's fill sitting on
   top of the paper, it *is* the paper. Removing it does not reveal a page underneath; it
   leaves ink on the field. The defect this clause was aiming at is real and is fixed by ④
   instead: the field was the page's own colour, so the leaf had no edge. See
   `page-transition.md` §2.1.
4. **Give the field a colour the page is not.** The stage's vignette currently starts at
   `--paper-raised`, the page's own fill. Use `--paper-sunk` (`tokens.css:18`) for the field
   so the leaf's edge is an edge. A leaf on a desk is defined by its boundary, not by its
   shadow. **Done** — and it is doing ③'s job as well as its own.
5. **The leaf fills the field.** With centring fixed and the card gone, the remaining air is
   the stage's 16 px padding, which is a margin, not a float. **Done, and now asymmetric**
   — zero on the bound side, so the leaf runs into the binding rather than holding a margin
   against it (`page-transition.md` §2.4).

**Transition: a short opacity cross-fade, ~120 ms, and no slide.**

This is the recommendation and it is deliberately the least dramatic option on the table.
Four independent reasons converge:

- **Transform is taken.** `.host`'s `transform` is the *view* — pan and zoom, written
  imperatively on every frame through one path (`PageStage.tsx:209-221`). A slide that also
  wants to translate the host must either compose into that same matrix (destroying the
  single-write-path invariant that makes the stage fast) or add a wrapper element.
  **`opacity` is the only free channel.**
- **The pages are already stacked.** `.layer > .host { grid-area: 1 / 1 }`
  (`PageStage.module.css:57-59`) and the turn is already a `display` toggle between siblings
  in one grid cell (`PageStage.tsx:275-283`). A cross-fade needs the display toggle to
  become an opacity toggle. That is the entire structural change.
- **[inference] A horizontal slide moves the page image sideways, which is the one motion
  that fights page-image memory** (§1.5). A cross-fade changes *what* is on the page without
  changing *where anything is*. I have no citation for this; it follows from the axiom.
- **WCAG does not classify opacity as motion** (§2.5), so the cross-fade needs no
  reduced-motion variant to be compliant — though it should still shorten to 0 under
  `prefers-reduced-motion` because the tokens already do.

**Direction cue.** A pure cross-fade carries no direction. Two options, in order of
preference:

- **(a) A `.leaf` wrapper per page**, owning `opacity` and a **≤16 px** `translateX` in the
  direction of travel, while `.host` keeps owning the view transform. Two elements, two
  transforms, no composition problem. 16 px is small enough that no ayah's remembered
  position is meaningfully disturbed and large enough to read as directional — this is the
  same trick Kindle's e-ink "page turn animation" uses (a directional partial-refresh fade,
  **not** a slide).
- **(b) No direction cue in the stage at all.** The page number in the header and the page
  bar's thumb both move, and the announcer speaks. This is cheaper and defensible; it is the
  fallback if (a) measures badly.

**Rejected alternatives, and what each would have cost:**

| Alternative | What it would cost |
| --- | --- |
| **Page curl** | A 3D transform per frame on a layer whose backing store is a rasterized 170 KB SVG, forcing re-raster at every curl angle — the exact risk backlog ① exists to measure, and the measurement has not been taken. No mushaf app in the survey ships one (§2.3). It also encodes a spine on a fixed side, and this build's spread has a hole where the facing leaf should be. Rejected on cost *and* on honesty. |
| **Full horizontal slide** | Requires a wrapper anyway, moves the page image across the reader's field (§1.5), and — the specific problem — **cannot honour `loop-1.md`'s convention.** Loop 1 pinned *both* "drag left→right = next" *and* "the next page enters from the right". Those are book-physics (the current leaf peels rightward off a right-hand spine, revealing what is beneath). A slide carousel that moves rightward brings content in from the **left**. A slide must break half of a pinned decision; a cross-fade contradicts neither half. |
| **Vertical continuous scroll** | Would dissolve the page boundary, which §2.2 identifies as the load-bearing thing. It is also what quran.com's web reader does, so it is not eccentric — but this app's entire premise is the page as the addressable unit. Rejected on the evidence, not on taste. |
| **No transition (the status quo)** | Free, and honestly close to acceptable: the hard cut is currently what ships and nobody has complained about it. Its cost is that a turn onto a page that looks similar to the last one (which, in a mushaf, is every turn) gives no signal that anything happened. It stays the correct behaviour under `prefers-reduced-motion`. |

### 3.2 Desktop

`docs/design/desktop.md` §1's rule governs: *"a bigger screen is not a licence to add
features, it is room to stop hiding the ones that already exist."* Everything below is
already-existing behaviour made visible or made correct.

1. **The presentation fixes in §3.1 apply unchanged**, and they matter more here: the 1440 ×
   900 measurement in §1.2 shows the live leaf jammed **against the gutter** while the absent
   leaf's well — plain CSS, no transform — is correctly centred in its own column. The
   spread is visibly asymmetric about the spine, which is the one thing a spread exists to
   get right, and `e2e/desktop.spec.ts` cannot see it (§7 ②).
2. **A turn is one leaf, not two.** This is already decided —
   `desktop-vs-mobile.md` row 14 — and this document does not reopen it. The spread is a
   *view* of the book around the current page, not a two-page pager.
3. **The cross-fade applies to the live leaf only.** The facing leaf is either absent (today,
   always) or a different page that may not itself change. Cross-fading the whole spread
   would animate a leaf that did not turn.
4. **Plain wheel should turn pages; `ctrl`+wheel already zooms.** Measured: plain wheel over
   the stage currently does **nothing at all** (§7 ③). `docs/design/desktop.md` §6 documents
   keyboard and pointer and does not mention the wheel. A discrete, debounced wheel-to-turn
   (one turn per gesture, not per event) is the desktop equivalent of the swipe and costs no
   chrome. **It must be discrete, not scroll-snap** — a snap container in RTL requires
   reading `scrollLeft`, whose sign convention is not portable (§2.6), and a momentum scroll
   over 604 pages would mount an unbounded number of them (backlog ③).
5. **Duration ~200 ms on desktop** if the cross-fade is adopted, per Material 1's explicit
   desktop guidance (§2.4).

**Rejected for desktop:**

| Alternative | Cost |
| --- | --- |
| **Spread-level pager (turn two leaves)** | Contradicts row 14, and with three non-adjacent vendored pages it would mean turning two holes at once. |
| **Scroll-snap carousel** | RTL `scrollLeft` portability (§2.6) and unbounded mounting (backlog ③). |
| **On-hover page-corner affordance** | A new feature. Fails desktop.md §1's test: no mobile constraint put it out of reach. |

---

## 4. The gesture model

The hard constraint: the stage owns touch. `touch-action: none`
(`PageStage.module.css:13`) is mandatory, not cosmetic — without it the browser fires
`pointercancel` and native-scrolls out from under the gesture
(`PageStage.tsx:564-566`). Every gesture must be resolved inside our own classifier.

### 4.1 The free slot nobody noticed

**At z = 1 the *horizontal* pan gesture is already a no-op.** `holdAxis` forces the centre
for an axis that fits (`view.ts:76`), the leaf is `width: min(100%, …)`, so at z = 1 it
fills its layer across and there is no slack to roam over. Measured: a 150 px horizontal
drag at z = 1 on 390 × 844 changes the transform by **zero**.

**It is only the horizontal axis, and this section used to claim both.** "At z = 1 the page
fits both axes by construction" was written against the stage the app had mismeasured: with
`.layer` growing to its content (§1.3), an overflowing leaf reported as fitting and the
vertical pan was dead too — dead as a defect, not by construction. With the layer fixed, a
390 × 844 phone overflows vertically by 47.5 px at rest and the vertical drag is a *real*
gesture carrying the foot of the page. Whether it overflows is viewport-dependent and must
never be assumed: a Pixel 7, taller in CSS px, does not overflow at rest and does not pan.
`e2e/marquee.spec.ts:96` and `e2e/stage-fit.spec.ts` both branch on the measured overhang
rather than on the device.

So there is no conflict to resolve at fit-zoom **on the horizontal axis**, which is the only
axis a turn wants. The horizontal-drag slot is empty, and this is precisely the
`turn-only-at-fit-zoom` pattern §2.6 found everywhere. The vertical slot is *not* empty, and
the ladder below has to say so.

### 4.2 The ladder

`nextIntent` (`packages/core/src/gestures.ts:104-113`) is a **latched** classifier — the
first verdict owns the whole stroke, so a gesture never changes meaning mid-way. Add one
verdict, `"turn"`, and one input, `fitsAcross`:

```
1.  pointers ≥ 2                                       → "pinch"      (unchanged)
2.  held ≥ LONG_PRESS_MS before moving > TAP_SLOP_PX   → "marquee"    (unchanged)
3.  moved > TAP_SLOP_PX and fitsAcross and |dx|>2·|dy| → "turn"       (new)
4.  moved > TAP_SLOP_PX                                → "pan"        (unchanged)
5.  otherwise                                          → "tap"        (unchanged)
```

`LONG_PRESS_MS = 350`, `TAP_SLOP_PX = 8`, `PINCH_POINTER_COUNT = 2` are unchanged
(`gestures.ts:47-57`). Rules 1 and 2 keep absolute precedence, so **the marquee is never at
risk**: a hafiz who presses and holds to select is 350 ms into a hold before rule 3 can be
consulted, and rule 3 requires movement before the hold completes.

`fitsAcross` is `contentWidth * z <= stageWidth` — computable from the `StageFit` the stage
already measures once per stroke (`PageStage.tsx:579`). It belongs in `packages/core` beside
`clampView`, as a `viewFitsAcross(view, fit): boolean`. **Layer: L1.**

**It must not test the vertical axis, and it was written here as if it should.** The
predicate started life as `contentWidth * z <= stageWidth && contentHeight * z <=
stageHeight` — both axes — because §4.1 believed the leaf fit both at z = 1. It does not
(§4.1, corrected): a 390 × 844 phone overflows vertically by 47.5 px at rest, so the
two-axis form is **false at fit-zoom on the acceptance device** and the `"turn"` verdict
would never fire. The gesture would be dead on arrival, on exactly the device it is for, for
a reason no failing test would name — the ladder would simply fall through to `"pan"` and a
horizontal flick would go on doing nothing.

The one-axis form is also the *right* predicate rather than a repair: what rule 3 needs to
know is whether the horizontal drag slot is free, and that is a question about the
horizontal axis alone. A leaf can overflow vertically and still have nowhere to go sideways;
that reader has a live vertical pan **and** a free horizontal flick, and both should work.
The test that would catch a regression here is a `"turn"` latch asserted at z = 1 at 390 ×
844 — the viewport where the two-axis form fails and the one-axis form holds.

The `|dx| > 2·|dy|` guard is a proposal, not a measurement. **The measurement that would
settle it:** record `dx`/`dy` at the moment of latch across a set of real one-thumb strokes
on a 390 px phone and pick the ratio that separates intentional horizontal flicks from the
diagonal drift of a thumb pivoting at the base. 2:1 is the common default; it has not been
validated here.

### 4.3 Committing a turn

A latched `"turn"` stroke tracks the finger on the `.leaf` wrapper's `translateX` (bounded,
with rubberband past the ends) and commits on release when **either**:

- displacement ≥ 25 % of the stage width, **or**
- velocity ≥ a flick threshold in the same direction.

Otherwise it springs back. Both thresholds are conventional and **neither is measured
here**; the honest statement is that they need a device pass on the acceptance phone.

Direction follows `loop-1.md`: **finger moving rightward = next page.**

### 4.4 The iOS edge hazard

Under RTL the *forward* turn begins with a rightward finger movement, which most naturally
starts near the **left** edge — the zone iOS 13.4+ reserves for Safari's interactive back
gesture, where `preventDefault` is edge-gated (§2.6). Mitigation, in order:

1. **Rule 3 requires the stroke to begin more than 24 px from either vertical screen edge.**
   A stroke starting inside that band latches `"pan"` (horizontally a no-op at z=1) and the
   OS keeps its gesture. This costs a thin strip on both sides and costs nothing else, because the page
   bar's next/prev buttons remain the guaranteed path (§2.5, WCAG 2.5.1).
2. Do **not** attempt to defeat the back gesture. An app that eats the platform back
   gesture on an offline PWA is an app the reader cannot leave.

### 4.5 Zoom across a turn

Today, `goToPage` calls `centerCurrent()` unconditionally
(`App.tsx:434`, `PageStage.tsx:355-359`), which resets `{x: 0, y: 0, z: 1}` — **the zoom is
discarded on every turn.**

**Recommendation: carry the view across a turn unchanged.** Mushaf pages are geometrically
congruent (§2.1), so a reader zoomed into the third line of p7 who turns to p9 should be
looking at the third line of p9. This is Xodo's behaviour (§2.6) and it is a one-line change:
`goToPage` re-clamps against the new page's fit rather than resetting.

The exception is the hop, which has its own framing (`frameBboxToView`) and must keep it. The
distinction is *turn* vs *jump*: a turn is continuous reading and should preserve the view; a
jump to an arbitrary ayah is a relocation and should frame its target.

**Layer:** L1 gets `viewFitsAcross`; L2 gets the intent wiring, the `.leaf` wrapper, and the
`centerCurrent` call-site change.

### 4.6 What is *not* in the gesture model

- **No tap zones.** The stage's taps already mean "select this ayah" — the app's central
  gesture. Overloading a tap with "turn the page" would make the primary interaction
  positional, and §2.6 shows there is no agreed zone convention to inherit anyway.
- **No two-finger swipe.** Unproven, and it would fail WCAG 2.5.1 as a sole mechanism.
- **No edge-pan handoff** (pan to the edge, keep going, turn). It is a real pattern, but it
  requires overscroll state the clamp deliberately does not have, and the payoff — turning
  while zoomed — is better served by the page bar, which is on screen.

---

## 5. What it costs

**Mounting.** A vendored page is ~47 KB gz / ~170 KB raw inline SVG, and mounting one builds
a `Highlighter` (backlog ⑥; confirmed by measurement — `7.svg` transferSize 48,873,
decodedBodySize 170,107). **Any turn animation requires both pages mounted simultaneously,
and that is paying the mount cost twice.**

The honest accounting is that this cost is **already being paid**: the mounted set has no
ceiling (backlog ② ③, `App.tsx:288`), so both pages are already resident after the first
turn and stay resident forever. The cross-fade does not add a mount; it adds a **second
simultaneously-painted layer for ~120 ms**. That is a compositing cost, not a raster cost,
because both hosts are already rasterized.

**But this is exactly the interaction backlog ② names as unbounded**, and a turn animation
makes the unbounded set *visible* — two painted layers instead of one. If the perf verdict
(backlog ①) picks the `content-visibility` virtualization strategy, the outgoing page may be
`content-visibility: hidden` at the moment the fade starts, and the fade would force it back
into rendering for the duration. **This design does not presuppose which strategy wins.**
What it requires is a ceiling on the mounted set, which is backlog ② and is a prerequisite.

**Paint.** `filter: drop-shadow()` on the transformed host costs **~1.1 ms/frame more than
an identical `box-shadow`**. Measured, 90 scale-writes, run twice, 1440 × 900:

| | median | p95 | max |
| --- | --- | --- | --- |
| `filter: drop-shadow(--shadow-2)` | 9.4 / 9.4 | 12.2 / 11.2 | 22.3 / 22.6 |
| `box-shadow: 0 4px 16px rgba(38,32,26,.12)` | 8.3 / 8.3 | 10.3 / 10.2 | 11.6 / 10.4 |

They are visually identical here because the shadow's alpha source is an opaque rounded
rect. loop-1's emulated frame baseline was ~8.3 ms — **exactly the `box-shadow` number**,
which means the current `drop-shadow` has been costing the app its whole measured headroom
during pan and zoom. §3.1 removes the shadow entirely, so this becomes moot; if any shadow
survives review, it must be `box-shadow`.

**Bundle.** Zero. No new dependency: `@use-gesture` already supplies the drag stream, the
cross-fade is CSS, and the new core function is a comparison. Current budget position is
106.6 KB gz of 150 (backlog ⑤).

**Dependencies on open decisions:**

| Depends on | Which | Why |
| --- | --- | --- |
| The on-device perf verdict | backlog ① | Decides whether a second painted layer is affordable on a mid-tier Android, and whether the outgoing page is even rendering. |
| A ceiling on the mounted set | backlog ② ③ | The cross-fade is only cheap because both pages are already mounted; that is currently true by accident, not by design. |
| Vendoring the remaining 601 pages | Loop 4b | Every turn today crosses an absent page (§7 ④). The gesture model is testable with three pages; the *feel* is not. |

Nothing in §7 depends on any of these. The hardening list is independently shippable.

---

## 6. How we would know it worked

This repo verifies new behaviour by **inducing the failure and reverting**, so each claim
below names the induced failure and what it would look like.

| Claim | Test | Induced failure |
| --- | --- | --- |
| ~~The page is centred in the stage on **every** viewport~~ · **done** | `expectHeld` in `e2e/stage-fit.spec.ts` asserts `\|before − after\| ≤ 1` **against the stage** on an axis the leaf fits, and coverage of the layer on an axis it overflows; the file runs on `desktop` as well as the two phones | Restoring `place-items: center` fails it at 1440 × 900 with 261.8 px before the leaf and 15.8 after — 245.8 / −0.2 against the layer, the figures in §7 ① reproduced. Removing `justify-items: left` fails it with 384.6 / −107.0. |
| ~~No part of the page is unreachable~~ · **done** | A 320 × 568 case that sets its own viewport: the layer is no wider than the stage, the leaf genuinely overflows (the premise, asserted so "reachable" cannot be vacuous), and a 400 px upward drag — more than the overhang has ever measured — brings the foot of the page exactly to the fold | Removing `min-block-size: 0` fails on "the layer grew past the stage" before the drag is even attempted, because layer and host become the same box. Written against containment rather than a pixel count because the overhang is a function of how much chrome is up (§1.3). |
| Zoom anchors under the pointer | Mark a glyph, `ctrl`+wheel with the cursor on it, assert its client rect centre moves < 2 px | Change `onPinch`'s rect from the host's containing block back to the stage. Fails by ~9 px horizontally; vertically by the same ~9 px now that the double centring is gone — the ~25 px in §1.3 was the padding plus the centring term and has not been re-measured. |
| The turn gesture never eats a marquee | `e2e/marquee.spec.ts` must still pass, plus a new case: press, hold 400 ms, then drag horizontally 200 px → a marquee, not a turn | Reorder the ladder so rule 3 precedes rule 2. The hold-then-drag case turns the page and the marquee never appears. |
| The turn gesture is inert while zoomed | Zoom to 2×, drag horizontally 200 px → the page pans and the page number does not change | Drop the `fitsAcross` guard. The page turns mid-zoom and the reader loses their place. |
| The turn gesture is **live** at fit-zoom on the acceptance device | At 390 × 844, z = 1, a horizontal flick latches `"turn"` — the viewport where the leaf overflows *vertically*, so a predicate that tests both axes would refuse | Restore the two-axis `fits`. The flick falls through to `"pan"`, the page never turns on a phone at rest, and nothing else in the suite notices (§4.2). |
| Every landing is announced by number | See §7 ④ | Revert `stepPage` to announcing `pageN` for a skipped landing. The live region says "Page 9" after a turn from 7 and never mentions 8. |
| Reduced motion removes the fade | With `prefers-reduced-motion: reduce`, sample the host `opacity` 40 ms after a turn: exactly 1 | Hard-code the duration instead of reading `--dur-fast`. The sample reads a fractional opacity. |

The `stage-fit.spec.ts` header comment (`:31-52`) will need rewriting as part of this — see
§7 ②. It currently asserts a false explanation, and a false explanation in a test is worse
than no comment, because it tells the next reader the invariant is proved.

---

## 7. Hardening

Ordered by severity. **Confirmed** = reproduced against a production `vite preview` build
with the viewport and numbers given. **Suspected** = read from the code, not reproduced.

### ① Double centring — the page is flush against an edge on most viewports · **confirmed**

`packages/core/src/view.ts:76` returns an absolute top-left coordinate for a fitting axis;
`apps/web/src/components/PageStage.module.css:24-29` has already centred the host with
`place-items: center`. Both apply.

**Reproduce:** open `#/hafs-kfqc/p7` at 1440 × 900; measure the host box against the layer
box. Left gap 245.8, right gap −0.2 — independently reproduced twice, to the tenth of a
pixel, and the reliable repro. At 834 × 1194: left 322, top 208.9 — bottom-right corner.
The **horizontal** doubling is the stable one, because desktop width always leaves the host
capped well inside the layer.

The **vertical** doubling is conditional and will not reproduce on demand: it needs a stage
taller than the leaf. At 390 × 844 it shows as top 53.1 / bottom 0.1 in a light-chrome
state, and as nothing at all in a heavier one, where the layer has instead grown past the
stage and §1.3 is what you are looking at. If you are reproducing this on a phone and see no
top gap, you have not failed to reproduce it — you are in the other state. Check
`layer.height` against `host.height` to tell them apart.

**Severity:** highest. It is the visible complaint, it defeats the app's own stage-geometry
guarantee (`PLAN.md:523`), and it violates the page-image-memory axiom (§1.5) because where
the page sits depends on how much slack the viewport happens to have.

**Fix:** §3.1 ①. **Done** — and it was not one CSS declaration, for a reason worth keeping.

Deleting `place-items: center` on its own made it *worse*: the leaf left the layer entirely,
sitting 240 px past its right edge at 1440 × 900. The centring had been hiding a second
thing. `translate3d(123px, 0, 0)` is a **physical** offset — 123 px to the right — while the
layer's grid sits inside `dir="rtl"`, where the inline **start** edge is the right one. With
no alignment declared, the host was laid out flush right and then translated further right.
`place-items: center` had been overriding that default and making the two conventions agree
by accident, which is the same shape as the defect itself: a mechanism doing a job nobody had
written down.

`.layer` therefore takes `justify-items: left` — the physical keyword, not `start`, because
the transform it has to agree with is physical — and `align-items: start`, which is the same
argument on the block axis and additionally stops a leaf *shorter* than the stage being
stretched by the default `stretch`, which would feed `clampView` a `host.clientHeight` the
page does not have.

The general lesson for §3.1 and for anything downstream of it: on this stage, *any* CSS that
positions the host is a second coordinate system competing with `clampView`, and removing one
such mechanism can uncover another that it was masking. The invariant to state instead of
"delete the centring" is: **`.layer` places the host at its own physical top-left and does
nothing else.**

### ② The tests that should catch ① structurally cannot · **confirmed**

Three separate reasons, and they stack:

- `e2e/stage-fit.spec.ts` runs on the `iphone` and `android` projects only — the `desktop`
  project is `testMatch: /desktop\.spec\.ts/` and the phone projects carry
  `testIgnore: /(golden|shots|desktop)\.spec\.ts/` (`apps/web/playwright.config.ts:162-178`).
  **Those are exactly the two viewports where `host.width === layer.width` and the horizontal
  doubling is zero.**
- `expectCovers` (`stage-fit.spec.ts:100-112`) asserts the page **covers** the layer with 1 px
  tolerance. Over-covering satisfies coverage; a page hanging 108 px below the fold passes.
- The header comment (`:31-52`) states the layer "is exactly host-sized (358 × 570.7 on the
  iPhone project) **because it is shrink-to-fit around its one visible child**". It is not
  shrink-to-fit — `.layer` is `inline-size: 100%; block-size: 100%`. It is host-*width*
  because the host is `width: min(100%, …)`, and host-*height* because the grid row's
  automatic minimum size grows it. **The comment's wrong explanation is the assumption that
  hides the defect.**

On the desktop side, `e2e/desktop.spec.ts:86` asserts only that the absent leaf is to the
right of the live one, and `:169` asserts only that the leaf's *width* survives a turn.
Neither looks at position relative to the stage, so the jammed-against-the-gutter spread
passes.

**Fix:** §6 row 1 and row 2. Rewriting the comment is part of the fix, not a nicety. **Done**
— all three:

- `desktop`'s `testMatch` is now `/(desktop|stage-fit)\.spec\.ts/`, and `stage-fit.spec.ts`
  carries a 320 × 568 case that sets its own viewport, so the floor is asserted on every
  project rather than on whichever one happens to be shaped like it.
- `expectCovers` became `expectHeld`, which asserts *both* of `holdAxis`'s regimes — centred
  against the stage where the leaf fits, covering the layer where it does not — and measures
  which regime the viewport is in rather than assuming it. The one-sidedness is gone: an
  over-covering page now fails the axis it over-covers.
- The header comment states what the layer is (the stage's content box, on both axes, at
  every viewport) and what believing otherwise cost, so the next reader inherits the
  correction rather than the claim.

A fourth reason surfaced while fixing the third: `layerOf`/`stageOf` reached the layer as
`[aria-busy]` on the document, which is unique today only because no spread in this build has
two vendored leaves. They now walk up from the visible page's SVG, so the helpers survive
Loop 4b instead of turning into a strict-mode violation on the day a facing pair lands.

### ③ Plain wheel does nothing, and a mouse-only desktop cannot zoom at all · **confirmed**

Measured at 1440 × 900: plain `wheel(0, −200)` over the stage leaves the transform
unchanged. `ctrl`+wheel works and is uncalibrated:

| `deltaY` | resulting `z` |
| --- | --- |
| −20 | 1.2 |
| −20 | 1.44 |
| −50 | 2.16 |
| −100 | 4.32 |
| −200 | 5 (MAX_ZOOM) |
| +200 | 0.8 (MIN_ZOOM) |

Two ticks of a trackpad go from 1× to 1.44×; one firm scroll saturates the range. There is
no e2e coverage of the wheel anywhere, and `docs/design/desktop.md` §6 does not mention it.
A mouse user with no trackpad and no pinch has **no zoom at all** — on a desktop, in an app
whose subject is 15 lines of small Arabic script.

**Fix:** two separate pieces of work. Calibrating `ctrl`+wheel is a bug fix. Plain
wheel-to-turn is §3.2 ④. Both belong in `apps/web`.

### ④ A turn across an absent page is silent · **confirmed**

`stepPage` (`App.tsx:424-437`) walks `pageTurns.pages` — the *inventory*, not the print — so
7 → 9 skips 8. `goToPage` (`:403-422`) announces `said ?? t.pageN(next)`, so the live region
says only "Page 9". Page 8 is never mentioned. The third press announces "Last available
page" without naming which page that is.

The sibling `handleScrubTo` (`:443-455`) gets this right, and its comment says why: *"a
landing the reader did not ask for has to be named out loud"* — it passes `t.nearestPageN`.
And the desktop spread's absent leaf **does** say "صفحة 6 ليست في هذه النسخة"
(`e2e/desktop.spec.ts:102`). So the app tells the truth about absence in two places out of
three, and the page turn is the one that lies by omission.

**No new string is needed.** `nearestPageN` already exists in both catalogues
(`apps/web/src/messages/ar.json`, `en.json`): «أقرب صفحة متوفّرة · صفحة {page}» / "Nearest
available page · Page {page}".

**Severity:** high on honesty grounds. A gap is a to-do; a gap the interface papers over is
a lie — and with 3 of 604 pages vendored, **every** turn in the shipped build crosses a gap.

### ⑤ Selecting an ayah removes the page-turn keys, with no way back · **confirmed**

Reproduce at 1440 × 900: click bare paper → focus stays on `BODY`, `←` turns 7 → 9. Click an
ayah polygon (`role="button" tabindex="0"`) → focus lands on the path, so
`el?.closest?.("svg") != null` (`App.tsx:743`) is true, `appKeyAction` returns `null`
(`keymap.ts:74`), `preventDefault` is never called, and **nothing happens.** `Escape` does
not move focus off the polygon.

**This is not a bug in the precedence rule.** `keymap.ts:23-24` documents rule 5 deliberately
and correctly: the ayah stepper owns the arrows when an ayah has focus. The defect is the
rule's **missing complement** — there is no unmodified key that turns the page from ayah
focus, and no documented escape hatch. Since tapping an ayah is the app's central gesture, a
hafiz reaches this state constantly.

**Fix (proposal, `packages/core/src/keymap.ts`, L1):** map `PageDown` = +1 and `PageUp` = −1
above rule 5. They are literally the page keys, the ayah stepper does not claim them, and
they are unambiguous under RTL because they are not directional. Optionally also let
`Escape` blur an ayah when no dialog is open. **This is a proposal, not a decision** — it
touches a pinned ladder and should be reviewed as such.

### ⑥ `filter: drop-shadow()` costs the app its entire measured frame headroom · **confirmed**

Numbers in §5. ~1.1 ms/frame median over `box-shadow`, and a max frame of 22.3 ms versus
11.6 ms — the tail is worse than the median. loop-1's emulated baseline was ~8.3 ms, which
is the `box-shadow` figure; the app has been running ~1.1 ms above its own recorded baseline
during every pan and zoom since the shadow was added.

`filter` on the transformed element forces the shadow to be recomputed from the element's
alpha channel at each new scale, where `box-shadow` on an opaque rounded rect is a cheap
composited primitive. §3.1 removes the shadow; if any elevation survives review it must be
`box-shadow`.

**Caveat:** measured in headless Chromium on macOS. **The measurement that is missing** is
the same one on a mid-tier Android (backlog ①/②), where the ratio could be worse.

### ⑦ The rounded corner is not visible, and never was · **confirmed**

`.host` has `border-radius: var(--radius-sm)` and `overflow: visible`, and the child SVG's
box exactly equals the host's box (measured: host 426.4 × 679.7, svg 426.4 × 679.7 at 1440 ×
900). The radius therefore rounds only the host's own `background`, which the SVG paints
over. The paper's visible corner is square; the drop shadow follows the rounded rect. **The
shadow is a different shape from the thing casting it.**

Cosmetic, but it is direct evidence that the card treatment was never looked at closely —
which supports treating §3.1 ③ as removing an accident rather than overruling a decision.

### ⑧ Dead CSS: the page fade-in never runs · **confirmed**

`PageStage.module.css:72-78` styles `[data-status="loading"]` (opacity 0) and
`[data-status="ready"]` (opacity 1 with a `--dur-med` transition). Nothing in
`apps/web/src/` ever writes `data-status` — grep returns only these two rules. Pages
therefore appear as a hard pop.

This matters beyond tidiness: **the cross-fade in §3.1 needs exactly this mechanism**, and
someone reading the stylesheet today would reasonably conclude it already exists. Either
wire it or delete it; leaving it is a trap.

### ⑨ `onPinch` anchors in the wrong coordinate space · **confirmed**

`PageStage.tsx:647` reads the **stage** rect while `view.x/y` are layer-relative
(`measureFit`, `:194-207`) and the host carries an additional grid offset. Measured drift on
a 1.0 → 1.6 zoom with the cursor on a marked glyph: −9.4, −25.2 at 390 × 844; −7.3, −9.3 at
1440 × 900. Both decompose exactly as `(offset) × (k − 1)`.

Fixing ① removes the grid term; the padding term needs `onPinch` to read the host's actual
containing block. Grouped here because it is the same root cause seen through a different
gesture, and because a reviewer who fixes ① without fixing this will find the drift halved
and assume it is rounding.

**① is now fixed and this is not, so that reviewer is the next person to open this file.**
The numbers above are the pre-fix reading and have not been re-taken. Expect the vertical
error at 390 × 844 to have fallen from ~25 px to the padding term alone — the same ~9.6 px
as the horizontal — and do not read the smaller number as success. `16 × (k − 1)` is still a
finger that does not hold the word it is on.

### ⑩ The mounted set still has no ceiling · **suspected (confirmed by code, not by profiling)**

`setCurrentPage` toggles `display` (`PageStage.tsx:275-283`) and nothing removes entries from
`pagesRef`. Every page ever visited stays mounted, with its SVG and its `Highlighter`, for
the session. This is backlog ② ③ and is not new — it is listed here because §5 shows the
turn animation depends on it and would make it worse. **Do not duplicate it into PLAN**; it
is backlog's.

**The measurement that would settle it:** mount N pages on a mid-tier Android and record
resident memory and pan frame time at N = 1, 5, 20. Nobody has taken it.

### ⑪ There is no transition at all today, so reduced motion has nothing to remove · **confirmed**

`ArrowLeft` swaps the two hosts' `display` inside one frame. Under
`prefers-reduced-motion: reduce`, all three duration tokens read `0ms`
(`tokens.css:155-159`) — correct, and currently vacuous for the turn. Noted so that whoever
implements §3.1 knows the reduced-motion path is the *existing* behaviour and needs no new
code, only a token read.

---

## 8. What is explicitly not proposed

- **A page curl, in any form — even as an option.** §2.3 shows the aesthetic constituency is
  real and the evidence against it is thin, so this is not a judgement that the curl is bad.
  It is a judgement about *this* codebase: a 3D transform per frame on a rasterized 170 KB
  inline SVG is precisely the re-raster risk backlog ① exists to measure, that measurement
  has not been taken, and a build with three non-adjacent pages cannot show a curl revealing
  the leaf beneath because there is no leaf beneath. Revisit after Loop 4b and the perf
  verdict, not before.
- **Simulating the bound leaf — gutter shading, page curvature, a drawn spine.** The physical
  observation in §2.1 is correct and this is still the wrong response to it. Material's
  guidance against mirroring physical objects applies, and more importantly a shaded gutter
  darkens real scripture. If the spread needs to read as bound, that is a job for the *gap*
  between the leaves, not for anything painted on them.
- **Vertical continuous scroll.** §2.2 and §3.1. The page boundary is the load-bearing thing.
- **Tap zones on the stage.** §4.6. Taps mean "select this ayah" and that is the app.
- **Re-deciding the RTL direction.** `loop-1.md` pinned it. §3.1 notes that a *slide* cannot
  satisfy both halves of what loop-1 wrote, which is an argument against the slide, not
  against loop-1.
- **Re-deciding one-leaf-per-turn on the spread.** `desktop-vs-mobile.md` row 14 settled it
  and reopens it at Loop 4b.
- **A settings surface for turn style (Curl / Slide / None).** Apple ships one and this app
  has nowhere to put it: the header fits 320 px with seventeen pixels of slack
  (`e2e/chrome-fit.spec.ts`, `desktop.md` §1) and a sixth control does not fit in seventeen
  pixels. With one recommended transition and one reduced-motion substitute, there is nothing
  to choose between yet.
- **New message strings.** §7 ④ is the only proposal that speaks, and `nearestPageN` already
  exists in `ar.json` and `en.json`. If the reduced-motion or turn work later needs strings,
  they get listed before they get added.
- **Anything that presupposes the rendering strategy.** Inline SVG, `content-visibility`
  virtualization, and the raster-glyph fallback (backlog §1 a/b/c) are all still live. §3's
  presentation fixes are strategy-independent; §3's transition is explicitly gated on the
  verdict in §5.
