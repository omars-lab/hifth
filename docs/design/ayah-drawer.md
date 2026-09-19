# The ayah drawer

*A design of record. Its live options page — where the placements below are drawn on a real
page of the print and the felt ones can be tried by hand — is a companion HTML page at the same
address on the site; this record is the reasoning behind it.*

Today, when you press a verse, the app lights it and then spreads that verse's tools around the
edges of the screen: a little rail of related verses floats beside it, a share button and two
more triggers sit in a row along the bottom, and the verse's own label rides in a separate strip.
Nothing is broken, but nothing is *together*. This record proposes one calm panel — the **ayah
drawer** — that opens when you press a verse and holds everything about that verse in one place,
and it settles where that panel sits on a phone and on a wide screen.

---

## A few words, once

- **Verse (ayah)** — one numbered sentence of the Qur'an. It is what you press.
- **Surah** — a named chapter. The demo this was written against is al-Fatiha, the opening.
- **Mus'haf** — the printed Qur'an. The app shows real printed pages, not typed text.
- **Leaf, and a spread** — one printed page is a *leaf*. On a wide screen the app shows two
  leaves side by side, like an open book — a *spread* — with a right leaf and a left leaf.
- **A drawer** — a panel of tools that slides in, holds what you need, and slides away. On a
  phone it rises from the bottom of the screen; that shape is called a *bottom sheet*.
- **A related verse, and a hop** — a verse that echoes the one you are on (the same words
  elsewhere, a look-alike passage). Jumping to one is a *hop*, and the app remembers where you
  hopped from so you can step back.

---

## What is being decided?

**When you press a verse, does one drawer open to hold that verse's tools — and where does it
sit?** The answer proposed here: yes, one drawer; on a phone or a single page it rises from the
bottom; on a two-leaf spread it opens on the **same leaf** as the verse you pressed — press a
verse on the right leaf and the drawer is on the right, press on the left and it is on the left.

## Why is this being asked now?

Because the pieces already exist and have no home. A pressed verse can already show its related
verses, open a scholar's commentary, open its shared roots, be shared as a link, and be noted —
but each of those lives in a different corner of the screen, appears through a different control,
and looks slightly different from the last. While showing the app to others (the al-Fatiha
commentary demo), two things were plainly awkward: the tools for one verse are scattered, and two
verses lit at once were drawn in two visibly different orange styles for no reason a viewer could
name. A drawer is the moment to fix both.

## What happens if nobody decides?

The tools stay scattered and keep drifting apart — each new tool picks its own corner, and the
screen around a pressed verse gets busier every loop. It is not fatal: a reader can still reach
everything. But the app keeps *looking* unfinished at exactly the moment it is being shown to the
people it hopes to work with, and every new per-verse feature has to invent its own place to live
instead of dropping into a drawer that already exists.

## What does the app do today, and what does it cost?

Press a verse today and its tools land in three different places:

- **Beside the verse:** a small rail of chips, one per kind of related verse, each showing a
  count and a direction — a loop arrow for look-alikes in the same surah, a back arrow for
  earlier surahs, a forward arrow for later ones. The corner chip a viewer described as **"1 ▶"**
  is one of these: it means *one look-alike verse, later in the mus'haf*. Pressing a chip opens a
  small list, and from the list you hop.
- **Along the bottom:** the verse's label as a pill, a control that opens the verse's shared
  roots, a control that opens the scholar's commentary (in the private demo build), and a share
  button — four separate things in a row.
- **Over the page, when needed:** the related-verse list, the commentary, and the roots each rise
  as their own panel.

So a single verse's attention is split across a rail, a row, and up to three panels, each reached
by its own control. That is the cost: not a missing feature, but a reader who has to look in three
places to work with one verse, and a screen that reads as a scatter of controls rather than one
subject in focus.

### Why were two verses lit in two different oranges?

This was the sharper complaint, so here is the plain finding. **The two orange styles are the
same mark drawn two different ways — not two different meanings.** When the app lights a verse it
first tries to lay the colour down like a marker pen, by reading the printed shape of the verse
into pen strokes. When it can read the shape, you get a **solid orange swipe**. When it cannot —
some verses' printed shapes are not in a form it recognises — it falls back to tracing the verse's
outline instead, which reads as an **orange box**. Same colour, same meaning ("this verse"), two
looks, chosen by a detail of the printing the reader cannot see. (The lighter "passage" mark, laid
down by a drag across several verses, has the same two looks a shade fainter — which is the other
way two orange styles can end up next to each other.)

