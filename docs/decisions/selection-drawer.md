# How does a reader open the tools for one word, and the tools for the whole verse, from the same page?

*Status: open, asked 2026-09-12. A reader looking at a verse of the print has two different
reaches in mind at two different moments: sometimes they want to do something with a single word
— pin a slip to it, pick a sign inside it — and sometimes they want something for the whole verse
— hear it, read a translation, bookmark it, flag it. This decision is how one gesture on one word
tells those two apart, and where each set of tools lives once it does. The answer drawn below: a
quick tap opens a drawer for the word; a press-and-hold on the same word opens a drawer for the
verse; both are the same sheet rising from the bottom of the screen, on a phone and on a desktop
alike. You decide it by doing it — the drawers are built live on the page.*

**The picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/selection-drawer.html> —
`selection-drawer.html`, checked in and rebuilt by `scripts/build-selection-drawer.mjs` from page 7
of the vendored print, its shipped word boxes, the shaped outlines of verse 2:38, and the app's
design tokens. The address is the page's own on the app's site, so it is public the day the page is
merged. It carries no Qur'an text — the print is outlined shapes, and the writer refuses to save the
page if its own bytes carry an Arabic letter or a text element.

## A few words, defined once

- **Verse (ayah)** — one numbered sentence of the Qur'an. 2:38 is the thirty-eighth verse of the
  second surah, and is the verse the page zooms into.
- **Vowel-sign (mark)** — the small mark written above or below a letter that tells you how to
  sound it. Several sit on one short word, and each is smaller than a fingertip on a phone.
- **A drawer** — a panel of tools that slides up from the bottom of the screen and closes again.
  Here there are two of them, reached by the same press on the same word, and they are the same
  shape on a phone and on a desktop.
- **A note** — the short, private thing a reader pins to a spot: a slip they keep making, a place
  the print looks wrong, a question for a teacher, or a message to the people who build the app.

## Why is this being asked now?

Because the pieces on both sides are ready and have nowhere shared to open. The whole-verse tools
already exist — a reader can hear a verse recited, read a translation, open a commentary, bookmark
it, and pin a note to it. The word's fine picker — the one that reaches inside a word to a single
letter or a single sign — is built and shaped. What was missing was the one gesture that decides,
when a reader reaches for a word, which of the two they get, and one calm place to show each. This
page is that gesture and that place.

## What is being decided?

Two things at once, because they are the same gesture seen from two ends:

- **The split** — a quick tap on a word versus a press-and-hold on the same word, one opening the
  word's tools and the other the verse's. This is the "normal press versus firm press" a phone
  reader already has in their hand from other apps, made to work on a desktop too by being a hold
  rather than a hardware force.
- **The home** — that both sets of tools live in a drawer that rises from the bottom, the same on
  every screen, rather than one shape on the phone and another on the desktop.

It is **not** deciding what the word picker does once it is open — that is its own decision, already
drawn. This page only gives that picker a door, and settles the one thing about its inside that this
feature forced: the parts are laid out with the letters in a row and each sign in its letter's
column, above it or below it, so the grid spells the word.

## What happens if nobody decides?

Nothing breaks. A reader can still light a verse, press to a word, and note it; the verse's tools
still open where they open today. But the two toolsets stay split across two habits and two places,
and the fine word picker — the thing that lets a hafiz pin a slip to a single sign rather than the
word around it — has no door to open through. The cost of waiting is small and real at once: small,
because nobody is blocked; real, because the finest thing this was all for has nowhere to live until
the reach that opens it is settled.

## What does the app do today, and what does that cost?

Today a press on a word lights that word and lets a reader note it — one reach, one depth. The
verse's tools are reached another way. So a reader who wants the verse rather than the word has to
leave the word they are looking at and find a separate control, and a reader who wants a part
smaller than the word cannot ask for it at all. The cost is two: a hop away from the verse a reader
is reading to reach the verse's own tools, and a floor under how fine a reader can point — the word,
never the sign inside it.

## What do people outside this project do about this?

**A fresh external scan was not done for this page** — said plainly rather than implied. The split
drawn here has well-worn cousins that are owed a proper look before this is settled: how a phone's
home screen tells a tap (open) from a press-and-hold (a menu of more) on the same icon; how a map
app opens a short sheet on a tap and a taller one on a longer press; how a reading app pops a word's
dictionary on a tap and a passage's tools on a longer hold. Each is prior art about getting two
depths out of one target without a second control, and each is owed a look this page has not given
it. What is drawn rests on the project's own prior art instead: the press-to-a-word gesture already
shipped, and the four kinds of note already decided.

