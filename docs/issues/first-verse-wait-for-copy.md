# Making the first verse wait for its early copy made it slower — a stream starts sooner

**2026-10-11.** PLAN item 65: on a poor connection, the first verse of a recitation took about
1.4 s to sound after Play was pressed. The fix asks for that verse's file as soon as a control
offering Play comes into reach (the corner's menu, a verse's menu, the tools bar), so the press
finds the file in hand.

## What was tried first

When Play was pressed while that early request was still on its way, the first version waited
for it to finish and then played from the copy, so the file was never fetched twice.

## What the evidence showed

The walk's gap script timed the press to the first sound in Chromium at iPad size, at three
connection speeds, with the reader pausing 0.6 s or 2 s between the menu opening and the press.
Milliseconds, with the setting on against off:

| connection | pause 0.6 s | pause 2 s |
| --- | --- | --- |
| home | 98 (copy) / 177 | 14 (copy) / 175 |
| slow wifi | 570 (network) / 579 | 14 (copy) / 594 |
| poor | 1357 / 1414 | 1366 / 1365 (both network) |

Waiting for the copy instead: slow wifi at 0.6 s took 1092 ms, and the poor line 4958 and 3565 ms,
up to three times slower than doing nothing. A copy needs the whole file; a stream starts once a
small part of it has arrived. On a slow line the gap between those two is seconds.

## What replaced it

A press that finds the copy ready plays it. A press that finds the request still on its way drops
it and plays from the network, which is never slower than having the setting off. A unit test
checks that the request is dropped and the verse streams; the browser test checks that a corner's
menu asks for its first verse as it opens and that Play then starts from the copy.

In the iPad app at home speed, with a 0.6 s pause: 1.07 s to the first sound from the copy,
against 1.73 s with the setting off, and every gap after it about 0.03 s against 0.11 to 0.15 s.

Left alone: on a poor line the first verse still streams unless the reader lingers longer than
the download takes. Carrying recitations inside the app would close that, and is the owner's
question.
