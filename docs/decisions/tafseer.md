# Should the app show a tafseer of the selected verse, and where?

*Status: open, two questions. This record states them and draws the options; it does not
choose. The first reopens a written non-goal, which only the owner can do.*

**The picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/tafseer-options.html> —
`tafseer-options.html`, checked in and rebuilt by `scripts/build-tafseer-options.mjs` from
pages 7 and 8 of the vendored print, the hop data for surah 2, the sheet's own stylesheet
and the app's design tokens. The address is the page's own on the app's site, so it is
public the day the page is merged.

## A few words, defined once

- **Tafseer** — an explanation of what a verse means, written by a scholar. Several
  classical ones exist, and they differ in length by a hundredfold: al-Muyassar gives a
  verse a few lines, Ibn Kathir gives it pages.
- **Verse** — one numbered sentence of the Qur'an. 2:48 is the forty-eighth verse of the
  second surah, Al-Baqarah, and is the verse every drawing uses.
- **The sheet** — what opens when a verse is tapped and one of its chips pressed. On a
  phone it rises from the bottom of the screen; on a laptop it is a card in the corner,
  over the leaf the verse is not on.
- **The facing leaf** — on a laptop the app shows two pages side by side like an open book.
  The facing leaf is the other one.
- **Provenance** — where a text came from and how a reader can tell: who wrote it, which
  printed edition, who typed it, under what licence, and whether the copy here is the copy
  they published.

## Why is this being asked now?

The plan that started this app names "tafsir reading" among the things the first version
would not do: the app is a navigator between verses, not a reader of commentary on them.
The desktop triage of 2026-09-01 asked for a tafseer section inside the verse's options all
the same, "with sourced text and its provenance checked". That is a reversal of a written
non-goal, and it is not one a session can make on its own. So instead of building it, this
record puts the question plainly, with each answer drawn at the size it would be used, and
a survey of where such a text could come from and under what terms.

## What happens if nobody decides?

Nothing breaks. The sheet works today as option A of the first question, the plan stands,
and no other feature waits on this one. The app's links data already reserves a kind of
link for a tafseer, which renders nothing until something is decided, and that costs
nothing either. This can stay open for as long as it likes.

## What does the app do today, and what is it costing?

Tap 2:48 and the app offers two chips: one for the two verses in this surah it resembles,
one for the one elsewhere in the book. The sheet lists them with a note where a note is
worth having, and a hop button that turns the book to that page. Nothing in it says what
the verse means. Measured on 2026-09-02 in the running app: the sheet for this verse is
240 px tall on both a 390 × 844 phone and a 1440 × 900 laptop (the page derives 238 from
the stylesheet), against a ceiling of seven tenths of the window, so it uses 41% of its
room on a phone and 38% on a laptop. Its cost is only the thing it does not do: a reader
who wants a meaning leaves the app, and loses their place in it. Nobody has said they mind;
the app has no readers yet who could.

## What have we already decided that touches this?

- **No reader features in the first version** (the plan's non-goals: audio, translation,
  tafseer reading). Options C and D of the first question reopen this; A and B do not.
- **The app ships no Qur'an text.** The print is outlined shapes and every shipped file is
  checked for it. A tafseer is not the Qur'an, but it quotes the Qur'an constantly, so the
  first tafseer file would be the first the app distributes with the Qur'an's words in it.
  The rule would need restating rather than breaking: the words would arrive as a text
  fetched when asked for, never in the app's own bundle, and the licence register would
  say so.
- **The sheet rises over the facing leaf** (`desktop-vs-mobile`; decided 2026-09-02). On a
  laptop the card sits over the leaf the verse is not on, so it never covers what it is
  about. Option C grows inside that; option D takes the idea to its end and gives the
  whole leaf over.
- **The bundle has a ceiling.** The app's own code is held to a size budget with about
  thirty kilobytes to spare. No tafseer fits in that, so any text is fetched on demand and
  kept by the app's offline store, which today keeps pages and not prose.
