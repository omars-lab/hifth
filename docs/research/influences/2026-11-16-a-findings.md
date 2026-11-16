# Which open-source apps can a page-by-page reader learn from? (researcher A, findings)

Looked up on 2026-11-16. This is the raw record. My reading of it is in `2026-11-16-a-design.md`, next to this file.

## How to read the tags

- **fetched** means I downloaded the project's source on 2026-11-16 and read that file myself. Line numbers are from the version named in the table below.
- **API** means the number came from GitHub's own data on 2026-11-16 (stars, licence, last change, latest release).
- **snippet** means I only saw a short excerpt, not the page. Nothing below rests on a snippet.
- **not verified** means I did not open any evidence. I say so instead of describing from memory.
- I ran no web searches. Everything here comes from GitHub's data and from the projects' own source files and issue pages.
- I did not run any of these apps or look at screenshots. Every layout claim is read from code. Where code cannot tell me how something looks, I say so.

To open a line yourself: take the "source version" address from the table and add the file path and `#L` plus the line number. Example: `https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/apps/readest-app/src/utils/deeplink.ts#L56`.

## What is the short version?

- **One open-source reader really does ship on Mac, iPhone, iPad and the web from one codebase: Readest.** It is the closest match to our shape. It is AGPL, so we take ideas, not code.
- **The readers agree on one thing: the page comes first, and the bars hide.** Readest, Quran for iOS, Aidoku and pdf.js full-screen all hide controls until asked. They disagree on how you ask: hover (computer), tap (touch), or a timer.
- **Two apps solved "where do the pens go" in opposite ways.** The Zotero web reader puts pens in the middle of the one top bar, between navigation and search. Zotero for iPad makes the pen bar a separate strip the reader can drag to the left, right, top, or pin under the top bar.
- **Nobody I read ships a step-by-step first-run tour.** Excalidraw shows three hand-drawn hints on an empty canvas. Quran for iOS shows "what's new" screens per version. Readest teaches a gesture at the moment it happens. NetNewsWire, Kiwix, Aidoku, pdf.js: nothing found.
- **Links: the strongest pattern is two forms that mean the same thing.** Readest builds a custom-scheme link and an ordinary https link for the same place, and treats the https one as the one to share. Zotero's page links count pages from 1, like a person does. Home Assistant asks before a link is allowed to *do* something.
- **Gaps.** I could not download the Quran.com website source in time. I did not find a single design document on screen layout in any of these projects. The "why" I found is in code comments, one issue, and NetNewsWire's short technical notes.

## Which apps did I read closely, and what are their numbers?

All numbers are API, 2026-11-16.

| App | Repository | Licence | Stars | Last change | Latest release | Source version I read |
| --- | --- | --- | --- | --- | --- | --- |
| Readest | `readest/readest` | AGPL-3.0 (ideas only) | 26,359 | 2026-11-16 | v0.12.20, 2026-11-05 | `https://github.com/readest/readest/blob/ca575bb68010fe52e599860c92df40ca59047068/` |
| Zotero reader (web) | `zotero/reader` | AGPL-3.0, read from its COPYING file (ideas only) | 206 | 2026-11-14 | none listed | `https://github.com/zotero/reader/blob/5581a8daa72013ae7424d41688dfbab5100b47ec/` |
| Zotero for iPhone and iPad | `zotero/zotero-ios` | AGPL-3.0, read from its COPYING file (ideas only) | 318 | 2026-11-14 | none listed | `https://github.com/zotero/zotero-ios/blob/0d914f8c3d7ed3ac20a815f1c6c92b5c86db0687/` |
| Quran for iOS | `quran/quran-ios` | Apache-2.0 | 601 | 2026-11-16 | 3.0.2, 2026-10-09 | `https://github.com/quran/quran-ios/blob/956e30a27cfdd44ae1d4d175ef801432d90b0100/` |
| Excalidraw | `excalidraw/excalidraw` | MIT | 135,783 | 2026-11-16 | v0.18.1, 2026-04-21 | `https://github.com/excalidraw/excalidraw/blob/82190fb28f58070b34b4017e70c0e2e83701a8e3/` |
| Aidoku | `Aidoku/Aidoku` | GPL-3.0 (ideas only) | 4,760 | 2026-11-14 | v0.9-4, 2026-10-16 | `https://github.com/Aidoku/Aidoku/blob/95d1468d599a154f03d6a1dd06bf839d3ff3f7bd/` |
| pdf.js viewer | `mozilla/pdf.js` | Apache-2.0 | 54,142 | 2026-11-15 | v6.5.438, 2026-11-01 | `https://github.com/mozilla/pdf.js/blob/bb1539a2c9b5b76d070284cca9091717133d8bf1/` |
| Home Assistant for Apple devices | `home-assistant/iOS` | Apache-2.0 | 2,415 | 2026-11-16 | 2026.10.3, 2026-10-29 | `https://github.com/home-assistant/iOS/blob/ac2896d2f14a0e80d18e612eef7633d06b5be501/` |
| Kiwix for Apple devices | `kiwix/kiwix-apple` | GPL-3.0 (ideas only) | 823 | 2026-11-16 | 3.18.0, 2026-10-31 | `https://github.com/kiwix/kiwix-apple/blob/8e13ae648ae92e3da019521554a67cb27b01a5c1/` |
| NetNewsWire | `Ranchero-Software/NetNewsWire` | MIT | 10,539 | 2026-11-16 | mac-7.2.1, 2026-10-20 | `https://github.com/Ranchero-Software/NetNewsWire/blob/a5cec78e2aaca287144bcd45fa6ff2f1141518e7/` |
| Sefaria (web) | `Sefaria/Sefaria-Project` | GPL-3.0 (ideas only) | 774 | 2026-11-16 | none listed | `https://github.com/Sefaria/Sefaria-Project/blob/ce9b1c84dc858b667b92655ea82ebf8f7e7810f7/` |

