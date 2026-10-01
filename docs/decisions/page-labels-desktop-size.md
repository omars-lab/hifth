# The page now prints its surah, juz and number: on a computer, should that cost verse size, two-page windows, or neither?

**Status:** decided — **A**, 2026-09-30. **Decided by:** omar.

## A few words first

*Verse* — one ayah. *Surah* — a chapter. *Juz* — one of the thirty equal parts a hafiz
revises by. *Two-page view* — on a computer or a wide tablet, the app lays two pages side by
side like an open book.

## What is being decided?

Each page now carries a thin line above the text with the surah's name and the juz, and one
below it with the page number, as a printed mus'haf does (asked 2026-09-30). On a phone the
page is as wide as the screen, so the lines make it a little taller and nothing else changes.
In the two-page view the page's size is set by the window's *height*, so the two lines are
paid for by making the verses smaller.

> **What it changes for a hafiz:** on a computer, every page's verses are about 7% smaller
> (1440×900 window: 393 px of text across → 365 px). A window between 740 and 774 px tall
> that used to show two pages now shows one.

## Why was it asked now?

The browser tests hold a rule from the two-page design (`docs/design/desktop.md` §3): a page
in the two-page view is never smaller than the same page on the narrowest phone the app
supports (290 px across). With the lines added, the smallest two-page window gave 273 px.

## The options

| | what it buys | what it costs | what it commits to |
|---|---|---|---|
| **A. Labels on the paper; the two-page view starts at 775 px tall, not 740** | what was asked, the same everywhere; the phone rule still holds (293 px at the new corner) | verses ~7% smaller on every computer; windows 740–774 px tall get one page | the design note's window arithmetic is redone; the long-press menus on the labels have one home |
| **B. On a computer, the labels sit above the book, beside the tools bar** | full-size verses on a computer; the same windows get two pages | the labels are not on the paper there; a second layout to build and test | the long-press menus need two homes |
| **C. Keep it as built and drop the phone rule** | no more work | at the smallest two-page window a page is 273 px, under a phone's 290 | the rule the two-page window was set by is gone |

## What was chosen, and why

**A.** The labels are part of the page the reader asked for, and the rule that a two-page
page never loses to a phone is kept by moving where two pages begin rather than by bending it.

## What this is not settling

How large the labels are (they keep a 10 px minimum), or what holding one of them does — that
is the long-press work, plan items 25–28.

## Where it lives

The page shape is `aspect-ratio: 345 / 594.85` on a leaf in `PageSpread.module.css`; the
window is `DESKTOP_QUERY` in `useMediaQuery.ts` and the copies of it in the CSS. Held by
`e2e/desktop.spec.ts` ("never gives a leaf less scripture than the narrowest phone does", now
at 1024×775), `e2e/spread-fit.spec.ts` and `e2e/page-labels.spec.ts`.
