# Could the mark look like a real highlighter: rough at the edges, and darker where two marks stack?

The owner asked to see the mark drawn the way a real highlighter draws: a rough, hand-drawn
edge, and see-through ink that builds up darker where two marks cross. Two researchers each
drew and measured their answer without seeing the other's; a third checked both against the
sources and the browsers, re-measured everything one way, and drew this one page from them.
This record is the decision that page asks for.

*Status: open. The recommendation below is the checker's; the owner has not chosen. The two
researcher pages it was built from stay as the record: [researcher A's](../design/highlight-texture-options-a.md)
and [researcher B's](../design/highlight-texture-options-b.md). What they agreed on, where they
differed and which side the evidence took is laid out claim by claim in
[the consolidated design page](../design/highlight-texture-options.md).*

It is drawn on a real page of the print — page 42, the Throne Verse inside the passage around
it — at the size a phone shows it, with the differences that only show in motion mounted live:

- **The picture, on the site:** <https://blog.bytesofpurpose.com/hifth/docs/design/highlight-texture-options.html>
- **The same page, checked in:** [`docs/design/highlight-texture-options.html`](../design/highlight-texture-options.html), rebuilt by [`scripts/build-highlight-texture-options.mjs`](../../scripts/build-highlight-texture-options.mjs) from page 42's shipped verse and word boxes, its outlined print, the app's own pen and its colours; the pictures the record embeds are cut from it by [`scripts/shoot-highlight-texture-options.mjs`](../../scripts/shoot-highlight-texture-options.mjs).

## A few words, defined once

- **The mark** — the amber the app lays over what you selected: the verse you are on, a passage
  you swept, or a run of words you held.
- **The pen** — how the app draws a mark: one round-ended band along each line, blended into
  the print so the letters stay black. Its strength is how see-through the band is.
- **A pass** — one laying-down of the pen. Two passes over the same place are darker than one,
  as on paper.
- **Shape** — the outline of the band. **Ink** — what happens inside it. **Overlap** — where one
  mark sits inside another: a verse inside a passage, a run of words inside a verse, or a mark of
  another colour.
- **Letters on the mark** — how well the print reads through the amber, as a ratio; 4.5:1 is the
  reading floor.

## What is being decided?

Three things, and they are drawn separately on the page so each can be judged on its own:

1. **What shape does the pen leave?** Today's clean swipe (S1), or a rough band whose edges
   drift, seeded so the same verse gets the same hand every time (S2).
2. **What does the ink do inside the shape?** Flat (T1); two passes laid a little apart, whose
   edges are the texture (T2); or streaks along the line made by a browser filter (T3).
3. **What happens where two marks overlap?** Today's two pens with no rule (O1); one pen where
   every mark is one more pass (O2); a counted number of passes per kind of mark, capped at
   three (O3); and for a mark of another colour, blended in (O4) or cut out (O5).

## What does this change for a hafiz?

You are working through a passage and press one verse in it. Today you see a brown nobody
chose, a passage broken at every verse number, and a word run one step from the reading floor.
With the recommendation you see the passage as one unbroken band per line, the verse darker
inside it, a held run darker again, every letter black, and an edge that looks drawn by a hand
— the same hand every time you come back. Each option's own line for a hafiz is on its card.

## Why is this being asked now?

The owner asked, in those words, after the earlier decisions settled that the mark is a swipe
per line and that a reader may choose its shape and strength. The highlighter is what a hafiz
looks at most, and the pitch build is meant to feel like the real thing.

## What happens if nobody decides?

The app keeps two pens and no rule. Nothing breaks. A verse inside a passage stays brown, a
fourth mark would go darker still, and the passage stays notched at every verse number — that
last one is a defect and is fixed whichever option wins.

## What does the app do today, and what is it costing?

A passage is the pen at 50%, painted one verse at a time; the verse you are on and a run of
words are the pen at full; every band is blended on its own. Measured the one way this page
uses everywhere (the letters as they sit under the mark, against the paper under it): a verse
alone reads at 7.9:1; inside a passage 6.3:1; a word run inside a verse 4.9:1, one step above
the floor. Where two verses of a passage share a line the pen lifts between them and leaves a
notch of paper at the verse number — screenshotted in the real app on the design page.

## What do people outside this project do about this?

Every real highlighter and the careful drawing apps darken where marks cross: Zotero on
purpose, GoodNotes (with a popular request to stop), Procreate's glazed brushes, tldraw's
two-pass highlighter. Hypothesis caps the stack at two levels. Excalidraw seeds its rough edges
so nothing shimmers. Firefox never implemented the filter input that would read the page under
a mark, and people who ship SVG filters on iOS report them slow. Kindle and Apple Books could
not be checked beyond a search snippet. Every source, with whether it was actually read, is in
the design page's claim table and the two research files.

## What have we already decided that touches this?

- The mark is per line, and a reader may choose swipe, fill or outline and a strength in named
  steps ([the shape and strength decision](highlight-style.md)). The pen strength here is what
  the reader's step scales.
- The mark is blended into the print so the letters stay black, and an inner mark of another
  colour cutting itself out of an outer one is already drawn
  ([the mark options page](../design/highlight-options.md)).
- 16.4 KB of the bundle budget is left; the rough band needs under 1 KB of our own code and no
  library.

## The options

Each is drawn on the page; pictures and measurements are in the design record. What each buys,
costs and commits us to:

### A — Keep today: the clean swipe, flat ink, two pens (S1 + T1 + O1)

- **For a hafiz:** nothing changes, except the notch is fixed.
- **Pros:** already built and tested; the cleanest letters at every depth but the third.
- **Cons:** looks computer-drawn, which is the opposite of what was asked; the brown inside a
  passage means nothing; a fourth mark would fall under the reading floor.
- **Commits us to:** nothing new.

### B — The rough band, seeded per verse, flat ink (S2 + T1)

- **For a hafiz:** the mark reads as hand-drawn and is the same hand every visit.
- **Pros:** what was asked for; under 1 KB of our own code, no library, no filter; the same
  size, colour and contrast as today's swipe.
- **Cons:** the far-end lift sits beside the verse number and needs care on every page; a second
  outline to keep honest.
- **Commits us to:** a seeded outline in the pen; either a fourth shape on the reader's menu or
  a replacement for the swipe — which is not settled here.

### C — One pen at half strength; every mark is one more pass, uncounted (O2, researcher B)

- **For a hafiz:** a passage is light, a verse inside it darker, a run darker again — the same
  picture as D where a verse sits inside a passage. A verse on its own is as light as a passage.
- **Pros:** one rule, no counting; how ink behaves on paper.
- **Cons:** a verse on its own — the commonest thing the app shows — drops to 1.5:1 against paper,
  lighter than today; nothing stops a fourth pass, and a repeat press or a link into a swept
  passage darkens the verse further.
- **Commits us to:** every mark painting itself once, and nothing knowing what a place is.

### D — Counted passes at 60%: a passage is one, a verse always two, a run three, never four (O3 + T2, researcher A) — recommended

- **For a hafiz:** the shade says how deep you are. A verse on its own keeps today's weight
  (7.5:1 letters, 2.3:1 against paper); inside a passage it looks the same; a run of words
  inside it is a third pass at 5.7:1; a repeat press never darkens. The verse's two passes lie a
  little apart, which is the hand-drawn texture, with no filter.
- **Pros:** the depth is legible and bounded; letters stay above 5.7:1 at every depth that can
  happen; a verse alone does not go light; the texture comes free; no filter, no library.
- **Cons:** the verse is drawn twice (cheap, but twice the paths); the pen must know what a
  place is — passage, verse, run — not only paint what it is handed; at three times the pixels
  the doubled edge at the band's ends is visible, which a reader may read as character or as a
  slip (a live card lets a hand decide).
- **Commits us to:** a depth on every mark (one to three) that sets its passes; a passage joined
  into one band per line before the pen goes down (which also fixes the notch); the reader's
  strength step scaling the pen, not the count; a new kind of mark needing a stated depth.

### E — Streaks along the line, by a filter (T3)

- **For a hafiz:** the most felt-tip ink of the three, on a desk screen.
- **Pros:** the best-looking ink; thins never below 70% of a pass so the letters hold.
- **Cons:** a browser filter, which both researchers' sources say is slow on a phone and which
  nobody has yet seen drawn on a real iPhone; one report of an older Safari drawing it as a flat
  rectangle could not be checked.
- **Commits us to:** a filter in the pen with a phone-tested fallback, and an iPhone check
  before it ships.

### F — A mark of another colour, blended in (O4)

- **For a hafiz:** where a verdigris passage and the amber verse cross, the letters fall to 4.0:1
  and the colour means neither mark.
- **Pros:** one rule for every colour; how two inks behave on paper.
- **Cons:** under the reading floor where it matters most; mud.
- **Commits us to:** a second colour that must be chosen so its product with amber still reads.

### G — A mark of another colour cuts itself out (O5)

- **For a hafiz:** every colour stays its own, the letters keep a single mark's contrast, the
  join is a hairline of paper at line ends only.
- **Pros:** honest colours; already drawn on the earlier mark options page for the same reason.
- **Cons:** the inner mark must be known when the outer one is painted; a seam to keep tidy.
- **Commits us to:** an order in the pen — inner marks first, outer marks around them.

## What else could we consider, and why is it not here?

A ragged edge by a filter, a patch per line, a chisel stroke, a pressure stroke, grain, drying
ink, plain see-through paint, two hues multiplied by default, a moving edge, strongest-mark-wins,
merging every mark into one shape, and three drawing libraries: each was drawn or measured by
one or both researchers and set aside, one line each, in the design record.

## What would change the answer?

- A real iPhone showing the filtered ink fast and right brings E back as the ink.
- The owner preferring a verse on its own to be light picks C over D; the rest stands.
- A reader test where the doubled edge reads as a slip drops the offset from D, with the count
  kept.
- A change to the reader's strength steps moves the 60% figure; the counts do not move.

## What is this not settling?

Which colours a passage or a run would be if not amber (stand-ins here); whether the rough band
is the default or one more choice on the reader's menu; whether a run is drawn inside a verse
you are not on; anything about notes, crumbs or the look-alike outline.

## So what is being decided?

Shape, ink and overlap, each with its options above. The checker recommends **B for the shape
and D for the ink and the overlap, with G for a mark of another colour** — the rough band, the
counted passes with the second pass a little apart, and the cut-out — and, whichever wins, the
passage painted as one band per line. The owner decides; the page is the place to decide on.
