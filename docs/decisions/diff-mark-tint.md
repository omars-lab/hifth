# When two look-alike verses differ by one vowel, should the panel show that vowel?

**Status:** decided — **option C**, by omar on 2026-09-23, in conversation, from sketches
drawn in chat rather than from a built options page. This record was written the same day,
after the option was built and looked at on real pages; the honest caveats are below.

**Picture:** the live panel. Open the app, stand on 2:173, open the "in later surahs" chip
and expand the row for 5:3:
<https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/2:173>. The words for *carrion*, *blood*
and *flesh* sit inside the green run on both sides, and each carries a small indigo box on the
one vowel the other verse prints differently. Then stand on 2:48, open the "look-alikes in
this surah" chip and expand 2:123: nothing is tinted, because the shared words carry the same
vowels and the tails are a reordering, which the ochre wash already shows.

## Glossary

- **Verse** — one ayah of the Qur'an.
- **Look-alike** — two verses that share a run of words, the kind a hafiz confuses.
- **Vowel mark** — the small signs above and below a letter (fatha, damma, kasra, sukun,
  shadda and the rest) that say how the letter is read.
- **The panel** — what a hop row opens to: both verses as the mus'haf prints them, the words
  they share washed green, the words they do not washed ochre.

## What is being decided?

The panel colours at the grain of words. A hafiz's mistake is often finer than that: the
same word, recited with one different vowel — *the carrion* in the accusative in 2:173 and
in the nominative in 5:3. Under the word wash both print as "shared" and look identical.
Should the panel point at the vowel itself, and if so, how finely?

## Why is it being asked now?

The mark-placement decision (option H) put every vowel mark on every page in its own box,
with its name and the word it belongs to. Until then the panel could not have pointed at a
vowel if it wanted to; now it is a lookup. The question came up while working through the
harakat backlog, and the owner was asked in chat.

## What happens if nobody decides?

Nothing breaks. The panel keeps washing words, and a hafiz reading 2:173 next to 5:3 sees
two green runs that look the same and has to find the vowel by eye. That is the whole cost,
and it is the cost the panel exists to remove.

## What does the app do today, and what does it cost?

Measured over the shipped corpus (2,544 look-alike pairs whose shared run is unique on both
sides, so the panel can draw them):

| | |
| --- | --- |
| pairs whose shared run holds at least one word with different vowels | 462 |
| such words, out of all words in shared runs | 538 of 14,148 |
| of the words that differ, those that differ by exactly one mark swapped for another | 1,078 (counting both runs; see below) |

So roughly one drawable pair in five has the trap the word wash cannot show, and when a word
differs it usually differs by a single sign.

## What do people outside this project do?

I did not look. Printed mutashabihat guides mark the differing word, sometimes the letter,
and rely on the reader's eye for the vowel; I know of no app that colours a single vowel in
a side-by-side comparison, but I did not check.

## What have we already decided that constrains this?

- **comparison-crop** — the panel crops the printed page; anything added is drawn in the
  page's own units on top of that crop, so a vowel box must come from the page, not from
  retyped text.
- **mark-placement (H)** — every mark has its own box, keyed by page, verse and word. That
  is what makes option C possible at all, and it is why the tint needs no new data.
- **mark-granularity (B)** — tajweed is coloured at the exact letter, not per verse. The
  same reasoning applies here: a colour that lands on the wrong thing teaches the wrong thing.
- **harakah-pick** (open) — how a reader picks one vowel to note. Its options and this tint
  read the same boxes; whichever wins there should agree with the tint here about what a
  single vowel looks like on the page.

## What were the options?

Presented in chat with example sketches, not on a built page.

- **A. Leave it** — the word wash only. Costs nothing; leaves the 462 pairs unshown.
- **B. Tint the whole word when its vowels differ** — one more wash colour on the word. Cheap,
  and it tells a hafiz *which* word, but not which vowel; on a five-sign word that is still a
  search.
- **C. Colour any single mark on its own** — each vowel that the other verse does not carry
  on the same word gets its own small indigo box. Chosen.

## What was decided, and why?

Option C, by the owner. The reason is the one the mark-granularity decision already gave:
the mistake is a single sign, so the colour should land on a single sign.

**Two things the chat got wrong and this record puts right.** First, the cost was
overstated when the option was presented: it was described as several days, a new drawing
path and a new held copy needing a licence reading. In fact it took about a day, reads the
mark boxes the app already ships, holds no new resource and owes no licence reading. The
choice stands on its merits; it was not bought with a cost that turned out to be false.
Second, the option was chosen from sketches. It has since been built and looked at on the
two pairs above, at three times screen density, before this record was written.

### How the tint decides what to colour

- Pair the words of the shared run head to head, skipping pause marks (the print counts a
  pause sign as a word, and the two verses do not pause in the same places). If a verse
  begins partway through the run because it started on the previous page, pair from the end
  both pages hold.
- Compare each pair of words as a bag of mark names, ignoring order: marks stack above and
  below one letter, and the same word is listed in a different order on two pages.
- Colour what is left over on either side.

**Only inside the shared run.** The first build also paired the words outside it, aligning
the run before the shared words at its end and the run after at its start, and tinted every
difference. Looked at on 5:3, that tinted nine marks in ten across the ochre wash (21,330 of
23,328 paired words differed) and then stopped dead wherever the shorter verse ran out, which
reads as noise with an arbitrary edge. It is noise by construction: the shared run is matched
on bare consonants, so a word the two verses spell alike and vowel differently is always
*inside* it, and the words outside it are different words, which the ochre wash already
says. The 1,078 "one swapped mark" figure above was measured over both runs and is mostly
coincidence between unrelated words; the tint now ignores it.

## What was considered and left out?

- **A different colour per kind of difference** (missing here, extra there, swapped). Three
  colours on signs a few units tall would not be told apart at panel size.
- **Tinting words that have no partner** (the longer verse's surplus). The ochre wash covers
  them; a tint would say nothing more.
- **Building an options page before asking.** The house rule, skipped here for speed. The
  cost of skipping it was the overstated estimate above, which a built page would have
  corrected before the question was asked.

## What would change the answer?

- A hafiz sitting with the panel finds the indigo boxes too small to read on a phone, or
  mistakes them for tajweed colour. Then B (tint the word) becomes the fallback, and the
  boxes could grow or move to a marker beside the word.
- The mark boxes turn out to be badly placed on many pages. The placement sitting is the
  check for that, and a tint on a box that is off its sign is worse than no tint.

## What is this not settling?

- How a reader *picks* a vowel to note: that is harakah-pick.
- Whether the panel should say anything about words outside the shared run beyond the ochre
  wash. It does not today.
- Dark mode: the diff colours have no dark-mode values yet, indigo included.