The eight questions are numbered the same way throughout:

1. Where do the controls for moving and for changing the view live?
2. Where do the pens live, next to navigation?
3. How is a long settings list organised?
4. How does the app talk to the reader?
5. How does it teach a first-time reader?
6. How does one design change between Mac, iPad, iPhone and a browser tab?
7. How do links open the app at a place?
8. What does a page-by-page reader do well?

---

## 1. Readest: what does the one reader that ships everywhere do?

**What it is.** An e-book reader. One codebase: a web app (Next.js) inside a thin native wrapper (Tauri). Its README says it runs on "macOS, Windows, Linux, Android, iOS, and the Web" (`README.md` L8), names the App Store for macOS, iOS and iPadOS (L112) and a web version (L115). fetched. This is the same shape as ours: a web page drawn in a shell. It is AGPL: ideas only.

All paths below start with `apps/readest-app/src/`. All fetched.

**Question 1, moving and view controls.**

- The bottom bar is hidden until asked for. On a computer an invisible strip 52 pixels tall at the bottom of the window shows the bar when the mouse enters it (`app/reader/components/footerbar/FooterBar.tsx` L257-281). The Escape key hides it (L185).
- The top bar is the same: only visible while the mouse is over it or one of its menus is open (`app/reader/components/HeaderBar.tsx` L170, L215, L246).
- On a computer the bottom bar is one row: previous section, previous page, go back, go forward, a page-number box, a slider, read aloud, next page, next section (`footerbar/DesktopFooterBar.tsx` L101-123).
- On a phone the bottom bar is a row of five tabs: contents, colour, progress, font and layout, read aloud. Each opens a panel just above the bar (`footerbar/MobileFooterBar.tsx`, `footerbar/NavigationBar.tsx` L61-86). The slider and the back/forward buttons live in the "progress" panel (`footerbar/NavigationPanel.tsx` L110-165).
- View choices sit in a "View Options" menu in the top bar (`HeaderBar.tsx` L359).

**Question 2, pens.** There is no standing pen bar. Tools appear in a small popup when text is selected: copy, copy link, highlight, note, search, dictionary, translate, speak, proofread, share, quote card (`app/reader/components/annotator/AnnotationTools.tsx` L42-110). The reader can choose which tools the popup shows (`components/settings/AnnotationToolbarCustomizer.tsx`).

**Question 3, settings.**

- Nine tabs: Font, Layout, Theme, Behavior, Language, Integrations, AI Assistant, TTS, Custom (`components/settings/SettingsDialog.tsx` L92-137).
- It reopens on the tab used last (L141-153).
- **Any single setting can be pointed at.** Each has an address of the form `settings.<tab>.<item>`. Asking for one switches to its tab, scrolls to it and highlights it for two seconds (L327-367).
- Tab names drop to icons only when the window is too narrow (L375 onward).

