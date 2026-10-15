# Reading the book's italics off its page pictures: 94 slanted words in 100 found, 99 in 100 right

**2026-10-14.** The book sets some words of its notes in italics: quotations of the verse, English
glosses, titles of books, and Arabic words written in English letters. Neither the capture nor
the text read off the pages records which. Until now, only two kinds of note showed them:

- the notes within two taps of the demo, read by hand off the page pictures;
- the Arabic terms written with long-vowel or dotted letters in every other note, found by their
  marks ([slanting the transliterated terms](italics-from-transliteration-marks.md)).

That left about three slanted runs in four upright in the 5,716 notes nobody read, and a scholar
in the room might open any verse.

## Short version

- **What was done:** every page picture a note was captured from is read word by word, with how
  far each word's letters lean. Each note is found among its pictures' words, and the words that
  lean are slanted.
- **How good it is:** measured on the 1,012 notes read by hand, it slants 94 in 100 of the words
  the book slants. Of the words it slants, 99 in 100 are slanted in the book: it wrongly slanted
  204 of the 135,851 words the book sets upright.
- **What changed for a reader:** notes nobody read that show any slant went from 1,967 to 5,087
  of 5,716. Their slanted runs went from 4,197 to 20,836, and runs of two or more words, which
  the marks rule almost never finds, from 319 to 12,851.
- **What is left:** about 6 slanted words in 100 still show upright, and about one run in three
  has an edge a word off or is broken in two.

## How the slant is read

Each block of a captured note names the picture it was taken from. Those 890 pictures are read
by a small program on the Mac's own text reader (Apple's Vision). For every word it gives the
text, its box, its printed line and how far its letters lean. Upright type leans about 0
degrees and the book's italic about 10. The lean is found by tilting the word's ink until its
strokes stand straightest. A word with too little ink to say is marked as unknown.

The output holds the book's words, so it stays beside the pictures in the books repository's
ignored work folder, never in this repository. All 890 pictures were read, with none failed.

## How a note finds its words

A picture holds more than the note: the verse in upright type, the notes before and after, and
the running heads. So a note's words are matched to the pictures' words only in runs of at
least three in the same order. Matching ignores case and accent marks, since the text reader
sometimes drops a long-vowel line. A shorter likeness is not trusted. The matcher finds most
words of 5,652 of the 5,716 notes. It finds none in 35, which are mostly a few words long. Those
stay as they were.

## Which words are slanted

- A word leaning between 6 and 20 degrees is slanted. Steeper is a misreading of the ink.
- A word between two slanted ones on the same printed line is slanted too, when it is short
  (three letters or fewer) or leans at least 3 degrees. The print does not end a run for one
  word whose ink reads nearly upright. Two such words in a row do end it. Tried on the read notes,
  letting two words through brought in 83 wrongly slanted words for 231 right ones. Letting
  one through brought in 2 wrong for 136 right.
- Neighbouring slanted words make one run.
- The punctuation at a run's edge follows the book's habit, counted on the read notes. A comma,
  full stop, semicolon or closing parenthesis stays outside: the book keeps them out hundreds of
  times to tens. A question mark, exclamation mark, closing quote or closing bracket the run ends
  on is taken in: the book takes them in 115 times to 11.
- Then the marks rule runs, and slants any marked Arabic term the pictures missed.

Every note of a verse with a hand-read row is left exactly as the rows made it, under every verse
that shares it.

## The measurements

Each of the 1,012 hand-read notes had its slant taken off, and was then slanted again by the
pictures and the marks rule. The 4,290 runs the reader marked were compared with what came back.
Counts only, never a note's words; the scoring tool is in the pitch tools.

| | pictures only | pictures, then the marks |
| --- | --- | --- |
| runs that came back whole | 2,695 | 2,959 |
| runs with an edge a word or a mark off | 975 | 938 |
| runs broken in two or more | 211 | 264 |
| runs missed altogether | 409 | 129 |
| slanted runs where the book is upright | 61 | 74 |
| the book's slanted words found | 16,909 | 17,291 of 18,472 |
| upright words wrongly slanted | 190 | 204 of 135,851 |

The edges that differ are mostly one word: a run starting a word late (226) or ending a word
early (131) or late (103). Extending a run by one more word that leans a little was tried. At 5
degrees it made 10 more runs whole and nothing wrong. At 4 degrees it added 8 wrong words. That
is too little to be worth the rule, so it was not kept.

## Looked at by eye

35:32's note, far from the demo, was set beside its page picture. Its title, its slanted terms
and its quoted phrases matched the print. One quotation came back broken in two. A short word and
the word after it read as leaning about 4 degrees, so the run stopped for them. The one-word rule
above came out of that look. A two-word gap like that one still breaks a run: the measurement
says letting two through costs more than it gives.

## What was tried before this

- A list of the words the hand-read notes always slant (24 words, each seen at least three
  times). On the notes it was built from it found 157 of the 4,290 runs. On notes held out of
  building it, it found about 1 run in 100. It was not shipped.
- Slanting a note's quotation of its own verse. It was right about three times in four
  ([that note](italics-from-quoted-verse-words.md)).
- The marks rule. It is right 99 times in 100, but only finds the Arabic terms, a quarter of the
  runs. It now runs after the pictures.

## Where it lives

- the picture reader: `packages/etl/tools/pitch/page-words.swift`, driven by `page-words.mjs`;
- the matching and slanting: `packages/etl/tools/pitch/picture-slant.mjs`, with its tests on
  made-up words in `picture-slant.test.mjs`;
- the scoring against the read notes: `packages/etl/tools/pitch/picture-slant-score.mjs`;
- the order of the steps: `lettering.mjs` (hand rows, then the pictures, then the marks);
- the pitch test "a note nobody read by hand slants the phrases its printed page slants"
  opens two far notes and checks that whole phrases are slanted. It was watched failing with the
  pictures' words taken away.
