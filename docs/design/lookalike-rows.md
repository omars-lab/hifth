# Look-alike rows: does each one tell a hafiz why it is there, and let them compare?

> The list of look-alikes under a verse is where a hafiz goes to find the other places their
> memory could slide to. This page holds the faults and open questions about those rows, one
> numbered item each. Items ㊻ to ㊿ in [the commentary design](knowledge-graph-commentary.md)
> came first, and that page's numbering is full, so the items continue here from ①.

## A few words, defined once

- **Verse (ayah)** — one numbered sentence of the Qur'an. 15:30 is the thirtieth verse of
  the fifteenth surah.
- **Look-alike (mutashabih)** — another verse worded so much like this one that a hafiz can
  slide from one into the other while reciting.
- **Passage row** — a look-alike row that names a run of verses ("38:71–38:85") rather than one
  verse, because the outside list it comes from pairs whole passages.
- **Reason line** — the short line under a row's name that says how the two are alike:
  the words they share, "the words they share come more than once", "alike, but not word for
  word", or "the next verse tells them apart".
- **Comparison** — what opens under a row: both verses as printed, the shared words washed
  green and the differences ochre.

## Open questions, and what would answer each

### ① When a look-alike row names a whole passage, does it say how the two are alike? · **fixed**

**What it changes for a hafiz:** opening 15:30's look-alikes shows a passage in surah 38, and
nothing under it says which words are the same or lets them lay the two side by side. They
have to turn there and hunt for the matching verse themselves.

Measured on 2026-10-09: of the 101 passage rows, 47 have no reason line and cannot be opened;
7 more say only "the next verse tells them apart" and cannot be opened either. ㊽'s fix gave a
reason to every single-verse row, but skipped passage rows, and its data test counted naming a
passage as a reason in itself, so it never saw them.

Why they are blank: the build compares the verse with the passage's **first** verse. For 35 of
those 54 rows, the verse that actually matches is a **later** one inside the passage (15:30
matches the passage's second verse, 15:32 its fourth). Comparing against the first finds little or
nothing, so the row says nothing. Of the rest, 16 share no words with any verse of the passage
(alike in sense only), and 3 already match best against the first verse.

The same mistake touches 9 passage rows that *do* show marked words: they mark one or two words against
the first verse while a later verse shares a longer run, up to seven words.

**What would answer it:** for a passage row, find the verse inside the passage that shares the
longest run of words with this one, and give the reason line and the comparison against that
verse. The jump still lands on the passage's first verse, where the outside list points. A row
that ties between two verses inside the passage, or shares nothing with any of them, stays
measured against the first verse. Tests first: the data test stops counting a passage name as a
reason, and the lists open a passage row onto the matching verse.

**Fixed, 2026-10-09:** a passage row now names the verse inside the passage it matches best (when that is
not the first), and its reason line and comparison are measured against that verse. The jump still
lands on the passage's first verse. 15:30's row for the passage in surah 38 now opens onto the verse it
shares its words with. Every look-alike row now gives a reason; the outside list's passages that share
no words with any verse in them say they are alike but not word for word.

Tests: the data test no longer counts naming a passage as a reason, and checks every passage row
names the verse it matches best; the comparison's unit test opens a passage row onto that verse; and a
browser test opens 15:30's passage row and finds the matching verse in the comparison.

Not settled here: comparing a whole passage against a whole passage, rather than one verse
against the one it matches.