So it is **not** the app telling you two different things. There *is* one real
tell-two-things-apart rule in the app — the verse you *hopped from* is drawn as a **green**
dashed outline, not orange — but that is not what was seen here; both marks the viewer saw were
orange, so both were the "this verse" mark, drawn once as a swipe and once as a box.

The drawer era is the right time to settle this: **one meaning, one look.** A verse that is "the
one you pressed" should look the same whether or not the app could read its shape as pen strokes.
This record does not pick the single look — that is a small follow-on — but it names the rule the
drawer should be built under.

## What do other apps and the printed tradition do?

*From memory of these apps, not re-tested this session — so treat this as recollection, not a
fresh survey.* The common pattern in Qur'an apps (Quran.com, the Ayah reader, Tarteel, Muslim
Pro) is exactly a drawer: press or long-press a verse and a single sheet rises from the bottom
holding that verse's actions together — play, bookmark, share, copy, open commentary. Almost none
of them scatter a verse's tools around the screen; the sheet-per-verse is close to a settled
convention, and it is the convention this record follows. Where this app differs is the wide
screen: those apps are overwhelmingly phone-first, so they have little to say about a two-leaf
spread, which is why the desktop placement below is decided here rather than borrowed.

The **printed tradition** keeps a verse's apparatus in the margins and the foot of the page —
always visible, never covering the text. That is evidence that a reader wants the verse itself to
stay uncovered while they consult its tools; it is *not* evidence for any particular sliding
panel, because print has no motion and nothing to slide. It argues for the drawer not hiding the
verse it is about — which is the heart of the placement question below.

## What have we already decided that this leans on?

- **The tap-and-hold that opens the drawers.** A companion design already settled that a quick
  press on a *word* opens that word's fine picker, and a longer press opens the *verse's* tools —
  and that the verse's tools arrive as a bottom sheet, the same shape on a phone and a wide
  screen. *This record is the inside of that verse drawer* — what it holds and, on a wide screen
  only, where it sits. It leans entirely on that gesture and does not reopen it.
- **A drag selects a passage rather than turning the page.** The drawer for a single verse and
  the panel for a dragged passage are the same panel in two sizes; this record keeps them one
  thing.
- **The four kinds of note a reader can pin.** Whatever else the drawer gathers, it carries the
  existing note kinds; it does not invent new ones.
- **The wide-screen-versus-phone rules.** The app already keeps some controls off the phone for
  want of room. The drawer inherits that: what is in the drawer is the same everywhere, but the
  always-on reading controls it sits among differ by screen, and that is not reopened here.
- **The marker-pen colouring.** The "one meaning, one look" rule above is a tightening of the
  existing pen colouring, not a new colour system.

### Where this parts from the companion design

The companion design said the verse drawer is a bottom sheet **on every screen**, and explicitly
left off a desktop side panel so there was only one shape to learn. **This record revisits that
one clause, for the spread only.** The reason is the finding in "what does the app do today": on a
two-leaf spread a panel that rises across the full bottom hides *both* leaves and drops the one
fact that made the drawer feel connected — *which* leaf you pressed. So this record keeps the
bottom sheet on a phone and on a single page unchanged, and proposes a side panel on the spread,
on the pressed verse's own leaf. Everything else in the companion design stands.

## The options

All four are **built live and tried by hand** on the companion page —
[the drawer options page](./ayah-drawer-options.html) — each drawn on the real al-Fatiha spread at
the size a reader really uses, with tappable verses from the app's own word geometry. Flip between
A, B, C and D there and switch between the wide spread and one page; two of them (a panel sliding
from the bottom versus from a side, and whether it covers the verse you are reading) differ in
something a still picture cannot carry, which is why they are built rather than drawn.

Building the page already taught the record something no paragraph had: on a real spread a
same-leaf side panel wide enough to hold the drawer's contents **covers the verse it is about**, so
Option C's hoped-for "sits beside the verse" only holds if the panel is kept narrow — exactly the
kind of nuance the "what would change the answer" section below anticipated, now seen rather than
guessed.

**Option A — leave it scattered (what happens today).**
The rail beside the verse, the row along the bottom, the panels over the page. *Draw:* the
current screen, so the scatter is visible at real size next to the alternatives. *Cost:* the
reader looks in three places for one verse; every new tool picks a new corner. On the list because
doing nothing is always a real choice, and here it is the one to beat.

