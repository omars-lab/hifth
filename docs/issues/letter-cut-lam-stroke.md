# A lam's upright went to the letter after it

**Found:** 2026-09-26, the first time letters showed in the word tool. **Fixed** the same day.

## What we saw

The word tool opened the last word of Al-Baqarah 39 (*khālidūn*) into its letters. The
second letter (the lam) was nearly empty: a short piece of the line and its kasra. The lam's
tall upright showed as part of the third letter (the dal).

## Why

The cutter picks where to divide letters by cost: thin ink is cheap to cut through, and a
letter far wider or narrower than usual costs more. One rule said: *a tall upright starts its
letter on its right-hand side, so cutting just to the left of one gives the upright to the
wrong letter.* That holds for letters such as kaf and ṭā, whose bodies carry on leftward
past the upright. It fails for lam, which is little more than its upright. For lam, the cut
just left of the upright is the right one, and the rule made it the most expensive. The
cutter then pushed both of this word's cuts rightward, one letter's width each.

## What changed

The rule no longer applies when the letter on the right of the cut is a lam
(`thin(x, n)` in `packages/etl/scripts/lib/letter-cuts.mjs`). Before rebuilding the whole
print, pages 7, 50 and 300 were re-drawn and checked by eye. On page 7 every lam's upright
now takes its own colour (عليكم, التي, الصلوة, تعلمون, أنزلت, الناس). The share of words
cut barely moved: page 7 went from 152 to 148 of 155, page 50 from 139 to 138 of 146, and
page 300 from 145 to 144 of 149. The few extra words are now left whole; which words they
are was not checked one by one.

## What to watch

Other letters built mostly from an upright (a final alif is not an issue, since alif never
joins forward) may need the same exception if they turn up. Look for a copy in the word
tool that is nearly empty next to one that holds two uprights.