**Question 4, talking to the reader.**

- Short messages disappear by themselves. Plain information is centred mid-screen. Success, warning and error go to the top, and to the top-right corner from 640 pixels wide (`components/Toast.tsx` L30-33).
- A separate short hint shows in a 44-pixel strip at the top for 2 seconds by default (`app/reader/components/HintInfo.tsx` L49).

**Question 5, teaching.** I searched the source for a tour, welcome or onboarding screen and found none. What it has instead is one hint shown at the moment of use: when you drag a selection to the page edge and hold, a bar grows along that edge to say "keep holding and the page will turn" (`annotator/PageTurnHint.tsx`, whole file read). Its code comment says: "Nothing else advertises the gesture". It uses physical left and right on purpose so it is correct in right-to-left books (L37-38).

**Question 6, adapting.** One breakpoint, 640 pixels, picks the phone arrangement or the computer one (`FooterBar.tsx` L238, L253). Both bottom bars are always built and the stylesheet shows one (L295-296). So it is two arrangements, not one arrangement scaled. The settings dialog has a minimum width of 520 pixels on a computer (`SettingsDialog.tsx` L484).

**Question 7, links.** (`utils/deeplink.ts`, whole file read.)

- Two forms for the same place: `readest://book/{id}/annotation/{id}` and `https://web.readest.com/o/book/{id}/annotation/{id}` (L62-74).
- The https form is the one written into exports. On a phone the installed app catches it. In a computer browser it opens a landing page (comment at L56-61).
- One parser reads both forms (L23-54).
- An older link shape is still accepted, so old links do not die (L104-107).
- Links that only the app itself should send (from a home-screen widget) refuse the https form (L164, L184).

**Question 8, page reading.**

- The slider waits 100 milliseconds before moving the book, so dragging does not thrash (`FooterBar.tsx` L76-82). The page label updates while dragging (`DesktopFooterBar.tsx` L52-58).
- **A trail back.** "Go Back" and "Go Forward" buttons sit next to the slider and are greyed out when there is nothing to go back to (`DesktopFooterBar.tsx` L101-112).
- The bar and its arrow icons flip for right-to-left books (`FooterBar.tsx` L289; `getNavigationIcon`).

**Why, in their words.** Issue 6999, "Bars issue" (opened 2026-10-22, closed; fetched: `https://github.com/readest/readest/issues/6999`). A reader on Windows reported the bars staying up, because the hover strip at the bottom edge sat against the taskbar and "mouse leave" never fired. The current code cites this issue. The lesson: showing bars on hover is fragile at the screen edge.

**What carries over.** The hidden-until-asked bars; two arrangements chosen by width; back and forward next to the slider; the paired link forms; settings you can link to; the hint that appears at the moment of the gesture.

**What does not.** Readest re-flows text, so its "page" changes with font size. Ours is a fixed printed page, so its font and layout tabs have no equivalent. Its pens are tied to text selection; ours include freehand marks, which need a standing tool.

---

## 2. Zotero: where do the pens go on a reader built for study?

**What it is.** A research library with a built-in PDF and e-book reader. The reader is a web app, built once and packaged several ways: the build file makes `zotero` (the computer app), `web`, `dev`, and view-only `ios` and `android` builds (`zotero/reader`, `webpack.config.js` L340-344; fetched). The iPhone and iPad app is separate Swift code. Both are AGPL: ideas only.

Not verified: whether the iPad app shows e-books through that same web reader. I looked and did not find the file that would prove it.

**Questions 1 and 2, the web reader's one top bar** (`zotero/reader`, `src/common/components/toolbar.js`; fetched). Three zones in one bar:

- Start: sidebar on/off, zoom out, zoom in, fit (L79-106), back after a jump (L146), page up and down (L157-166), a page-number box (L180).
- Middle: the pens. Highlight, underline, note, text, area, ink and eraser (L200-249), then a dropdown (L258).
- End: find (L281), and a side-panel button that only appears in the computer app (L286).

So navigation is on the reading-start side, pens in the centre, search and panels at the end.

