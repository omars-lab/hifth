# How does a reader pick the exact part of a word to note — one vowel-sign, several at once, or the word itself?

*Status: open, asked 2026-09-09. This is the gesture the mistake-note decision left
undrawn. That decision settled **that** a reader can pin a note to a spot finer than a word
once the finer geometry ships; it did not settle **how** the reader reaches out and takes
that spot when the spot is smaller than the fingertip covering it. Three ways are built live
on the page below, each one a real hand on the real print — you pick by doing them, not by
reading about them.*

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
page. That is the finest a reader can point today: a word. On this verse a word carries three
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

- **A · Word, then part — the precision picker.** Tap the word — a big, familiar target — and
  it opens whole, the way it sits in the print, **each letter and each mark its own target**.
  The word stays joined; point at a letter or a mark and the rest fades back so that one part
  stands alone in colour. **A tally beside the word names what you took** — 1 waw, 1 kasra — so
  the pick is confirmed in words, not only in colour. Pick any of them, **several at once**, or
  the whole word **with** its marks or **without**. Takes the word boxes the app already ships
  plus the new per-mark positions. Gets a calm second choice with nothing to aim at small, and
  the one gesture here that reaches *more* than a single sign — a run of marks, or the whole
  word. Costs two deliberate taps rather than one motion, and is the tallest thing to draw on
  the page.
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
- **One change would sharpen the winner rather than replace it.** The precision picker already
  reaches a mark, a run of marks, a single *letter*, or the whole word — pointing at a letter fades
  the rest of the word back so that one letter stands alone in colour, without the joined ink being
  cut. The word is never pulled apart, because a straight vertical line cannot separate cursive
  letters that overlap sideways — a waw's tail sweeps back underneath the letters before it — so a
  cut would leave an empty gap and orphaned ink. Colouring one letter sidesteps that entirely.
  Which colour belongs to which letter is still read from the ink: joined Arabic letters meet at a
  thin stroke, so the picker draws the colour boundary at those thin places. On most words it lands
  cleanly; on a few visually crowded clusters the colour can spill a hair into a neighbour, because
  the thin place it reads is a good guess at the join, not a certainty. The exact fix is known and
  is the step this grows into: shaping the word with its own font, which reports where each letter
  truly begins instead of inferring it from the ink. That would sharpen a handful of imperfect
  edges and change nothing about the gesture — so it is a reason to build on the picker, not a
  reason to wait. The page is honest about this where the letters are drawn.

## What is this not settling?

- What a caught part then lets you write. The four kinds of note are already decided; the menu
  that opens on a selection is shown here only as a hint of where the gesture leads.
- The finer line-by-line straightening of the sign boxes — a separate polish still waiting on the
  owner's eye — and the size and timing of the tray and the loupe, which are tuning of whichever
  option wins.
- The exact edge of the colour that picks out one letter inside a crowded cluster. A reader can
  pick each letter on its own today, but where one letter's colour gives way to the next is read
  from the ink and is a close guess, not a certainty; on a few dense clusters it sits a hair off.
  Making it exact waits on shaping the word with its own font — the next step the picker grows
  into, not a gap in this choice, and the page is honest about it where the letters are drawn.
- Anything about how the note is stored or whether it leaves the phone — the mistake-note
  decision already settled that. This page is only the reach that picks the spot.
