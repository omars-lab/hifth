# Plan: showing page and juz boundaries when the page bar magnifies

*Plan, written 25 September 2026 at the owner's request: "we can show page and juz boundaries
in the zoomed in view". The steps are in the order they pay off. Steps 1 to 3 were built the
same day, apart from thickening the juz you are in; the rest is still to do.*

## A few words, defined once

- **The page bar**: the control along the bottom of the app that you drag through all 604
  pages. Since [the look decision](../decisions/page-bar-look.md), it is a thin track cut into
  thirty segments, one per juz, with a round knob.
- **Juz**: one of the thirty roughly equal parts of the book.
- **The magnifier**: on a computer, the stretch of bar near the mouse spreads apart, the way the
  Mac Dock swells under the pointer, and the juz numbers appear above it. The owner chose this
  on 22 September ([the landmarks decision](../decisions/page-bar-numberline.md)).

## What does the magnifier show today, and what is wrong with it?

Seen on a desktop render of the new bar, with the mouse a third of the way along:

- The juz cuts near the mouse spread apart and each one's number floats above it. That works.
- **No single page is marked anywhere.** At about 600 pixels for 604 pages, the bar has
  roughly one pixel per page. Even inside the magnifier, pages next to the mouse sit only about
  one and a half to two pixels apart. So the reader cannot see where one page ends and the
  next begins, which is the thing the owner asked for.
- The page label under the mouse uses Western digits ("426") while the juz numbers above it use
  Arabic-Indic digits. This turned out to be on purpose: the app shows page numbers in Western
  digits everywhere, because that is the number a reader types into the page jumper. So it
  stays.
- When two juz start close together, their numbers crowd into each other.
- The page label can sit too high and get cut off at the top edge of the bar's area.
- A phone has no mouse, so it gets none of this.

## What do other people do about it?

