---
name: desktop-edge-grab-turn
description: "On the desktop spread the page turns only by grabbing its outer fore-edge, not by dragging across the middle"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-01T17:31:44.144Z
---

On the desktop two-page spread, turning a page is an **edge grab**, not a swipe
across the page. The user was explicit: hovering the outer sides shows a hand
cursor, grabbing a fore-edge and dragging turns/flips the leaf, and **any drag
that does not start at a page edge must not turn the page** — the middle is left
free to pan and select. Grab zone shape: a strip down each leaf's outer edge that
**widens at the top/bottom corners** (pinched to a sliver at the vertical middle);
the centre fold/gutter is never grabbable.

**Why:** a hafiz turns a physical mus'haf by its fore-edge; the old
drag-anywhere swipe-to-turn fought selecting and panning on a big screen.

**How to apply:** the rails live on the book (one outer edge belongs to the
*facing* leaf, which the live stage feels no pointer on) and drive the live
stage's exposed turn verbs; left edge pulls forward, right edge pulls back
(drag-right = forward, matching the swipe convention). Desktop swipe-to-turn is
off (the live stage gets `dragToTurn={!desktop}`); wheel and arrow keys still
turn. The phone is untouched — it keeps swipe-to-turn and has no rails. See
[[hifth-app-identity]].

**The grab is a trigger, not a tracked band (as of the peel decision).** Reusing
the phone's finger-locked band on desktop drew a thin fore-edge strip creeping
1:1 over a spread whose two pages had not changed yet — the reader saw "a
vertical bar on the same page," not a turn. So the desktop edge verbs now draw
nothing while the hand moves; on release the commit rule decides, and a
committed grab is handed to the *ordinary* animated turn (the same flip a wheel
or arrow plays — grab, wheel and arrows all funnel through `onTurn → turnTo →
runTurn`). A faithful drag-to-**peel** that reveals the destination *opening*
under a lifting corner is the larger job tracked as the desktop page-turn
animation (#11): it must drive **both** leaves at once (the leaf that lifts and
the destination pages sit on opposite sides of the gutter, and which leaf lifts
depends on turn direction), respect "no 170KB SVG glyph moves" (reveal by
masking a corner off the current page over the already-mounted destination
beneath — never a transform on the page), and wants a live browser to tune.
Because every trigger shares `runTurn`, building the peel there gives scroll and
arrows the peel for free — keep that coupling.
