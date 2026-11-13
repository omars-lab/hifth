# The drawer's tools jumped up after they had come to rest

**2026-11-13.** A browser test opens a verse's drawer, presses Same roots, and waits for the
roots list. In the phone-size browser, at the size of an iPad on its side, it failed now and
then: twice in a row on 2026-11-12, then it passed when run again. The cause was a fault a
reader would meet too. The drawer's row of tools moved up after it had stopped, so a press
aimed at Same roots landed on whatever had moved under the finger.

## What we first thought

That the test was slow, or pressed too early. Playwright's own checks were too slow to see
anything. Out of five runs, one failed and four passed, with no clue why.

## What the evidence showed

The test was changed to write down where Same roots stood on every frame from the moment it
appeared. Then it failed five times out of five, and for the same reason each time. The
row moved twice after it had come to rest.

1. **The look-alikes list came late.** The drawer rose before its surah's look-alikes file
   had arrived. When the file came, the look-alikes section grew under the tools and pushed
   the whole drawer up, by 336 pixels at the iPad-on-its-side size. The drawer is pinned to the
   foot of the screen, so anything that grows inside it moves the tools up.
2. **The list was measured before the page lifted the verse.** The tool's list was cut to
   the room left under the lit verse's lines. That was measured as the drawer rose, and the
   page then lifted the verse out of the drawer's way. A second measure 400 ms later saw the
   room the lift had made, and the list grew from 165 to 328 pixels. The tools moved from
   587 to 424.

The cut was added on 2026-11-09, on the belief that an open book cannot move its pages up,
so the list had to fit under the verse where it stood. That belief no longer holds. The open
book lifts the verse too: at the iPad-on-its-side size, the verse's foot went from 523 to 283
pixels. With the lit verse low on its page (2:48, the last verse on that page), the verse
stays clear of a full-height list at both the laptop and the iPad sizes.

## A first try that was not enough

Dropping the cut altogether fixed the jump, but a long verse then went under the list. A
verse nine lines long (2:102) had two lines under the drawer at the iPad size and one at the
laptop size; 2:282, the longest, had eight. However high the page lifts a verse, a full-height
list leaves too little room above it. So the cut stayed, worked out a different way.

Two snags on the way, both found by logging what the drawer saw:

- **The verse's highlight is redrawn as a tool opens,** so it is missing at the very moment
  the list is measured. The drawer now notes the verse's height while it stands with the verse
  lit, and uses that note.
- **The drawer rises with the look-alikes already in it,** so pressing Same roots only swaps
  what is inside. The measuring step did not run again for the new tool. It now runs once per
  tool.

## What replaced it

- **A rising drawer waits for its surah's look-alikes,** at most two seconds. From the
  device the file takes a few milliseconds, so a reader never sees the wait. A drawer that is
  already up is never held back.
- **The list is cut from the verse's height, not its place.** The page lifts a tall verse
  until its first line stands under the hop buttons, or at the page's top. So the room left
  for the list is the window, less that top, the verse's height and a small gap. The list is
  measured once, as each tool opens, and never grows afterwards, so it never moves the tools.
  It is never cut below about ten rows.

Lines of the verse under the drawer, with Same roots open:

| Size | Verse | No cut | Old cut | New cut |
| --- | --- | --- | --- | --- |
| iPad on its side | 2:102 (9 lines) | 2 | 0 | 0 |
| iPad on its side | 2:282 (15 lines) | 8 | 3 | 3 |
| Laptop | 2:102 | 1 | 0 | 0 |
| Laptop | 2:282 | 8 | 2 | 2 |

The new cut keeps the verse as clear as the old one did, without the late jump. The longest
verses still go partly under the list, because it is never cut below ten rows; that was true
before too.

## A third jump, found by running the tests 40 times

With both fixes in, the drawer tests were run 40 times each: 359 passed and one failed. The
row of tools had moved 28 pixels, from 451 to 424, about a third of a second after it stopped.

The cause was the small picture under each look-alike's name, which shows the words the two
verses share. It is cut from the look-alike's own page, so it needs that page's word list. When
the list arrived after the drawer had risen, the picture appeared and its row grew by one
picture line, 28 pixels. That pushed the drawer up. The look-alikes file itself was on time.

**The fix:** until the picture can be drawn, a blank space as tall as one picture line stands
in its place. When the picture comes, it fills that space and nothing moves. If the page turns
out to have nothing to cut, the space closes, which can still move the tools once. That has not
been seen. A run of shared words long enough to wrap onto a second picture line would also
still grow by one line. Both are rare, and the test would show either one.

Two smaller things on the way:

- **The picture was drawn a frame late.** It was drawn just after the frame was shown, so for
  one frame the row had no picture and was shorter. It is now drawn before the frame is shown.
- **The test now turns off the drawer's slide up**, as a reader who asks for less motion would.
  Mid-slide, a busy moment skipped frames, and the test read a point on the way up as the place
  the tools came to rest. Without the slide, the drawer appears where it rests, so any later
  move is a real jump.

## The tests that hold it

In the drawer tools test file, "the tools in the drawer keep still once they have risen":

- With the look-alikes on time, and with them held back for 1.2 seconds, Same roots must not
  move after it first comes to rest, and a press where it rests must open it. The held-back
  case failed five times out of five before the fix. With the wait turned off, it fails again
  (760 → 424).
- A third case holds back the shared words' picture for 1.2 seconds. Same roots must not move
  then either. It failed four times out of five before the blank space was added, and with the
  space turned off it fails again (451 → 424).
- A look-alikes file that never comes back still lets the drawer rise. With the wait made
  endless, that test fails.
- A new test opens Same roots on 2:48, the last verse on its page, at the laptop and iPad sizes,
  and checks that no line of the verse is under the drawer. With the page's lift turned off,
  it fails.
- Another does the same on 2:102, nine lines long. With the cut turned off, it fails (two
  lines under the drawer at both sizes); with the lift turned off, it fails too.

**Results with all three fixes:** the ten drawer tests, run 40 times each at the iPad-on-its-side
size, passed all 400 times. The drawer, look-alike comparison and pitch tests pass in every
browser the project tests (phone, iPad, laptop Chrome, Firefox and Android sizes), and so do the
app's 336 component unit tests.
