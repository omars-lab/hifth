# Desktop vs mobile — the running record

**This is a living document. Append to it; do not summarise it.**

Every time a decision goes differently on a wide window than on a phone, it gets a row
here: what mobile does, what desktop does, and **why they differ**. The third column is the
one this file exists for. A table of two behaviours with no reason is a list of
inconsistencies; a table with reasons is a design.

The prose behind the desktop half is [`docs/design/desktop.md`](../design/desktop.md). This
file is the index; that file is the argument. Rows here should be one line each and point
at the doc, the code, or the test that holds them.

**The governing rule** (design doc §1): *a bigger screen is not a licence to add features,
it is room to stop hiding the ones that already exist.* Before adding a row, name the
mobile constraint that forced the difference. If there is no constraint — if desktop simply
gets a nicer thing — it is a new feature and belongs in the PLAN, not in a media query.

**The breakpoint is `(min-width: 1024px) and (min-height: 740px)`** (`DESKTOP_QUERY`). Two
axes, because a mus'haf leaf is portrait and the scarce dimension is **height**, not width
(design doc §3). One query, two behaviours; there is no tablet tier (design doc §7).

---

## Decisions already made, before the spread

These predate this file and are recorded so the table starts honest rather than starting at
the point someone happened to write it down.

| # | Decision | Mobile | Desktop | Why they differ |
|---|---|---|---|---|
| 1 | **The page bar's track** | Spans the **print** — 604 pages — with ticks for the 3 vendored ones, and says so out loud when a scrub snaps | Identical | Not a width decision at all. A track that spanned the inventory would redefine the mus'haf as whatever is in `public/assets` this week, and that is equally false on a 27-inch monitor. Recorded here because it is the **precedent every honesty decision below follows**: show the print, land on the inventory, announce the difference. `PageSlider.tsx`, `packages/core/src/pages.ts` |
| 2 | **The colophon's opener** | The **wordmark**, not a sixth header button | Same wordmark | `e2e/chrome-fit.spec.ts` holds the header inside 320 px with 17 px of slack; a sixth control does not fit in 17 px. Kept on desktop because a control that relocates with the window is a control the reader has to re-find. `Colophon.tsx:108-119` |
| 3 | **The language switch** | Inside the colophon sheet — the only place with room | **Also** in the chrome, as a two-radio pair | Same 17 px. The switch is not moved on desktop, it is *additionally* surfaced: two doors to one setting, one of which only exists where there is room. Design doc §5 |
| 4 | **Direction** | Chrome flips with the UI language; the stage, hop rail, trail beads and page bar are pinned `dir="rtl"` in **both** languages | Identical, and the spread joins the pinned set | The pinned elements are furniture around a mus'haf, not around a sentence — and the mus'haf reads right to left at every window width. `App.tsx:745` |
| 5 | **The install button** | Not in the chrome; the offer lives in `OfflineNotice` | Same | A ~126 px text pill in a row that could not afford 126 px. It stays out on desktop because the notice says it better anywhere: it gives the reason and can be dismissed, and a permanent navigation row is the wrong lane for a promo that disappears when used. `App.tsx` chrome comment |
| 6 | **The `⬡` root lens** | One glyph, one place, one count — the rail's `root` chip was merged into the lens | Same | A collision decided by meaning, not by width: `root` was an edge *type* wearing a direction's clothes. Recorded so nobody "un-merges" it on desktop for the room. `loop-6a.md` |

## The spread and its affordances

