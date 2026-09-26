# When you turn a page, should the leaf curl the way a paper book does?

*Status: decided 2026-09-26 by Omar: A, B and D, as a setting the reader switches. C is out. Reopened a rejection recorded in `page-transition.md` §8①.*

- **Turn each option by hand:** the live board is at
  [`docs/design/page-turn-curl-options.html`](../design/page-turn-curl-options.html),
  published at
  <https://blog.bytesofpurpose.com/hifth/docs/design/page-turn-curl-options.html>.
- **Rebuilt by:** `scripts/build-page-turn-curl-options.mjs` (reads the app's own
  tokens and `@hifth/core`'s `foldBetween`, so every colour, width and the four
  named states on the page are the ones that ship).

This record holds the reasons; the page holds the feel. A curl is felt, not seen,
so the page is where the decision is actually made — this file exists so the next
person to open the question inherits *why* it was reopened and what each option is
paying, not only the board.

## What is being decided

When a reader turns a page, should the leaf **curl** — grab the outer fore-edge and
it rolls up and over, the way a paper book does — or keep the flat seam the app
turns with today, a soft band that sweeps *over* the words while none of them move?
And if it curls, what rides on the curling surface: the drawn letters themselves, or
grey skeleton lines that only become letters once the leaf lies flat?

## Why this is being asked now

Two things collided. The app ships the flat seam (`PageStage`'s one-element `.fold`
band, `page-turning.md` §1.5). The owner asked for a real corner-curl turn like a
paper book. And `page-transition.md` §8① had already considered the curl and
**rejected** it, on three grounds:

1. **A curl moves the words.** The one rule of a turn here (`page-turning.md` §1.5,
   the glyph-movement axiom) is that no drawn letter translates during a turn — a
   page is up to ~154 KB of outlined glyph paths, and sliding all of it every frame
   is the one thing page-image memory cannot afford on a phone. The `.fold` is a
   bare `<div>` precisely so a translate never lands on an ancestor of the SVG.
2. **A curl asserts adjacency by the act of curling**, so it cannot tell the truth
   about the two states that are not a plain leaf-turn: a `hole` (the print has a
   leaf here this build lacks) and a `crease` (two pages face in one opening, and
   nothing turns).
3. **The reference the owner pointed at is a flat ribbon with a fold, not a curl.**

The rejection set its own bar for reopening: *"Reconsider only if someone can draw a
curl that expresses `Fold`'s four states."* This reopens it, because a new idea from
the owner may clear the first ground and the board is built to clear the second.

### The idea that reopens it

> hide the glyphs with a skeleton loading animation for lines while turning, on the
> new side of the page

The curling surface carries **skeleton lines** — the same "still loading" grey bars
a reader sees all over the web — not glyphs. The real page settles in (skeleton →
outlined SVG) only once the leaf is flat and at rest. So the leaf curls and **no
drawn letter ever moves**, which is ground 1. Option B on the board is exactly this.

Ground 2 is answered by construction, not by argument: on the board every turn style
is driven by `foldBetween(from, to, total)` and made to render all four states
truthfully. A curl only fires for `gap` (a leaf turned) and `hole` (a missing leaf,
revealed as sunk dashed paper); for `crease` it does **not** curl at all — the gutter
deepens between two facing pages, which is the honest thing, because nothing turned;
and a `none` jump is a cross-fade, not a lift. A turn style that looks the same in all
four would be lying about three of them, and the board lets a reader check each.

## What happens if nobody decides

