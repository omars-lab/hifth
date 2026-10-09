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

- [ ] Open a verse's note: it never covers its own verse, also after turning the phone. · phone,
  phone-side · issue: `note-covers-verse-after-turn`. Sideways, a verse too long for the room
  above the note (2:255) starts at its first line with the rest under the note; that is known
  and open, not a new fault · issue: `sideways-phone-long-verse-under-note`
- [ ] Read a note to the end: it ends above the page bar, and reads like the printed book. · any ·
  **open** — issue: `pitch-commentary-differs-from-print` (outside the demo notes, italic words
  still show upright)
- [ ] In the demo notes (2:255, 18:10–14, and the long note 18:60–82 shares), the words the book
  slants are slanted: a transliterated word, a quoted verse phrase. No stray box or mark shows
  where a slant starts or ends, and a slanted run next to a cited verse keeps the verse a link.
  · laptop, and the iPad app after `make app-web` · test: `e2e/pitch.spec.ts` ("the demo's notes
  set the book's italics")
- [ ] A note longer than its card fades at its foot, not cut through a line, until its end is
  reached; on a phone, also once the card is pulled up. · any · issue: `note-card-no-more-below-cue`
- [ ] The commentators' initials can be tapped and say whose comment it is. · phone · issues:
  `note-initials-unexplained`, `initials-too-small-to-tap`
- [ ] Verses a note points to are links; a mention of the note's own verse is not, and does not
  break across two lines. · any · issues: `intro-and-same-surah-verses-unlinked`,
  `note-links-to-its-own-verse`, `own-verse-breaks-across-lines`
- [ ] At the foot of 18:60's note, the related verses show each cited run as one card
  (in the shape "9:4–9:7") beside the note's references to other surahs, not eight cards of one run. ·
  any · issue: `related-verses-ranges-crowd-out`
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
  ipad-side · It lies over the facing page both times. · issues: `intro-on-spread-opens-as-phone-card`,
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
- [ ] The look-alike buttons cover no words, no close button, and are not hidden by a note. ·
  phone, phone-side, desktop · issues: `lookalike-chips-cover-lifted-page`,
  `lookalike-chips-sideways-cover-close`, `chips-under-facing-note`
- [ ] A look-alike row that names a whole passage says how the two are alike and opens onto the verse
  inside it that matches (try 15:30's later surahs: the passage in surah 38 opens onto 38:73, not
  its first verse; 23:7 opens onto 70:31). · desktop (Firefox), phone, the iPad app · issue:
  `lookalike-passage-row-reason`
- [ ] A link that asks for a verse's look-alikes (`?open=lookalikes`, try 2:48) opens the list, not
  the note, even on a slow load. · desktop, the iPad app · issue: `pitch-link-lookalikes-opens-note`
- [ ] The tajweed key, opened with the colours off (the ⓘ, or `?open=key`), counts the rules on the
  page (page 45 has madd on 5 ayahs), and never says "none" while still loading. · every flavour ·
  issue: `tajweed-key-none-when-off`
- [ ] On a laptop-sized window (and in the Mac app) open the tajweed key: if it is taller than its
  card, its foot fades to say there is more, and scrolling to the end shows the source's credit
  with the fade gone. · desktop, the Mac app · issue: `tajweed-key-hidden-credit`
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
- [ ] Hold the iPad app sideways: two pages fill the height between the bars, not a sliver in the
  middle of the desk. · iPad simulator, landscape · issue: `ipad-app-sideways-spread-tiny` · test:
  `make app-test ONLY=SmokeTests/testLandscapeOpensTheBookFullSize`
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
