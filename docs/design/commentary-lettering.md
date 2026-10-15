# The pitch's notes: do they read the way the printed book does?

> In the private pitch build, each verse opens The Study Quran's note on it. The note's words
> come from a capture of the printed book, and the capture lost things the print has: slanted
> words, some paragraph breaks, the odd letter. This page holds the open questions about putting
> those back, one numbered item each. The history of this work so far is item ① in
> [the commentary design](knowledge-graph-commentary.md); that page's numbering is full, so new
> items continue here from ①. Nothing here reaches the public site.

## A few words, defined once

- **Verse (ayah)** — one numbered sentence of the Qur'an. 6:74 is the seventy-fourth verse of
  the sixth surah.
- **Note** — the book's commentary on a verse, printed under the verse in the book's pages.
- **Slanted words** — the words the book sets in italics: Arabic terms, a note's quotation of
  the verse, book titles. The capture lost all of them, so they are read off the pictures of the
  printed pages by hand.
- **One tap, two taps from the demo** — a note one of the demo's notes links to is one tap out;
  a note one of those links to is two taps out. A reader walking the demo can reach them.

## Open questions, and what would answer each

### ① May the reader for the last 38 notes two taps from the demo open the private note files? · **answered**

**Answered, 2026-10-12:** yes, by the owner. The reader may open the note files in the private
build; the batch runs as the other twelve did, and its rows are checked against the notes before
they go in.

**What it changes for a hafiz:** a reader who follows two links out from a demo note to one of
these 38 sees it with every slanted word upright, where the 398 around it slant as the book
does. It reads as unfinished, though only to someone who goes looking that far.

**Why it is asked now:** the slanted words for the notes two taps out were read in thirteen
batches, each by a separate reader working off the page pictures and the note files in the
private build. Twelve finished on 2026-10-10. The reader for the thirteenth was refused
permission to open the note files, which it needs so each row it writes matches the note's
words exactly. That refusal is a safety check, so it was not worked around.

**If nobody decides:** the 38 notes stay upright. Nothing else waits on them.

**What would answer it:** a yes or no from the owner on letting that reader open the note files
in the private build (they hold the book's text, and stay on this laptop). On a yes, the batch
runs as the others did and its rows are checked against the notes before they go in.

**What this is not settling:** whether to read the slant for notes further out than two taps.

### ② Does a note ever show a space where the book has none, before a semicolon or its last full stop? · **fixed**

**Fixed, 2026-10-15.** A scan of every note found three spaces the capture left: one doubled
between two words (in a note three verses share), one before a semicolon, and one before a
note's last full stop. The page pictures show no word missing at the doubled space, so each is a
stray space and nothing more. The step that sets the book's curly quotes now closes them up,
across the whole book, so no hand-read row is spent on them.

**What it changes for a hafiz:** nothing in the recitation. A scholar reading the note sees the
book's punctuation, not a capture's slip.

**What it keeps:** the book's own space between an ellipsis and the comma or stop after it (five
places). That is how the book prints it.

**The tests:** the typography rule's own tests use made-up words. The pitch test "the commentary
closes up a space the capture left before a semicolon or a closing stop" opens two of the notes;
it was watched failing on the notes built without the rule.

### ③ Does a note's Bible reference open a verse of the Qur'an? · **fixed**

**Fixed, 2026-10-15.** The notes cite the Bible by book, chapter and verse, as in "Genesis 2:7".
The app read every pair of numbers with a colon between them as a surah and verse, so 327 Bible
references were buttons that opened the Qur'an verse with the same numbers. So were 33 more that
carry a Bible list on after a semicolon or a comma without naming the book again, and 4 volume and
page numbers of another book, written after the year of its printing. That is 364 wrong links in
about 230 notes, some of them on the demo's own pages.

The book's own list of related verses under each note had read the numbers the same way. It sent
the reader to the Qur'an verse with a Bible reference's numbers 323 times: under 2:60, seven rows
opened the Qur'an verses that share their numbers with one passage of the Bible. Those rows are
dropped now, unless the note also cites that verse as the Qur'an's.

**What it changes for a hafiz:** a reference opens the verse it names, or nothing. A scholar who
taps a Bible reference is no longer sent to an unrelated verse of the Qur'an. Nor does the list of related verses
offer one the note never cites.

**How it tells them apart:** a reference straight after a Bible book's name stays words when that
book has a chapter of that number. The chapter count keeps a prophet apart from the book named for
him: after "Jonah", a reference to chapter 37 is the Qur'an's telling, since the book of Jonah has
four chapters. A list goes on as the book's while only a comma, a semicolon or an "and" parts one
reference from the next. A reference after a year closing a bracket is a page of that work.

**The tests:** the reference reader's own tests, and the related list's, use made-up sentences.
The pitch tests "a Bible reference in a note is not a link to the Qur'an verse of the same numbers"
and "a note's related verses do not send the reader to a verse the note names only as the Bible's"
open notes that cite both books; each was watched failing on the build without its fix.

### ④ Does a reference the capture wrote with a semicolon for its colon still open its verse? · **fixed**

It did not. Five notes in the whole book had a reference the capture got wrong around a semicolon.
In three, a lone chapter and verse came out with a semicolon where the book prints a colon (under
17:36, 33:33 and 40:23), so it read as two bare numbers and was not a button. In two more (86:15 and
86:16, which share a note), a semicolon ran straight into the next reference with no space after it.

**What it changes for a hafiz:** each of those references now reads as the book prints it and opens
the verse it names.

**How it is mended:** one rule for the whole book, with the quotes and dashes, so no hand-read row is
spent on it. A chapter and verse standing alone with a semicolon between them gets its colon back
when the first number is a surah's. A semicolon after a verse already cited, as in a list of verses
of one surah, stays. A semicolon run into the next full reference gets its space back.

**The tests:** the rule's own tests use made-up sentences. The pitch test "a reference the capture
wrote with a semicolon for its colon is a link again" opens four of the notes; it was watched
failing on the build without the fix.
