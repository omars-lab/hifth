# What does the pitch walk find wrong in the iPad app?

*Started 2026-11-09, the day the pitch walk first ran from one command. The walk itself is
`make pitch-walk`; the steps it walks are in the
[pitch script](../../.claude/skills/walk-app/pitch-script.md); the goal it measures is
[the Study Quran pitch](../../.claude/goals/study-quran-pitch.md).*

## The short version

`make pitch-walk` opens the pitch build in the iPad simulator, held sideways, and walks every
step of the pitch script a machine can check (14 of 16; two are by hand). It prints which steps
pass, and keeps a picture of each step in a folder that never leaves this laptop, because the
pictures show the book's text.

**First full walk, 2026-11-09:** 13 of 14 passed in 43 seconds. The one that failed (marking a
mistake) failed because the walk did not know that on the iPad the pens are folded behind
"Mark up"; the walk now opens it, and the step passes. A second full walk lost step 13 another
way: the page was reloaded for the step and never said it was ready, though the same step had
passed minutes before. The walk now reloads once more when that happens, and says so in its log
(`ev=step_retried`). The third full walk passed **14 of 14** in 45 seconds.

Each thing the walk turns up that is not settled is written below, one heading each, and listed
in the backlog.

## Open questions, and what would answer each

### ① How many places should 18:60's note link to? · **fixed**

Step 13 opens the note on 18:60, the start of the story of Moses and his companion, and follows
its link to 18:65. The pitch script says the note links to 8 other places. The walk on
2026-11-09 counted 6 links; an earlier walk by hand counted 7. The walk writes the number down
without judging it, because nobody has checked which is right.

**What would answer it:** count the places the printed note points to, in the book, and compare
with the app's links on that note. If the app shows fewer, find which references it missed and
why; if the script's 8 was wrong, correct the script. Either way, make the walk check the right
number from then on.

**Answered, 2026-11-09: six, and the app has all six.** The note names six places past itself:
18:65, the runs 18:9–26 and 18:83–98 earlier and later in the surah, and 25:53, 27:61 and
55:19–20 in other surahs. The app shows one card for each, all six from the book's own
cross-references; the app adds no look-alikes of its own to 18:60. The note also mentions verse
93, which sits inside the run 83–98, so a count that took it as a place of its own gets seven,
which is likely where the hand count came from. The script's eight was wrong and now says six. The
walk and the browser test for step 13 both check for exactly six cards, so a lost or extra link
fails the step instead of being written down.