| # | Decision | Mobile | Desktop | Why they differ |
|---|---|---|---|---|
| 7 | **How many pages are on the stage** | One | **Two — a spread**, above `1024×740` | Room, bounded by a rule: *a leaf must never be narrower than the narrowest supported phone (320 px ⇒ 290 px of page, measured) gives the single page it replaced*. The binding axis is **height**, not width — a leaf is portrait, so its width is derived from the height the chrome leaves. Design doc §3 |
| 8 | **How the second page is gated** | — | `matchMedia` in **JS**, not `display:none` in CSS | A hidden panel still fetches ~170 KB of SVG, parses it, builds a `Highlighter` and costs the frame budget. Desktop is where two mounts are affordable; mobile is precisely where they are not (PLAN follow-up ①). `useMediaQuery.ts` |
| 9 | **Which side the lower page number is on** | n/a (one page) | **Right** — spreads pair (1,2), (3,4), (5,6); odd on the right, so Al-Fatiha faces Al-Baqarah and no leaf is orphaned | The print's own pairing, observed on a physical KFGQPC Madani mus'haf. Encoded once, as DOM order inside `main[dir="rtl"]`, so the RTL flow places the leaves; declaring the direction twice is how two declarations eventually disagree. `spreadOf` in `packages/core/src/pages.ts` |
| 10 | **The missing facing page** | n/a | Rendered **absent** — recessed, dashed edge, its number in the printed position, and the inventory line «المتوفّر ٣ من ٦٠٤ صفحة» | Only pages 7, 9 and 19 are vendored and they are not adjacent, so there is **no facing pair in this build**. A blank sheet impersonating paper is the exact failure the page bar was built to avoid. Design doc §4 |
| 11 | **How the absence is announced** | n/a | Visible text in a labelled region — **not** through `LiveAnnouncer` | The live region already speaks on every page turn; appending "and the facing page is missing" to all of them trains the reader to stop listening. A permanent condition belongs in the document, not in a live region. Design doc §4 |
| 12 | **Two pages, one component or two** | One `PageStage` | Two `PageStage` instances, one per leaf | `PageStage`'s correctness argument is that there is exactly one imperative write path to one visible host. Two transforms and two clamps inside it is a bigger change than two instances beside each other. Design doc §4 |
| 13 | **Keyboard shortcut hints** | None — a phone has no keyboard, so `appKeyAction`'s map is unreachable | A quiet inline `kbd` row in the chrome | The strongest constraint in this table: on mobile the feature does not exist, so a hint for it would be worse than silence. Three shortcuts, so a row and not a dialog — a new sheet would owe a `SURFACES` row in `e2e/contrast.spec.ts` (PLAN follow-up ⑥) and should buy more than three words. Design doc §5 |
| 14 | **What an arrow key turns** | One page, through the vendored inventory | **The same** — one page, not one leaf | `stepPage` walks the inventory, and ±2 over an inventory of three is a no-op or an overshoot. The keymap is core's and tested there; a component does not get to reinterpret it. Reopens at Loop 4b — design doc §8 ① |
| 15 | **Hover** | Unavailable | **Still not used** for anything load-bearing | A control that exists only on desktop *and* only on hover is a control nobody finds. Desktop-only is already a discoverability cost; hover-only doubles it. Design doc §6 |
| 16 | **What the header's page number says** | The current page | **The same** | Two pages are on screen and the header names one, which is tempting to change and deliberately not changed: the element is concurrently becoming the revision-map button, and a merge is the wrong place to also redefine what it means. The facing leaf names itself. Design doc §7 |
| 17 | **Golden images** | 390×844 element shots of the page SVG | **None** — the desktop e2e asserts structure, not pixels | A desktop baseline is a second platform-split image set for a layout Loop 4b changes again. Structure ("the right leaf carries the lower number", "the absent leaf is captioned") is the claim that survives 4b. Design doc §7 |
| 18 | **What a page turn animates** | An opacity cross-fade, ~120 ms | **The same, ~200 ms**, and on the **live leaf only** | Not a taste split: `.host`'s `transform` is the *view* (one imperative write path for pan and zoom), so **opacity is the only free channel** on either form factor — a slide would have to compose into that matrix or grow a wrapper. Desktop shortens because Material's only explicit desktop guidance is 150–200 ms; and cross-fading the whole spread would animate a leaf that did not turn. Gated on follow-up ① — design doc [`page-turning.md` §3](../design/page-turning.md) |
| 19 | **What turns the page with a pointer** | A horizontal drag, **only at fit-zoom** | **The same drag on the live leaf**, beside the wheel, the arrows and the page bar | At z=1 the *horizontal* pan is already a measured no-op (`holdAxis` forces the centre for an axis that fits, and the leaf is `width: min(100%, …)`), so the swipe slot on a phone is empty and costs no existing gesture. Only the horizontal axis — the vertical pan at z=1 is real on a viewport where the leaf overflows, which is why the `fitsAcross` guard tests one axis and not two (`page-turning.md` §4.1–4.2); above z=1 a drag pans and the turn stays on the visible buttons (WCAG 2.5.1). **This row said "Nothing" on desktop, for a reason that was false**: *"on desktop a pointer drag already means marquee"* — it does not, a marquee needs a 350 ms hold first (`LONG_PRESS_MS`), and the ladder asks about the hold *before* it asks about the axis. Nothing in that argument was about a mouse, so the rule is device-blind and the divergence is now a smaller one, forced by structure rather than taste: the **facing** leaf of a spread declines (`dragToTurn={false}`), because it holds no `turnTo` ref to hand its band to and would draw a second band into the same portal — one fold, ever (`page-transition.md` §3.4). `page-turning.md` §3.2 ④, §4 |
| 20 | **What a turn between two *facing* pages does** | Cross-fades under a fold, like any other turn — one leaf is on screen and it changed | **Nothing at all** — both leaves of the `spreadOf` pair are already mounted and neither changed; only which leaf is live moves | Not a taste split and not a desktop feature: the same rule (`foldBetween`) reading a screen that already shows more of the book. A crease is drawn between facing pages, and on desktop it is drawn **permanently** by `PageSpread`'s gutter rather than transiently by a fold. Animating a leaf that did not turn is the failure. `page-transition.md` §3.5 |
| 21 | **What is drawn between two pages during a turn** | A 28–30 px band whose fill states the relationship: crease / gap / sunk-and-dashed / nothing | **The same band, sweeping the whole spread**, since a turn that leaves the pair changes both panels | The rule is identical; only the extent differs, and it differs because the desktop turn changes two leaves where the phone's changes one. The predicate is `foldBetween` in core at both widths — decision row 9's "encoded once" applied to the fold. `page-transition.md` §4 |
| 22 | **Where the revision map sits** | A full-bleed bottom sheet, its grid shaped by `auto-fill` against the window | **A 620 px card, centred**, its grid given a named column count per scope — 6×5 juz, 8×8 hizb, 25×25 page | The eighth sheet to get a wide-window rule and the only one that could not copy it: the other seven narrow to a ~420 px column because they hold *controls*, and this holds a picture of the whole book. The card is the dull half. `auto-fill` is a deferral, not a layout — fine while the window is binding, empty once nothing is, and measured at 1440 px it laid 30 juz out as **one row**. On a phone the window decides the shape; on a wide window the component has to. Design doc §8 ⑤ |

---

## How to add a row

1. Name the mobile constraint. If you cannot, stop — see the governing rule above.
2. Say what each side does in the reader's terms, not the code's.
3. Point at the file, the test, or the design-doc section that holds it.
4. Keep it to one line. The argument goes in `docs/design/`; this is the index.
