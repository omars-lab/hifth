# Which open apps can a page-by-page reader learn from? Raw findings (researcher B)

Looked on 2026-11-16. This is the raw record: every app, every source, and whether I opened it.
My own reading of what it means is in [the design note](2026-11-16-b-design.md).

## What is the short version?

- I looked at 26 open-source apps and went deep on 14.
- **Only one open-source book reader I found ships on Mac, iPhone, iPad and the web from one codebase: Readest.** It is also the closest match to how our app is built (a web page inside a thin native shell).
- Most admired apps cover two of the three. Mac and iPhone apps usually have no web version. Web readers usually have no native app.
- The richest evidence is in code, not in write-ups. Few projects wrote down *why* they laid the screen out as they did. The ones that did are listed under "Who wrote down why?" below.
- Five apps carry a copyleft licence (GPL or AGPL). For those we take ideas only, never code. They are flagged each time.

## How did I collect this?

- I downloaded a read-only copy of each app's public code and read the files myself. Each link below points at the exact version I read (the long code in the address is that version).
- For three apps the full download was too slow, so I downloaded single files from the same public address instead. Those are marked "single files".
- Stars, licence and last-change date come from GitHub's public information service for each repository, read on 2026-11-16, not from memory.
- **Fetched** means I opened the file or page and read it. **Snippet only** means I only saw a search-result summary.
- I did not open any app's live web version in a browser, and I ran none of the apps. Everything about layout below is read from code or from the project's own documents. Where the code did not settle a point, I say "not verified".

## Which apps did I look at closely?

### 1. Readest: a book reader on every platform from one codebase

- **Code:** <https://github.com/readest/readest>, version read `ca575bb6`. **Fetched.**
- **Licence:** AGPL-3.0. **Copyleft: ideas only, no code.**
- **Stars and last change:** 26,359 stars; last change 2026-11-16.
- **Platforms and how:** its README says one web codebase (Next.js) inside a Tauri shell, for "macOS, Windows, Linux, Android, iOS, and the Web". **Fetched** (`README.md` line 8). This is the same shape as our app: a web page drawn inside a thin native wrapper.

What it does, by question:

