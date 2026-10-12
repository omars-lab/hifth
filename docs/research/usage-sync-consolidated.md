# Should my usage counts from the iPad, the Mac and the browsers be added together, and how? (checked and consolidated)

This is the one note to act on. It was built from two independent searches of the same question, then checked: the sources behind the claims the recommendation rests on were opened again.
The two searches are kept as the record it was built from: researcher A's [design note](usage-sync-a-design.md) and [raw findings](usage-sync-a-findings.md), and researcher B's [design note](usage-sync-b-design.md) and [raw findings](usage-sync-b-findings.md).
The question itself is item ① of the [feature-usage design note](../design/feature-usage.md). Written 2026-10-11. No app code was changed.

> [!tip] Short version
> **The question:** the app counts, each day, how often you use each part of it, but each place you use it keeps its own list: the iPad app, the Mac app, Firefox on the Mac and Safari on the phone. Should those four lists become one total, and how?
> **Recommended, in one line:** keep each device on its own for now (A); when you want one total, carry a file per device through an iCloud Drive folder by hand (B2), after two cheap fixes that every road needs anyway; use your own iCloud automatically between the two Apple apps (D) only if the paid Apple membership gets bought for TestFlight and you decide your own iCloud is fair to use.
> **What it would change for you:** the info panel would show what you used everywhere, not only on the device in your hand. The cost is a tap to save your counts on each device now and then, and a tap to add them all up on the one you are reading. Nothing about reading, turning pages or revising changes.
> **Two fixes come first:** every road that adds counts up needs each device's counts to carry that device's name, so the same day from two devices can be added without counting twice; and every road through a file needs the iPad and Mac apps to learn to save and open one, which they cannot do today.

## Words used here

- **Device:** each place the app keeps its own counts. The iPad app, the Mac app, Firefox on the Mac and Safari on the phone are four, even though two of them are on the same Mac.
- **iCloud:** Apple's online storage tied to the Apple account signed in on a device. An app can use it three ways: a small settings box, a database, or a folder in iCloud Drive. They are not the same thing and do not cost the same.
- **iCloud Drive:** the iCloud folder you see in the Files app on the iPad and in the Finder on the Mac. You can save a file there from any app with the system's own save window.
- **The paid membership:** Apple's developer programme, 99 US dollars a year. It is what lets an app be signed with permission to use iCloud itself. The Mac app today is signed "just enough to run here", with no developer team.
- **The Apple apps:** the thin iPad and Mac apps that hold the web app inside a built-in web view.

## What does it change for a hafiz?

Nothing on the page, under any option. This is for the owner: one honest total of which features carried a week of revision, across every device it happened on.
For the pitch, a single total is the stronger claim: "over a month, on every device, the similar-verses list was opened 300 times" beats "on the iPad, 120".

## How must the counts be stored so two devices add up correctly?

Both researchers found the same answer on their own, and the textbook source agrees (opened again for this check). It holds whichever road the counts travel by, so it comes first.

- **Today a day's record carries only the day.** A "Tuesday" from the Mac and a "Tuesday" from the iPad would collide: one overwrites the other, or taking the same file in twice adds the Mac's Tuesday twice.
- **The fix:** each device gets a random name the first time it counts, plus a label you can read ("iPad", "Mac", "Firefox on the Mac"). Each record is "this device, this day, this feature, this number". A device only ever raises its own numbers.
- **When another device's records arrive, keep the larger number for each device, day and feature.** A device's count for a day only grows, so the larger one is the newer one. Taking the same file in twice, or an older file, changes nothing.
- **The total is the devices added up.** The panel can show it, with each device's share folded under it.
- **Two details neither research note spelled out**, found while checking:
  - *Forgetting.* If the iPad forgets its counts and later takes in a file that still holds the iPad's old counts, the "keep the larger number" rule would bring them back. So a device should note the day it last forgot, and ignore any copy of its own records older than that. Carrying only each device's own records in its file (as B2 does) makes this much rarer, but the note is still needed.
  - *The 400-day limit.* Taking in a file must drop days older than the 400 a device keeps, or old days come back.
