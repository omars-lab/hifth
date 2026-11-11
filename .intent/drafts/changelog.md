# What changed since 2026-11-01

*This is a draft, written by `intent changelog` on 2026-11-11 from 144 commits merged since 2026-11-01. Running the command again writes over it.*

**42 lines below rest on a guess:** a link worked out afterwards that nobody has checked. Check each against its commits before it goes into anything a reader sees.

## What a reader would notice

### turn-the-page

Move to the next page the way a mushaf moves — right to left — and be told honestly when there is no next page.

Other changes:
- Folded corner lies below the paper's frame, which runs whole across the top (ec9e55a96) *(a guess: check it against its commits)*

### read-a-spread-on-a-big-screen

When I open this on a laptop, show me the mus'haf the way it is bound — two pages facing each other, the earlier one on my right — instead of one page floating…

Other changes:
- Dragging one page of a magnified open book moves the other page with it (e8e079a3a) *(a guess: check it against its commits)*

### have-it-my-way-and-keep-it

Where the app could work two ways, let me pick the one I like, and remember it next time.

Worked on, not finished:
- **app-pages-settings-and-developer**: Owner's page comment of 2026-11-07: settings should be a page of their own, reached from page icons along the bottom like a Mac app, with the mushaf as the…

### see-what-i-have-not-opened-lately

Keep a private record of what I have actually opened, see it — which pages, hizb or juz have gone weeks without me — and press the one that has waited longest…

Worked on, not finished:
- **calendar-of-each-days-work**: Owner, 2026-11-10: a calendar with numbers for each day (mistakes added, pages they fall on, pages and verses opened).

### pick-a-pen-without-leaving-the-verse

When I squeeze my pencil, give me the pens right where I am writing, so I can mark a mistake without looking away from the verse.

Finished:
- **pencil-pens-settings-page**: Owner, 2026-11-10: a page among the settings that draws the working pens a reader would see at the pencil's tip and explains each button, so a reader with no…

