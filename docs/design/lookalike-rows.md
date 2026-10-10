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

### ⑦ In a book note's list of related verses, does every row say something under its name? · **fixed**

**What it changes for a hafiz:** a demo note's list mixes the book's own references, each with the opening
words of the verse it points to, and the app's own look-alikes for the same verse. The look-alike rows came
with nothing under their name: three rows across the two demo notes (2:48's passage 2:122 to 2:123 and the
verse 2:123 inside it, and 15:30's verse 38:73) showed a bare verse name. Those are the rows a hafiz most
needs explained, since they are listed for a slip, not for a meaning.

Why it was missed: the look-alike lists (the corner card and the highlighted-passage menu) each draw their
rows' reasons themselves, and the note's list was written for the book's rows, which always carry a line.
Found on the walk in Arabic on a phone, 2026-10-10.

**Fixed, 2026-10-10:** the note's list now gives an app look-alike row the same reasons the look-alike lists
give it, drawn by the one shared piece all three lists now use: "Most alike: …" for a passage, the loose or
repeated line, "The next verse tells them apart", and the shared words under them as ⑥ set them (cut from
the page by default, a count, or nothing, as the reader chose in the info panel).

Considered, not built: putting the book's opening words of the look-alike verse under its name, the way the
book's own rows read. It would make every row look alike, but it says what the verse says, not why it is
listed; and the reason is what a hafiz is checking.

What looking at it taught us:

- **The picture first took the arrow's place.** In English on a laptop the shared words sat beside "The
  next verse tells them apart" and pushed the arrow up beside the name, because the note's rows lay out in
  two columns and the picture had no column of its own. It now sits under the captions, and the arrow stays
  at the row's end. Checked by picture in English on a laptop and in Arabic on a phone.
- **It makes ㊼'s doubled rows plainer here too.** 2:48's note lists the passage 2:122 to 2:123 and the verse
  2:123 inside it, both now with the same picture, and 15:30's note lists the passage 38:72 to 38:75 beside
  the book's own 38:74. How many rows a verse lists is ㊼, the owner's pick; nothing here changes it.

- **Walked in the real apps, 2026-10-10:** in the iPad app and the Mac app, in English and in Arabic,
  both demo notes were measured from inside the page: every row has a line under its name, and every
  picture sits under its captions, clear of the arrow. The iPad app was also looked at by picture,
  upright and on its side. In Firefox on a laptop, in both languages, 2:48's note shows the same: the
  picture under the captions, the arrow at the row's end.

Tests: unit tests on the note's list (a passage row says which verse is most alike and how many words it
shares; a loose row says it is alike but not word for word; a book row keeps only its own line), which
failed first; and a browser test that opens both demo notes and checks every row has a line under its name
and that each picture sits under its captions, clear of the arrow. Both halves failed first.

### ⑧ When a link or a hop fills an upright iPad with the page, do the look-alike buttons cover its words? · **fixed**

**What it changes for a hafiz:** a link to a verse, and a hop to a look-alike, both open the page
magnified so the verse is easy to read. On a large iPad held upright that magnified page is as wide as
the screen, so the desk the buttons stand on beside the page is gone. The buttons then reached in over
the paper and stood on the first letters of the top line, the line a hafiz is reading after a hop.
Found walking the pitch on an iPad in Firefox, 2026-10-10; it happened in every browser, with or
without a note open, in the public build as much as the pitch build.

**Fixed, 2026-10-10:** when the desk beside the page is too narrow for a button, the buttons leave the
page for a row of their own. Built two ways, both kept, as a choice in the info panel:

- **Bottom row** (the default): beside the trail of verses the reader came from, at the foot of the
  screen. It sits where the thumb already is, and the card a button opens rises from there.
- **Tool row**: at the end of the row of tools above the page. Nearer the top line, but further from
  the hand; when the reader keeps the tools somewhere other than that row, the buttons go to the bottom
  row instead.

When the page is not magnified, or the iPad is on its side and shows two pages, the desk is wide enough
and the buttons stand beside the page as before.

Checked by picture on the upright iPad, after a link to 2:48 and after a hop to 2:122, in English and
in Arabic, in both homes, and on the iPad on its side; and in Firefox on the upright iPad after the
link, the same. Tests: a browser test on the upright iPad, after
a link and after a hop, that no button sits on the page, which failed first; a laptop-size test that
the buttons go to each row as the reader chose; and a unit test of the choice and the desk's width.

### ⑨ With a laptop window closed to one page, do the look-alike buttons stand beside it? · **fixed**

**What it changes for a hafiz:** on a laptop, a reader can close the open book to one page, and an iPad
held upright opens that way. The page then sits in the middle of the window with wide empty space either
side, yet the buttons for a verse's look-alikes were not beside it: they went to the bottom row, and
before ⑧ they stood out at the window's far corner, a long way from the verse they belong to. A hafiz
looking at a verse had to look away from it to find where its look-alikes lead. Found walking the pitch
on a laptop closed to one page, 2026-10-10. Not new: one page never had a place beside it for the
buttons; ⑧ moved them from the far corner to the bottom row.

**Why:** with one page, the box that holds the book runs the whole window's width and the page sits in
the middle of it, so the space either side of the book that ⑧ measures was nothing, however much empty
space there was beside the page.

