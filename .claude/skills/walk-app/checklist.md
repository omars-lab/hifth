# What to check on a walk

The list grows. **Every fault a walk finds adds a line here**, in the same change as its fix and
its test, so the next walk looks for it on purpose. A line says what to do, where to do it, what
right looks like, and the test that now guards it (`issue:` is its row in `docs/issues.json`).

Where, in the words `make drive DEVICE=` takes: **desktop** (two pages at a desk), **laptop**,
**ipad** (upright), **ipad-side**, **ipad-big-side**, **phone**, **phone-side**. "Any" means every
one of them. *Pitch* means the private build (`make pitch`); everything else is both builds.

## The first screen

- [ ] Open the app cold, hint not yet seen. · any · The hint says the right thing for the hand:
  "click" at a desk, "tap" on a phone. · issue: `desktop-hint-says-tap`
- [ ] An upright iPad opens on one page you can read, not two small ones. · ipad · issue:
  `upright-ipad-opens-two-small-pages`
- [ ] A deep link to a verse lands on its page with the verse marked; turn the phone the moment it
  opens and the mark is still there. · phone, phone-side · issue: `turned-phone-loses-linked-verse-mark`
- [ ] Open at page 1 and turn to page 3: the paper stays the same size and shape; the opening text sits
  in the middle, not on a squat card. · desktop, phone · issue: `opening-pages-squat`
- [ ] In the info panel, set "The first two pages" to usual size: pages 1 and 2 redraw at once with
  their text the size of page 3's, still centred, and a tap on a verse there still opens it. · desktop, phone

## Turning pages

- [ ] Turn by swiping, by the arrow keys, and at a desk by grabbing the outer edge. · any · The
  page follows the hand; a drag in the middle of a page never turns it. · tests: page-turn,
  desktop, edge-peel specs
- [ ] A large iPad on one page turns under a finger. · ipad-big-side with `?view=one` · issue:
  `large-ipad-one-page-no-swipe`
- [ ] Zoom in, then turn: the zoom carries to the next page. · desktop, ipad-side · test: desktop spec
- [ ] Jump to a juz or surah: the page arrives centred, with no flash of the wrong page. · any ·
  test: hop spec
