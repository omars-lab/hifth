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
  "the words they share come more than once", "alike, but not word for word", "the next verse
  tells them apart", or, on a passage row, which verse inside it is most alike. A row whose
  shared words sit in one place on both sides shows those words under its name, cut from the
  page (⑥); opening it marks them in both verses.
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

### ④ When a phone note is opened out to its full length, are the look-alike buttons left on the page behind it? · **fixed**

**What it changes for a hafiz:** on a phone, with 2:48's note open, the buttons for its look-alikes sit
on the note's top edge. Tapping "Show all of the note" made them drop back to their usual place above
the page's first line, which is an earlier verse's words. There they sat, greyed under the dimming,
over words the reader was not looking at, and a tap on them did nothing because the dimming takes taps.

Why: ⑪ in [the commentary design](knowledge-graph-commentary.md) moved the buttons onto the note's top
edge while a note is up, and took them off it again when the note grows to cover the page, so they would
not float over the note's own words. Nothing said where they should go instead, so they went back to
where they stand with no note open.

**Fixed, 2026-10-09:** while the note is grown over the page, the buttons are out of sight. Tapping
"Show less" brings them back on the note's top edge. On a wider screen, where the note sits beside the
page, nothing changes.

Tests: the browser test that opens a note on a phone and checks the buttons sit on its top edge now also
grows the note and checks no button is left on the page. It failed first, on the old app.

### ⑤ Before a passage row is opened, does it say which verse inside the passage is the alike one? · **fixed**

**What it changes for a hafiz:** 15:30's later-surahs list names the passage 38:72 to 38:75. ①'s fix measured
the row against 38:73, the verse inside it that shares 15:30's words, but only said so once the row was
opened. Closed, the row named four verses and gave no hint which one to look at.

Why: ①'s record said the row names that verse, and its browser test checked for it only after opening the
row, so the closed row was never looked at.

**Fixed, 2026-10-09:** a passage row whose best match is not its first verse now carries a line under its
name, "Most alike: 38:73" (in Arabic, the same with Arabic numerals). The jump still lands on the passage's
first verse. A row matched best by its first verse needs no line, since its name already starts there.

Tests: a unit test on each list (the look-alike list and the highlighted-passage menu), both failed first,
and the browser test that opens 15:30's passage row now checks the closed row names 38:73 first.

### ⑥ Before a reader opens a look-alike row, can they see which words the two verses share? · **answered**

**What it changes for a hafiz:** a row like 10:15's 8:31, or 15:30's 38:73, shows only a verse name and an
arrow to open it. The shared words, which are exactly the stretch a hafiz slides on, appear only after a
tap. Scanning a list of five rows to find the one they actually confuse means opening each.

What the app does today: a row whose shared words sit in one place on both sides has no line under its
name; the other kinds of row each say why they are listed (㊽). Opening a row draws both verses with the
shared words washed green (㊾).

Options seen before building:

- **Leave it** (today): the row is short, and the comparison is one tap away.
- **A small picture of the shared words** under the row's name, cut from the printed page the way the
  comparison already cuts it. The reader sees the very stretch, in the mus'haf's own hand, without opening.
- **The count of shared words** ("shares 4 words"), which says how strong the likeness is but not which
  words.

Not settled here: how many rows a verse should list at all (㊼, the owner's pick). A picture under each row
makes a long list longer, so the two are related.

**Built all three, 2026-10-09; the picture is the default.** The info panel has a new choice, "The words a
look-alike shares, before it is opened", with *Cut from the page* (the default), *As a count* and *Not
shown*. A row that shares one stretch of words shows the **other** verse's shared words under its name,
cut from its printed page: one piece for each printed line, set side by side in reading order, about as
tall as a line of the row's own text, washed the same green the comparison uses. The reader already
knows their own verse; what they need is the other one. For a passage row, the words come from the verse
inside the passage that matches best (⑤). Rows alike only loosely, or whose words come more than once,
keep their own line and get no picture, since there is no one stretch to show. The picture steps aside
while the row is open, because the comparison under it shows the same words larger. A screen reader
does not hear it: the row's name and the comparison already say what it shows.

What looking at it taught us, on a phone and an iPad in both languages and in Firefox:

- **The picture ends where the two verses part.** At 2:48 the pictured words of 2:123 stop at the last
  shared word, the point where the next words differ. So the closed row shows not only *which* words
  are shared but *where the slip happens*, which is the thing a hafiz needs and which a count can never
  say. That is why the picture is the default.
- **In the English layout the strip first sat at the far end of the row**, away from the name it belongs
  to, because a right-to-left strip that runs the full width starts at the right. It is now only as wide
  as its pieces, so it starts where the name starts in either language. A browser test checks the edge
  in both languages; it failed first.
- **It makes the doubled rows of ㊼ plain.** Where a passage is listed beside a verse inside it, both
  rows now carry the very same picture, one above the other (15:30's 38:72–38:75 and 38:73; 2:48's
  2:122–2:123 and 2:123). That is for ㊼, the owner's pick; nothing here changes it.
- **The picture first sat between captions on some rows and after them on others** (under *most alike*
  but above *the next verse tells them apart*), so the eye hunted for it row by row. It now comes after
  every caption, on every row; a unit test in each list checks the order and failed first.
- **Walked in the real apps, 2026-10-09:** the iPad app upright and on its side, and the Mac app in
  English, at both demo verses. The strip starts under the name and stops where the verses part in each.
- **Cost:** a row with a picture is about one line taller, and the list now loads the page pictures of
  the verses it names when it opens, not only when a row is opened. For a reader who finds that too
  much, *As a count* keeps the list short and *Not shown* puts it back as it was.
