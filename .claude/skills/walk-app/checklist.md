# What to check on a walk

The list grows. **Every fault a walk finds adds a line here**, in the same change as its fix and
its test, so the next walk looks for it on purpose. A line says what to do, where to do it, what
right looks like, and the test that now guards it (`issue:` is its row in `docs/issues.json`).

Where, in the words `make drive DEVICE=` takes: **desktop** (two pages at a desk), **laptop**,
**ipad** (upright), **ipad-side**, **ipad-big-side**, **phone**, **phone-side**. "Any" means every
one of them. *Pitch* means the private build (`make pitch`); everything else is both builds.

## The first screen

- [ ] Before a walk that follows a rename of any button, run the walk-name test: a walk that
  searches for an old name reports "no button" about a screen that has one. · any · issue:
  `walk-scripts-stale-button-names`
- [ ] A walk search for a button whose name starts with the words it shows (the app's name in the
  corner, opening settings) names those words in the walk-name test's table, so the test checks
  the name the app really builds. · any · issue: `walk-names-shown-words-first`
- [ ] Open the app cold, hint not yet seen. · any · The hint says the right thing for the hand:
  "click" at a desk, "tap" on a phone. · issue: `desktop-hint-says-tap`
- [ ] At a desk, read every line that tells the hand what to do (under the page, each tool's line on
  the tools bar, the first tips, the empty notes list, the related verses' line): none says tap, in
  English or Arabic. On an iPad on its side, the same lines say tap, not click. · desktop, laptop,
  ipad-side · issue: `desk-lines-say-tap`
- [ ] A short laptop window (1280 by 610, 1366 by 660) with a mouse opens the book on two pages,
  both feet in sight above the bars; pick one page and its foot stays in sight; press F and each
  page grows past a phone's. An iPad mini on its side still opens on one page. · laptop, ipad-side
  · issue: `short-screen-loses-the-spread` · in the apps (2026-10-23, asked from inside): the Mac
  app says mouse, the iPad mini app says touch, as the rule needs
- [ ] On a 1133 by 744 laptop window with one page picked, set "Page stays in the middle" and open
  the roots list: the page slides aside at its own size, never drawn tiny beside the list. · laptop
  · issue: `short-window-roots-list-middle-too-small`
- [ ] An upright iPad opens on one page you can read, not two small ones. · ipad · issue:
  `upright-ipad-opens-two-small-pages`
- [ ] A deep link to a verse lands on its page with the verse marked; turn the phone the moment it
  opens and the mark is still there. · phone, phone-side · issue: `turned-phone-loses-linked-verse-mark`
- [ ] Open at page 1 and turn to page 3: the paper stays the same size and shape; the opening text sits
  in the middle, not on a squat card. · desktop, phone · issue: `opening-pages-squat`
- [ ] In the info panel, set "The first two pages" to usual size: pages 1 and 2 redraw at once with
  their text the size of page 3's, still centred, and a tap on a verse there still opens it. · desktop, phone
- [ ] Open a link to 2:1 on a phone: page 2's lines stay on the screen, no larger than a jump makes
  any other page's type (the basmala whole), in English and in Arabic. · phone, iphone · issue:
  `phone-hop-opening-page-too-large`

## Turning pages

- [ ] Turn by swiping, by the arrow keys, and at a desk by grabbing the outer edge. · any · The
  page follows the hand; a drag in the middle of a page never turns it. · tests: page-turn,
  desktop, edge-peel specs
- [ ] Walk swipes with `swipe=` (a finger), not `drag=` (a mouse). A phone turns under a swipe
  both ways; an open book on an iPad on its side turns only from its outer edge, a finger in the
  middle never turns it. · phone, phone-side, ipad-side · test: drive-touch spec, "swipe="
- [ ] Flick four pages quickly, each flick starting before the last page has settled: four pages
  turn, none is lost or undone. · phone, phone-side · issue: `quick-second-flick-lost` · tests:
  page-turn spec, "a second flick made"
- [ ] Flick twice fast on a page you have not opened before (the next page still on its way):
  two pages turn. Let a second flick go just as the first lands: it still counts. · phone,
  iphone · issue: `quick-flick-after-slow-page-or-landing` · tests: page-turn spec, "before the
  first flick's page has even arrived"; page-destination unit test
- [ ] With no place chosen for the pens, they sit where the screen puts them (the foot on a
  touch screen, the strip at a desk), even if touch is only found after the app starts. · ipad,
  desktop · issue: `unset-pen-home-follows-screen` · test: pen-homes spec, "nobody has set it"
- [ ] A large iPad on one page turns under a finger. · ipad-big-side with `?view=one` · issue:
  `large-ipad-one-page-no-swipe`
- [ ] Zoom in, then turn: the zoom carries to the next page. · desktop, ipad-side · test: desktop spec
- [ ] With two pages open, zoom in, then turn both ways: both pages of the new opening are
  magnified and meet at the fold. · desktop, laptop, ipad-side · test: desktop spec, "a turn grows
  both of the next two pages"
- [ ] Jump to a juz or surah: the page arrives centred, with no flash of the wrong page. · any ·
  test: hop spec
- [ ] With two pages open and a note beside them, the page still turns by its edge. · desktop ·
  issue: `note-covers-turn-edge` (answered 2026-10-23). By default a drag from the outer edge,
  through the note, closes the note and turns, and a hand cursor shows over that strip. Walk the
  other two in settings ("Turning with a card open"): "stops short" leaves the edge bare; "arrows
  and keys" leaves the edge dead. test: pitch spec, "by default, a drag at the edge"

## The page bar

- [ ] With one page open and a note up, the page bar is still in reach. · laptop, ipad · issue:
  `one-page-note-covers-page-bar` · in the iPad app (walked 2026-10-15 upright on 2:255, with a
  picture from `PROBE_SHOT=`): on the 13-inch the note ends above the full-screen row and the bar
  is clear; the mini held upright opens the note as the phone's sheet, which covers the bar as it
  does on a phone (close the note or swipe to turn), and that is the phone's design, not this fault
- [ ] With one page open, a link straight to a verse leaves it in sight beside its note — open it
  a few times, it was one in four. · laptop · issue: `one-page-link-note-covers-verse` · the
  iPad app upright, both sizes: 2:255 lit above its note (walked 2026-10-15)
- [ ] With one page open on a window the size of an iPad mini on its side, open a verse with the
  roots list already up, a few times over (on a slow connection if you can): the page lands at
  the same size each time, and closing the list gives it back the same size. · laptop, ipad-side ·
  issue: `card-first-page-lands-off-size` · test: e2e/desktop.spec.ts · the iPad mini app on its
  side: 625 wide with the list first or second, 693 back on close (walked 2026-10-16)
- [ ] The bar grows under the finger and settles on a page, both ways up. · phone, ipad-side ·
  tests: pagebar, pagebar-detents, pagebar-fisheye specs

## A verse's tools

- [ ] Tap a verse: its tools sit in one even row with no scraps of the bar behind them. · phone ·
  issues: `phone-tool-icons-out-of-line`, `verse-tools-leave-bar-scraps`
- [ ] Tap a verse on a wide screen, where its tools rise as a card in the middle of the bar: the
  page slider does not run in under the card and out the other side, and the arrows at its two
  ends stay; close the card and the slider is back. · desktop · laptop · ipad-side · issue:
  `verse-tools-cut-page-slider-wide` (2026-10-15)
- [ ] Tap a verse and read each button's spoken name against the word under its sign: every
  name says that word, so a reader can tap it by voice. · any, both languages, and the demo
  build's note button · issue: `verse-tools-spoken-names` (2026-10-15)
- [ ] Read every named button on the screen, the bars round the page too, against the words it
  shows: each name holds those words (a sign with no letters is exempt). · any, both languages ·
  issue: `screen-buttons-spoken-names` (2026-10-15)
- [ ] Press a verse's number: one list of tools, not two. · any · issue:
  `number-menu-and-toolbar-together`
- [ ] Open a verse's number menu with the keyboard and press Down at once, while its lines are
  still arriving: the keyboard stays on the line you moved to, and never drops off the menu. ·
  desktop, and the pitch suite with `HIFTH_PITCH_BROWSER=webkit` · issue:
  `number-menu-keyboard-pulled-back` · test: VerseMenu.keys.test.tsx
- [ ] Press and hold a verse: one menu, not a menu with a note stacked on it. · phone · issue:
  `long-press-menu-and-note-stack-on-phone`
- [ ] Turn the wifi off and press Listen on a verse: the button turns red and says
  "Offline" (try a wifi with no internet behind it too); turn the wifi back on and press it again: the verse plays. A pitch room may have
  no wifi, and the recitation is the one thing the app fetches from outside. · phone · issue:
  `listen-offline-looked-untouched` · test: e2e/audio.spec.ts
- [ ] In the demo build, cut the internet (or join a wifi with nothing behind it) and open a
  verse's note: it opens with all its words; press Listen on the verse's tools: it turns red
  and says Offline. The room the demo is shown in may have no internet. · pitch, desktop,
  Firefox · issue: `pitch-room-with-no-internet` · test: e2e/pitch.spec.ts
- [ ] Press Listen on a slow connection and look at the button before the verse sounds: it
  already says Pause and turns, in the bar and in the verse's menu, since a press then stops the
  sound. A Play still showing there invites a second tap that silences the verse before it
  began. · any, slow wifi · issue: `loading-says-play` · test: PlayTrigger.test.tsx
- [ ] Play a run on a slow connection and listen between verses: the next one starts at once,
  with no pause, since its file is fetched while the one before plays. Time it with the walk
  skill's gap scripts, in the iPad app as well as a browser: there, only asking early does not
  help. Include a long verse right after a short one (surah 98, verses 3 and 4, on poor wifi):
  each gap names the file it waited for, and one played from the network there means the
  fetching ahead fell behind. · iPad app, slow wifi · issue: `run-gap-on-poor-wifi`,
  `run-gap-short-then-long` · test: audio.test.ts, e2e/verse-gestures.spec.ts
- [ ] Hold the surah's name at the top of the page and press "Keep its recitation on this
  device": the line stays open and counts the verses as they save, then offers to remove them
  with their size. Turn the wifi off and play the surah: it recites, and its first verse starts
  at once. The info panel lists it with its size and a Remove button. · any, then the iPad app
  with `scripts/kept-play-walk.js`, which cuts the recitation off in the page (walked 2026-10-15
  upright: every verse of 112 played from the kept copy) · issue: `keep-surah-recitation-on-device` · test:
  e2e/recitation-keep.spec.ts, recitation-keep.test.ts
- [ ] In the info panel, under the kept surahs, pick "Also once I have heard it all", then play a
  short surah from its corner to its end: it is listed as kept, with its size, and "Kept so
  far" in the setting's note grows. Stop a verse early and it is not counted. Remove it, and it
  stays removed until heard through again. · any, both languages, then the iPad app with
  `scripts/heard-keep-walk.js` (walked 2026-10-15, both ways up: kept) · issue:
  `keep-surah-once-heard-through` · test: e2e/recitation-keep.spec.ts, recitation-keep.test.ts,
  audio.test.ts
- [ ] A walk script that holds a surah's name picks one a finger could touch: upright, the
  neighbouring page stays mounted beside the screen under another layer, and its name's box
  alone looks in sight (found 2026-10-15, the gap and heard-keep walks pressed it and opened no
  menu). · iPad app upright · scripts: gap-walk.js, heard-keep-walk.js, run-note.js
- [ ] On a phone, hold the surah's name and the juz's name at the top of the page: every line
  of the menu is on the screen and can be pressed. A row too wide for the screen stands as a
  column; the surah's row once ran Play off the edge. · phone · issue: `surah-menu-ran-off-phone`
  · test: VerseMenu.keys.test.tsx, e2e/recitation-keep.spec.ts
- [ ] Open a surah's corner menu, wait a moment, and press Play: the first verse sounds at once,
  since its file was asked for when the menu opened. Time it with the gap script and no gaps
  (`--pause 600,2000 --gaps 0`): at a 2 s pause it plays from the copy at home speed and on
  slow wifi, and on no line is it slower than with the setting off. Pressed on a verse's tools
  (`--from tools --route /hafs-kfqc/2:255`) it plays from the copy on every line, since the file
  is asked for as the tools rise. · iPad app, Mac app, slow wifi ·
  issue: `first-verse-wait-on-poor-wifi` · test: audio.test.ts, e2e/verse-gestures.spec.ts
- [ ] Pick "Play to" on a verse and stop it two verses on: the three verses play one after
  another with no second tap, and nothing plays after the last. · desktop · test:
  e2e/verse-gestures.spec.ts ("moves on to the next verse each time one ends")
- [ ] Halfway through a "Play to" run, press Pause on the verse's tools: the verse being heard
  pauses (the button names it, not the run's first), the next press carries on from there, and
  the run still reaches its last verse. Do the same after turning the wifi off on the second
  verse, then back on. · desktop and a phone · issue: `run-could-not-be-paused` · test:
  e2e/verse-gestures.spec.ts ("pausing a run part way", "failed to load carries on")
- [ ] During a "Play to" run, look at the page from across the room: the verse being recited is
  the one marked (the light moves to it, or, with the ring picked in the info panel, a ring
  goes round it while the first stays lit), and at the end the light is back on the first
  (for a run that stays on its page; one that took the page with it ends with its last verse
  lit, PLAN 60).
  Check both in Firefox and on a phone. · issue: `run-verse-not-shown` · test:
  e2e/verse-gestures.spec.ts ("light moves to each verse", "ring chosen")
- [ ] Hold the surah's corner and pick Play, from a page in the middle of the surah: the page
  jumps to the surah's first verse, and when the recitation runs onto the next page the page
  turns by itself, with Pause still on the verse's tools. · desktop and a phone · issue:
  `run-leaves-page-behind` · test: e2e/verse-gestures.spec.ts ("goes past the page")
- [ ] While a surah plays from its corner, turn ahead two pages by hand: the page stays where
  you turned while the recitation plays on, Pause still on the verse's tools, and picks the run
  up again once the recitation reaches that page. Pick "Go back to the recitation" in the info
  panel and do it again: the next verse brings the page back. On a phone or an iPad turn by a
  swipe, not only the page bar, and let a verse end while the finger is still down: the swipe
  still stands. · desktop, a phone and an iPad · issue: `run-hand-turn-pulled-back` · test:
  e2e/verse-gestures.spec.ts ("turned by hand", "mid-swipe", "going back chosen")
- [ ] On an iPad on its side, pull the open book's outer edge with a finger while a run plays:
  the book turns. · iPad sideways, and the iPad app · test: e2e/verse-gestures.spec.ts ("a
  finger pulling the open book's outer edge")
- [ ] Play a short surah from its corner on a page before it and let it run out: the page goes
  along, and at the end the last verse recited is lit with its tools up and Play on it. Stop a
  run part way instead: the page is left as it was. On the private build no note opens at the
  end; the verse's tools are up instead, with the note's button a press away. On a phone the
  lit verse at the foot of the page stays clear of the tools card. On the iPad held sideways the
  open book turns from opening to opening with the run and ends the same way, in the browser and
  in the iPad app on its side (`make app-probe TARGET=ipad SIDEWAYS=1`), in English and Arabic.
  · desktop, Firefox, a phone, an iPad upright and sideways, the iPad app sideways, the Mac app
  (`make app-probe TARGET=mac`), and the private build in the iPad app · issue:
  `run-end-after-follow-unlit`, `run-end-opens-note`, `app-probe-sideways` · test: e2e/verse-gestures.spec.ts ("ends
  with its last verse lit"), e2e/ipad.spec.ts ("turns the open book with it"), src/audio.test.ts,
  e2e/pitch.spec.ts ("tools up, not its note")
- [ ] On the pitch build, with a note open on an iPad held upright, play a run to a verse that
  sits under the note: the page lifts so the verse being recited stays in sight above the note.
  · iPad upright, pitch · issue: `run-leaves-page-behind` · test: e2e/pitch.spec.ts ("keeps the
  verse being recited above the open note")
- [ ] On the pitch build, on its side, with a note open, play the surah from its corner in
  English and in Arabic: the note stays up on the other page, and none of the verse being
  recited is under it (the visit walk's `litUnderNote=0%` at "E playing"). · iPad sideways, the
  iPad app sideways, pitch, Arabic · issue: `kept-note-covers-recited-page` · test:
  e2e/pitch.spec.ts ("lies clear of the verse being recited")
- [ ] Same setup, let the recitation run across two openings (about a hundred seconds at the
  walk's speed): the note moves exactly once a page, when the recitation reaches the page it is
  over, and at no other moment; count the moves. More than one a page is a fault. · the iPad app
  sideways, pitch, English and Arabic · issue: `kept-note-hops-sides` · how it feels: the
  manual-testing list, item 16
- [ ] The "later surahs" arrow's direction. · any · **open, the owner's call** — issue:
  `later-arrow-direction` (do not change it on a walk)
- [ ] Tap a word with the Mistake pen: it asks what went wrong, with three kinds (a harakat sign,
  the whole word, "Went into another verse…") and nothing pressed; closing it marks nothing.
  "Went into another verse…" asks where it *pulled* you, leaves no red mark, and the row in the
  verse's list has "A mistake" pressed. No word on screen says "slip". · phone, iPad, desktop ·
  test: e2e/mistakes.spec.ts, e2e/confusions.spec.ts, src/messages/plain-words.test.ts · then
  the iPad app with `scripts/another-walk.js` (walked 2026-10-15 on both iPad sizes, both ways up,
  English and Arabic: the picker whole on screen, no red mark, no "slip"; seen in a picture
  upright in English and on its side in Arabic, with `window.__leaveUp = true;` and `PROBE_SHOT=`)
- [ ] On an open book, with the Mistake pen, tap the first word of a line on the right-hand page
  and the last word of a line on the left-hand page: each asks, past the strip that turns the
  page. · iPad on its side, desktop · test: e2e/mistakes.spec.ts ("a word at the outer edge of an
  open book asks too") · found 2026-10-13
- [ ] The Mistake pen's question, tapped near each corner and the middle of every page in sight,
  stands just below or above the word, whole on the screen, every button free to press: the
  13-inch iPad and the mini, both ways up, English and Arabic. On the mini on its side, drag the
  page up to reach its last lines. · `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en
  ROUTE=/hafs-kfqc/p7 EVALFILE=.claude/skills/walk-app/scripts/mistake-ask-walk.js DELAY_MS=2500
  PROBE_TIMEOUT_S=200` · test: e2e/ipad.spec.ts ("a drag brings the page's foot into sight") ·
  found 2026-10-13
- [ ] On a phone, with the Mistake pen, tap a long word in the middle and at the foot of the
  page, upright and on its side with a note open: the question stays off the word's whole line,
  all of it on the screen, every choice reachable (a row scrolls sideways), none under the
  look-alike buttons; a choice reached by keyboard keeps its label readable. · phone, phone on its
  side · `make drive DEVICE=phone-side HASH=/hafs-kfqc/2:48 "ACT=settle=2500;evalfile=.claude/skills/walk-app/scripts/mistake-ask-walk.js"` ·
  test: e2e/phone-toolbar.spec.ts ("the Mistake pen's question stays on the screen") · found 2026-10-16
  · walked 2026-10-16 in the real iPhone app too, upright only (the iPhone app does not turn):
  `make app-probe TARGET=ipad IPAD="iPhone 17" LOCALE=en ROUTE=/hafs-kfqc/2:48 EVALFILE=…/mistake-ask-walk.js`.
  The question docks at the foot, whole, clear of its word. A tap near the top of an enlarged page
  lands on the title bar, not a word, so the walk asks nothing there.
- [ ] With the pens set to the left in the info panel ("Which side the pens stand on"), on an
  iPad held sideways in English and Arabic: the pens down the side stand at the left edge, the
  colours on the book's side of them, clear of the page; Mark up sits at the left end of the
  bottom row on top of nothing. · iPad sideways · test: e2e/pen-homes.spec.ts ("which side the
  pens stand on") · built 2026-10-13
- [ ] Every tap-and-hold menu, with all its lines, stays beside the verse and inside the screen.
  · phone, iPad · test: e2e/confusions.spec.ts
- [ ] A test that checks "none of these are on screen" can pass before a list has even opened:
  wait for the list first, then check. · tests · found 2026-10-13 in the jump list's Go test
- [ ] Every design page's status line matches what is built: a page saying "nothing is built"
  when part of it is sent the owner a question about something already done. · docs · found
  2026-10-13 on the confusion-points page

## The note (pitch)

- [ ] Walk the demo path in Firefox at a desk: open 2:255's note, its look-alikes, 2:48's note and
  its links, a verse's number menu, the tajweed key. Every push runs the pitch suite's
  laptop-sized tests in Firefox too; its phone and iPad tests do not run there, since the test
  tool cannot make Firefox a phone, so look at those by hand. · desktop (Firefox), laptop
  (Firefox) · `make drive BROWSER=firefox DEVICE=desktop` · test: the `pitch-firefox` run,
  `docs/issues/firefox-pitch-run-laptop-only.md`
- [ ] Open a verse's note: it never covers its own verse, also after turning the phone. · phone,
  phone-side · issue: `note-covers-verse-after-turn`
- [ ] On a phone on its side in the pitch build, open 2:255's note: all six of its lines and its
  number show between the header and the note, the page drawn smaller; then set the info panel
  to "Note a little shorter" and open it again: the note comes down to the foot of the page and
  the verse still shows whole. Browser only: the apps do not run on a phone. · phone-side ·
  `make drive DEVICE=phone-side HASH='#/hafs-kfqc/2:255?open=commentary'` · issue:
  `sideways-phone-long-verse-under-note` · test: `e2e/pitch.spec.ts`
- [ ] Tap a verse that is not on the demo path, as a visitor will: its note opens like any
  other, never an empty panel or a wait that does not end. · any, pitch · checked 2026-10-11
  by counting the private notes: every one of the 6236 verses has one
- [ ] Read a note to the end: it ends above the page bar, and reads like the printed book. · any ·
  **open** — issue: `pitch-commentary-differs-from-print` (outside the demo notes, about 6
  slanted words in 100 still show upright, and some runs have an edge a word off)
- [ ] Open a note well beyond two taps of the demo (2:37 is one) and set it beside its page picture:
  each Arabic word the book writes with a line or dot under a letter, and no capital, is slanted,
  and a name with a capital stays upright. · desktop, and the iPad app after `make app-web` · test:
  `e2e/pitch.spec.ts` ("a note nobody read by hand slants the Arabic terms the book writes with
  marks") · docs/issues/italics-from-transliteration-marks.md
- [ ] Open a far note with quotations in it (5:64, 35:32) beside its page picture: each phrase the
  print slants is slanted whole, not broken at a short word, and its punctuation sits where the
  print puts it. A note the print sets upright (2:34) stays upright. · desktop, and the iPad app
  after `make app-web` · test: `e2e/pitch.spec.ts` ("a note nobody read by hand slants the phrases
  its printed page slants") · docs/issues/italics-from-page-pictures.md
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
  ipad-side · issue: `spread-cards-show-drag-bar` · walked 2026-10-12 in the Mac app
  (`make app-shot TARGET=mac`) with a note on 2:255, the look-alikes of 2:48 and the
  introduction from 2:2, in English and Arabic: each on the far page, the verse in sight,
  nothing wrong (the bottom bar keeps the book's right-to-left order in both languages, by
  design)
- [ ] In the iPad app on its side, open a note from each page of the opening (closing the first
  before tapping under it): it lies over the other page, the verse stays fully in sight, and the
  next verse tapped moves the note to it (`make app-probe TARGET=ipad SIDEWAYS=1`, measuring
  boxes only). · the iPad app sideways, private build · issue: `app-probe-sideways`
- [ ] Open a note with the iPad on its side, turn it upright, then back, as when it is handed
  across a table: the note stays open each way up and every line of its verse stays in sight and
  clear of it. Then zoom in to 150% and turn it upright again: the same. · ipad-side, ipad, private
  build · checked 2026-10-11 in Chromium and WebKit, clean, zoomed in too; 2026-10-15 in the iPad
  app turned by its UI test (`scripts/hand-turn-walk.js`): the 13-inch in English and Arabic clean
  at 100% and 150%; the real iPad's turn is parked (manual testing 13)
- [ ] On an iPad mini on its side, open a verse's page, turn it upright, then back on its side: the
  page comes back at the size it opened at, its top line in sight, not whole and smaller. · ipad
  (1133×744), the iPad app on the mini, private build · issue:
  `mini-side-again-brings-back-opening-size`
- [ ] With a verse chosen low on the page and its note open, press + until 200%: every line of the
  verse stays on the screen, and with the book open both pages stay level at the fold, and still
  level pressed back down to 100%; set "Grow from the middle" and the verse goes down as before. ·
  desktop, desktop-firefox, ipad-side, the Mac app and the iPad app on its side, private build ·
  issue: `zoom-button-carries-chosen-verse-off`
- [ ] Held upright with the note across the page's foot, press + to 250%: every line of the verse
  stays above the note; at 300%, too tall for that space, its first line is at the top of the
  screen, not above it. · ipad, the iPad app upright, private build · issue:
  `zoom-button-slips-verse-under-upright-note`
- [ ] With the note up, press + twice quickly, then four times quickly: the page lands on the same
  level, and the verse in the same place, as pressing slowly; four presses keep the verse's first
  line at the top. · ipad, the iPad app upright, private build · checked 2026-10-11 in WebKit and
  Chromium, clean
- [ ] Zoomed in with the note up, move to another verse by a link in the note or by tapping it (the
  note has no verse arrows): a link goes back to the opening level, and either way the new verse's
  note opens and every line of the new verse is in sight and clear of it. · ipad, ipad-side,
  private build · checked 2026-10-11 in WebKit upright and on its side, by a link and by a tap,
  clean
- [ ] With the note up on an iPad held upright, tap the visible end of the verse above: the note
  switches and every line of that verse comes into sight, clear of the note, at the opening level
  and at 200%. · ipad, the iPad app upright, private build · issue:
  `tap-other-verse-with-note-up-leaves-it-off-top`
- [ ] With the note up on an iPad held upright, at 250%, play a run two verses on from a verse's
  menu: every verse it recites stays in sight above the note and the page follows. A run that
  stays on its page ends back on the verse it started from, and one that took the page along
  ends on its last verse with that verse's tools up; both are meant. · ipad, private build ·
  checked 2026-10-11 in WebKit, clean
- [ ] With the note up on an iPad held upright, close it: the page eases down to fill the screen,
  with no jump; on a laptop with one page, opening and closing a note beside the page moves the
  page across smoothly too. · ipad, the iPad app upright, desktop, phone, private build · issue:
  `closing-note-jumps-page`
- [ ] With the note up across the page's foot (an iPad held upright, a phone), close it: the note
  slides down out of sight as the page comes down after it, and no brown desk shows between them
  at any moment; a card in a corner beside one page on a laptop goes at once. · ipad, the iPad
  app upright, phone, desktop, private build · issue: `closing-note-shows-desk-strip`
- [ ] With the note up across the page's foot, long-press a verse above it: the note gives way,
  the page comes down, and the menu comes down with its verse, still right beside it. · ipad,
  the iPad app upright, phone, private build · issue: `hold-menu-left-behind`
- [ ] With the note up across the page's foot, open a look-alike list from its chip: the list
  rises in front of the note as the note slides away behind it, never two drawers stacked with
  the note on top. · ipad, the iPad app upright, phone, private build · issue:
  `list-under-leaving-note`
- [ ] With the note up across the page's foot, every hand-off once (Close, a page-turn key, Back,
  a long press, a verse number's menu, a look-alike chip, a swipe, a pinch, and in Arabic): the
  note slides away under whatever takes its place, nothing is left behind, and a pinch keeps the
  note up. The `note-handoff` script walks them all. · ipad, the iPad app upright, private build ·
  walked 2026-10-12, every hand-off in English, five in Arabic, nothing wrong
- [ ] Play a surah from its corner and, while a verse is heard, tap that verse's number and open
  its note: the sound never stops, the run goes on to the next verse, and the page lifts that
  verse above the note. A tap on another verse still stops it. The `run-note` script walks it. ·
  ipad, the iPad app upright, private build · issue: `recited-verse-tap-stops-run`
- [ ] With a note up while a surah plays, the note's title row has a Pause named for the verse
  being heard; pressing it stops the sound and leaves the same note open, and it turns to Play,
  which picks the run up again. The `run-note` script presses it last. · ipad, phone, Firefox,
  Arabic, the iPad app, the Mac app, private build · issue: `no-pause-with-note-up`
- [ ] With a note up while a surah plays, let the run reach the next page (or the next pair of
  pages on its side): the page turns and the run plays on with Pause in reach; each verse recited
  before the turn stays clear of the note. The note on the earlier verse stays up through the
  recitation's turn (the owner's answer), still naming its verse, with Pause in it and a "Back
  to" line that takes the page back to that verse and then goes. The first verse of the new page
  is lit and in sight at once, not lit above the top of the screen until the next verse begins:
  open the note early on the page, so the page has risen for the later verses before the turn,
  and read the light's box, not only its verse (the iPad app, 2026-10-11). The `run-note`
  script with `__page` set walks it. · ipad upright and on its side, the iPad app, private build ·
  issue: `run-turn-closes-note`
- [ ] With a note up on the verse being heard while a surah plays, turn the page by hand (an
  arrow key, a swipe), both at once and again after the recitation has moved a verse past the
  note's: the page turns, the note closes with its verse, and the recitation plays on with Pause
  in reach. Closing the note, its grip, a look-alike chip and a long press keep the
  sound too, and so does pressing the number of the verse being heard; a hop to another verse
  or another verse's number ends it, at once and a verse later. `note-handoff --run`
  walks each in a browser (`--wait 5000` for a verse later); the `run-note` script with `__mode`
  "turn" walks it in the apps (`__turnBy` "key" on the Mac, `__after` 9000 for a verse later).
  Walked 2026-10-12 in a browser (close, key, swipe, grip, long press, a hop), nothing wrong.
  Each says which verse is heard against the note's. · ipad, Firefox, Arabic, the iPad app, the
  Mac app, private build · issues: `hand-turn-stops-run-with-note`, `hand-turn-stops-run-past-note`,
  `hop-keeps-run-by-timing`
- [ ] With a note open, play its surah from the corner: the page goes to the surah's start and
  the note closes (a jump, on purpose); the run plays from there, its first verse lit at once.
  Let it play onto the next page: that page's first verse is lit as the page turns, not one
  verse later. Again with "a ring moves" chosen in the info panel: the ring is on each page's
  first verse as it arrives. The `run-note` script with `__mode` "light" walks it in the apps
  (set the ring with a probe of its own first, and clear it after). · ipad, ipad on its side,
  Arabic, the iPad app, private build · issues: `run-light-misses-new-page`,
  `run-ring-misses-new-page`
- [ ] On an iPad held upright, the note and the lists lie across the page, not in a corner beside
  an empty block. · ipad, and the iPad app · issue: `upright-ipad-note-in-corner`

## The surah introduction (pitch)

- [ ] Open it from the surah's first verse and from a verse far into the surah. · desktop,
  ipad-side, and the iPad app upright and on its side · It lies over the facing page both times. · issues: `intro-on-spread-opens-as-phone-card`,
  `intro-from-deep-verse-floats` · walked 2026-10-12 in the 13-inch iPad app, both ways, from p293's
  name and from 2:255's number, nothing wrong
- [ ] The surah's name stays in sight, and the verse's tools step aside. · any · issues:
  `intro-card-covers-surah-name`, `intro-leaves-verse-tools-up`
- The `intro-walk` script walks both lines in the apps (`window.__from = "deep"` for the verse far
  into the surah), upright and on its side, English and Arabic.

## Roots and look-alikes (pitch)

- [ ] Open the roots list and the similar-verses list on a verse: the verse stays in sight. ·
  phone · issue: `phone-lists-hide-their-verse`
- [ ] Sideways, a list never covers the verse's last line. · phone-side · issue:
  `sideways-list-covers-verse`
- [ ] Scroll deep into a list: you can still close it. · any · issue: `list-sheet-title-scrolls-away`
- [ ] Open the roots list on a verse with many roots (2:255) on a slow connection: the open group
  stays the one you see while the rest arrive, and a group you open or shut stays that way. ·
  any · test: "the open root stays open while the others are still arriving"
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
  phone, phone-side, desktop, ipad (after a link and after a hop, when the page fills the width) ·
  issues: `lookalike-chips-cover-lifted-page`, `lookalike-chips-sideways-cover-close`,
  `chips-under-facing-note`, `lookalike-chips-cover-filled-ipad`
- [ ] Closed to one page, the look-alike buttons stand just outside the page's edge, level with its
  head, and move out with it as the page is zoomed (2:48 and 2:49 with `?view=one`, 15:30 with its
  note open), and cross to the page's other side while the roots list is up, in English and in
  Arabic (the list stands on opposite sides). · laptop, desktop, desktop in Firefox · issue:
  `lookalike-chips-not-beside-one-page`
- [ ] Closed to one page with the roots list open, the list covers none of the page: the page stands
  in the room the list leaves, and comes back to the middle once it closes (2:48 `?view=one`, the
  roots open, in English and in Arabic, where the list stands on the other side); zoomed wider than
  that room, the verse's first word still stands clear of the list (2:45). · laptop, desktop, desktop in
  Firefox · issue:
  `roots-list-hides-line-starts-one-page`
- [ ] With "Page stays in the middle" set in the info panel, open the roots list, Share and the tajweed
  key closed to one page (2:48 `?view=one`): on a laptop and an iPad 13-inch on its side the page keeps to the
  window's middle, drawn smaller and clear of the card, and the look-alike buttons stand on the side
  away from it; on an iPad mini on its side it slides aside instead, never tiny; it comes back to its
  own size on close. Put the setting back afterwards. · laptop, desktop in Firefox, iPad app both
  sizes, both languages · issue: `roots-list-smaller-page-setting` · walked 2026-10-13, nothing wrong
- [ ] With Share open on a laptop, the card covers none of the verse being shared and stands above
  the row of tools, every tool in sight: on one page the page stands clear of it, on two pages it lies
  over the facing page (2:48 and 2:49, `?view=one` and two pages, in English and in Arabic). · laptop,
  desktop · issue: `share-card-covers-page-laptop`
- [ ] On a phone on its side, close the note and press Share (2:48, English and Arabic): every line
  of the verse shows, its last line included, and stays so a second later; the look-alike buttons
  sit on the card's top row, clear of its close button. · phone-side · issue:
  `share-card-clips-verse-sideways-phone`
- [ ] On an iPad held upright, both sizes, press Share (2:48, English and Arabic): no line of the
  verse sits under the card, and the card stands above the row of tools, every tool in sight. ·
  ipad, `VIEWPORT=744x1133`, the iPad app on both sizes (`make app-probe IPAD='iPad mini (A17 Pro)'`)
  · issues: `share-card-covers-verse-ipad-upright`,
  `share-card-covers-tool-row-ipad-mini-upright` · walked 2026-10-12 in the app, both sizes, both
  languages, nothing wrong · the mini again 2026-10-23 in Arabic: no line under the card, no
  button under it
- [ ] On a phone on its side with Share open, in the private build (where the card is a row taller),
  the card stands below the top bar with every one of its own buttons whole; it lies over half the
  verse's tool row, on purpose (2:48, English and Arabic). · phone-side · issue:
  `share-card-covers-tool-row-sideways-phone`
- [ ] On an iPad mini on its side with Share open, the page moves aside for the card and the verse's
  first word stands clear of it; until look-alike rows ⑯ is settled, the start of a second full
  line may still sit under the card's edge (2:48). · `VIEWPORT=1133x744` · issue:
  `share-card-covers-line-start-ipad-mini-side` · walked 2026-10-23 in the app on both iPad sizes on
  their side, English and Arabic: no line under the card; the look-alike buttons ride the card's
  own top row, clear of its close button, as on a phone (the walk script names each button it
  counts under the card, so a button on the card's top row is not mistaken for one it covers).
  On the 13-inch the card stands over the top of the facing page and covers that page's corner
  bookmark button; that is harmless, since the shared verse is on the other page and the
  bookmark comes back once the card closes
- [ ] On an iPad mini on its side, open the note on a long verse (2:255) and then the roots list: the
  page moves aside for each card and the whole verse shows beside it, drawn a little smaller if
  need be; a short verse (2:48) still opens lifted above the note. On a look-alike verse (3:84) the
  look-alike buttons ride the note card's top row, never the page. · `VIEWPORT=1133x744`, the iPad
  app on its side (`make app-probe TARGET=ipad SIDEWAYS=1 "IPAD=iPad mini (A17 Pro)"` with the
  corner-cards script) · issue: `mini-side-long-verse-under-note` · walked 2026-10-12 in the
  browser and the app, both languages, none under either card. Close the note again: the page
  comes back to the size it opened the verse at (the app, both languages, 2026-10-12) · walked
  again 2026-10-23 in the app, both languages, 2:255, 2:48 and 3:84: every card, the roots list
  read to its end and Share, none of the verse under a card, no button on the page or a Close ·
  the same on the iPad Pro 13-inch on its side at all three verses, and upright on both sizes at
  2:255 only, with the cards across the full width (the corner-cards script's wide setting), both
  languages, 2026-10-23
- [ ] On a short laptop window (`VIEWPORT=1366x660` and `1280x610`, `MOUSE=1`), two smaller pages
  open; at 2:255, 2:48 and 3:84 the note, the roots list read to its end, the look-alike lists
  and Share leave the whole verse clear, nothing runs off the screen, and the tajweed key stands
  beside the book and scrolls to its end · the corner-cards script, and the key walk at
  `#/hafs-kfqc/p45?open=key` · walked 2026-10-23 in Firefox and Chrome, English and Arabic,
  nothing wrong (PLAN 120)
- [ ] On the laptop closed to one page, zoom in a step or two past the room the roots list leaves
  (2:45), open the roots list, then close it: open, the page is drawn a little smaller and the
  whole verse stands clear of the list; closed, the page and the zoom readout are back at the
  size you chose. Zoomed in a lot, the list leaves the size alone and keeps the verse's start in
  sight. · `VIEWPORT=1280x800`, `BROWSER=firefox` and Chrome, both languages · issue:
  `closing-a-card-keeps-the-page-smaller` · walked 2026-10-12 in Firefox, both languages; the
  laptop with both pages showing, the three demo verses (2:255, 2:48, 3:84) with each card open,
  none under a card, walked the same day in Firefox
- [ ] On a large iPad held upright, open a look-alike verse (2:48, 3:84) with the note closed: the
  verse's drawer cuts no button in the bar (it covers the whole bar if one would be cut), and the
  look-alike buttons ride its head, a tap away. · `VIEWPORT=1032x1376`, also `1024x700`, both
  languages, and the iPad app on the 13-inch upright · issue:
  `verse-drawer-cuts-bar-large-ipad-upright`
- [ ] On an iPad mini held upright, no card open, the look-alike buttons stand clear of the page's
  top lines (2:48). · `VIEWPORT=744x1133`, the iPad app on the mini · issue:
  `lookalike-buttons-on-top-lines-ipad-mini-upright`
- [ ] On an iPad mini held upright, with the verse's drawer up the look-alike buttons sit in its
  head, and with it put away (Escape twice) in the bottom bar; the drawer covers the whole bar,
  cutting none of its buttons (2:48, English and Arabic). · `VIEWPORT=744x1133`, the iPad app on the
  mini · issue:
  `verse-drawer-cuts-bar-buttons-ipad-mini-upright`
- [ ] On a laptop, follow a link and press + the moment the page lands: the page grows, it never
  shrinks, and the readout ends on the level drawn. · `DEVICE=laptop`, the Mac app · issue:
  `zoom-press-steps-from-stale-readout`
- [ ] Closed to one page with the tajweed key open, the key covers none of the page and stands
  above the row of tools; the page comes back once it closes (2:48 `?view=one`, in English and in
  Arabic). · laptop, desktop · issue: `tajweed-key-covers-page-laptop`
- [ ] On two pages with the tajweed key open, the key lies over the facing page, not the verse's
  (2:48 and 2:49, in English and in Arabic). · laptop, desktop · issue: `tajweed-key-covers-page-spread`
- [ ] On a phone with the note up and its look-alike buttons on its edge, open the tajweed key (and
  About, the jump box, the shelf): the buttons go dim with the page, none stands over the panel
  (2:49). · phone, iphone · issue: `lookalike-chip-over-modal-phone`
- [ ] A look-alike row that names a whole passage says how the two are alike, and opening the row
  lays your verse beside the verse inside it that matches (try 15:30's later surahs: the passage in
  surah 38 is laid beside 38:73, not its first verse; 23:7 beside 70:31). Its hop arrow still lands
  on the passage's first verse (38:72), as ① and ⑤ record; whether it should is look-alike rows ⑰,
  the owner's question, so it is not a fault to fix on a walk. ·
  desktop (Firefox), phone, the iPad app · issue: `lookalike-passage-row-reason`
- [ ] Closed, a passage row says which verse inside it is most alike (15:30's later surahs: the passage
  38:72 to 38:75 says 38:73), in English and Arabic. · phone, desktop (Firefox), the iPad app · issue:
  `lookalike-passage-row-names-match`
- [ ] A link that asks for a verse's look-alikes (`?open=lookalikes`, try 2:48) opens the list, not
  the note, even on a slow load. · desktop, the iPad app · issue: `pitch-link-lookalikes-opens-note`
  · test: the pitch test "opens the look-alike list even when the note's file arrives first"
- [ ] Opened from a link, the look-alike list (and the passage menu) shows no focus ring round its
  close button, since nothing was pressed; opened by a press on a chip, the first control takes it.
  · phone on its side, desktop · test: `HopPopover.test.tsx` ("opened by a link")
- [ ] The same for every other panel a link opens — the roots list, the about page, the tajweed
  key, the revision record, the mus'haf picker: no ring round anything on arrival. Only the go-to
  box shows it has the cursor, since it is there to be typed in. · any · test: open-link.spec
  ("draws no focus ring, and holds focus inside")
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

The `lookalike-walk` script walks this section's app lines (the link, the rows' reasons, the first
and last rows opened, the passage rows, Share and the bars on both iPad sizes, the tajweed key),
upright and on its side, English and Arabic, iPad and Mac. Walked 2026-10-23 in the iPad app,
including the setups an earlier walk had skipped (the list, its first row opened and the bars on
the mini upright and the 13-inch on its side, in Arabic): nothing wrong.

## Pens, bookmarks, the interface language

- [ ] Mark up a page with each pen from each place the pens can live. · any · tests: pen-homes,
  pen-colours specs
  In the iPad and Mac apps, walk it with the `pen-walk` script, each place set first: every pen
  is picked and checked, and the ones that mark by a tap leave their mark on a verse; the drag
  pens (highlight, crop, jump) are only picked there, so the browser tests are what drag them.
  On the large iPad upright the side place has no margin and falls back to the Mark up button.
  In Arabic the side rail and the Mark up button stay on the right: that is the owner's open
  question (notes-style-toolbar ④), not a fault, until it is answered. · issue:
  `pens-stay-right-in-arabic`
- [ ] On the first screen, closed, the Mark up button stands clear of the hint beside it, with
  a space between them, in English and in Arabic. · ipad-side, desktop, iPad app · issue:
  `hint-touches-mark-up` · test: pitch spec, "stands clear of the Mark up button"
- [ ] The page slider's two end arrows are the same shape and size, the right one pointing right
  and the left one left, in English and in Arabic. · any, Firefox especially · issue:
  `slider-arrows-mismatch` · test: slider-arrows spec
- [ ] Pick the highlighter: both colour rows show, the passage circles and the held-words bands,
  with nothing cut off or off the screen; on a phone they get their own line in the tray, down
  an iPad's side two columns. At a 1024-wide window the tools do not slide when the highlighter
  is picked. Pick a band, hold some words: they come out that colour. · phone,
  ipad-big-side, desktop · tests: pen-colours, pen-homes specs · issue: `run-colour-and-own-pen`
- [ ] In the info panel, set Note, Harakat and Word to one button: the bar has two tools fewer,
  the button shows the one used last, and while it is on the three wait beside the tools (on a
  phone in their own line of the tray) without the tools sliding; N, K and W still pick each. ·
  phone, ipad-big-side, desktop · test: mark-tools spec · issue: `note-harakat-word-one-pen`
- [ ] Pin a note with the note tool and close the app with its box still open, writing nothing:
  next time the app starts, that pin is gone, and a note that was written is still there. ·
  desktop, iPad app · test: notes spec ("never written") · issue: `note-left-open-stays-empty`
- [ ] Bookmark a page: the ribbon and folded corner look right, in Firefox too. · desktop with
  `BROWSER=firefox` · test: edge-peel spec
- [ ] Stay on a page for a few seconds until the red ribbon appears down its bound edge: it covers
  none of the writing, on a page bound on the left and one bound on the right. · phone · test:
  bookmarks spec · issue: `seam-covers-line-ends-phone`
- [ ] On an upright iPad, wait for the red ribbon, turn forward and back: it is back across the
  paper's bound edge, where it stood before the turn, not over the ends of the lines. · iPad
  mini app upright (turn-top-walk.js: the start and back lines agree), `DEVICE=ipad` ·
  test: `e2e/ipad.spec.ts` ("the red ribbon is back on the paper's edge") · issue:
  `seam-back-on-edge-after-turn`
- [ ] With the tools open, highlight a passage: its card opens whole over the tools, title and
  all, and the same for the word tool's card. · phone · test: phone-toolbar spec · issue:
  `highlight-card-under-tools-phone`
- [ ] With the harakat tool, tap a vowel-sign with a finger: its note box opens and no
  magnifier is left on the page once the finger lifts. · phone · test: phone-toolbar spec ·
  issue: `sign-loupe-stays-after-tap-phone`
- [ ] Drop a bookmark on a page bound on the left and one bound on the right: the ribbon stops
  above the first line and hides none of its words; in settings, the long ribbon still hangs
  down with its name. · phone, desktop · test: bookmarks spec · issue: `ribbon-covers-first-words`
- [ ] Open the record of what you have opened and try Page, Hizb and Juz: every square sits in its
  own place with a gap round it, and none runs past the sheet's edge. · phone, desktop · tests:
  revision spec, desktop spec ("stays a map") · issue: `map-squares-overlap`
- [ ] With any sheet or card open, look along its bottom edge: no line of text shows half its
  letters under it. · desktop, laptop, Firefox · test: desktop spec ("never half a line") ·
  issue: `record-sheet-slices-bar-line`
- [ ] In Firefox, drag a highlight across a full page of lines: each line's wash covers its
  first word and its last, just as in Chrome. · desktop and laptop with `BROWSER=firefox` ·
  test: highlight spec (runs in Firefox) · issue: `firefox-highlight-short-of-first-word`
- [ ] Switch the interface to Arabic: everything mirrors, nothing is cut off; on an iPad, upright
  and on its side, open a note too: its close button is on the left and the card stays whole. ·
  phone, desktop, ipad, ipad-side · tests: lang, chrome-fit specs, pitch "the note mirrors"
- [ ] Open settings and scroll to the end: one line under the title, and no choice that this screen
  cannot use (nothing about two facing pages on a phone). · phone, desktop · issue:
  `phone-settings-spread-choice-and-double-line`
  In the apps, the `settings-walk` script. The large iPad upright shows one page but keeps the
  two-page and pen choices, rightly: it can open two pages, and the pens' place applies there;
  the iPad mini drops them.
- [ ] Open the app at a page, turn two pages, then open the info panel: *How you use the app* says
  turning the page twice, not three times, and still says so after the app is closed and opened
  again; in Arabic the counts are in the words' own letters, not stretched, and today's bar ends
  the strip on the left. · phone, desktop, iPad app · test: usage spec
- [ ] Mark a mistake, drop a note and type in it, then press Undo beside the tools until it greys
  out: each press takes back one thing (the note and its words go together), Redo puts them back,
  and Ctrl+Z (⌘Z on a Mac) while typing in a note changes only the words. Set the pens down the
  side on an iPad on its side, with the highlighter on: the rail, Undo and Redo at its foot, stays
  between the bars. In Arabic the two arrows mirror. · desktop, desktop-firefox, phone, ipad-side ·
  tests: undo-redo, pen-homes specs
- [ ] Pick up the eraser beside Undo (or press E) and tap, in turn, a slip, a note's pin, a
  bookmark's ribbon and a jump mark: each comes off with no question and no box or drawer
  opening, the eraser stays on, a tap on a bare word marks nothing, and Undo brings each back.
  On a note seeded on two verses, rubbing one pin leaves the other with the words still in it.
  Mark a slip and rub it straight out: Undo still has it. E or a second press puts the eraser
  down. On the iPad's side rail, three buttons at the foot still stay between the bars. ·
  In the iPad and Mac apps the pen walk rubs out the slip it left and presses Undo. ·
  desktop, desktop-firefox, phone, ipad-side, iPad app, Mac app · tests: eraser, undo-redo specs

## The Mac and iPad apps

- [ ] Open the note and a look-alike list **in the iPad app on its side**, both sizes, and
  upright on the large one: each card ends about 24 points below its last row, not 44, and the
  note's fade sits on its edge (native-shell ㉜). · `make app-probe TARGET=ipad SIDEWAYS=1
  "ROUTE=/hafs-kfqc/10:15?open=lookalikes" EVAL=…` reading the card's bottom against its list's
  · test: `apps/web/e2e/card-foot.spec.ts` · walked 2026-10-13 on both sizes on its side, fixed
- [ ] Hand the page a pencil squeeze and double-tap **in the iPad app**, both ways up, both
  sizes, both languages: the pens open beside the tip and whole on the screen (the highlighter's
  two rows wrap when upright), Escape and a pick put them away, and a double-tap swaps the last
  pen used with plain selecting. · `make app-probe TARGET=ipad [SIDEWAYS=1] ROUTE=/hafs-kfqc/p7
  EVALFILE=.claude/skills/walk-app/scripts/pencil-walk.js` · test: `apps/web/e2e/pencil.spec.ts`,
  `native/HifthTests/PencilTests.swift` · walked 2026-10-13, nothing wrong; the real pencil is
  parked (manual testing 19)
- [ ] Open the app at a verse and at a page; turn, zoom, open a note. · `make app-run-mac`,
  `make app-run-ipad` · Same as the browser. · see the native-shell skill
- [ ] With a note up, make the Mac window too small for the open book (1000 wide, or 700 high),
  then back to 1280 by 828: the note stays open and its verse stays in sight and clear of it at
  every size. · desktop at the Mac app's sizes, private build · checked 2026-10-11 in Chromium and
  WebKit, clean; dragging the real window is parked (manual testing 14)
- [ ] Walk the pitch **in the iPad app**, not only in the browser: the iPad's own WebKit lays out
  differently from Playwright's. Rebuild the bundle (`make app-web FLAVOUR=pitch`), launch at a
  verse, turn the simulator, screenshot, and measure from inside the page with
  `make app-probe TARGET=ipad EVAL=…`. For many links at once, `make app-walk ROUTES='…'`
  (add `SIDEWAYS=1` to turn it) keeps one picture per link. · the native-shell skill, "Walking
  the app in the simulator"
- [ ] Save a file out of each app (the bookmarks from the shelf, a passage picture's Save), and
  load one back: anything the page saves is a download, and an app that sends it to the browser
  drops it without a word. Both apps: the system's save window opens with the page's name for the file; no privacy prompt.
  · iPad simulator: `make app-probe TARGET=ipad EVALFILE=…` clicking a made-up download, then
  `xcrun simctl io <iPad> screenshot` while it waits · test: `native/HifthTests/DownloadTests.swift`
  · issue: `apps-save-and-open-files`; the Mac's choose-a-file window is parked (manual testing 15)
- [ ] Walk the iPad app in English as well as Arabic (`LOCALE=en`): the buttons read English even
  though the simulator has Arabic picked in the app, and Arabic is still picked afterwards. ·
  iPad simulator · test: `native/HifthTests/RouteTests.swift` ("a language named for this
  launch, and only one the app has")
- [ ] Hold the iPad app sideways: two pages fill the height between the bars, not a sliver in the
  middle of the desk. · iPad simulator, landscape · issue: `ipad-app-sideways-spread-tiny` · test:
  `make app-test ONLY=SmokeTests/testLandscapeOpensTheBookFullSize`
- [ ] Set the iPad itself to dark mode and open the app at a verse with its note: the app keeps
  its paper look, and the clock and battery above it stay dark and readable on the cream bar.
  The app's own picture leaves the clock out, so grab the whole screen. · `xcrun simctl ui
  <iPad> appearance dark`, launch, `xcrun simctl io <iPad> screenshot …`, then set it back to
  light · walked 2026-10-10 and 2026-10-13 (the 13-inch iPad on its side), nothing wrong
- [ ] Press Listen **in the iPad app**: the recitation plays inside the app, and the button
  turns to Pause. On the pitch build a tapped verse opens its note first; close the note to reach
  Listen. · `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p7 EVALFILE=.claude/skills/walk-app/scripts/playto-walk.js`
  with `window.__mode = "listen";` on a line ahead of it · walked 2026-10-10, and 2026-10-13 on both
  iPad sizes on their side, in both languages: nothing wrong
- [ ] Start a "Play to" run **in the Mac app**: each next verse starts on its own when the last
  one ends, with no click per verse. The Mac's web view lets sound start without a click even
  though only the iPad sets that up by name. · `make app-probe TARGET=mac LOCALE=en
  ROUTE=/hafs-kfqc/p7 EVALFILE=.claude/skills/walk-app/scripts/playto-walk.js`, which plays the sound quietly, never silent (the web
  view lets a silent one start anyway, so a silent check proves nothing) · walked 2026-10-10, and
  2026-10-13 with both marks, in both languages: nothing wrong
- [ ] Follow a thread **in the iPad app on its side**, as a scholar would: from a demo note, a
  reference whose own note names verses, then a second reference from there, then Back twice.
  Each step lights the verse it reached, with none of it under the note; the note stays where it
  stood; Back returns the way it came, and at the start there is no Back. · `make app-probe
  TARGET=ipad SIDEWAYS=1 LOCALE=en "ROUTE=/hafs-kfqc/2:48?open=commentary"
  EVALFILE=.claude/skills/walk-app/scripts/thread-walk.js …` · walked 2026-10-15 from 2:48 in
  both languages and on the iPad mini on its side, and from 2:255: nothing wrong; again
  2026-10-23 from 2:48 on both sizes, both languages, after the grab-through turn: nothing wrong
- [ ] Follow a reference in a note, turn the iPad, then press Back **in the iPad app**: on its
  side, follow the note's first reference; turn the iPad upright, as when handing it across; press
  Back; turn it on its side again. Each step lights the verse it is on, with none of it under the
  note or off the screen; Back comes home with the note still up; the dark surround, when chosen,
  stays through all of it. · `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en
  "ROUTE=/hafs-kfqc/2:48?open=commentary" EVALFILE=.claude/skills/walk-app/scripts/ref-turn-walk.js
  DELAY_MS=2500 TURNS=14,30 PROBE_TIMEOUT_S=200` · walked 2026-10-15 on the 13-inch in English,
  the iPad mini in Arabic, and the 13-inch with `field=dark`: nothing wrong
- [ ] Make one whole visit **in the iPad app on its side**, in English and in Arabic, as a reader
  in the room would: open a note, read it to its end, follow a reference in it and come back,
  play the surah from its corner with the note still open, then pause. Nothing lit sits under the
  note, the way back returns to the first verse, the run starts with the note shut, and Pause
  stops it. · `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en EVALFILE=.claude/skills/walk-app/scripts/visit-walk.js …`
  · walked 2026-10-11, nothing wrong but the loading label (`loading-says-play`). Walk it on the
  **iPad mini on its side** too (`"IPAD=iPad mini (A17 Pro)" SIDEWAYS=1`), in both languages: there
  the note read to its end grew over its verse (plan item 89). Walked 2026-10-12 on the mini,
  nothing wrong now but the share card's own leftover (look-alike rows ⑯, settled 2026-10-13 by
  plan item 92). Walked 2026-10-16 on a phone, upright and on its side, in English and Arabic
  (`make drive DEVICE=phone|phone-side LOCALE=ar … evalfile=…/visit-walk.js`): nothing wrong. On a
  phone the note is a sheet, and read to its end it grows over its verse by design
- [ ] On an **iPad mini on its side**, open each corner card in turn on 2:48 — the note, read to its
  end, the roots list, read to its end, each look-alike list, and the share card — in English and in
  Arabic. No card covers its verse, and the look-alike buttons never sit on the page or on a
  list's close button, and never stick out past the card. · `make drive … DEVICE=ipad-side
  VIEWPORT=1133x744 "ACT=settle=2500;evalfile=.claude/skills/walk-app/scripts/corner-cards.js"`, or
  the same script through `make app-probe` on the mini · walked 2026-10-12: the roots list covered
  its verse, the buttons sat on the lists' close buttons, and in the app a look-alike list
  covered part of its verse too (plan item 90, look-alike rows ⑱); now 2% in the app and the browser.
  Walked again 2026-10-12 on the 13-inch iPad, in the app and the browser, upright and on its side,
  in both languages: every card 0%. Walked 2026-10-13 on the mini in the app and the browser, the
  share card added to the script: every card 0%, no line off the screen (look-alike rows ⑯).
  Measure only once the page has stopped: on its way aside the verse passes through clear places,
  and a check taken then passes when the end state is wrong. The browser tests' shared measure
  waits for the page to stop, for every corner card.
  Run it in the app as well as the browser: the app's own bars leave the page about 40 pixels less
  room than the browser's, so a card that clears its verse in the browser can still cover it in the
  app. Walked 2026-10-16 on a phone, upright and on its side, in Arabic: no card covers its verse
  and nothing runs off the screen.
- [ ] **Take the iPad app off the simulator and open it fresh**, as on a borrowed iPad in the
  room: it opens on the first two pages (the iPad mini on its side: the first page alone) with
  nothing over them and nothing stored, the first
  note opens beside its verse, a reference goes and comes back, and the first Play sounds in
  about a second from the copy asked for early. · `xcrun simctl uninstall`, then
  `scripts/fresh-look.js`, `visit-walk.js` and `gap-walk.js` (`__gapCount = 0`) on the same fresh
  install · walked 2026-10-11, nothing wrong; 2026-10-13 on both iPad sizes on their side: one
  fault, the next line (native-shell ㉝); the real iPad's first sound is parked (manual testing 12)
- [ ] With a note kept up while a surah played from its corner has taken the page to the surah's
  start, **close the note**: the recitation plays on, and the app names the page shown, not the
  note's verse (the visit walk's `F closed:` line has `hash=` on the page). · the visit walk, step
  F, in the iPad app on its side · test: the pitch test "closed once the page has moved on" ·
  native-shell ㉞, fixed 2026-10-13
- [ ] Start a "Play to" run **in the iPad app**, with the moving light and again with the ring
  picked: the mark moves with each verse recited, and the light comes back to the first at the
  end. · `make app-probe TARGET=ipad SIDEWAYS=1 LOCALE=en ROUTE=/hafs-kfqc/p7 EVALFILE=.claude/skills/walk-app/scripts/playto-walk.js`;
  for the ring, save the run-mark setting as "ring" in a launch of its own first (the app reads it
  as it starts) and take it off after · walked 2026-10-10 (both marks), and 2026-10-13 on both iPad
  sizes, both marks, both languages: nothing wrong. The press has to land on the verse's own
  words: the middle of a verse's box can be its neighbour's, and the first try of the walk started
  a verse early for that reason alone
- [ ] Walk the Mac app in Arabic too, not only the iPad: the look-alike list and a note open,
  mirrored, nothing cut off. · `make app-shot TARGET=mac LOCALE=ar ROUTE=…` (shows that language
  for the one launch, even where another is picked with the app's own button) · tests:
  `scripts/native-make-locale.test.mjs`, `native/HifthTests/RouteTests.swift` · walked
  2026-10-11 at 2:48 (the list, then the note), nothing wrong
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
  · iPad simulator · issue: `ipad-pinch-selects-verse` · tests:
  `make app-test ONLY=SmokeTests/testPinchSelectsNothing`, and with the note tool
  `make app-test ONLY=SmokeTests/testPinchWithTheNoteToolPinsNothing`. Start that one with the
  app removed from the simulator, or a note an earlier run left shows in its picture.
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
  /hafs-kfqc/15:30?open=commentary'` · test: `src/glyphs-as-text.test.ts`, `e2e/hop.spec.ts` ·
  walked 2026-10-11 in Arabic, the iPad app on its side and the Mac app, nothing wrong
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
- [ ] On an iPad held upright, open a verse low on its page and turn forward: the next page
  starts at its top, just under the bars; turn back and the page before shows its foot, where
  you left it. Pinch in first and the turn keeps the same lines in view instead. With the info
  panel set to "Keep the same height" the page lands where the last one was, and set to "The
  whole page" a verse's page opens whole. · `make drive DEVICE=ipad HASH='#/hafs-kfqc/2:46'
  ACT='press=ArrowLeft'` · issues: `upright-turn-lands-at-top-build`,
  `upright-opening-size-setting` · test: `e2e/ipad.spec.ts` ("opened bigger than the screen")
  2026-10-15 in the iPad app upright (turn-top-walk.js): the 13-inch in English and Arabic and
  the mini in English land at the next page's top and come back to the foot.
- [ ] Open a verse on an upright iPad, turn it on its side (two whole pages), then upright again:
  the page comes back at the size it opened at, not whole. On an 11-inch iPad that holds even
  after zooming on its side, since the page is put whole as it turns back. With the info panel's "Turning the iPad
  back upright" set to "The whole page" it stays whole. · `make app-walk SIDEWAYS=1` for the
  side; the browser test turns it both ways · issue: `upright-again-brings-back-opening-size` ·
  test: `e2e/ipad.spec.ts` ("on its side and back upright")
  2026-10-15 in the iPad app turned by its UI test (hand-turn-walk.js with `__hop`): the 13-inch
  in English and the mini in Arabic come back upright at the size they opened at.
- [ ] On an iPad on its side, press + to 200% and 300% on the open book: the right-hand page's
  lines still begin on the screen (the book slides over, the left-hand page runs off the left),
  and the next opening does the same; back at 100% the book is where it was. With one page
  shown, + to 400% keeps its right edge on the screen. With the info panel's "Zooming in on the
  page" set to "Grow from the fold", the right-hand page runs off the right as before.
  · `make drive DEVICE=ipad-side` · issue: `zoom-keeps-line-starts-in-sight` · test:
  `e2e/ipad.spec.ts` ("keeps the starts of the lines in sight")
  2026-10-15 in the iPad app on its side (zoom-starts-walk.js): the 13-inch in English and
  Arabic clean at 200%, 300%, the next opening, back at 100%, and one page at 400%.
- [ ] In a note, every verse number the prose names is a link: a reference left as plain words, or a
  number with a letter in it, is a word the capture misread; read it off the page picture and add it
  to the hand-read misreads. · `make drive DEVICE=laptop HASH='#/hafs-kfqc/28:88'` · test:
  `e2e/pitch.spec.ts` ("a verse number the capture misread is put back")
- [ ] A note's quote marks are curly and a range of numbers has a dash, as the book prints them: a
  straight quote, or a hyphen between two numbers, is the capture's, and the typography rule should
  have set it. A straight quote between two letters is a misread letter for the hand-read
  misreads. · `make drive DEVICE=laptop HASH='#/hafs-kfqc/28:88'` · test: `e2e/pitch.spec.ts`
  ("prints the book's curly quotes")
- [ ] A note has no space before a comma, semicolon or its last full stop, and none doubled: one is
  the capture's, and the typography rule should have closed it up. A space between an ellipsis and
  the mark after it is the book's own. · `make drive DEVICE=laptop HASH='#/hafs-kfqc/5:75'` · issue:
  `note-stray-spaces` · test: `e2e/pitch.spec.ts` ("closes up a space the capture left")
- [ ] A reference in a note links only when it is the Qur'an's: a Bible book's chapter and verse
  (and the list it goes on to name), or a volume and page after a work's year, stays words. A
  reference that opens a verse unrelated to what the note is saying is another book's, read as a
  surah and verse. The note's related verses offer none of those either. ·
  `make drive DEVICE=laptop HASH='#/hafs-kfqc/2:60?open=commentary'` · issue:
  `note-bible-refs-linked` · tests: `e2e/pitch.spec.ts` ("a Bible reference in a note is not a
  link", "related verses do not send the reader to a verse the note names only as the Bible's")
- [ ] A reference in a note reads as the book prints it, with a colon between surah and verse and a
  space after a semicolon, and opens its verse: two numbers with a semicolon between them, or a
  reference run into the next, is the capture's misreading. ·
  `make drive DEVICE=laptop HASH='#/hafs-kfqc/17:36'` · issue: `note-semicolon-refs` · test:
  `e2e/pitch.spec.ts` ("a reference the capture wrote with a semicolon for its colon, or a space
  after it")
- [ ] A reference in a note opens the verse it names, and every reference the book's own page shows
  in blue is a button: a "v." before a full reference is that reference, not a verse of this
  surah. · `make drive DEVICE=laptop HASH='#/hafs-kfqc/4:94'`, then the iPad app with
  `scripts/ref-walk.js` (walked 2026-10-15 on its side in English and upright in Arabic: 4:86 opened
  and Back came home; 2:37 and 2:54 link no Bible reference) · issue: `note-v-before-full-ref` ·
  test: `e2e/pitch.spec.ts` ("a reference written after v. opens the verse it names")
- [ ] A note shared by a run of verses shows whole under every one of them, and a verse's own note
  shows under that verse alone: a paragraph that opens on a verse number mid-note, or a note that
  stops short under one verse of the run, is the capture filing it in the wrong place; read it off
  the page picture and list it in the misfiled paragraphs. · `make drive DEVICE=ipad HASH='#/hafs-kfqc/6:74?open=commentary'`
  · test: `e2e/pitch.spec.ts` ("a verse's own note the capture ran on")
- [ ] A paragraph moved or shared into a note carries the slant the print gives it: its slant is
  read on the page it was printed on, which may be a later page than the one the note starts on.
  Open the note under each verse that holds it and compare its slanted words with the page
  picture. · `make drive DEVICE=ipad HASH='#/hafs-kfqc/9:37?open=commentary'`
  · test: `e2e/pitch.spec.ts` ("the demo's notes set the book's italics")
- [ ] No paragraph in a note stops mid-sentence: the list of cut sentences is empty, and where a
  put-back break is listed for a note, the paragraph before it ends on a stop. A break placed one
  word early leaves a paragraph ending on a small word and the next opening on one word and a stop;
  one placed a word late leaves the next opening on that word, or on a closing quote, and a stop.
  The listing shows both.
  · `node packages/etl/tools/pitch/extract.mjs --splits`
  · test: `e2e/pitch.spec.ts` ("breaks where its page does, not one word early")
