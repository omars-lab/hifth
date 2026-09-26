# The page bar on a phone — how does a thumb land on one exact page?

*Status: open. Four options, each running on the decision page so you can drag them. Nothing
here is in the app yet; the phone bar today is option A.*

**Try it:** <https://blog.bytesofpurpose.com/hifth/docs/design/page-bar-phone-scrub-options.html>
— `page-bar-phone-scrub-options.html`, checked in and rebuilt by
`scripts/build-page-bar-phone-scrub-options.mjs`. Each option is a phone-sized bar over all 604
pages with the real thirty juz openings, and each gives you a page to aim for and tells you how
far off you landed. It works with a finger on a phone or a mouse on a computer.

The difference between these options is felt, not seen: a knob that slows as your thumb rises,
a strip that races or crawls. So they are built, not drawn. The four rules are one module in
the shared core (`packages/core/src/decision-options/scrub-rate.ts`, with its unit tests), and
the page runs that same compiled code. The one chosen graduates into the page bar.

## A few words, defined once

- **The page bar**: the strip along the bottom of the app that you drag through all 604 pages,
  with a page-turn button at each end. It is a thin track cut into thirty juz, with a round knob.
- **Juz**: one of the thirty roughly equal parts of the book.
- **The magnifier**: on a computer, the stretch of bar under the mouse spreads apart so single
  pages can be told apart. It works by hovering, so a phone never gets it.

## What is being decided?

On a phone the bar is about 230 pixels across for 604 pages, so one pixel of thumb is about
three pages. What, if anything, should help a thumb stop on the page it wants?

## Why is this being asked now?

The computer got its magnifier on 25 September, with single-page marks under the mouse. The
phone, where a fat finger needs the help most, got nothing. The magnifier plan left the phone
as its last step, to be tried by hand and chosen rather than slipped in
([the plan, step 5](../design/page-bar-zoom-plan.md#5-give-the-phone-its-own-version-slow-down-by-sliding-away)).

## What happens if nobody decides?

Nothing breaks. The phone keeps option A: drag close, let go, then step with the page-turn
buttons or type the page number.

## What does the app do today, and what does it cost?

The phone bar is the browser's own slider: a tap on the bar moves the knob there, and the knob
stays under the thumb. The readout above the thumb names the page. Landing on one exact page
means holding a thumb still to within a third of a pixel, so in practice it takes a second
step. Nobody has timed it; the page's "land on page N" task is the first measure, and it counts
drags until you land exactly.

## What do people outside this project do?

- **Apple's players** (music, podcasts, video) slow the scrub as the finger slides up: half
  speed from 50 points above the bar, a quarter from 100, a tenth from 150. When the finger
  comes back down, the knob rushes back under it so the two meet on the bar. B and D copy
  those numbers and that return exactly, from a detailed rebuild
  ([UISlider with scrubbing speeds](https://arthurhammer.de/2020/03/uislider-with-scrubbing-speeds/);
  [how it behaves for a user](https://www.howtogeek.com/254608/how-to-scrub-through-audio-and-video-slowly-in-ios/)).
- **Video apps with chapters** show a preview above the finger while scrubbing, which is the
  idea behind C's strip.
- **Qur'an apps:** not looked at again for this question. The look for the magnifier found
  list-and-jump menus, not bars that help you land.

## What have we already decided that constrains it?

- **The bar's look** ([`page-bar-look`](./page-bar-look.md#so-what-was-decided), A): a thin
  track in thirty juz with a round knob. Every option keeps it.
- **The magnifier** ([`page-bar-numberline`](./page-bar-numberline.md#what-is-being-decided),
  B), with page marks drawn only where they have room. The strip in C and D uses the same
  rule, the same function, to choose every page, every 5th or every 10th.
- **A juz mark is a button and the drag never snaps**
  ([`juz-detents`](./page-bar.md#when-a-reader-lets-go-near-a-marker-should-the-bar-pull-the-page-onto-it),
  C). None of these options snaps.
- **Phone and computer may differ only for a reason**
  ([`desktop-vs-mobile`](./desktop-vs-mobile.md)). The reason here is the missing hover.

## The options, each one live on the page

| | What you gain | What it costs | What it commits us to |
| --- | --- | --- | --- |
| **A · today**: the knob follows the thumb | Nothing new to learn or build. | An exact page usually needs a second step. | The phone stays the one place with no help landing. |
| **B · slide up and away to slow** | Exact pages with a thumb, nothing drawn over the page. Familiar from the iPhone. | Nobody finds it untold; a knob drifting from the thumb can look broken. | A way to be discovered: the tutorial, or the speed shown in the readout (as on the page). |
| **C · a strip of page marks above the thumb** | You see how close you are and where each juz opens, with nothing to learn. | At full speed the strip races by, since a thumb pixel is still three pages; it shows the problem more than it solves it. It covers some of the page while dragging. | A second thing drawn over the page on every drag. |
| **D · both** | The strip explains the slowing: it zooms in as you slide up, every 5th page at full and half speed, single pages from a quarter speed on. | The most to build, and the busiest drag. | Both of the above, kept working together. |

## What building it taught

- **C alone mostly shows the problem.** At full speed the strip zooms five times over the bar,
  so single pages would be under 2 pixels apart; the tick rule falls back to every 5th page, and
  the strip slides by about nine pixels for every pixel of thumb. It tells you where you are, but
  not how to get closer.
- **In D the strip does the teaching.** Its zoom follows the speed (five times the bar divided
  by the speed), so one pixel of thumb always moves the strip by the same distance. The moment
  you slide up, the marks spread from every 5th page to every page. That is the change B leaves
  you to feel with no picture.
- **The height bands need room above the bar.** The slowest band starts 150 pixels up, which
  on a phone is well into the page. That is fine while dragging, since the page is not being
  read then, but it means B and D cannot be squeezed into a short strip.

## What else was considered, and why is it not here?

- **Press and hold to magnify the bar in place**, like the computer's magnifier. Under a thumb
  you cannot see the marks you are spreading apart. The strip (C) is the same idea moved to
  where you can see it.
- **A wheel of page numbers**, like a date picker. It lands exactly, but it is a different
  control, and the app already has a box for typing a page.
- **Snap to every 5th page while dragging.** Precise to five, not one, and against the
  decided rule that the drag never snaps.

## What would change the answer?

A real phone in hand. Whether sliding up feels natural, and whether the strip helps or gets in
the way, only show under a thumb; a mouse on the page is a first try, not the test. If readers
rarely want an exact page from the bar and mostly step with the buttons once close, A is enough.

## What is this not settling?

- The computer: the magnifier stays as it is.
- The exact speeds and heights. B and D use Apple's; they can be tuned once one is chosen.
- How a new reader learns about sliding up. That comes with the tutorial, if B or D wins.