- **Moving through the book (1).** Top and bottom bars are hidden while reading. On a computer they fade in when the pointer reaches the top or bottom edge. On a phone they appear when the page is tapped. Source: [`HeaderBar.tsx`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/HeaderBar.tsx) lines 126 to 260, and [`FooterBar.tsx`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/FooterBar.tsx) lines 38 to 48. **Fetched.**
- **Two different bottom bars (1, 6).** At 640 px and wider, one thin row: previous section, previous page, go back, go forward, a type-a-page box, a slider, read aloud, next page, next section. Source: [`DesktopFooterBar.tsx`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/DesktopFooterBar.tsx). Under 640 px wide or tall, a row of five icons (contents, colour, progress, font and layout, read aloud). Each opens a panel just above the row, and the slider lives in the progress panel. Source: [`MobileFooterBar.tsx`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/footerbar/MobileFooterBar.tsx) and `NavigationBar.tsx` beside it. **Fetched.**
- **Right-to-left (8).** The arrow icons swap sides when the book reads right to left. Same file, `getNavigationIcon`. **Fetched.**
- **Trail back (8).** "Go back" and "go forward" buttons sit beside the slider and light up only when there is somewhere to go. Same file. **Fetched.**
- **Pens (2).** There is no standing pen bar. Tools appear as a small popup at the selected words, plus a quick menu in the top bar. Source: the folder [`annotator/`](https://github.com/readest/readest/tree/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/app/reader/components/annotator). **Fetched** (file names and the popup; I did not read every file).
- **Settings (3).** Nine icon tabs: Font, Layout, Theme, Behavior, Language, Integrations, AI Assistant, TTS, Custom. It reopens on the tab last used. Tab names hide under 640 px, leaving icons. On a phone it is a sheet rising to 70 % of the screen; on a computer a dialog. A switch says whether a change applies to every book or only this one. Source: [`SettingsDialog.tsx`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/components/settings/SettingsDialog.tsx) lines 92 to 150, 487, 537. **Fetched.**
- **Messages (4).** Short messages last 5 seconds. Plain information appears in the middle of the screen; success, warning and error appear at the top. Source: [`Toast.tsx`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/components/Toast.tsx) lines 24 to 33. A separate 2-second hint sits in the page's own header strip (`HintInfo.tsx`). **Fetched.**
- **First run (5).** I found no tour or welcome flow. A search of the code for "onboarding", "welcome" and "walkthrough" hit only tests. **Fetched** (absence, so weaker evidence).
- **Links (7).** Two forms for the same place: a private scheme, and an ordinary web address on its own site. A code comment says the web form opens the installed app on phones and lands on a web page on a computer. Its exported notes use the web form. Source: [`deeplink.ts`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/utils/deeplink.ts). **Fetched.**
- **Why documents.** [`docs/view-settings.md`](https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/docs/view-settings.md) explains global defaults with per-book overrides. `docs/page-curl.md` explains its paper page turn: on a two-page spread the outer page turns as a leaf hinged at the spine. `docs/safe-area-insets.md` covers notches and home bars. **Fetched** (the first two read; the third seen by name and opening lines).

### 2. Zotero's reader: pens and page controls in one bar, with a careful "back"

- **Code:** <https://github.com/zotero/reader>, version read `5581a8da`, and <https://github.com/zotero/zotero-ios>, version read `0d914f8c`. **Fetched.**
- **Licence:** both carry a COPYING file saying AGPL-3.0. **Copyleft: ideas only.**
- **Stars and last change:** reader 206, iOS app 318, the main desktop project 15,961; all changed 2026-11-14.
- **Platforms and how:** the reader is one web codebase with separate entry files for the desktop app, the web, iOS and Android (`src/index.zotero.js`, `index.web.js`, `index.ios.js`, `index.android.js`). **Fetched.** The iOS app's own PDF screen uses a paid commercial component (its README says so), so its code shows layout choices but not drawing. Store listings: not verified.

What it does:

- **One top bar in three zones (1, 2).** Left: sidebar, zoom, **back**, previous and next page, a page-number box you type into, and "n / total". Centre: the pens (highlight, underline, note, text, area, draw, eraser) and one colour button. Right: appearance, find. Pressing the active pen again returns to the plain pointer. Source: [`toolbar.js`](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/components/toolbar.js) lines 55 to 63 and throughout. **Fetched.**
- **Trail back (8).** The back button is greyed out unless there is somewhere to go back to. The rules behind it: movements less than 2 seconds apart replace the last remembered place instead of adding one; scrolling never adds a place; a deliberate jump always does. Source: [`history.ts`](https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/src/common/lib/history.ts) (`MIN_TIME_BETWEEN_POINTS = 2000`). **Fetched.**
- **Scrubber (8).** For flowing books only, a thin draggable progress strip inside the top bar. It follows the finger at once, then waits half a second after release before trusting the real position again. Same `toolbar.js`, lines 308 to 364. **Fetched.**
- **Pen bar the reader can move (2), iPad.** The pen bar can sit on the left edge, the right edge, the top, or pinned under the title bar. The reader long-presses and drags it; dashed outlines show where it can drop; the choice is remembered. Source: [`AnnotationToolbarHandler.swift`](https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/Zotero/Scenes/Detail/PDF/Views/AnnotationToolbarHandler.swift) lines 36 to 40 and 107 to 113. **Fetched.**
- **Links (7).** A link opens a document at a page. A code comment warns that links count pages from 1 while the reader counts from 0. Source: [`CustomURLController.swift`](https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/Zotero/Controllers/CustomURLController.swift) lines 17 and 176. **Fetched.**
- **Why documents.** None found in the two repositories. Not searched in their forums.

### 3. The Quran.com iPhone and iPad app: the closest subject match

- **Code:** <https://github.com/quran/quran-ios>, version read `956e30a2`. **Fetched, single files** (nine files).
- **Licence:** Apache-2.0. **Stars and last change:** 601; 2026-11-16.
- **Platforms and how:** native iPhone and iPad app. Whether it runs on Mac: not verified. The web version is a separate project (next entry). So this family is "separate apps per platform".

What it does:

- **Bars (1).** Bars hide on a 5-second timer after the page opens, and a tap on the page shows or hides them. A code comment says the timer was lengthened "to give existing users the time to see the new buttons". Source: [`QuranViewController.swift`](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/QuranViewFeature/Sources/QuranViewController.swift) lines 139 to 160. **Fetched.**
- **View settings in a small menu on the page (3).** A "more" button in the top bar opens a short menu: Arabic or translation, word pointer, page dividers, rotation lock, two pages, vertical scrolling, theme. Each row can be always shown, never shown, or shown only when it applies. Source: [`MoreMenuView.swift`](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/MoreMenuFeature/Sources/views/MoreMenuView.swift). **Fetched.**
- **Two pages (6, 8).** Two pages side by side is on by default on anything that is not a phone, and only offered when the screen is wider than 900 points. Source: [`TwoPagesUtils.swift`](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Domain/QuranTextKit/Sources/TwoPages/TwoPagesUtils.swift). **Fetched.**
- **Links (7).** A link names a surah, or a surah and a verse. The parser skips words and keeps numbers, so several spellings of the same link all work. A comment says the format matches the Android app on purpose. Source: [`QuranDeepLink.swift`](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/AppStructureFeature/Sources/Launch/QuranDeepLink.swift). **Fetched.**
- **Telling readers what changed (5).** A "what's new" screen shows only versions the reader has not seen. A brand-new install is marked as having seen everything, so a first-time reader is not shown old news. Source: [`AppWhatsNewPlan.swift`](https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/Features/WhatsNewFeature/Sources/AppWhatsNewPlan.swift). **Fetched.**
- **Not verified:** whether it has a page slider; I did not find one in the files I read.

### 4. Quran.com on the web: a tour, a checklist and a written navbar design

- **Code:** <https://github.com/quran/quran.com-frontend-next>, version read `aff1a035`. **Fetched, single files** (eleven files).
- **Licence:** unclear. GitHub detects none, the README shows an MIT badge, and the licence file the badge points at was not found at the address I tried. **Treat as ideas only until checked.**
- **Stars and last change:** 1,932; 2026-04-27.
- **Platforms and how:** website only.

What it does:

- **Bars that follow scrolling (1).** Scrolling down more than 50 px hides the top bar; scrolling up shows it. A 150 ms wait stops flicker. One layout switch at 768 px. Source: [`docs/NAVBAR-ARCHITECTURE.md`](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/docs/NAVBAR-ARCHITECTURE.md) sections 2 and 6. **Fetched.**
- **A strip that says where you are (1).** Under the top bar: chapter name, then juz, hizb and page number, a reading-mode switch, and a thin progress line. Same document, section 1, and the reader strip's own [`README`](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/src/components/QuranReader/ContextMenu/README.md). **Fetched.**
- **Settings (3).** A drawer with three tabs (Arabic, Translation, Word by word), a live preview of a verse, and a reset button. Source: `src/components/Navbar/SettingsDrawer/SettingTabs.tsx`. **Fetched** (tabs); the preview and reset are seen by file name only.
- **First run (5).** A tour that points at real buttons, split into four named groups (home page, settings, reading, personal features), each with Previous, Skip and Finish. A checklist lists the groups. If the reader closes it unfinished, it comes back once a month, at most three times, then never again. The top bar is forced visible while the tour runs. Sources: [`locales/en/onboarding.json`](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/locales/en/onboarding.json), [`useShowChecklistAfterInterval.ts`](https://github.com/quran/quran.com-frontend-next/blob/aff1a035b09b66f28047b3216edcae4c5c949a49/src/components/Onboarding/OnboardingChecklist/hooks/useShowChecklistAfterInterval.ts), `src/components/Onboarding/steps.ts`. **Fetched.**
- **Why documents.** The navbar document above, and `docs/ui-stacking-analysis.md` (1,118 lines on which layer sits above which; downloaded, only skimmed).

### 5. Open-Mushaf Native: a small page-image mus'haf on phone, web and Mac

- **Code:** <https://github.com/adelpro/open-mushaf-native>, version read `3bcc94a8`. **Fetched.**
- **Licence:** MIT. **Stars and last change:** 45; 2026-11-06. Small, so weigh it as one careful person's choices, not a crowd's.
- **Platforms and how:** one React Native (Expo) codebase. Its README says Android, iOS, web and macOS. **Fetched** (README). Store listings: not verified.

What it does:

- **Bars (1).** Tap anywhere on the page to show the top menu; long-press for commentary. The top menu shows surah, juz and a ring for today's reading, with four labelled icons: enlarge (full screen), search, jump, progress. Bottom tabs (index, mus'haf, more) hide in full screen. Sources: its own guide pages [`docs/top_menu.md`](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/docs/top_menu.md) and `docs/mushaf_interface.md`; `app/(tabs)/_layout.tsx` line 26. **Fetched.**
- **Trail back (8). The clearest find in this app.** When the reader jumps away from their saved place, a strip appears: "Return to reading position (page N)", with a second button to save the new page as the place instead. It shows only while the reader is away. A jump is marked "temporary" in the page address so it does not overwrite the saved place. Sources: [`ReadingPositionBanner.tsx`](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/components/ReadingPositionBanner.tsx), [`hooks/useCurrentPage.ts`](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/hooks/useCurrentPage.ts) lines 19 to 51. **Fetched.**
- **Page control (8).** Not a slider: a row of numbered circles for nearby pages (1, 3 or 5 of them by screen width), shrinking to a single number box under 370 px. Source: [`DESIGN.md`](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/DESIGN.md) line 114. **Fetched.**
- **Page turning (8).** The page lifts a little (moves at most 20 px, dims slightly, gains a shadow) rather than sliding away. A swipe must travel about a fifth of the screen width. Same file, line 138. **Fetched.**
- **One layout for all sizes (6).** Everything sits in one centred column at most 640 px wide. Landscape shows the page larger and scrolls. No two-page spread. Same file, line 90. **Fetched.**
- **First run (5).** A swipeable set of slides on first launch with a Skip button, and the same slides reachable later as their own screen. Source: [`TutorialGuide.tsx`](https://github.com/adelpro/open-mushaf-native/blob/3bcc94a86bfe26874e9aa929acac1d4a23716ec6/components/TutorialGuide.tsx) and `app/_layout.tsx` line 123. **Fetched.**
- **Why document.** `DESIGN.md` is a full written account of its design rules, including what it has left undone.

### 6. Kavita: a web reader with the fullest bottom sheet

- **Code:** <https://github.com/Kareadita/Kavita>, version read `e844b64f`. **Fetched.**
- **Licence:** GPL-3.0. **Copyleft: ideas only.** **Stars and last change:** 12,138; 2026-11-15.
- **Platforms and how:** a website served from your own computer. I found no native app in its README. So one of three.

What it does (comic reader, the page-by-page one):

- **Bars (1).** Hidden while reading. A tap on the middle of the page slides a top strip down (back, title, progress, bookmark, keyboard help) and a bottom strip up. The bottom strip has the **page slider** between first and last buttons, then four buttons: reading direction, reading mode, full screen, settings. Source: [`manga-reader.component.html`](https://github.com/Kareadita/Kavita/blob/e844b64f2d64867afd089adf8af4376bdc85eecc/UI/Web/src/app/manga-reader/_components/manga-reader/manga-reader.component.html) lines 12 to 50 and 141 to 190. **Fetched.**
- **Settings open in place (3).** The settings button unfolds view settings right under the slider (one page, two pages, two pages reversed, scaling, swipe on or off, brightness), not on another screen. Same file, lines 190 to 316. **Fetched.**
- **Bars close themselves (1).** After a pause the bars close. The timer stops while the slider is being dragged. The reader can switch this off. Source: [`manga-reader.component.ts`](https://github.com/Kareadita/Kavita/blob/e844b64f2d64867afd089adf8af4376bdc85eecc/UI/Web/src/app/manga-reader/_components/manga-reader/manga-reader.component.ts) lines 1368 to 1373. **Fetched.**
- **First run (5).** One message, once: the first time someone opens a book with no reading progress, the bars open and a short message says, in effect, tap the page for the menu, use the progress bar to go to a page, tap the sides to turn. Same file, lines 780 to 785. **Fetched.**
- **Showing the tap areas (5).** After the reader changes reading direction, the left and right tap areas flash briefly with arrows. A setting turns these hints off. Same file, lines 1789 to 1794. **Fetched.**
- **Two pages (8).** If the window is too narrow for two pages it falls back to one and says so in a short message. Same file, lines 991 to 993. **Fetched.**
- **Not verified:** whether the slider runs right to left for right-to-left books.

### 7. Aidoku: a right-to-left page slider done properly

- **Code:** <https://github.com/Aidoku/Aidoku>, version read `95d1468d`. **Fetched.**
- **Licence:** GPL-3.0. **Copyleft: ideas only.** **Stars and last change:** 4,760; 2026-11-14.
- **Platforms and how:** native app; README says iOS, iPadOS and macOS. No web. Two of three.

What it does:

- **Slider direction (8).** The page slider has a direction. For right-to-left books the thumb starts at the right and moves left as you read. The thumb grows by half while held, and can be grabbed slightly outside its drawn edge. Sources: [`ReaderSliderView.swift`](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/Toolbar/ReaderSliderView.swift), [`ReaderViewController.swift`](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/ReaderViewController.swift) lines 735 to 753. **Fetched.**
- **Two pages (6, 8).** Three choices: one page, two pages, or automatic. Automatic means two pages whenever the window is wider than it is tall, and it re-decides on rotation while keeping the current page. Source: [`ReaderPagedViewController.swift`](https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/Aidoku/Features/Reader/Readers/Paged/ReaderPagedViewController.swift) lines 175 to 206. **Fetched.**
- **Tap areas (1).** The reader can choose which parts of the page turn it. Seen by name only (`updateTapZone`); details not verified.

### 8. PDF.js: the standard web document bar

- **Code:** <https://github.com/mozilla/pdf.js>, version read `bb1539a2`. **Fetched.**
- **Licence:** Apache-2.0. **Stars and last change:** 54,142; 2026-11-15.
- **Platforms and how:** a web viewer, also the one built into Firefox. No native apps. One of three, but the most widely used layout of its kind.

What it does:

- **One top bar in three zones (1, 2).** Left: sidebar (thumbnails and outline), find, previous and next, a page box and total. Middle: zoom out, zoom in, a zoom menu. Right: the editing tools (highlight, text, draw, image), each opening its own small options panel underneath, then a "more" menu. Source: [`web/viewer.html`](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/viewer.html) lines 145 to 700. **Fetched.**
- **Rare things in a second menu (3).** The "more" menu holds full-screen presentation, first and last page, rotate, hand tool, scrolling style, and spreads (none, odd, even). Same file, lines 703 to 884. **Fetched.**
- **Narrow windows (6).** The same bar, with buttons dropped as the window narrows: previous and next vanish at 690 px while the page box stays. Source: [`web/viewer.css`](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/viewer.css) around lines 1853 to 1894. **Fetched.**
- **Links (7).** The address can carry the page and zoom after a `#` mark, for example a page number. Source: [`web/pdf_link_service.js`](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/pdf_link_service.js) lines 375 to 446. **Fetched.**
- **Trail back (8).** It uses the browser's own back button. Passing positions are held as "temporary" and replaced; only settled ones are kept. Source: [`web/pdf_history.js`](https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/web/pdf_history.js) lines 25 to 29 and 404 to 430. **Fetched.**

### 9. Excalidraw: one drawing tool that rearranges itself by window size

- **Code:** <https://github.com/excalidraw/excalidraw>, version read `82190fb2`. **Fetched.**
- **Licence:** MIT. **Stars and last change:** 135,783; 2026-11-16.
- **Platforms and how:** website that can be installed from the browser. No native apps. One of three; included for pens and for size handling.

What it does:

- **Three named sizes, measured on its own drawing area (6).** Phone (under 600 px wide, or a short wide landscape), tablet (up to 1180 px), desktop. It measures the size of its own area, not the device, so a narrow window on a big screen gets the phone layout. Source: [`editorInterface.ts`](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/common/src/editorInterface.ts) lines 145 to 158. **Fetched.**
- **Pens move with size (2).** On a phone the tools sit in a bar at the bottom. Otherwise they float at top centre. Source: [`LayerUI.tsx`](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/LayerUI.tsx) line 633 and `MobileMenu.tsx` lines 162 to 182. **Fetched.**
- **A standing help line (4).** One line of help that changes with the tool in hand, for example "Click and drag, release when you're finished". Source: [`HintViewer.tsx`](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/HintViewer.tsx). **Fetched.** Whether it shows on a phone: not verified.
- **Short messages (4).** 5 seconds by default, with a way to keep one open until closed. Source: `Toast.tsx`. **Fetched.**
- **First run (5).** Hand-drawn arrows with labels pointing at the menu, the tools and the help button. They show whenever the canvas is empty, not only the first time, and vanish at the first stroke. Source: [`WelcomeScreen.Hints.tsx`](https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/packages/excalidraw/components/welcome-screen/WelcomeScreen.Hints.tsx). **Fetched.**

### 10. NetNewsWire: how to keep settings short

- **Code:** <https://github.com/Ranchero-Software/NetNewsWire>, version read `a5cec78e`. **Fetched.**
- **Licence:** MIT. **Stars and last change:** 10,539; 2026-11-16.
- **Platforms and how:** separate native apps for Mac and for iPhone and iPad. No web. Two of three.

What it does:

- **Settings differ by platform (3, 6).** On iPhone, one grouped list that looks like the system's Settings. Its first row sends the reader to the system's own Settings for notifications and the like. Then: accounts, feeds, appearance (four drill-in pages), troubleshooting, help, about. Source: [`SettingsView.swift`](https://github.com/Ranchero-Software/NetNewsWire/blob/a5cec78e2aaca287144bcd45fa6ff2f1141518e7/iOS/Settings/SettingsView.swift) lines 33 to 95. On Mac, a preferences window with five tabs. Source: [`PreferencesWindowController.swift`](https://github.com/Ranchero-Software/NetNewsWire/blob/a5cec78e2aaca287144bcd45fa6ff2f1141518e7/Mac/Preferences/PreferencesWindowController.swift) lines 24 to 41. **Fetched.**
- **Why document: rare settings get no screen at all.** [`Technotes/HiddenPrefs.md`](https://github.com/Ranchero-Software/NetNewsWire/blob/a5cec78e2aaca287144bcd45fa6ff2f1141518e7/Technotes/HiddenPrefs.md) says settings only one or two people asked for exist but have no switch on screen, and each is named after the person who asked "so we can remember who asked for them". **Fetched.**
- **Why document: separate screens per platform on purpose.** `Technotes/SwiftUI-UIKit-AppKit-Guidelines.markdown`. **Fetched** (skimmed).

### 11. Home Assistant for Apple devices: a web page in a Swift shell, like ours

- **Code:** <https://github.com/home-assistant/iOS>, version read `ac2896d2`. **Fetched, single files** (four files, plus the list of file names).
- **Licence:** Apache-2.0. **Stars and last change:** 2,415; 2026-11-16.
- **Platforms and how:** a Swift shell around a web page, for iPhone, iPad and Mac (its README title is "Home Assistant for Apple Platforms", and the code checks for the Mac build throughout). The same web page also runs in any browser. This is our shape exactly. Not a reader, so only some questions apply.

What it does:

- **Links (7).** One scheme, with the first word naming the kind of link: go to a screen, open settings, do an action, and one kind for links that send an answer back to the caller. Ordinary web addresses on its own redirect site are handled separately from the private scheme. **A link that would do something (not just show something) asks the person to confirm first.** Source: [`IncomingURLHandler.swift`](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Frontend/IncomingURLHandler.swift) lines 26 to 70 and 101. **Fetched.**
- **Settings (3, 6).** The native shell owns its own settings: about 25 named groups in one list (servers, general, gestures, notifications, widgets, help, privacy, debugging, what's new and more). On Mac the same list becomes a sidebar with the chosen group shown beside it. On iPhone it is a list you drill into. Groups that do not apply to a device are left out. Sources: [`SettingsItem.swift`](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Settings/Settings/SettingsItem.swift) lines 6 to 30, [`SettingsView.swift`](https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/Sources/App/Settings/Settings/SettingsView.swift) lines 26, 71, 119. **Fetched.**
- **First run (5).** A fixed sequence of set-up steps (welcome, find server, permissions). Seen by file name only. It is set-up, not teaching, so it carries little for us.

### 12. Kiwix for Apple devices: one app, three arrangements

- **Code:** <https://github.com/kiwix/kiwix-apple>, version read `8e13ae64`. **Fetched.**
- **Licence:** GPL-3.0. **Copyleft: ideas only.** **Stars and last change:** 823; 2026-11-16.
- **Platforms and how:** one Swift codebase for iPhone, iPad and Mac (README). No web. Two of three.

What it does:

- **Different arrangement per size (6).** On a narrow screen: a bottom bar with back, forward, tabs, library, outline and a "more" menu, with find and settings at the top right. On a wide iPad screen and on Mac: a sidebar with the content beside it. The switch is the width class the system reports, so an iPad in a narrow split window gets the phone arrangement. Sources: [`RootView_iOS.swift`](https://github.com/kiwix/kiwix-apple/blob/8e13ae648ae92e3da019521554a67cb27b01a5c1/App/RootView_iOS.swift) lines 20 to 30, [`CompactViewController.swift`](https://github.com/kiwix/kiwix-apple/blob/8e13ae648ae92e3da019521554a67cb27b01a5c1/App/CompactViewController.swift) lines 84 to 110 and 243 to 252. **Fetched.**
- **What went wrong for them (why material).** Its change notes list a run of iPad fixes: toolbars that disappeared, the sidebar forgetting whether it was open, the bottom bar not appearing in split view. Source: [`CHANGELOG.md`](https://github.com/kiwix/kiwix-apple/blob/8e13ae648ae92e3da019521554a67cb27b01a5c1/CHANGELOG.md) lines 89 to 330. **Fetched.** The lesson is that the iPad middle ground is where the faults gather.

### 13. Bluesky: one codebase, web and phone, three widths

- **Code:** <https://github.com/bluesky-social/social-app>, version read `7f064abe`. **Fetched.**
- **Licence:** MIT. **Stars and last change:** 18,392; 2026-11-16.
- **Platforms and how:** one React Native codebase for the web, iOS and Android (README). No Mac app listed. Not a reader; included for settings, messages and links.

What it does:

- **Settings (3).** One short top list of about eleven plain-named groups (Account, Privacy and security, Notifications, Content and media, Appearance, Accessibility, Languages, Help, About), each a drill-in page. Developer options are hidden unless switched on. Source: [`Settings.tsx`](https://github.com/bluesky-social/social-app/blob/7f064abe2514bced0a5de5f605b2ee23341899b4/src/screens/Settings/Settings.tsx) lines 186 to 315. **Fetched.**
- **Messages (4).** 3 seconds by default. On the web they appear at the bottom left. Source: `src/components/Toast/const.ts` and `index.web.tsx` line 26. **Fetched.** Position on the phone: not verified.
- **Size (6).** Three widths: phone gets a bottom bar; tablet gets a narrow icon-only side strip; desktop gets a full side list. Source: `src/lib/hooks/useWebMediaQueries.tsx` and `src/view/shell/desktop/LeftNav.tsx` line 711. **Fetched.**
- **Links (7).** Ordinary web addresses on its own site open the installed app; a private scheme exists too. Source: `app.config.js` lines 28 and 68. **Fetched.**
- **Telling readers about new features (5).** One announcement dialog per new feature, in a folder of them (bookmarks, drafts, iPad beta and so on). Seen by file name only; how it decides when to show: not verified.

### 14. Wikipedia for iPhone and iPad: tips and a documented link list

- **Code:** <https://github.com/wikimedia/wikipedia-ios>, version read `0cc1624a`. **Fetched.**
- **Licence:** MIT. **Stars and last change:** 3,478; 2026-11-16.
- **Platforms and how:** native iPhone and iPad app. The website is a separate project. No Mac app found.

What it does:

- **Tips (5).** It uses the tip bubbles Apple supplies. One tip points at one button, with rules for when it may show: only on a narrow screen, and never while another pop-up is about to appear. Closing it retires it for good. Source: [`ArticleViewController+Tooltips.swift`](https://github.com/wikimedia/wikipedia-ios/blob/0cc1624ab47c5e40b9e3968dc2362b45877cd81d/Wikipedia/Code/ArticleViewController+Tooltips.swift). **Fetched.** The tip in question teaches a trail back: "Tap on the 'W' to return to the tab you started from".
- **Bottom bar while reading (1).** Save, appearance, contents, share, find, language, more. Source: `Wikipedia/Code/ArticleToolbarController.swift` lines 36 to 105. **Fetched** (button names only).
- **Links (7), with a why document.** A short public table of every link the app answers, each with an example, including the same article reachable by private scheme or by ordinary web address. Source: [`docs/url_schemes.md`](https://github.com/wikimedia/wikipedia-ios/blob/0cc1624ab47c5e40b9e3968dc2362b45877cd81d/docs/url_schemes.md). **Fetched.**
- **First run (5).** A few welcome pages (`WelcomeViewController.swift`). Seen by name only.

### Also read, more lightly: Komga

- **Code:** <https://github.com/gotson/komga>, version read `db2ad643`. **Fetched.** MIT; 6,851 stars; last change 2026-11-16. A website from your own server ("works on desktop, tablets and phones", README). No native app.
- **Bars (1, 8).** Tap to show a top bar and a bottom bar; the bottom bar is a page slider with the current page at one end, the total at the other, and first, last, previous-book and next-book buttons around it. Source: [`DivinaReader.vue`](https://github.com/gotson/komga/blob/db2ad643c64d9199f7dd01cd3cca3ff0e7a17445/komga-webui/src/views/DivinaReader.vue) lines 82 to 120.
- **Confirm before leaving (4, 8).** At the last page, the first "next" shows a short message ("end of book; press again to move to the next") and only the second press leaves. Same file, lines 258 to 285.
- **Message on a silent change (4).** When the reading direction is set automatically, a 3-second message says so and says where the setting came from. Same file, lines 287 to 298.

## Which candidates did I drop, and why?

All from repository information read on 2026-11-16 unless marked. Platform claims here are from the short description or a search summary, not from reading code, so treat them as **not verified**.

| Candidate | Why dropped |
| --- | --- |
| KOReader (AGPL, 31,130 stars) | Made for e-ink readers and Android. No Mac or iPhone app found. |
| Foliate (GPL, 8,881 stars) | Linux desktop only. Its reading engine is used inside other readers. |
| Thorium Reader (BSD, 2,951 stars) | Desktop only. |
| Koodo Reader (AGPL, 28,867 stars) | Desktop and web. Readest covers the same ground on more platforms. |
| Logseq (AGPL, 45,614 stars) | Notes, not page reading. Ran out of time. |
| Joplin (licence unclear from GitHub, 57,204 stars) | Notes, not page reading. Ran out of time. |
| Standard Notes (AGPL, 6,722 stars) | Notes. Possibly a web page inside a phone shell, which would be relevant. Not opened. |
| Swiftfin (MPL, 4,288 stars) | Video player. Little overlap beyond a scrubber. |
| Saber (GPL, 5,050 stars) | Handwriting notes. A good source for pen bars. Not opened. |
| Omnivore | Read-later app. I believe its hosted service closed. Not verified. Not opened. |
| Wallabag, Readeck | Read-later. Scrolling articles, not pages. Snippet only. |
| OpenComic, Simple Comic | Desktop only. Snippet only. |
| Xournal++, LeedPDF, Open PDF Studio | Pen tools on desktop or web. Snippet only. |
| Everbound, Alexandria | Small or inactive readers. Snippet only. |
| GT-QuranReader, JustQuran | Small Qur'an readers. Snippet only. |
| tldraw, Obsidian, Anytype | Not open-source licences as far as I know. Not verified. |

## Who wrote down why?

These are the documents where a project explains a layout choice. They are worth more than code, and there are few.

| Project | Document | What it explains | Status |
| --- | --- | --- | --- |
| Readest | `docs/view-settings.md` | Settings for all books with per-book overrides | Fetched |
| Readest | `docs/page-curl.md` | How a paper-like page turn works on a spread | Fetched |
| NetNewsWire | `Technotes/HiddenPrefs.md` | Rare settings get no screen | Fetched |
| NetNewsWire | `Technotes/SwiftUI-UIKit-AppKit-Guidelines.markdown` | Separate screens per platform | Fetched, skimmed |
| Quran.com web | `docs/NAVBAR-ARCHITECTURE.md` | When the top bar hides, and at what widths | Fetched |
| Open-Mushaf Native | `DESIGN.md` | Its whole design, with a list of gaps | Fetched |
| Wikipedia iOS | `docs/url_schemes.md` | Every link the app answers | Fetched |
| Kiwix | `CHANGELOG.md` | A record of iPad layout faults fixed | Fetched |
| Quran iOS | A code comment on the bar timer | Why bars stay longer after a redesign | Fetched |

## What did I not manage to look at?

- No live web version was opened in a browser at computer or phone width. Every layout claim is from code or project documents.
- I did not search issue trackers, forums or blog posts for design discussions. The "why" list above is only what sits inside the repositories.
- Store listings were not opened, so "is it really on the Mac App Store" is not verified for any app.
- Problem reporting, optional sign-in and how each project's public site presents the app were noted only in passing (NetNewsWire and Home Assistant put help and troubleshooting inside settings).
- Quran iOS, Quran.com web and Home Assistant were read from a handful of files each, not the whole code.
- Notification use (question 4) was not examined in any app.