The flat seam keeps shipping and it works. Nothing is blocked behind this — the
interim edge-grab turn (task #18) already gives desktop a hand-cursor grab on the
fore-edge, playing the seam. This is a question of how a turn *feels*, not a defect,
so the honest cost of leaving it open is small.

## What the app does today, and what it costs

The flat seam is option A on the board, playable. It holds the glyph-movement axiom
above all else, and that axiom is a measurement, not a taste: the shipped page SVGs
run from ~59 KB (page 1) to ~154 KB (page 10) of outlined glyph paths. The seam moves
*over* stationary glyphs so that weight never translates. The cost it pays is legibility
of the gesture: some hands may not believe a page was *turned* — a seam can read as a
jump. That is the evidence a curl would answer, and only a hafiz with a thumb on it can
give it (`page-transition.md` §7②, blocked on a hafiz).

## Prior art

Paper books curl — that is the reference. The big-name e-reader apps curl too, and can,
because their text is light, re-flowable glyphs they redraw cheaply mid-curl. *This is
the survey from the earlier turn work, not a fresh look today.* Why it does not simply
transfer: this app renders heavy, exact drawn artwork of one specific printing, letter
for letter, because a hafiz who memorised the page needs the page they memorised. The
curl that is cheap for re-flowable text is the expensive thing the axiom forbids — which
is the whole reason the skeleton idea matters: it makes the curling surface cheap again.

## What earlier decisions constrain this

- **The glyph-movement axiom** (`page-turning.md` §1.5). An option that translates the
  drawn letters reopens it. Options A, B and D keep it; option C breaks it on purpose,
  so a reader can feel what the axiom protects.
- **The four honest states of a fold** (`foldBetween` in `@hifth/core`,
  `page-transition.md` §4). A turn must tell the truth about which of `crease`, `gap`,
  `hole`, `none` it is. Every option on the board is checked against all four.
- **The original curl rejection** (`page-transition.md` §8①), reopened here on its own
  terms.
- **Desktop vs mobile** (`desktop-vs-mobile.md`): the turn is a desktop grab gesture on
  the fore-edge, so this rides on that living record.

## The options — each built live, each turnable by hand

| | option | keeps the axiom? | how it tells the truth in all four states |
|---|---|---|---|
| **A** | Flat seam (today) | yes | a sweeping band that becomes a gutter / fore-edge gap / sunk slot / absent |
| **B** | Skeleton curl (the new idea) | **yes** | curls carrying grey lines; reveals a page (settling in) or a sunk slot; does not curl a crease |
| **C** | Curl the real words | **no** | curls carrying the actual glyphs — here to be felt, and probably to lose |
| **D** | Shadow lift | yes | a lifting shadow, no moving surface; the page swaps under it |

C is on the board on purpose. A reader can be wrong about the curl from a still picture
and right from a hand on it, so the forbidden version is there to be felt — that is what
makes the choice a choice rather than a rubber stamp of B.

## What else was considered and left off

- **Curl the whole leaf at once** (a rigid full-page flip): it is option C at book
  scale — every glyph on the leaf translates. If C loses on feel, this loses worse.
- **Slide the page sideways** (push old off, slide new on): a real third family, but it
  still slides the drawn glyphs, so it meets the same axiom C does. Worth its own page if
  the whole curl family is rejected.
- **A dog-ear only** (fold just the corner): the small end of B's range, a tuning of it
  rather than a separate answer — it lives inside B's knobs.

## What would change the answer

- If the pages ever became light re-flowable text, curling the real glyphs (C) would stop
  being expensive and the axiom that forbids it would soften.
- If a hafiz says the flat seam reads as a jump rather than a turn (`page-transition.md`
  §7②), that is evidence for a curl the still picture cannot give.
- If even the skeleton curl (B) stutters on a slow phone once built for real
  (`page-transition.md` §7③, the perf gate), the axiom wins and the seam stays.

## What this is not settling

Not the exact geometry of the curl — how tight it rolls, its duration, whether it makes
a sound. Not whether the winning curl borrows the fore-edge stack colours at its fold.
And not the performance sign-off: even a curl that wins here on feel still owes a real
measurement on a slow phone before it graduates. This decides the **direction**; the
numbers come after.

## What was decided

**Decided (2026-09-26, Omar): keep A, B and D, and let the reader choose.** The flat seam
(A) stays the default. The skeleton curl (B) and the shadow lift (D) sit beside it in the
reader's settings, so each hafiz picks the turn that feels right to them. Curling the real
words (C) is left out: it is the one option that moves the drawn letters, and none of the
others needed that.

The owner's words: "lets implement a, b, and d as turning options" and "this should be a
setting we can toggle".

**For a hafiz:** nothing about the page changes. The words never move during a turn in any
of the three. What changes is only how the turn feels under the thumb, and that is now the
reader's choice rather than ours.

## When it is decided (as written before the choice)


The winning turn style graduates into `PageStage`'s `.fold` rendering — the
`foldBetween` / `runTurn` / `turnBy` contract stays; only what is drawn between the
leaves and its motion changes — and the losing option components are deleted, so nothing
here is throwaway that the choice did not need. The losing options stay drawn in this
record and on the board, because they are the reason the choice was a choice.
