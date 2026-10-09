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

### ② When a tall row opens near the top of a phone's list, can the reader see its name? · **fixed**

**What it changes for a hafiz:** on a phone, opening 15:30's first look-alike row (the passage in surah
38) moved the list so the comparison sat right under the list's title, and the row's own name, which
says where the other verse is, was scrolled up behind the title. They saw two verses with no word of
where the second one lives.

Why: ㊿'s rule lines a row too tall to show whole up under the list's title. On a phone the title is
pinned inside the scrolling sheet, but it only pins once the list has moved. With the list still at its
start the title sits a little lower, so the rule did not count it, lined the row up with the sheet's
edge, and the title then pinned over the row's name. ㊿'s own test opened the last row, by which time
the list had already moved and the title was pinned, so it never saw this.

**Fixed, 2026-10-09:** the rule now counts a title by where it will pin, not only where it is now.
Opening 15:30's first row on a phone puts its name just under the title, in English and in Arabic.

Tests: a unit test of the rule with a title that has not pinned yet, and the browser test that opens
15:30's passage row now checks its name sits under the title on both phones and desktop Firefox.

**Corrected the same day:** the first fix still left the row's top 12 pixels behind the title; only the
row's own top margin kept its name clear. A browser pins the title inside the list's padding, which the
rule had not counted. It does now, and the row starts exactly under the title. The browser test now checks
the row's top, not only its name, and it caught the 12 pixels on the Android phone. On the iPhone the
title was already pinned when the row opened, so the first rule never went wrong there.

### ③ In the Arabic app, does a look-alike pair's own note read in Arabic? · **fixed**

**What it changes for a hafiz:** a reader using the app in Arabic opened 2:48's look-alikes and found the
note on its pair with 2:123, the one line that says what was swapped, written in English with the two
Arabic words dropped into it. On an iPad its two-way arrow drew as a blue emoji tile in the middle of
the sentence.

Why: the twelve hand-written notes on look-alike pairs were only ever written in English, with the
pair's Arabic words inside them, and the app showed them as they were in either language. An old
comment said they were written in Arabic and never translated, so nobody had looked. Apple's fonts draw
the two-way arrow as an emoji unless the text asks for its plain form.

**Fixed, 2026-10-09:** every note now has an Arabic version beside the English one, and the app shows
the one in the reader's language, in the list, in the highlighted-passage menu and in the note panel's
list of look-alikes. A note taken from the book itself still keeps the book's language. The arrow now
always asks for its plain form.

Tests: a unit test of how a note is picked and its arrow written, a test that every note in the
look-alike data has an Arabic version with no English letters in it (it failed first, 14 notes), and a
browser test on both phones that opens 2:48's look-alikes in Arabic and finds no English in any row (it
failed first on the old list). The note panel's list of related verses has its own unit test: our note
reads in the app's language with a plain arrow, and a note from the book keeps the book's language (it
failed first on the old panel, which showed the English note in the Arabic app).