- **Maps and zoomable timelines add finer marks as you zoom in.** At full view you see years;
  zoom in and months appear, then days. Only the marks with room to be read get drawn. NASA's
  map tool added exactly this to its timeline
  ([MMGIS change #468](https://github.com/NASA-IMPACT/MMGIS/pull/468),
  [follow-up #471](https://github.com/NASA-IMPACT/MMGIS/issues/471)). Research on fisheye
  sliders for lecture video used the same idea: coarse structure everywhere, fine structure
  only under the focus
  ([Tempo-Structural Fisheye Slider](https://www.researchgate.net/publication/221558737_The_Tempo-Structural_Fisheye_Slider_for_Navigation_in_Web_Lectures)).
  An older study compared a fisheye with a full zoom and found the fisheye keeps you oriented
  as long as the far parts do not move
  ([Schaffer et al., via Roseman](https://markroseman.com/pubs/fisheyetochi96.pdf)).
- **Video bars with chapters make the hovered chapter thicker and name it in the preview**,
  so you always know which chapter you are in without reading every chapter's name
  ([YouTube chapters](https://www.fonearena.com/blog/313703/youtube-video-chapters-progress-bar.html)).
- **The Mac Dock uses a smooth bell shape for how much each icon swells.** A straight-line
  falloff makes icons lurch at the edge of the effect. A bell that never quite reaches zero
  makes far icons drift. The Dock's curve (a raised cosine) reaches exactly zero at a set
  distance, so nothing outside the effect moves
  ([Build UI recipe](https://buildui.com/recipes/magnified-dock),
  [a breakdown of the Dock's curve](https://juankproblog.wordpress.com/2011/02/02/the-magnifying-effect-in-the-mac-os-x-dock/),
  [a CSS rebuild](https://dev48v.medium.com/i-rebuilt-the-macos-dock-magnify-effect-in-css-js-9fc2b9ec3b6a)).
- **Phones slow the scrub down instead of magnifying.** In Apple's music and video players,
  sliding your finger up and away from the bar while dragging makes the knob move at half
  speed, then a quarter, then a tenth, so you can land on an exact spot with a fat finger
  ([how it behaves](https://www.howtogeek.com/254608/how-to-scrub-through-audio-and-video-slowly-in-ios/),
  [a rebuild with the speeds](https://arthurhammer.de/2020/03/uislider-with-scrubbing-speeds/),
  [an open-source version](https://github.com/reinerspass/OBSlider)).
- **Slider guidance** asks for a live readout of the value while dragging and marks far enough
  apart to tell apart
  ([Material 3](https://m3.material.io/components/sliders/guidelines),
  [Smashing Magazine](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/)).

## What is the plan?

### 1. Draw page marks only where they have room (the biggest win) — built 25 September

*What was built:* the marks hang like a ruler just under the track, with every 5th one longer.
The page under the mouse is a short green bar between its own two marks. The magnifier now
widens the bar about nine times right under the mouse and eases off towards its edge; the
decision page for the magnifier still shows the gentler curve it was chosen with. Marks are
kept at least 6 pixels apart, because at 4 they bunched up where the spacing switched from
every page to every 5th. The knob and the green part of the track at first stayed put while the
marks around them spread, so near the mouse the knob sat off its own page; since 25 September
they move with the magnifier too. The magnifier never moves the point right under the mouse,
so the mouse only ever reaches the knob where it really is, and a press there still grabs it.

Inside the magnifier, draw a short tick at each page boundary, but only where the spread
leaves enough room to see it. The rule is the map rule: every page if ticks land at least
about 4 pixels apart, otherwise every 5th page, otherwise every 10th. Right under the mouse
you get single pages. A little further out you get fives. Past the magnifier's edge there are
no page marks at all, only the juz cuts that are always there.

To make single pages actually reach 4 pixels apart, the magnifier has to spread more strongly
right under the mouse than it does now. That is a setting on the spread curve, not a new
mechanism. Its edge still stays fixed, so nothing outside the magnifier moves.

The page under the mouse gets its tick drawn in the accent colour and taller than the rest.
The ticks are paint only. The bar's single control, and what the keyboard and screen reader
hear, do not change.

### 2. Make the juz boundary under the mouse unmistakable — built 25 September, with the hizb

*What was built:* inside the magnifier, the edge where a juz begins gets a tall green mark
that crosses the track, named "Juz 30" just under the page marks. The owner also said it was
unclear where each hizb (half a juz) is, so each hizb start gets a shorter, paler mark and
its own name, which gives way to a juz name when the two would overlap. The owner also
reported marks spilling past the end of the bar near page 587. That was the magnifier's
reach running past the bar's end; near an end, the magnifier now only reaches as far as the
end, so the end stays put. The page tag slides back inside the bar there too. Not built yet:
thickening the juz the mouse is inside.

Juz cuts are already there. Inside the magnifier they get taller than page ticks, so a juz
boundary and a page boundary never look alike. The juz segment the mouse is inside gets
slightly thicker, the way a video bar thickens the hovered chapter. That answers "which juz
am I in?" without having to read a number.

### 3. Tidy the labels — built 25 September

*What was built:* the overlap rule below, with juz names ranked above hizb names, and the juz
and hizb names moved under the page marks so the page tag above the bar no longer pushes them
out.

- When two labels would overlap, keep the one nearer the mouse and drop the other. The page
  label always wins.
- Place the labels inside the bar's own area so none of them gets cut off.

### 4. Smooth the swell with the Dock's curve — built 25 September

Today each juz mark grows with a curve that comes to a sharp point right on the mark, so the
size jumps as the mouse passes over it. Swap it for the Dock's raised cosine, which is rounded
at the top and eases in and out. This is small, but do it after step 1,
because the stronger spread in step 1 changes how the edge feels anyway. Judge it by moving the
mouse across the bar, not from a still picture.

Measured on one juz mark as the mouse crosses it: two pixels off the mark, the old curve had
already fallen from 2.4 times the mark's size to 2.2; the new one is still at 2.38. Halfway out
it is at 1.7 where the old one was at 1.35, so the mark starts to grow earlier and the top is
round. The decision page still draws the old curve, since that is what the choice was made on.

### 5. Give the phone its own version: slow down by sliding away

A phone has no hover, so the magnifier cannot appear before you touch. The phone version is
the Apple one: while dragging the knob, sliding your finger up and away from the bar slows
the knob down (full speed on the bar, then half, a quarter, a tenth). The readout above the
finger already says the page, juz and surah, so the reader can see when they reach the page
they want.

This is a real change to how the drag feels, so it is built as options you can try and put to
the owner as its own decision, not slipped in. A second option to try alongside it: show the
same page ticks from step 1 in a strip above the finger while dragging.

## How will we know each step worked?

- A still render at desktop size with the mouse at three spots: near the start, in the middle
  on a juz boundary, and near the end. Single-page ticks should be countable by eye right under
  the mouse.
- The existing automatic checks on the magnifier keep passing: nothing outside the magnifier
  moves, the marks go back to rest when the mouse leaves, and nothing moves while dragging.
  New checks cover the tick spacing rule and the label overlap rule.
- For step 5, a real phone in hand. The automatic browser checks cannot tell whether a slowed
  scrub feels right.

## What is this plan not settling?

- Hizb and quarter marks (the finer divisions inside a juz). They could slot into the same
  "draw only where there is room" rule later, but whether the bar shows them at all is a
  separate question.
- Whether the magnifier appears while dragging on a computer. Today it steps aside during a
  drag, on purpose, so the knob never meets a moving mark.
- Which page a tap on a juz mark opens. That is already decided and unchanged.
