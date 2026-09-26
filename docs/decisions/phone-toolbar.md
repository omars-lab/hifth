# Where should the page tools sit on a phone?

*Status: decided 26 September 2026 by the owner: **C**, the tray that slides up from the
bottom row. On a computer the tools for noting the page sit in a bar of their own above it; that
bar does not fit a phone. Three ways of fitting it were built into the app and mounted live on
the decision page, and the owner chose by holding each. C is what the app shows; A and B stay
on the page, still tryable, as the rule on losing options asks.*

**The page:** <https://blog.bytesofpurpose.com/hifth/docs/design/phone-toolbar-options.html> —
`phone-toolbar-options.html`, checked in and rebuilt by `scripts/build-phone-toolbar-options.mjs`.
It draws nothing: it mounts the real app three times at phone size, one layout each, picked by
`?phonebar=a|b|c` in the app's address. It carries no Qur'an text.

## A few words, defined once

- **Mus'haf** — the printed Qur'an, shown one page at a time on a phone.
- **Vowel-sign** — the small mark above or below a letter that says how to sound it.
- **The page tools** — select (plain reading), bookmark, note, mistake, vowel-sign, word, and
  highlight: the seven things a tap on the page can mean.
- **The bottom row** — the strip under the page holding the page bar and the bookmarks.

## What is being decided?

Where those seven tools live on a phone, and how a reader switches between them. Only the place
and the reach: what each tool does on the page is already settled and is the same on both
screens.

## Why is this being asked now?

Because the tools now work on a phone. Until this change a phone reader could not reach them at
all — the app forced plain reading on any narrow screen — so marking a slip or opening a word
into its parts was a computer-only thing. This change lets a tap on the page carry the tool on,
the same way a click does, and on a phone the vowel-sign tool takes the sign nearest the tap
(there is no pointer to aim). What was left was where to put the switch.

## What happens if nobody decides?

The app keeps showing C, and A and B stay reachable only by their address. Nothing breaks.

## What did the phone do before, and what did that cost?

It had no tools. The desktop bar was not drawn below a width, and the page was held to plain
reading. Measured at the size the app's own screenshot tests use (a 390 × 844 phone), the page
fills the screen from the top bar to the bottom row; any layout that takes a row of its own
pushes the page's last lines below the fold.

## What do other apps do?

We looked at the pattern the plan named — the drawing tools of FigJam and tldraw, whose bar this
one copies on the computer. On a phone both collapse the bar to a single button near the bottom
that opens the tools, which is closest to B and C. We did not survey reading apps (Quran apps,
e-readers) for this; most of them have no page tools to place.

## What have we already decided that constrains it?

- **Nothing sits on the text while closed** — the same rule that gave the desktop bar a row of
  its own. All three obey it.
- **A phone's tools open from the bottom** — the verse drawer rises from the bottom on a phone,
  and the thumb is already there.
- **The losers stay tryable** — the layouts that lose stay on the decision page, reachable by
  their address, so the reason the choice was a choice can still be felt.

## What are the options?

All three take the desktop bar's own inputs, so the winner drops in with nothing else changing.

| | What it buys | What it costs | What it commits us to |
| --- | --- | --- | --- |
| **A · A strip under the top bar** | One tap to any tool; every tool always in sight; nothing to open. | A row of the screen for good, so the page's last lines fall below the fold on a phone; the top is the hardest reach for a thumb. | Every phone reader pays the row, whether or not they ever use a tool. |
| **B · A pen case in the bottom row** | No room cost; the button's picture shows which tool is on; the fan names each tool. | Two taps for every switch; the fan covers part of the page while open. | The one small button carries the whole state of the tools. |
| **C · A tray that slides up from the bottom row** | No room cost while closed; by the thumb; while open, one tap switches and a line says what a tap on the page will do; closing it returns to plain reading, so no tool is left on by accident. | Hides the page bar and bookmarks while open; two taps to the first tool. | Noting becomes a mode the reader steps into and out of, living in the bottom row. |

**Recommended: C** — the only one that keeps the whole page in view while reading and still puts
the tools and their one-line instruction by the thumb.

## What else could be considered, and why is it not here?

- **A floating button over the page** — rejected by the rule that nothing sits on the text while
  closed.
- **Long-press on the page to choose a tool** — what a press-and-hold on a word means is its own
  open question (how a reader opens the word's tools and the verse's); spending it here would
  settle that one by the back door.
- **Tools in the settings menu** — too far away for something switched several times a page.

## What would change the answer?

If readers mostly switch tools many times a page, A's one tap may be worth its row. If the bottom
row gains something a reader needs while noting (the page bar, to move while marking), C's tray
covering it becomes a real cost and B wins.

## What is this not settling?

What each tool does on the page, the desktop bar, or a crop tool (a separate step, waiting on a
licence check).

## Where does it live in the code?

`apps/web/src/components/PhoneToolbar.tsx` (the three layouts, and the address switch),
mounted from `App.tsx`; the tests are `apps/web/e2e/phone-toolbar.spec.ts`.
