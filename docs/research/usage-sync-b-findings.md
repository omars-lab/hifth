# Adding the usage counts together across devices: what is out there (raw findings, researcher B)

Searched on 2026-10-11, for the open question in the feature-usage design note: should the counts from the iPad, the Mac and the browser be added together, and how?
This file is the raw record: one entry per source, its address, whether the page itself was opened ("fetched") or only a search result was seen ("snippet only"), and what it says that matters here.
The design note built on it is the sibling file, the usage-sync-b design note.

A few words, once:

- **iCloud** is Apple's own online storage, tied to the Apple account signed in on a device. Several different ways of using it exist (below); they are not the same thing.
- **Entitlement** is a permission written into a signed Apple app, saying which Apple services it may use. iCloud needs one, and only a paid developer account can sign an app with it.
- **The shell** is the thin Apple app (one for iPad, one for Mac) that holds the web app inside a built-in web view.
- **The bridge** is the small message channel between the web page inside the shell and the shell's own Swift code.
- **A merge** is what happens when two devices both changed the same record and the two versions have to be combined.

## What the repository already says (read first)

- **The feature-usage design note** (commit 04553bc8, not yet on main): counts are kept per calendar day, one record per day, keyed by the day alone. Options A (each device on its own), B (carry a file), C (the owner's own online store). Recommends A now, B when one total is wanted.
- **The usage store**: one record per day, `{ day, counts }`, keyed by `day`. There is no device name in a record. So two devices' records for the same day would collide under any way of moving them; that is the first merge problem, and it is independent of the transport.
- **The storage-model decision** (`docs/decisions/storage-model.md`): every private reader record lives on the device, can be saved to a file and loaded back, and on the day there is sign-in also keeps "the reader's own cloud file", *written all at once*. It also says what would change that: "the sign-in question being answered against an account at all — in which case the cloud half is replaced by whatever a reader's own cloud drive can hold, and the file shape carries over." The owner's own iCloud is exactly such a "reader's own cloud drive".
- **The notes-export decision** already chose, for notes, "a separate export for usage activity", and automatic cloud sync only once there is sign-in.
- **The privacy check** (`scripts/gate-revision-privacy.mjs`) holds the confusion-jump record to "leaves the device only in a saved file the reader chooses to make", with the saved file's module on the allowed list. That is a working precedent for option B: a file the reader makes by hand is allowed; the app's own code sending it is not.
- **The shell's signing** (`native/project.yml`): both app targets have an empty development team; the Mac app is ad-hoc signed ("Ad-hoc signed: enough to run here"); the Mac entitlements file is empty. The native-shell design note (⑤) already records that a paid Apple developer membership is the blocker for Universal Links, and that question lives in the TestFlight-licence decision.
- **The shell's bridge** (`native/Hifth/Web/Bridge.swift`) carries three messages: ready, route, share (a link only). The shell has no download handler and no file-open handler (searched the native folder for download, open panel and document picker: no hits).

## Apple: who can use iCloud at all

### Apple's table of capabilities for iPhone and iPad apps

- <https://developer.apple.com/help/account/reference/supported-capabilities-ios> — **fetched** (raw page downloaded and the table cells read, because the summary tool dropped the tick marks).
- Columns: paid Apple Developer Program; paid Enterprise program; free "Apple Developer" account ("No cost is associated with this agreement and developers can't distribute apps").
- "iCloud: CloudKit", "iCloud: iCloud documents" and "iCloud: iCloud key-value storage" are ticked for the two paid programs and **empty for the free account**.
- "App groups" is ticked for all three, including free.

### Apple's table of capabilities for Mac apps

- <https://developer.apple.com/help/account/reference/supported-capabilities-macos> — **fetched** (raw page, table cells read).
- Columns: paid program; Developer ID (a paid certificate for apps handed out outside the Mac App Store); free account.
- All three iCloud rows are ticked for the paid program and for Developer ID, and **empty for the free account**. App groups: ticked for all three.
- So on both platforms, every iCloud route needs the paid membership. The Mac app today is ad-hoc signed with no team, which is neither.

### Apple Developer Program price

- <https://developer.apple.com/programs/> — **fetched**. "$99 annual membership."
- <https://developer.apple.com/support/compare-memberships/> — **fetched**; the tick marks did not survive extraction. It does say a free personal team gets apps that expire after 7 days, on up to 3 devices.

## Apple: iCloud key-value storage

A small iCloud-backed dictionary of named values, meant for settings.

### The class page

- <https://developer.apple.com/tutorials/data/documentation/foundation/nsubiquitouskeyvaluestore.json> — **fetched** (the machine-readable copy of <https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore>; the normal page is drawn by script and came back empty).
- Limits: "no more than 1024 keys"; "The total amount of available storage space for all values is 1 megabyte"; "The maximum size for a single value is 1 megabyte"; key names up to 128 characters.
- Over the limit, the write fails and the app is told by a notice with a "quota violation" reason.
- Timing: "saves it in memory initially and writes it to disk asynchronously later"; the system keeps local and server copies "updating each one at appropriate times". No figure is given.
- Distribution: "you must distribute your app through the App Store or Mac App Store, and you must request the iCloud key-value store entitlement." **This disagrees with the Mac capabilities table**, which ticks key-value storage for Developer ID apps too. Both are Apple pages; I did not settle which is right.
- Privacy: "Don't store personal or sensitive information in the key-value store. The system stores the information on disk in an unencrypted format." The design note describes these counts as personal; that sits awkwardly with this line.
- Not deprecated on any platform; available on iOS, iPadOS, macOS and others.
- Merging: the page does not state the rule. It only says the system "reconciles the values there with the local ones" and tells the app by a notice when another device changed something.

### The older iCloud design guide, key-value chapter

- <https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/DesigningForKey-ValueDataIniCloud.html> — **fetched** (archived, older, but Apple's own).
- Meant "for app preferences, app configuration, or app state"; "avoid using key-value storage for data essential to your app's behavior when offline".
- The merge rule, in Apple's words: if another device changed the store recently, the local value is not written; instead the app is told "to update itself based on the updated server values". In plain terms, one device's version wins and the other must redo its change. Two devices each adding to the same count would lose one side unless each device keeps its own key.

### Apple's own engineer on how big is too big

- <https://developer.apple.com/forums/thread/785350> — **fetched**. A developer found about 160 KB failed to sync while 100 KB worked.
- Apple's support engineer: "The iCloud key-value storage is intended to be used for storing preferences ... my advice is that you stay *far away* from those limits. If you need to store hundreds, or even tens, of KiB of data, it's time to use a different mechanism, with the most obvious replacement being CloudKit."
- Size of ours, estimated: a busy day's record is about 100 to 250 bytes, so 400 days is roughly 40 to 100 KB per device. That is in the "tens of KiB" band he warns about, unless the cloud copy keeps fewer days or a tighter shape.

### Sharing one key-value store between an iPhone, a Mac and a Watch

- <https://developer.apple.com/forums/thread/715381> — **fetched**. The poster's store synced between Mac and iPhone "almost immediately" but not to the Watch. Apple's engineer: the key-value entitlement must be the same on every platform (team prefix plus the one bundle identifier).
- Our two shell targets already share one bundle identifier (`com.bytesofpurpose.hifth`), so they would share one store once signed by a paid team. Inferred from the project file plus this thread; not tested.
- <https://developer.apple.com/tutorials/data/documentation/bundleresources/entitlements/com.apple.developer.ubiquity-kvstore-identifier.json> — **fetched**. Says only that the entitlement names "The container identifier to use for iCloud key-value storage"; nothing on sharing.
- Search answer also cited a Solar2D forum thread on the same point — **snippet only**.

### How fast it syncs, and throttling

- Search for sync delays — **snippet only** (<https://developer.apple.com/forums/thread/726593>): about a minute on a freshly signed-in device; an older reply guessed "a few seconds". No Apple figure exists that I found.
- <https://developer.apple.com/tutorials/data/documentation/technotes/tn3162-understanding-cloudkit-throttles.json> — **fetched**. Apple may slow down ("throttle") any app using CloudKit, CloudKit's web access, Core Data mirroring "and NSUbiquitousKeyValueStore". There is "no API for an app to configure the expiration time". For counts that only need to agree by tomorrow, this does not matter.

## Apple: CloudKit private database

CloudKit is Apple's database service behind iCloud. Each user has a **private database** inside the app's area ("container") that only they can read.

### Whose storage, and who can see it

- <https://developer.apple.com/tutorials/data/documentation/cloudkit/ckcontainer/privateclouddatabase.json> — **fetched**.
- "Data in the private database counts toward the user's iCloud storage quota."
- "Only the user can access their private database, by default ... Data in the private database isn't visible in the developer portal."
- "The user's private database is only available if the device has an iCloud account."
- So: the data does leave the device, but to the owner's own Apple account, not to a server we run, and we cannot read it.

### The CloudKit marketing page

- <https://developer.apple.com/icloud/cloudkit/> — **fetched**. Private data is stored "in your users' iCloud accounts"; fields in the private database can be encrypted; syncs "across iOS, iPadOS, macOS ... and the web". No price is given for private data (it uses the user's own quota).

### Turning CloudKit on

- <https://developer.apple.com/tutorials/data/documentation/cloudkit/enabling-cloudkit-in-your-app.json> — **fetched**. "verify that your Apple Developer Program membership is active and has admin permissions." A container "can't [be] delete[d] or rename[d]" once created. An app can share a container.
- <https://developer.apple.com/tutorials/data/documentation/cloudkit/designing-and-creating-a-cloudkit-database.json> — **fetched**. Once the shape of the records is published, "you can't delete any part of it. You can only make additive changes." So the shape of a count record is a one-way door once live.
- <https://developer.apple.com/tutorials/data/documentation/xcode/configuring-icloud-services.json> — **fetched**. Containers can be shared "between multiple apps belonging to the same developer"; key-value storage is "1 MB ... up to 1024 key-value pairs, which is useful for syncing small amounts of data, such as the user's preferences."

### The sync engine (Apple's ready-made syncing helper for CloudKit)

- <https://developer.apple.com/tutorials/data/documentation/cloudkit/cksyncengine-5sie5.json> — **fetched**.
- Introduced in **iOS 17.0 and macOS 14.0**, which are exactly the shell's minimum versions.
- It schedules syncing itself, listens for changes from other devices, retries on network trouble and throttling, and "only syncs if there's an account signed in."
- It does not merge for you: "if you try to save a record and get a serverRecordChanged, you need to handle that error yourself." If each device only ever writes its own records, that case never comes up.
- The app must save the engine's own bookkeeping between launches. Needs the CloudKit and remote-notification entitlements.

### Reaching it from the web page inside the shell

- The bridge today only sends messages one way. Apple's reply-capable handler — <https://developer.apple.com/tutorials/data/documentation/webkit/wkscriptmessagehandlerwithreply.json> — **fetched** — lets the page send a message and get an answer back, on iOS and macOS. So the page could hand its day records to Swift, and Swift could hand back the other devices' records. The privacy gate would see this as the page handing personal records to code outside its list; that is the decision, not a technical block.

### CloudKit's web library, for a browser such as Firefox

- <https://developer.apple.com/tutorials/data/documentation/cloudkitjs.json> — **fetched**. A web page can reach "the same public and private databases as your CloudKit app"; it needs "an existing CloudKit app" and web access turned on. Loaded from Apple's own server (`cdn.apple-cloudkit.com`). Says to use an API token "from a website or an embedded web view in a native app". Not marked deprecated; version 2.
- <https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html> — **fetched**. Private data needs the person to sign in with their Apple account through Apple's own sign-in window; the token lasts 30 minutes, or 2 weeks with "Keep me signed in". The allowed web addresses can be limited to "Specific domains".
- Browser support: the WWDC 2015 session said all major browsers including Firefox — **snippet only**, and ten years old. I found nothing current that confirms Firefox.
- Recent health: <https://developer.apple.com/forums/thread/841292> — **fetched**. August 2026: web sign-in succeeds, then the very first request is refused with "AUTHENTICATION_REQUIRED", reproduced in Edge and Safari; 0 replies. <https://developer.apple.com/forums/thread/796369> — **fetched**. August 2025: sign-in fails in a normal Chrome tab but works in a private one; 0 replies.
- An older thread says a local test address is not accepted — **snippet only**.
- My inference, not tested: the shell serves the page from its own `hifth-app://app` address, which is not a web domain, so the web library's sign-in would probably not work inside the shell; the shell would use Swift instead. In Firefox it would mean loading Apple's script and signing in to Apple from the public site, which is the first outside call the app would make.

## Apple: SwiftData and Core Data with CloudKit

Apple's built-in on-device databases for Swift apps, which can mirror themselves into the private database automatically.

- <https://developer.apple.com/tutorials/data/documentation/swiftdata/syncing-model-data-across-a-persons-devices.json> — **fetched**. Needs the iCloud capability ("requires an active Apple Developer account") and remote notifications. CloudKit "is unable to enforce the unique property option"; the shape is "additive only" once published; changes sync "concurrently and at opportune times"; no merge rule is described.
- <https://developer.apple.com/tutorials/data/documentation/coredata/mirroring-a-core-data-store-with-cloudkit.json> — **fetched**. Needs the paid program and an iCloud account; uses "a specific record zone in the CloudKit private database, which is accessible only to the current user"; no unique constraints.
- What matters here: our counts live in the web page's own storage, not in a Swift database. Using either would mean keeping a second copy of the counts on the Swift side and copying across the bridge. It is the sync engine above with more machinery and less control; nothing it adds is needed for a few kilobytes.

## Apple: iCloud Drive documents

The app's own folder inside the user's iCloud Drive; files put there appear on the user's other devices.

- <https://developer.apple.com/tutorials/data/documentation/foundation/filemanager/url(forubiquitycontaineridentifier:).json> — **fetched**. Needs the iCloud documents entitlement (so the paid program); returns nothing "if iCloud storage is unavailable"; must not be called on the main thread.
- <https://developer.apple.com/library/archive/documentation/General/Conceptual/iCloudDesignGuide/Chapters/DesigningForDocumentsIniCloud.html> — **fetched**. Two devices changing one file make a conflict the app must resolve; "On iOS devices, changes are pulled at appropriate times, such as when the app that owns the files comes to the foreground. In OS X, changes are pulled immediately." A Mac downloads new files at once; an iPad only when asked.
- What matters here: one file per device (never two devices writing one file) avoids conflicts altogether, the same trick as the per-device records below.
- Separately, and with no entitlement at all: the system's own "Save to Files" and file picker can already put a file into the user's iCloud Drive and read one back. Apple's iCloud site lists **Firefox 128 or later** as a supported browser on Mac and PC — <https://support.apple.com/en-us/118308> — **snippet only** (search result quoted the page's list; I did not open it). So a file saved to iCloud Drive from the iPad can be picked up in Firefox on the Mac, either from the Finder's iCloud Drive folder or from iCloud's website.

## Apple: App Groups

- <https://developer.apple.com/tutorials/data/documentation/xcode/configuring-app-groups.json> — **fetched**. "An app group allows multiple apps developed by the same team to access one or more shared containers." Free accounts can use it (both capability tables).
- The page does not say "same device only"; that it shares only on one device is my inference from it being a shared folder on disk.
- What matters here: it would let two apps from the same team on one machine share counts. We have one app per machine, and Firefox cannot join it, so it does not help.

## Apple: what Apple already measures for us

### App Store Connect App Analytics

- <https://developer.apple.com/help/app-store-connect-analytics/engagement/app-usage> — **fetched**. Six numbers: installations, sessions (opened for at least two seconds), active devices, active in the last 30 days, deletions, crashes. Filters: version, device, OS version, region, date. Only from people who opted in to sharing with developers.
- No per-feature numbers and no events of our own. TestFlight coverage is not stated. The shell is not distributed through the App Store at all, so it would show nothing today anyway.
- A search answer listing the same metrics — **snippet only** (<https://developer.apple.com/app-store-connect/analytics>).

### Screen Time

- <https://support.apple.com/guide/mac-help/mchlf2c0c770> — **fetched**. Time per app and per category, notifications, pickups; a device menu with "All Devices to see the combined statistics" (the newest version needs the 27 releases on every device). Nothing about features inside an app.
- Search answer — **snippet only**: "Share across devices" combines devices signed in to the same Apple account; per-website time is only for Safari. So Screen Time could tell the owner how long Hifth was open across devices, never which feature was used, and not for Hifth in Firefox.

## Privacy-minded analytics services

All of these send events to a server, ours or theirs. All are built to count many people, not one.

### TelemetryDeck

- <https://telemetrydeck.com/pricing/>, <https://telemetrydeck.com/docs/>, <https://telemetrydeck.com/blog/pricing-update-2026/> — **could not fetch** (every attempt failed at the secure-connection step, from both tools). Everything below is **snippet only**.
- A search answer quoted TelemetryDeck's own blog: the free plan has had 100,000 events a month; a July 2026 pricing change narrowed the free plan for new sign-ups and added a cheaper starter plan. Third-party listings give paid plans from about 9 to 19 euros a month. Not verified.
- <https://github.com/TelemetryDeck/SwiftSDK> — **fetched**. The Swift library makes a per-install user identifier, hashes it on the device before sending, and sends device, OS, app version, language and time zone with every event, to TelemetryDeck's servers.
- What matters here: it is the closest fit for "count features privately" in the Apple world, but it is a third party receiving events, which is exactly what the privacy check forbids, and its job is to count many users.

### Aptabase

- <https://github.com/aptabase/aptabase> — **fetched**. Open source; can be self-hosted (server under the AGPL licence, libraries MIT); "does not use unique identifiers", tracks sessions; libraries for Swift and for web apps.
- <https://aptabase.com/pricing> — **could not fetch** (same connection failure). Prices not checked.

### PostHog, self-hosted

- <https://posthog.com/docs/self-host> — **fetched**. Needs roughly a 4-CPU, 16 GB server; self-hosting is "officially unsupported"; for most people "PostHog Cloud is far and away the best experience". Far too much for one person's counts.

### Plausible, self-hosted

- <https://plausible.io/docs/self-hosting> — **fetched**. AGPL; "Self-hosting is community supported only"; described as "an open source web analytics tool" for websites, not apps.

## Local-first syncing for the web

"Local-first" means each device keeps the full copy and works offline; syncing is something added on top.

### The grow-only counter (the merge idea itself)

- <https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type> — **fetched**. A grow-only counter gives each device "its own slot", which only that device increases; copies merge "by taking the max() of every element"; the total is the sum of the slots.
- What matters here: this is the rule our counts need, and it needs no library. Key each record by device and day; each device only writes its own records; when records arrive from elsewhere, keep the larger count for that device and day (it can only have grown); the total is the sum across devices. Taking in the same file twice changes nothing. A single shared counter, by contrast, needs every device to agree on one number, and two devices adding at once can lose one side.

### Automerge

- <https://automerge.org/docs/hello/> — **fetched**. A library of data shapes that merge themselves; "Network-agnostic"; syncing comes from a separate library (automerge-repo); compiled to WebAssembly for browsers.
- <https://automerge.org/docs/reference/documents/counters/> — **fetched**. Its counter "deals with concurrent changes correctly": two increments from 3 give 5, where a plain number gives 4.
- What matters here: correct, but it still needs a way to carry the changes (a server, or a file), and the per-device rule above already gets the same answer for counts in a few lines.

### Yjs

- <https://docs.yjs.dev/> — **fetched**. Same family; shared maps and lists, no counter type listed; "doesn't need a central source of truth"; carried over WebSocket, WebRTC or a hosted service.

### remoteStorage

- <https://remotestorage.io/> — **fetched**. "Open web protocol for per-user storage": the person picks a storage provider or runs their own server.
- <https://github.com/remotestorage/remotestorage.js> — **fetched**. Says it is "actively maintained"; can also sync to "a person's Dropbox or Google Drive account". No release date was visible.
- What matters here: the one web-standard way to "put my data in my own storage" that would also reach Firefox. It is still a sign-in to an outside service and a network call from the app.

### Browser file tools

- Save picker: <https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker> — **fetched**, and MDN's compatibility data (<https://bcd.developer.mozilla.org/bcd/api/v0/current/api.Window.showSaveFilePicker.json>) — **fetched**: Chrome 86 and later; **not in Firefox, Firefox for Android, Safari or Safari on iOS**. So in Firefox a saved file is an ordinary download, and taking one in is an ordinary file picker. Both work everywhere.
- The browser's private file area: <https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system> — **fetched**. "not visible to the user"; cleared with the site's data; nothing about syncing. No help.
- Web share with files: <https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share> — **fetched**, and MDN's compatibility data — **fetched**: Safari 12.1, Safari on iOS 12.2, Firefox for Android 79; **Firefox on the desktop only behind a hidden setting**. So on the phone the share sheet can send the file to iCloud Drive or AirDrop; on the Mac in Firefox it cannot.

### Inside the shell: can the page save or open a file at all?

- <https://developer.apple.com/tutorials/data/documentation/webkit/wkuidelegate/webview(_:runopenpanelwith:initiatedbyframe:completionhandler:).json> — **fetched**. "By default on macOS, file uploads are disabled if you don't implement this method." On iOS they are enabled by default. Our shell does not implement it, so on the Mac app a "choose a file" button would do nothing today.
- <https://developer.apple.com/tutorials/data/documentation/webkit/wkdownloaddelegate.json> — **fetched**. Saving a download from the web view needs a delegate that picks where to write it. Our shell has none, so a "save the counts" download would probably do nothing in either app today (inferred; not tested).
- So option B, which needs no server, still needs a small piece of Swift in both apps, or a bridge message that hands the file to the share sheet the shell already shows.

## How established personal apps do it

### Apple Books

- <https://support.apple.com/en-my/guide/books/ibks86dab303/mac> — **fetched**. Reading place, collections, bookmarks and highlights sync when "signed in to the same Apple Account" with iCloud Drive and Books turned on. Apple's own reading app uses iCloud and nothing else; it has no web version.

### Kindle

- Search only, **snippet only**, no Amazon page opened (third-party guides and forums). Whispersync shares the furthest page read, bookmarks, highlights and notes across every device and app on one Amazon account, through Amazon's servers. A device that is offline catches up later; a "sync to furthest page" button exists for when it does not.

### Day One (journal)

- <https://dayoneapp.com/guides/day-one-sync/day-one-sync-faq/> — **fetched**. "On Dropbox we had continued challenges with duplicate entries appearing in journals." "On iCloud, we had problems with data loss." They built their own sync and account instead. Needs a Day One account; Mac, iOS, Android, Windows.
- Search answer on their end-to-end encryption — **snippet only**: entries are encrypted on the device with a key the company never holds.
- What matters here: the strongest warning from an established app against trusting iCloud with data that cannot be rebuilt. Counts are low-stakes and rebuildable from nothing, which cuts the other way.

### Things (to-do list)

- <https://culturedcode.com/things/support/articles/2803586/> — **fetched**. Its own free "Things Cloud" account, email only, no Apple account needed; encrypted in transit and at rest; "Third-party services like iCloud, Dropbox, etc. are not supported."

### Obsidian Sync

- <https://obsidian.md/help/sync> — **fetched** (after a redirect from help.obsidian.md). A paid add-on on their own regional servers, with version history; warns that using it alongside Dropbox, Google Drive or OneDrive can cause conflicts. Price and encryption are on other pages I did not open.

### Streaks (habit tracker)

- Search only, **snippet only**: the App Store listing says tasks sync across devices with iCloud; a MacStories review says habit data syncs but settings do not, and the Mac app is "occasionally slow to update", catching up when reopened.

### Loop Habit Tracker (Android)

- Search only, **snippet only**: no sync at all; a full backup file is exported by hand and imported on the other device, plus optional daily automatic export files. Privacy-first by design.

### Safari's storage clearing

- Search only, **snippet only** (WebKit bug 237350 and 2020 coverage): Safari may delete a site's stored data after seven days of Safari use without visiting; apps added to the Home Screen and wrapped apps keep their own count of days. The design note already plans for this ("the panel says the day counting began").

## What I looked for and did not find

- Any current statement from Apple that CloudKit's web library works in Firefox.
- A published figure for how long iCloud key-value storage takes to reach another device.
- TelemetryDeck's and Aptabase's own pricing pages (the connection failed).
- Amazon's own Kindle help page.
- Whether Apple's own app analytics include TestFlight installs.