Worked on, not finished:
- **pencil-pens-as-rings**: Owner, 2026-11-10: the pens at the Apple Pencil's tip laid out as rings around it, with an outer ring for a tool's own choices (the highlighter's four pens…

## Behind the scenes

### see-what-each-change-was-for

For any commit, see which task it did, which use case and feature that task serves and which plan it came from, without reading a chat log.

Worked on, not finished:
- **label-commits-with-what-they-are-for**: Owner, 2026-11-10: link a use case to its feature, its tasks, the commits that did them and the plan they came from, checked in, with the labels added by a…

### see-how-the-running-app-was-set-up

See in one place how the app in front of me was started, what this browser remembers for it and what screen it thinks it is on, and reach the developer-only…

Finished:
- **app-pages-developer-page**: Owner's page comment of 2026-11-07: a developer page that shows only when the app runs on this laptop (localhost).

## Tied only to a part of the product

### settings

The reader's own choices: the reading settings in the top bar (or behind one button, in a drawer), and every "which way do you want this" choice in the info…

Worked on, not finished:
- **drawers-for-every-tool**: Owner's page comments of 2026-11-07: settings, verse and word drawers stacked one above the next, look-alike verses as sections with empty placeholders, verse…

Other changes:
- Show each page tool's help in a label when the pointer rests on it (8198b7cf9) *(a guess: check it against its commits)*

### native-shell

The Mac and iPad app: a thin native window around the web build, served from inside the app bundle at a private address, opened at a route from a hifth:// link…

Worked on, not finished:
- **testflight-sign-with-paid-team**: 2026-11-10: the iPad is done. *(a guess: check it against its commits)*
- **device-list-from-apple**: 2026-11-10: `make app-devices` counts the devices on this laptop's signing profiles, so the slots-left number is only the most that could be left. *(a guess: check it against its commits)*

Other changes:
- Add a command that copies the app's crash reports off the iPad and says what stopped it (bc762b038) *(a guess: check it against its commits)*
- Say the 18.5 simulator runs the app now, and how to keep it that way (2c26673d0) *(a guess: check it against its commits)*
- Let the app start on iPadOS 18 simulators, so the verse-touch test runs on the owner's OS (82371403b) *(a guess: check it against its commits)*
- Record that building the web view later fixed the iPad crash, and that the 18.5 simulator cannot start the app yet (22995f5b1) *(a guess: check it against its commits)*
- Build the web view when the screen asks for it, so touching a verse no longer closes the iPad app (17cdcf705) *(a guess: check it against its commits)*
- Check the two crash research passes and teach the skills to read a crash (627a5514d) *(a guess: check it against its commits)*
- Research B: why the iPad app closes when a verse is touched, and how to catch the next crash (7db5a4f23) *(a guess: check it against its commits)*
- Research A: why the iPad app closes on a verse tap, and how to catch it next time (4ce8f1718) *(a guess: check it against its commits)*
- TestFlight plan, worked backwards from a tester's iPad; nine steps on the backlog (e74438d60) *(a guess: check it against its commits)*

### wayfinding

Getting to a known place: the surah/ayah jumper, the page bar along the bottom, the keyboard map, and the coach marks that teach the gestures once.

Other changes:
- Bookmark ribbon: a narrow silk marker, hung where the page's heading is empty (eff3b5d49) *(a guess: check it against its commits)*
- Folded corner: the corner on the page's own corner is rounded too (ed9cfe577) *(a guess: check it against its commits)*
- Folded corner: the flap's tip is rounded like the page's corners (63444346c) *(a guess: check it against its commits)*
- The folded corner keeps a light shade, so it still reads as a fold (4ff48525d) *(a guess: check it against its commits)*
- The page under a folded corner is the page's own paper (965c85e5c) *(a guess: check it against its commits)*

### desktop-spread

On a wide screen the app shows an open mus'haf — two leaves and a spine — and says plainly which half it does not have.

Finished:
- **plain-wheel-does-nothing**: Closed as three pieces: a plain wheel turns pages (§3.2 ④), ctrl+wheel is calibrated to a multiplicative curve, and desktop.md §6 finally documents the wheel. *(a guess: check it against its commits)*

Other changes:
- QUL link: shown only in dev mode, never in a real build (a10b5a80b) *(a guess: check it against its commits)*
- The page-turn strip runs the page's height, with its rounded corners (fb8d5cd0d) *(a guess: check it against its commits)*
- On a magnified book, a page turns without the normal-size corner peel (5447223a8) *(a guess: check it against its commits)*

### pens-and-pencil

The page's pens (highlighter, mistake pen, note, eraser), where they sit on each kind of screen, and how an Apple Pencil's squeeze or double-tap opens them at…

Other changes:
- Tools: narrower with a mouse, so the pens fit beside eleven of them (f07beadc7) *(a guess: check it against its commits)*
- Eraser: one of the tools on a computer, with Undo kept as a setting (b20860a33) *(a guess: check it against its commits)*
- The full-screen icon fits every desktop tool bar layout (c53d1b83a) *(a guess: check it against its commits)*
- On a desktop, full screen is an icon in the tool bar (19a1d408d) *(a guess: check it against its commits)*
- Draw the Note tool as a sticky note, not a map pin (31c542cdb) *(a guess: check it against its commits)*
- Keep letters typed in a shadow-root box out of the tool keys (a7773d689) *(a guess: check it against its commits)*

### performance

How fast the app opens on a slow phone, the code-size cap that stands in for it, and the charts that say whether the cap can move.

Finished:
- **startup-slowed-in-a-month**: Start-up on a modelled slow phone went from about 2140 ms (2026-10-11) to about 2290 ms.

Other changes:
- Record the app's size after the page-edge strip fix (172b0de0c) *(a guess: check it against its commits)*

### golden-images

The visual gate: highlight geometry the DOM cannot describe, pinned as images.

Worked on, not finished:
- **word-drawer-stacks-on-verse**: Owner's page comment of 2026-11-07 asked whether a tap on a word opens a word drawer stacked on the verse drawer. *(a guess: check it against its commits)*

### encoding-inspector

Four descriptions of one text — the print, the ligature corpus, the QAC word index and the tajweed codepoint offsets — on one screen, with every place they…

Worked on, not finished:
- **testflight-upload-key**: Make the App Store Connect API key under Users and Access, Integrations; the key file goes in ~/.appstoreconnect/private_keys/ (where the upload tools look)… *(a guess: check it against its commits)*

## Tied to nothing

Tasks that name no use case and no part of the product.

Finished:
- **edge-grab-firefox-test-fails-on-its-own**: Answered 2026-11-11: it was a fault in the app.
- **skills-miss-three-known-wrong-turns**: Answered 2026-11-11: each of the three now has a line in the skill a session would be reading at the time: the preview serving the old build until its saved…
- **browser-test-skipped-unnoticed**: Answered 2026-11-11: a checked-in record says which runs pick up each browser test file, and a check before every commit asks the test runner and refuses a new…
- **push-says-when-port-is-held**: Answered 2026-11-11: the first push check now looks at the two ports the browser tests serve the app on, and when one is held it stops in a second, naming the…
- **remeasure-loading-speed**: The app was 0.7 KB under its 200 KB size limit and the pencil rings, the pens page and the calendar all add code.
- **pitch-walk-18-60-link-count**: Six, counted against the book's note on 2026-11-09, and the app shows all six.
- **app-walk-whole-demo-path**: The iPad app's copy of the pitch build was rebuilt with the note's look-alike rows, and no real-app walk has yet opened a surah's introduction or followed the… *(a guess: check it against its commits)*
- **testflight-licence-brief**: Written 2026-11-08: docs/design/testflight-licence-brief.md. *(a guess: check it against its commits)*
- **testflight-register-app**: Done 2026-11-09.
- **iphone-record-covers-iphone**: Done 2026-11-09: the record covers iOS (iPhone and iPad) and macOS.
- **sharing-store**: Choose where shared copies live: Cloudflare's free database (suggested; no pausing stated, keeps shares apart from the held copy) or a new Supabase project at… *(a guess: check it against its commits)*
- **publisher-account-is-company**: Not yet (owner, 2026-11-08), so Hifth is published under 'Omar Eid' (option A).
- **testflight-membership-active**: Active since 2026-11-08 (one year); team ID 76NHKA839A, an individual account in the owner's name. Publishing under Bytes of Purpose is its own question.
- **publisher-account-name-matters**: Nothing to wait for without a registered company; testers see 'Hifth, by Omar Eid'.
- **verse-tools-spoken-names**: Found walking the demo at a desk (2026-10-15): the verse's tools show a word under each sign, and Listen, the roots button and (in Arabic) the note button were… *(a guess: check it against its commits)*
- **note-harakat-word-one-pen**: Owner chose 2026-10-12 to build the one button as a setting and keep three buttons as the default.
- **kept-note-hops-sides**: Owner, 2026-11-08: the card changing sides reads as getting out of the way. Kept as built.
- **is-the-privacy-rule-nothing-leaves-or-nothing-that-doesnt-serve**: The app's privacy stance is written in two places as an absolute — the revision-record 'Export or sync' out-of-scope line and the gate:revision-privacy…
- **note-fixes-have-no-second-copy**: Owner chose a private iCloud folder (2026-11-08). `make backup-note-fixes` copies the file there, dated; first copy made and checked byte for byte the same day.

Worked on, not finished:
- **comment-bar-covers-bottom-row-on-phone-width**: On the dev server at phone width the comment tool's bar lies over the bottom of the app, so a bottom row of icons cannot be pressed until the bar is hidden.
- **pitch-first-passage-ready**: The next most important thing for the pitch (2026-11-09): none of the six chosen passages is demo-ready yet.
- **drawer-holds-its-tools**: Owner's page comment of 2026-11-07 asked for Share, Same roots and the commentary to open as sections inside the verse drawer instead of their own sheets.
- **homepod-siri-request**: Ask Apple, signed in, to let a HomePod pass Siri play requests to Hifth: https://developer.apple.com/contact/request/sirikit-media-intent-for-homepod/ .
- **recitation-airplay**: An AirPlay button so recitation plays on a HomePod or other speaker. Needs nothing from Apple. *(a guess: check it against its commits)*
- **testflight-archive-builds**: Archive and export settings, privacy manifest, encryption answer, a build number that counts up, and the sandbox Apple requires of a Mac build sent through…
- **recitation-plays-on-silent**: On an iPhone with the ring switch on silent, the verse recitation may not be heard. Tell iOS the app is for listening, as a music app does.
- **recitation-plays-in-background**: Recitation stops when the screen locks or the reader switches apps.
- **recitation-lock-screen-controls**: Show the verse and reciter on the lock screen and answer its play, pause and next buttons, and AirPods presses.
- **iphone-walk-pitch**: Walk the pitch build in the iPhone simulator app, upright and on its side, as a reader would; every fault found gets a test and a walk-checklist line. *(a guess: check it against its commits)*
- **iphone-own-device-install**: Install on the owner's own iPhone with the paid team, the same way as the iPad. *(a guess: check it against its commits)*
- **kanban-board-for-users**: Give the people who use Hifth (the Study Quran team, testers, later huffaz) a kanban board to manage it and review it, beside the project's own GitHub board. *(a guess: check it against its commits)*
- **sharing-cloudflare-setup**: Set up hifth.bytesofpurpose.com/share on Cloudflare with its free database behind it: the address entry, a small server at /share, a placeholder page with no…
- **sharing-which-way**: Pick how mistakes first reach a teacher; recommended: the teacher's view fed by the saved file first, then the live locked link with no accounts, accounts only… *(a guess: check it against its commits)*
- **icloud-sync-road**: Should every record take the same road the usage counts take: Apple's ready-made sync loop, one copy per device per kind, carrying the same text the saved file… *(a guess: check it against its commits)*
- **paid-features-which**: Owner, 2026-11-08: paid features behind an in-app purchase, a lot of the sharing first; the Qur'an itself (reading, pages, search, recitation) is never gated.
- **paid-features-sell-a-text**: Owner, 2026-11-08: maybe an in-app purchase for a specific text, such as a commentary.
- **paid-features-app-store**: In-app purchases need an App Store release, which the licence question holds (app-store-not-a-target).
- **full-screen-keeps-tools**: Owner's page comment of 2026-11-07: 'Where is the side tool bar?' Full screen hides every bar, the tools too, so marking means leaving it.
- **verse-glows-on-drawer-hover**: Owner's page comment of 2026-11-07 asked for the lit verse to glow while the pointer rests on its drawer.
- **bookmark-pull-by-hand**: Owner's page comment of 2026-11-07: asked how to pull a bookmark down or push it up, in full screen or not.
- **bookmark-vs-left-off-ribbon**: Owner's page comment of 2026-11-07: the navy bookmark tabs and the red 'where you left off' ribbon look alike, so it is not clear which is which.
- **full-screen-side-tool-bar**: Owner's page comment of 2026-11-07: in full screen, keep the tool bar down the left or right edge, with a switch to hide and show it like the Mac Dock.

25 commits belong to no task.
