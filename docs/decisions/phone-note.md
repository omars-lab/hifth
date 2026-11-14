# How should The Study Quran's note sit on a phone?

**Two questions, both open.** The app shows the first option of each by default, and the others are settings in
the info panel of the private pitch build. The picture is
[the options page](https://blog.bytesofpurpose.com/hifth/docs/design/phone-note-options.html)
([checked-in copy](../design/phone-note-options.html), rebuilt by `scripts/build-phone-note-options.mjs`).

| Word | What it means here |
| --- | --- |
| The note | The Study Quran's translation of a verse and its commentary on it, opened by tapping the verse. Only the private pitch build has it. |
| The commentary | The book's explanation of the verse, under the translation. |
| Upright, on its side | The phone held tall (portrait) or wide (landscape). |

## What is being decided?

Where the note sits on a phone, and what it shows first. On an iPad the note sits beside the verse, so the
verse and the commentary are both in sight. A phone has no room beside, so the note rises as a card from the
foot of the screen.

**What it changes for a hafiz:** tapping a verse on a phone shows the book's commentary on it at once,
with the verse still whole in sight, instead of a translation that has to be scrolled past first.

## Why is it asked now?

The first walk of the pitch on an iPhone (2026-11-14, `docs/design/iphone-app.md` item 3) measured the
longest verse on the demo's path. The short note showed its title and the translation, and **not one line
of the commentary**, whether the phone was upright or on its side. The commentary is what the pitch is for, so a
phone that hides it is a weak first impression.

## What happens if nobody decides?

The app keeps the defaults below. Nothing on the iPad or the computer changes either way. Both questions only
apply when the screen is a phone: at most 600 points wide when held upright, or under 500 points tall (and at least
640 wide) when on its side.

## What does the app do today, measured?

All measured on the longest verse on the demo's path (2:255), in the pitch build, by a script that returns
numbers only. "Lines in sight" means lines of the commentary readable before any scroll.

| Screen | Before | Now (defaults) |
| --- | --- | --- |
| Phone upright, 402 × 874 | 0 lines; commentary starts about 200 points below the screen | 3 lines; the verse whole above the note |
| Phone on its side, 874 × 402 | 0 lines; a strip about 150 points tall | 4 lines; the note beside the page; no verse line under it, but the walk's picture shows the foot bars over the end of the verse (in the backlog) |
| Largest phone on its side, 956 × 440 | 0 lines | 5 lines; no verse line under the note |
| Smallest phone on its side, 667 × 375 | 0 lines | 3 lines; the bars at the foot still cover 2 of the verse's 6 lines (this was already so before; it is in the backlog) |
| Arabic chrome, 874 × 402 | — | the note stands on the left, no verse line under the note |

Three Playwright tests hold these numbers: upright, on its side, and the largest phone on its side. Each
checks at least two lines of the commentary are in sight and that every line of the verse is clear of the note and
the header (`apps/web/e2e/pitch.spec.ts`, "the short note shows the commentary and leaves the verse in sight").
They failed against the old layout first.

## What do others do?

We did not look at other Qur'an apps for this one. Study Bible apps and general reading apps commonly
put notes in a sheet from the foot on a phone, which is what we had. That sheet is what hid the commentary.

## What already constrains it?

- [The commentary is a section inside the verse's note](tafseer.md) (`tafseer-reading`, decided C).
  This decision only places that note on a phone.
- [A phone and a wide window may behave differently](desktop-vs-mobile.md) (`desktop-vs-mobile`), so a
  phone-only layout is allowed.
- [Options that lose stay as settings](graduation-losers.md) (`graduation-losers`, decided A), so every
  option below is built and switchable.

## What should the note lead with, held upright?

| | What it buys | What it costs | What it commits us to |
| --- | --- | --- | --- |
| **A · Two lines of the translation, then the commentary** (default) | The commentary is in sight at once, and the verse stays whole above. The rest of the translation is one tap away. | The translation is cut mid-sentence until asked for. One more button. | A phone leads with the commentary; the iPad keeps leading with the whole translation. |
| **B · The whole translation first, as it was** | Nothing is cut. Same order as the iPad. | On a long verse no commentary is in sight on the first look. | A phone reader learns to scroll the note before the commentary appears. |
| **C · The note opens grown to the full height** | The most commentary in sight. Nothing cut. | It covers the verse it is about. | The note reads as a page of its own, not beside the verse. |

A cuts the translation only in the short note. Growing the note, or tapping "Whole translation", shows all of it,
and the choice is kept for that verse until another verse is opened.

## Where should the note stand with the phone on its side?

| | What it buys | What it costs | What it commits us to |
| --- | --- | --- | --- |
| **A · Standing beside the page, the full height of the screen** (default) | The verse and the commentary side by side, as on the iPad. | It covers the right-hand end of the page strip at the foot. On the smallest phones the foot bars still cover the end of a long verse. | A phone on its side behaves like a small iPad. |
| **B · Lying across the foot, as it was** | The same place as upright. | No commentary in sight; the strip is too short to read in. | A reader turns the phone upright to read a note. |

## What else could be considered?

- **Smaller type in the note on a phone.** It would show more lines, but they would be lines a reader
  has to squint at. Not built.
- **The commentary first, the translation under it.** This changes the book's own order, so it is
  not ours to change in a pitch to the book's team.
- **Hiding the bars at the foot while a note is open.** This would fix the smallest phone on its side,
  but it touches every screen size. It is in the backlog as its own item.

## What would change the answer?

- The owner, or the book's team, trying each on a real phone and preferring another.
- If the cut translation reads as broken rather than shortened, then B or C wins.

## What is this not settling?

It does not settle the iPad, the computer, what the note contains, or how the note grows when dragged.
