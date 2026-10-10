# A lost paragraph break that was really a verse's own note in the wrong place

**Found 2026-10-10, reading the lost paragraph breaks left in the pitch's notes.**

## What was tried

The listing of spots where a new paragraph starts mid-line flagged one in a note shared by a run
of verses in surah 6. The plan was the usual one: add a break row, so the panel starts a new
paragraph there.

## What the page showed

On the page picture the spot is not a paragraph start inside the shared note. The shared note
ends there, and the next paragraph is the note of the first verse of the run, printed after it
under that verse's own number. The capture had run the two together, number and all, so the
verse's own note showed under every verse that shares the note, with a stray number in the
middle of the text. A break would have kept the stray number and still shown the verse's note
under every other verse.

## What replaced it

A third kind of row in the list of misfiled paragraphs (`print-refiles.json`): a `split` row names
the spot by the same fingerprint the break rows use (a hash of the letters around it, never the
words). The shared note is cut there under every verse that holds it, the stray number dropped,
and the cut-off part goes to the end of the verse it belongs to. The slanted-words rows written
for that paragraph moved to that verse with it. A made-up unit test holds the cut, and a browser
test checks the verse's note shows under it alone.

## What to look for next time

A lost break in a shared note that lands just after a verse number is probably this, not a
break: look at the page picture for where that verse's own note starts.