**Fixed, 2026-10-10:** with one page, the room beside it is measured as what the page leaves of the
window at its present size, every time the page is drawn. The buttons stand just outside the page's
edge, level with its head, and follow that edge out as the reader zooms in; when the page grows too
wide to leave room for a button (a link on an upright iPad, or a page zoomed to fill the window), they
go to the reader's chosen row as in ⑧.

Checked by picture on a laptop closed to one page: 2:48 (a right-hand page), 2:49 (a left-hand page)
in Chrome and Firefox, 15:30 with its note open (the button stands above the note, beside the page's
head), and 2:48 zoomed to 200% (the buttons move out with the page's edge). Tests: a laptop browser
test for a right-hand and a left-hand page that the buttons sit just outside the page, which failed
first; the iPad tests from ⑧, still sending the buttons to the bottom row when the page fills the
width; and a unit test of the room left beside the page as it grows.

The same walk found the roots list standing on the buttons: with one page there is no facing page for a
tall list to rise over, so the roots list (or a note too tall for its corner) stands in the window's
corner, on the buttons beside a page on that side. While it is up they cross to the page's other side,
still just outside its edge. Checked by picture at 2:48 with the roots open in English (the list on the
right, the buttons cross to the left); a laptop browser test for both pages in Arabic, where the list
stands on the left, which failed first for the left-hand page.

### ⑩ With one page and the roots list open, does the list hide where the lines begin? · **fixed**

**What it changes for a hafiz:** a link lands with the page magnified (130% on a laptop with a note's
arrival). Open the roots list beside one page and the list's card covers about 44 pixels of the page's
right edge, which in the mus'haf is where every line begins. A hafiz following a line from its start
cannot see its first word until the list is closed. Found walking the pitch on a laptop closed to one
page, 2026-10-10 (2:48, the roots list open).

**Why:** the page is centred in the window whatever stands beside it; the list is drawn over the window's
corner and the page is not moved aside for it, though there is room on the other side.

**Ways it could go:** move the page sideways into the free space while the list is up; draw the page a
little smaller so it fits between the window's edge and the list; or narrow the list. To be built and
tried rather than chosen on paper.

**Fixed, 2026-10-10: the page moves aside.** While a list or a note stands in the corner beside one
page, the page is centred in the room the card leaves, not in the window, and comes back to the
middle once the card closes. Its magnification does not change. If the page is wider than that room,
the page is held so that the first word of the verse the reader is on stands clear of the card: in the
mus'haf that is the right-hand end of the verse's first line. A verse can still run on under the card
further along its lines; the reader pans to it, as on a page wider than the window.

What building it taught, which the list of ways above did not have:

- The card stands on opposite sides in English and in Arabic (on the right in English, on the left
  in Arabic), so the page moves left in one and right in the other. Measuring where the card really
  stands, rather than assuming a side, covers both.
- A note that has grown into the corner covers the page just as the roots list does, so it moves the
  page aside too. The setting that draws a note shorter only applies to a note at the foot of the
  page; beside the page it would only have hidden lines for nothing.
- With the page moved aside, the look-alike buttons from ⑨ come back to the page's own side when the
  list closes but the note stays, standing in the gap between the page and the note.
- The cost: the page slides when the list opens and slides back when it closes. In a 1280-pixel
  window that is about 240 pixels each way. It reads as making room, not as a jump, because the
  page keeps its size.

**Not built, and why:** drawing the page smaller would undo the size the reader chose, which a turn
carries to the next page; at 130% it would have had to fall to about 85% to stay in the middle and clear of the list, well under the size a link
lands at. Narrowing the list would wrap the roots rows, which already hold a root, its meaning and a
count on one line. Both stay possible if the slide turns out to be unwelcome.

Checked by picture on a laptop closed to one page, 1280 wide: 2:48 with the roots open in English
(the page stands between the window's left edge and the list, the buttons to its left), the same
after closing the list with the note still up (the page stays clear, the buttons cross back between
the page and the note), and in Arabic (the page stands right of the list), and with everything
closed (the page back in the middle). Tests: a laptop browser test for a right-hand and a left-hand
page that the list covers none of the page and that the page comes back to the middle, which failed
first (the list covered 66 and 82 pixels); a laptop browser test, in English and in Arabic, that a
page zoomed wider than the room keeps the verse's first word out from under the list and inside the
window, which failed first with the move switched off (210 pixels under the list); a pitch test, in
Chrome and Firefox, for the one case only a check across the page catches, where the verse is in
sight top to bottom but its first word is under the list, which failed first with that check
switched off (77 pixels under); unit tests of centring in the room left, panning inside it, framing
a verse inside it, and of which side a card covers.

### ⑪ Should a reader be able to keep the page in the middle, drawn smaller, instead of having it slide aside for the list? · **open**

**What it changes for a hafiz:** with ⑩ the page slides about 240 pixels when the roots list opens beside
one page, and slides back when it closes. A reader who keeps their eye on a line may find the slide
harder to follow than a page that stays put and shrinks a little to clear the list.

**Why it is asked now:** the house way is to build a feature's main ways and keep the runners-up as a
setting. ⑩ built only the slide; drawing the page smaller was set aside on paper (it would fall to
about 85% from 130%), not tried by hand.

**What happens if nobody decides:** the page slides, which works, and there is no other choice.

**Ways it could go:** build the smaller page as a setting in the info panel, with the slide as the
default; or leave the slide as the only way and close this.
