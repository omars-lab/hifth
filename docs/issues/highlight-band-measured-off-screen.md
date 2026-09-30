# A band stopped short of the paper's edge on one page and not on another

**2026-09-30.** The owner asked for the highlighter to stop "a slight margin" past the first and
last word of a line instead of running to the edge of the page. The print's verse boxes are as wide
as the page, so a band that filled its box reached the paper's edge on every full line.

## What we first did

Measure where the page's words start and end, once, from the one shape the print draws them all
as, and cap every band a couple of units past that. Measured from the drawn page, because the
browser already knows the words' box and how the page is scaled.

## What the evidence showed

The first run of the saved pictures after the change looked right on the page the app opens on,
and a second run disagreed with the first on two phrase pictures. A probe opening a link straight to
page 19 six times gave the same ends every time, and every one ran to the paper's edge: the passage
is drawn while that page is still off screen, the browser reports an empty box for its words, and
the pen drew the band at its full length and never came back to it. The opening page was laid out
before its verse was drawn, which is why it looked fixed.

We looked at working the words' extent out from the page file instead, the way the line height
already is, so it could never depend on timing. The words are one shape of about 140,000
characters using the whole drawing language (curves, arcs, relative moves); reading its extent
means a small path reader for one number per page. Not worth it while the browser can measure it.

## What replaced it

The pen still measures, but a band drawn while its page cannot be measured keeps the ends it was
drawn with and waits: it watches the page, and the moment the page takes up room it pulls those
bands in. Same ends, same hand-drawn outline as a verse drawn on a page already on screen. A unit
test draws on an unmeasurable page and then lays it out; a browser test opens a link straight to
page 19 and checks the bands stop near the words. Both failed before the change.
