# Some verses had no number button, and many note dots sat off their number

## What was seen

On page 7, verse 2:41 had no number button: a tap on its printed number did nothing, and its
note dot was missing. Counting across the whole book, 208 verses had no place for their
number at all, and where a place was found it was often a little off the printed number.

## How the place used to be found

Nothing told the app where a verse's printed number was, so it guessed. It took the verse's
last line and assumed the number sat in the gap between the verse's last word and the edge
of the verse's outline on that line. If the gap was too narrow, it assumed there was no
number there.

## Why the guess failed

Three different shapes broke it:

- **A tall word from the line above.** In 2:41 a word from the line above reaches down into
  the last line, so it counted as part of that line, and the gap looked too narrow.
- **Outlines that split the number.** On the lines under a surah's opening (3:1 on page 50,
  9:1 on page 187, 10:107 on page 221) the outlines of two verses meet in the middle of the
  number, so neither verse owns the whole gap.
- **A number outside its outline.** 4:2 on page 77 has its number entirely outside its own
  outline, so no gap inside the outline could find it.

Counting a word only when its middle is on the line brought the 208 down to 99, but the rest
could not be fixed by a better guess. Measured against where the numbers really are, the
guess was off by more than 2 page units for 982 verses, and by 17.65 at worst.

## What changed

The page drawings already mark the centre of every printed verse number: 6,236 marks, one
for each verse that ends on its page. The marks do not say which verse they belong to, but
read in reading order (line by line from the top, right to left along a line) they pair off
with the page's verses in order. Only a page's last verse can lack one, when it runs on to
the next page. So the app now reads each verse's number straight off the drawing, and keeps
the old guess only for a drawing with no marks.

## What holds it

- A check that goes through every page in the book, pairs each mark with its verse, and
  requires all 6,236 verses to get a place on their own number (it failed on 99 under the
  old guess).
- Checks on the real pages 7 and 50 that the buttons for 2:41 and 3:1 are drawn on their
  numbers, both on their own and in the pitch build in a browser.