- **Every dependency is named and licensed** (the `what-we-depend-on` design page and the
  notice the app ships). A tafseer text is a new row in each, with the attribution line its
  licence requires and a note of the version.

## Where would a tafseer sit, if anywhere?

**The options**, each drawn on the page at both sizes:

- **A · Nothing: the sheet stays as it is** — today. Takes nothing. The app keeps its one
  job, its bundle, and its rule of shipping no text. Costs a reader the trip out of the app.
- **B · A row in the sheet that opens the tafseer elsewhere** — one more row under the
  hops, marked with the ✎ the app already reserves for it, which opens the verse on the
  source's own site in a new tab. Gets a road to a meaning one tap long, with no licence
  to hold and no bytes to ship. Costs the network, the trip out, and a dependence on a
  page that is not ours and can move, change its text, or close.
- **C · A tafseer section inside the sheet, under the hops** — tap the ✎ row and the text
  opens beneath the hops, with its source named under it. Gets the meaning in the same
  sheet, a gutter from the verse on a laptop. Costs room: read off the sheet's stylesheet,
  8 lines fit on a phone and 10 in the laptop card before the text scrolls, and the card
  grown to its ceiling covers 83% of the facing leaf. And the app ships text for the first
  time, so a licence, a version and a checksum become things it must carry.
- **D · The tafseer takes the facing leaf** — on a laptop the leaf the verse is not on gives
  way to the text at the leaf's own size, 16 lines beside the verse with nothing floating
  over the print, which is how the printed mus'haf with a margin commentary lays the two
  out. On a phone, which has no facing leaf, the text takes the screen: 23 lines, and the
  mus'haf out of sight until it is closed. Costs a second layout to keep right, and the
  spread's turn, zoom and jump all having to know that a leaf can be prose.

How the lines were counted is on the page: the sheet's ceiling, less the sheet as it is
today, less a row for the section and a line for the source, divided by one line of Arabic
prose at the sheet's body size. A verse with more hops leaves fewer lines.

## Which text, and how would a reader know what they are reading?

This only matters if C or D wins the first question; B needs an address to point at and A
needs nothing. It is here because it constrains the first: a text that cannot be copied
cannot be shown inside the app at all, and every English tafseer found is one of those.

**What was found**, on 2026-09-02, with links on the page:

- The **Tafsir Center for Quranic Studies** publishes one dataset with al-Muyassar,
  al-Tabari, Ibn Kathir, al-Baghawi and al-Sa'di in Arabic and its own short tafseer in
  Arabic, English and Bengali, under CC BY 4.0 with attribution to the Center. It names its
  reviewers but not the printed edition each text was typed from, and has a change history
  rather than a version number. It is the only source found that is both scholar-reviewed
  and openly licensed.
- The **Quranic Universal Library** (Tarteel) lists 108 tafseers, each under whatever
  licence its author gave it, which has to be checked one by one, and shows no versions.
- The **Quran Foundation's** service serves over a hundred tafseers per verse, Arabic and
  English, live, with a key and a rate limit. No licence text was found on its pages.
- **Noor International** (quranenc.com) has translations and a few short tafseers, not
  al-Muyassar; its terms allow copying unchanged with credit and require the version number
  be cited, and it publishes one for every work. That is the best provenance practice seen
  anywhere, and it does not have the text wanted.
- The English Ibn Kathir (Darussalam), the English al-Jalalayn (Royal Aal al-Bayt
  Institute) and the English al-Sa'di (IIPH) all reserve their rights. Not usable without
  written permission.
- No source found publishes a checksum. A reader can only be told *which file* this is if
  the app records the mark of the file it fetched, the day, and the address, itself. The
  page draws that line at the size it would sit under the text, in the form the sources
  found allow today and the form it takes once an edition can be named.

**The options:**

