# How does a reader pick the exact part of a word to note — one vowel-sign, several at once, or the word itself?

*Status: decided 26 September 2026 by the owner: **D**, which none of the three drawn ways was
on its own. The magnifier from B becomes its own tool, and the fuller version of A becomes a
second tool. C is dropped. The page below keeps all three running as they were tried.*

## So what was decided?

**D: two tools on the tool bar, each doing one job.**

- **A sign tool** ("harakat"). With it on, the magnifier from B follows the pointer over the
  page with no press and hold first, and rings the vowel-sign nearest the pointer. A click takes
  that sign and opens a note on it. The press was only ever there to tell a pick apart from the
  page's other gestures; once a tool is on, a plain touch already means "pick", so the press is
  dropped.
- **A word tool.** Tap a word and it opens into its parts, the fuller version of A: a row of
  copies of the word, one for each part, with that part inked and the rest faint. A note can be
  dropped on any part: one sign, several, a letter, or the whole word with or without its marks.

The owner's reason, in their words: the magnifier "should be a feature ... but without a press
... its own harakat tool", and "a separate word selection tool that breaks down a word in the
fuller version of option A ... and lets us drop notes on any part of the word". Trying the
three showed they were not rivals: B is quickest when you can see the sign you mean, and A's
fuller row is the only one that reaches more than one sign or a letter. So each gets its own
tool instead of one winning.

What follows for the build: the mistake tool's second tap opens the word tool's row rather
than the plain tray, the tray and the named row (C) leave the app, and the letters of every
word need their own shapes, which today exist for one verse only. Until they do, the word tool
opens each word into its signs and the whole word, and the letters come with the shapes.
Where those shapes come from was its own question, settled 2026-09-26: cut from the print
itself, checked by eye ([letter-parts](letter-parts.md)).

*Before that, updated 2026-09-25: the three ways were made three interchangeable pieces of code
behind one shared shape (`packages/core/src/decision-options/harakah-pick.ts`, `OptionA` to
`OptionC`), and the page runs that very code.*

**The picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/harakah-pick-options.html> —
`harakah-pick-options.html`, checked in and rebuilt by `scripts/build-harakah-pick-options.mjs`
from page 7 of the vendored print, its shipped word boxes, the per-mark ink positions, and the
app's design tokens. The address is the page's own on the app's site, so it is public the day
the page is merged. It carries no Qur'an text — the print is outlined shapes, and the page
asserts that before it is written.

## A few words, defined once

- **Verse** — one numbered sentence of the Qur'an. 2:38 is the thirty-eighth verse of the
  second surah, and is the verse the page zooms into.
- **Vowel-sign** — the small mark written above or below a letter that tells you how to sound
  it. Several sit on a single short word, and each is smaller than a fingertip on a phone.
- **Word box** — the rectangle the app already knows for every word, and uses when a reader
  presses to select. This page is about reaching *inside* that rectangle.
- **A note** — the short, private thing a reader pins to a spot: a slip they keep making, or a
  place the print or our drawing of it looks wrong.

## Why is this being asked now?

The mistake-note decision (2026-09-02) said a reader may pin a note to a single spot, and left
one thing for "the building to draw first": the marker and the gesture. The geometry that was
holding it up is now shipped — the ink position of every vowel-sign, on all 604 pages — so the
last thing between the decision and working code is the gesture itself. A sign is smaller than
the fingertip that would land on it, so a plain tap cannot say which one you meant; the page
has to answer *how you say which part* before the feature can be built. This is that page.

## What is being decided?

How a reader picks the exact part of a word to pin a note to. Not only one vowel-sign — the
picker built here reaches finer *and* wider than that: one sign, several signs at once, the
letters, or the whole word with its marks or with the marks stripped off. The question is the
**reach** — the gesture that takes any of those parts — not which parts exist, which the print
already fixes.

## What happens if nobody decides?