- [ ] With two pages open and a note beside them, the page still turns by its edge. · desktop ·
  **open** — issue: `note-covers-turn-edge`. Walk all three ways in settings ("Turning with a card
  open"): the default turns by arrows and keys only; "stops short" leaves the edge bare; "grab
  through" closes the note and turns. test: pitch spec, "grab through"

## The page bar

- [ ] With one page open and a note up, the page bar is still in reach. · laptop, ipad · issue:
  `one-page-note-covers-page-bar`
- [ ] With one page open, a link straight to a verse leaves it in sight beside its note — open it
  a few times, it was one in four. · laptop · issue: `one-page-link-note-covers-verse`
- [ ] The bar grows under the finger and settles on a page, both ways up. · phone, ipad-side ·
  tests: pagebar, pagebar-detents, pagebar-fisheye specs

## A verse's tools

- [ ] Tap a verse: its tools sit in one even row with no scraps of the bar behind them. · phone ·
  issues: `phone-tool-icons-out-of-line`, `verse-tools-leave-bar-scraps`
- [ ] Press a verse's number: one list of tools, not two. · any · issue:
  `number-menu-and-toolbar-together`
- [ ] Open a verse's number menu with the keyboard and press Down at once, while its lines are
  still arriving: the keyboard stays on the line you moved to, and never drops off the menu. ·
  desktop, and the pitch suite with `HIFTH_PITCH_BROWSER=webkit` · issue:
  `number-menu-keyboard-pulled-back` · test: VerseMenu.keys.test.tsx
- [ ] Press and hold a verse: one menu, not a menu with a note stacked on it. · phone · issue:
  `long-press-menu-and-note-stack-on-phone`
- [ ] The "later surahs" arrow's direction. · any · **open, the owner's call** — issue:
  `later-arrow-direction` (do not change it on a walk)

## The note (pitch)

- [ ] Walk the demo path in Firefox at a desk: open 2:255's note, its look-alikes, 2:48's note and
  its links, a verse's number menu, the tajweed key. Every push runs the pitch suite's
  laptop-sized tests in Firefox too; its phone and iPad tests do not run there, since the test
  tool cannot make Firefox a phone, so look at those by hand. · desktop (Firefox), laptop
  (Firefox) · `make drive BROWSER=firefox DEVICE=desktop` · test: the `pitch-firefox` run,
  `docs/issues/firefox-pitch-run-laptop-only.md`
- [ ] Open a verse's note: it never covers its own verse, also after turning the phone. · phone,
  phone-side · issue: `note-covers-verse-after-turn`. Sideways, a verse too long for the room
  above the note (2:255) starts at its first line with the rest under the note; that is known
  and open, not a new fault · issue: `sideways-phone-long-verse-under-note`
- [ ] Read a note to the end: it ends above the page bar, and reads like the printed book. · any ·
  **open** — issue: `pitch-commentary-differs-from-print` (outside the demo notes, italic words
  still show upright)
- [ ] In every demo note (2:255, 2:48, 15:30–31, 18:10–14, and the long note 18:60–82 shares), the
  words the book slants are slanted — open each demo verse, not only the first few: a transliterated word, a quoted verse phrase. No stray box or mark shows
  where a slant starts or ends, and a slanted run next to a cited verse keeps the verse a link.
  · laptop, and the iPad app after `make app-web` · test: `e2e/pitch.spec.ts` ("the demo's notes
  set the book's italics")
- [ ] Follow a demo note's verse link (18:60 to 18:65): the note it opens has its slanted words too.
  A note the book shares across verses (18:60–82) breaks into the same paragraphs under each of
  them; open two of its verses, not only the first. Where the print starts a new paragraph, the
  panel does too. In the Mac and iPad apps the link stays in the app, and the note's back button
  returns to 18:60 · laptop, phone, ipad, Mac app, iPad app (`make app-probe EVAL=…` clicks the link from inside
  the page) · test: `e2e/pitch.spec.ts` ("a note the book shares across verses
  breaks into the same paragraphs") · issue: `pitch-commentary-differs-from-print`
- [ ] Open 2:255's note and count its paragraphs against the printed page: ten, each starting
  where the print sets a line in, none run on after a full stop (the short line that opens the
  related verses comes after them and is not one of the ten). · laptop, iPad simulator, Mac app · test:
  `e2e/pitch.spec.ts` ("the note on the Throne Verse keeps the paragraphs") · issue:
  `pitch-commentary-differs-from-print`
- [ ] A note longer than its card fades at its foot, not cut through a line, until its end is
  reached; on a phone, also once the card is pulled up. · any · issue: `note-card-no-more-below-cue`
- [ ] The commentators' initials can be tapped and say whose comment it is. · phone · issues:
  `note-initials-unexplained`, `initials-too-small-to-tap`
- [ ] Verses a note points to are links; a mention of the note's own verse is not, and does not
  break across two lines. · any · issues: `intro-and-same-surah-verses-unlinked`,
  `note-links-to-its-own-verse`, `own-verse-breaks-across-lines`
- [ ] In a note, a bare verse number that carries a list on after a comma is a link, also when a colon,
  a bracket or "of this surah" follows it; one after a semicolon stays plain text, as the book puts
  a semicolon between surahs · laptop · test: `packages/core/src/citations.test.ts`
- [ ] A reference with a trailing "c" ("2:48c", the book's way of saying "the note on 2:48") is a
  link, and a tap lands on that verse with its note open, not on the bare page (3:91's note, checked
  2026-10-10). · laptop, iPad app · test: `packages/core/src/citations.test.ts`
- [ ] At the foot of 18:60's note, the related verses show each cited run as one card
  (in the shape "9:4–9:7") beside the note's references to other surahs, not eight cards of one run. ·
  any · issue: `related-verses-ranges-crowd-out`
- [ ] In 2:48's and 15:30's notes, every related-verses row has a line under its name, the app's own
  look-alike rows included ("Most alike: …", the shared words); the shared words sit under the
  captions and the arrow stays at the row's end. · laptop and phone, both languages · issue:
  `note-list-lookalike-rows-bare`
- [ ] A note shared by a run of verses opens on the run, set smaller, in red, with a gap before the
  prose, as the print does; a note of one verse has none. Also walk a few notes one tap from a demo
  note (3:91, 5:36, 70:11, 7:156), not only the demo's own. · iPad app on its side, laptop, Firefox ·
  `make app-walk SIDEWAYS=1 ROUTES='/hafs-kfqc/70:11?open=commentary /hafs-kfqc/15:30?open=commentary'`
  · issue: `shared-note-run-head-unset` · test: `e2e/pitch.spec.ts`
- [ ] Where a note's related verses have fewer than eight cards (try 18:65 and 18:22), every verse
  the note links is among them. · any · issue: `related-verses-drop-bare-numbers`
- [ ] At 2:255, the eight related cards end on a line that says how many more the note points to;
  pressing it lists them after the eighth and the line goes. · any · issue: `related-verses-cut-at-eight`
- [ ] With "All at once" set in the info panel, 2:255 lists every related verse with no line, and
  still does after a reload. · any · issue: `related-verses-cut-at-eight`
- [ ] Beside two pages, a card lies over the facing page and shows no drag bar. · desktop,
  ipad-side · issue: `spread-cards-show-drag-bar`
- [ ] On an iPad held upright, the note and the lists lie across the page, not in a corner beside
  an empty block. · ipad, and the iPad app · issue: `upright-ipad-note-in-corner`

## The surah introduction (pitch)

- [ ] Open it from the surah's first verse and from a verse far into the surah. · desktop,
  ipad-side, and the iPad app upright and on its side · It lies over the facing page both times. · issues: `intro-on-spread-opens-as-phone-card`,
  `intro-from-deep-verse-floats`
- [ ] The surah's name stays in sight, and the verse's tools step aside. · any · issues:
  `intro-card-covers-surah-name`, `intro-leaves-verse-tools-up`

## Roots and look-alikes (pitch)

- [ ] Open the roots list and the similar-verses list on a verse: the verse stays in sight. ·
  phone · issue: `phone-lists-hide-their-verse`
- [ ] Sideways, a list never covers the verse's last line. · phone-side · issue:
  `sideways-list-covers-verse`
- [ ] Scroll deep into a list: you can still close it. · any · issue: `list-sheet-title-scrolls-away`
- [ ] Every look-alike row that offers to open has something to show. · any · issue:
  `lookalike-row-opens-to-nothing`
- [ ] Every look-alike row says why it is there: a difference line, a comparison to open, or a
  passage named as a range (try 2:48 — "2:122–2:123"), or a line saying how they are alike (try
  10:15's later surahs — 19:73, 39:13). No bare verse name. · any · issue:
  `lookalike-passage-row-unnamed`, `lookalike-row-no-reason`
- [ ] A look-alike row whose words repeat opens a comparison with every shared stretch marked (try
  10:15 → 19:73: the opening green, the one word spelled differently ochre); with the info panel's
  "side by side, unmarked" it opens plain. A loosely alike row opens plain. · desktop, phone · issue:
  `lookalike-row-no-compare`
- [ ] Opening the last look-alike rows shows what opened: the whole row if it fits, else its name
  just under the list's title (try 10:15's later surahs → 39:13 on desktop Firefox, 46:7 on a phone).
  In the iPad or Mac app, find the "later surahs" button by its accessible label, not its text (it
  shows only a count). · desktop (Firefox), phone, ipad, ipad-side, iPad app, Mac app · issue:
  `lookalike-compare-below-edge`
- [ ] Opening the *first* look-alike row, while the list is still at its start, keeps the row's name
  in sight under the title, not behind it (15:30's later surahs → the passage in surah 38, on a
  phone, English and Arabic). · phone, ipad, iPad app · issue: `lookalike-opened-row-name-behind-title`
- [ ] In Arabic, a look-alike pair's own note reads in Arabic and its two-way arrow is plain text, not
  a blue emoji tile (open 2:48's look-alikes; the row for 2:123). · phone, ipad, the iPad app (Arabic) ·
  issue: `lookalike-note-english-in-arabic`
- [ ] With a note open on a phone, "Show all of the note" leaves no look-alike button greyed on the page
  behind it, and "Show less" puts them back on the note's top edge (2:48 in the pitch build). · phone ·
  issue: `lookalike-chips-left-behind-grown-note`
- [ ] The look-alike buttons cover no words, no close button, and are not hidden by a note. ·
  phone, phone-side, desktop · issues: `lookalike-chips-cover-lifted-page`,
  `lookalike-chips-sideways-cover-close`, `chips-under-facing-note`
- [ ] A look-alike row that names a whole passage says how the two are alike and opens onto the verse
  inside it that matches (try 15:30's later surahs: the passage in surah 38 opens onto 38:73, not
  its first verse; 23:7 opens onto 70:31). · desktop (Firefox), phone, the iPad app · issue:
  `lookalike-passage-row-reason`
- [ ] Closed, a passage row says which verse inside it is most alike (15:30's later surahs: the passage
  38:72 to 38:75 says 38:73), in English and Arabic. · phone, desktop (Firefox), the iPad app · issue:
  `lookalike-passage-row-names-match`
- [ ] A link that asks for a verse's look-alikes (`?open=lookalikes`, try 2:48) opens the list, not
  the note, even on a slow load. · desktop, the iPad app · issue: `pitch-link-lookalikes-opens-note`
- [ ] Opened from a link, the look-alike list (and the passage menu) shows no focus ring round its
  close button, since nothing was pressed; opened by a press on a chip, the first control takes it.
  · phone on its side, desktop · test: `HopPopover.test.tsx` ("opened by a link")
- [ ] The tajweed key, opened with the colours off (the ⓘ, or `?open=key`), counts the rules on the
  page (page 45 has madd on 5 ayahs), and never says "none" while still loading. · every flavour ·
  issue: `tajweed-key-none-when-off`
- [ ] On a laptop-sized window (and in the Mac app) open the tajweed key: if it is taller than its
  card, its foot fades to say there is more, and scrolling to the end shows the source's credit
  with the fade gone. · desktop, the Mac app · issue: `tajweed-key-hidden-credit`
- [ ] Scrolled to its end, the tajweed key still shows its title and close button at the top of
  the card, and the credit's web address sits whole on one line, in Firefox and in Arabic too. ·
  desktop, laptop, phone, Firefox, the Mac app · `make drive DEVICE=laptop BROWSER=firefox LOCALE=ar
  HASH='/hafs-kfqc/p45?open=key'` · issues: `tajweed-key-title-scrolls-away`,
  `tajweed-key-credit-address-cut` · test: `e2e/tajweed-key.spec.ts`
- [ ] Read every sentence a panel shows as a hafiz would: no word for how the app is built
  ("build", "table", "ids", "pack"…), and nothing that says "phone" on an iPad or a Mac. Inside
  the iPad app, the juz map has no keep-offline shelf. · every flavour · issue:
  `reader-words-plumbing`
  · test: the pitch test "opens the look-alike list even when the note's file arrives first"

## Pens, bookmarks, the interface language

- [ ] Mark up a page with each pen from each place the pens can live. · any · tests: pen-homes,
  pen-colours specs
- [ ] Bookmark a page: the ribbon and folded corner look right, in Firefox too. · desktop with
  `BROWSER=firefox` · test: edge-peel spec
- [ ] Switch the interface to Arabic: everything mirrors, nothing is cut off; on an iPad, upright
  and on its side, open a note too: its close button is on the left and the card stays whole. ·
  phone, desktop, ipad, ipad-side · tests: lang, chrome-fit specs, pitch "the note mirrors"
- [ ] Open settings and scroll to the end: one line under the title, and no choice that this screen
  cannot use (nothing about two facing pages on a phone). · phone, desktop · issue:
  `phone-settings-spread-choice-and-double-line`

## The Mac and iPad apps

- [ ] Open the app at a verse and at a page; turn, zoom, open a note. · `make app-run-mac`,
  `make app-run-ipad` · Same as the browser. · see the native-shell skill
- [ ] Walk the pitch **in the iPad app**, not only in the browser: the iPad's own WebKit lays out
  differently from Playwright's. Rebuild the bundle (`make app-web FLAVOUR=pitch`), launch at a
  verse, turn the simulator, screenshot, and measure from inside the page with
  `make app-probe TARGET=ipad EVAL=…`. For many links at once, `make app-walk ROUTES='…'`
  (add `SIDEWAYS=1` to turn it) keeps one picture per link. · the native-shell skill, "Walking
  the app in the simulator"
- [ ] Walk the iPad app in English as well as Arabic (`LOCALE=en`): the buttons read English even
  though the simulator has Arabic picked in the app, and Arabic is still picked afterwards. ·
  iPad simulator · test: `native/HifthTests/RouteTests.swift` ("a language named for this
  launch, and only one the app has")
- [ ] Hold the iPad app sideways: two pages fill the height between the bars, not a sliver in the
  middle of the desk. · iPad simulator, landscape · issue: `ipad-app-sideways-spread-tiny` · test:
  `make app-test ONLY=SmokeTests/testLandscapeOpensTheBookFullSize`
- [ ] Walk the Mac app in Arabic too, not only the iPad: the look-alike list and a note open,
  mirrored, nothing cut off. · `make app-shot TARGET=mac LOCALE=ar ROUTE=…` (shows that language
  for the one launch, even where another is picked with the app's own button) · tests:
  `scripts/native-make-locale.test.mjs`, `native/HifthTests/RouteTests.swift`
- [ ] The Mac app's own picture of a page is the page, not an empty file: two pages, full size.
  · `make app-shot TARGET=mac ROUTE=/hafs-kfqc/p45` (fails on an empty picture) · issue:
  `mac-app-shot-empty`
- [ ] The Mac app's pictures show the page settled: chips filled, the verse coloured, the note all
  the way in, and no empty strip along the bottom. · `make app-shot TARGET=mac` (refuses a page that
  says it is hidden, and a picture not the page's size) · issue: `mac-app-shot-frozen`
- [ ] Before trusting `make app-golden` on the iPad and iPhone, check its saved pictures are not
  older than the last change to the page's look, and that none shows The Study Quran's words: they
  are committed to a public repository. It runs on the public build only (`make app-web
  FLAVOUR=public`). · issue: `shell-goldens-stale`
- [ ] Switch the app from the pitch build to the public one: it works, and no private folder is
  left in the app. · `make app-web FLAVOUR=public` · issue: `shell-public-copy-kept-private` · test:
  `node --test scripts/native-golden-public.test.mjs`
- [ ] Pinch a page in the iPad app to look closer, ending with a finger on a verse: the page grows,
  and no verse is selected and no menu opens. Same with the note tool picked: no note is pinned.
  · iPad simulator · issue: `ipad-pinch-selects-verse` · test:
  `make app-test ONLY=SmokeTests/testPinchSelectsNothing`
- [ ] After that pinch, the zoom readout says the new size, not 100%, and + goes up from there.
  · iPad simulator · issue: `ipad-pinch-readout-stuck` · test:
  `make app-test ONLY=SmokeTests/testPinchMovesTheZoomReadout`
- [ ] Hold the iPad sideways and pinch across the fold, one finger on each page: both pages grow
  together from the fold, and no verses are selected and no panel opens. · iPad simulator and
  the `ipad` browser tests · issue: `ipad-spread-pinch-selects-range` · test:
  `make app-test ONLY=SmokeTests/testPinchOnTheOpenBookSelectsNothing`
- [ ] Walk the iPad app sideways: every picture is wider than it is tall. If the walk fails with
  "asked for sideways, got an upright picture", the simulator is stuck; restart it. · iPad
  simulator · issue: `ipad-sideways-checks-upright` · test: `make app-walk ROUTES='/hafs-kfqc/p1'
  SIDEWAYS=1`
- [ ] Open a verse's look-alikes on an upright iPad (and a phone): the whole verse stays in sight
  above the list. · `make drive DEVICE=ipad HASH='#/hafs-kfqc/2:48?open=lookalikes'` · issue:
  `lookalikes-card-covers-verse` · test: `e2e/open-link.spec.ts`
- [ ] Open 7:106's and 15:30's look-alikes under each of the info panel's three ways for a passage and a verse
  inside it: "Show both rows" lists both, "Verse under its passage" indents the verse beneath its
  passage, "Verse only" leaves the passage out. In every way the number on the rail button is the
  number of rows in the list. Set it back to both after. · `make drive DEVICE=ipad
  HASH='#/hafs-kfqc/7:106' ACT='eval=(localStorage.setItem("hifth.passage-rows.v1","drop"),location.reload());
  settle=1500; eval=(location.hash="#/hafs-kfqc/7:106?open=lookalikes"); settle=1500'` · issue: `lookalike-passage-and-verse-overlap`
  · test: `packages/core/src/adjacency.test.ts`
- [ ] Open 15:30's and 2:48's look-alikes in English and in Arabic: each row that shares one stretch shows
  the other verse's shared words cut from the page, under the row's name, starting at the same edge as the
  name, and the picture stops where the two verses part. It comes after every caption on its row, never
  between two of them. Opening the row replaces the picture with the
  comparison. Try the info panel's "As a count" and "Not shown" too, then set it back. · `make drive
  DEVICE=phone LOCALE=en HASH='#/hafs-kfqc/15:30?open=lookalikes'` · issue: `lookalike-row-shared-words-unseen`
  · test: `e2e/lookalike-compare-view.spec.ts`
- [ ] Open a long verse's note on an upright iPad in the pitch build: a verse a little taller than
  the room shows whole above the note, its number included, and the zoom readout says the smaller
  level, reached in one move (not zoomed in and then back out). · `make drive DEVICE=ipad
  HASH='#/hafs-kfqc/2:255'` · issue: `long-verse-under-ipad-note` ·
  test: `e2e/pitch.spec.ts`
- [ ] The same on an upright iPad with the info panel set to "Note a little shorter": the page stays
  at the level the link asked for, the note opens a little shorter, and the whole verse still shows
  above it. Set it back after. · `make drive DEVICE=ipad HASH='#/hafs-kfqc/p1' ACT='clickrole=button|About
  Hifth; click=[data-long-verse="shorter"]; press=Escape; eval=location.hash="#/hafs-kfqc/2:255"'` ·
  issue: `upright-ipad-shorter-note-way` · test: `e2e/pitch.spec.ts`
- [ ] Open the tips from settings in the pitch build: the foot line does not repeat the first
  tip, and comes back once the tips are skipped or done. · `make drive DEVICE=phone
  HASH='#/hafs-kfqc/p1?open=tips'` · issue: `tips-repeat-foot-line` · test: `e2e/pitch.spec.ts`
- [ ] In the iPad and Mac apps, every go-to arrow (a note's related verses, the look-alike rows,
  the way back) and the play buttons draw as plain marks, not coloured emoji tiles, in Arabic and
  English. · `make app-walk SIDEWAYS=1 LOCALE=ar ROUTES='/hafs-kfqc/2:48?open=lookalikes
  /hafs-kfqc/15:30?open=commentary'` · test: `src/glyphs-as-text.test.ts`, `e2e/hop.spec.ts`
- [ ] A red ribbon down the crease is the where-you-left-off marker, not a fault: it moves to a
  page after six seconds there and is saved, and the simulator keeps it between installs. For a
  clean picture uninstall the app first; when it shows, it lies in the margin, clear of the
  letters. · `make app-walk SIDEWAYS=1 ROUTES='/hafs-kfqc/15:30?open=commentary'` · test:
  `e2e/desktop.spec.ts`
- [ ] On an iPad held upright, the look-alike and roots lists open short at the foot of the
  page with the page bright behind them, as the note does: no dimmed page or toolbar, and the
  verse they are about sits above them, not under. · `make app-walk ROUTES='/hafs-kfqc/2:255?open=roots'`
  · test: `e2e/pitch.spec.ts` ("leaves its verse bright")
- [ ] On a laptop closed to one page, the look-alike and roots lists stand in the corner beside
  the page at their full height, with no veil: the short height is only for where a list lies
  across the page (a phone, an iPad held upright). · `make drive DEVICE=laptop HASH='#/hafs-kfqc/2:255?open=roots' ACT='clickrole=radio|one page'`
  · test: `e2e/desktop.spec.ts` ("keeps its height, and leaves the page bright")
- [ ] On an iPad held upright, each row of the look-alike and roots lists keeps its go-to button
  within reach of the verse it opens: the card spans the page, as the note does, but its rows
  stand in a centred column, not stretched edge to edge with the name at one side and the button
  at the other. · `make drive DEVICE=ipad HASH='#/hafs-kfqc/2:255?open=roots'` · test:
  `e2e/pitch.spec.ts` ("sits near the verse it opens")
- [ ] In a note, every verse number the prose names is a link: a reference left as plain words, or a
  number with a letter in it, is a word the capture misread; read it off the page picture and add it
  to the hand-read misreads. · `make drive DEVICE=laptop HASH='#/hafs-kfqc/28:88'` · test:
  `e2e/pitch.spec.ts` ("a verse number the capture misread is put back")
- [ ] A note's quote marks are curly and a range of numbers has a dash, as the book prints them: a
  straight quote, or a hyphen between two numbers, is the capture's, and the typography rule should
  have set it. A straight quote between two letters is a misread letter for the hand-read
  misreads. · `make drive DEVICE=laptop HASH='#/hafs-kfqc/28:88'` · test: `e2e/pitch.spec.ts`
  ("prints the book's curly quotes")