- **Cost:** a small change to where the counts are kept and its tests, plus filling in "this device" on the days already counted. It is the same change whichever option wins, and it does not get harder by waiting.

## Can the iPad and Mac apps save or open a file today?

No, and this changes what option B costs. Researcher B found it; researcher A wrote that B "works on every device", which overstates it. This check confirmed B from Apple's pages and from the apps' own code.

- **Opening a file on the Mac app does nothing.** Apple's page for the web view says, in so many words, that on the Mac file uploads are turned off unless the app adds code for them, while on iOS they are on by default. The Mac app has no such code.
- **Saving a file does nothing in either app.** A web page saves a file by handing the browser a download. The Apple apps only let the web view go to the app's own pages and send every other address out to the system browser, which ignores this kind. A download also needs app code that picks where the file goes (Apple's download page), and the apps have none.
- **The share button carries a link, not a file.**
- **So option B, and everything built on it, first needs a small piece of Swift in both apps:** let the Mac app show the open window, and either catch downloads and save them, or add a bridge message that hands a file to the share sheet the apps already show ("Save to Files" is in it).
- **The same gap very likely breaks the bookmarks' save and load inside the Apple apps today**, since they work the same way. That is inferred from the code and Apple's pages; nobody has tried it in the apps. It wants fixing regardless of this question.

## What are the options?

Five are put to the owner. A, B and C are the three the design note first offered. B2 and D are new from the research.
B2 is B with a habit; it is not a separate build. D replaces both researchers' "Apple apps sync by themselves" ideas with the one the sources support.

| | A. Each device on its own (built) | B. Carry a file by hand | B2. One file per device, in an iCloud Drive folder | C. Your own online store | D. Your own iCloud, for the two Apple apps |
| --- | --- | --- | --- | --- | --- |
| How | nothing more to do | *Save my counts* writes a file; *Add counts from a file* on another device takes it in | as B, but each device saves under its own name ("usage, iPad") into one iCloud Drive folder, replacing its last file; *Add up all devices* takes in every file there | each device sends its counts to a store only you can open, behind a sign-in | the two Apple apps keep each device's counts in your private iCloud database, using Apple's ready-made sync helper; the browsers join by file (B2) |
| Reaches | each device sees only itself | all four | all four | all four | iPad and Mac apps automatically; Firefox and the phone only by file |
| Pros | nothing to build; nothing leaves any device; passes the privacy check as it stands | no server, no account, no money; adding a file twice is harmless; doubles as a backup of the phone's counts, which Safari can wipe after a quiet week; already promised by the notes-export decision | everything B has, and you never pair devices up: iCloud Drive does the carrying; each device writes only its own file, so iCloud never sees two devices change one file; no membership, because you save with the system's own window | automatic, everywhere, Firefox included; one place to clear everything | automatic between the iPad and Mac, usually within a minute; in your own Apple account, which the app's maker cannot see; counts against your own iCloud space, a few kilobytes |
| Cons | four lists for one person; no backup of the phone's counts | done by hand; the total is only as fresh as the last file; needs both fixes above | still a tap on each device to refresh; the iPad only fetches new iCloud Drive files when asked, so a just-saved Mac file may take a moment; needs both fixes above | needs a server to keep up and a sign-in, which do not exist; the first time the app's own code sends a personal record off the device | **needs the paid membership** and proper signing on both apps; the most code of any option; does not reach Firefox or the phone; the app's own code sends the counts off the device, even if only to your iCloud |
| Implications | closes no door | the file's layout must stay readable in later versions (it carries a version number); the privacy check gains the save-and-load part as a reader, as it already allows for the confusion map | the same as B; makes D an easy later step, because D would carry the same per-device records | reopens the rule that personal records stay on the device; waits on sign-in, which the storage decision puts "not this year" and which waits on the licence question | changes the privacy rule on purpose; the shape of a record in Apple's database can only grow once live, and the app's space in iCloud cannot be renamed or deleted; the same machinery could later carry bookmarks and notes, which is the storage decision's "own cloud file" |
| Next decision it forces | none | where the file goes (B2 answers it) | none until you want it automatic (then D) | the sign-in decision | whether to buy the membership (tied to TestFlight) and whether your own iCloud counts as "on the device" |
| Day to day | open the panel on each device and add up in your head | now and then save on one device, send it (AirDrop, Files, a message) and load it on another | *Save my counts* on each device when it occurs to you; *Add up all devices* on the one you are reading | sign in once per device; nothing after | nothing for the Apple apps; the browsers save a file now and then |

