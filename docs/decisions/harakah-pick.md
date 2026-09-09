# How does a reader pick one vowel-sign to note, when it is smaller than a fingertip?

*Status: open, asked 2026-09-09. This is the gesture the mistake-note decision left
undrawn. That decision settled **that** a reader can pin a note to a single mark once the
finer geometry ships; it did not settle **how** the reader reaches out and takes one mark
when the mark is smaller than the fingertip covering it. Three ways are built live on the
page below, each one a real hand on the real print — you pick by doing them, not by reading
about them.*

**The picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/harakah-pick-options.html> —
`harakah-pick-options.html`, checked in and rebuilt by `scripts/build-harakah-pick-options.mjs`
from page 7 of the vendored print, its shipped word boxes, the per-mark ink positions, and the
app's design tokens. The address is the page's own on the app's site, so it is public the day
the page is merged. It carries no Qur'an text — the print is outlined shapes, and the page
asserts that before it is written.

## A few words, defined once

- **Verse** — one numbered sentence of the Qur'an. 2:38 is the thirty-eighth verse of the
  second surah, and is the verse the page zooms into. It carries sixty vowel-signs.
- **Vowel-sign** — the small mark written above or below a letter that tells you how to sound
  it. Several sit on a single short word, and each is smaller than a fingertip on a phone.
- **Word box** — the rectangle the app already knows for every word, and uses when a reader
  presses to select. The app does not yet reach inside it for one sign; this page is about the
  gesture that would.
- **A note** — the short, private thing a reader pins to a spot: a slip they keep making, or a
  place the print or our drawing of it looks wrong.

## Why is this being asked now?

The mistake-note decision (2026-09-02) said a reader may pin a note to a single mark, and left
one thing for "the building to draw first": the marker and the gesture. The geometry that was
holding it up is now shipped — the ink position of every vowel-sign, on all 604 pages — so the
last thing between the decision and working code is the gesture itself. A sign is smaller than
the fingertip that would land on it, so a plain tap cannot say which one you meant; the page
has to answer *how you say which one* before the feature can be built. This is that page.

## What happens if nobody decides?

Nothing breaks and nothing regresses. A reader can still light a verse and press to a word;
they simply cannot yet pin a note finer than a word. One feature waits behind this — per-mark
mistake notes — and only that one; it is a want, not a wound. The question can sit open at no
cost to anything already shipped. What it does cost is the finer note staying undrawn, and the
finer note is the whole reason the per-mark geometry was shipped.

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

- **A reader can pin a note to a single mark, once the geometry exists** (`mistake-note-anchor`;
  decided 2026-09-02, option D). That decided the *target*. It explicitly deferred the marker and
  the gesture — this page is that deferral, not a reopening of it.
- **The finer marks are held back until the geometry ships** (`mark-granularity`; decided B —
  colour the exact mark when the geometry exists). That geometry has now shipped, which is what
  unblocks this. This page does not reopen it; it uses it.
- **A drag across text selects rather than turns the page** (`word-selection`; decided
  2026-09-02). Two of the three options here start from that same press-to-a-word gesture and
  add a second step inside the word, inheriting it whole rather than inventing a new one.
- **Where a mark sits on the print is a settled registration** (`mark-placement`; decided). The
  ink position each option snaps to is that registration; the options differ in how a reader
  reaches it, not in where it is.

## How does a reader pick one vowel-sign? — the options

Each is built live on the page and tried by hand, on verse 2:38 at the size it would really be
used. All three end the same way — one sign caught, its name and its place read back — so what
you are choosing between is the *reach*, not the result.

- **A · Tap the word, then tap the sign from an enlarged tray.** Tap a word and its handful of
  signs lift out into a row of large, well-spaced targets above the line; tap the one you mean.
  Takes the word boxes the app already ships plus the new per-mark positions. Gets a target big
  enough for any thumb and never covered by the finger choosing it, reached by the press readers
  already use. Costs a second tap and a tray that briefly floats over the line.
- **B · Press the page, and a loupe snaps to the nearest sign.** Press anywhere near the sign; a
  magnifier lifts above the fingertip, shows the ink enlarged, and snaps a box onto the nearest
  sign; slide to correct, release to take it. Takes the per-mark positions and a magnifier. Gets
  a single continuous gesture with no second target to find, and the target shown above the
  finger rather than under it. Costs the precision of the snap — near two close signs it can
  guess the wrong one, and the reader corrects by sliding.
- **C · Tap the word, then tap the sign by its name.** Tap a word and its signs appear as a row
  of *named* chips — each labelled with the sign it is — and tap the name. Takes the same
  geometry as A plus the name of each sign, which the finer corpus already carries. Gets a
  target a reader can pick by *what the sign is* rather than by hitting a small shape, which
  helps a learner who knows the name better than the position. Costs the names taking room, and a
  reader who thinks in positions, not names, being asked to read.

## What else could be considered, and why is it not here?

- **A plain tap with no magnifier or tray.** Left off because it is the thing the page exists to
  rule out: a fingertip covers several signs, so a bare tap cannot say which. Drawing it would
  draw a gesture that cannot work.
- **Type or speak the sign instead of touching it.** Naming the sign in words rather than
  reaching for it. A different feature — a search, not a pick — and it does not put a marker on a
  spot, which is what a note needs. Its own question if it is ever wanted.
- **Pick two signs at once, or a run of them.** The mistake-note decision anchors a note to one
  spot; a run is the word-level anchor it already has. Multi-sign selection is a larger target
  than this page's, and not what the finer note asked for.

## What would change the answer?

- A hafiz trying all three on their own phone and reporting which one lands the sign they meant
  without a second try — the one measurement that beats any argument here.
- The signs on a real verse turning out to sit so close that the loupe's snap is wrong more often
  than it is right, which would weigh against B and toward the tray.
- A reader who cannot see the small print well — for whom the enlarged tray or the named chips
  stop being a nicety and become the only way in — which would weigh against the loupe.

## What is this not settling?

- What the pinned marker looks like once a sign is caught, or where it sits so it does not cover
  the print. That is the other half of what the mistake-note decision deferred, and it is drawn
  next, not here.
- The names shown on the chips in option C, or the size and timing of the tray and the loupe.
  Those are tuning of whichever option wins.
- Anything about how the note is stored or whether it leaves the phone — the mistake-note
  decision already settled that. This page is only the reach that picks the spot.
