# Zooming in on the open book could not grow from the right-hand page's edge, so the whole book slides

**2026-10-13.** The owner chose (PLAN item 67, built as item 100) that zooming in keeps the starts
of the lines on the screen. A line of the mus'haf begins at the page's right edge, so the first
idea was the plain one: grow the page from its right edge instead of from the middle.

## What was tried

Growing from the right edge worked at once for a page shown on its own. On the open book it did
nothing at all: the browser test that zoomed both pages to 200% on an iPad on its side was red
before and after the change, with the right-hand page still running about 45 pixels past the
screen.

## What the evidence showed

The open book holds its two pages together at the fold. A zoomed page that is wider than its half
of the book is pinned there, the right-hand page by its inner edge and the left-hand page by its
inner edge, so the two never draw over each other (the fault fixed in #148, where at 150% the two
pages overlapped into one garbled line). That pin overrides wherever the zoom grew from. So the
right-hand page always grows outward from the fold, and its outer edge, where the lines begin,
always leaves the screen first.

Loosening the pin would bring the #148 overlap back, so that was not an option.

## What replaced it

The pages keep their pin, and the whole book slides instead. Each time the page is drawn, the app
works out where the right-hand page's printed edge would land; if that is past the screen's edge,
the book moves left by the difference, and moves back as the page shrinks. The left-hand page then
runs off the left side, the end of its lines, which is the side a hafiz reaches last.

A first version slid the book about 25 pixels too far: it measured the page including the drawn
edge of the paper beside the print. It now measures the printed page alone, once when the page
settles, rather than on every frame.

The old way, growing from the fold, stays as a setting ("Zooming in on the page" in the info
panel). The tests that check the #148 fix still pass with the new default, since the two pages
still meet at the fold; they now meet a little further left.

Left alone: an upright iPad has no zoom buttons, so the rule only reaches the sizes the app sets
itself there. A verse card is docked on the left in both languages and jumping to a verse resets
the zoom, so a card never covers the line starts this keeps on screen.