**Option B — one bottom sheet, on every screen.**
Press a verse, one panel rises from the bottom holding the label, the related verses, the roots,
the commentary and share — on a phone, a single page, and a spread alike. *This is the companion
design carried out to the letter.* *Draw + build live:* on a phone this is plainly right; on a
spread it must be tried, because the felt cost is that it covers both leaves. *Cost:* one shape to
learn everywhere, but on a spread it hides the verse you are working on and forgets which leaf you
pressed.

**Option C — bottom sheet on a phone, a side panel on the pressed verse's own leaf (recommended).**
On a phone and a single page, the bottom sheet of Option B, unchanged. On a spread, the drawer
opens on the **same** leaf as the verse: press on the right leaf, the drawer is on the right;
press on the left, it is on the left. *Draw + build live:* the felt question is whether a
same-side panel sits comfortably beside the verse without hiding it. *Cost:* two shapes to learn
(bottom on a phone, side on a spread), and the drawer shares its leaf with the verse, so it must
be sized to sit beside the text rather than over it. *Why recommended:* the drawer stays visually
tied to the verse it is about — your eye and your hand stay on one side of the book — and the
"which leaf" fact the demo lost is exactly what places it.

**Option D — bottom sheet on a phone, a side panel on the *other* leaf on a spread.**
Like C, but on a spread the drawer opens on the leaf **opposite** the verse, to keep the verse
itself completely uncovered. *This is what the app's own side-placement helper does today for its
existing panels.* *Draw + build live:* the felt question is whether reaching across the gutter to
a panel about the verse on the far side feels connected or feels split. *Cost:* the verse stays
fully visible, but the drawer and its subject are on opposite sides of the book, and your
attention crosses the gutter every time.

**C and D are the same code with the side flipped**, so the choice between them is cheap to make
and cheap to change — which is the argument for deciding it by hand on the live page rather than in
prose. C is recommended, but D carries the app's current reasoning ("never cover the verse"), and
that is a real reason a reader might prefer it once they feel both.

### What the drawer holds, in all options

One panel, top to bottom: the **verse's label** as its title (this replaces the separate pill);
the **related verses**, grouped the way the rail groups them now, each openable to a short list
you hop from (this replaces the floating rail *and* its pop-up list); the **shared roots**; the
**scholar's commentary** (demo build only, shown only when there is held commentary); and
**share**. The dragged-passage panel is the same drawer, titled by the passage's first verse.

## What else was considered, and left off?

- **A drawer that is always open, docked to one side.** Left off: it spends screen on a verse
  even when no verse is pressed, and the app's whole gesture is *press to focus one verse*, not
  *keep a panel up*. A drawer that opens on press and closes after is truer to that.
- **Keeping the related-verse rail beside the verse and moving only the row into the drawer.**
  Left off as a half-measure: it would still leave a reader looking in two places, and the rail
  beside the verse is the single busiest thing on the screen. If the drawer is worth opening, the
  related verses are the first thing it should hold.
- **A right-click menu on a wide screen.** Kept as a convenience a build may add later, not the
  thing the design rests on — a phone has no right-click, and the drawer has to work the same way
  on both.
- **Leaving the trail of hops inside the drawer.** Left off: the trail is a record of a *walk
  across several verses*, not a property of the one verse you are on, and closing the drawer
  should not erase where you have been. The trail stays outside the drawer, always visible; only
  the current verse's own label moves in, as the drawer's title.

## What would change the answer?

- **A reader on a spread who keeps losing the verse behind the drawer** would push C toward D, or
  push the drawer narrower so it never covers the text.
- **A reader who finds reaching across the gutter jarring** would settle C over D for good.
- **A reader who never notices the drawer changes shape between phone and spread** would be the
  evidence that "two shapes to learn" (the cost of C and D) is not a real cost, and B's one-shape
  advantage was worth less than it looked.
- The honest test for all three is a hafiz on their own device, on a spread, reaching for a
  verse's tools without being told where they are — which is what the live options page is for.

## What is this not settling?

- **The single look for the "this verse" mark.** This record names the rule — one meaning, one
  look — but does not pick whether the settled look is the swipe or the box. That is a small
  follow-on decision.
- **Exactly how wide the side panel is on a spread**, or how it animates. That is tuning on the
  chosen option, not the choice itself.
- **What the note tools inside the drawer finally look like.** The drawer gives them a home; their
  own layout is decided elsewhere.