**Recommended: A now; B2 when you want one total, built on per-device counts after the Apple apps can save and open a file; D only if the membership is bought for TestFlight and you decide your own iCloud is fair to use.**
Why B2 over B: it is the same code, plus "take in every file in a folder", and it removes the pairing-up chore. Why not D first: it costs money and a privacy exception to save a tap, and still leaves the two browsers on files.

### Which devices could each option reach?

| | iPad app | Mac app | Firefox on the Mac | Safari on the phone |
| --- | --- | --- | --- | --- |
| A | itself only | itself only | itself only | itself only |
| B | yes, after the app fix | yes, after the app fix | yes, today (download, and choose a file) | yes, today (download or share sheet) |
| B2 | yes, after the app fix | yes, after the app fix | yes, from the iCloud Drive folder in the Finder | yes, saving to iCloud Drive from the share sheet or a download |
| C | yes | yes | yes | yes |
| D | yes, automatic | yes, automatic | by file only | by file only |

### How do the letters here match the two research notes?

The two researchers lettered their options differently. This note keeps A, B and C as the design note has them.

| here | researcher A | researcher B |
| --- | --- | --- |
| A, each device on its own | A | A |
| B, carry a file | B, with the per-device fix | B, with the per-device fix |
| B2, one file per device in an iCloud Drive folder, saved by hand | not offered | B2 |
| C, your own online store | C | C |
| D, your own iCloud through Apple's database | close to its E (an iCloud Drive folder the apps write themselves, which needs the membership) | D |
| not offered: Apple's small settings box | its D, its main iCloud pick | argued against |
| not offered: Apple's web library in the browser | F, under "what else" | E, unverified |

Do not mix up B2 with researcher A's E. Both put a file per device in iCloud Drive. In B2 *you* save the file with the system's own window, which needs no membership. In A's E the *app* writes into its own iCloud folder by itself, which needs the membership and the same signing as D.

## What else was considered, and why is it not an option here?

- **Apple's small settings box in iCloud** (researcher A's main pick). The simplest code, but Apple's own page says not to put "personal or sensitive information" in it because it is stored unencrypted, and the app treats these counts as personal. Apple's engineer says it is for preferences and to move to Apple's database once you hold "tens" of kilobytes, which a device's 400 days is. It needs the same membership as D. One Apple page also says it needs App Store distribution while Apple's capability table allows it outside the store; that clash was not resolved, and it does not matter once the route is set aside.
- **Apple's web library, so Firefox could join D.** It exists and is not retired, but nothing current says it works in Firefox, sign-in lasts at most two weeks, and the two recent forum threads about it failing (August 2025 and August 2026) have no answers. Worth a throwaway trial only if automatic sync in Firefox becomes the thing you want most.
- **Analytics services** (TelemetryDeck, Aptabase, PostHog, Plausible). Built to count many people for a developer; every one sends events to a server. Against the privacy rule, and less than the panel already shows.
- **Apple's own numbers.** App Store analytics counts sessions, never features, and the apps are not in the App Store. Screen Time adds up time across Apple devices, but per app, never per feature, and not for Firefox.
- **Merging libraries** (Automerge, Yjs) and **remoteStorage, Dropbox or Google Drive from the page.** The libraries add correctly but still need something to carry the data, and the per-device rule gives the same result in a few lines. The storage services would reach Firefox automatically, at the cost of a third company's account and a sign-in inside the page, for a few kilobytes.
- **App groups.** Share data between one developer's apps on one device. Nothing across devices.