Nothing breaks and nothing regresses. A reader can still light a verse and press to a word;
they simply cannot yet pin a note finer than a word. One feature waits behind this — per-mark
mistake notes — and only that one; it is a want, not a wound. The cost of waiting is small and
real at once: small, because nobody is blocked; real, because the two things this was for — a
hafiz pinning a slip finer than a word, and flagging a sign the print gets wrong — both need to
reach the sign, not the word around it.

## What does the app do today, and what does that cost?

Press and hold, and the selection drops to the word under the finger and does not turn the
page. That is the finest a reader can point today with the selection: a word.

Since 2026-09-25 the tool bar also has a **mistake tool** (key M, step 3 of
`docs/design/page-toolbar-plan.md`): tap a word and it is marked in a quiet red; tap the marked
word again and a picker opens to say which sign the slip was on. That picker is way **A** below
— the tray — because nothing reached finer than a word before, so there was no "today" to keep,
and A is the one that starts from the same word-tap the tool already uses. It is mounted behind
the same shared shape as B and C, so whichever way the owner chooses replaces it without the
tool changing. Before that picker existed: On this verse a word carries three
to five vowel-signs, so "the word" is three to five different things a reader might have meant
and cannot separate. The cost is exactly that ambiguity — a hafiz who always slips on one
vowel of one word can record the word, not the slip.

## What do people outside this project do about this?

**A fresh external scan was not done for this page** — said plainly rather than implied. The
gesture here has close cousins worth a proper look before this is settled: how a map app lets a
thumb place a pin under its own fingertip (a magnifier that lifts the target above the finger),
how a text editor on a phone places a caret between two characters too small to tap between, and
how a hafiz marks one vowel in a paper mus'haf with a pencil. Each is prior art about reaching a
sub-fingertip target, and each is owed a look this page has not given it. What is drawn rests on
the project's own prior art instead: the press-to-select gesture already shipped, and the
per-mark ink positions already measured.

## What have we already decided that touches this?

- **A reader can pin a note to a single spot, once the geometry exists** (`mistake-note-anchor`;
  decided 2026-09-02, option D). That decided the *target*, and the four kinds of note it can
  carry — a comment, a correction, a question for scholars, a note to the people who build the
  app. It explicitly deferred the marker and the gesture — this page is that deferral, not a
  reopening of it. The action menu the picker shows on a selection is those same four kinds.
- **The finer marks are held back until the geometry ships** (`mark-granularity`; decided B —
  colour the exact mark when the geometry exists). That geometry has now shipped, which is what
  unblocks this. This page does not reopen it; it uses it.
- **A drag across text selects rather than turns the page** (`word-selection`; decided
  2026-09-02). The precision picker and the named-row option both start from that same
  press-to-a-word gesture and add a second step inside the word, inheriting it whole rather than
  inventing a new one.
- **Where a mark sits on the print is a settled registration** (`mark-placement`; decided). The
  ink position each option snaps to is that registration; the options differ in how a reader
  reaches it, not in where it is.

## How does a reader pick the exact part? — the options

Each is built live on the page and tried by hand, on verse 2:38 at the size it would really be
used. None aims at the tiny target directly.

- **A · Word, then sign.** Tap the word — a big, familiar target — and its signs lift into a
  tray beneath it, each one a finger-sized window on the print, enlarged, with its name under
  it, in the order you read them. Tap the one you mean, or "the whole word". This is what the
  app's mistake tool shows today, as the stand-in. It works on every page, because it needs
  only the word boxes and sign positions the app already ships. Gets a calm second choice where
  every target is finger-sized and you still see the ink you are choosing; costs a second tap.

  **Its fuller version — the precision picker**, kept behind a switch under A on the page. Tap
  the word and it opens into a row of copies: **one copy of the whole word for each letter and each mark**.
  In a copy, the one part it is for is drawn in solid ink and every other part in invisible ink,
  so you still read which word it is but only that one part is there to take. **Point at the copy
  for the part you mean** and take it; take **several at once**, or the whole word **with** its
  marks or **without**. **A tally beside the row names what you took** — 1 ta, 1 kasra — so the
  pick is confirmed in words, not only in ink. Each part is its own outline shaped from the
  word's own font, so a solid part never drags a neighbour's ink with it: the ta comes without
  the ya. Takes the word boxes the app already ships plus the shaped outlines of the verse. Gets
  a calm second choice with nothing to aim at small, and the one gesture here that reaches *more*
  than a single sign — a run of marks, or the whole word. Costs a row you scroll along rather
  than one motion, is the tallest thing to draw on the page, and today exists for this one verse
  only: the font shapes it draws from are made verse by verse, and no other verse has them yet.
