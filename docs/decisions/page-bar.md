# Two questions about the page bar: does a juz marker pull, and whose juz is a boundary page?

*Status: both open. This record states the questions and draws the options; it does not choose.*

**The picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/page-bar-options.html> — `page-bar-options.html`, checked in and rebuilt by
`scripts/build-page-bar-options.mjs` from the vendored print's page-of-every-verse table, the
juz table and the bar's own stylesheet. The address is the page's own on the app's site, so it
is public the day the page is merged.

## A few words, defined once

- **The page bar** — the control along the bottom of the app that scrubs through all 604
  pages of the print. Dragging it moves the book; letting go opens the page under the thumb.
- **Juz** — one of the thirty roughly equal parts the book is divided into for reading it
  over a month. A juz begins at a fixed verse, not at a page.
- **Marker** — the short green tick drawn on the bar at the page a juz begins on. Thirty
  of them, added on 2026-09-01 when the bar was redesigned.
- **The bubble** — the label that floats over the thumb while dragging: the page number,
  then the juz and surah of that page, then — if the page is not in this build — the
  nearest page that is.

## Why are these being asked now?

The bar was redesigned in one sitting: thirty markers, a page-shaped handle, and a bubble
that names the juz under the thumb. Two things in that redesign were built one way because
something had to be built, and each is a small decision a stranger to this code could hold
an opinion on. The redesign landed on main on 2026-09-01 the way it was built; asking
before anybody has learned to expect it is the cheap moment.

## What happens if nobody decides?

Nothing breaks. The bar works today as option A of the first question and option A of the
second, and both are defensible. The cost of leaving them is that the second question's
answer already differs between two parts of the app (below), and a third part that reads a
page's juz will inherit whichever it copies from. Nothing else is blocked behind either.

## What have we already decided that touches these?

- The juz jump lands on the page a juz begins on, and says so
  (`desktop-vs-mobile`, row 27: the wheel with Shift held). Both questions take that as given.
- The revision map has a cell per juz that opens it on the lowest page of it this build
  holds (`desktop-vs-mobile`, row 24). That is one of the three exact roads to a juz that
  the first question weighs the bar against.
- The bar's markers cannot be touched — they sit under the thumb so a tick never eats a
  drag. Option C of the first question would reverse that.

## When a reader lets go near a marker, should the bar pull the page onto it?

Today it does not. A release lands on the page under the thumb and the bubble says which;
the marker is a landmark you steer by, not a magnet that catches you.

**What the app does today, measured.** The bar spans 604 pages. Read off its stylesheet,
one page is 1.34 px of track on a laptop (the bar is held to 960 px) and 0.4 px on a
390 px phone. A fingertip is about 26 px, so a drag ends within about 19 pages of where it
was aimed on a laptop and about 65 on a phone. A juz opening cannot be hit by drag on
either; on a phone, its neighbourhood cannot be either. There are three roads that land
exactly: the wheel with Shift held, a cell of the revision map, and the jump box given
"juz 9". Nobody has reported reaching for the bar to get to a juz and missing; the bar is a
week old.

**The options**, each drawn at both widths on the page:

- **A · A marker only marks** — today. Takes nothing. Every page is reachable by drag and a
  release means exactly where the thumb is. Costs the exact road the bar does not give.
- **B · A marker pulls, a few pages either side** — release within three pages of a marker
  and the bar lands on the juz's first page, saying so in the bubble before you let go, in
  the sentence it already uses for a page not in this build. Gets an exact road at the size
  a finger can hit. Costs six pages around each of thirty markers — 180 pages, 30% of the
  book — that a drag can no longer land on, though the arrows still reach them; and on a
  phone the reach is 2.4 px wide, a tenth of the thumb, so it is really "the marker wins
  whenever you are near it".
- **C · A marker is a button; the drag is unchanged** — tap a marker to open that juz.
  Gets an exact road without changing what a release means. Costs thirty touch targets of
  44 px on a 262 px phone track, five times the room there is, so on a phone every drag
  would start on a button.

**What else was considered.** A magnet that only pulls when the drag is slow, or only on a
laptop where the pointer is precise: both make the bar do two different things by device,
which the living desktop-versus-phone record refuses without a phone constraint to name.
Not drawn.

**What would change the answer.** A reader saying they miss. A phone in hand — everything
above is arithmetic on a 390 px window. A hizb layer on the map, which would make a magnet
on thirty marks into one on sixty.

## When a juz begins partway down a page, which juz is that page in?

Twenty-six juz begin at the top of a page. Four begin partway down one — juz 4 on page 62,
juz 7 on page 121, juz 11 on page 201, juz 26 on page 502 — so that page carries the end of
one juz and the start of the next. The page draws each of the four as a schematic with the
seam where the verses put it.

**What the app does today, measured.** It answers two ways. The bar's bubble says the page
is the juz that *begins* on it, because that is the juz whose marker sits there. The
offline-pack shelf and the wheel's "no juz that way" message say it is the juz that was
*already running*, the lowest juz with any verse on the page. On 600 pages the two agree;
on these four they do not. Page 62 is 1 verse of juz 3 and 8 of juz 4; page 201 is 6 verses
of juz 10 and 1 of juz 11.

**The options**, each drawn as the bubble over page 62:

- **A · The juz that begins on it** — today, in the bar. Takes one line elsewhere so the
  pack shelf and the wheel agree. Gets the marker, the bubble and the jump naming the page
  the same way. Costs calling page 201 "juz 11" when it is six verses of juz 10 and one of
  juz 11.
- **B · The juz that was already running** — today, in the pack shelf. Takes one line in
  the bar. Gets the page named for what is at its top, which is what a reader meets first.
  Costs the marker and the bubble disagreeing on four pages: the tick says juz 4 starts here,
  the line under it says juz 3.
- **C · Both, on those four pages** — "juz 3 → 4". Takes a second way of writing the line in
  both languages. Gets no page misnamed and the seam visible from the bar. Costs a wider
  bubble on four pages, and the shelf and the wheel still have to pick one for their own
  sentences.

**What people outside this project do.** The printed Madani mus'haf names the juz in the
running head of every page, so on these four pages the print has already picked one. That
is the convention a hafiz carries, and it is the answer to copy — but nobody has yet turned
to page 62 of a physical copy and looked, and the vendored pages are outlines, so it cannot
be read from the bytes here. A web search on 2026-09-01 for how other mus'haf apps name a
boundary page found nothing that addressed it; the apps looked at list juz and let you jump
to one, and none was seen naming a page's juz at all. So: looked, found no answer, and the
one that matters is in the owner's bookcase.

**What would change the answer.** What the print says on page 62 — that alone should settle
it. A hizb layer, whose boundaries fall mid-page far more often, would make a four-page
special case into a sixty-page one.

## What is this not settling?

- Whether the bar shows hizb marks at all. The map answers that first.
- What a marker looks like. The tick's size and colour were chosen so thirty of them read
  apart from the grey inventory rail, not for either question here.
- Which page a juz jump lands on.

## So what is being decided?

Two things, separately: whether letting go near a marker should pull the page onto it (A, B
or C above), and which juz the bar should call a page that carries a juz seam (A, B or C).
The second has an answer waiting in a printed copy.
