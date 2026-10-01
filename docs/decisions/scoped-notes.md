# Notes that gather verses: what were the first three answers?

The full design, with every option, what other apps do and the build order, is
[the scoped-notes design](../design/scoped-notes.md). This record holds the three answers the
owner gave on 2026-09-30, and why. Four more questions are still open in the design; two of them
are about how something feels in the hand, so they will be built and tried, not chosen from a
picture.

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

## What is this not settling?

How the note tool behaves on a tap (start a new note, or keep adding to the last one), and how
the page shows that a verse is in a note. Both were built on a phone and recorded on
2026-10-01, four options each: [how adding a verse to a note should feel](../design/scoped-notes-feel.md). Which
note is offered first (the most recently used) and which scope is ready-picked (the kind used
last time) are being built as the design recommends and are easy to change.