- **B · Press &amp; loupe.** Press anywhere near the sign; a magnifier lifts above the fingertip,
  shows the ink enlarged, and snaps a box onto the nearest sign; slide to correct, release to
  take it. Takes the per-mark positions and a magnifier. Gets a single continuous gesture that
  reaches for the ink itself, shown above the finger rather than under it. Costs a steadier hand,
  and the precision of the snap — near two close signs it can guess the wrong one, corrected by
  sliding. Reaches one sign only, not a run.
- **C · Word, then names.** Tap the word and its signs appear as a row named in words; pick by
  name. Takes the same geometry as A plus the name of each sign, which the finer corpus already
  carries. Gets a target a reader can pick by *what the sign is* rather than by hitting a small
  shape, and one a screen reader can read out loud. Costs the names taking room, and a reader who
  thinks in positions, not names, being asked to read. Reaches one sign only.

## What else could be considered, and why is it not here?

- **A plain tap with no magnifier, tray, or rows.** Left off because it is the thing the page
  exists to rule out: a fingertip covers a dozen signs, so a bare tap cannot say which. Drawing
  it would draw a gesture that cannot work.
- **A long list of every sign on the page.** Left off: it turns a spatial choice into a reading
  task and loses the place on the page the reader is looking at.
- **Typing the address of the sign** (this word, this sign). Left off: nobody thinks of a slip
  that way; it is a developer's handle, not a reader's.

## What would change the answer?

- A hafiz trying all three on their own phone and reporting which one lands the part they meant
  without a second try — the one measurement that beats any argument here.
- A reader who cannot hold the press steady enough for the loupe would rule it out; a reader who
  does not know the names would rule out the named row; a device with no hover or no fine pointer
  changes which is comfortable.
- **One thing that would have sharpened the winner has now been built into it.** An earlier
  precision picker kept the word's joined ink and told one letter from the next by colour, reading
  the boundary from the thin stroke where two letters meet. That was a good guess, and on most
  words it landed cleanly, but on a few visually crowded clusters the colour spilled a hair into a
  neighbour — the ta caught a little of the ya — because a thin place is where the join *usually*
  is, not a certainty, and a straight cut could not have separated cursive strokes that overlap
  sideways at all. The picker no longer guesses. The verse is now shaped from its own Qur'an font,
  so every letter and every mark is its own outline, and each copy of the word shows exactly one
  of them in solid ink with the rest in invisible ink. There is no colour boundary left to read,
  and no cluster where one part's ink reaches into the next: the ta comes without the ya. This
  sharpened the winner and changed nothing about the gesture — it was a reason to build on the
  picker, not to wait, and it is done.

## What is this not settling?

- What a caught part then lets you write. The four kinds of note are already decided; the menu
  that opens on a selection is shown here only as a hint of where the gesture leads.
- The finer line-by-line straightening of the sign boxes — a separate polish still waiting on the
  owner's eye — and the size and timing of the tray and the loupe, which are tuning of whichever
  option wins.
- ~~The exact edge of the colour that picks out one letter inside a crowded cluster.~~ **Settled
  while this stayed open.** This once sat here because the picker read the boundary between two
  letters from the ink and, on a few dense clusters, sat a hair off. It no longer does: each letter
  is now its own font-shaped outline, so there is no colour edge to guess and no cluster where one
  letter's ink reaches into the next. It is left here, struck through, so a reader sees it was
  considered and closed rather than dropped.
- Anything about how the note is stored or whether it leaves the phone — the mistake-note
  decision already settled that. This page is only the reach that picks the spot.
