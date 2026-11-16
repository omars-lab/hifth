# What do other open apps do with their screens, and what should we borrow?

Written 2026-11-16 by the checker, the third reader in a two-researchers-then-checker pass.
Researcher A read 11 code repositories and researcher B read 15, without seeing each other's work.
I read both, opened the cited files again at the exact version each researcher read, and wrote this page.
Nobody ran any of these apps. Everything here comes from reading code and the documents inside each repository.

## What is the short version?

1. Reading apps hide their bars and bring them back with one tap on the page, or with the mouse at the edge on a computer. Both researchers found this in Readest and Quran for iOS, and I re-opened both (findings 1, 2).
2. After a jump, the best apps give a way back and do not lose the reader's place. Readest, Zotero and pdf.js each do it, both researchers found all three, and I re-opened all three (findings 3, 4, 6). The fullest version, a "return to page N" strip, was found only by B (finding 7).
3. A right-to-left book gets a slider that runs right to left. Aidoku and Readest both do this, both researchers found it, and I re-opened it (findings 69, 70).
4. Every place gets two link forms, a private one and an ordinary web address, read by one piece of code. Both found it in Readest and I re-opened it (finding 48).
5. Apps choose between a narrow and a wide arrangement by the size of the window, not by the kind of device. Both found it in Readest and Excalidraw and I re-opened both (findings 19, 21). They differ on one detail in Readest, and the code shows the switch is by width.
6. Pens get their own zone, apart from page controls, and on a tablet the reader can move it. Both found it in Zotero and I re-opened it (findings 31, 33).
7. Everyday view choices sit in a small menu on the reading screen and the long list lives elsewhere, under about ten names by the researchers' counts. Both found it in Quran for iOS and Readest, and I re-opened both (findings 38, 39).
8. Almost nobody runs a forced tour on a reading screen. Three guides or tours exist (findings 62, 63, 64). Each was found by one researcher only, and each held when I re-opened it.
9. One finding cuts against our layout plan: the plan sets aside hiding the bars outside full screen, and hiding the bars is the thing both researchers ranked first.

## Which apps were read closely?

"Ideas only, copy no code" marks a copyleft licence (GPL or AGPL).
Platforms are taken from each project's README. No store listing was opened by anyone.
The link in each row goes to the exact version that was read.