**Question 2, the iPad pen bar** (`zotero/zotero-ios`, `Zotero/Scenes/Detail/PDF/Views/AnnotationToolbarHandler.swift`; fetched). The pen bar is its own strip, apart from navigation. It can sit in four places: leading edge, trailing edge, top, or pinned under the top bar (L36-41). The reader drags it by a handle after a long press (L64). Dashed outlines show where it can be dropped (L65-73). The code sets a smallest width of 300 points for the bar (L51). The position is stored in a form made for saving, so I read it as remembered; I did not trace where it is saved.

**Question 7, links** (`Zotero/Controllers/CustomURLController.swift`; whole file read). Two actions: `zotero://select/...` shows an item in the library, `zotero://open-pdf/...?page=N&annotation=KEY` opens a file at a page or a note (L15-18, L136-137). A comment at L176 says these links "use 1-based physical page numbers" while the reader counts from zero inside, and the code converts. An older link shape from a retired add-on is still accepted (L156-169).

**What carries over.** Navigation at the start, pens in the middle, search at the end is a clear answer for a wide screen. The movable pen bar is the best answer I found for a tablet held in different hands. Page links that count from 1 match a printed book.

**What does not.** A page number in a link is enough for a PDF; our links also name features. The iPad bar needs native code; ours is drawn in a web view, so dragging and remembering would be built in the web layer.

---

## 3. Quran for iOS: what does the nearest subject match do?

**What it is.** A native Swift app for iPhone and iPad, Apache-2.0, showing the same printed pages we do. I did not find a Mac version in the source (not verified either way). The Android app and the website are separate projects.

All fetched.

**Question 1.**

- A tap on the page shows or hides the bars (`Features/QuranViewFeature/Sources/QuranViewController.swift` L158-162). The status bar hides with them (L70).
- The bars hide themselves after 5 seconds. The comment explains the number (see "why" below) (L147-153).
- The top bar carries a two-line title, the sura name and a page description (L91, L468-471), with a "more" menu and bookmark buttons on one side (L353, L365, L483).
- I found no page slider.

**Question 3, two levels of settings.**

- An in-reader "more" menu holds what changes the page you are looking at: reading mode, translation, word pointer, dividers, verse markers, rotation lock, two pages, vertical scrolling, theme (`Features/MoreMenuFeature/Sources/views/MoreMenuView.swift` L39-113).
- A separate Settings screen holds the rest: account, app icon, which printed edition, audio, downloads, translations, donate, share, review, contact, privacy, diagnostics (`Features/SettingsFeature/Sources/SettingsRootView.swift` L103-207).

**Question 5.** No tour found. There are "what's new" screens tied to app versions (`Features/WhatsNewFeature/Sources/`). I listed the folder and did not read the screens in detail.

**Question 6 and 8, two pages.** Two pages side by side is on by default on anything that is not an iPhone, and only shows when the screen is wider than 900 points (`Domain/QuranTextKit/Sources/TwoPages/TwoPagesUtils.swift` L11-18, whole file read). The setting's label says "(in landscape)". The pager is forced right-to-left whatever the device language (`Features/QuranPagesFeature/Sources/QuranPaginationView.swift` L55).

**Question 7.** `quran://sura` and `quran://sura/ayah`, for example `quran://2/255`, chosen to match the Android app (`Features/AppStructureFeature/Sources/Launch/QuranDeepLink.swift` L19-21). Tests check that an impossible sura or verse is refused (`Features/AppStructureFeature/Tests/QuranDeepLinkTests.swift`).

**Why, in their words.** The comment on the bar timer (L147-153) says the time was made longer "to give existing users the time to see the new buttons". So the hide delay was treated as a way of teaching.

**Secondary.** A contact-us service, a diagnostics screen, and an optional account card for sync exist (`SettingsRootView.swift`). Not read in detail.

**What carries over.** Tap to show, timer to hide. The split between "changes this page" and "everything else". Two pages by width, not by device name. Links that name a verse the way a person would, with tests for nonsense values.

**What does not.** It has no pens and no slider, so it is silent on questions 2 and most of 8.

---

## 4. Excalidraw: how does a drawing tool arrange and teach its tools?

**What it is.** A whiteboard that runs in the browser, MIT. Not an Apple app. I include it because it is the best-known open-source answer to "where do the tools go on each size of screen" and "how do you teach without a tour".

All paths start with `packages/`. All fetched.

