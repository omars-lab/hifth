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
- [ ] The bar grows under the finger and settles on a page, both ways up. · phone, ipad-side ·
  tests: pagebar, pagebar-detents, pagebar-fisheye specs

## A verse's tools

- [ ] Tap a verse: its tools sit in one even row with no scraps of the bar behind them. · phone ·
  issues: `phone-tool-icons-out-of-line`, `verse-tools-leave-bar-scraps`
- [ ] Press a verse's number: one list of tools, not two. · any · issue:
  `number-menu-and-toolbar-together`
- [ ] Press and hold a verse: one menu, not a menu with a note stacked on it. · phone · issue:
  `long-press-menu-and-note-stack-on-phone`
- [ ] The "later surahs" arrow's direction. · any · **open, the owner's call** — issue:
  `later-arrow-direction` (do not change it on a walk)

## The note (pitch)

- [ ] Open a verse's note: it never covers its own verse, also after turning the phone. · phone,
  phone-side · issue: `note-covers-verse-after-turn`
- [ ] Read a note to the end: it ends above the page bar, and reads like the printed book. · any ·
  **open** — issue: `pitch-commentary-differs-from-print` (23 notes still end short)
- [ ] The commentators' initials can be tapped and say whose comment it is. · phone · issues:
  `note-initials-unexplained`, `initials-too-small-to-tap`
- [ ] Verses a note points to are links; a mention of the note's own verse is not, and does not
  break across two lines. · any · issues: `intro-and-same-surah-verses-unlinked`,
  `note-links-to-its-own-verse`, `own-verse-breaks-across-lines`
- [ ] Beside two pages, a card lies over the facing page and shows no drag bar. · desktop,
  ipad-side · issue: `spread-cards-show-drag-bar`

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
- [ ] The look-alike buttons cover no words, no close button, and are not hidden by a note. ·
  phone, phone-side, desktop · issues: `lookalike-chips-cover-lifted-page`,
  `lookalike-chips-sideways-cover-close`, `chips-under-facing-note`

## Pens, bookmarks, the interface language

- [ ] Mark up a page with each pen from each place the pens can live. · any · tests: pen-homes,
  pen-colours specs
- [ ] Bookmark a page: the ribbon and folded corner look right, in Firefox too. · desktop with
  `BROWSER=firefox` · test: edge-peel spec
- [ ] Switch the interface to Arabic: everything mirrors, nothing is cut off. · phone, desktop ·
  tests: lang, chrome-fit specs

## The Mac and iPad apps

- [ ] Open the app at a verse and at a page; turn, zoom, open a note. · `make app-run-mac`,
  `make app-run-ipad` · Same as the browser. · see the native-shell skill