## What have we already decided that this leans on?

- **A drag across the page selects rather than turns it** (`word-selection`; decided 2026-09-02).
  Both drawers open from that same press-to-a-word gesture; this decision splits it into a tap and a
  hold rather than inventing a new motion, so a reader keeps the one reach they already know.
- **A reader may pin a note to a single spot, in one of four kinds** (`mistake-note-anchor`; decided
  2026-09-02). Those four kinds — a comment, a correction, a question for scholars, a note to the
  people who build the app — are what both drawers carry: the word drawer pins them to the part a
  reader picked, the ayah drawer pins them to the whole verse.
- **How a reader picks the exact part of a word** (`harakah-pick`; open). That is the fine picker
  the word drawer hosts. This page gives that picker its door and settles its layout — letters in a
  row, each sign in its letter's column — but does not reopen which gesture picks a part once the
  drawer is open. That stays the picker's own question.

## How does a reader open each? — the options

The first is built live on the page and tried by hand, on verse 2:38 at the size it would really be
used. The other two are drawn in words so the edge of the choice is visible.

- **A · Tap for the word, hold for the verse.** A quick tap on a word opens the word drawer; a
  press-and-hold on the same word opens the ayah drawer. Both are the same bottom sheet. Takes the
  press-to-a-word gesture already shipped and adds one thing to learn — that holding does more. Gets
  two depths out of one target with nothing new on the page, and keeps the verse's tools on the very
  word a reader is looking at. Costs the discovery — a reader has to find that holding is different —
  and asks the build to tell a tap from a hold without firing on a scroll. This is the one built live.
- **B · Ask which, every time.** Any press opens one sheet that asks "this word, or the whole
  verse?" and the reader picks. Takes the same gesture and hides nothing — no reader can miss the
  verse tools. Costs a question on every single touch and a second tap before any tool at all, for a
  choice that is usually obvious from what the reader is reaching for.
- **C · Two separate handles.** The word's tools open on the word; the verse's tools live behind
  their own control — a handle in the margin, or the verse number. Takes no hold to discover. Costs
  a second thing on the page to find, and the verse tools are no longer reached from the word a
  reader is looking at — the very hop this feature was trying to remove.

## What else could be considered, and why is it not here?

- **A hard press (force touch) as the main way to the verse.** Left off as the primary gesture: only
  some phones sense how hard a finger presses, and no desktop does, so a press-and-hold that works
  on everything is the portable form of the same idea. A phone that senses force can still use it as
  a shortcut to the same hold.
- **A side panel on the desktop instead of a bottom sheet.** Left off so the drawer is one thing to
  learn: the same sheet rising from the bottom on every screen, rather than a sheet on the phone and
  a rail on the desktop that a reader has to learn twice.
- **A right-click for the verse on the desktop.** Kept as a convenience a real build may add on top,
  not the thing the design rests on — because a phone has no right-click, and the design has to hold
  on a phone first.

## What would change the answer?

- A hafiz on their own phone who keeps landing in the word drawer when they meant the verse would
  push the hold shorter, or toward option B's ask-every-time. A hafiz who never discovers the hold
  at all would argue for option C's visible second handle. That one test — a reader reaching for the
  verse's tools without being told how — beats any argument here, and is what the live stage is for.
- A device with no press-and-hold, or a reader whose hand cannot hold steady, changes which option
  is comfortable and may want the visible handle.

## What is this not settling?

- What the verse tools finally hold. Recite, translate, open commentary, bookmark and the four notes
  are shown as the set the app already carries; their own contents and polish are decided elsewhere.
- The exact hold time before a press counts as a hold. That is tuning, not shape, and is set by
  watching real readers rather than argued here.
- How a part is picked once the word drawer is open. That is the picker's own decision
  (`harakah-pick`), still open. This page settles only the picker's door and its layout — the
  letters in a row with each sign in its letter's column — not the gesture that takes a part.
- Anything about how a note is stored or whether it leaves the phone. The note decision already
  settled that. This page is only the two reaches and where they open.
