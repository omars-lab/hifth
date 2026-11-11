# Start-up got about 150 ms slower in a month. What did it?

*Written 2026-11-11. Item ⑳ in [performance.md](../performance.md).*

## The short version

Features did, by adding about 22 KB to what a reader downloads before the first page can be
used. Nothing that runs at start-up got slower. Start-up time goes up in steps of about 150 ms,
and the app crossed one.

## What was thought, and why it was wrong

The record said start-up went from 2138 ms on 2026-10-11 to 2306 ms on 2026-11-10, that the
app had grown about 10 KB, and that 25 KB of extra download costs 144 ms. So size could not
explain 168 ms, and something at start-up must have got slower. The plan was to measure a
handful of points in the month and close in on the change.

Two of those facts were wrong. The start-up download grew 22 KB, not 10. And the cost of size is
not a slope; it is a staircase.

## What was measured

All on one laptop on 2026-11-11, with the phone the start-up check models (a slow connection
and a processor four times slower). The build of 2026-10-11 was built again from history; the
tools and their versions are the same for every point in the month.

**The two builds side by side, in turns, five rounds:**

| build | readings (ms) |
| --- | --- |
| 11 October | 2558, 2142, 2554, 2553, 2141 |
| today | 2295, 2292, 2292, 2296, 2294 |

The October build reads one of two values. In the slow ones, the first page's drawing was seen
a few thousandths of a second *after* its image was asked for, and the model then counts that
download too. In the fast ones, and in all five of today's, it was seen before. This is the
split [one-language-startup-check.md](one-language-startup-check.md) already describes. The
middle of five was 2138 in October and is 2553 today, on the same code, so the middle is not
the number to compare. The lower group is: about 2140 then, about 2290 now.

**What the full reports say about work at start-up:** no long pause in either build; time
spent running script about 95 ms then and 108 ms now on the modelled phone; eleven requests in
both, in the same order.

**The October build with padding added to its main script:**

| added | readings (ms) |
| --- | --- |
| 5 KB | 2142, 2137, 2138, 2137, 2137 |
| 10 KB | 2140, 2140, 2138, 2138, 2141 |
| 15 KB | 2288, 2138, 2289, 2287, 2286 |
| 20 KB | 2291, 2288, 2288, 2288, 2287 |
| 25 KB | 2290, 2286, 2289, 2287, 2703 |

The step is between 10 and 15 KB, and 15 is right on the edge. That build's start-up download
(main script, English words, style sheet) was 148 KB, so the step is near 160 KB.

**The October build with 12 KB of padding in its style sheet instead**, beside the plain one,
in turns:

| build | readings (ms) |
| --- | --- |
| plain | 2149, 2554, 2141, 2141, 2142 |
| style sheet padded | 2291, 2291, 2141, 2294, 2289 |

It steps the same way. So it is the whole start-up download that counts, not the main script
alone, and the step sits between 158 and 160 KB.

**Today's build with padding:** 2292 ms at 0, 5, 10, 15 and 20 KB added (one stray 2703 in
twenty-five runs). Today's start-up download is 171 KB, so the next step is past 190.

**The sweep of 11 October agrees:** 2138 with nothing added, 2287 with 25 KB, 2436 with 50 and
75, 2586 with 100. Steps of about 150 ms, which is one trip to the server on that connection.

## Which changes

No single one. Between the two builds measured, 22 merges changed the size record. The main
script grew 16.4 KB, the English words 3.9 KB and the style sheet 1.7 KB, which is the 22 KB.
The larger ones, by what each added to the main script:

| pull request | date | added |
| --- | --- | --- |
| #484 | 13 Oct | 1.6 KB |
| #465 | 12 Oct | 1.4 KB |
| #464 | 12 Oct | 1.1 KB |
| #569 | 9 Nov | 1.1 KB |
| #489 | 13 Oct | 1.1 KB |
| #541 | 7 Nov | 1.0 KB |
| #476 | 12 Oct | 1.0 KB |
| #590 | 11 Nov | 0.9 KB |
| the rest | | under 0.9 KB each |

The history of `scripts/budget-baseline.json` has every one.

## What changed because of this

- **The size check has a second limit:** the start-up download may not pass 185 KB, and every
  run prints where it stands. A limit on size was chosen over comparing two start-up times,
  because a time flips between two groups and a size does not.
- **The start-up script can compare built copies** in turns and keep every run
  (`make perf-compare`). Halving the month's merges by time was dropped: with readings that
  come in two groups it would have chased luck.
- **Getting the 150 ms back is its own item** (㉑): move about 12 KB out of start-up.

## What is not known

- Where exactly the step is between 158 and 160 KB.
- Why today's build never reads the slow value while October's does. In today's five runs the
  drawing was seen 6 to 20 thousandths of a second before the image was asked for, so it is
  steadier, but not by a wide margin, and the night of 10 November had one reading of five at
  2405.
- An Arabic reader downloads the Arabic words, which are about 3 KB larger than the English
  ones the limit counts.
