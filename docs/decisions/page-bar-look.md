# What should the page bar look like so it reads as something you move through the book with?

*Status: decided. The owner chose option A on 25 September 2026.*

## A few words, defined once

- **The page bar** is the control along the bottom of the app. You drag it across all 604
  pages of the print.
- **Juz** is one of the thirty roughly equal parts the book is divided into.
- **The knob** is the part of the bar you grab.

## Why was this asked now?

Two fixes to the bar landed on the same day: juz marks that had stretched into long green
bars, and a grey bar drawn on top of a white one. Once they were fixed, the owner looked at
the result and said the colours did not look good and that it *did not feel like a navigation
bar*. It was a thick grey slab striped with green, and the knob was a small page icon on a
card. It read more like a progress meter than something you could take hold of.

## What do other people do about it?

We looked before drawing anything:

- **Slider guidance** says three things. Colour the part you have already covered differently
  from the part still ahead, with real contrast. Make the knob round and clearly grabbable.
  Keep the track thin, so the knob is the thing that stands out.
  ([Material 3 sliders](https://m3.material.io/components/sliders/guidelines),
  [Smashing Magazine](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/),
  [Setproduct](https://www.setproduct.com/blog/slider-ui-design))
- **Video players with chapters** cut the track into segments with small gaps. The chapters
  show up without a single extra mark.
  ([YouTube chapters](https://www.fonearena.com/blog/313703/youtube-video-chapters-progress-bar.html))
- **E-readers** (Kindle, Foliate, KOReader) use a thin scrub line with chapter ticks and a
  plain knob.

## What were the options?

Each option was drawn on the real bar on a phone and shown side by side in conversation.
Those pictures were not checked in. The winner is now the bar itself, and it can be seen in
the app.

- **Today:** a thick grey slab striped with green, with the page-icon knob.
- **A: thirty juz segments and a round knob.** A thin track cut into thirty pieces by hairline
  gaps, one piece per juz. The part of the book behind you is green, the part ahead is grey,
  and the knob is a round green disc with a white ring.
- **B: thicker blocks, with the page-icon knob kept.** The chapter idea, but heavier, and the
  knob still looks like a card.
- **C: a plain track, a round knob, and juz dots underneath.** The textbook slider. The juz
  move off the track and become a row of dots below it.

## So what was decided?

**A**, by the owner, on 25 September 2026. It follows the guidance above: a thin two-colour
track and a round knob. It also keeps the juz on the track itself, the way a video bar shows
its chapters, so the bar does not need a second row. The juz marks are still buttons. On a
computer, the spread-apart magnifier from [the landmarks decision](./page-bar-numberline.md)
still works on the new look. The pull-or-tap rule from [the marker decision](./page-bar.md)
is unchanged.

## What would reopen it?

A reader on a real phone who cannot find the knob, or who cannot tell the segments from a
dashed line at arm's length. The segment gaps were narrowed to one pixel for exactly that
reason.

## What is this not settling?

What the bar shows when it is magnified under the pointer: which page and juz boundaries,
and how they are labelled. That has its own plan, in
[the zoomed page bar plan](../design/page-bar-zoom-plan.md).