**Question 6, three named sizes.** The code names three: phone, tablet, desktop (`common/src/editorInterface.ts` L4). Phone is up to 599 pixels wide (L19), or a short wide screen under 500 by 1000 for a phone on its side (L21-22, L72-75). Tablet is 600 to 1180 (L25-26). The size is worked out from the size of the drawing area, not the device (L148-157), and an app embedding it can force one (`excalidraw/components/App.tsx` L3768). On a computer the reader can also pick a "compact" or "full" look, which is remembered (L5, L16).

**Question 2, tools.** On a computer the tool row sits top-centre (`excalidraw/components/LayerUI.tsx` L334). On a phone there is a top bar and a bottom bar, and the tools sit in the bottom bar (`excalidraw/components/MobileMenu.tsx` L162-199).

**Question 4.**

- A standing help line changes with the tool in hand. With the pen: "Click and drag, release when you're finished" (`excalidraw/components/HintViewer.tsx` L102; wording in `excalidraw/locales/en.json` L392). It is drawn with the toolbar (`excalidraw/components/Toolbar.tsx` L255). Some hints are left out on a phone (`HintViewer.tsx` L166, L234).
- Short messages last 5 seconds by default. A message can be told to stay until closed, with a close button (`excalidraw/components/Toast.tsx` L10, L26-28, L67).

**Question 5, the welcome screen.** Three short hints point at the real controls: the menu ("Export, preferences, and more..."), the toolbar ("Pick a tool & Start drawing!"), and help ("Shortcuts & help") (`excalidraw/components/welcome-screen/WelcomeScreen.Hints.tsx` L16-44; wording in `en.json` L624-627). They only show when the canvas is empty, nothing is loading, the plain select tool is active and distraction-free mode is off (`App.tsx` L2499-2505). Pick a tool or draw anything and they are gone. There is nothing to skip.

**What carries over.** Naming the sizes in one place and deciding by the size of the area. A help line that follows the tool in hand. Hints that point at the real buttons and vanish on first use.

**What does not.** Its hints rely on an empty canvas. A reader never has an empty page, so the trigger would need to be something else, such as "has never picked up a pen".

---

## 5. Aidoku: what does a right-to-left paged reader on Apple devices do?

**What it is.** A comic reader. Its README says "iOS, iPadOS, and macOS" (`README.md` L3; fetched). How the Mac version is built is not verified. GPL-3.0 with a contributor agreement (L41): ideas only. Comics read right-to-left, so it has met our direction problem.

All fetched.

**Question 8.**

- **The slider runs backward for right-to-left books.** The reader sets the slider's direction to "backward" when the reading mode is right-to-left (`Aidoku/Features/Reader/ReaderViewController.swift` L734-737). The slider has both directions built in (`Aidoku/Features/Reader/Toolbar/ReaderSliderView.swift` L11-20). It is also told not to flip again for a right-to-left device language (`Aidoku/Features/Reader/Toolbar/ReaderToolbarView.swift` L62).
- The slider ticks under the thumb as the page changes (`ReaderToolbarView.swift` L15-16), and its handle grows while held (`ReaderSliderView.swift` L200).
- **Tap zones.** Five named maps of where a tap means "next" or "previous": left-right thirds, an L shape, one called "kindle", one called "edge", and automatic, plus off (`Aidoku/Core/Settings/TapZone.swift` L25-63, whole file read). The reader picks one from small pictures (`Aidoku/Features/Settings/TapZonesSelectView.swift` L44-46). There is also "invert tap zones" (`Aidoku/Features/Reader/ReaderSettingsView.swift` L82).
- **Two pages** has three settings: single, double, automatic. Automatic means two pages whenever the view is wider than it is tall (`Aidoku/Features/Reader/Readers/Paged/ReaderPagedViewController.swift` L175-187).

**Question 1.** A tap toggles the bars (`ReaderViewController.swift` L1565). The slider is in the bottom bar (L252). There is a setting to hide the bars when the reader swipes (`ReaderSettingsView.swift` L301).

**Question 3.** The reader has its own settings sheet, opened from the reading screen, separate from the app's settings (`Aidoku/Features/Reader/ReaderSettingsView.swift`).

**Question 7.** `aidoku://` links exist for adding a source list and opening a title (`Aidoku/App/AppDelegate.swift` L495-497, L866). I found no link to a page.

