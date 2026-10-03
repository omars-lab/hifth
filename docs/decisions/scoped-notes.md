# Notes that gather verses: what did the owner answer?

The full design, with every option, what other apps do and the build order, is
[the scoped-notes design](../design/scoped-notes.md). This record holds the three answers the
owner gave on 2026-09-30, and the two given on 2026-10-02 after each option was built on a phone
and recorded, and why.

**Words used here.** A *verse* (ayah) is one numbered verse, written surah:verse. A *surah* is
one of the 114 chapters. A *juz* is one of the 30 equal parts used to plan revision; a *hizb* is
half a juz. A *page* is a page of the 604-page Madani mus'haf the app shows. A note's *scope* is
the part of the Qur'an it is about, and it decides which verses the note can take.

> **For a hafiz:** a note stops being a lone pin and becomes a list, like "Juz 5: weak spots",
> that you add verses to with one tap while revising and step through before reciting to your
> teacher.

## Which parts of the Qur'an can a note be about?

**Decided: surah, juz, hizb, page, and the whole Qur'an** (option B). Owner, 2026-09-30.

The owner named the first four. The whole Qur'an was added because the list a hafiz most needs,
verses that look alike and differ by a word (2:58 and 7:161, say), almost always spans two
surahs, and none of the four would let one note hold both. The cost is one more choice when
making a note, and a whole-Qur'an note that was used recently is offered on every verse. The
offer list is kept short to hold that cost down: three notes at most, the most recently used first.

| | Option | Pros | Cons | Implications |
| --- | --- | --- | --- | --- |
| A | The four named | Exactly what was asked | Look-alikes cannot share a note | A separate feature for look-alikes later |
| **B** | **The four, plus the whole Qur'an** | **Look-alike and theme lists fit** | **One more choice; a busy whole-Qur'an note is offered everywhere** | **Offer list capped at three, recent first** |
| C | B, plus a quarter-hizb and a verse range you pick | Finest control | Bigger picker, a from–to chooser to build | A new table of quarter boundaries and its check |

## What scope does a note saved today get when notes become lists?

**Decided: the page it is pinned on** (option A). Owner, 2026-09-30.

It is the narrowest true answer: the reader wrote the note on that page. An old note is then
only offered when a verse on that page is being added, so old notes do not crowd the list. If a
note was really about a whole surah, widening its scope is one tap. Every note moves across with
its words, its spot on the word and its dates untouched; a marked mistake stays a marked mistake.

| | Option | Pros | Cons | Implications |
| --- | --- | --- | --- | --- |
| **A** | **Its page** | **Where it was written; old notes stay out of the way** | **A note about a whole surah starts too narrow** | **Widening must be one tap** |
| B | Its surah | Old notes stay on offer through the surah | A long surah offers every old note everywhere | The list fills with old notes for weeks |
| C | The whole Qur'an | Nothing blocked | Scope means nothing for old notes | Which notes are offered comes down to recency alone |

## Does each verse in a note get its own line of text?

**Decided: not yet, one text per note** (option A). Owner, 2026-09-30.

One text keeps the first build small and moves old notes across as they are. To say "this one
has X, that one has Y", the reader names the verse in their own words. A line per verse can be
added later without moving any saved note, so this closes no door; doing it now would change the
saved-notes file at once, and an older copy of the app would silently drop the per-verse lines.

| | Option | Pros | Cons | Implications |
| --- | --- | --- | --- | --- |
| **A** | **One text per note** | **Simplest; old notes move as they are** | **Differences are written in prose** | **Per-verse lines can come later** |
| B | One text plus a line per verse | A look-alike note says beside each verse what differs | Bigger box, bigger build | The saved file changes now |

## When you tap a verse with the note tool, what opens?

**Decided: a new note at once, with your three likeliest notes as one-tap choices in its box**
(option C). Owner, 2026-10-02.

Most slips start a new thought, so the one tap that does that today is kept. Adding the verse to
a note you already have is one more tap, never a detour through a list. The recording showed the
cost: the box grows about three lines, and with a full row per note it covered nine lines of the
page, so the choices are small and side by side, with *More notes…* for the rest. Each option is
drawn and recorded in [how adding a verse to a note should feel](../design/scoped-notes-feel.md).

| | Option | Pros | Cons | Implications |
| --- | --- | --- | --- | --- |
| A | A new note, as today | Nothing to learn; smallest box | No way to add to a note from the tool | Adding only from the verse menu |
| B | Your notes first | Adding is the natural path | One more tap for every new note | The tool feels slower than today |
| **C** | **A new note, with three choices in its box** | **Today's one tap kept; your notes in reach** | **A taller box covers more of the page** | **Choices stay small; *More notes…* opens the rest** |
| D | Keep adding to the last note | Fastest for a run of slips | Filed a slip in the wrong note without a word | A bar on screen until you stop |

## How does the page show that a verse is in a note?

**Decided: a small dot by the verse number, with a count when the verse is in more than one
note** (option A). Owner, 2026-10-02.

It covers none of the words, reads at phone size, and a tap on it lists the verse's notes. The
tint covered a third of the page with four verses in notes and looked like the highlighter; the
edge mark was hard to see and sat where the thumb turns the page; showing nothing left the page
silent about your notes.

| | Option | Pros | Cons | Implications |
| --- | --- | --- | --- | --- |
| **A** | **Dot by the number** | **Covers no words; one mark however many notes** | **At the verse's end; needs room to tap** | **Moves off any pin on that number** |
| B | Mark at the edge | Away from the text | Hard to see; where the thumb turns the page | Shares the edge with the page turn |
| C | Nothing | The cleanest page | No reminder | Notes found only through menus and lists |
| D | Tint over the verse | Unmissable | A third of the page; looks like the highlighter | Uses up a colour |

## What is this not settling?

Which note is offered first (the most recently used) and which scope is ready-picked (the kind
used last time) are built as the design recommends and are easy to change. The dot's exact size
and colour are tuned on a real phone once it is built.