- **The word drawer.** The companion design owns the word's fine picker; this record is only the
  verse drawer.

---

## For the code

*Reader-facing prose above avoids the names below on purpose; they live here, with the wiring.*

**Where the scattered chrome lives today** (all in `apps/web/src/App.tsx`):
- The related-verse rail is `HopRail` (chips from `railChips`, built by `Adjacency` in
  `packages/core/src/adjacency.ts`); a chip opens `HopPopover`. The "1 ▶" the owner asked about
  is the `later` direction chip — glyph `▶` from `RAIL_GLYPH.later`, count from the bucket. It
  means one look-alike (`mutashabih`) verse in a later surah.
- The bottom row is the `footer.trail`: `TrailBeads` (its `beadCurrent` bead is the "ayah pill" —
  the current verse's label, which also clears the selection), `RootLensTrigger` (⬡),
  `CommentaryTrigger` (✎, pitch build), and `ShareSheet`.
- The over-the-page panels are `HopPopover`, `HighlightMenu` (the dragged range),
  `RootLens` (⬡), and `CommentarySheet` (✎). All four already take a `side` prop.

**The two-highlight-kinds finding.** Marks are drawn by the highlighter in `@hifth/core`
(`highlighter.ts`), which calls `swipesFromPath` (`packages/core/src/ink.ts`). When the ayah
polygon parses as a rect-run, it emits `<line>` swipes tagged `.hl-ink`; when `swipesFromPath`
returns `null` (geometry it does not recognise), it clones the source polygon instead. The two
renderings are styled in `apps/web/src/styles/highlight.css`: a selection inks as
`.hl-sel.hl-ink` (stroke `--ink-sel` `#e8a13a`, solid — the "solid orange fill"), and falls back
to `.hl-sel:not(.hl-ink)` (fill `--highlight-wash` amber .24 + ring `--highlight-ring` amber .85
— the "orange box"). The range mark (`.hl-hlt`) has the same fork one shade lighter. The
breadcrumb (`.hl-crumb`) is the real role distinction and is `--accent` `#1f6f66` (green), which
is why "both orange" rules out selection-vs-breadcrumb. **The "one meaning, one look" rule means
normalising the selection's two renderings** — either always ink (extend `ink.ts` to cover the
declined geometries, or a neutral swipe fallback) or always clone — so a verse's "this is the one
you pressed" look does not depend on whether `swipesFromPath` recognised its shape.

**Reusing the sheet contract.** The drawer should reuse `CommentarySheet`'s dialog contract
(`apps/web/src/pitch/CommentarySheet.tsx`): focus in on open, `Tab` trapped, `Escape` closes,
focus restored, scrim, grip; `data-side` for placement. The existing `side` prop values are
`"left" | "right" | null` (null → phone/bottom).

**The placement rule — the one behavioural change from today.** `sheetSide` in `App.tsx` currently
returns the *opposite* leaf (ayah on `right` → sheet on `"left"`), which is **Option D**. The
recommended **Option C (same leaf)** is the same memo with the two returns swapped: ayah on
`right` → `"right"`, ayah on `left` → `"left"`. Because C and D differ by exactly that swap, the
live options page can mount both by toggling it, one panel per option behind one frame
(`OptionC` / `OptionD`), and the winner graduates while the loser is deleted — per the house rule
that a felt difference is built, not drawn. `sheetSide` stays `null` below the desktop breakpoint,
in one-page mode, and with the book closed to a single leaf, so the phone/single-page bottom sheet
(Options B/C/D share it) is unchanged.

**Relation to the companion page.** `docs/design/selection-drawer.html` decides the gesture (tap
→ word drawer, hold → verse drawer) and declares the verse drawer a bottom sheet on every screen,
explicitly leaving off a desktop side panel. This record **extends** it (specifies the verse
drawer's contents and consolidation) and **supersedes one clause** (the desktop-spread placement),
for the reason given in "Where this parts from the companion design". The gesture, the phone
bottom sheet, and the four note kinds are untouched.

**Registering this.** When the owner is ready: add a row to `docs/decisions.json` (question,
status `open`, options A–D, the live options page as both `artifact` and `page`, `builtBy`,
`doc` pointing here, and `related` naming the companion selection-drawer decision in both
directions), then `make decisions-doc` and `pnpm gate:decisions`. An open decision needs the live
page checked in under `docs/` and its site address, and at least two options — all present here.
Left to the owner, per this pass's scope.
