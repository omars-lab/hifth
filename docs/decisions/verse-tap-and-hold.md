# What should a tap on a verse do, and what should holding your finger on it do?

*Status: decided. The owner chose "let the reader pick, with C first" on 1 October 2026.*

The options, drawn on a phone with pictures of each, are in
[the options note](../design/verse-tap-and-hold.md).

## A few words, defined once

- **Verse**: one ayah, with its number in the round marker at its end.
- **The bars**: the strip at the top of the app and the two strips at the bottom (the hint line
  and the page slider).
- **The verse menu**: the tray that rises from the bottom when a verse is chosen (Listen,
  Same roots, Share, Bookmark, On QUL).
- **Hold**: keep a finger on one spot for about a third of a second without moving it.

## Why was this asked now?

Two requests wanted the plain tap: a small menu when you hold a verse, and full-screen
reading, where a tap hides the bars. A tap already chooses a verse, so one of them had to give.

## What were the options?

| option | pros | cons | what it commits us to |
| --- | --- | --- | --- |
| **A**: a tap hides or shows the bars; a hold opens the menu, with four more buttons | a stray tap no longer paints the page; full screen is one tap | a reader taught "tap a verse" has to learn the hold | the hint line has to teach the hold |
| **B**: a tap or a hold opens the fuller menu; full screen is a button | nothing to relearn | full screen is a reach away; every tap still paints | a button in the bottom line |
| **C**: a tap opens the menu as before; a hold opens a small menu beside the verse; full screen is a button | today's tap is untouched; the new things are one hold away | two menus to learn; a small menu can cover its verse if placed badly | the small menu must stand clear of its verse, and a test holds it to that |
| **Let the reader pick, C first** | each reader keeps the one that suits them; C changes nothing for anyone who never opens settings | three ways to keep working, and to test | a setting in the info panel |

## So what was decided?

**Let the reader pick, with C first.** The info panel has *Tap and hold on a verse*, with all
three. The options note recommended A; making A the default later is a one-line change. On a
computer a click always opens the menu, since a mouse has no natural hold, and F switches full
screen in every option.

Assumed while building, to correct if wrong: Mark paints the one verse as a highlight; Play to
waits for the next verse you tap and recites from the held verse to that one; Copy puts the
verse's name and a link on the clipboard, never its words.

## What is this not settling?

- Holding the page number, the surah name or the juz: its own question (plan item 27).
- The thin blue box a finger's tap draws around a verse (plan item 30).
- Translation in the small menu: it stays in the menu a tap opens.

## Open questions, and what would answer each

### ① In full screen, should the tools stay within reach? · **open**

**What would answer it:** a rough build of full screen with the tools kept, tried by the owner
on the laptop beside today's full screen.

**Asked by the owner, in a comment left on the app's page (2026-11-07):** *"Where is the side
tool bar?"* Full screen hides every bar, the tools included, so the page takes all the room.
To mark the page you have to leave full screen first (F, or the small button in the corner).

**What it changes for a hafiz:** revising in full screen, they cannot mark a mistake or a
look-alike without leaving it, which breaks the reading they went full screen for.

