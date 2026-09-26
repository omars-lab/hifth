# How should the word tool show a word's letters?

*Status: decided 26 September 2026 by the owner: **A**, cut the print itself at the points where
one letter joins the next, and check a sample by eye before it ships.*

## A few words, defined once

- **Mus'haf** — the printed Qur'an, shown one page at a time.
- **Vowel-sign** — the small mark above or below a letter that says how to sound it.
- **The word tool** — tap a word and it opens into a row of enlarged copies of itself: the whole
  word, then one copy for each vowel-sign with that sign in full ink and the rest faint. Picking a
  copy drops a note on that part.

## What is being decided?

How a letter becomes one of those copies, so a note can point at one letter — "the qaf here was
read as a kaf" — rather than at the whole word.

## Why is this being asked now?

The earlier choice of how to pick part of a word said the row would take letters "when each
letter has its own shape". The signs are in the row today, on all 604 pages; the letters are the
part left. Building them forced the question of where a letter's shape comes from.

## What happens if nobody decides?

The row keeps its signs and the whole word. A slip on a letter can still be noted on the whole
word; it just cannot point at the letter.

## Why is it a question at all?

Because the print does not know where its letters are. The print's own font draws each word as a
single piece of ink, so it holds each word's outline, not each letter's. The signs are different:
they are separate marks, and their positions are already measured on every page. A letter is not
separate from its neighbours — Arabic letters join — so its edges have to come from somewhere.

## What have we already decided that constrains it?

- **Every copy in the row is the print itself** — the signs and the whole word are cut from the
  page's own drawing, so what a reader picks is what they read.
- **The app carries no Qur'an text** — the page is shown as a picture, not as letters.
- **A placement that could sit off is checked by eye before it ships** — the same rule the signs'
  positions went through.

## What were the options?

Shown to the owner side by side, each with what it buys, costs and commits to.

| | What it buys | What it costs | What it commits us to |
| --- | --- | --- | --- |
| **A · Cut the print at the joins** (chosen) | Every copy stays the real print, matching the signs and the whole word beside it. | An earlier attempt at finding joins in the ink sat a hair off on a few crowded clusters; it needs a by-eye check before it ships. | A new piece of page data — where each letter starts and ends — and a sitting to check it. |
| **B · Shape every word in a typeface** | Clean, exact letter edges on every page; already done for one verse. | The letters would be drawn in a different typeface from the print beside them; tens of KB more data per page. | The app would ship outlines that spell every word, which pushes against carrying no Qur'an text. |
| **C · Name the letters, no picture** | Smallest to build, and exact. | A reader picks a letter by its name rather than by seeing it. | The names spell the word, so this also carries the text, in Latin letters. |
| **D · Leave letters for now** | No new data, no risk. | A note cannot point at one letter. | Nothing; the item goes back to the list. |

## So what was decided?

**A.** The owner kept the rule that every copy is the print. The letter edges are found in the
page's own ink, and a sample — always including the crowded clusters where the last attempt went
wrong — is checked by eye before the letters join the row.

## What would change the answer?

If the by-eye check shows the cuts cannot be made clean on crowded clusters, B's clean shapes in
another typeface become the fallback, and that reopens this question rather than being slipped in.

## What is this not settling?

Which letters a mistake note may point at (the mistake tool marks one sign or the whole word
today), and how the notes are stored.