**Why, in their words.** The tap-zone file names where its maps came from: a comment linking the Android reader Mihon's navigation code (`TapZone.swift` L24). So these maps are a shared convention across comic readers, not one app's invention.

**What carries over.** A slider whose direction follows the book, not the device language. Automatic two pages by shape. Tap zones offered as pictures.

**What does not.** Comic pages have no verses to touch. On our page a tap already means something, so tap zones for turning would fight with it.

---

## 6. pdf.js viewer: what does the most-used web page reader do?

**What it is.** Mozilla's PDF viewer for the browser, Apache-2.0. Web only. The stylesheet has a build switch for the copy that ships inside Firefox (`web/viewer.css` L1872; fetched). Not an Apple app. I include it because it is a fixed-page reader in a browser tab, which is one of our four shapes.

All fetched.

**Questions 1 and 2, one top bar, three zones** (`web/viewer.html`).

- Left: sidebar on/off, find, previous, next, page-number box (L148-402).
- Middle: zoom out, zoom in, zoom menu (L414-425).
- Right: the tools (comment, signature, highlight, text, draw, image; L474-648), print, save, then a "more" button (L692).
- The "more" menu holds the rare things: full screen, a link to the current view, first page, last page, hand tool, four scrolling modes, and three two-page choices: none, odd, even (L729-857).

**Question 6, shrinking in steps.** As the window narrows, items drop out in a fixed order at 840, 750, 690 and 560 pixels wide. Some move into the "more" menu at 750. The zoom menu goes last, at 560 (`web/viewer.css` L1835-1868). So: one arrangement that sheds items, not two arrangements.

**Question 7.** The part of the address after `#` carries the place: `page`, `zoom`, a named destination, which side panel is open, and a search phrase (`web/pdf_link_service.js` L365-445).

**Question 8.**

- **A trail back using the browser's own Back button.** Before a jump, the viewer records where you were, then records the destination (`web/pdf_link_service.js` L185-189). The comment says this is done first "to be able to accurately capture the current document position". Back then returns you (`web/pdf_history.js` L691).
- Full screen hides its controls after 3 seconds without movement (`web/pdf_presentation_mode.js` L27) and turns pages on a swipe of more than 50 pixels (L34).
- "Odd" and "even" two-page choices let the reader say whether page 1 stands alone, like a cover (`web/viewer.html` L846-857).

**What carries over.** Record the place before a jump so Back works, in a browser tab at least. Shed items in a fixed order as width drops. Offer the "does page 1 stand alone" choice for two-page view.

**What does not.** Its bar never hides outside full screen, which costs a strip of the page on a phone. It has no phone arrangement at all.

---

## 7. Home Assistant for Apple devices: what does another "web page in a Swift shell" do about links?

**What it is.** A Swift app for iPhone, iPad and Mac, Apache-2.0. Its README treats the screen content as a separate project it calls the "frontend" (`README.md` L37-39; fetched), and its link code lives in a folder called `Sources/App/Frontend/`. One shared file has seven Mac-specific branches (`Sources/Shared/Environment/Environment.swift`), which tells me the Mac app is the same code. I did not open the web-view code itself, so "web page in a shell" is from the README and folder names, not from reading the view.

**Question 7** (`Sources/App/Frontend/IncomingURLHandler.swift`; L24-168 read).

- The first word of a link is its action: `navigate`, `call_service`, `fire_event`, `send_location`, `assist`, `camera`, `settings`, `invite`, and `x-callback-url` (L26-37). The comment gives `homeassistant://navigate/lovelace/dashboard` as the example (L101).
- **A link that only goes somewhere just goes. A link that does something asks first.** Calling a service, firing an event and sending location each show a confirm box (L68-84). Links from the app's own widget carry a proof and skip the question (L110, L156).
- Ordinary https links on the project's own web address are handled apart from custom-scheme links, and only for http and https. The comment says this stops a crafted custom-scheme link from reaching the in-app browser (L49-58).
- A link the app does not understand gets an error message, not silence (L234).

**What carries over.** Sort links into "go there" and "do this", and confirm the second kind. Tell the reader when a link was not understood.

**What does not.** It is a remote control, not a reader. It says nothing on questions 1 to 5 or 8 that I verified.

---

## 8. Kiwix for Apple devices: how does one SwiftUI app differ between Mac, iPad and iPhone?