**Options to build and try, each a setting if it loses:**
- full screen keeps the tools down the side, where the page does not reach;
- the tools come back while the pointer rests near the side, and go again after;
- a small dock of tool icons stays in full screen and opens out while the pointer is over it,
  like the Dock on a Mac (the owner's second comment, 2026-11-07: *"a small minimal icon dock
  that expands when we hover over it in desktop mode"*); a phone has no pointer to hover, so
  its equivalent is still to be found — a candidate is a small handle at the edge that a tap
  opens;
- full screen stays as it is, for reading only.

**If nobody decides:** full screen stays for reading only, and marking means leaving it.

**Built 2026-11-13, the first three and today's way, as a setting** in the info panel, under
"In full screen, the tools", on a computer and a sideways iPad:
- **Stay down the side** (the default for now): the tools stand down the side of the window in
  full screen, on whichever side the pens stand. The book keeps clear of them at their widest,
  with the highlighter's pens out, so the page does not shrink under the hand each time a pen
  tool is picked. On a 1024-wide screen that makes the book about 4% narrower than full screen
  was before; on a wider one it only moves the book a little off centre.
- **Hide at the edge until the pointer comes:** the tools slide out of sight and come back while
  the pointer rests at that side of the window, then go a moment after it leaves, like the Mac's
  Dock set to hide itself. They come over the page while shown, and keep no room.
- **A small dock that opens out:** the same icons at half size, opening out under the pointer.
  On a touch screen the first tap only opens it and picks nothing, since the icons are too small
  to aim at; a tap elsewhere shuts it.
- **Go away with the bars:** full screen as it was, for reading only.

In full screen the tools' corner button reads "Leave full screen" and leaves it. Tested in
`apps/web/e2e/full-screen-tools.spec.ts` on laptop Chrome and Firefox, which marks a mistake
without leaving full screen and checks the tools cover no page at five screen sizes. Left: the
owner tries the four and says which becomes the default.

**Built 2026-11-14 for a phone and an upright iPad, three ways, as a second setting** under the
same heading in the info panel, shown only on those screens (there is no room down the side, and
no pointer to rest at an edge):
- **A Tools button in the corner** (the default for now): a round button stays in the bottom
  corner, across from "Show the bars", and shows the tool in hand. It opens the same tray of
  tools the bottom line has; picking a tool folds the tray back to the button, so the tray never
  lies on the page's last lines while you mark them. This is the phone's answer to the dock.
- **The bottom line stays:** full screen puts away only the top bar and the page slider; the
  bottom line, tools and all, stays, with its own "Show the bars".
- **Go away with the bars:** as before.

Looked at on a 390-wide phone and a 768-wide upright iPad, in English and Arabic: the button and
"Show the bars" sit apart at the foot, below the page. Tested in
`apps/web/e2e/touch-full-screen.spec.ts` on the iPhone and Android runs, which marks a mistake on
the last line without leaving full screen. Those tests found two faults the same day, both
fixed: on a 664-tall iPhone in Safari the button lay on the page's bottom corner, where a line
ends in Arabic, so upright the page now keeps a strip the button's height at its foot and is
held to the height left, with Safari's install notice up too (on its side the page stands clear
of the corner and keeps its size); and picking the highlighter folded the tray before its colours could be picked, so
a tool with a second row now keeps the tray up until that choice is made. A third, found by eye
the next morning: the strip kept for the button showed the app's paler colour and read as a bar,
so the surface the page lies on now runs to the foot of the screen under the button. A sheet
opened in full screen (the look-alikes list) still covers the whole foot of the screen and the
button; both are tested. Looked at in the iPad app on an iPad mini simulator, upright: the button
sits clear of the home bar (a 25-point gap there), off the page and apart from "Show the bars",
and the page is the same size as before. Not yet looked at in Safari on an iPhone simulator,
because full screen cannot be opened there by link. Left: the owner tries the three on the phone and the iPad and says
which becomes the default.

### ② Should full screen fold away the "Install Hifth" notice too? · **fixed**

**Found 2026-11-14** while testing the Tools button in full screen. On an iPhone in Safari, before
the app is installed, the notice "Install Hifth so it stays with you offline" stayed at the top
in full screen. It took about 160 points above the page, so the page the reader had asked to see
whole was pushed down or made smaller until they hid the notice.

**What was done (2026-11-14).** Full screen now folds the notice away, the same way the
first-visit tips already held it, and it comes back when the bars do. It is a notice the reader
can act on, so it is moved out of the way while reading, not dismissed. Looked at in a
phone-sized window: the page now starts near the top of the screen instead of under the notice.
Tested on the iPhone run in `apps/web/e2e/touch-full-screen.spec.ts` ("full screen folds the
install notice away"), watched failing first.