| App | Repository at the version read | Licence | Platforms | How it is built | Read by | Useful for |
| --- | --- | --- | --- | --- | --- | --- |
| Readest | [readest/readest](https://github.com/readest/readest/tree/ca575bb68010fe52e599860c92df40ca59047068) | AGPL-3.0. Ideas only, copy no code | Mac, iPhone, iPad, web, and others | One web codebase in a wrapper | Both | The closest match in how it is built: bars, slider, links, settings |
| Zotero reader | [zotero/reader](https://github.com/zotero/reader/tree/5581a8daa72013ae7424d41688dfbab5100b47ec) | AGPL. Ideas only, copy no code | Web, and inside the Zotero desktop app | Web only (a part other apps embed) | Both | Pens and page controls in one bar, and the way back after a jump |
| Zotero for iPhone and iPad | [zotero/zotero-ios](https://github.com/zotero/zotero-ios/tree/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687) | AGPL. Ideas only, copy no code | iPhone, iPad | Separate native app | Both | A pen bar the reader can move, and links with page numbers |
| Quran for iOS | [quran/quran-ios](https://github.com/quran/quran-ios/tree/956e30a27cfdd44ae1d4d175ef801432d90b0100) | Apache-2.0 | iPhone, iPad | Separate native app | Both | The closest subject match: bars, two pages, links, "what's new" |
| Excalidraw | [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw/tree/82190fb28f58070b34b4017e70c0e2e83701a8e3) | MIT | Web | Web only | Both | Named window sizes, tool placement, help line, short messages |
| Aidoku | [Aidoku/Aidoku](https://github.com/Aidoku/Aidoku/tree/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd) | GPL-3.0. Ideas only, copy no code | iPhone, iPad (README also names Mac, unchecked) | Separate native app | Both | A right-to-left page slider, and one or two pages by shape |
| pdf.js viewer | [mozilla/pdf.js](https://github.com/mozilla/pdf.js/tree/bb1539a2c9b5b76d070284cca9091717133d8bf1) | Apache-2.0 | Web | Web only | Both | A bar that drops buttons as the window narrows, and Back after a jump |
| Home Assistant for Apple devices | [home-assistant/iOS](https://github.com/home-assistant/iOS/tree/ac2896d2f14a0e80d18e612eef7633d06b5be501) | Apache-2.0 | iPhone, iPad, Mac | Said to be a web page in a native shell (see finding 82) | Both | Links that ask before they act, and a long settings list |
| Kiwix for Apple devices | [kiwix/kiwix-apple](https://github.com/kiwix/kiwix-apple/tree/8e13ae648ae92e3da019521554a67cb27b01a5c1) | GPL-3.0. Ideas only, copy no code | iPhone, iPad, Mac | Separate native app | Both | One app arranged three ways, and settings that open at one item |
| NetNewsWire | [Ranchero-Software/NetNewsWire](https://github.com/Ranchero-Software/NetNewsWire/tree/a5cec78e2aaca287144bcd45fa6ff2f1141518e7) | MIT | Mac, iPhone, iPad | Separate native apps | Both | Keeping settings short, and rare settings with no screen |
| Sefaria | [Sefaria/Sefaria-Project](https://github.com/Sefaria/Sefaria-Project/tree/ce9b1c84dc858b667b92655ea82ebf8f7e7810f7) | GPL-3.0. Ideas only, copy no code | Web | Web only | A | A guide made of numbered cards, kept off the reading screen |
| Quran.com on the web | [quran/quran.com-frontend-next](https://github.com/quran/quran.com-frontend-next/tree/aff1a035b09b66f28047b3216edcae4c5c949a49) | Unclear. Treat as ideas only until checked (see finding 83) | Web | Web only | B (A's download hung) | A tour with a checklist, and a written note on its top bar |
| Open-Mushaf Native | [adelpro/open-mushaf-native](https://github.com/adelpro/open-mushaf-native/tree/3bcc94a86bfe26874e9aa929acac1d4a23716ec6) | MIT | iPhone, Android, web, Mac (small project, 45 stars) | One codebase for all platforms (React Native) | B | The "return to your reading position" strip |
| Kavita | [Kareadita/Kavita](https://github.com/Kareadita/Kavita/tree/e844b64f2d64867afd089adf8af4376bdc85eecc) | GPL-3.0. Ideas only, copy no code | Web | Web only | B | Bars on a timer, view settings under the slider, one-time messages |
| Komga | [gotson/komga](https://github.com/gotson/komga/tree/db2ad643c64d9199f7dd01cd3cca3ff0e7a17445) | MIT | Web | Web only | B (lightly) | A bottom slider with page numbers at both ends |
| Bluesky | [bluesky-social/social-app](https://github.com/bluesky-social/social-app/tree/7f064abe2514bced0a5de5f605b2ee23341899b4) | MIT | iPhone, Android, web | One codebase for all platforms (React Native) | B | A short settings list of plain names |
| Wikipedia for iPhone and iPad | [wikimedia/wikipedia-ios](https://github.com/wikimedia/wikipedia-ios/tree/0cc1624ab47c5e40b9e3968dc2362b45877cd81d) | MIT | iPhone, iPad | Separate native app | B | One tip at a time, and a public table of every link |

That is 17 repositories. A read 11 of them and B read 15. Nine were read by both, at the same version.
Zotero is counted as two rows because it is two repositories.

## How do I read a finding?

Each finding says what the app does, links to the code, and carries one status.

- **Both found it.** A and B each reported it. I say whether I re-opened the code and whether it holds.
- **Both found it but they disagree.** I say which side the code supports.
- **Only A found it** or **Only B found it.** One researcher reported it. It is flagged, not dropped. Where I re-opened it I say so, but one reader plus the checker is still weaker than two independent readers.
- **Rests on something nobody opened.** The claim comes from a file name, a README line or a search result, not from reading the code.

There are 84 numbered findings. 29 are "Both found it", 6 are "Both found it but they disagree", 13 are "Only A found it", 25 are "Only B found it" and 9 are "Rests on something nobody opened". Finding 58 is split between A and B, and finding 80 only gathers other findings. Finding 73 also has a second part found by B only. Of the 29 that both found, I re-opened 25 and they hold, and did not re-open four (findings 36, 37, 57 and 72).

## How do these apps let you move around without losing your place?

**1. Readest hides both bars, and shows the bottom bar when the mouse reaches the bottom edge or the page is tapped.** A strip 52 pixels tall at the bottom edge catches the mouse, and a comment beside it points at a bug report about that strip failing for a reader. Escape hides the bar. Source: [FooterBar.tsx lines 257 to 281](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/FooterBar.tsx#L257-L281). Status: **Both found it.** I re-opened it and it holds.

**2. Quran for iOS toggles its bars on a tap and hides them after 5 seconds.** A comment says the timer was made longer "to give existing users the time to see the new buttons". Source: [QuranViewController.swift lines 147 to 162](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/QuranViewFeature/Sources/QuranViewController.swift#L147-L162). Status: **Both found it.** I re-opened it and it holds.

**3. Readest puts Go Back and Go Forward buttons next to the slider, greyed out when there is nowhere to go.** The same row holds a type-a-page box. Source: [DesktopFooterBar.tsx lines 83 to 130](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/DesktopFooterBar.tsx#L83-L130). Status: **Both found it.** I re-opened it and it holds.

**4. The Zotero reader has a back button in its bar, greyed out when there is nowhere to go.** It sits in the first zone of the bar, before the page arrows. Source: [toolbar.js lines 145 to 152](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/components/toolbar.js#L145-L152). Status: **Both found it.** I re-opened it and it holds.

**5. Zotero's trail treats moves less than 2 seconds apart as one step, and never records passing positions as steps of their own.** A comment says this is so that stepping through notes or the outline does not fill the trail. Source: [history.ts lines 4 and 46 to 73](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/lib/history.ts#L4-L73). Status: **Only B found it.** I re-opened it and it holds.

**6. pdf.js records where you were before a jump, so the browser's Back button returns you.** Passing positions are stored as temporary and are replaced, not piled up. Source: [pdf_link_service.js lines 185 to 189](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/pdf_link_service.js#L185-L189) and [pdf_history.js lines 404 to 419](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/pdf_history.js#L404-L419). Status: **Both found it.** I re-opened it and it holds.

**7. Open-Mushaf shows a strip only while you are away from your saved page, with one button to return and one to make the new page your saved place.** A jump marked temporary does not overwrite the saved page. Source: [ReadingPositionBanner.tsx lines 21 to 65](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/components/ReadingPositionBanner.tsx#L21-L65) and [useCurrentPage.ts lines 27 to 51](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/hooks/useCurrentPage.ts#L27-L51). Status: **Only B found it.** I re-opened it and it holds. It is a small project, so treat it as a good idea, not as proof that many readers like it.

**8. Kavita closes its bars on a 3-second timer, pauses the timer while the slider is held, and lets the reader switch the timer off.** Source: [manga-reader.component.html lines 152 to 156](https://github.com/Kareadita/Kavita/blob/e844b64f2d64867afd089adf8af4376bdc85eecc/UI/Web/src/app/manga-reader/_components/manga-reader/manga-reader.component.html#L152-L156) and [manga-reader.component.ts lines 1368 to 1373](https://github.com/Kareadita/Kavita/blob/e844b64f2d64867afd089adf8af4376bdc85eecc/UI/Web/src/app/manga-reader/_components/manga-reader/manga-reader.component.ts#L1368-L1373). Status: **Only B found it.** I re-opened it and it holds.

**9. Komga keeps a slider in a bottom bar with the current page at one end, the last page at the other, and first, last, previous-book and next-book buttons.** At the edge of a book it shows a 3-second message about moving to the next or previous book. Source: [DivinaReader.vue lines 82 to 120 and 258 to 283](https://github.com/gotson/komga/blob/db2ad643c64d9199f7dd01cd3cca3ff0e7a17445/komga-webui/src/views/DivinaReader.vue#L82-L120). Status: **Only B found it.** I re-opened it and it holds. The first press at the edge only shows the message, and a second press while the message is up moves to the other book ([lines 755 to 768](https://github.com/gotson/komga/blob/db2ad643c64d9199f7dd01cd3cca3ff0e7a17445/komga-webui/src/views/DivinaReader.vue#L755-L768)).

**10. Aidoku shows and hides its bars on a tap and keeps the slider in the bottom bar.** Source: [ReaderToolbarView.swift lines 62 to 63](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/Toolbar/ReaderToolbarView.swift#L62-L63). Status: **Both found it.** I re-opened it and it holds. The slider sits in the toolbar, and the reading screen sets up a single tap for toggling the bars ([ReaderViewController.swift lines 1194 to 1205](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/ReaderViewController.swift#L1194-L1205)).

**11. Readest shows the page label under your finger while you drag the slider.** Source: [DesktopFooterBar.tsx lines 52 to 58](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/DesktopFooterBar.tsx#L52-L58). Status: **Both found it.** I re-opened it and it holds.

**12. Readest waits 100 milliseconds before the book follows the slider.** Source: [FooterBar.tsx lines 76 to 82](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/FooterBar.tsx#L76-L82). Status: **Only A found it.** I re-opened it and it holds.

**13. Apps with long documents pair the slider with a box to type a page number.** Readest has one beside the slider (finding 3), Zotero has one in its bar ([toolbar.js lines 176 to 194](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/components/toolbar.js#L176-L194)) and pdf.js has one ([viewer.html line 402](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/viewer.html#L402)). Status: **Only B found it** as a pattern. I re-opened all three and they hold.

**14. Zotero's progress slider follows the finger at once, and ignores outside updates for half a second after release.** Source: [toolbar.js lines 308 to 364](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/components/toolbar.js#L308-L364). Status: **Only B found it.** I re-opened lines 318 and 343 and they hold.

**15. Quran for iOS keeps the screen awake while a page is open.** Source: [QuranViewController.swift line 113](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/QuranViewFeature/Sources/QuranViewController.swift#L113). Status: **Only B found it.** I re-opened it and it holds.

**16. Aidoku offers named maps of which part of the page turns which way when tapped.** A comment credits an Android reader for the shapes. Source: [TapZone.swift lines 24 to 63](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Core/Settings/TapZone.swift#L24-L63). Status: **Only A found it** (B saw the name without reading the file). I re-opened it and it holds.

**17. Quran.com on the web keeps its top bar up, hides it on scrolling down and returns it on scrolling up.** Source: [NAVBAR-ARCHITECTURE.md line 196](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/docs/NAVBAR-ARCHITECTURE.md#L196). Status: **Only B found it.** I re-opened the document. It names visibility that follows scrolling, and I did not read the code that does it.

**18. In full screen, pdf.js hides its controls after 3 seconds and turns pages on a 50-pixel swipe.** Status: **Only A found it.** I did not re-open it, because the file was not among those I fetched.

## How do these apps rearrange themselves for different window sizes?

**19. Readest has two arrangements of its bottom bar, one row of full controls and one row of five icons that each open a panel, and switches at 640 pixels.** A says the switch is by width. B says "wide or tall". Source: [FooterBar.tsx lines 238 and 253](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/FooterBar.tsx#L238-L253) and [DesktopFooterBar.tsx lines 69 to 75](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/DesktopFooterBar.tsx#L69-L75). Status: **Both found it but they disagree.** The code supports A. The switch between the two rows is by width. Height appears once, in a calculation of bottom padding, and that is where B's "or tall" comes from.

**20. The five icons in Readest's narrow row are Table of Contents, Color, Reading Progress, Font and Layout, and Speak.** Source: [NavigationBar.tsx lines 59 to 88](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/NavigationBar.tsx#L59-L88). Status: **Only B found it.** I re-opened it and it holds.

**21. Excalidraw names three sizes and decides from the size of its own drawing area.** Phone is up to 599 pixels wide, tablet runs from 600 to 1180, and desktop is above. A phone on its side (under 500 tall and under 1000 wide) still counts as a phone. Source: [editorInterface.ts lines 19 to 26, 72 to 77 and 145 to 158](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/common/src/editorInterface.ts#L19-L26). Status: **Both found it.** I re-opened it and it holds.

**22. pdf.js keeps one bar and drops buttons from it as the window narrows.** A says items go at 840, 750, 690 and 560 pixels and some move into the "more" menu. B says the previous and next buttons vanish at about 690 and "next page" is lost. Source: [viewer.css lines 1835 to 1868](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/viewer.css#L1835-L1868) and [viewer.html lines 389 to 402 and 678 to 718](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/viewer.html#L389-L402). Status: **Both found it but they disagree.** Each is partly right. The four widths are real, but 840 changes only the side panel, not the bar. At 750, print and save move into the "more" menu. At 690 the previous and next buttons are hidden, and in the lines I read nothing replaces them, which supports B. The page number box stays. At 560 the zoom chooser goes.

**23. Kiwix shows a bottom bar on a narrow screen and a sidebar beside the content on a wide one.** A says it decides by device. B says it decides by the width the system reports. Source: [RootView_iOS.swift lines 20 to 30](https://github.com/kiwix/kiwix-apple/blob/8e13ae648ae92e3da019521554a67cb27b01a5c1/App/RootView_iOS.swift#L20-L30). Status: **Both found it but they disagree.** The code supports B for iPhone against iPad: one check of the width class picks the arrangement, so an iPad sharing its screen gets the narrow one. A is right that the Mac is a separate branch of the code.

**24. Aidoku offers one page, two pages or automatic, and automatic means two pages when the space is wider than it is tall.** It decides again on rotation and keeps the current page. Source: [ReaderPagedViewController.swift lines 175 to 206](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/Readers/Paged/ReaderPagedViewController.swift#L175-L206). Status: **Both found it.** I re-opened it and it holds.

**25. Quran for iOS turns two pages on by default except on phones, and needs more than 900 points of width.** Source: [TwoPagesUtils.swift lines 11 to 18](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Domain/QuranTextKit/Sources/TwoPages/TwoPagesUtils.swift#L11-L18). Status: **Both found it.** I re-opened it and it holds.

**26. Bluesky uses three widths: a bottom bar, an icon-only side strip, and a full side list.** Source: [useWebMediaQueries.tsx](https://github.com/bluesky-social/social-app/blob/7f064abe2514bced0a5de5f605b2ee23341899b4/src/lib/hooks/useWebMediaQueries.tsx). Status: **Only B found it.** I re-opened the file. It names three sizes (mobile, tablet, desktop). The pixel numbers and what changes at each are in files I did not open.

**27. Open-Mushaf does not rearrange: it is one column at most 640 pixels wide on every screen.** Source: [DESIGN.md line 90](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/DESIGN.md?plain=1#L90). Status: **Only B found it.** I re-opened it and it holds.

**28. Kavita tells the reader, in a short message, when it switches away from two pages by itself.** Source: [manga-reader.component.ts lines 989 to 994](https://github.com/Kareadita/Kavita/blob/e844b64f2d64867afd089adf8af4376bdc85eecc/UI/Web/src/app/manga-reader/_components/manga-reader/manga-reader.component.ts#L989-L994). Status: **Only B found it.** I re-opened it and it holds. The exact words of the message are in a translation file I did not open.

**29. NetNewsWire builds separate interfaces per device on purpose, and Sefaria shows as many side-by-side panels as fit at 360 pixels each.** Status: **Only A found it.** I did not re-open either.

**30. Kiwix's change notes show its iPad arrangement needing repeated fixes.** Source: [CHANGELOG.md](https://github.com/kiwix/kiwix-apple/blob/8e13ae648ae92e3da019521554a67cb27b01a5c1/CHANGELOG.md?plain=1#L94). Status: **Only B found it.** I re-opened the file and saw several fixes to tabs and overlays on iPhone and iPad. "Again and again" is B's reading, and I did not count them.

## Where do these apps put pens and marking tools?

**31. The Zotero reader has one top bar in three zones: page controls first, pens in the centre, other buttons at the end.** A says a dropdown follows the pens and the end zone holds find and a side-panel button. B says a colour button follows the pens and the end zone holds appearance and find. Source: [toolbar.js lines 79, 200 to 270 and 271 to 296](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/components/toolbar.js#L200-L296). Status: **Both found it but they disagree**, on small details only. Both are describing the same code and each left one button out. The button after the pens is a colour picker with a dropdown arrow. The end zone holds appearance, then find, then a side-panel button that shows only inside the Zotero desktop app.

**32. In the Zotero reader, pressing the pen already in hand puts it down.** Source: [toolbar.js lines 55 to 63](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/components/toolbar.js#L55-L63). Status: **Only B found it.** I re-opened it and it holds.

**33. Zotero on iPad has a separate pen bar the reader drags to one of four places: leading edge, trailing edge, top, or pinned under the title.** Dashed outlines show where it can land while it is dragged. Source: [AnnotationToolbarHandler.swift lines 36 to 41, 107 to 114 and 432 to 473](https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/Zotero/Scenes/Detail/PDF/Views/AnnotationToolbarHandler.swift#L36-L41). Status: **Both found it.** I re-opened it and it holds.

**34. Zotero on iPad remembers where the pen bar was left.** Source: [AnnotationToolbarHandler.swift lines 35 and 465 to 472](https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/Zotero/Scenes/Detail/PDF/Views/AnnotationToolbarHandler.swift#L465-L472). Status: **Only B found it** (A did not trace it). The code partly supports it. The position is a kind of value that can be saved, and it is handed to the owning screen when a drag ends. The lines B cited (107 to 113) draw the dashed outlines and do not show saving. The place where it is written to storage is in a file nobody opened.

**35. Excalidraw puts its tools in the bottom bar on a phone and in a block at the top on wider windows.** Source: [MobileMenu.tsx lines 160 to 186](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/MobileMenu.tsx#L160-L186) and [LayerUI.tsx lines 334 to 394 and 633](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/LayerUI.tsx#L334-L394). Status: **Both found it.** I re-opened it and it holds. Both say "top centre". The code shows the top, and the centring is done in a style file I did not open.

**36. Readest has no standing pen bar. Its marking tools appear in a small popup where text is selected.** Status: **Both found it.** I did not re-open it.

**37. pdf.js puts its tools at the right of the top bar, and each tool opens its own small options panel.** Status: **Both found it** for the position. The options panel is from B only. I did not re-open either.

## How are settings grouped, and where do everyday view choices live?

**38. Quran for iOS has a small menu on the reading screen for view choices, and hides a row that does not apply.** Each row is marked always on, always off, or shown on a condition. Source: [MoreMenuView.swift lines 147 to 164](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/MoreMenuFeature/Sources/views/MoreMenuView.swift#L147-L164). Status: **Both found it.** I re-opened it and it holds. I did not count the rows (A says about ten, B about eight).

**39. Readest's settings are tabs, and the dialog reopens on the tab last used.** Source: [SettingsDialog.tsx lines 149 to 151 and 285 to 294](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/components/settings/SettingsDialog.tsx#L149-L151). Status: **Both found it.** I re-opened it and it holds. Both say nine tabs, and I did not recount.

**40. Readest can be sent straight to one setting, which it scrolls to and highlights for 2 seconds.** Each setting has an address made of the tab and the item. Source: [SettingsDialog.tsx lines 331 and 359 to 361](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/components/settings/SettingsDialog.tsx#L331-L361). Status: **Only A found it.** I re-opened it and it holds.

**41. Kiwix can open its settings already scrolled to one item.** Source: [Settings.swift lines 155 and 195 to 198](https://github.com/kiwix/kiwix-apple/blob/8e13ae648ae92e3da019521554a67cb27b01a5c1/Views/Settings/Settings.swift#L155-L198). Status: **Only A found it.** I re-opened it and it holds.

**42. NetNewsWire keeps five settings tabs on the Mac and gives rare switches no screen at all.** The tabs are General, Appearance, Timeline, Accounts and Advanced. A note in the repository says hidden settings are named for the person who asked for them. Source: [PreferencesWindowController.swift lines 23 to 43](https://github.com/Ranchero-Software/NetNewsWire/blob/a5cec78e2aaca287144bcd45fa6ff2f1141518e7/Mac/Preferences/PreferencesWindowController.swift#L23-L43) and [HiddenPrefs.md](https://github.com/Ranchero-Software/NetNewsWire/blob/a5cec78e2aaca287144bcd45fa6ff2f1141518e7/Technotes/HiddenPrefs.md?plain=1#L1-L8). Status: **Both found it.** I re-opened it and it holds.

**43. Bluesky's settings are a short list of plain names, each opening a page of its own.** I count twelve rows, from Account to About. Source: [Settings.tsx lines 186 to 290](https://github.com/bluesky-social/social-app/blob/7f064abe2514bced0a5de5f605b2ee23341899b4/src/screens/Settings/Settings.tsx#L186-L290). Status: **Only B found it.** I re-opened it and it holds.

**44. Home Assistant lists about 25 settings groups at one level, and on the Mac shows them as a sidebar with the chosen group beside it.** Source: [SettingsItem.swift lines 6 to 30](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Settings/Settings/SettingsItem.swift#L6-L30) and [SettingsView.swift lines 26 and 415 to 416](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Settings/Settings/SettingsView.swift#L415-L416). Status: **Only B found it.** I re-opened it and it holds: 25 groups, and a separate branch for the Mac sidebar.

**45. Kavita unfolds its view settings in place, under the slider, with the page still visible.** Source: [manga-reader.component.html lines 141 to 316](https://github.com/Kareadita/Kavita/blob/e844b64f2d64867afd089adf8af4376bdc85eecc/UI/Web/src/app/manga-reader/_components/manga-reader/manga-reader.component.html#L141-L316). Status: **Only B found it.** I re-opened parts of it (a settings button at line 185, a width control at lines 294 to 302) and they are consistent with it.

**46. Quran.com on the web has a settings drawer with three tabs, a live preview and a reset button.** Status: **Rests on something nobody opened.** B took it from file names.

**47. Aidoku has a settings sheet inside the reader, separate from the app's main settings.** Status: **Only A found it.** I did not re-open it.

## How do links open a place in these apps?

**48. Readest builds two links for the same place, a private one and an ordinary web address, and one piece of code reads both.** A comment says the web address is the one used when notes are exported and shared. An older link shape is still accepted. Links coming from the home-screen widget are not allowed to use the web form. Source: [deeplink.ts lines 23 to 74 and 104 to 107](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/utils/deeplink.ts#L23-L74). Status: **Both found it.** I re-opened it and it holds. One detail neither stated: an export can be set to embed either form.

**49. On a computer, Readest's web address lands on a page that decides whether to open the app.** Status: **Rests on something nobody opened.** A code comment says so ([deeplink.ts lines 56 to 61](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/utils/deeplink.ts#L56-L61)), but the page itself was listed and not read.

**50. Zotero's links count pages from 1, and the app converts inside.** A comment says the links use page numbers as printed while the reader counts from zero. Source: [CustomURLController.swift lines 136 and 176 to 177](https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/Zotero/Controllers/CustomURLController.swift#L176-L177). Status: **Both found it.** I re-opened it and it holds.

**51. Zotero still accepts an older link shape, which its code calls the "ZotFile format".** Source: [CustomURLController.swift lines 156 to 169](https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/Zotero/Controllers/CustomURLController.swift#L156-L169). Status: **Only A found it.** I re-opened it and it holds. The code gives the name and nothing about where the format came from.

**52. Quran for iOS answers links that name a sura, or a sura and a verse, in the same form as its Android app.** A says its tests refuse impossible values. B says it reads links forgivingly. Source: [QuranDeepLink.swift lines 19 to 40](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/AppStructureFeature/Sources/Launch/QuranDeepLink.swift#L19-L40) and [QuranDeepLinkTests.swift lines 35 to 67](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/AppStructureFeature/Tests/QuranDeepLinkTests.swift#L35-L67). Status: **Both found it but they disagree**, in emphasis only. Both are right. It is forgiving about shape (extra words, a trailing slash and capital letters are ignored) and strict about values (a sura or verse number that does not exist is refused, and tests hold that). Only the private form exists here. A web address form was not found.

**53. Home Assistant asks the reader to confirm before a link does something, and shows an error when a link is not understood.** Source: [IncomingURLHandler.swift lines 64 to 84 and 232 to 234](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Frontend/IncomingURLHandler.swift#L64-L84). Status: **Both found it** for the confirm step. I re-opened it and it holds. The error for an unknown link is from A only, and it also holds.

**54. Home Assistant asks before a "go there" link only if the reader has switched that on.** Source: [AppContainerCoordinator.swift line 298](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Container/AppContainerCoordinator.swift#L298). Status: **Only A found it.** I re-opened it. The setting and the check exist. The message it shows is named for links that arrive in a notification, and I did not trace whether every "go there" link passes through this check. Treat it as partly supported.

**55. Home Assistant also answers ordinary web addresses on its own redirect site.** A comment explains that these are kept apart from the private links, and that only web addresses may reach the in-app browser. Source: [IncomingURLHandler.swift lines 49 to 58](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Frontend/IncomingURLHandler.swift#L49-L58). Status: **Only B found it.** I re-opened it and it holds.

**56. Wikipedia keeps a public table of every link the app answers, each with an example, in both the private and the web form.** Source: [url_schemes.md](https://github.com/wikimedia/wikipedia-ios/blob/0cc1624ab47c5e40b9e3968dc2362b45877cd81d/docs/url_schemes.md?plain=1#L1-L15). Status: **Only B found it.** I re-opened it and it holds.

**57. In pdf.js and Sefaria the address in the browser bar always says where you are.** Status: **Both found it** for pdf.js. Sefaria is from A only. I did not re-open either.

**58. Bluesky gives each place both link forms, and Kiwix still reads its old link shapes.** Status: Bluesky is **Only B found it** and Kiwix is **Only A found it.** I did not re-open either.

## How do these apps teach a first-time reader?

**59. Excalidraw shows a few hints that point at its real menu, toolbar and help button, only while the canvas is empty.** A says they vanish when a tool is picked. B says they vanish at the first stroke. Source: [App.tsx lines 2499 to 2505](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/App.tsx#L2499-L2505). Status: **Both found it but they disagree.** Both are right. The hints show only while the starting tool is in hand and nothing has been drawn, so picking another tool hides them and so does the first shape.

**60. Readest has no welcome screen, but shows a small sign at the moment a hidden page-turn gesture starts.** A comment says "Nothing else advertises the gesture". Source: [PageTurnHint.tsx lines 13 to 15](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/annotator/PageTurnHint.tsx#L13-L15). Status: **Only A found it.** I re-opened it and it holds. B looked for first-run teaching in Readest and found none, which agrees with the first half.

**61. Quran for iOS shows "what's new" notes for updates only, and a new install is marked as having seen them all.** Source: [AppWhatsNewPlan.swift lines 11 to 40](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/WhatsNewFeature/Sources/AppWhatsNewPlan.swift#L11-L40). Status: **Both found it.** I re-opened it and it holds. A's version rested on a folder name, and B read the file.

**62. Sefaria has a guide made of cards that shows once, can be brought back with a button, and is switched on for its editor only, not its reading screen.** If the guide takes more than 7 seconds to load, it closes itself and shows an error. A comment gives the reason: a guide that causes problems is not worth it. Source: [GuideOverlay.jsx lines 100 to 186](https://github.com/Sefaria/Sefaria-Project/blob/ce9b1c84dc858b667b92655ea82ebf8f7e7810f7/static/js/GuideOverlay.jsx#L100-L186) and [ReaderPanel.jsx lines 548 to 560](https://github.com/Sefaria/Sefaria-Project/blob/ce9b1c84dc858b667b92655ea82ebf8f7e7810f7/static/js/ReaderPanel.jsx#L548-L560). Status: **Only A found it.** I re-opened it and it holds. The code does not show whether the guide blocks the page while it is up.

**63. Quran.com on the web has a tour that points at real buttons, in four named groups with a checklist and a Skip button.** If the tour is left unfinished, the checklist comes back once a month, three times at most. Source: [onboarding.json lines 2 to 12](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/locales/en/onboarding.json#L2-L12), [steps.ts lines 63 to 298](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/src/components/Onboarding/steps.ts#L63-L298) and [useShowChecklistAfterInterval.ts lines 9 to 46](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/src/components/Onboarding/OnboardingChecklist/hooks/useShowChecklistAfterInterval.ts#L9-L46). Status: **Only B found it.** I re-opened it and it holds. A could not download this repository.

**64. Open-Mushaf shows a few tutorial slides at first launch, with a Skip button, and records that the tutorial is finished.** Source: [TutorialGuide.tsx lines 36 and 203](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/components/TutorialGuide.tsx#L36). Status: **Only B found it.** I re-opened those lines and they hold. I did not check that it can be reopened as a screen of its own.

**65. Kavita shows one short message, with the bars open, the first time someone reads in a library, and briefly flashes the tap areas when the bars open.** The flash lasts 3 seconds and has a setting to turn it off. Source: [manga-reader.component.ts lines 780 to 785 and 1788 to 1794](https://github.com/Kareadita/Kavita/blob/e844b64f2d64867afd089adf8af4376bdc85eecc/UI/Web/src/app/manga-reader/_components/manga-reader/manga-reader.component.ts#L780-L785). Status: **Only B found it.** I re-opened it and it holds.

**66. Wikipedia shows one tip bubble on one button, and only when rules allow: the screen is narrow and no other announcement is about to show.** Source: [ArticleViewController+Tooltips.swift lines 37 to 70](https://github.com/wikimedia/wikipedia-ios/blob/0cc1624ab47c5e40b9e3968dc2362b45877cd81d/Wikipedia/Code/ArticleViewController%2BTooltips.swift#L37-L70). Status: **Only B found it.** I re-opened it and it holds. I did not confirm that closing the tip retires it for good.

**67. Zotero on iPad shows a one-time sheet the first time read-aloud is used.** Source: [Defaults.swift lines 183 to 184](https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/Zotero/Models/Defaults.swift#L183-L184). Status: **Only A found it.** I re-opened the saved "already shown" flag and it exists. I did not read where the sheet is presented.

**68. Several first-run screens were named but not read.** These are Zotero's four picture pages before sign-in, Kiwix's welcome screen, and the welcome or setup screens of Home Assistant, Bluesky and Wikipedia. Status: **Rests on something nobody opened.** They come from file names or search results.

## How do these apps handle right-to-left sliders and page order?

**69. Aidoku runs its page slider backward when the book reads right to left.** The slider has a direction of its own, set from the book's reading mode and not from the device language. Source: [ReaderViewController.swift lines 734 to 738](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/ReaderViewController.swift#L734-L738) and [ReaderSliderView.swift lines 11 to 20](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/Toolbar/ReaderSliderView.swift#L11-L20). Status: **Both found it.** I re-opened it and it holds.

**70. Readest sets the direction of its whole bottom bar from the book, and picks its arrow icons from the book's direction.** Its page-turn sign uses the physical left and right sides for a right-to-left book. Source: [FooterBar.tsx line 289](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/FooterBar.tsx#L289) and [PageTurnHint.tsx lines 37 to 38](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/annotator/PageTurnHint.tsx#L37-L38). Status: **Both found it.** I re-opened it and it holds.

**71. Quran for iOS forces its page turner to right-to-left, whatever the device language.** Source: [QuranPaginationView.swift line 55](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/QuranPagesFeature/Sources/QuranPaginationView.swift#L55). Status: **Only A found it.** I re-opened it and it holds.

**72. Aidoku's slider handle grows while held.** A adds that it ticks as pages pass. B adds that it can be caught a little outside its edge. Status: **Both found it.** I did not re-open it.

**73. Whether Kavita's slider flips for a right-to-left book is unknown, and Kavita offers a "two pages, reversed" view.** Status: **Rests on something nobody opened** for the slider (B says it is not verified). The reversed view is **Only B found it**, and I did not re-open it.

## What do these apps do about undo, empty states and errors?

**74. Readest's short messages leave after 5 seconds, with plain news in the middle of the screen and success, warnings and errors at the top.** On a wide window the top ones sit in the corner. Source: [Toast.tsx lines 24 to 34](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/components/Toast.tsx#L24-L34). Status: **Both found it** for the positions. I re-opened it and it holds. The 5 seconds is from B only, and it also holds.

**75. Readest shows a separate hint for 2 seconds in a strip at the top.** Source: [HintInfo.tsx lines 45 to 49](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/HintInfo.tsx#L45-L49). Status: **Both found it.** I re-opened it and it holds.

**76. Excalidraw's short messages leave after 5 seconds unless told to stay, and one that stays can carry a close button.** The timer also pauses while the mouse is over the message. Source: [Toast.tsx lines 10 to 70](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/Toast.tsx#L10-L70). Status: **Both found it.** I re-opened it and it holds. Neither researcher mentioned the pause.

**77. Excalidraw keeps one line of help that changes with the tool in hand, and shows fewer of them on a phone.** Source: [HintViewer.tsx lines 101 to 103, 166 and 234](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/HintViewer.tsx#L101-L103). Status: **Both found it.** I re-opened it and it holds. B marked the phone part as not verified. The code supports A: two hints are skipped on a phone.

**78. Bluesky's and Komga's short messages last 3 seconds.** Source: [const.ts line 1](https://github.com/bluesky-social/social-app/blob/7f064abe2514bced0a5de5f605b2ee23341899b4/src/components/Toast/const.ts#L1) and [DivinaReader.vue line 376](https://github.com/gotson/komga/blob/db2ad643c64d9199f7dd01cd3cca3ff0e7a17445/komga-webui/src/views/DivinaReader.vue#L376). Status: **Only B found it.** I re-opened both and they hold. Where Bluesky places the message was not re-opened.

**79. Nothing was found on undo.** Neither researcher reports an app offering Undo after a mark is erased or a setting is reset. The nearest things are the ways back after a jump (findings 3 to 7) and Komga's message before leaving a book (finding 9). Status: **Rests on something nobody opened.** Nobody searched for it.

**80. On empty and error states the evidence is thin.** What exists: Excalidraw's hints on an empty canvas (finding 59), Home Assistant's error for a link it cannot read (finding 53), Sefaria's guide giving up after 7 seconds (finding 62), and Kiwix opening settings at the item an error is about (finding 41). Status: no status of its own, since it only gathers the findings named, and each keeps its own. Nobody looked for a search that finds nothing or a page that fails to load.

**81. Device notifications were found in two apps, and neither is a reading reminder.** A says NetNewsWire sends one per new article and Kiwix one when a download finishes. Status: **Rests on something nobody opened.** These came from a word search, not from reading the code.

## What else rests on something nobody opened?

**82. That Home Assistant is "a web page in a native shell like ours".** Both researchers say so from the README and folder names. Nobody read the code that hosts the web page. Status: **Rests on something nobody opened.**

**83. The licence of Quran.com on the web.** Its README shows an MIT badge that links to a licence file. That file is not there at the version B read: the addresses ending in LICENSE, LICENSE.md and LICENSE.txt all return "404 not found". Status: **Rests on something nobody opened.** Take ideas only until someone checks.

**84. Which apps are really offered for the Mac.** This is taken from each README. No store listing was opened. Status: **Rests on something nobody opened.**

## Where do the two researchers disagree?

| Claim | A's version | B's version | What the code says when opened |
| --- | --- | --- | --- |
| How Readest picks between its two bottom rows (finding 19) | By width, at 640 pixels | At 640 pixels, "wide or tall" | A. The switch is by width. Height appears only in a padding calculation. |
| What pdf.js drops as the window narrows (finding 22) | Items go at 840, 750, 690 and 560, some into "more" | Previous and next vanish at about 690, and "next page" is lost | Each partly. A's widths are real, though 840 changes only the side panel. B is right that previous and next go at 690 with nothing replacing them in the lines read. |
| How Kiwix picks its arrangement (finding 23) | By device: iPhone, iPad, Mac | By the width class the system reports | B for iPhone against iPad. A is right that the Mac is a separate branch. |
| What follows the pens in the Zotero bar (finding 31) | A dropdown, then find and a side-panel button | A colour button, then appearance and find | Same code, each left one item out: a colour picker with a dropdown arrow, then appearance, find, and a side-panel button in the desktop app only. |
| Whether Zotero's iPad pen bar remembers its place (finding 34) | Not traced | Remembered | Partly B. The position can be saved and is handed on when a drag ends. Where it is stored was not opened, and B's cited lines show something else. |
| When Excalidraw's first-run hints vanish (finding 59) | When a tool is picked | At the first stroke | Both. Either one hides them. |
| Whether Excalidraw cuts help lines on a phone (finding 77) | Yes | Not verified | A. Two hints are skipped on a phone. |
| How Quran for iOS reads links (finding 52) | Tests refuse impossible values | Reads forgivingly | Both. Forgiving about shape, strict about values. |
| When Home Assistant asks before a link (findings 53, 54) | Doing-links always ask; go-there links ask only if a setting is on | Doing-links ask | Both agree on doing-links, and the code holds. A's extra claim is partly supported: the setting exists, but its message is about links from notifications. |
| How many apps ship on all three platforms from one codebase | One: Readest | Two: Readest and Open-Mushaf | Not a dispute about code. A did not read Open-Mushaf. Its README says Android, iPhone, web and Mac from one codebase. |
| Whether any reading app runs a tour | One guide found (Sefaria), kept off the reading screen | Tours in Quran.com on the web and Open-Mushaf | Not a dispute about code. Each read apps the other did not. All three hold when opened (findings 62, 63, 64). |
| How long Readest's short messages last (finding 74) | Not stated | 5 seconds | B. The default is 5 seconds. |

## What does this suggest for our app?

These are my recommendations, kept apart from the findings above. Each is mapped to an item in the layout plan and says how sure the evidence is. None of it replaces a rough build tried by hand.

**A tension to settle first.** The layout plan sets aside "hiding all the bars until the page is tapped" because full screen already does it. Both researchers, independently, ranked hidden bars first, and it is the best-supported finding here (findings 1, 2, 8, 10). The apps that keep a bar always showing (Zotero, pdf.js) are tools for working on a document, which is also what a reader holding a pen is doing. So the evidence does not say the plan is wrong. It says the choice deserves a rough build and not a line in a list of things set aside.

**① The "604 of 604 pages" line.** No app read shows a standing count of pages available. Nobody looked for one either, so this is silence and not support. Borrow nothing, and decide it on the plan's own reasons. Sureness: none from this research.

**② Moving and viewing on the bottom bar, with controls 32 to 40 points tall and 44 to hit.**

- Borrow the slider at the bottom with a way back beside it, greyed when empty (findings 3, 4, 9). Sureness: high. Both found it and I re-opened it.
- Borrow "a jump never costs the reader their place": a saved place that jumps do not overwrite, and a "return to page N" strip while away (finding 7), with Zotero's rule that quick moves count as one step (finding 5). Sureness: medium. Each part was found by B only, but both held when opened, and both researchers independently called the way back the most useful thing they found.
- Borrow a type-a-page box beside the slider if there is not one already (finding 13). Sureness: medium.
- Keep the slider running right to left by the book and not the device (findings 69, 70, 71). Sureness: high. The plan says the slider itself does not change, and this confirms that choice.
- On one page or two: offer one, two and automatic, decide automatic by the shape of the window, and say so in a short message when the app changes it by itself (findings 24, 25, 28). Sureness: high for the choice, medium for the message.
- On control sizes the evidence is thin. The only numbers found are Readest's 44-pixel top strip and 52-pixel bottom strip (findings 1, 75) and a design note in Open-Mushaf describing 36 and 44 pixel page buttons ([DESIGN.md line 114](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/DESIGN.md?plain=1#L114), from B only). These sit inside the plan's range but do not prove it. The plan's test that measures every control is the real check.

**③ Pens in the top bar.**

- The Zotero reader does what the plan proposes: page controls, then pens in the middle, then other buttons, in one top bar (finding 31). Sureness: high that a well-used app does this on a computer.
- But the same project does not do it on a tablet. Zotero on iPad gives the pens a separate bar the reader can move to either edge or the top (finding 33), and Excalidraw moves its tools to the bottom on a phone (finding 35). Sureness: high. So the plan's own worry, whether pens in the top bar are easy to hit with the pencil, is the right thing to test, and the existing choices for where the pens stand should stay as settings.
- Borrow "press the pen in hand to put it down" (finding 32). Sureness: medium, B only, held when opened.

**④ Settings sorted by subject.**

- Borrow the two levels: everyday view choices in a small menu on the reading screen, the rest in Settings (findings 38, 45). Sureness: high.
- Aim for about ten names at the first level. The most any app shows is 25 (Home Assistant, finding 44), and the shorter ones show 5 to 12 (findings 39, 42, 43). Forty-seven at one level is outside anything read. Sureness: medium, since most of the counts come from B only.
- Borrow an address for every setting, so a message or a link can open Settings at that setting and highlight it (findings 40, 41). Sureness: medium, A only, held when opened. This matches the plan's "settings, and each subject in it, has its own link".
- Borrow reopening where the reader left off (finding 39), and hiding a row that does not apply (finding 38). Sureness: high.
- Consider giving rare settings no row (finding 42). Sureness: high that NetNewsWire does it. Whether it suits us is a judgment, because our rule is that a design option that lost stays reachable as a setting.

**⑤ Messages replacing the help row, with undo and error states.**

- Borrow short messages that leave by themselves in 3 to 5 seconds, placed away from the bottom bar (findings 74, 76, 78). Sureness: high on the timing.
- Keep a line of help only while a pen is in hand, and less of it on a phone (finding 77). Sureness: high that Excalidraw does this. No reading app was found with a help line during plain reading.
- A message that needs an answer should stay and carry a close button (finding 76). Sureness: high.
- On Undo for the eraser and for "reset settings", this research found nothing (finding 79). The plan's rule stands on its own reasons. On "a search that finds nothing" and "a page that fails to load", the research also found almost nothing (finding 80). Do not read the silence as "others do not bother".
- One error idea is worth taking: when help itself fails to load, close it and say so, do not leave the reader waiting (finding 62). Sureness: medium, A only.

**⑥ A guided tour with a link for each step.**

- The evidence leans away from a forced tour and toward the owner's earlier choice that tips wait until asked for. Readest teaches nothing at first open, Sefaria built a guide and keeps it off its reading screen, and Quran for iOS shows nothing to a new install (findings 60, 61, 62). Sureness: medium. Each tour finding has one researcher behind it.
- If the tour is built, the two tours found on reading screens both have a Skip button, and the larger one adds groups that can be started on their own and a cap on how often it asks again (findings 63, 64). Borrow all three. Sureness: medium, B only, held when opened.
- No app was found that gives each tour step its own link. Quran.com's tour can start at any group, which is the nearest thing. So a link for each step would be our own idea, and it costs little because the app already opens places from links.
- Borrow teaching at the moment it matters: a small sign when a hidden gesture starts (finding 60), and one tip at a time, never while something else is on screen (finding 66). Sureness: medium.
- For links in general: give each place a private form and an ordinary web address read by the same code, never retire a shape once shared, let "go there" links just go, and ask before a link changes anything (findings 48, 51, 53). Sureness: high. Publish one page that lists every link with an example (finding 56). Sureness: medium.

## What did nobody look at?

- **No app was run and no screenshot was taken.** Position, size and feel are read from code, not seen. A layout that reads well in code can feel wrong in the hand.
- **No web version was opened at phone or computer width.**
- **Issue trackers, forums and blog posts were not searched** for why a layout is the way it is. The reasons cited are a few code comments, one bug report number and a handful of notes inside repositories.
- **Store listings were not opened.** Which apps are offered for the Mac comes from READMEs.
- **Pen-first apps were not read.** A handwriting notes app and a desktop PDF annotator were listed by both researchers and dropped. The pens question rests on Zotero, Excalidraw and pdf.js.
- **Apps with very long settings lists were not read.** Two note-taking apps were on A's list and not opened.
- **Media players were not read** for how they build a scrubber.
- **Undo, a search that finds nothing, and a page that fails to load** were not looked for by either researcher.
- **Device notifications.** A looked with one word search across the Swift apps, did not check one of them (Home Assistant), and never sorted the matches from Zotero for iPad. B did not examine notification code at all. Two apps were seen to send notifications, and neither sends a reminder to read. This is a gap, not a "no".
- **Sefaria's guide.** The evidence shows only that it gives up after 7 seconds if it is slow to load. Whether it blocks the page while it is showing was not checked.
- **Zotero's older link shape.** The findings say only that the code names it the "ZotFile format". Where that format came from was not checked.
- **Quran.com on the web** was read by B from a few files. A's download hung. Its settings drawer rests on file names, and its licence file is missing at the version read.
- **Quran for iOS and Home Assistant** were read from a few files each. Whether Quran for iOS has a page slider was not verified.
- **Mac builds.** Aidoku's README names the Mac and nobody checked how. Nobody found a Mac version of Quran for iOS, and nobody proved there is none.
- **The revision calendar, look-alike verses, and sharing a verse as a picture.** No app read has these.
- **Reporting a problem, optional sign-in, and each project's public site** were noticed in passing by both and not followed.
- **A's search method** is written down in A's findings file under "How did I search for first-run teaching and for device notifications?". A word search can miss things, so "none found" there does not mean "none exists".
- **What I did not re-open.** Findings 18, 29, 36, 37, 47, 57, 58 and 72, and the parts named inside findings 17, 26, 28, 34, 35, 54, 64, 66, 67 and 78. They keep the status the researchers gave them.

## How can I check a claim myself?

Every source link on this page includes the full identifier of the exact version of the repository that was read, the path of the file, and the line numbers, so it will show the same lines even after the project changes. Open the link and compare the lines with what the finding says. For the nine repositories both researchers read, they read the same version, so one link serves both. If a link shows "404 not found", the file was missing at that version, and this page says so where that happened (finding 83). A and B's own notes, with every file they opened and how they checked it, are in the four dated files next to this one.