**What it is.** An offline reader for Wikipedia and similar, GPL-3.0 (ideas only). One Swift codebase with separate starting files for iOS and Mac. Articles are shown in a web view (`App/CompactViewController.swift` L88; fetched).

All fetched.

**Questions 1 and 6, three arrangements.**

- iPhone: a bottom bar with back, forward, tabs, library, contents, and a "more" menu (`App/CompactViewController.swift` L83-110).
- iPad: a sidebar next to the article, and whether the sidebar is open is remembered (`App/SplitViewForiPad.swift` L39, L61).
- Mac: a sidebar window (`App/RootView_macOS.swift` L47) plus real menu-bar commands (`App/App_macOS.swift` L82-138).

**Question 3.** On the Mac, settings open in the standard Mac settings window with tabs: Reading, Library, Hotspot, About, Diagnostics (`App/App_macOS.swift` L142-169). On iPhone the same settings are a sheet. Another screen can open settings scrolled straight to one item (`App/CompactViewController.swift` L42, L170-171; `Views/Settings/Settings.swift` L155, L196). The comment there says this is used when an error needs the reader to fix one setting.

**Question 7.** Places inside a book are `zim://` addresses (`Model/Utilities/URL.swift` L43). Older `kiwix://` addresses are converted, not dropped (L89-90).

**What carries over.** On the Mac, use the menu bar and the standard settings window. When a message says "change this setting", take the reader to that setting.

**What does not.** It is native SwiftUI throughout; our controls are drawn in the web layer, so we would be imitating these arrangements, not getting them for free.

---

## 9. NetNewsWire: what does a much-admired Mac and iPhone app say about its own choices?

**What it is.** A feed reader for Mac and iPhone, MIT. No web version. Two separate native interfaces over shared logic.

All fetched.

**Why, in their words.** This project writes short technical notes, and two speak to our questions.

- `Technotes/SwiftUI-UIKit-AppKit-Guidelines.markdown` (whole file read): on the Mac "Use AppKit ... Avoid SwiftUI"; on iPhone use the newer toolkit except "when scrolling performance matters" or when it "can't provide the user experience we want". They chose different arrangements per device on purpose.
- `Technotes/HiddenPrefs.md` (whole file read): rare settings are kept out of the settings window altogether. They are switched on by a hidden key, and each is "named for a person ... so we can remember who asked for them".

**Question 3.** The Mac settings window has five tabs: General, Appearance, Timeline, Accounts, Advanced (`Mac/Preferences/PreferencesWindowController.swift` L25-41).

**What carries over.** A short settings list is a choice. Rare switches can live somewhere other than the main list, with a note of who asked.

**What does not.** A hidden key typed into a terminal is no use to our readers. The idea carries; the mechanism does not.

---

## 10. Sefaria: how does a scripture site put a text and its commentary side by side?

**What it is.** A website for Jewish texts, GPL-3.0 (ideas only). I read the web code only. Its phone app is a separate project (`Sefaria/Sefaria-Mobile`, 44 stars, API) which I did not open.

Fetched: `static/js/ReaderApp.jsx`.

**Question 6.** The screen is a row of panels. The number allowed is the window width divided by 360 pixels (L63, L1143). A narrow screen gets a "single panel" arrangement (L2809).

**Question 7.** The web address says what is on screen. A verse reference is the path. A short form adds commentary beside it, for example `/Genesis.1?with=Rashi` (comment at L926). More panels get numbered parts (L982).

**What carries over.** Panels by available width, with a floor of about 360 pixels each. An address a person can read and retype.

**What does not.** Its texts scroll; they are not fixed pages.

---

## Which candidates did I drop, and why?

Numbers are API, 2026-11-16. "Not opened" means I did not read any of its source, so I make no claim about its platforms or layout.

