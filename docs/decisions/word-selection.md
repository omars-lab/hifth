# The grain gets finer where the finger already is

**Status:** shipped (selection only — a word run refines nothing yet).
**Date:** 2026-08-04.
**Task:** #65, delivered as word-A (registration probe), word-B (the boxes), word-C (this).
**Map:** [`word-selection`](../map.json) — where to change it.
**Use case:** `narrow-down-to-the-words-i-mean` — what it is for.

This is the record of what was decided and what proved it. The forward-looking half — why
a word run cannot yet *search* — is [`PLAN.md`](../PLAN.md) ⑬, and the access gap it opened
is ⑮. Neither is repeated here.

## The decision

**A long press that begins inside an already-selected ayah drops to word granularity.** Tap
still selects the ayah. Once it is lit, holding still inside it inks the word under the
finger; dragging extends the run word by word within that ayah; Escape climbs back to the
whole ayah rather than out of the selection entirely.

The alternative shapes all wanted a *mode* — a toggle, a second control, a modifier — and a
mode is a thing a reader has to know about before they can use it. This one is discovered by
doing the gesture they already do, slightly longer, in a place they have already told the app
they care about. The maintainer chose it on that ground.

**The whole implementation of "in a place they already care about" is one bit.**
`PointerSample.insideSelection` is what `heldIntent` reads to return `"word"` instead of
`"marquee"`. The two gestures are otherwise identical — same press, same 350 ms, same slop —
which is the point and also the risk: a single bit separating a new verdict from the one
Loop 5 shipped means a bug in reading that bit does not look like a broken word feature, it
looks like the marquee vanishing. `e2e/word.spec.ts` therefore spends a whole test on the
*old* gesture, holding outside the selection and asserting a marquee still appears.

`"word"` is deliberately not a viewport intent. The page does not move under a finger that is
choosing words.

## Three choices inside that, each with a rejected alternative

**Which ayah the press was in — the browser's own hit test, recorded at `pointerdown`.**
`Highlighter.pressedKey` latches it and leaves it standing until the next press. Rejected: a
bounding box (an ayah that wraps is two disjoint slabs, and its box covers its neighbours'
words), `isPointInFill` per polygon (a geometry query on the compositor's critical path), and
`event.target` (pointer capture retargets it mid-drag).

**Which word inside that ayah — nearest, not containing.** `WordIndex.wordAt` searches only
within the named ayah, skips pause marks, and returns the nearest box rather than requiring
containment. A finger is not a point; strict containment means a press in the gap between two
words selects nothing, and "nothing happened" is the worst answer a gesture can give. Strict
containment still exists as `hitTest`, for callers that want the honest answer.

**When the ink appears — when the shard lands, even after the finger has lifted.** Word
geometry is 604 shards of ~3.6 KB, deliberately not precached, so a cold page means a round
trip. Painting only while the pointer is down would make the feature work or not depending on
connection speed; painting late makes it merely slow. Misses are cached too, so a page with
no shard costs one request, not one per press.

## What proved it

**Unit** — the pen. `highlightRects` hands the existing `drawSwipes` its rectangles instead
of finding them, so word ink and ayah ink are the same pen; the tests assert one `<line>` per
band, `hl-ink`, the right-to-left wipe, both custom properties, the caps inset, and the dot a
word narrower than the pen produces.

**E2E** — four tests on both viewports (`e2e/word.spec.ts`): the descent and the drag; Escape
climbing one rung and not two; the marquee surviving; and the accessibility tree being
untouched.

**Golden** — one shot, `p7-word-plain.png`, on both platforms. This is the one paint in the
app that is *the same ink laid down twice*: a word band in its own group over an ayah wash
that is still lit, and `mix-blend-mode: multiply` is what turns the overlap into readable
emphasis instead of a second opaque slab. Every DOM assertion above passes identically in the
world where the blend is wrong. The arithmetic was checked by decoding the PNG: the ayah wash
renders `rgb(232,161,58)` and the word band over it renders `rgb(211,102,13)`, which is
exactly `232²/255, 161²/255, 58²/255`.

**The lesson that shot cost, written into the test rather than into a person's memory.** The
first baseline passed every assertion and photographed 15 px of ink in a corner. `ayahTarget`
— correct for a *tap*, and explained at length in `e2e/ayah.ts` — put the press at x ≈ 12 on a
390 px viewport, so the run grew leftwards off the edge of the window. A drag needs something
a tap does not: *room*, in a known direction, inside the frame. Aiming at the widest painted
selection band answers both questions at once, because the selection is already drawn as one
band per line of print with its two ends known. Doubled ink went from 183 px to 3231, and
darwin and linux now produce identical geometry.

## What it does not do

*Both of these were answered the next day, by word-D — [`word-search.md`](word-search.md).
They are kept as written rather than corrected, because what they say about the state of the
app on 2026-08-04 is true and is the reason the next decision took the shape it did. Each
carries its answer underneath.*

**Nothing above the stage listens.** `onSelectWords` is emitted into no handler. What a word
run refines is the mutashabihat search, and that waits on aligning the print's word index with
the QAC segmentation the edges are built from — they disagree on 4,499 of 6,236 ayahs, mostly
because the print counts pause marks as words. Emitting the event now keeps that wiring a
one-line prop; wiring a listener now would mean designing the refinement twice.

> **Answered 2026-08-05.** The alignment landed, and the listener was the one-line prop this
> paragraph promised: `App.handleSelectWords` asks `Adjacency.hopsForWords` which edges the
> run is about. The refinement was designed once.

**It is finger-only, and that is the first thing this app can do that a screen-reader user
cannot.** There is no key that stands for the descent, and the ink goes into `#hifth-overlay`,
which is decorative and adds no node, role or name to the tree. The e2e suite asserts that
emptiness deliberately — it protects the ayah buttons from being buried under overlay nodes,
and it is simultaneously the proof of the gap. Opened as ⑮ and indexed as
`plan-word-selection-is-finger-only`, blocked by ⑬ rather than by a human: until a word run
*means* something there is no outcome to announce, and a keyboard path would reach a state
that does nothing.

> **Answered 2026-08-05, in the order this paragraph set.** ⑬ first, then the key: `Enter` on
> an already-selected ayah descends, the arrows carry the run, `Shift` extends it, `Escape`
> climbs one rung. The announcement is the outcome — «٧ مواضع مشابهة» — and not the words,
> which is the one thing this paragraph got wrong and [`word-search.md`](word-search.md)
> argues out. The tree assertion above kept both its edges: the overlay is still empty, and
> that emptiness is no longer the proof of a gap.
