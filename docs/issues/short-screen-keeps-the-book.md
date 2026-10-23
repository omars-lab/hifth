# A short laptop window lost the open book, so the rule for two pages moved

**2026-10-23, PLAN 115.** A browser window under 775 pixels tall got the phone layout: one page,
in the middle of a wide empty table, its last lines hidden under the bars. That covers a
768-pixel laptop, a 720 projector, and a window shrunk to share in a call — the rooms a pitch is
shown in.

## Why the floor was 775

The rule came from one test: two pages side by side must never give a page less scripture than
the smallest phone (320 pixels wide) gives its one page, 290 pixels. The page's height sets its
width, and the bars above and below take about 240 pixels, so a window needed to be 775 tall.

## What the evidence showed

Four windows recorded side by side (`docs/design/screen-shapes/four-windows-before.gif`) showed
what the rule cost below it: one page with its foot cut off, not a bigger page. Measured with the
bars showing:

| window | each page, two pages | one page picked |
| --- | --- | --- |
| 1366 by 660 | 226 px | 226 px |
| 1280 by 610 | 197 px | 197 px |
| smallest phone | — | 290 px |

One page is no bigger than each of two, because the height sets the size either way. So the
phone floor was buying nothing on a short window: it traded two pages for one at the same size,
and cut its foot off. Full screen (the F key) hides the bars: each page is then 340 px at
1280 by 610 and 369 px at 1366 by 660, bigger than a phone's, with the foot clear.

## What replaced it

The owner chose both, as a setting. With a mouse or a trackpad, two pages now hold down to
600 pixels tall, their feet in sight; the one/two page choice in the bar above the book gives one
page, also with its foot in sight. A touch-only screen keeps 775, because an iPad mini on its
side (1133 by 744) would otherwise lose its one page for two smaller ones; that is what the
"hover" part of the rule tells apart. An iPad with a trackpad attached should still count as touch, since the rule reads the main pointer, but that has not been checked on a real iPad. Inside the apps it was checked on 2026-10-23: the Mac app's page says it has a mouse, so it keeps two pages on a short window, and the iPad mini app's page says it is touch.

Two look-alike tests had stood in for an iPad mini with a desktop browser at 1133 by 744; they
now use a touch browser, as the real device is.

## Tests

`apps/web/e2e/desktop.spec.ts`: short windows (1366 by 660, 1280 by 610, 1024 by 600) keep both
pages with their feet clear of every bar; one page picked fills the height with its foot in
sight; a touch screen at 1133 by 744 keeps one page. `apps/web/src/useMediaQuery.test.ts` pins
the rule's text, which the CSS repeats.