| Candidate | Stars | Licence | Why dropped |
| --- | --- | --- | --- |
| `quran/quran.com-frontend-next` | 1,932 | none detected | Wanted it. The download did not finish in the time I had. Last change 2026-04-27. |
| `quran/quran_android` | 2,444 | GPL-3.0 | Android only; the iOS sibling covers the same design. |
| `koreader/koreader` | 31,130 | AGPL-3.0 | Not opened. |
| `kovidgoyal/calibre` | 26,452 | GPL-3.0 | Not opened. |
| `edrlab/thorium-reader` | 2,951 | BSD-3-Clause | Not opened. |
| `readium/swift-toolkit` | 582 | BSD-3-Clause | A building kit, not an app with a layout to study. |
| `johnfactotum/foliate-js` | 1,157 | MIT | The page-drawing library under Readest; no screen layout of its own. |
| `Kareadita/Kavita` | 12,138 | GPL-3.0 | Not opened. A server with a web reader; worth a look for its page reader next time. |
| `gotson/komga` | 6,851 | MIT | Not opened. Same reason as Kavita. |
| `YACReader/yacreader` | 1,438 | GPL-3.0 | Not opened. |
| `ezra-bible-app/ezra-bible-app` | 239 | GPL-2.0 | Not opened. Small; last release 2026-06-04. |
| `Sefaria/Sefaria-Mobile` | 44 | GPL-3.0 | Not opened. Low activity signal. |
| `tldraw/tldraw` | 51,434 | custom, not read | Excalidraw covers the same ground under MIT. |
| `saber-notes/saber` | 5,050 | GPL-3.0 | Not opened. A handwriting app; would be a good second voice on pens. |
| `laurent22/joplin` | 57,204 | not detected, not read | Not opened. Would be a good second voice on long settings lists. |
| `standardnotes/app` | 6,722 | AGPL-3.0 | Not opened. |
| `logseq/logseq` | 45,614 | AGPL-3.0 | Not opened. |
| `siyuan-note/siyuan` | 47,255 | AGPL-3.0 | Not opened. |
| `streetwriters/notesnook` | 14,950 | GPL-3.0 | Not opened. |
| `toeverything/AFFiNE` | 74,577 | not detected, not read | Not opened. |
| `AppFlowy-IO/AppFlowy` | 79,013 | AGPL-3.0 | Not opened. |
| `anyproto/anytype-ts` | 9,100 | not detected, not read | Not opened. |
| `Automattic/simplenote-ios` | 2,147 | GPL-2.0 | Last release 2024-11-04; too quiet. |
| `omnivore-app/omnivore` | 16,419 | AGPL-3.0 | Not opened. No release listed. |
| `wallabag/wallabag` | 13,063 | MIT | Not opened. Server side of a read-later service. |
| `karakeep-app/karakeep` | 30,604 | AGPL-3.0 | Not opened. |
| `wikimedia/wikipedia-ios` | 3,478 | MIT | Not opened. Would be a good voice on first-run teaching next time. |
| `bluesky-social/social-app` | 18,392 | MIT | Not opened. One codebase for phone and web; not a reader. |
| `Dimillian/IceCubesApp` | 7,112 | AGPL-3.0 | Not opened. |
| `lichess-org/mobile` | 2,666 | GPL-3.0 | Not opened. |
| `jellyfin/Swiftfin` and `jellyfin/jellyfin-web` | 4,288 and 3,994 | MPL-2.0 and GPL-2.0 | Not opened. Media players; the scrubber would have been the interest. |
| `videolan/vlc-ios` | 1,320 | not detected, not read | Not opened. Same reason. |
| `zotero/zotero` | 15,961 | not read | The computer app; its reader is the `zotero/reader` project I did read. |

## What secondary things did I notice without chasing?

- **Reporting a problem.** Quran for iOS has a contact-us service and a diagnostics screen in settings. Kiwix has a Diagnostics tab in Mac settings. Neither read in detail.
- **Optional sign-in.** Quran for iOS shows an account card at the top of settings; reading works without it as far as the settings layout shows. Not read in detail.
- **How the public site presents the app.** Readest's https links land on a page of the website that decides whether to open the app or show the book in the browser (`deeplink.ts` L56-61, and `app/o/page.tsx`, which I listed and did not read).

## What could I not find?

- No project had a design document about where controls go. The reasons I found are four: one issue (Readest 6999), two code comments (Quran for iOS on the bar timer, Readest on the page-turn hint), and NetNewsWire's two notes.
- Two searches of issue lists for layout discussions (Quran for iOS, Zotero for iPad) returned nothing. That may be my search words, not an absence.
- No app I read has a revision calendar, look-alike verses, or a "mark a mistake" pen. Nothing here speaks to those.
- No app I read shows a first-run tour with steps, so I have no evidence about linking to a tour step.
- I looked at no screenshots and ran no app.