## Where did the two researchers agree, disagree, or find something only one of them saw?

"Opened" means this check opened the page again. "Snippet" means only a search result was seen.

### Agreed, and confirmed

| claim | what the source says | checked how |
| --- | --- | --- |
| Every iCloud route used by the app itself (settings box, database, iCloud Drive folder) needs the paid membership, on iPad and on Mac | Apple's capability tables tick all three iCloud rows for the paid programme (and, on the Mac, Developer ID) and leave them empty for the free account; app groups are ticked for all three | opened: [iOS table](https://developer.apple.com/help/account/reference/supported-capabilities-ios), [macOS table](https://developer.apple.com/help/account/reference/supported-capabilities-macos), read from the page's own markup because the ticks do not survive a text reading |
| Keep a column per device, keep the larger number, add the columns | each device "is assigned its own slot", copies merge "by taking the max() of every element", the total is the sum, and "the merge function is commutative, associative, and idempotent" (taking the same copy twice changes nothing) | opened: [Wikipedia, conflict-free replicated data types](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) |
| Firefox has no save or open file picker that keeps a file open; an ordinary download and an ordinary "choose a file" work everywhere | Mozilla's compatibility data: both pickers in Chrome 86 and later; Firefox, Firefox for Android, Safari and Safari on iOS "false" | opened: [save picker data](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Window.showSaveFilePicker.json), [open picker data](https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Window.showOpenFilePicker.json) |
| Apple's web library is not shown to work in Firefox today | the August 2026 thread: sign-in succeeds, the first request is refused, reproduced in Edge and Safari, 0 replies | opened: [forum thread 841292](https://developer.apple.com/forums/thread/841292) |
| The settings box holds 1 MB and 1,024 keys | "no more than 1024 keys"; "1 megabyte" for all values; keys up to 128 characters | opened: [Apple's reference, as data](https://developer.apple.com/tutorials/data/documentation/foundation/nsubiquitouskeyvaluestore.json) |
| Analytics services, Apple's own numbers and merging libraries do not answer the question | as above | not reopened; both researchers opened the pages and agree |

### Disagreed

| point | researcher A | researcher B | which side the source supports |
| --- | --- | --- | --- |
| Which iCloud route for the Apple apps | the small settings box, kept small (one key per device per month) | Apple's database with its sync helper; the settings box is the wrong fit | **B.** Apple's reference has an "Important" box: "Don't store personal or sensitive information in the key-value store. The system stores the information on disk in an unencrypted format." It is introduced as a place to "store app preferences". Apple's engineer: "If you need to store hundreds, or even tens, of KiB of data, it's time to use a different mechanism, with the most obvious replacement being CloudKit." A's smaller keys answer the size worry, not the personal-data one. Opened: [reference](https://developer.apple.com/tutorials/data/documentation/foundation/nsubiquitouskeyvaluestore.json), [forum thread 785350](https://developer.apple.com/forums/thread/785350) (A had this thread only as an unidentified snippet). |
| Does carrying a file work in the Apple apps today | yes, "works on every device", with the share sheet "the app already has" | no: the Mac app refuses to open files, and neither app can save a download | **B.** Apple: "By default on macOS, file uploads are disabled if you don't implement this method. By default on iOS, file uploads are enabled." A download needs app code that "provide[s] a file destination". The apps' own code sends every address that is not the app's own out to the system browser, and the share button carries only a link. Opened: [file-open method](https://developer.apple.com/tutorials/data/documentation/webkit/wkuidelegate/webview(_:runopenpanelwith:initiatedbyframe:completionhandler:).json), [download helper](https://developer.apple.com/tutorials/data/documentation/webkit/wkdownloaddelegate.json); read the apps' web-view code directly. |
| How big a device's history is | about 60 KB typical, 160 KB at most | about 40 to 100 KB | Not settled by a source; both are estimates from the same record shape. Either way it is "tens of KB", inside the band Apple's engineer warns about for the settings box, and trivial for a file or Apple's database. |
| What to do first | B now | A now, with the per-device change; B2 when a total is wanted | A judgement, not a fact. This note sides with B's order, because the owner has not yet asked for a total, and the Apple-app fix makes B larger than A thought. |

### Found by only one researcher

| claim | who | checked? | does it change the answer? |
| --- | --- | --- | --- |
| B2: save a file per device by hand into one iCloud Drive folder, with no membership | B | **Partly.** On the Mac this is plain: the Mac app's permissions file is empty, so it is not walled in, and a save window can write anywhere, and iCloud Drive is a Finder folder Firefox can save into and load from. On the iPad, Apple's document-picker page names no iCloud permission for picking or exporting a file, and developers report it works without one, but one forum thread from 2018 asking exactly this was never answered by Apple ([thread 108131](https://developer.apple.com/forums/thread/108131), opened). **Very likely, not proven.** | No. If the iPad half failed, B still works through AirDrop or the share sheet; B2 would lose its convenience on the iPad only. |
| Apple's iCloud website supports Firefox 128 and later on the Mac | B (snippet) | **Opened** for this check: "On Mac: Safari 13.1 or later, Firefox 128 or later, Google Chrome 130 or later" ([Apple support 118308](https://support.apple.com/en-us/118308)) | A second way for Firefox to reach the iCloud Drive folder; not needed, since the Finder already does it. |
| The settings box is "not for personal information" | B | **Opened**; see "Disagreed" | Yes: it is why the settings box is not an option here. |
| Apple's database's record shape can only grow once live, and the app's iCloud space cannot be renamed or deleted | B | not reopened (B opened Apple's pages) | Adds to D's cost; does not change the order. |
| Apple's database on Apple's sync helper needs exactly the apps' lowest system versions (iOS 17, macOS 14) | both | not reopened | Makes D possible without raising the apps' lowest versions. |
| Safari on the phone can delete a site's stored data after seven days of use without a visit | A (opened), B (snippet) | not reopened | A reason to want any file option: it doubles as a backup of the phone's counts. |
| Forgetting brings counts back if a device's old records return in another device's file | neither, found while checking | reasoning, not a source | Adds one small rule to the per-device change (see above). |
| The bookmarks' save and load likely do not work inside the Apple apps today | neither, found while checking | inferred from the apps' code and Apple's pages; not tried | Not for this question, but it is a fault to fix regardless. |
| The TestFlight question was settled today on "own devices first", with a later move to sending it to named testers, which needs the paid membership | neither (both searched an older copy of the project) | read the decision record | Makes D's main cost, the membership, more likely to be paid for another reason later. |

## What would change the answer?

- **The paid membership being bought for TestFlight** (the TestFlight decision already plans a later move that needs it): D's money is then already spent, and D becomes the natural next step for the two Apple apps, with B2 kept for the browsers.
- **You deciding your own iCloud counts as "on the device"** in spirit: D stops needing a privacy exception and is straightforward on principle.
- **Sign-in arriving for other reasons:** C becomes cheap, and should use the per-device records.
- **Automatic sync in Firefox becoming what you want most before sign-in:** try Apple's web library as a throwaway first, and expect it to fail.
- **A week or two on several devices showing four lists are no nuisance:** stay on A; only the Apple-app file fix is still worth doing, for the bookmarks.

## What was not checked

- Whether the iPad app can open and export a file through the system windows with no iCloud permission. Very likely, not tried. A walk of the iPad app that loads a file through a "choose a file" button would settle it.
- Whether the bookmarks' save and load work inside the iPad and Mac apps today. Inferred broken, not tried.
- Whether Apple's settings box needs App Store distribution or also works for a Mac app handed out directly. Two Apple pages disagree; moot while that route is set aside.
- Whether Apple's web library works in today's Firefox, or from inside the Apple apps at all.
- How long Apple's database takes to reach the other device in practice; Apple gives no figure, and "by tomorrow" is enough for counts.
- TelemetryDeck's and Aptabase's own pricing pages (neither researcher could connect); they do not affect the answer.
- Whether the owner already pays for the membership. Nothing on this laptop shows one.