- **A · One text, in Arabic: al-Tafsir al-Muyassar, from the Tafsir Center** — the short
  tafseer the King Fahd Complex prints in the margin of its own mus'haf, one small file per
  surah, fetched the first time a surah's tafseer is opened and kept. Gets a reviewed text
  under a licence that allows copying, in the language the mus'haf is in. Costs the English
  reader, who gets no English meaning, and a source line that cannot yet name an edition.
- **B · The same, with a choice of three Arabic texts** — Ibn Kathir and al-Sa'di from the
  same dataset behind a picker. Gets a long tafseer for a reader who wants more than the
  margin text. Costs three times the storage per surah, a control the section did not need,
  and Ibn Kathir's entries run to pages, which no sheet on the page was drawn for.
- **C · Look each verse up live, from the Quran Foundation's service** — no copy kept.
  Gets English and Arabic both and the widest catalogue found. Costs everything offline,
  which the rest of the app is; a rate limit; and terms that were not found.

## What do people outside this project do?

Looked at on 2026-09-02. Tarteel opens a sheet from the verse with a tafseer item in it,
per verse, in English and Arabic. Quran.com opens a panel from the verse's menu and, because
its texts are stored per group of verses, says which verses the passage covers. Greentech's
Al Quran opens the tafseer of a tapped verse and lets the reader step to the next without
going back. The King Fahd Complex's own app, and the accessible Mus'haf app built on its
page layout, both offer a tafseer lookup from the verse's quick actions. The pattern is the
same everywhere: one item in the verse's sheet, opened per verse, the source named at the
top, a picker when there is more than one. Nobody found lays the meaning on the facing leaf
as option D does; the printed tradition does, in the margin of the King Fahd mus'haf, which
is where al-Muyassar comes from. Muslim Pro, Ayah, Golden Quran and Quran Majeed were not
looked at closely.

What does not transfer: those apps are readers, with the Qur'an's text in them and a
translation beside it, so a tafseer is one more text in a stack of texts. This app has no
text at all, which is why its first one is a decision and not a feature.

## What else could be considered, and why is it not here?

- **An English tafseer.** Every named English text found reserves its rights or has no
  stated licence. The Tafsir Center's short English summary is openly licensed but is a
  summary, not a classical work. Left off until one is found or permission is asked for.
- **A translation instead.** Also a non-goal in the plan, and a different decision: a
  translation is per verse and short, which changes the first question entirely.
- **Meaning on hover, on a laptop.** Too small to hold a paragraph and nothing for a phone
  to do.
- **Writing a tafseer in.** The app is not a scholar.

## What would change the answer?

- An openly licensed English tafseer of a named edition. It would make C or D worth far
  more to a reader of the English chrome and reopen the second question.
- A source that names its printed edition and publishes a version and a checksum. The
  source line could then be honest without the app computing its own mark.
- A hafiz saying, after a month with option B, that leaving the app is the thing they
  mind. That is the measurement A and B are waiting for, and the reason to try B before C.
- The offline store being taught to keep text as well as pages, which C and D both need
  in any case.

## What is this not settling?

- Whether the app shows a translation. Same plan, same non-goal, a different page.
- Which chip's sheet the section belongs to, or whether it gets a sheet of its own. Drawn
  under the "similar in this surah" sheet because that is the one a reader has open; the
  row would be the same under any.
- How the offline store keeps a fetched text, or when it lets one go.
- What the notes beside the similar verses say. One is in Arabic and is drawn as a bar on
  the page for the same reason the tafseer is: the page carries no Arabic at all.

## So what is being decided?

Two things, in order. First, whether a tafseer belongs in the app at all and where it would
sit: nowhere (A), as a row that opens it elsewhere (B), as a section inside the sheet (C),
or on the facing leaf (D). Second, only if C or D: which text the app would copy and how it
would say so — al-Muyassar alone (A), three Arabic texts with a picker (B), or a live lookup
with no copy kept (C). The first reopens a written non-goal, and that is the owner's to
reopen.
